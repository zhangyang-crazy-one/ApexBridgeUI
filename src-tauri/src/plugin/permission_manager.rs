// PLUGIN-011 to PLUGIN-020: Permission Manager implementation
// Fine-grained permission validation and user authorization
// Implements FR-003 through FR-015 from spec.md

use super::{PluginError, PluginId, PluginResult};
use super::audit_logger::AuditLogger;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use chrono::Utc;

/// PLUGIN-011: PermissionType enum with all supported permissions
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionType {
    #[serde(rename = "filesystem.read")]
    FilesystemRead,
    #[serde(rename = "filesystem.write")]
    FilesystemWrite,
    #[serde(rename = "network.request")]
    NetworkRequest,
    #[serde(rename = "storage.read")]
    StorageRead,
    #[serde(rename = "storage.write")]
    StorageWrite,
    #[serde(rename = "system.notify")]
    SystemNotify,
    #[serde(rename = "ui.registerCommand")]
    UiRegisterCommand,
    #[serde(rename = "ui.registerView")]
    UiRegisterView,
}

impl PermissionType {
    /// Parse permission type from string (e.g., "filesystem.read")
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "filesystem.read" => Some(Self::FilesystemRead),
            "filesystem.write" => Some(Self::FilesystemWrite),
            "network.request" => Some(Self::NetworkRequest),
            "storage.read" => Some(Self::StorageRead),
            "storage.write" => Some(Self::StorageWrite),
            "system.notify" => Some(Self::SystemNotify),
            "ui.registerCommand" => Some(Self::UiRegisterCommand),
            "ui.registerView" => Some(Self::UiRegisterView),
            _ => None,
        }
    }

    /// Get permission type as string
    pub fn as_str(&self) -> &str {
        match self {
            Self::FilesystemRead => "filesystem.read",
            Self::FilesystemWrite => "filesystem.write",
            Self::NetworkRequest => "network.request",
            Self::StorageRead => "storage.read",
            Self::StorageWrite => "storage.write",
            Self::SystemNotify => "system.notify",
            Self::UiRegisterCommand => "ui.registerCommand",
            Self::UiRegisterView => "ui.registerView",
        }
    }
}

impl std::fmt::Display for PermissionType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// PLUGIN-012: PluginPermission struct with resource_scope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginPermission {
    pub plugin_id: PluginId,
    pub permission_type: PermissionType,
    /// Resource scope - path patterns (e.g., "AppData/plugin-data/*"), domain whitelist (e.g., "*.example.com"), or "*"
    pub resource_scope: String,
    pub granted: bool,
    pub granted_at: Option<String>,
    /// Additional metadata
    pub granted_by: Option<String>, // "user" or "auto"
    pub expires_at: Option<String>,
}

impl PluginPermission {
    /// Validate resource scope pattern
    pub fn validate_scope(&self) -> PluginResult<()> {
        if self.resource_scope.is_empty() {
            return Err(PluginError::PermissionDenied(
                "Resource scope cannot be empty".to_string()
            ));
        }

        match self.permission_type {
            PermissionType::FilesystemRead | PermissionType::FilesystemWrite => {
                // Validate path pattern
                if !self.resource_scope.starts_with("AppData/") && self.resource_scope != "*" {
                    return Err(PluginError::PermissionDenied(
                        format!("File system access must be within AppData/. Got: {}", self.resource_scope)
                    ));
                }
            }
            PermissionType::NetworkRequest => {
                // Validate domain pattern (allow wildcards like *.example.com)
                if self.resource_scope != "*" && !is_valid_domain_pattern(&self.resource_scope) {
                    return Err(PluginError::PermissionDenied(
                        format!("Invalid domain pattern: {}", self.resource_scope)
                    ));
                }
            }
            _ => {}
        }

        Ok(())
    }
}

