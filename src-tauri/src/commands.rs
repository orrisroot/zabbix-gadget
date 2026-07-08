use crate::config::{self, AppConfig, ServerConfig};
use crate::zabbix::{ZabbixClient, ZabbixSessionStore, ZabbixTrigger};
use serde::Serialize;
use tauri::{Emitter, Manager};

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
pub async fn login(
    server: ServerConfig,
    session_store: tauri::State<'_, ZabbixSessionStore>,
) -> Result<bool, String> {
    let mut client = ZabbixClient::new(
        &server.host,
        &server.user,
        &server.pass,
        server.basic_auth_user,
        server.basic_auth_pass,
    );
    match client.login().await {
        Ok(_) => {
            if let Some(ref token) = client.auth_token {
                let mut tokens = session_store.tokens.lock().unwrap();
                tokens.insert(server.label.clone(), token.clone());
            }
            Ok(true)
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn fetch_triggers(
    server: ServerConfig,
    session_store: tauri::State<'_, ZabbixSessionStore>,
) -> Result<TriggerResult, String> {
    let mut client = ZabbixClient::new(
        &server.host,
        &server.user,
        &server.pass,
        server.basic_auth_user.clone(),
        server.basic_auth_pass.clone(),
    );

    // 1. Try to get token from cache
    let cached_token = {
        let tokens = session_store.tokens.lock().unwrap();
        tokens.get(&server.label).cloned()
    };

    let mut needs_login = true;
    if let Some(token) = cached_token {
        client.auth_token = Some(token);
        needs_login = false;
    }

    if needs_login {
        if let Err(e) = client.login().await {
            return Ok(TriggerResult {
                label: server.label,
                success: false,
                triggers: vec![],
                error: Some(format!("Login failed: {}", e)),
                last_update: 0,
            });
        }
        if let Some(ref token) = client.auth_token {
            let mut tokens = session_store.tokens.lock().unwrap();
            tokens.insert(server.label.clone(), token.clone());
        }
    }

    // 2. Try fetching triggers
    match client.get_triggers().await.map_err(|e| e.to_string()) {
        Ok(triggers) => Ok(TriggerResult {
            label: server.label,
            success: true,
            triggers,
            error: None,
            last_update: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or_else(|_| 0),
        }),
        Err(e) => {
            log::warn!(
                "Failed to fetch triggers with cached token for {}: {}. Retrying login...",
                server.label,
                e
            );

            // Invalidate cache
            {
                let mut tokens = session_store.tokens.lock().unwrap();
                tokens.remove(&server.label);
            }

            // Retry login
            if let Err(login_err) = client.login().await {
                return Ok(TriggerResult {
                    label: server.label,
                    success: false,
                    triggers: vec![],
                    error: Some(format!(
                        "Login failed after token invalidation: {}",
                        login_err
                    )),
                    last_update: 0,
                });
            }

            // Cache new token
            if let Some(ref token) = client.auth_token {
                let mut tokens = session_store.tokens.lock().unwrap();
                tokens.insert(server.label.clone(), token.clone());
            }

            // Retry fetching triggers
            match client.get_triggers().await {
                Ok(triggers) => Ok(TriggerResult {
                    label: server.label,
                    success: true,
                    triggers,
                    error: None,
                    last_update: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or_else(|_| 0),
                }),
                Err(retry_err) => Ok(TriggerResult {
                    label: server.label,
                    success: false,
                    triggers: vec![],
                    error: Some(format!(
                        "Failed to fetch triggers after login retry: {}",
                        retry_err
                    )),
                    last_update: 0,
                }),
            }
        }
    }
}

#[tauri::command]
pub fn close_app(app_handle: tauri::AppHandle) {
    log::info!("Hiding main window instead of exiting...");
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        let _ = window.emit("window-visibility", false);
    }
}
