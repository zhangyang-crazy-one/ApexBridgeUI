// Settings management commands
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::models::GlobalSettings;

/// Get settings file path
fn get_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().resolve("AppData", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data.join("settings.json"))
}

/// Read global settings from file
#[tauri::command]
pub async fn read_settings(app: AppHandle) -> Result<GlobalSettings, String> {
    let settings_path = get_settings_path(&app)?;

    // Return default settings if file doesn't exist
    if !settings_path.exists() {
        return Ok(GlobalSettings::default());
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let settings: GlobalSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;

    Ok(settings)
}

/// Write global settings to file
#[tauri::command]
pub async fn write_settings(app: AppHandle, settings: GlobalSettings) -> Result<(), String> {
    settings.validate()?;

    let settings_path = get_settings_path(&app)?;

    // Ensure parent directory exists
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}
