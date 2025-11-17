// Group data model (Rust)
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CollaborationMode {
    Sequential,
    Free,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub agent_ids: Vec<String>,
    pub collaboration_mode: CollaborationMode,
    pub turn_count: u32,
    pub speaking_rules: String,
    pub created_at: String,
}

impl Group {
    /// Validate Group data
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Group ID is required".to_string());
        }
        if self.name.is_empty() || self.name.len() > 50 {
            return Err("Group name must be 1-50 characters".to_string());
        }
        if self.avatar.is_empty() {
            return Err("Group avatar is required".to_string());
        }
        if self.agent_ids.len() < 2 {
            return Err("Group must have at least 2 agents".to_string());
        }
        if self.turn_count < 1 || self.turn_count > 10 {
            return Err("Group turn_count must be between 1 and 10".to_string());
        }
        if self.speaking_rules.len() > 500 {
            return Err("Group speaking_rules must be <= 500 characters".to_string());
        }
        Ok(())
    }
}
