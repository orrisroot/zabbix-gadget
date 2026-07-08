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

        Ok(response.result.ok_or("Empty result from Zabbix fetch")?)
    }
}

#[derive(Default)]
pub struct ZabbixSessionStore {
    pub tokens: std::sync::Mutex<std::collections::HashMap<String, String>>,
}
