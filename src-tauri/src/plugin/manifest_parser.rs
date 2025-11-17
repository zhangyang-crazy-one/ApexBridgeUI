// PLUGIN-021 to PLUGIN-027: Manifest Parser implementation
// Parse and validate plugin manifest.json against schema
// Implements activation events, contribution points, and schema validation

use super::{PluginError, PluginResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// PLUGIN-022: Activation event types
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "event", content = "value")]
pub enum ActivationEvent {
    #[serde(rename = "onCommand")]
    OnCommand(String),
    #[serde(rename = "onView")]
    OnView(String),
    #[serde(rename = "onStartupFinished")]
    OnStartupFinished,
    #[serde(rename = "onLanguage")]
    OnLanguage(String),
    #[serde(rename = "onFileOpen")]
    OnFileOpen(String),
}

impl ActivationEvent {
    /// Parse activation event from string format (e.g., "onCommand:myCommand")
    pub fn from_str(s: &str) -> PluginResult<Self> {
        let parts: Vec<&str> = s.splitn(2, ':').collect();
        let event_type = parts[0];

        match event_type {
            "onCommand" => {
                let command_id = parts.get(1)
                    .ok_or_else(|| PluginError::ManifestError(
                        format!("onCommand requires command ID: {}", s)
                    ))?;
                Ok(Self::OnCommand(command_id.to_string()))
            },
            "onView" => {
                let view_id = parts.get(1)
                    .ok_or_else(|| PluginError::ManifestError(
                        format!("onView requires view ID: {}", s)
                    ))?;
                Ok(Self::OnView(view_id.to_string()))
            },
            "onStartupFinished" => Ok(Self::OnStartupFinished),
            "onLanguage" => {
                let language_id = parts.get(1)
                    .ok_or_else(|| PluginError::ManifestError(
                        format!("onLanguage requires language ID: {}", s)
                    ))?;
                Ok(Self::OnLanguage(language_id.to_string()))
            },
            "onFileOpen" => {
                let pattern = parts.get(1)
                    .ok_or_else(|| PluginError::ManifestError(
                        format!("onFileOpen requires file pattern: {}", s)
                    ))?;
                Ok(Self::OnFileOpen(pattern.to_string()))
            },
            _ => Err(PluginError::ManifestError(
                format!("Unknown activation event: {}", event_type)
            ))
        }
    }
}

/// PLUGIN-023: Contribution point for commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Command {
    pub identifier: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl Command {
    /// PLUGIN-026: Validate command identifier format
    pub fn validate(&self) -> PluginResult<()> {
        if self.identifier.is_empty() {
            return Err(PluginError::ManifestError(
                "Command identifier cannot be empty".to_string()
            ));
        }

        // Identifier must follow pattern: pluginId.commandName
        if !self.identifier.contains('.') {
            return Err(PluginError::ManifestError(
                format!("Command identifier must follow 'pluginId.commandName' format: {}", self.identifier)
            ));
        }

        // Only alphanumeric, dots, and hyphens allowed
        if !self.identifier.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
            return Err(PluginError::ManifestError(
                format!("Invalid characters in command identifier: {}", self.identifier)
            ));
        }

        if self.title.is_empty() {
            return Err(PluginError::ManifestError(
                "Command title cannot be empty".to_string()
            ));
        }

        Ok(())
    }
}

/// PLUGIN-023: Contribution point for views
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct View {
    pub identifier: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub location: ViewLocation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewLocation {
    Sidebar,
    Panel,
    Editor,
}

impl View {
    /// PLUGIN-026: Validate view identifier format
    pub fn validate(&self) -> PluginResult<()> {
        if self.identifier.is_empty() {
            return Err(PluginError::ManifestError(
                "View identifier cannot be empty".to_string()
            ));
        }

        if !self.identifier.contains('.') {
            return Err(PluginError::ManifestError(
                format!("View identifier must follow 'pluginId.viewName' format: {}", self.identifier)
            ));
        }

        if !self.identifier.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
            return Err(PluginError::ManifestError(
                format!("Invalid characters in view identifier: {}", self.identifier)
            ));
        }

        if self.title.is_empty() {
            return Err(PluginError::ManifestError(
                "View title cannot be empty".to_string()
            ));
        }

        Ok(())
    }
}

/// PLUGIN-023: Contribution point for events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub identifier: String,
    pub description: Option<String>,
}

impl Event {
    /// PLUGIN-026: Validate event identifier format
    pub fn validate(&self) -> PluginResult<()> {
        if self.identifier.is_empty() {
            return Err(PluginError::ManifestError(
                "Event identifier cannot be empty".to_string()
            ));
        }

        if !self.identifier.contains('.') {
            return Err(PluginError::ManifestError(
                format!("Event identifier must follow 'pluginId.eventName' format: {}", self.identifier)
            ));
        }

        if !self.identifier.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-') {
            return Err(PluginError::ManifestError(
                format!("Invalid characters in event identifier: {}", self.identifier)
            ));
        }

        Ok(())
    }
}

/// PLUGIN-023: Contribution point for keybindings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keybinding {
    pub command: String,
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when: Option<String>,
}

impl Keybinding {
    /// Validate keybinding format
    pub fn validate(&self) -> PluginResult<()> {
        if self.command.is_empty() {
            return Err(PluginError::ManifestError(
                "Keybinding command cannot be empty".to_string()
            ));
        }

        if self.key.is_empty() {
            return Err(PluginError::ManifestError(
                "Keybinding key cannot be empty".to_string()
            ));
        }

        Ok(())
    }
}

