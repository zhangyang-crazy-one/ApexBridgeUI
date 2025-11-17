// PLUGIN-039 to PLUGIN-046: FileSystemAPI implementation
// Permission-checked file access restricted to AppData scope
// Provides secure file operations with path validation and audit logging

use super::{PluginError, PluginResult, PluginId};
use super::permission_manager::PermissionManager;
use super::audit_logger::AuditLogger;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::sync::{Arc, Mutex};
use glob::Pattern;
use notify::{Watcher, RecursiveMode, Event};
use std::sync::mpsc::channel;

/// File system operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

/// File metadata information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub is_file: bool,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<String>,
    pub created: Option<String>,
}

/// File watch event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatchEvent {
    pub event_type: String, // "created", "modified", "removed"
    pub path: String,
}

/// PLUGIN-039 to PLUGIN-045: FileSystemAPI
/// Manages all file operations with permission validation
pub struct FileSystemAPI {
    app_data_dir: PathBuf,
    pub(crate) permission_manager: Arc<Mutex<PermissionManager>>,
    audit_logger: Arc<Mutex<AuditLogger>>,
    // File watchers stored per plugin
    watchers: Arc<Mutex<std::collections::HashMap<PluginId, Box<dyn Watcher + Send>>>>,
}

impl FileSystemAPI {
    pub fn new(
        app_data_dir: PathBuf,
        permission_manager: Arc<Mutex<PermissionManager>>,
        audit_logger: Arc<Mutex<AuditLogger>>,
    ) -> Self {
        Self {
            app_data_dir,
            permission_manager,
            audit_logger,
            watchers: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Get permission manager (for testing)
    pub fn permission_manager(&self) -> Arc<Mutex<PermissionManager>> {
        Arc::clone(&self.permission_manager)
    }

    /// PLUGIN-043: Validate path against security constraints
    /// - Must be within AppData directory
    /// - No parent directory (..) components
    /// - No absolute paths outside AppData
    /// - No symlinks (future: could be added with extra validation)
    fn validate_path(&self, plugin_id: &str, path: &Path, write: bool) -> PluginResult<PathBuf> {
        // Reject paths with parent directory components
        if path.components().any(|c| c == std::path::Component::ParentDir) {
            return Err(PluginError::PermissionDenied(
                "Path traversal attempt (..) detected".to_string()
            ));
        }

        // Reject absolute paths (should always be relative to AppData)
        if path.is_absolute() {
            return Err(PluginError::PermissionDenied(
                "Absolute paths not allowed, use relative paths within AppData".to_string()
            ));
        }

        // Construct full path within AppData
        let full_path = self.app_data_dir.join(path);

        // Canonicalize AppData directory for comparison
        let canonical_app_data = self.app_data_dir.canonicalize().map_err(|e| {
            PluginError::FileSystemError(format!("Failed to canonicalize AppData dir: {}", e))
        })?;

        // Canonicalize to resolve any symlinks or relative components
        // Note: This will fail if the path doesn't exist yet (for write operations)
        let canonical_path = if full_path.exists() {
            full_path.canonicalize().map_err(|e| {
                PluginError::FileSystemError(format!("Failed to canonicalize path: {}", e))
            })?
        } else {
            // For non-existent paths (write operations), validate parent directory
            if let Some(parent) = full_path.parent() {
                if parent.exists() {
                    let canonical_parent = parent.canonicalize().map_err(|e| {
                        PluginError::FileSystemError(format!("Failed to canonicalize parent: {}", e))
                    })?;
                    canonical_parent.join(full_path.file_name().unwrap())
                } else {
                    // Parent doesn't exist yet, just use the AppData-relative path
                    canonical_app_data.join(path)
                }
            } else {
                canonical_app_data.join(path)
            }
        };

        // Ensure canonical path is still within AppData
        if !canonical_path.starts_with(&canonical_app_data) {
            return Err(PluginError::PermissionDenied(
                "Path escapes AppData directory".to_string()
            ));
        }

        // Check permission with PermissionManager
        let pm = self.permission_manager.lock().unwrap();
        if !pm.validate_filesystem_permission(plugin_id, &canonical_path, write) {
            return Err(PluginError::PermissionDenied(
                format!("No {} permission for path: {}", if write { "write" } else { "read" }, canonical_path.display())
            ));
        }

        Ok(canonical_path)
    }

    /// PLUGIN-045: Log file operation to audit logger
    fn log_operation(&self, plugin_id: &str, operation: &str, path: &Path, result: bool, error: Option<&str>) {
        let mut logger = self.audit_logger.lock().unwrap();
        logger.log_permission_check(
            plugin_id,
            if operation.contains("write") || operation.contains("delete") {
                &super::permission_manager::PermissionType::FilesystemWrite
            } else {
                &super::permission_manager::PermissionType::FilesystemRead
            },
            &path.to_string_lossy(),
            operation,
            result,
            error,
        );
    }

    /// PLUGIN-039: Read file contents
    pub fn read_file(&self, plugin_id: &str, path: &str) -> PluginResult<String> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, false)?;

        // Read file
        let contents = fs::read_to_string(&validated_path).map_err(|e| {
            self.log_operation(plugin_id, "read", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to read file: {}", e))
        })?;

        // Log success
        self.log_operation(plugin_id, "read", &validated_path, true, None);

        Ok(contents)
    }

    /// PLUGIN-040: Write file contents with atomic write
    pub fn write_file(&self, plugin_id: &str, path: &str, contents: &str) -> PluginResult<()> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, true)?;