/// Helper function to validate domain patterns
fn is_valid_domain_pattern(pattern: &str) -> bool {
    // Allow wildcards like *.example.com, or specific domains
    if pattern.starts_with("*.") {
        let domain = &pattern[2..];
        domain.contains('.') && !domain.contains('*')
    } else {
        // Valid domain format check (simplified)
        pattern.contains('.') && !pattern.contains(' ')
    }
}

/// PLUGIN-013: PermissionStorage with JSON persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PermissionStorage {
    permissions: HashMap<PluginId, Vec<PluginPermission>>,
    version: String,
    updated_at: String,
}

impl PermissionStorage {
    fn new() -> Self {
        Self {
            permissions: HashMap::new(),
            version: "1.0.0".to_string(),
            updated_at: Utc::now().to_rfc3339(),
        }
    }

    fn load(path: &Path) -> PluginResult<Self> {
        if !path.exists() {
            return Ok(Self::new());
        }

        let content = std::fs::read_to_string(path)?;
        let storage: PermissionStorage = serde_json::from_str(&content)
            .map_err(|e| PluginError::ManifestError(format!("Failed to parse permissions: {}", e)))?;

        Ok(storage)
    }

    fn save(&self, path: &Path) -> PluginResult<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| PluginError::ManifestError(format!("Failed to serialize permissions: {}", e)))?;

        std::fs::write(path, content)?;
        Ok(())
    }
}

/// PLUGIN-016: Rate limiter using token bucket algorithm
#[derive(Debug)]
struct RateLimiter {
    /// Maximum requests per time window
    capacity: u32,
    /// Current available tokens
    tokens: Arc<RwLock<u32>>,
    /// Token refill rate (requests per minute)
    refill_rate: u32,
    /// Last refill timestamp
    last_refill: Arc<RwLock<Instant>>,
}

impl RateLimiter {
    fn new(requests_per_minute: u32) -> Self {
        Self {
            capacity: requests_per_minute,
            tokens: Arc::new(RwLock::new(requests_per_minute)),
            refill_rate: requests_per_minute,
            last_refill: Arc::new(RwLock::new(Instant::now())),
        }
    }

    /// Try to consume a token. Returns true if allowed, false if rate limited.
    fn try_acquire(&self) -> bool {
        self.refill_tokens();

        let mut tokens = self.tokens.write().unwrap();
        if *tokens > 0 {
            *tokens -= 1;
            true
        } else {
            false
        }
    }

    /// Refill tokens based on elapsed time
    fn refill_tokens(&self) {
        let now = Instant::now();
        let mut last_refill = self.last_refill.write().unwrap();
        let elapsed = now.duration_since(*last_refill);

        // Refill tokens based on elapsed time (linear refill)
        let tokens_to_add = (elapsed.as_secs_f64() / 60.0 * self.refill_rate as f64) as u32;

        if tokens_to_add > 0 {
            let mut tokens = self.tokens.write().unwrap();
            *tokens = (*tokens + tokens_to_add).min(self.capacity);
            *last_refill = now;
        }
    }
}

/// Permission Manager - Central controller for permission validation
pub struct PermissionManager {
    permissions: HashMap<PluginId, Vec<PluginPermission>>,
    storage_path: PathBuf,
    app_data_dir: PathBuf,
    /// Rate limiters per plugin (for network requests)
    rate_limiters: HashMap<PluginId, RateLimiter>,
    /// Default rate limit: 100 req/min
    default_rate_limit: u32,
    audit_logger: Arc<RwLock<AuditLogger>>,
    /// Auto-approve permissions (for development/testing)
    /// When false, request_user_authorization will return false (deny all)
    auto_approve: bool,
}

