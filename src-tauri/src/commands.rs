use crate::config::{self, AppConfig, ConfigState, ServerConfig};
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
pub async fn get_config(
    state: tauri::State<'_, ConfigState>,
) -> Result<AppConfig, String> {
    let config = state.get();
    log::debug!("Returned cached config with {} servers", config.servers.len());
    Ok(config)
}

#[tauri::command]
pub async fn save_config(
    app: tauri::AppHandle,
    config: AppConfig,
    state: tauri::State<'_, ConfigState>,
) -> Result<(), String> {
    config::save_config(&config).map_err(|e| e.to_string())?;
    state.update(config.clone());
    log::info!("Saved config with {} servers", config.servers.len());
    let _ = app.emit("config-updated", &config);
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
        server.api_key,
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
        server.api_key.clone(),
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

#[derive(serde::Serialize, Clone)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateCheckResult {
    NoUpdate,
    #[serde(rename_all = "camelCase")]
    Available {
        current_version: String,
        new_version: String,
        body: Option<String>,
    },
    Error {
        message: String,
    },
}

#[derive(serde::Serialize, Clone)]
struct ProgressPayload {
    downloaded: usize,
    total_len: Option<u64>,
}

#[tauri::command]
pub async fn check_for_update(app_handle: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    use tauri_plugin_updater::UpdaterExt;
    match app_handle.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::UpdateAvailable);
                Ok(UpdateCheckResult::Available {
                    current_version: app_handle.package_info().version.to_string(),
                    new_version: update.version.to_string(),
                    body: update.body.clone(),
                })
            }
            Ok(None) => {
                let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::Normal);
                Ok(UpdateCheckResult::NoUpdate)
            }
            Err(e) => {
                use tauri_plugin_updater::Error as UpdaterError;
                let is_not_found = match &e {
                    UpdaterError::ReleaseNotFound => true,
                    UpdaterError::Reqwest(reqwest_err) => {
                        reqwest_err.status() == Some(reqwest::StatusCode::NOT_FOUND)
                    }
                    _ => false,
                };

                if is_not_found {
                    let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::Normal);
                    Ok(UpdateCheckResult::NoUpdate)
                } else {
                    Ok(UpdateCheckResult::Error {
                        message: e.to_string(),
                    })
                }
            }
        },
        Err(e) => Ok(UpdateCheckResult::Error {
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    match app_handle.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let app_clone = app_handle.clone();
                let _ = crate::set_tray_menu(&app_clone, crate::TrayMenuState::UpdateAvailable);

                let progress_app = app_handle.clone();
                let mut downloaded = 0;
                let mut last_total_len: Option<u64> = None;

                if let Err(e) = update
                    .download_and_install(
                        move |chunk_len, total_len| {
                            if total_len != last_total_len {
                                last_total_len = total_len;
                                downloaded = 0;
                            }
                            downloaded += chunk_len;
                            let _ = progress_app.emit(
                                "update-progress",
                                ProgressPayload {
                                    downloaded,
                                    total_len,
                                },
                            );
                        },
                        move || {
                            // Finished download
                        },
                    )
                    .await
                {
                    return Err(e.to_string());
                }

                let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::RelaunchPending);
                Ok(())
            }
            Ok(None) => Err("No update available".to_string()),
            Err(e) => Err(e.to_string()),
        },
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn relaunch_app(app_handle: tauri::AppHandle) {
    app_handle.restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_check_result_serialization() {
        let res = UpdateCheckResult::Available {
            current_version: "0.1.2".to_string(),
            new_version: "0.1.3".to_string(),
            body: Some("Release notes".to_string()),
        };
        let json = serde_json::to_string(&res).unwrap();
        println!("SERDE_JSON_OUTPUT: {}", json);
    }
}