        // Ensure parent directory exists
        if let Some(parent) = validated_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                self.log_operation(plugin_id, "write", &validated_path, false, Some(&e.to_string()));
                PluginError::FileSystemError(format!("Failed to create parent directory: {}", e))
            })?;
        }

        // Atomic write: write to temp file, then rename
        let temp_path = validated_path.with_extension(".tmp");

        fs::write(&temp_path, contents).map_err(|e| {
            self.log_operation(plugin_id, "write", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to write temp file: {}", e))
        })?;

        fs::rename(&temp_path, &validated_path).map_err(|e| {
            // Clean up temp file on failure
            let _ = fs::remove_file(&temp_path);
            self.log_operation(plugin_id, "write", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to rename temp file: {}", e))
        })?;

        // Log success
        self.log_operation(plugin_id, "write", &validated_path, true, None);

        Ok(())
    }

    /// PLUGIN-041: List files in directory with optional glob pattern
    pub fn list_files(&self, plugin_id: &str, path: &str, pattern: Option<&str>) -> PluginResult<Vec<FileInfo>> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, false)?;

        // Check if path is a directory
        if !validated_path.is_dir() {
            self.log_operation(plugin_id, "list", &validated_path, false, Some("Not a directory"));
            return Err(PluginError::FileSystemError("Path is not a directory".to_string()));
        }

        // Compile glob pattern if provided
        let glob_pattern = if let Some(pat) = pattern {
            Some(Pattern::new(pat).map_err(|e| {
                PluginError::FileSystemError(format!("Invalid glob pattern: {}", e))
            })?)
        } else {
            None
        };

        // Read directory entries
        let entries = fs::read_dir(&validated_path).map_err(|e| {
            self.log_operation(plugin_id, "list", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to read directory: {}", e))
        })?;

        let mut file_infos = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|e| {
                PluginError::FileSystemError(format!("Failed to read entry: {}", e))
            })?;

            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            // Apply glob pattern filter if provided
            if let Some(ref pattern) = glob_pattern {
                if !pattern.matches(&file_name) {
                    continue;
                }
            }

            let metadata = entry.metadata().map_err(|e| {
                PluginError::FileSystemError(format!("Failed to read metadata: {}", e))
            })?;

            let file_info = FileInfo {
                path: entry_path.strip_prefix(&self.app_data_dir)
                    .unwrap_or(&entry_path)
                    .to_string_lossy()
                    .to_string(),
                name: file_name,
                is_file: metadata.is_file(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                modified: metadata.modified().ok()
                    .map(|t| format!("{:?}", t)),
                created: metadata.created().ok()
                    .map(|t| format!("{:?}", t)),
            };

            file_infos.push(file_info);
        }

        // Log success
        self.log_operation(plugin_id, "list", &validated_path, true, None);

        Ok(file_infos)
    }

    /// PLUGIN-042: Watch directory for file system events
    /// Note: This is a simplified stub - full implementation would require
    /// setting up notify watcher with event callbacks
    pub fn watch_directory(&self, plugin_id: &str, path: &str) -> PluginResult<()> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, false)?;

        // Check if path is a directory
        if !validated_path.is_dir() {
            self.log_operation(plugin_id, "watch", &validated_path, false, Some("Not a directory"));
            return Err(PluginError::FileSystemError("Path is not a directory".to_string()));
        }

        // Create file watcher
        let (tx, rx) = channel();

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    let _ = tx.send(event);
                },
                Err(e) => eprintln!("[FileSystemAPI] Watch error: {:?}", e),
            }
        }).map_err(|e| {
            self.log_operation(plugin_id, "watch", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to create watcher: {}", e))
        })?;

        // Start watching
        watcher.watch(&validated_path, RecursiveMode::Recursive).map_err(|e| {
            self.log_operation(plugin_id, "watch", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to start watching: {}", e))
        })?;

        // Store watcher (in real implementation, would need to handle events via callback)
        let mut watchers = self.watchers.lock().unwrap();
        watchers.insert(plugin_id.to_string(), Box::new(watcher));

        // Log success
        self.log_operation(plugin_id, "watch", &validated_path, true, None);

        Ok(())
    }

    /// Unwatch directory (cleanup when plugin is deactivated)
    pub fn unwatch_directory(&self, plugin_id: &str) -> PluginResult<()> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.remove(plugin_id);
        Ok(())
    }

    /// Delete file
    pub fn delete_file(&self, plugin_id: &str, path: &str) -> PluginResult<()> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, true)?;

        // Delete file
        fs::remove_file(&validated_path).map_err(|e| {
            self.log_operation(plugin_id, "delete", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to delete file: {}", e))
        })?;

        // Log success
        self.log_operation(plugin_id, "delete", &validated_path, true, None);

        Ok(())
    }

    /// Create directory
    pub fn create_directory(&self, plugin_id: &str, path: &str) -> PluginResult<()> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, true)?;

        // Create directory
        fs::create_dir_all(&validated_path).map_err(|e| {
            self.log_operation(plugin_id, "mkdir", &validated_path, false, Some(&e.to_string()));
            PluginError::FileSystemError(format!("Failed to create directory: {}", e))
        })?;

        // Log success
        self.log_operation(plugin_id, "mkdir", &validated_path, true, None);

        Ok(())
    }

    /// Check if file/directory exists
    pub fn exists(&self, plugin_id: &str, path: &str) -> PluginResult<bool> {
        let path_buf = PathBuf::from(path);

        // Validate path and permissions
        let validated_path = self.validate_path(plugin_id, &path_buf, false)?;

        let exists = validated_path.exists();

        // Log check
        self.log_operation(plugin_id, "exists", &validated_path, true, None);

        Ok(exists)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_filesystem_api() -> FileSystemAPI {
        let temp_dir = std::env::temp_dir().join(format!("vcp_fs_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();

        let pm = Arc::new(Mutex::new(PermissionManager::new(temp_dir.clone())));
        let logger = Arc::new(Mutex::new(AuditLogger::new(temp_dir.clone())));

        FileSystemAPI::new(temp_dir, pm, logger)
    }

    #[test]
    fn test_path_validation_rejects_parent_dir() {
        let fs_api = create_test_filesystem_api();
        let result = fs_api.validate_path("test-plugin", Path::new("../secret.txt"), false);
        assert!(result.is_err());
    }

    #[test]
    fn test_path_validation_rejects_absolute_path() {
        let fs_api = create_test_filesystem_api();
        let result = fs_api.validate_path("test-plugin", Path::new("/etc/passwd"), false);
        assert!(result.is_err());
    }

    #[test]
    fn test_write_and_read_file() {
        let fs_api = create_test_filesystem_api();
        let plugin_id = "test-plugin";

        // Grant write permission
        {
            let mut pm = fs_api.permission_manager.lock().unwrap();
            pm.grant_permission(plugin_id, super::super::permission_manager::PermissionType::FilesystemWrite, "*".to_string()).unwrap();
            pm.grant_permission(plugin_id, super::super::permission_manager::PermissionType::FilesystemRead, "*".to_string()).unwrap();
        }

        // Write file
        let result = fs_api.write_file(plugin_id, "test.txt", "Hello, World!");
        assert!(result.is_ok());

        // Read file
        let contents = fs_api.read_file(plugin_id, "test.txt").unwrap();
        assert_eq!(contents, "Hello, World!");
    }
}
