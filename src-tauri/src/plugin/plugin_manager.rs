// PLUGIN-002 to PLUGIN-010: Plugin Manager implementation
// Handles plugin loading, activation, dependency resolution, and lifecycle management

use super::{
    PluginError, PluginId, PluginMetadata, PluginResult, PluginState,
    manifest_parser::{PluginManifest, ManifestParser},
    permission_manager::PermissionManager,
    lifecycle_manager::LifecycleManager,
};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use chrono::Utc;

/// PLUGIN-002: PluginRegistry with HashMap<plugin_id, PluginState>
/// Central registry tracking all installed plugins and their states
#[derive(Debug)]
pub struct PluginRegistry {
    /// Plugin metadata indexed by plugin ID
    plugins: HashMap<PluginId, PluginMetadata>,
    /// Plugin manifests for loaded plugins
    manifests: HashMap<PluginId, PluginManifest>,
    /// Activation order for dependency tracking
    activation_order: Vec<PluginId>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
            manifests: HashMap::new(),
            activation_order: Vec::new(),
        }
    }

    pub fn register(&mut self, metadata: PluginMetadata, manifest: PluginManifest) -> PluginResult<()> {
        let plugin_id = metadata.id.clone();
        self.plugins.insert(plugin_id.clone(), metadata);
        self.manifests.insert(plugin_id, manifest);
        Ok(())
    }

    pub fn get_metadata(&self, plugin_id: &str) -> Option<&PluginMetadata> {
        self.plugins.get(plugin_id)
    }

    pub fn get_manifest(&self, plugin_id: &str) -> Option<&PluginManifest> {
        self.manifests.get(plugin_id)
    }

    pub fn update_state(&mut self, plugin_id: &str, new_state: PluginState) -> PluginResult<()> {
        let metadata = self.plugins.get_mut(plugin_id)
            .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;

        if !metadata.state.can_transition_to(&new_state) {
            return Err(PluginError::InvalidStateTransition {
                from: metadata.state,
                to: new_state,
            });
        }

        metadata.state = new_state;
        metadata.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn remove(&mut self, plugin_id: &str) -> PluginResult<(PluginMetadata, PluginManifest)> {
        let metadata = self.plugins.remove(plugin_id)
            .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;
        let manifest = self.manifests.remove(plugin_id)
            .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;

        self.activation_order.retain(|id| id != plugin_id);
        Ok((metadata, manifest))
    }

    pub fn list_plugins(&self) -> Vec<&PluginMetadata> {
        self.plugins.values().collect()
    }

    pub fn add_to_activation_order(&mut self, plugin_id: PluginId) {
        if !self.activation_order.contains(&plugin_id) {
            self.activation_order.push(plugin_id);
        }
    }
}

/// Plugin Manager - Central controller for plugin lifecycle
pub struct PluginManager {
    registry: Arc<RwLock<PluginRegistry>>,
    permission_manager: Arc<RwLock<PermissionManager>>,
    lifecycle_manager: Arc<LifecycleManager>,
    manifest_parser: ManifestParser,
    plugins_dir: PathBuf,
}

