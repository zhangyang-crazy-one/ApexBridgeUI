// PLUGIN-028 to PLUGIN-031: Lifecycle Manager implementation
// Execute plugin lifecycle hooks and track resources for cleanup
// Manages activate() and deactivate() hook execution with resource tracking

use super::{PluginError, PluginId, PluginResult, manifest_parser::PluginManifest};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{Arc, RwLock};

/// PLUGIN-028: Plugin lifecycle trait
/// Defines the contract for plugin lifecycle hooks
pub trait PluginLifecycle {
    /// Called when plugin is activated
    /// Plugin should register commands, views, and other contributions here
    fn activate(&mut self, context: &PluginContext) -> PluginResult<()>;

    /// Called when plugin is deactivated
    /// Plugin should cleanup resources and unregister contributions here
    fn deactivate(&mut self) -> PluginResult<()>;
}

/// Plugin context provided during activation
/// Contains APIs and resources available to the plugin
pub struct PluginContext {
    pub plugin_id: PluginId,
    pub install_path: std::path::PathBuf,
    pub manifest: PluginManifest,
    // Future: Add API references (filesystem, network, storage, events)
}

impl PluginContext {
    pub fn new(plugin_id: PluginId, install_path: std::path::PathBuf, manifest: PluginManifest) -> Self {
        Self {
            plugin_id,
            install_path,
            manifest,
        }
    }
}

/// PLUGIN-031: Resource types that need tracking
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ResourceType {
    /// File handle or watcher
    FileHandle(String),
    /// Event listener subscription
    EventListener { event_name: String, listener_id: String },
    /// Timer or interval
    Timer(u64),
    /// HTTP request in progress
    HttpRequest(String),
    /// Command registration
    Command(String),
    /// View registration
    View(String),
}

/// PLUGIN-031: Resource tracker for cleanup
/// Tracks all resources allocated by a plugin for proper cleanup
#[derive(Debug, Clone)]
pub struct ResourceTracker {
    /// Resources grouped by plugin ID
    resources: Arc<RwLock<HashMap<PluginId, HashSet<ResourceType>>>>,
}