/// PLUGIN-023: Contribution points struct
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributionPoints {
    #[serde(default)]
    pub commands: Vec<Command>,
    #[serde(default)]
    pub views: Vec<View>,
    #[serde(default)]
    pub events: Vec<Event>,
    #[serde(default)]
    pub keybindings: Vec<Keybinding>,
}

impl ContributionPoints {
    /// PLUGIN-026: Validate all contribution points
    pub fn validate(&self) -> PluginResult<()> {
        for command in &self.commands {
            command.validate()?;
        }

        for view in &self.views {
            view.validate()?;
        }

        for event in &self.events {
            event.validate()?;
        }

        for keybinding in &self.keybindings {
            keybinding.validate()?;
        }

        Ok(())
    }
}

/// PLUGIN-021: Plugin Manifest structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub manifest_version: String,
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub description: String,
    pub author: String,

    #[serde(default = "default_plugin_type")]
    pub plugin_type: String,

    #[serde(default = "default_main")]
    pub main: String,

    #[serde(default)]
    pub activation_events: Vec<String>,

    #[serde(default)]
    pub permissions: Vec<String>,

    #[serde(default)]
    pub contributes: ContributionPoints,

    #[serde(default)]
    pub engines: HashMap<String, String>,

    #[serde(default)]
    pub dependencies: HashMap<String, String>,
}

fn default_plugin_type() -> String {
    "synchronous".to_string()
}

fn default_main() -> String {
    "index.js".to_string()
}

impl Default for PluginManifest {
    fn default() -> Self {
        Self {
            manifest_version: "1.0.0".to_string(),
            name: String::new(),
            display_name: String::new(),
            version: "1.0.0".to_string(),
            description: String::new(),
            author: String::new(),
            plugin_type: default_plugin_type(),
            main: default_main(),
            activation_events: Vec::new(),
            permissions: Vec::new(),
            contributes: ContributionPoints::default(),
            engines: HashMap::new(),
            dependencies: HashMap::new(),
        }
    }
}

impl PluginManifest {
    /// PLUGIN-025: Validate manifest schema
    pub fn validate(&self) -> PluginResult<()> {
        // Required fields
        if self.name.is_empty() {
            return Err(PluginError::ManifestValidation(
                "Missing required field: name".to_string()
            ));
        }

        if self.version.is_empty() {
            return Err(PluginError::ManifestValidation(
                "Missing required field: version".to_string()
            ));
        }

        if self.description.is_empty() {
            return Err(PluginError::ManifestValidation(
                "Missing required field: description".to_string()
            ));
        }

        // Validate manifest version format (x.y.z)
        if !is_valid_version(&self.manifest_version) {
            return Err(PluginError::ManifestValidation(
                format!("Invalid manifest version format: {}", self.manifest_version)
            ));
        }

        // Validate plugin version format (x.y.z)
        if !is_valid_version(&self.version) {
            return Err(PluginError::ManifestValidation(
                format!("Invalid version format: {}", self.version)
            ));
        }

        // Validate plugin name (alphanumeric, hyphens, underscores)
        if !self.name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(PluginError::ManifestValidation(
                format!("Invalid plugin name (only alphanumeric, hyphens, underscores allowed): {}", self.name)
            ));
        }

        // Validate plugin type
        let valid_types = ["synchronous", "asynchronous", "static", "service", "messagePreprocessor"];
        if !valid_types.contains(&self.plugin_type.as_str()) {
            return Err(PluginError::ManifestValidation(
                format!("Invalid plugin type: {}. Must be one of: {:?}", self.plugin_type, valid_types)
            ));
        }

        // Validate activation events
        for event_str in &self.activation_events {
            ActivationEvent::from_str(event_str)?;
        }

        // Validate contribution points
        self.contributes.validate()?;

        // Validate dependencies versions
        for (dep_name, dep_version) in &self.dependencies {
            if !is_valid_version_range(dep_version) {
                return Err(PluginError::ManifestValidation(
                    format!("Invalid dependency version for {}: {}", dep_name, dep_version)
                ));
            }
        }

        Ok(())
    }
}

/// Helper: Validate version format (x.y.z)
fn is_valid_version(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3 {
        return false;
    }

    parts.iter().all(|part| part.parse::<u32>().is_ok())
}

/// Helper: Validate version range format
fn is_valid_version_range(version_range: &str) -> bool {
    // Support simple version (1.0.0) or range (^1.0.0, ~1.0.0, >=1.0.0)
    let trimmed = version_range.trim_start_matches(&['^', '~', '>', '=', '<'][..]);
    is_valid_version(trimmed)
}

/// PLUGIN-024: Manifest Parser
pub struct ManifestParser;

impl ManifestParser {
    pub fn new() -> Self {
        Self
    }

    /// PLUGIN-024: Parse manifest from file
    pub fn parse(&self, manifest_path: &Path) -> PluginResult<PluginManifest> {
        let content = std::fs::read_to_string(manifest_path)
            .map_err(|e| PluginError::ManifestError(format!("Failed to read manifest: {}", e)))?;

        let manifest: PluginManifest = serde_json::from_str(&content)
            .map_err(|e| PluginError::ManifestError(format!("JSON parse error: {}", e)))?;

        Ok(manifest)
    }

    /// PLUGIN-024 & PLUGIN-025: Parse and validate manifest
    pub fn parse_and_validate(&self, manifest_path: &Path) -> PluginResult<PluginManifest> {
        let manifest = self.parse(manifest_path)?;
        manifest.validate()?;
        Ok(manifest)
    }
}
