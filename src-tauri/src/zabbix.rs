use crate::config::ServerConfig;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZabbixTrigger {
    #[serde(rename = "triggerid")]
    pub trigger_id: String,
    pub description: String,
    pub priority: String,
    pub value: String,
    #[serde(rename = "lastchange")]
    pub last_change: String,
    pub error: String,
    #[serde(rename = "url")]
    pub url: String,
    #[serde(rename = "hostname")]
    pub hostname: Option<String>,
    #[serde(rename = "hosts")]
    pub hosts: Option<Vec<ZabbixHost>>,
    pub comments: String,
    #[serde(rename = "expression")]
    pub expression: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZabbixHost {
    #[serde(rename = "host")]
    pub host_name: String,
    #[serde(rename = "hostid")]
    pub host_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZabbixError {
    pub code: i32,
    pub message: String,
    pub data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZabbixApiResponse<T> {
    pub jsonrpc: String,
    pub result: Option<T>,
    pub error: Option<ZabbixError>,
    pub id: u32,
}

pub struct ZabbixClient {
    pub host: String,
    pub user: String,
    pub pass: String,
    pub api_key: Option<String>,
    pub basic_auth_user: Option<String>,
    pub basic_auth_pass: Option<String>,
    pub auth_token: Option<String>,
    client: reqwest::Client,
}

impl ZabbixClient {
    pub fn new(
        host: &str,
        user: &str,
        pass: &str,
        api_key: Option<String>,
        basic_auth_user: Option<String>,
        basic_auth_pass: Option<String>,
    ) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        Self {
            host: host.to_string(),
            user: user.to_string(),
            pass: pass.to_string(),
            api_key,
            basic_auth_user,
            basic_auth_pass,
            auth_token: None,
            client,
        }
    }

    pub fn api_url(&self) -> String {
        let base = self.host.trim_end_matches('/');
        format!("{}/api_jsonrpc.php", base)
    }

    pub async fn login(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(ref api_key) = self.api_key {
            self.auth_token = Some(api_key.clone());
            let url = self.api_url();
            let mut req = self.client.post(&url);
            if let Some(ref b_user) = self.basic_auth_user {
                req = req.basic_auth(b_user, self.basic_auth_pass.as_deref());
            }
            let response: ZabbixApiResponse<serde_json::Value> = req
                .json(&json!({
                    "jsonrpc": "2.0",
                    "method": "trigger.get",
                    "params": {
                        "output": "triggerid",
                        "limit": 1
                    },
                    "auth": api_key,
                    "id": 1
                }))
                .send()
                .await?
                .json()
                .await?;

            if let Some(err) = response.error {
                let err_msg = match err.data {
                    Some(data) => format!(
                        "Zabbix API Key Error {}: {} ({})",
                        err.code, err.message, data
                    ),
                    None => format!("Zabbix API Key Error {}: {}", err.code, err.message),
                };
                self.auth_token = None;
                return Err(err_msg.into());
            }
            return Ok(());
        }

        let url = self.api_url();

        let mut req = self.client.post(&url);
        if let Some(ref b_user) = self.basic_auth_user {
            req = req.basic_auth(b_user, self.basic_auth_pass.as_deref());
        }

        let response: ZabbixApiResponse<String> = req
            .json(&json!({
                "jsonrpc": "2.0",
                "method": "user.login",
                "params": {
                    "username": self.user,
                    "password": self.pass
                },
                "id": 1
            }))
            .send()
            .await?
            .json()
            .await?;

        if let Some(err) = response.error {
            let err_msg = match err.data {
                Some(data) => format!("Zabbix Error {}: {} ({})", err.code, err.message, data),
                None => format!("Zabbix Error {}: {}", err.code, err.message),
            };
            return Err(err_msg.into());
        }

        self.auth_token = Some(response.result.ok_or("Empty result from Zabbix login")?);
        Ok(())
    }

    pub async fn get_triggers(&self) -> Result<Vec<ZabbixTrigger>, Box<dyn std::error::Error>> {
        let url = self.api_url();

        let token = self.auth_token.as_ref().ok_or("Not logged in")?;

        let mut req = self.client.post(&url);
        if let Some(ref b_user) = self.basic_auth_user {
            req = req.basic_auth(b_user, self.basic_auth_pass.as_deref());
        }

        let response: ZabbixApiResponse<Vec<ZabbixTrigger>> = req
            .json(&json!({
                "jsonrpc": "2.0",
                "method": "trigger.get",
                "params": {
                    "output": "extend",
                    "monitored": true,
                    "skipDependent": true,
                    "expandComment": 1,
                    "expandExpression": 1,
                    "expandDescription": 1,
                    "selectHosts": ["host", "hostid"],
                    "sortfield": "lastchange",
                    "sortorder": "DESC",
                    "filter": {
                        "status": 0,
                        "value": 1,
                        "state": 0
                    }
                },
                "auth": token,
                "id": 2
            }))
            .send()
            .await?
            .json()
            .await?;

        if let Some(err) = response.error {
            let err_msg = match err.data {
                Some(data) => format!("Zabbix Error {}: {} ({})", err.code, err.message, data),
                None => format!("Zabbix Error {}: {}", err.code, err.message),
            };
            return Err(err_msg.into());
        }

        let mut triggers = response.result.ok_or("Empty result from Zabbix fetch")?;
        for t in &mut triggers {
            if let Some(ref hosts) = t.hosts {
                if let Some(first_host) = hosts.first() {
                    t.hostname = Some(first_host.host_name.clone());
                }
            }
        }
        Ok(triggers)
    }
}

#[derive(Default)]
pub struct ZabbixSessionStore {
    /// Thread-safe in-memory cache mapping server labels to active authentication tokens.
    tokens: std::sync::Mutex<std::collections::HashMap<String, String>>,
}

impl ZabbixSessionStore {
    /// Retrieves a cached authentication token for the given server label.
    pub fn get_token(&self, label: &str) -> Option<String> {
        let tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        tokens.get(label).cloned()
    }

    /// Caches an authentication token for the given server label.
    pub fn set_token(&self, label: &str, token: String) {
        let mut tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        tokens.insert(label.to_string(), token);
    }

    /// Removes a cached authentication token for the given server label.
    pub fn remove_token(&self, label: &str) {
        let mut tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        tokens.remove(label);
    }

    /// Attempts to log into the specified Zabbix server and caches the session token upon success.
    pub async fn login_server(&self, server: &ServerConfig) -> Result<bool, String> {
        let mut client = ZabbixClient::new(
            &server.host,
            &server.user,
            &server.pass,
            server.api_key.clone(),
            server.basic_auth_user.clone(),
            server.basic_auth_pass.clone(),
        );
        match client.login().await {
            Ok(_) => {
                if let Some(ref token) = client.auth_token {
                    self.set_token(&server.label, token.clone());
                }
                Ok(true)
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub async fn fetch_triggers_with_retry(
        &self,
        server: &ServerConfig,
    ) -> Result<Vec<ZabbixTrigger>, String> {
        let mut client = ZabbixClient::new(
            &server.host,
            &server.user,
            &server.pass,
            server.api_key.clone(),
            server.basic_auth_user.clone(),
            server.basic_auth_pass.clone(),
        );

        if let Some(token) = self.get_token(&server.label) {
            client.auth_token = Some(token);
        } else {
            client.login().await.map_err(|e| e.to_string())?;
            if let Some(ref token) = client.auth_token {
                self.set_token(&server.label, token.clone());
            }
        }

        match client.get_triggers().await.map_err(|e| e.to_string()) {
            Ok(triggers) => Ok(triggers),
            Err(err_msg) => {
                log::warn!(
                    "Failed to fetch triggers with cached token for {}: {}. Retrying login...",
                    server.label,
                    err_msg
                );

                self.remove_token(&server.label);
                client.auth_token = None;

                client.login().await.map_err(|login_err| {
                    format!("Login failed after token invalidation: {}", login_err)
                })?;

                if let Some(ref token) = client.auth_token {
                    self.set_token(&server.label, token.clone());
                }

                client.get_triggers().await.map_err(|retry_err| {
                    format!("Failed to fetch triggers after login retry: {}", retry_err)
                })
            }
        }
    }
}