impl PluginManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self::with_auto_approve(app_data_dir, true)
    }

    /// Create PluginManager with configurable auto-approve setting
    /// Used by tests to disable automatic permission approval
    pub fn with_auto_approve(app_data_dir: PathBuf, auto_approve: bool) -> Self {
        let plugins_dir = app_data_dir.join("plugins");

        Self {
            registry: Arc::new(RwLock::new(PluginRegistry::new())),
            permission_manager: Arc::new(RwLock::new(
                PermissionManager::with_auto_approve(app_data_dir.clone(), auto_approve)
            )),
            lifecycle_manager: Arc::new(LifecycleManager::new()),
            manifest_parser: ManifestParser::new(),
            plugins_dir,
        }
    }

    /// PLUGIN-003: Load plugin from ZIP package
    /// Extracts ZIP to AppData/plugins/{plugin_id}/ and registers metadata
    pub fn load_plugin_from_zip(&self, zip_path: &Path) -> PluginResult<PluginId> {
        // Extract ZIP to temporary location
        let temp_dir = std::env::temp_dir().join(format!("vcp_plugin_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        // Extract ZIP
        let file = std::fs::File::open(zip_path)?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| PluginError::ZipError(e.to_string()))?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| PluginError::ZipError(e.to_string()))?;
            let outpath = temp_dir.join(file.name());

            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p)?;
                }
                let mut outfile = std::fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        // PLUGIN-004: Parse and validate manifest
        let manifest = self.parse_and_validate_manifest(&temp_dir)?;
        let plugin_id = manifest.name.clone();

        // Move to final location
        let install_path = self.plugins_dir.join(&plugin_id);
        if install_path.exists() {
            std::fs::remove_dir_all(&install_path)?;
        }
        std::fs::create_dir_all(self.plugins_dir.as_path())?;
        std::fs::rename(&temp_dir, &install_path)?;

        // Create metadata
        let metadata = PluginMetadata {
            id: plugin_id.clone(),
            name: manifest.name.clone(),
            display_name: manifest.display_name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            author: manifest.author.clone(),
            plugin_type: manifest.plugin_type.clone(),
            install_path: install_path.clone(),
            state: PluginState::Installed,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        // Register plugin
        let mut registry = self.registry.write().unwrap();
        registry.register(metadata, manifest)?;

        Ok(plugin_id)
    }

    /// PLUGIN-004: Parse and validate manifest
    fn parse_and_validate_manifest(&self, plugin_dir: &Path) -> PluginResult<PluginManifest> {
        let manifest_path = plugin_dir.join("manifest.json");
        self.manifest_parser.parse_and_validate(&manifest_path)
    }

    /// PLUGIN-005: Activate plugin
    /// Checks permissions, runs activate() hook, updates state to Running
    pub fn activate_plugin(&self, plugin_id: &str) -> PluginResult<()> {
        // Get manifest
        let manifest = {
            let registry = self.registry.read().unwrap();
            registry.get_manifest(plugin_id)
                .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?
                .clone()
        };

        // Request permissions BEFORE state changes
        // This ensures we fail early if permissions are denied
        {
            let mut perm_mgr = self.permission_manager.write().unwrap();
            for permission in &manifest.permissions {
                // Check if permission already granted (e.g., via explicit grant_permission() call)
                if !perm_mgr.has_permission(plugin_id, permission) {
                    // Not granted yet, request it (will check auto_approve)
                    perm_mgr.request_permission(plugin_id, permission)?;
                }
            }
        }

        // Check current state to determine transition path
        let current_state = {
            let registry = self.registry.read().unwrap();
            registry.get_metadata(plugin_id)
                .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?
                .state
        };

        // State transition logic:
        // - Installed → Loaded → Activated → Running (normal activation)
        // - Deactivated → Activated → Running (reactivation)
        if current_state != PluginState::Deactivated {
            // Normal activation path: go through Loaded state
            let mut registry = self.registry.write().unwrap();
            registry.update_state(plugin_id, PluginState::Loaded)?;
        }

        // Update state to Activated (works from both Loaded and Deactivated)
        {
            let mut registry = self.registry.write().unwrap();
            registry.update_state(plugin_id, PluginState::Activated)?;
        }

        // Execute activate hook
        let install_path = {
            let registry = self.registry.read().unwrap();
            registry.get_metadata(plugin_id)
                .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?
                .install_path.clone()
        };

        self.lifecycle_manager.execute_activate_hook(plugin_id, &install_path, &manifest)?;

        // Update state to Running
        {
            let mut registry = self.registry.write().unwrap();
            registry.update_state(plugin_id, PluginState::Running)?;
            registry.add_to_activation_order(plugin_id.to_string());
        }

        Ok(())
    }

    /// PLUGIN-006: Deactivate plugin
    /// Runs deactivate() hook, cleans up resources, updates state
    pub fn deactivate_plugin(&self, plugin_id: &str) -> PluginResult<()> {
        // Get manifest
        let manifest = {
            let registry = self.registry.read().unwrap();
            registry.get_manifest(plugin_id)
                .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?
                .clone()
        };

        // Update state to Deactivated
        {
            let mut registry = self.registry.write().unwrap();
            registry.update_state(plugin_id, PluginState::Deactivated)?;
        }

        // Execute deactivate hook
        let install_path = {
            let registry = self.registry.read().unwrap();
            registry.get_metadata(plugin_id)
                .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?
                .install_path.clone()
        };

        self.lifecycle_manager.execute_deactivate_hook(plugin_id, &install_path, &manifest)?;

        Ok(())
    }

    /// PLUGIN-007: Dependency resolution with topological sort
    pub fn resolve_dependencies(&self, plugin_id: &str) -> PluginResult<Vec<PluginId>> {
        let registry = self.registry.read().unwrap();
        let manifest = registry.get_manifest(plugin_id)
            .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;

        let mut order = Vec::new();
        let mut visited = HashSet::new();
        let mut temp_mark = HashSet::new();

        self.visit_dependency(
            plugin_id,
            &registry,
            &mut order,
            &mut visited,
            &mut temp_mark,
        )?;

        Ok(order)
    }

    fn visit_dependency(
        &self,
        plugin_id: &str,
        registry: &PluginRegistry,
        order: &mut Vec<PluginId>,
        visited: &mut HashSet<PluginId>,
        temp_mark: &mut HashSet<PluginId>,
    ) -> PluginResult<()> {
        if visited.contains(plugin_id) {
            return Ok(());
        }

        if temp_mark.contains(plugin_id) {
            return Err(PluginError::DependencyError(
                format!("Circular dependency detected involving plugin: {}", plugin_id)
            ));
        }

        temp_mark.insert(plugin_id.to_string());

        let manifest = registry.get_manifest(plugin_id)
            .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;

        for (dep_id, _version) in &manifest.dependencies {
            self.visit_dependency(dep_id, registry, order, visited, temp_mark)?;
        }

        temp_mark.remove(plugin_id);
        visited.insert(plugin_id.to_string());
        order.push(plugin_id.to_string());

        Ok(())
    }

    /// PLUGIN-008: Uninstall plugin
    /// Deactivates, removes files, clears permissions
    pub fn uninstall_plugin(&self, plugin_id: &str) -> PluginResult<()> {
        // Deactivate if running
        {
            let registry = self.registry.read().unwrap();
            let metadata = registry.get_metadata(plugin_id)
                .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;

            if metadata.state == PluginState::Running {
                drop(registry);
                self.deactivate_plugin(plugin_id)?;
            }
        }

        // Remove from registry
        let (metadata, _manifest) = {
            let mut registry = self.registry.write().unwrap();
            registry.remove(plugin_id)?
        };

        // Remove plugin files
        if metadata.install_path.exists() {
            std::fs::remove_dir_all(&metadata.install_path)?;
        }

        // Clear permissions
        {
            let mut perm_mgr = self.permission_manager.write().unwrap();
            perm_mgr.revoke_all_permissions(plugin_id)?;
        }

        Ok(())
    }

    /// PLUGIN-009: Error handling with rollback
    pub fn activate_plugin_with_rollback(&self, plugin_id: &str) -> PluginResult<()> {
        match self.activate_plugin(plugin_id) {
            Ok(_) => Ok(()),
            Err(e) => {
                // Rollback: attempt to deactivate
                let _ = self.deactivate_plugin(plugin_id);

                // Reset state to Installed
                let mut registry = self.registry.write().unwrap();
                if let Some(metadata) = registry.plugins.get_mut(plugin_id) {
                    metadata.state = PluginState::Installed;
                }

                Err(e)
            }
        }
    }

    /// Get list of all plugins
    pub fn list_plugins(&self) -> Vec<PluginMetadata> {
        let registry = self.registry.read().unwrap();
        registry.list_plugins().into_iter().cloned().collect()
    }

    /// PLUGIN-079: Get plugin state
    pub fn get_plugin_state(&self, plugin_id: &str) -> Option<PluginState> {
        let registry = self.registry.read().unwrap();
        registry.get_metadata(plugin_id).map(|m| m.state)
    }

    /// PLUGIN-079: Grant permission to plugin
    pub fn grant_permission(&self, plugin_id: &str, permission: &str) -> PluginResult<()> {
        let mut pm = self.permission_manager.write().unwrap();

        // Parse permission string (e.g., "filesystem.read:AppData/test/*")
        let parts: Vec<&str> = permission.split(':').collect();
        if parts.is_empty() {
            return Err(PluginError::PermissionDenied(
                format!("Invalid permission format: {}", permission)
            ));
        }

        let perm_type = parts[0];
        let resource_scope = if parts.len() > 1 {
            parts[1].to_string()
        } else {
            "*".to_string()
        };

        // Convert permission string to PermissionType
        let permission_type = match perm_type {
            "filesystem.read" => super::permission_manager::PermissionType::FilesystemRead,
            "filesystem.write" => super::permission_manager::PermissionType::FilesystemWrite,
            "network.request" => super::permission_manager::PermissionType::NetworkRequest,
            "storage.read" => super::permission_manager::PermissionType::StorageRead,
            "storage.write" => super::permission_manager::PermissionType::StorageWrite,
            "system.notify" => super::permission_manager::PermissionType::SystemNotify,
            "ui.registerCommand" => super::permission_manager::PermissionType::UiRegisterCommand,
            "ui.registerView" => super::permission_manager::PermissionType::UiRegisterView,
            _ => return Err(PluginError::PermissionDenied(
                format!("Unknown permission type: {}", perm_type)
            )),
        };

        pm.grant_permission(plugin_id, permission_type, resource_scope)
    }

    /// PLUGIN-079: Resolve plugin dependencies (topological sort)
    /// Returns plugins in activation order (dependencies first)
    pub fn resolve_plugin_dependencies(&self, plugin_ids: &[String]) -> PluginResult<Vec<PluginId>> {
        let registry = self.registry.read().unwrap();

        let mut sorted = Vec::new();
        let mut visiting = HashSet::new();
        let mut visited = HashSet::new();

        fn visit(
            plugin_id: &str,
            registry: &PluginRegistry,
            visiting: &mut HashSet<String>,
            visited: &mut HashSet<String>,
            sorted: &mut Vec<String>,
        ) -> PluginResult<()> {
            if visited.contains(plugin_id) {
                return Ok(());
            }

            if visiting.contains(plugin_id) {
                return Err(PluginError::DependencyResolution(
                    format!("Circular dependency detected: {}", plugin_id)
                ));
            }

            visiting.insert(plugin_id.to_string());

            // Get manifest to check dependencies
            if let Some(manifest) = registry.get_manifest(plugin_id) {
                for (dep_id, _version) in &manifest.dependencies {
                    visit(dep_id, registry, visiting, visited, sorted)?;
                }
            }

            visiting.remove(plugin_id);
            visited.insert(plugin_id.to_string());
            sorted.push(plugin_id.to_string());

            Ok(())
        }

        for plugin_id in plugin_ids {
            visit(plugin_id, &registry, &mut visiting, &mut visited, &mut sorted)?;
        }

        Ok(sorted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_registry() {
        let mut registry = PluginRegistry::new();

        let metadata = PluginMetadata {
            id: "test-plugin".to_string(),
            name: "Test Plugin".to_string(),
            display_name: "Test Plugin".to_string(),
            version: "1.0.0".to_string(),
            description: "A test plugin".to_string(),
            author: "Test Author".to_string(),
            plugin_type: "synchronous".to_string(),
            install_path: PathBuf::from("/tmp/test"),
            state: PluginState::Installed,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        let manifest = PluginManifest::default();

        assert!(registry.register(metadata.clone(), manifest).is_ok());
        assert!(registry.get_metadata("test-plugin").is_some());
    }

    #[test]
    fn test_state_transition_validation() {
        let mut registry = PluginRegistry::new();

        let metadata = PluginMetadata {
            id: "test-plugin".to_string(),
            name: "Test Plugin".to_string(),
            display_name: "Test Plugin".to_string(),
            version: "1.0.0".to_string(),
            description: "A test plugin".to_string(),
            author: "Test Author".to_string(),
            plugin_type: "synchronous".to_string(),
            install_path: PathBuf::from("/tmp/test"),
            state: PluginState::Installed,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        };

        let manifest = PluginManifest::default();
        registry.register(metadata, manifest).unwrap();

        // Valid transitions
        assert!(registry.update_state("test-plugin", PluginState::Loaded).is_ok());
        assert!(registry.update_state("test-plugin", PluginState::Activated).is_ok());
        assert!(registry.update_state("test-plugin", PluginState::Running).is_ok());

        // Invalid transition (Running → Installed)
        assert!(registry.update_state("test-plugin", PluginState::Installed).is_err());
    }
}
