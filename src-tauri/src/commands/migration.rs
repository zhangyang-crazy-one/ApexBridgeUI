/**
 * Migration Commands (US5-024 to US5-029)
 *
 * Handles data migration from Electron to Tauri:
 * - Detect Electron AppData location (cross-platform)
 * - Validate JSON schemas
 * - Copy directory structure with progress tracking
 * - Non-destructive migration with backup
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationProgress {
    pub total_files: u64,
    pub copied_files: u64,
    pub current_file: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub is_migrated: bool,
    pub electron_path: Option<String>,
    pub tauri_path: String,
    pub backup_path: Option<String>,
    pub migration_date: Option<String>,
}

/**
 * US5-025: Detect Electron AppData location (Windows, macOS, Linux)
 */
fn detect_electron_appdata() -> Result<Option<PathBuf>, String> {
    // Determine platform-specific Electron AppData path
    let electron_dir_name = "VCPChat";

    #[cfg(target_os = "windows")]
    {
        // Windows: %APPDATA%/VCPChat/AppData
        if let Ok(appdata) = std::env::var("APPDATA") {
            let path = PathBuf::from(appdata)
                .join(electron_dir_name)
                .join("AppData");

            if path.exists() {
                return Ok(Some(path));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: ~/Library/Application Support/VCPChat/AppData
        if let Some(home) = dirs::home_dir() {
            let path = home
                .join("Library")
                .join("Application Support")
                .join(electron_dir_name)
                .join("AppData");

            if path.exists() {
                return Ok(Some(path));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: ~/.config/VCPChat/AppData
        if let Some(home) = dirs::home_dir() {
            let path = home
                .join(".config")
                .join(electron_dir_name)
                .join("AppData");

            if path.exists() {
                return Ok(Some(path));
            }
        }
    }

    Ok(None)
}

/**
 * US5-026: Validate JSON schema during migration
 */
fn validate_json_file(file_path: &Path) -> Result<(), String> {
    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Validate JSON structure
    serde_json::from_str::<serde_json::Value>(&contents)
        .map_err(|e| format!("Invalid JSON in {}: {}", file_path.display(), e))?;

    // Additional validation based on file location
    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    // Validate specific schemas
    if file_path.to_string_lossy().contains("Agents") && file_name.ends_with(".json") {
        // Validate Agent schema (basic check for required fields)
        let agent: serde_json::Value = serde_json::from_str(&contents)
            .map_err(|e| format!("Invalid Agent JSON: {}", e))?;

        let required_fields = vec!["id", "name", "model", "system_prompt"];
        for field in required_fields {
            if !agent.get(field).is_some() {
                return Err(format!("Agent missing required field: {}", field));
            }
        }
    } else if file_path.to_string_lossy().contains("AgentGroups") && file_name.ends_with(".json") {
        // Validate Group schema
        let group: serde_json::Value = serde_json::from_str(&contents)
            .map_err(|e| format!("Invalid Group JSON: {}", e))?;

        let required_fields = vec!["id", "name", "agent_ids", "collaboration_mode"];
        for field in required_fields {
            if !group.get(field).is_some() {
                return Err(format!("Group missing required field: {}", field));
            }
        }
    } else if file_path.to_string_lossy().contains("UserData/settings.json") {
        // Validate Settings schema
        let settings: serde_json::Value = serde_json::from_str(&contents)
            .map_err(|e| format!("Invalid Settings JSON: {}", e))?;

        let required_fields = vec!["backend_url", "api_key"];
        for field in required_fields {
            if !settings.get(field).is_some() {
                return Err(format!("Settings missing required field: {}", field));
            }
        }
    }

    Ok(())
}

/**
 * US5-027: Recursive directory copy with progress tracking
 */
fn copy_dir_recursive(
    src: &Path,
    dst: &Path,
    progress_callback: &dyn Fn(MigrationProgress),
    total_files: &mut u64,
    copied_files: &mut u64,
) -> Result<(), String> {
    // Create destination directory
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory {}: {}", dst.display(), e))?;

    // Read source directory
    let entries = fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory {}: {}", src.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_type = entry.file_type()
            .map_err(|e| format!("Failed to get file type: {}", e))?;

        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            // Recursively copy subdirectory
            copy_dir_recursive(&src_path, &dst_path, progress_callback, total_files, copied_files)?;
        } else if file_type.is_file() {
            // Validate JSON files before copying
            if src_path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Err(e) = validate_json_file(&src_path) {
                    eprintln!("Warning: JSON validation failed for {}: {}", src_path.display(), e);
                    // Continue anyway - migration should be tolerant
                }
            }

            // Copy file
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy {} to {}: {}", src_path.display(), dst_path.display(), e))?;

            *copied_files += 1;

            // Report progress
            progress_callback(MigrationProgress {
                total_files: *total_files,
                copied_files: *copied_files,
                current_file: entry.file_name().to_string_lossy().to_string(),
                status: format!("Copying ({}/{})", copied_files, total_files),
            });
        }
    }

    Ok(())
}

/**
 * Count total files for progress tracking
 */
fn count_files(path: &Path) -> Result<u64, String> {
    let mut count = 0u64;

    let entries = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_type = entry.file_type()
            .map_err(|e| format!("Failed to get file type: {}", e))?;

        if file_type.is_dir() {
            count += count_files(&entry.path())?;
        } else if file_type.is_file() {
            count += 1;
        }
    }

    Ok(count)
}

