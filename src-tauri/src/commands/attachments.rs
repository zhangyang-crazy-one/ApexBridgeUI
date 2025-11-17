// Attachment file operations
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::models::Attachment;

/// Get attachments directory path
fn get_attachments_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().resolve("AppData", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data.join("attachments"))
}

/// Save attachment file
#[tauri::command]
pub async fn save_attachment(
    app: AppHandle,
    attachment: Attachment,
    file_data: Vec<u8>
) -> Result<String, String> {
    attachment.validate()?;

    let attachments_dir = get_attachments_dir(&app)?;

    // Ensure attachments directory exists
    fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments directory: {}", e))?;

    let file_path = attachments_dir.join(&attachment.filename);

    // Write file data
    fs::write(&file_path, file_data)
        .map_err(|e| format!("Failed to write attachment file: {}", e))?;

    // Return relative path
    Ok(format!("attachments/{}", attachment.filename))
}

/// Read attachment file
#[tauri::command]
pub async fn read_attachment(app: AppHandle, file_path: String) -> Result<Vec<u8>, String> {
    let app_data = app.path().resolve("AppData", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let full_path = app_data.join(&file_path);

    if !full_path.exists() {
        return Err(format!("Attachment not found: {}", file_path));
    }

    let data = fs::read(&full_path)
        .map_err(|e| format!("Failed to read attachment file: {}", e))?;

    Ok(data)
}

/// Delete attachment file
#[tauri::command]
pub async fn delete_attachment(app: AppHandle, file_path: String) -> Result<(), String> {
    let app_data = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let full_path = app_data.join(&file_path);

    if !full_path.exists() {
        return Err(format!("Attachment not found: {}", file_path));
    }

    fs::remove_file(&full_path)
        .map_err(|e| format!("Failed to delete attachment file: {}", e))?;

    Ok(())
}
