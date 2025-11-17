// PLUGIN-001: Plugin lifecycle state machine enum
// This module implements the complete plugin system infrastructure for VCPChat
// Following microkernel architecture with permission-based security

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// Re-export submodules
pub mod plugin_manager;
pub mod permission_manager;
pub mod manifest_parser;
pub mod lifecycle_manager;
pub mod filesystem_api;
pub mod network_proxy;
pub mod storage_api;
pub mod audit_logger;

/// Plugin lifecycle state machine
/// Represents the current state of a plugin in its lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PluginState {
    /// Plugin package not installed
    Uninstalled,
    /// Plugin package extracted to disk but not loaded
    Installed,
    /// Plugin manifest parsed and validated, ready to activate
    Loaded,
    /// Plugin activate() hook called, initializing
    Activated,
    /// Plugin fully running and responding to events
    Running,
    /// Plugin deactivate() hook called, cleaning up
    Deactivated,
}

impl PluginState {
    /// Check if a state transition is valid
    pub fn can_transition_to(&self, target: &PluginState) -> bool {
        use PluginState::*;
        matches!(
            (self, target),
            // Installation flow
            (Uninstalled, Installed)
            | (Installed, Loaded)
            | (Loaded, Activated)
            | (Activated, Running)
            // Deactivation flow
            | (Running, Deactivated)
            | (Deactivated, Installed)
            // Uninstallation
            | (Installed, Uninstalled)
            | (Deactivated, Uninstalled)
            // Re-activation
            | (Deactivated, Activated)
        )
    }
}

/// Plugin identifier (unique plugin ID)
pub type PluginId = String;

/// Plugin metadata from installed package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: PluginId,
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub plugin_type: String,
    pub install_path: std::path::PathBuf,
    pub state: PluginState,
    pub created_at: String,
    pub updated_at: String,
}

/// Result type for plugin operations
pub type PluginResult<T> = Result<T, PluginError>;

/// Plugin system errors
#[derive(Debug, thiserror::Error)]
pub enum PluginError {
    #[error("Plugin not found: {0}")]
    NotFound(PluginId),

    #[error("Invalid state transition from {from:?} to {to:?}")]
    InvalidStateTransition {
        from: PluginState,
        to: PluginState,
    },

    #[error("Manifest parsing error: {0}")]
    ManifestError(String),

    #[error("Manifest validation error: {0}")]
    ManifestValidation(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Dependency resolution failed: {0}")]
    DependencyError(String),

    #[error("Dependency resolution failed: {0}")]
    DependencyResolution(String),

    #[error("Plugin activation failed: {0}")]
    ActivationError(String),

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("ZIP extraction error: {0}")]
    ZipError(String),

    #[error("Lifecycle hook error: {0}")]
    HookError(String),

    #[error("File system error: {0}")]
    FileSystemError(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_transitions() {
        use PluginState::*;

        // Valid transitions
        assert!(Uninstalled.can_transition_to(&Installed));
        assert!(Installed.can_transition_to(&Loaded));
        assert!(Loaded.can_transition_to(&Activated));
        assert!(Activated.can_transition_to(&Running));
        assert!(Running.can_transition_to(&Deactivated));
        assert!(Deactivated.can_transition_to(&Installed));
        assert!(Installed.can_transition_to(&Uninstalled));

        // Invalid transitions
        assert!(!Uninstalled.can_transition_to(&Running));
        assert!(!Running.can_transition_to(&Installed));
        assert!(!Loaded.can_transition_to(&Deactivated));
    }
}
