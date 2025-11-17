// PLUGIN-065 to PLUGIN-070: Audit Logger implementation
// Log all plugin permission usage for security audits
// Implements FR-012 with structured logging

use super::{PluginError, PluginId, PluginResult};
use super::permission_manager::PermissionType;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use chrono::Utc;

/// PLUGIN-065: AuditLogEntry struct with all required fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub timestamp: String,
    pub plugin_id: PluginId,
    pub permission_type: String,
    pub resource: String,
    pub action: String, // "request", "grant", "revoke", "validate", etc.
    pub result: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// Audit Logger - Central logging for plugin permission usage
pub struct AuditLogger {
    log_dir: PathBuf,
}

impl AuditLogger {
    /// PLUGIN-065: Initialize audit logger with log directory
    pub fn new(app_data_dir: PathBuf) -> Self {
        let log_dir = app_data_dir.join("audit-logs");

        // Ensure log directory exists
        if let Err(e) = fs::create_dir_all(&log_dir) {
            eprintln!("[AuditLogger] Failed to create log directory: {}", e);
        }

        Self { log_dir }
    }

    /// PLUGIN-066: Log permission check to daily JSONL file
    pub fn log_permission_check(
        &mut self,
        plugin_id: &str,
        permission_type: &PermissionType,
        resource: &str,
        action: &str,
        result: bool,
        error: Option<&str>,
    ) {
        let entry = AuditLogEntry {
            timestamp: Utc::now().to_rfc3339(),
            plugin_id: plugin_id.to_string(),
            permission_type: permission_type.to_string(),
            resource: resource.to_string(),
            action: action.to_string(),
            result,
            error_message: error.map(String::from),
        };

        if let Err(e) = self.append_log_entry(&entry) {
            eprintln!("[AuditLogger] Failed to log entry: {}", e);
        }

        // PLUGIN-068: Perform log rotation check
        if let Err(e) = self.rotate_old_logs() {
            eprintln!("[AuditLogger] Failed to rotate logs: {}", e);
        }
    }

    /// PLUGIN-066 & PLUGIN-067: Append entry to today's JSONL file
    fn append_log_entry(&self, entry: &AuditLogEntry) -> PluginResult<()> {
        let log_file_path = self.get_log_file_path();

        // PLUGIN-067: Serialize entry to JSON
        let json = serde_json::to_string(entry)
            .map_err(|e| PluginError::ManifestError(format!("Failed to serialize log entry: {}", e)))?;

        // Append to JSONL file
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file_path)?;

        writeln!(file, "{}", json)?;

        Ok(())
    }

    /// Get log file path for today (YYYY-MM-DD.jsonl)
    fn get_log_file_path(&self) -> PathBuf {
        let date = Utc::now().format("%Y-%m-%d").to_string();
        self.log_dir.join(format!("{}.jsonl", date))
    }

    /// PLUGIN-068: Rotate logs - keep last 30 days, delete older
    fn rotate_old_logs(&self) -> PluginResult<()> {
        let entries = fs::read_dir(&self.log_dir)?;
        let cutoff = Utc::now() - chrono::Duration::days(30);
        let cutoff_date = cutoff.format("%Y-%m-%d").to_string();

        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(file_name) = path.file_stem().and_then(|s| s.to_str()) {
                    // Check if file is older than 30 days
                    if file_name < cutoff_date.as_str() {
                        if let Err(e) = fs::remove_file(&path) {
                            eprintln!("[AuditLogger] Failed to delete old log {}: {}", path.display(), e);
                        } else {
                            println!("[AuditLogger] Deleted old log: {}", path.display());
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// PLUGIN-069: Read audit logs for UI display
    pub fn read_audit_logs(&self, from_date: Option<&str>, to_date: Option<&str>) -> PluginResult<Vec<AuditLogEntry>> {
        let mut entries = Vec::new();

        let dir_entries = fs::read_dir(&self.log_dir)?;

        for entry in dir_entries {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(file_name) = path.file_stem().and_then(|s| s.to_str()) {
                    // Filter by date range
                    if let Some(from) = from_date {
                        if file_name < from {
                            continue;
                        }
                    }
                    if let Some(to) = to_date {
                        if file_name > to {
                            continue;
                        }
                    }

                    // Read and parse JSONL file
                    let content = fs::read_to_string(&path)?;
                    for line in content.lines() {
                        if let Ok(entry) = serde_json::from_str::<AuditLogEntry>(line) {
                            entries.push(entry);
                        }
                    }
                }
            }
        }

        // Sort by timestamp (most recent first)
        entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(entries)
    }

    /// PLUGIN-070: Export audit logs to CSV
    pub fn export_to_csv(&self, output_path: &PathBuf) -> PluginResult<()> {
        let entries = self.read_audit_logs(None, None)?;

        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(output_path)?;

        // Write CSV header
        writeln!(file, "Timestamp,Plugin ID,Permission Type,Resource,Action,Result,Error Message")?;

        // Write entries
        for entry in entries {
            writeln!(
                file,
                "{},{},{},{},{},{},{}",
                entry.timestamp,
                entry.plugin_id,
                entry.permission_type,
                entry.resource,
                entry.action,
                entry.result,
                entry.error_message.unwrap_or_default()
            )?;
        }

        Ok(())
    }
}