/**
 * US5-024: Implement migrate_from_electron Tauri command
 */
#[tauri::command]
pub async fn migrate_from_electron(
    app_handle: AppHandle,
) -> Result<String, String> {
    // Detect Electron AppData location
    let electron_path = match detect_electron_appdata()? {
        Some(path) => path,
        None => return Err("Electron VCPChat data not found. No migration needed.".to_string()),
    };

    // Get Tauri AppData directory
    let tauri_path = app_handle
        .path().resolve("AppData", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get Tauri AppData directory: {}", e))?;

    // Check if already migrated
    let migrated_marker = tauri_path.join(".migrated");
    if migrated_marker.exists() {
        return Err("Data already migrated. Migration can only run once.".to_string());
    }

    // Check if destination already has data
    if tauri_path.exists() && fs::read_dir(&tauri_path).map_or(false, |mut d| d.next().is_some()) {
        return Err("Destination directory already contains data. Manual migration required.".to_string());
    }

    // Create backup
    let backup_path = electron_path.with_file_name("VCPChat_backup");
    if backup_path.exists() {
        return Err(format!("Backup already exists at {}. Remove it before migrating.", backup_path.display()));
    }

    println!("Migrating data from Electron to Tauri...");
    println!("Source: {}", electron_path.display());
    println!("Destination: {}", tauri_path.display());

    // Count total files
    let total_files = count_files(&electron_path)?;
    let mut copied_files = 0u64;

    println!("Found {} files to migrate", total_files);

    // Create backup (rename original)
    fs::rename(&electron_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    println!("Created backup at: {}", backup_path.display());

    // Copy data with progress tracking
    let progress_callback = |progress: MigrationProgress| {
        println!("[Migration] {} - {}", progress.status, progress.current_file);
    };

    copy_dir_recursive(
        &backup_path,
        &tauri_path,
        &progress_callback,
        &mut total_files.clone(),
        &mut copied_files,
    )?;

    // Create migration marker
    let migration_info = serde_json::json!({
        "migrated_at": chrono::Utc::now().to_rfc3339(),
        "electron_path": electron_path.to_string_lossy(),
        "backup_path": backup_path.to_string_lossy(),
        "total_files": total_files,
    });

    fs::write(
        &migrated_marker,
        serde_json::to_string_pretty(&migration_info).unwrap(),
    )
    .map_err(|e| format!("Failed to create migration marker: {}", e))?;

    println!("Migration complete! {} files copied.", copied_files);

    Ok(format!(
        "Successfully migrated {} files from Electron to Tauri. Backup saved at: {}",
        copied_files,
        backup_path.display()
    ))
}

/**
 * US5-029: Implement check_migration_status command
 */
#[tauri::command]
pub async fn check_migration_status(
    app_handle: AppHandle,
) -> Result<MigrationStatus, String> {
    let tauri_path = app_handle
        .path().resolve("AppData", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get Tauri AppData directory: {}", e))?;

    let migrated_marker = tauri_path.join(".migrated");

    if migrated_marker.exists() {
        // Read migration info
        let migration_info = fs::read_to_string(&migrated_marker)
            .map_err(|e| format!("Failed to read migration marker: {}", e))?;

        let info: serde_json::Value = serde_json::from_str(&migration_info)
            .map_err(|e| format!("Invalid migration marker: {}", e))?;

        Ok(MigrationStatus {
            is_migrated: true,
            electron_path: info.get("electron_path").and_then(|v| v.as_str()).map(String::from),
            tauri_path: tauri_path.to_string_lossy().to_string(),
            backup_path: info.get("backup_path").and_then(|v| v.as_str()).map(String::from),
            migration_date: info.get("migrated_at").and_then(|v| v.as_str()).map(String::from),
        })
    } else {
        // Check if Electron data exists
        let electron_path = detect_electron_appdata()?;

        Ok(MigrationStatus {
            is_migrated: false,
            electron_path: electron_path.map(|p| p.to_string_lossy().to_string()),
            tauri_path: tauri_path.to_string_lossy().to_string(),
            backup_path: None,
            migration_date: None,
        })
    }
}
