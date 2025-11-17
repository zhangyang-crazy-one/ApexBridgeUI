// File system operations for conversations, agents, and groups
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::models::{Topic, Agent, Group};

/// Get AppData directory path
fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().resolve("AppData", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

/// Read conversation (topic) from file
#[tauri::command]
pub async fn read_conversation(app: AppHandle, topic_id: String) -> Result<Topic, String> {
    let app_data = get_app_data_dir(&app)?;

    // Try agent topics first
    let agent_path = app_data.join("Agents").join(format!("{}.json", topic_id));
    if agent_path.exists() {
        let content = fs::read_to_string(&agent_path)
            .map_err(|e| format!("Failed to read agent topic: {}", e))?;
        let topic: Topic = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse agent topic JSON: {}", e))?;
        return Ok(topic);
    }

    // Try group topics
    let group_path = app_data.join("AgentGroups").join(format!("{}.json", topic_id));
    if group_path.exists() {
        let content = fs::read_to_string(&group_path)
            .map_err(|e| format!("Failed to read group topic: {}", e))?;
        let topic: Topic = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse group topic JSON: {}", e))?;
        return Ok(topic);
    }

    Err(format!("Topic not found: {}", topic_id))
}

/// Write conversation (topic) to file
#[tauri::command]
pub async fn write_conversation(app: AppHandle, topic: Topic) -> Result<(), String> {
    topic.validate()?;

    let app_data = get_app_data_dir(&app)?;

    // Determine directory based on owner_type
    let dir = match topic.owner_type {
        crate::models::OwnerType::Agent => app_data.join("Agents"),
        crate::models::OwnerType::Group => app_data.join("AgentGroups"),
    };

    // Ensure directory exists
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir.join(format!("{}.json", topic.id));
    let json = serde_json::to_string_pretty(&topic)
        .map_err(|e| format!("Failed to serialize topic: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write topic file: {}", e))?;

    Ok(())
}

/// Delete conversation (topic) file
#[tauri::command]
pub async fn delete_conversation(app: AppHandle, topic_id: String, owner_type: String) -> Result<(), String> {
    let app_data = get_app_data_dir(&app)?;

    let dir = match owner_type.as_str() {
        "agent" => app_data.join("Agents"),
        "group" => app_data.join("AgentGroups"),
        _ => return Err("Invalid owner_type: must be 'agent' or 'group'".to_string()),
    };

    let file_path = dir.join(format!("{}.json", topic_id));

    if !file_path.exists() {
        return Err(format!("Topic not found: {}", topic_id));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete topic file: {}", e))?;

    Ok(())
}

/// List all topics for a specific owner
#[tauri::command]
pub async fn list_topics(app: AppHandle, owner_id: String, owner_type: String) -> Result<Vec<Topic>, String> {
    let app_data = get_app_data_dir(&app)?;

    let dir = match owner_type.as_str() {
        "agent" => app_data.join("Agents"),
        "group" => app_data.join("AgentGroups"),
        _ => return Err("Invalid owner_type: must be 'agent' or 'group'".to_string()),
    };

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut topics = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            if let Ok(topic) = serde_json::from_str::<Topic>(&content) {
                if topic.owner_id == owner_id {
                    topics.push(topic);
                }
            }
        }
    }

    // Sort by updated_at (most recent first)
    topics.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(topics)
}

