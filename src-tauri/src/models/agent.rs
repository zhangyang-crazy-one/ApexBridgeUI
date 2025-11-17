// Agent data model (Rust)
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub system_prompt: String,
    pub model: String,
    pub temperature: f32,
    pub context_token_limit: u32,
    pub max_output_tokens: u32,
    pub created_at: String,
}

impl Agent {
    /// Validate Agent data
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Agent ID is required".to_string());
        }
        if self.name.is_empty() || self.name.len() > 50 {
            return Err("Agent name must be 1-50 characters".to_string());
        }
        if self.avatar.is_empty() {
            return Err("Agent avatar is required".to_string());
        }
        if self.model.is_empty() {
            return Err("Agent model is required".to_string());
        }
        if self.temperature < 0.0 || self.temperature > 2.0 {
            return Err("Agent temperature must be between 0.0 and 2.0".to_string());
        }
        if self.context_token_limit < 1 {
            return Err("Agent context_token_limit must be positive".to_string());
        }
        if self.max_output_tokens < 1 {
            return Err("Agent max_output_tokens must be positive".to_string());
        }
        Ok(())
    }
}
