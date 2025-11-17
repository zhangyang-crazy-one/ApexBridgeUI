// Notification data model (Rust)
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationType {
    PluginComplete,
    SystemAlert,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub r#type: NotificationType,
    pub title: String,
    pub content: String,
    pub timestamp: String,
    pub read_status: bool,
}

impl Notification {
    /// Validate Notification data
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Notification ID is required".to_string());
        }

        if self.title.is_empty() || self.title.len() > 100 {
            return Err("Notification title must be 1-100 characters".to_string());
        }

        // Validate timestamp
        if chrono::DateTime::parse_from_rfc3339(&self.timestamp).is_err() {
            return Err("Notification timestamp must be a valid ISO 8601 timestamp".to_string());
        }

        Ok(())
    }
}
