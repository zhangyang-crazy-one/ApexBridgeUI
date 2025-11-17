// PLUGIN-055 to PLUGIN-059: StorageAPI implementation
// Plugin-isolated key-value storage with JSON persistence

use super::{PluginError, PluginResult, PluginId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Storage value type - stores JSON-serializable data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StorageValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Object(serde_json::Value),
}

/// Per-plugin storage container
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct PluginStorageData {
    data: HashMap<String, StorageValue>,
}

/// PLUGIN-055: PluginStorage struct with HashMap per plugin_id
/// Manages isolated key-value storage for each plugin
pub struct StorageAPI {
    /// Storage data per plugin
    storage: Arc<Mutex<HashMap<PluginId, PluginStorageData>>>,
    /// Base directory for storage files (AppData/plugin-data/)
    storage_dir: PathBuf,
}

impl StorageAPI {
    /// Create new StorageAPI instance
    pub fn new(storage_dir: PathBuf) -> Self {
        // Ensure storage directory exists
        if !storage_dir.exists() {
            let _ = fs::create_dir_all(&storage_dir);
        }

        Self {
            storage: Arc::new(Mutex::new(HashMap::new())),
            storage_dir,
        }
    }

    /// Get storage file path for a plugin
    fn get_storage_path(&self, plugin_id: &str) -> PathBuf {
        self.storage_dir
            .join(plugin_id)
            .join("storage.json")
    }

    /// Load storage from disk for a plugin
    fn load_storage(&self, plugin_id: &str) -> PluginResult<PluginStorageData> {
        let path = self.get_storage_path(plugin_id);

        if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| {
                PluginError::PermissionDenied(format!("Failed to read storage: {}", e))
            })?;

