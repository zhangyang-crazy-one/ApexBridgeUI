// Window control commands
use tauri::{AppHandle, Manager, Window};

/// Set window always on top
#[tauri::command]
pub async fn set_window_always_on_top(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top)
        .map_err(|e| format!("Failed to set always on top: {}", e))?;
    Ok(())
}

/// Set window transparency (decorations must support it)
#[tauri::command]
pub async fn set_window_transparency(window: Window, transparency: f32) -> Result<(), String> {
    if transparency < 0.0 || transparency > 1.0 {
        return Err("Transparency must be between 0.0 and 1.0".to_string());
    }

    // Note: Tauri 2 uses set_decorations and platform-specific APIs for transparency
    // For full transparency support, additional platform-specific code may be needed
    window.set_decorations(transparency >= 0.95)
        .map_err(|e| format!("Failed to set decorations: {}", e))?;

    Ok(())
}

/// Minimize window
#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize()
        .map_err(|e| format!("Failed to minimize window: {}", e))?;
    Ok(())
}

/// Maximize window
#[tauri::command]
pub async fn maximize_window(window: Window) -> Result<(), String> {
    window.maximize()
        .map_err(|e| format!("Failed to maximize window: {}", e))?;
    Ok(())
}

/// Close window
#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.close()
        .map_err(|e| format!("Failed to close window: {}", e))?;
    Ok(())
}
