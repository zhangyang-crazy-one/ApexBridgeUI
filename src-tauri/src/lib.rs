use log::{debug, info};

// Data models module
pub mod models;

// Commands module
pub mod commands;

// Plugin system module (Phase 1 - P0)
pub mod plugin;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize env_logger for terminal logging in development mode
  if cfg!(debug_assertions) {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
      .format_timestamp_millis()
      .init();
    info!("VCPChat Tauri - Development Mode");
    debug!("Debug logging enabled");
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_process::init())

    .invoke_handler(tauri::generate_handler![
      // File system commands
      commands::read_conversation,
      commands::write_conversation,
      commands::delete_conversation,
      commands::list_topics,
      commands::read_agent,
      commands::write_agent,
      commands::delete_agent,
      commands::list_agents,
      commands::read_group,
      commands::write_group,
      commands::delete_group,
      commands::list_groups,
      // Canvas commands (CORE-044)
      commands::read_canvas,
      commands::write_canvas,
      commands::delete_canvas,
      commands::list_canvases,
      // Settings commands
      commands::read_settings,
      commands::write_settings,
      // Window commands
      commands::set_window_always_on_top,
      commands::set_window_transparency,
      commands::minimize_window,
      commands::maximize_window,
      commands::close_window,
      // Attachment commands
      commands::save_attachment,
      commands::read_attachment,
      commands::delete_attachment,
      // Migration commands
      commands::migrate_from_electron,
      commands::check_migration_status,
      // Utility commands
      commands::log_message,
    ])
    .setup(|app| {
      info!("Tauri application setup starting...");

      // Log application metadata
      info!("App version: {}", app.package_info().version);
      info!("App name: {}", app.package_info().name);

      if cfg!(debug_assertions) {
        info!("Running in DEBUG mode");
        info!("Web debug mirror: http://localhost:1420");
      } else {
        info!("Running in RELEASE mode");
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
