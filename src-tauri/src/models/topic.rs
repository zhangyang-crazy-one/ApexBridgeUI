// Topic data model (Rust)
use serde::{Deserialize, Serialize};
use super::message::Message;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OwnerType {
    Agent,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topic {
    pub id: String,
    pub owner_id: String,
    pub owner_type: OwnerType,
    pub title: String,
    pub messages: Vec<Message>,
    pub created_at: String,
    pub updated_at: String,
}

impl Topic {
    /// Validate Topic data
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Topic ID is required".to_string());
        }
        if self.owner_id.is_empty() {
            return Err("Topic owner_id is required".to_string());
        }
        if self.title.is_empty() || self.title.len() > 100 {
            return Err("Topic title must be 1-100 characters".to_string());
        }
        // Validate timestamp
        if chrono::DateTime::parse_from_rfc3339(&self.created_at).is_err() {
            return Err("Topic created_at must be a valid ISO 8601 timestamp".to_string());
        }
        if chrono::DateTime::parse_from_rfc3339(&self.updated_at).is_err() {
            return Err("Topic updated_at must be a valid ISO 8601 timestamp".to_string());
        }
        Ok(())
    }
}