impl PermissionManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self::with_auto_approve(app_data_dir, true)
    }

    /// Create PermissionManager with configurable auto-approve setting
    /// Used by tests to disable auto-approval
    pub fn with_auto_approve(app_data_dir: PathBuf, auto_approve: bool) -> Self {
        let storage_path = app_data_dir.join("plugin-permissions.json");
        let audit_logger = Arc::new(RwLock::new(AuditLogger::new(app_data_dir.clone())));

        // Load existing permissions
        let permissions = match PermissionStorage::load(&storage_path) {
            Ok(storage) => storage.permissions,
            Err(_) => HashMap::new(),
        };

        Self {
            permissions,
            storage_path,
            app_data_dir,
            rate_limiters: HashMap::new(),
            default_rate_limit: 100,
            audit_logger,
            auto_approve,
        }
    }

    /// PLUGIN-017: Request user authorization for permission
    /// In production, this should show a Tauri dialog
    pub fn request_user_authorization(
        &self,
        plugin_id: &str,
        permission: &PluginPermission,
    ) -> PluginResult<bool> {
        // Check if auto-approve is enabled
        if !self.auto_approve {
            println!(
                "[PermissionManager] Denying permission for {} (auto-approve disabled): {} (scope: {})",
                plugin_id, permission.permission_type, permission.resource_scope
            );
            return Ok(false);
        }

        // TODO: Implement Tauri dialog for user authorization
        // For now, auto-approve for development
        println!(
            "[PermissionManager] Auto-approving permission for {}: {} (scope: {})",
            plugin_id, permission.permission_type, permission.resource_scope
        );

        // PLUGIN-019: Log permission check
        let mut logger = self.audit_logger.write().unwrap();
        logger.log_permission_check(
            plugin_id,
            &permission.permission_type,
            &permission.resource_scope,
            "request",
            true,
            None,
        );

        Ok(true)
    }

    /// PLUGIN-018: Grant permission to plugin
    pub fn grant_permission(
        &mut self,
        plugin_id: &str,
        permission_type: PermissionType,
        resource_scope: String,
    ) -> PluginResult<()> {
        let permission = PluginPermission {
            plugin_id: plugin_id.to_string(),
            permission_type: permission_type.clone(),
            resource_scope: resource_scope.clone(),
            granted: true,
            granted_at: Some(Utc::now().to_rfc3339()),
            granted_by: Some("user".to_string()),
            expires_at: None,
        };

        // Validate scope
        permission.validate_scope()?;

        // Add to permissions
        self.permissions
            .entry(plugin_id.to_string())
            .or_insert_with(Vec::new)
            .push(permission);

        // Persist to disk
        self.save_permissions()?;

        // PLUGIN-019: Log permission grant
        let mut logger = self.audit_logger.write().unwrap();
        logger.log_permission_check(
            plugin_id,
            &permission_type,
            &resource_scope,
            "grant",
            true,
            None,
        );

        Ok(())
    }

    /// PLUGIN-018: Revoke specific permission
    pub fn revoke_permission(
        &mut self,
        plugin_id: &str,
        permission_type: &PermissionType,
    ) -> PluginResult<()> {
        if let Some(permissions) = self.permissions.get_mut(plugin_id) {
            permissions.retain(|p| &p.permission_type != permission_type);

            // PLUGIN-019: Log permission revocation
            let mut logger = self.audit_logger.write().unwrap();
            logger.log_permission_check(
                plugin_id,
                permission_type,
                "*",
                "revoke",
                true,
                None,
            );
        }

        self.save_permissions()?;
        Ok(())
    }

    /// Check if a permission has already been granted
    pub fn has_permission(&self, plugin_id: &str, permission_str: &str) -> bool {
        let parts: Vec<&str> = permission_str.splitn(2, ':').collect();
        let permission_type_str = parts[0];
        let resource_scope = parts.get(1).unwrap_or(&"*");

        if let Some(permission_type) = PermissionType::from_str(permission_type_str) {
            if let Some(permissions) = self.permissions.get(plugin_id) {
                return permissions.iter().any(|p| {
                    p.permission_type == permission_type
                    && p.granted
                    && (p.resource_scope == "*" || self.matches_scope(resource_scope, &p.resource_scope))
                });
            }
        }
        false
    }

    /// Parse permission string from manifest (e.g., "filesystem.read:/path/pattern")
    pub fn request_permission(&mut self, plugin_id: &str, permission_str: &str) -> PluginResult<()> {
        let parts: Vec<&str> = permission_str.splitn(2, ':').collect();
        let permission_type_str = parts[0];
        let resource_scope = parts.get(1).unwrap_or(&"*").to_string();

        let permission_type = PermissionType::from_str(permission_type_str)
            .ok_or_else(|| PluginError::PermissionDenied(
                format!("Unknown permission type: {}", permission_type_str)
            ))?;

        let permission = PluginPermission {
            plugin_id: plugin_id.to_string(),
            permission_type: permission_type.clone(),
            resource_scope: resource_scope.clone(),
            granted: false,
            granted_at: None,
            granted_by: None,
            expires_at: None,
        };

        // Validate scope
        permission.validate_scope()?;

        // Request user authorization
        let approved = self.request_user_authorization(plugin_id, &permission)?;

        if approved {
            self.grant_permission(plugin_id, permission_type, resource_scope)?;
            Ok(())
        } else {
            Err(PluginError::PermissionDenied(
                format!("Permission '{}' denied for plugin '{}'", permission_str, plugin_id)
            ))
        }
    }

    /// PLUGIN-014: Validate file system permission
    pub fn validate_filesystem_permission(
        &self,
        plugin_id: &str,
        path: &Path,
        write: bool,
    ) -> bool {
        let permission_type = if write {
            PermissionType::FilesystemWrite
        } else {
            PermissionType::FilesystemRead
        };

        // Get plugin permissions
        let Some(permissions) = self.permissions.get(plugin_id) else {
            self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("No permissions found"));
            return false;
        };

        // Canonicalize paths
        let app_data_canonical = match self.app_data_dir.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("AppData path error"));
                return false;
            }
        };

        // Try to get canonical path, or construct relative path manually
        let (canonical_path, relative_path_str) = match path.canonicalize() {
            Ok(canonical) => {
                // Path exists - use canonical path
                if !canonical.starts_with(&app_data_canonical) {
                    self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("Path outside AppData"));
                    return false;
                }
                let relative = canonical.strip_prefix(&app_data_canonical)
                    .unwrap()
                    .to_string_lossy()
                    .to_string();
                (canonical, relative)
            }
            Err(_) => {
                // Path doesn't exist yet - validate parent and construct relative path
                // This is common for write operations

                // Security check: reject paths with ".." to prevent traversal attacks
                if path.components().any(|c| c == std::path::Component::ParentDir) {
                    self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("Path traversal attempt (..)"));
                    return false;
                }

                // First, ensure path starts with app_data_dir (canonical)
                if !path.starts_with(&app_data_canonical) {
                    self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("Path outside AppData (non-canonical)"));
                    return false;
                }

                // Calculate relative path from app_data_dir
                let relative = match path.strip_prefix(&app_data_canonical) {
                    Ok(rel) => rel.to_string_lossy().to_string(),
                    Err(_) => {
                        self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("Invalid path"));
                        return false;
                    }
                };

                (path.to_path_buf(), relative)
            }
        };

        // Check if permission is granted
        for perm in permissions {
            if perm.permission_type == permission_type && perm.granted {
                // Check scope matching
                if perm.resource_scope == "*" {
                    self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), true, None);
                    return true;
                }

                // Check pattern matching using relative path
                let scope_to_match = if perm.resource_scope.starts_with("AppData/") {
                    // Strip "AppData/" prefix from scope for comparison
                    &perm.resource_scope["AppData/".len()..]
                } else {
                    &perm.resource_scope
                };

                if self.matches_scope(&relative_path_str, scope_to_match) {
                    self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), true, None);
                    return true;
                }
            }
        }

        self.log_validation(plugin_id, &permission_type, path.to_string_lossy().as_ref(), false, Some("No matching permission"));
        false
    }

    /// PLUGIN-015: Validate network permission with domain whitelist
    pub fn validate_network_permission(
        &self,
        plugin_id: &str,
        domain: &str,
    ) -> bool {
        let permission_type = PermissionType::NetworkRequest;

        // Get plugin permissions
        let Some(permissions) = self.permissions.get(plugin_id) else {
            self.log_validation(plugin_id, &permission_type, domain, false, Some("No permissions found"));
            return false;
        };

        // Check if permission is granted
        for perm in permissions {
            if perm.permission_type == permission_type && perm.granted {
                // Check wildcard
                if perm.resource_scope == "*" {
                    self.log_validation(plugin_id, &permission_type, domain, true, None);
                    return true;
                }

                // Check domain matching (support wildcard subdomains)
                if self.matches_domain(domain, &perm.resource_scope) {
                    self.log_validation(plugin_id, &permission_type, domain, true, None);
                    return true;
                }
            }
        }

        self.log_validation(plugin_id, &permission_type, domain, false, Some("No matching permission"));
        false
    }

    /// PLUGIN-016: Check rate limit for network requests
    pub fn check_rate_limit(&mut self, plugin_id: &str) -> bool {
        // Get or create rate limiter for plugin
        let limiter = self.rate_limiters
            .entry(plugin_id.to_string())
            .or_insert_with(|| RateLimiter::new(self.default_rate_limit));

        let allowed = limiter.try_acquire();

        if !allowed {
            self.log_validation(
                plugin_id,
                &PermissionType::NetworkRequest,
                "rate_limit",
                false,
                Some("Rate limit exceeded"),
            );
        }

        allowed
    }

    /// Revoke all permissions for plugin
    pub fn revoke_all_permissions(&mut self, plugin_id: &str) -> PluginResult<()> {
        self.permissions.remove(plugin_id);
        self.rate_limiters.remove(plugin_id);
        self.save_permissions()?;

        // PLUGIN-019: Log permission revocation
        let mut logger = self.audit_logger.write().unwrap();
        logger.log_permission_check(
            plugin_id,
            &PermissionType::FilesystemRead, // Placeholder
            "*",
            "revoke_all",
            true,
            None,
        );

        Ok(())
    }

    /// Save permissions to disk (PLUGIN-013)
    fn save_permissions(&self) -> PluginResult<()> {
        let storage = PermissionStorage {
            permissions: self.permissions.clone(),
            version: "1.0.0".to_string(),
            updated_at: Utc::now().to_rfc3339(),
        };

        storage.save(&self.storage_path)
    }

    /// Helper: Match path against scope pattern
    fn matches_scope(&self, path: &str, scope: &str) -> bool {
        // Normalize path separators to forward slashes for cross-platform matching
        let normalized_path = path.replace('\\', "/");

        // Simple wildcard matching (e.g., "plugin-data/*")
        if scope.ends_with("/*") {
            let prefix = &scope[..scope.len() - 2];
            normalized_path.starts_with(prefix)
        } else {
            normalized_path == scope
        }
    }

    /// Helper: Match domain against whitelist pattern
    fn matches_domain(&self, domain: &str, pattern: &str) -> bool {
        if pattern.starts_with("*.") {
            // Wildcard subdomain (e.g., *.example.com)
            let suffix = &pattern[2..];
            // Exact match of base domain, or subdomain with dot separator
            if domain == suffix {
                return true;
            }
            if domain.ends_with(suffix) {
                // Ensure there's a dot separator (not "notexample.com" matching "example.com")
                let prefix_len = domain.len() - suffix.len();
                return domain.chars().nth(prefix_len - 1) == Some('.');
            }
            false
        } else {
            // Exact domain match
            domain == pattern
        }
    }

    /// PLUGIN-019: Log validation result to audit logger
    fn log_validation(&self, plugin_id: &str, permission_type: &PermissionType, resource: &str, result: bool, error: Option<&str>) {
        let mut logger = self.audit_logger.write().unwrap();
        logger.log_permission_check(
            plugin_id,
            permission_type,
            resource,
            "validate",
            result,
            error,
        );
    }

    /// Get app_data_dir for external use (e.g., tests, debugging)
    pub fn get_app_data_dir(&self) -> &PathBuf {
        &self.app_data_dir
    }
}
