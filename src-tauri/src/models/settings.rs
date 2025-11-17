// GlobalSettings data model (Rust)
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPreferences {
    pub always_on_top: bool,
    pub transparency: f32,            // 0.0 (透明) 到 1.0 (不透明)
    pub startup_behavior: String,     // "normal" | "minimized" | "hidden"
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarWidths {
    pub agents_list: u32,             // 像素
    pub notifications: u32,           // 像素
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyboardShortcut {
    pub action: String,
    pub keys: String,                 // 如 "Ctrl+Enter", "Cmd+N"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSettings {
    pub backend_url: String,          // VCPToolBox URL
    pub api_key: String,              // Bearer 令牌
    pub websocket_url: Option<String>, // WebSocket URL (可选)
    pub websocket_key: Option<String>, // WebSocket 认证密钥 (可选)
    pub user_name: String,            // 用户显示名称
    pub user_avatar: String,          // 用户头像路径
    pub theme: String,                // 主题名称
    pub sidebar_widths: SidebarWidths,
    pub window_preferences: WindowPreferences,
    pub keyboard_shortcuts: Vec<KeyboardShortcut>,
}

impl GlobalSettings {
    /// Get default settings
    pub fn default() -> Self {
        GlobalSettings {
            backend_url: "http://localhost:6005/v1/chat/completions".to_string(),
            api_key: String::new(),
            websocket_url: None,
            websocket_key: None,
            user_name: "User".to_string(),
            user_avatar: "assets/avatars/default-user.png".to_string(),
            theme: "claude-light".to_string(),
            sidebar_widths: SidebarWidths {
                agents_list: 280,
                notifications: 300,
            },
            window_preferences: WindowPreferences {
                always_on_top: false,
                transparency: 1.0,
                startup_behavior: "normal".to_string(),
                width: 1200,
                height: 800,
                x: 100,
                y: 100,
            },
            keyboard_shortcuts: vec![
                KeyboardShortcut {
                    action: "send_message".to_string(),
                    keys: "Ctrl+Enter".to_string(),
                },
                KeyboardShortcut {
                    action: "new_topic".to_string(),
                    keys: "Ctrl+N".to_string(),
                },
                KeyboardShortcut {
                    action: "search".to_string(),
                    keys: "Ctrl+F".to_string(),
                },
            ],
        }
    }

    /// Validate GlobalSettings data
    pub fn validate(&self) -> Result<(), String> {
        // Validate URL
        if url::Url::parse(&self.backend_url).is_err() {
            return Err("Settings backend_url must be a valid HTTP(S) URL".to_string());
        }

        if self.user_name.is_empty() || self.user_name.len() > 50 {
            return Err("Settings user_name must be 1-50 characters".to_string());
        }

        if self.user_avatar.is_empty() {
            return Err("Settings user_avatar is required".to_string());
        }

        if self.theme.is_empty() {
            return Err("Settings theme is required".to_string());
        }

        // Validate transparency
        if self.window_preferences.transparency < 0.0 || self.window_preferences.transparency > 1.0 {
            return Err("Settings window transparency must be between 0.0 and 1.0".to_string());
        }

        // Validate window size
        if self.window_preferences.width < 800 {
            return Err("Settings window width must be >= 800".to_string());
        }
        if self.window_preferences.height < 600 {
            return Err("Settings window height must be >= 600".to_string());
        }

        // Validate sidebar widths
        if self.sidebar_widths.agents_list < 200 || self.sidebar_widths.agents_list > 600 {
            return Err("Settings agents_list sidebar width must be between 200 and 600".to_string());
        }
        if self.sidebar_widths.notifications < 200 || self.sidebar_widths.notifications > 600 {
            return Err("Settings notifications sidebar width must be between 200 and 600".to_string());
        }

        Ok(())
    }
}