/// Read agent from file
#[tauri::command]
pub async fn read_agent(app: AppHandle, agent_id: String) -> Result<Agent, String> {
    let app_data = get_app_data_dir(&app)?;
    let file_path = app_data.join("UserData").join(format!("{}.json", agent_id));

    if !file_path.exists() {
        return Err(format!("Agent not found: {}", agent_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read agent file: {}", e))?;

    let agent: Agent = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse agent JSON: {}", e))?;

    Ok(agent)
}

/// Write agent to file
#[tauri::command]
pub async fn write_agent(app: AppHandle, agent: Agent) -> Result<(), String> {
    agent.validate()?;

    let app_data = get_app_data_dir(&app)?;
    let dir = app_data.join("UserData");

    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir.join(format!("{}.json", agent.id));
    let json = serde_json::to_string_pretty(&agent)
        .map_err(|e| format!("Failed to serialize agent: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write agent file: {}", e))?;

    Ok(())
}

/// Delete agent file
#[tauri::command]
pub async fn delete_agent(app: AppHandle, agent_id: String) -> Result<(), String> {
    let app_data = get_app_data_dir(&app)?;
    let file_path = app_data.join("UserData").join(format!("{}.json", agent_id));

    if !file_path.exists() {
        return Err(format!("Agent not found: {}", agent_id));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete agent file: {}", e))?;

    Ok(())
}

/// List all agents
#[tauri::command]
pub async fn list_agents(app: AppHandle) -> Result<Vec<Agent>, String> {
    let app_data = get_app_data_dir(&app)?;
    let dir = app_data.join("UserData");

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut agents = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            if let Ok(agent) = serde_json::from_str::<Agent>(&content) {
                agents.push(agent);
            }
        }
    }

    // Sort by created_at (most recent first)
    agents.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(agents)
}

/// Read group from file
#[tauri::command]
pub async fn read_group(app: AppHandle, group_id: String) -> Result<Group, String> {
    let app_data = get_app_data_dir(&app)?;
    let file_path = app_data.join("UserData").join("groups").join(format!("{}.json", group_id));

    if !file_path.exists() {
        return Err(format!("Group not found: {}", group_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read group file: {}", e))?;

    let group: Group = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse group JSON: {}", e))?;

    Ok(group)
}

/// Write group to file
#[tauri::command]
pub async fn write_group(app: AppHandle, group: Group) -> Result<(), String> {
    group.validate()?;

    let app_data = get_app_data_dir(&app)?;
    let dir = app_data.join("UserData").join("groups");

    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir.join(format!("{}.json", group.id));
    let json = serde_json::to_string_pretty(&group)
        .map_err(|e| format!("Failed to serialize group: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write group file: {}", e))?;

    Ok(())
}

/// Delete group file
#[tauri::command]
pub async fn delete_group(app: AppHandle, group_id: String) -> Result<(), String> {
    let app_data = get_app_data_dir(&app)?;
    let file_path = app_data.join("UserData").join("groups").join(format!("{}.json", group_id));

    if !file_path.exists() {
        return Err(format!("Group not found: {}", group_id));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete group file: {}", e))?;

    Ok(())
}

/// List all groups
#[tauri::command]
pub async fn list_groups(app: AppHandle) -> Result<Vec<Group>, String> {
    let app_data = get_app_data_dir(&app)?;
    let dir = app_data.join("UserData").join("groups");

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut groups = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            if let Ok(group) = serde_json::from_str::<Group>(&content) {
                groups.push(group);
            }
        }
    }

    // Sort by created_at (most recent first)
    groups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(groups)
}

/// Read canvas from file (CORE-044)
#[tauri::command]
pub async fn read_canvas(app: AppHandle, canvas_id: String) -> Result<serde_json::Value, String> {
    let app_data = get_app_data_dir(&app)?;
    let file_path = app_data.join("Canvasmodules").join(format!("{}.json", canvas_id));

    if !file_path.exists() {
        return Err(format!("Canvas not found: {}", canvas_id));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read canvas file: {}", e))?;

    let canvas: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse canvas JSON: {}", e))?;

    Ok(canvas)
}

/// Write canvas to file (CORE-044)
#[tauri::command]
pub async fn write_canvas(app: AppHandle, canvas: serde_json::Value) -> Result<(), String> {
    // Extract canvas_id from the JSON
    let canvas_id = canvas.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Canvas must have an 'id' field".to_string())?;

    let app_data = get_app_data_dir(&app)?;
    let dir = app_data.join("Canvasmodules");

    // Ensure directory exists
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir.join(format!("{}.json", canvas_id));
    let json = serde_json::to_string_pretty(&canvas)
        .map_err(|e| format!("Failed to serialize canvas: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write canvas file: {}", e))?;

    Ok(())
}

/// Delete canvas file (CORE-044)
#[tauri::command]
pub async fn delete_canvas(app: AppHandle, canvas_id: String) -> Result<(), String> {
    let app_data = get_app_data_dir(&app)?;
    let file_path = app_data.join("Canvasmodules").join(format!("{}.json", canvas_id));

    if !file_path.exists() {
        return Err(format!("Canvas not found: {}", canvas_id));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete canvas file: {}", e))?;

    Ok(())
}

/// List all canvas files (CORE-044)
#[tauri::command]
pub async fn list_canvases(app: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_data = get_app_data_dir(&app)?;
    let dir = app_data.join("Canvasmodules");

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut canvases = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            if let Ok(canvas) = serde_json::from_str::<serde_json::Value>(&content) {
                canvases.push(canvas);
            }
        }
    }

    // Sort by modifiedAt (most recent first)
    canvases.sort_by(|a, b| {
        let a_time = a.get("modifiedAt").and_then(|v| v.as_str()).unwrap_or("");
        let b_time = b.get("modifiedAt").and_then(|v| v.as_str()).unwrap_or("");
        b_time.cmp(a_time)
    });

    Ok(canvases)
}
