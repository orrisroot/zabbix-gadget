use crate::config::{ConfigState, ServerConfig};
use crate::zabbix::{ZabbixSessionStore, ZabbixTrigger};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct TriggerResult {
    pub label: String,
    pub success: bool,
    pub triggers: Vec<ZabbixTrigger>,
    pub error: Option<String>,
    pub last_update: u64,
}

/// Tests connection and logs into a Zabbix server target.
#[tauri::command]
pub async fn login(
    server: ServerConfig,
    session_store: tauri::State<'_, ZabbixSessionStore>,
) -> Result<bool, String> {
    session_store.login_server(&server).await
}

/// Fetches active Zabbix triggers for a server label, looking up server credentials securely from ConfigState.
#[tauri::command]
pub async fn fetch_triggers(
    server_label: String,
    config_state: tauri::State<'_, ConfigState>,
    session_store: tauri::State<'_, ZabbixSessionStore>,
) -> Result<TriggerResult, String> {
    let config = config_state.get();
    let server = match config.servers.iter().find(|s| s.label == server_label) {
        Some(s) => s,
        None => {
            return Ok(TriggerResult {
                label: server_label,
                success: false,
                triggers: vec![],
                error: Some("Server target not found in configuration".to_string()),
                last_update: 0,
            });
        }
    };

    match session_store.fetch_triggers_with_retry(server).await {
        Ok(triggers) => Ok(TriggerResult {
            label: server.label.clone(),
            success: true,
            triggers,
            error: None,
            last_update: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or_else(|_| 0),
        }),
        Err(err) => Ok(TriggerResult {
            label: server.label.clone(),
            success: false,
            triggers: vec![],
            error: Some(err),
            last_update: 0,
        }),
    }
}
