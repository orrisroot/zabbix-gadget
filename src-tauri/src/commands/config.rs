use crate::config::{self, AppConfig, ConfigState};
use tauri::Emitter;

/// Returns the current cached application configuration from memory.
#[tauri::command]
pub async fn get_config(
    state: tauri::State<'_, ConfigState>,
) -> Result<AppConfig, String> {
    let config = state.get();
    log::debug!("Returned cached config with {} servers", config.servers.len());
    Ok(config)
}

/// Saves updated application configuration to disk and updates the in-memory cache.
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

/// Returns the system directory path where configuration files are stored.
#[tauri::command]
pub async fn get_config_dir() -> Result<String, String> {
    let path = config::get_config_dir();
    Ok(path.to_string_lossy().to_string())
}