            serde_json::from_str(&content).map_err(|e| {
                PluginError::PermissionDenied(format!("Failed to parse storage: {}", e))
            })
        } else {
            Ok(PluginStorageData::default())
        }
    }

    /// PLUGIN-059: Persist storage to AppData/plugin-data/{plugin_id}/storage.json
    fn save_storage(&self, plugin_id: &str, data: &PluginStorageData) -> PluginResult<()> {
        let path = self.get_storage_path(plugin_id);

        // Create parent directory if needed
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                PluginError::PermissionDenied(format!("Failed to create storage directory: {}", e))
            })?;
        }

        // Serialize to JSON with pretty printing
        let json = serde_json::to_string_pretty(data).map_err(|e| {
            PluginError::PermissionDenied(format!("Failed to serialize storage: {}", e))
        })?;

        // Write to file atomically (write to temp file, then rename)
        let temp_path = path.with_extension("json.tmp");
        fs::write(&temp_path, json).map_err(|e| {
            PluginError::PermissionDenied(format!("Failed to write storage: {}", e))
        })?;

        fs::rename(&temp_path, &path).map_err(|e| {
            PluginError::PermissionDenied(format!("Failed to rename storage file: {}", e))
        })?;

        Ok(())
    }

    /// Ensure plugin storage is loaded in memory
    fn ensure_loaded(&self, plugin_id: &str) -> PluginResult<()> {
        let mut storage = self.storage.lock().unwrap();

        if !storage.contains_key(plugin_id) {
            let data = self.load_storage(plugin_id)?;
            storage.insert(plugin_id.to_string(), data);
        }

        Ok(())
    }

    /// PLUGIN-056: Implement set(key, value) command with JSON serialization
    /// Stores a value for the given key in the plugin's isolated storage
    pub fn set(&self, plugin_id: &str, key: &str, value: &str) -> PluginResult<()> {
        // Validate key (no empty keys)
        if key.is_empty() {
            return Err(PluginError::PermissionDenied("Storage key cannot be empty".to_string()));
        }

        self.ensure_loaded(plugin_id)?;

        // Try to parse value as JSON, fallback to string
        let storage_value = match serde_json::from_str::<serde_json::Value>(value) {
            Ok(json) => match json {
                serde_json::Value::String(s) => StorageValue::String(s),
                serde_json::Value::Number(n) => {
                    StorageValue::Number(n.as_f64().unwrap_or(0.0))
                }
                serde_json::Value::Bool(b) => StorageValue::Boolean(b),
                other => StorageValue::Object(other),
            },
            Err(_) => StorageValue::String(value.to_string()),
        };

        // Update in-memory storage
        let mut storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get_mut(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        plugin_data.data.insert(key.to_string(), storage_value);

        // Persist to disk
        drop(storage); // Release lock before saving
        let storage = self.storage.lock().unwrap();
        let plugin_data = storage.get(plugin_id).unwrap();
        self.save_storage(plugin_id, plugin_data)?;

        Ok(())
    }

    /// PLUGIN-057: Implement get(key) command with deserialization
    /// Retrieves a value for the given key from the plugin's isolated storage
    pub fn get(&self, plugin_id: &str, key: &str) -> PluginResult<Option<String>> {
        self.ensure_loaded(plugin_id)?;

        let storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        match plugin_data.data.get(key) {
            Some(value) => {
                let json_str = serde_json::to_string(value).map_err(|e| {
                    PluginError::PermissionDenied(format!("Failed to serialize value: {}", e))
                })?;
                Ok(Some(json_str))
            }
            None => Ok(None),
        }
    }

    /// PLUGIN-058: Implement delete(key) command
    /// Deletes a specific key from the plugin's storage
    pub fn delete(&self, plugin_id: &str, key: &str) -> PluginResult<bool> {
        self.ensure_loaded(plugin_id)?;

        let mut storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get_mut(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        let existed = plugin_data.data.remove(key).is_some();

        // Persist to disk
        drop(storage);
        let storage = self.storage.lock().unwrap();
        let plugin_data = storage.get(plugin_id).unwrap();
        self.save_storage(plugin_id, plugin_data)?;

        Ok(existed)
    }

    /// PLUGIN-058: Implement clear() command
    /// Clears all data from the plugin's storage
    pub fn clear(&self, plugin_id: &str) -> PluginResult<()> {
        self.ensure_loaded(plugin_id)?;

        let mut storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get_mut(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        plugin_data.data.clear();

        // Persist to disk
        drop(storage);
        let storage = self.storage.lock().unwrap();
        let plugin_data = storage.get(plugin_id).unwrap();
        self.save_storage(plugin_id, plugin_data)?;

        Ok(())
    }

    /// Get all keys in the plugin's storage
    pub fn keys(&self, plugin_id: &str) -> PluginResult<Vec<String>> {
        self.ensure_loaded(plugin_id)?;

        let storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        Ok(plugin_data.data.keys().cloned().collect())
    }

    /// Check if a key exists in the plugin's storage
    pub fn has(&self, plugin_id: &str, key: &str) -> PluginResult<bool> {
        self.ensure_loaded(plugin_id)?;

        let storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        Ok(plugin_data.data.contains_key(key))
    }

    /// Get the number of items in the plugin's storage
    pub fn size(&self, plugin_id: &str) -> PluginResult<usize> {
        self.ensure_loaded(plugin_id)?;

        let storage = self.storage.lock().unwrap();
        let plugin_data = storage
            .get(plugin_id)
            .ok_or_else(|| PluginError::PermissionDenied("Storage not initialized".to_string()))?;

        Ok(plugin_data.data.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_storage() -> StorageAPI {
        let temp_dir = std::env::temp_dir().join(format!("vcp_storage_test_{}", uuid::Uuid::new_v4()));
        StorageAPI::new(temp_dir)
    }

    #[test]
    fn test_set_and_get() {
        let storage = create_test_storage();
        let plugin_id = "test-plugin";

        // Set a value
        storage.set(plugin_id, "key1", "value1").unwrap();

        // Get the value
        let value = storage.get(plugin_id, "key1").unwrap();
        assert_eq!(value, Some("\"value1\"".to_string()));
    }

    #[test]
    fn test_set_json_value() {
        let storage = create_test_storage();
        let plugin_id = "test-plugin";

        // Set JSON object
        storage.set(plugin_id, "config", r#"{"name":"test","count":42}"#).unwrap();

        // Get the value
        let value = storage.get(plugin_id, "config").unwrap();
        assert!(value.is_some());
        assert!(value.unwrap().contains("name"));
    }

    #[test]
    fn test_delete() {
        let storage = create_test_storage();
        let plugin_id = "test-plugin";

        // Set and delete
        storage.set(plugin_id, "key1", "value1").unwrap();
        assert!(storage.has(plugin_id, "key1").unwrap());

        let existed = storage.delete(plugin_id, "key1").unwrap();
        assert!(existed);
        assert!(!storage.has(plugin_id, "key1").unwrap());
    }

    #[test]
    fn test_clear() {
        let storage = create_test_storage();
        let plugin_id = "test-plugin";

        // Set multiple values
        storage.set(plugin_id, "key1", "value1").unwrap();
        storage.set(plugin_id, "key2", "value2").unwrap();
        assert_eq!(storage.size(plugin_id).unwrap(), 2);

        // Clear all
        storage.clear(plugin_id).unwrap();
        assert_eq!(storage.size(plugin_id).unwrap(), 0);
    }

    #[test]
    fn test_keys() {
        let storage = create_test_storage();
        let plugin_id = "test-plugin";

        storage.set(plugin_id, "key1", "value1").unwrap();
        storage.set(plugin_id, "key2", "value2").unwrap();

        let keys = storage.keys(plugin_id).unwrap();
        assert_eq!(keys.len(), 2);
        assert!(keys.contains(&"key1".to_string()));
        assert!(keys.contains(&"key2".to_string()));
    }

    #[test]
    fn test_persistence() {
        let temp_dir = std::env::temp_dir().join(format!("vcp_storage_persist_{}", uuid::Uuid::new_v4()));
        let plugin_id = "test-plugin";

        // Create storage and set value
        {
            let storage = StorageAPI::new(temp_dir.clone());
            storage.set(plugin_id, "persistent", "data").unwrap();
        }

        // Create new instance and verify data persists
        {
            let storage = StorageAPI::new(temp_dir.clone());
            let value = storage.get(plugin_id, "persistent").unwrap();
            assert_eq!(value, Some("\"data\"".to_string()));
        }

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_plugin_isolation() {
        let storage = create_test_storage();

        // Set values for two different plugins
        storage.set("plugin1", "key", "value1").unwrap();
        storage.set("plugin2", "key", "value2").unwrap();

        // Verify isolation
        let value1 = storage.get("plugin1", "key").unwrap();
        let value2 = storage.get("plugin2", "key").unwrap();

        assert_eq!(value1, Some("\"value1\"".to_string()));
        assert_eq!(value2, Some("\"value2\"".to_string()));
    }

    #[test]
    fn test_empty_key_rejection() {
        let storage = create_test_storage();
        let result = storage.set("test-plugin", "", "value");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }
}