impl ResourceTracker {
    pub fn new() -> Self {
        Self {
            resources: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Track a resource for a plugin
    pub fn track(&self, plugin_id: &str, resource: ResourceType) {
        let mut resources = self.resources.write().unwrap();
        resources
            .entry(plugin_id.to_string())
            .or_insert_with(HashSet::new)
            .insert(resource);
    }

    /// Untrack a specific resource
    pub fn untrack(&self, plugin_id: &str, resource: &ResourceType) -> bool {
        let mut resources = self.resources.write().unwrap();
        if let Some(plugin_resources) = resources.get_mut(plugin_id) {
            plugin_resources.remove(resource)
        } else {
            false
        }
    }

    /// Get all resources for a plugin
    pub fn get_resources(&self, plugin_id: &str) -> Vec<ResourceType> {
        let resources = self.resources.read().unwrap();
        resources
            .get(plugin_id)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Clear all resources for a plugin
    pub fn clear_plugin_resources(&self, plugin_id: &str) -> Vec<ResourceType> {
        let mut resources = self.resources.write().unwrap();
        resources.remove(plugin_id).map(|set| set.into_iter().collect()).unwrap_or_default()
    }

    /// Get resource count for a plugin
    pub fn resource_count(&self, plugin_id: &str) -> usize {
        let resources = self.resources.read().unwrap();
        resources.get(plugin_id).map(|set| set.len()).unwrap_or(0)
    }
}

impl Default for ResourceTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Lifecycle Manager
/// Coordinates plugin activation/deactivation and resource management
pub struct LifecycleManager {
    resource_tracker: ResourceTracker,
}

impl LifecycleManager {
    pub fn new() -> Self {
        Self {
            resource_tracker: ResourceTracker::new(),
        }
    }

    /// PLUGIN-029: Execute plugin's activate hook
    /// Invokes the plugin's activate() function with PluginContext
    pub fn execute_activate_hook(
        &self,
        plugin_id: &str,
        install_path: &Path,
        manifest: &PluginManifest,
    ) -> PluginResult<()> {
        println!("[LifecycleManager] Activating plugin: {}", plugin_id);

        // Create plugin context
        let context = PluginContext::new(
            plugin_id.to_string(),
            install_path.to_path_buf(),
            manifest.clone(),
        );

        // TODO: In a real implementation, this would:
        // 1. Load the plugin's JavaScript/TypeScript code
        // 2. Execute the activate() function in a sandboxed environment
        // 3. Pass the PluginContext with API bindings
        //
        // For now, we simulate activation by tracking contribution registrations

        // Track command registrations
        for command in &manifest.contributes.commands {
            self.resource_tracker.track(
                plugin_id,
                ResourceType::Command(command.identifier.clone()),
            );
            println!("[LifecycleManager] Registered command: {}", command.identifier);
        }

        // Track view registrations
        for view in &manifest.contributes.views {
            self.resource_tracker.track(
                plugin_id,
                ResourceType::View(view.identifier.clone()),
            );
            println!("[LifecycleManager] Registered view: {}", view.identifier);
        }

        println!("[LifecycleManager] Plugin {} activated successfully", plugin_id);
        Ok(())
    }

    /// PLUGIN-030: Execute plugin's deactivate hook
    /// Invokes the plugin's deactivate() function and cleans up resources
    pub fn execute_deactivate_hook(
        &self,
        plugin_id: &str,
        _install_path: &Path,
        _manifest: &PluginManifest,
    ) -> PluginResult<()> {
        println!("[LifecycleManager] Deactivating plugin: {}", plugin_id);

        // TODO: In a real implementation, this would:
        // 1. Call the plugin's deactivate() function
        // 2. Allow plugin to perform cleanup
        // 3. Forcefully cleanup any remaining resources

        // Get all tracked resources before cleanup
        let resources = self.resource_tracker.get_resources(plugin_id);
        println!("[LifecycleManager] Cleaning up {} resources for plugin {}", resources.len(), plugin_id);

        // Cleanup each resource type
        for resource in &resources {
            match resource {
                ResourceType::FileHandle(path) => {
                    println!("[LifecycleManager] Closing file handle: {}", path);
                    // TODO: Close actual file handles
                }
                ResourceType::EventListener { event_name, listener_id } => {
                    println!("[LifecycleManager] Unregistering event listener: {} ({})", event_name, listener_id);
                    // TODO: Remove from event bus
                }
                ResourceType::Timer(timer_id) => {
                    println!("[LifecycleManager] Clearing timer: {}", timer_id);
                    // TODO: Cancel timer
                }
                ResourceType::HttpRequest(request_id) => {
                    println!("[LifecycleManager] Aborting HTTP request: {}", request_id);
                    // TODO: Abort ongoing request
                }
                ResourceType::Command(command_id) => {
                    println!("[LifecycleManager] Unregistering command: {}", command_id);
                    // TODO: Remove from command registry
                }
                ResourceType::View(view_id) => {
                    println!("[LifecycleManager] Unregistering view: {}", view_id);
                    // TODO: Remove from view registry
                }
            }
        }

        // Clear all tracked resources
        self.resource_tracker.clear_plugin_resources(plugin_id);

        println!("[LifecycleManager] Plugin {} deactivated successfully", plugin_id);
        Ok(())
    }

    /// Get resource tracker (for testing and monitoring)
    pub fn resource_tracker(&self) -> &ResourceTracker {
        &self.resource_tracker
    }

    /// Track a resource manually (for use by plugin APIs)
    pub fn track_resource(&self, plugin_id: &str, resource: ResourceType) {
        self.resource_tracker.track(plugin_id, resource);
    }

    /// Untrack a resource manually
    pub fn untrack_resource(&self, plugin_id: &str, resource: &ResourceType) -> bool {
        self.resource_tracker.untrack(plugin_id, resource)
    }

    /// Get resource count for debugging
    pub fn get_resource_count(&self, plugin_id: &str) -> usize {
        self.resource_tracker.resource_count(plugin_id)
    }
}

impl Default for LifecycleManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_tracker() {
        let tracker = ResourceTracker::new();
        let plugin_id = "test-plugin";

        // Track resources
        tracker.track(plugin_id, ResourceType::Command("test.run".to_string()));
        tracker.track(plugin_id, ResourceType::Timer(123));

        assert_eq!(tracker.resource_count(plugin_id), 2);

        // Untrack one resource
        let removed = tracker.untrack(plugin_id, &ResourceType::Timer(123));
        assert!(removed);
        assert_eq!(tracker.resource_count(plugin_id), 1);

        // Clear all
        let resources = tracker.clear_plugin_resources(plugin_id);
        assert_eq!(resources.len(), 1);
        assert_eq!(tracker.resource_count(plugin_id), 0);
    }

    #[test]
    fn test_resource_tracker_multiple_plugins() {
        let tracker = ResourceTracker::new();

        tracker.track("plugin1", ResourceType::Command("cmd1".to_string()));
        tracker.track("plugin1", ResourceType::View("view1".to_string()));
        tracker.track("plugin2", ResourceType::Timer(456));

        assert_eq!(tracker.resource_count("plugin1"), 2);
        assert_eq!(tracker.resource_count("plugin2"), 1);

        tracker.clear_plugin_resources("plugin1");
        assert_eq!(tracker.resource_count("plugin1"), 0);
        assert_eq!(tracker.resource_count("plugin2"), 1); // plugin2 unaffected
    }
}
