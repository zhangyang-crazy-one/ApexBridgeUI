// Attachment data model (Rust)
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileType {
    Image,
    Document,
    Pdf,
    Audio,
    Video,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub filename: String,
    pub file_path: String,
    pub file_type: FileType,
    pub file_size: u64,
    pub created_at: String,
}

impl Attachment {
    /// Validate Attachment data
    pub fn validate(&self) -> Result<(), String> {
        if self.id.is_empty() {
            return Err("Attachment ID is required".to_string());
        }
        if self.filename.is_empty() {
            return Err("Attachment filename is required".to_string());
        }
        if self.file_path.is_empty() {
            return Err("Attachment file_path is required".to_string());
        }
        if self.file_size < 1 {
            return Err("Attachment file_size must be positive".to_string());
        }
        // Validate timestamp
        if chrono::DateTime::parse_from_rfc3339(&self.created_at).is_err() {
            return Err("Attachment created_at must be a valid ISO 8601 timestamp".to_string());
        }
        Ok(())
    }

    /// Detect file type from filename extension
    pub fn detect_file_type(filename: &str) -> FileType {
        let ext = Path::new(filename)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        match ext.as_str() {
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" => FileType::Image,
            "doc" | "docx" | "txt" | "md" | "rtf" => FileType::Document,
            "pdf" => FileType::Pdf,
            "mp3" | "wav" | "ogg" | "flac" | "aac" | "m4a" => FileType::Audio,
            "mp4" | "avi" | "mov" | "mkv" | "webm" | "flv" => FileType::Video,
            _ => FileType::Other,
        }
    }
}
