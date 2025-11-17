/**
 * Utility Commands for VCPChat Tauri Backend
 *
 * Provides utility commands for logging, platform detection, and developer tools.
 *
 * US6-019: log_message command for frontend-to-backend logging
 */

use log::{debug, error, info, warn};

/**
 * Log a message from the frontend to the Rust backend logs.
 *
 * This allows frontend console.log to be forwarded to the terminal
 * for unified logging in development mode.
 *
 * @param level - Log level: "debug", "info", "warn", "error"
 * @param message - Message to log
 * @param source - Source file/component (optional)
 */
#[tauri::command]
pub fn log_message(level: String, message: String, source: Option<String>) -> Result<(), String> {
  let formatted_message = if let Some(src) = source {
    format!("[Frontend:{}] {}", src, message)
  } else {
    format!("[Frontend] {}", message)
  };

  match level.to_lowercase().as_str() {
    "debug" => debug!("{}", formatted_message),
    "info" => info!("{}", formatted_message),
    "warn" => warn!("{}", formatted_message),
    "error" => error!("{}", formatted_message),
    _ => info!("{}", formatted_message), // Default to info
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_log_message_basic() {
    // Should not panic
    let result = log_message(
      "info".to_string(),
      "Test message".to_string(),
      None,
    );
    assert!(result.is_ok());
  }

  #[test]
  fn test_log_message_with_source() {
    let result = log_message(
      "debug".to_string(),
      "Component loaded".to_string(),
      Some("ChatManager".to_string()),
    );
    assert!(result.is_ok());
  }

  #[test]
  fn test_log_message_all_levels() {
    assert!(log_message("debug".to_string(), "Debug".to_string(), None).is_ok());
    assert!(log_message("info".to_string(), "Info".to_string(), None).is_ok());
    assert!(log_message("warn".to_string(), "Warn".to_string(), None).is_ok());
    assert!(log_message("error".to_string(), "Error".to_string(), None).is_ok());
    assert!(log_message("unknown".to_string(), "Unknown".to_string(), None).is_ok()); // Defaults to info
  }
}
