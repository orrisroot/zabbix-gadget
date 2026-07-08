use crate::config::{self, AppConfig, ServerConfig};
use crate::zabbix::{ZabbixClient, ZabbixTrigger};
use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct TriggerResult {
    pub label: String,
    pub success: bool,
    pub triggers: Vec<ZabbixTrigger>,
    pub error: Option<String>,
    pub last_update: u64,
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let config = config::load_config().map_err(|e| e.to_string())?;
    log::info!("Loaded config with {} servers", config.servers.len());
    Ok(config)
}

#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    config::save_config(&config).map_err(|e| e.to_string())?;
    log::info!("Saved config with {} servers", config.servers.len());
    Ok(())
}

#[tauri::command]
pub async fn get_config_dir() -> Result<String, String> {
    let path = config::get_config_dir();
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn login(server: ServerConfig) -> Result<bool, String> {
    let mut client = ZabbixClient::new(
        &server.host,
        &server.user,
        &server.pass,
        server.basic_auth_user,
        server.basic_auth_pass,
    );
    client
        .login()
        .await
        .map(|_| true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_triggers(server: ServerConfig) -> TriggerResult {
    let mut client = ZabbixClient::new(
        &server.host,
        &server.user,
        &server.pass,
        server.basic_auth_user.clone(),
        server.basic_auth_pass.clone(),
    );

    // Try to login first
    if let Err(e) = client.login().await {
        return TriggerResult {
            label: server.label,
            success: false,
            triggers: vec![],
            error: Some(format!("Login failed: {}", e)),
            last_update: 0,
        };
    }

    // Fetch triggers
    match client.get_triggers().await {
        Ok(triggers) => TriggerResult {
            label: server.label,
            success: true,
            triggers,
            error: None,
            last_update: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or_else(|_| 0),
        },
        Err(e) => TriggerResult {
            label: server.label,
            success: false,
            triggers: vec![],
            error: Some(format!("Failed to fetch triggers: {}", e)),
            last_update: 0,
        },
    }
}

#[tauri::command]
pub fn close_app(app_handle: tauri::AppHandle) {
    log::info!("Hiding main window instead of exiting...");
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}
