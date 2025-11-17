// Message data model (Rust)
use serde::{Deserialize, Serialize};
use super::attachment::Attachment;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSender {
    User,
    Agent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub tool_name: String,
    pub arguments: String,
    pub result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMetadata {
    pub tokens: Option<u32>,
    pub model_used: Option<String>,
    pub latency_ms: Option<u32>,
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub sender: MessageSender,
    pub sender_id: Option<String>,
    pub sender_name: Option<String>,
    pub content: String,
    pub attachments: Vec<Attachment>,
    pub timestamp: String,
    pub is_streaming: bool,
    pub metadata: Option<MessageMetadata>,
}

impl Message {
    /// Validate Message data
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Message ID is required".to_string());
        }
        if self.content.is_empty() {
            return Err("Message content is required".to_string());
        }
        // Validate timestamp
        if chrono::DateTime::parse_from_rfc3339(&self.timestamp).is_err() {
            return Err("Message timestamp must be a valid ISO 8601 timestamp".to_string());
        }
        // Validate attachments
        for attachment in &self.attachments {
            attachment.validate()?;
        }
        Ok(())
    }
}
