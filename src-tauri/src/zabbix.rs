use crate::config::ServerConfig;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;

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
    /// Effective host maintenance flag parsed from Zabbix ("0"/"1", 0/1, or bool).
    /// Kept internal to Rust so the IPC payload sent to the frontend stays unchanged.
    #[serde(
        default,
        skip_serializing,
        rename = "maintenance_status",
        deserialize_with = "deserialize_zabbix_flag"
    )]
    pub in_maintenance: bool,
}

/// Parses Zabbix boolean flags that may arrive as string, integer, bool, or null.
fn deserialize_zabbix_flag<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct FlagVisitor;

    impl<'de> serde::de::Visitor<'de> for FlagVisitor {
        type Value = bool;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a Zabbix flag as string, integer, or boolean")
        }

        fn visit_bool<E>(self, v: bool) -> Result<Self::Value, E> {
            Ok(v)
        }

        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
            Ok(v == 1)
        }

        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
            Ok(v == 1)
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> {
            Ok(v == "1" || v.eq_ignore_ascii_case("true"))
        }

        fn visit_none<E>(self) -> Result<Self::Value, E> {
            Ok(false)
        }

        fn visit_unit<E>(self) -> Result<Self::Value, E> {
            Ok(false)
        }

        fn visit_some<D2>(self, deserializer: D2) -> Result<Self::Value, D2::Error>
        where
            D2: serde::Deserializer<'de>,
        {
            deserializer.deserialize_any(self)
        }
    }

    deserializer.deserialize_any(FlagVisitor)
}

#[derive(Debug, Deserialize)]
struct ZabbixProblem {
    #[serde(rename = "objectid")]
    object_id: String,
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

fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_else(|err| {
            log::warn!(
                "Failed to build HTTP client with 10s timeout ({}); using default client",
                err
            );
            reqwest::Client::new()
        })
}

impl ZabbixClient {
    /// Builds a client from a server configuration while reusing a shared HTTP client pool.
    fn from_server(server: &ServerConfig, client: reqwest::Client) -> Self {
        Self::with_http_client(
            &server.host,
            &server.user,
            &server.pass,
            server.api_key.clone(),
            server.basic_auth_user.clone(),
            server.basic_auth_pass.clone(),
            client,
        )
    }

    fn with_http_client(
        host: &str,
        user: &str,
        pass: &str,
        api_key: Option<String>,
        basic_auth_user: Option<String>,
        basic_auth_pass: Option<String>,
        client: reqwest::Client,
    ) -> Self {
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

    /// Sends a JSON-RPC request to the Zabbix API and returns the parsed result.
    async fn post_rpc<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        params: serde_json::Value,
        auth: Option<&str>,
        id: u32,
        err_prefix: &str,
    ) -> Result<T, Box<dyn std::error::Error>> {
        let url = self.api_url();
        let mut req = self.client.post(&url);
        if let Some(ref b_user) = self.basic_auth_user {
            req = req.basic_auth(b_user, self.basic_auth_pass.as_deref());
        }

        let mut payload = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": id
        });
        if let (Some(token), Some(obj)) = (auth, payload.as_object_mut()) {
            obj.insert("auth".to_string(), json!(token));
        }

        let http_resp = req.json(&payload).send().await?.error_for_status()?;
        let response: ZabbixApiResponse<T> = http_resp.json().await?;

        if let Some(err) = response.error {
            let err_msg = match err.data {
                Some(data) => format!("{} {}: {} ({})", err_prefix, err.code, err.message, data),
                None => format!("{} {}: {}", err_prefix, err.code, err.message),
            };
            return Err(err_msg.into());
        }

        response
            .result
            .ok_or_else(|| format!("Empty result from Zabbix {}", method).into())
    }

    pub async fn login(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(ref api_key) = self.api_key {
            let api_key = api_key.clone();
            self.auth_token = Some(api_key.clone());
            let result: Result<serde_json::Value, Box<dyn std::error::Error>> = self
                .post_rpc(
                    "trigger.get",
                    json!({
                        "output": "triggerid",
                        "limit": 1
                    }),
                    Some(&api_key),
                    1,
                    "Zabbix API Key Error",
                )
                .await;
            if let Err(err) = result {
                self.auth_token = None;
                return Err(err);
            }
            return Ok(());
        }

        let token: String = self
            .post_rpc(
                "user.login",
                json!({
                    "username": self.user,
                    "password": self.pass
                }),
                None,
                1,
                "Zabbix Error",
            )
            .await?;

        self.auth_token = Some(token);
        Ok(())
    }

    pub async fn get_triggers(&self) -> Result<Vec<ZabbixTrigger>, Box<dyn std::error::Error>> {
        let token = self.auth_token.as_ref().ok_or("Not logged in")?;

        let mut triggers: Vec<ZabbixTrigger> = self
            .post_rpc(
                "trigger.get",
                json!({
                    "output": "extend",
                    "monitored": true,
                    "skipDependent": true,
                    "expandComment": 1,
                    "expandExpression": 1,
                    "expandDescription": 1,
                    "selectHosts": ["host", "hostid", "maintenance_status"],
                    "sortfield": "lastchange",
                    "sortorder": "DESC",
                    "filter": {
                        "status": 0,
                        "value": 1,
                        "state": 0
                    }
                }),
                Some(token),
                2,
                "Zabbix Error",
            )
            .await?;

        if triggers.is_empty() {
            return Ok(triggers);
        }

        self.filter_maintenance_triggers(token, &mut triggers).await;

        for t in &mut triggers {
            if let Some(ref hosts) = t.hosts {
                if let Some(first_host) = hosts.first() {
                    t.hostname = Some(first_host.host_name.clone());
                }
            }
        }
        Ok(triggers)
    }

    /// Excludes triggers suppressed by maintenance periods, falling back to host status on error.
    async fn filter_maintenance_triggers(&self, token: &str, triggers: &mut Vec<ZabbixTrigger>) {
        // `trigger.get` has no parameter to exclude hosts in maintenance (`maintenance: false`
        // does not filter them out), and host-level checks alone miss tag-based maintenance.
        // Querying `problem.get` with `suppressed: false` matches Zabbix's active problem view.
        let trigger_ids: Vec<&str> = triggers.iter().map(|t| t.trigger_id.as_str()).collect();
        match self
            .post_rpc::<Vec<ZabbixProblem>>(
                "problem.get",
                json!({
                    "output": ["objectid"],
                    "source": 0,
                    "object": 0,
                    "objectids": trigger_ids,
                    "suppressed": false
                }),
                Some(token),
                3,
                "Zabbix Error",
            )
            .await
        {
            Ok(problems) => filter_triggers_by_unsuppressed_problems(triggers, problems),
            Err(err) => {
                // Fall back to host maintenance_status when `problem.get` or `suppressed` is
                // unavailable (e.g., Zabbix < 4.0 or restricted API user roles).
                log::warn!(
                    "Failed to query unsuppressed problems via problem.get ({}); falling back to host maintenance_status",
                    err
                );
                filter_triggers_by_host_maintenance(triggers);
            }
        }
    }
}

/// Retains only triggers that have at least one unsuppressed problem event.
fn filter_triggers_by_unsuppressed_problems(
    triggers: &mut Vec<ZabbixTrigger>,
    problems: Vec<ZabbixProblem>,
) {
    let unsuppressed_ids: HashSet<String> = problems.into_iter().map(|p| p.object_id).collect();
    triggers.retain(|t| unsuppressed_ids.contains(&t.trigger_id));
}

/// Fallback filter that removes triggers attached to any host currently in maintenance.
fn filter_triggers_by_host_maintenance(triggers: &mut Vec<ZabbixTrigger>) {
    triggers.retain(|t| {
        !t.hosts
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .any(|h| h.in_maintenance)
    });
}

pub struct ZabbixSessionStore {
    /// Thread-safe in-memory cache mapping server labels to active authentication tokens.
    tokens: std::sync::Mutex<std::collections::HashMap<String, String>>,
    /// Shared HTTP client reused across polls to keep TCP/TLS connection pools alive.
    http_client: reqwest::Client,
}

impl Default for ZabbixSessionStore {
    fn default() -> Self {
        Self {
            tokens: std::sync::Mutex::new(std::collections::HashMap::new()),
            http_client: build_http_client(),
        }
    }
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
        let mut client = ZabbixClient::from_server(server, self.http_client.clone());
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
        let mut client = ZabbixClient::from_server(server, self.http_client.clone());

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

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn make_trigger(id: &str, hosts: Option<Vec<ZabbixHost>>) -> ZabbixTrigger {
        ZabbixTrigger {
            trigger_id: id.to_string(),
            description: format!("Trigger {}", id),
            priority: "4".to_string(),
            value: "1".to_string(),
            last_change: "1700000000".to_string(),
            error: String::new(),
            url: String::new(),
            hostname: None,
            hosts,
            comments: String::new(),
            expression: String::new(),
        }
    }

    fn make_host(id: &str, name: &str, in_maintenance: bool) -> ZabbixHost {
        ZabbixHost {
            host_name: name.to_string(),
            host_id: id.to_string(),
            in_maintenance,
        }
    }

    #[test]
    fn test_host_maintenance_status_deserialization_and_serialization() {
        let host_in_maint: ZabbixHost =
            serde_json::from_str(r#"{"hostid":"1","host":"web-1","maintenance_status":"1"}"#)
                .unwrap();
        assert!(host_in_maint.in_maintenance);

        let host_in_maint_num: ZabbixHost =
            serde_json::from_str(r#"{"hostid":"2","host":"web-2","maintenance_status":1}"#)
                .unwrap();
        assert!(host_in_maint_num.in_maintenance);

        let host_in_maint_bool: ZabbixHost =
            serde_json::from_str(r#"{"hostid":"3","host":"web-3","maintenance_status":true}"#)
                .unwrap();
        assert!(host_in_maint_bool.in_maintenance);

        let host_normal: ZabbixHost =
            serde_json::from_str(r#"{"hostid":"4","host":"web-4","maintenance_status":"0"}"#)
                .unwrap();
        assert!(!host_normal.in_maintenance);

        let host_null: ZabbixHost =
            serde_json::from_str(r#"{"hostid":"5","host":"web-5","maintenance_status":null}"#)
                .unwrap();
        assert!(!host_null.in_maintenance);

        let host_missing: ZabbixHost =
            serde_json::from_str(r#"{"hostid":"6","host":"web-6"}"#).unwrap();
        assert!(!host_missing.in_maintenance);

        // `maintenance_status` must not be emitted to the frontend IPC payload.
        let serialized = serde_json::to_value(&host_in_maint).unwrap();
        assert_eq!(serialized, json!({"host": "web-1", "hostid": "1"}));
    }

    #[test]
    fn test_filter_triggers_by_unsuppressed_problems() {
        let mut triggers = vec![
            make_trigger("101", None),
            make_trigger("102", None),
            make_trigger("103", None),
        ];
        // Trigger 101 has multiple unsuppressed problems; 102 is suppressed; 103 is active.
        let problems = vec![
            ZabbixProblem {
                object_id: "101".to_string(),
            },
            ZabbixProblem {
                object_id: "101".to_string(),
            },
            ZabbixProblem {
                object_id: "103".to_string(),
            },
        ];

        filter_triggers_by_unsuppressed_problems(&mut triggers, problems);

        let ids: Vec<&str> = triggers.iter().map(|t| t.trigger_id.as_str()).collect();
        assert_eq!(ids, vec!["101", "103"]);
    }

    #[test]
    fn test_filter_triggers_by_host_maintenance_fallback() {
        let mut triggers = vec![
            make_trigger("201", Some(vec![make_host("1", "db-1", false)])),
            make_trigger("202", Some(vec![make_host("2", "db-2", true)])),
            make_trigger(
                "203",
                Some(vec![
                    make_host("3", "app-1", false),
                    make_host("4", "app-2", true),
                ]),
            ),
            make_trigger("204", None),
        ];

        filter_triggers_by_host_maintenance(&mut triggers);

        let ids: Vec<&str> = triggers.iter().map(|t| t.trigger_id.as_str()).collect();
        assert_eq!(ids, vec!["201", "204"]);
    }

    async fn read_http_request_body(socket: &mut tokio::net::TcpStream) -> serde_json::Value {
        let mut buf = Vec::new();
        let mut tmp = [0u8; 4096];
        let header_end = loop {
            let n = socket.read(&mut tmp).await.unwrap();
            assert!(n > 0, "unexpected EOF reading HTTP request");
            buf.extend_from_slice(&tmp[..n]);
            if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                break pos + 4;
            }
        };

        let headers = String::from_utf8_lossy(&buf[..header_end]);
        let content_length: usize = headers
            .lines()
            .find_map(|line| {
                let (name, val) = line.split_once(':')?;
                if name.eq_ignore_ascii_case("content-length") {
                    val.trim().parse().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0);

        while buf.len() < header_end + content_length {
            let n = socket.read(&mut tmp).await.unwrap();
            assert!(n > 0, "unexpected EOF reading HTTP body");
            buf.extend_from_slice(&tmp[..n]);
        }

        serde_json::from_slice(&buf[header_end..header_end + content_length]).unwrap()
    }

    async fn spawn_mock_zabbix<F>(
        expected_requests: usize,
        handler: F,
    ) -> (String, tokio::task::JoinHandle<Vec<serde_json::Value>>)
    where
        F: Fn(&serde_json::Value) -> (u16, String) + Send + Sync + 'static,
    {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            let mut recorded = Vec::new();
            let timeout = std::time::Duration::from_secs(5);
            for _ in 0..expected_requests {
                let (mut socket, _) = tokio::time::timeout(timeout, listener.accept())
                    .await
                    .expect("mock Zabbix server timed out waiting for connection")
                    .unwrap();
                let req_json = tokio::time::timeout(timeout, read_http_request_body(&mut socket))
                    .await
                    .expect("mock Zabbix server timed out reading request");
                let (status_code, body) = handler(&req_json);
                recorded.push(req_json);

                let status_text = match status_code {
                    200 => "OK",
                    502 => "Bad Gateway",
                    _ => "Error",
                };
                let content_type = if status_code == 200 {
                    "application/json"
                } else {
                    "text/html"
                };
                let http_resp = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status_code,
                    status_text,
                    content_type,
                    body.len(),
                    body
                );
                socket.write_all(http_resp.as_bytes()).await.unwrap();
            }
            recorded
        });
        (format!("http://{}", addr), handle)
    }

    fn test_client(host: &str) -> ZabbixClient {
        let http = reqwest::Client::builder().no_proxy().build().unwrap();
        let mut client =
            ZabbixClient::with_http_client(host, "Admin", "zabbix", None, None, None, http);
        client.auth_token = Some("test-token".to_string());
        client
    }

    #[tokio::test]
    async fn test_get_triggers_excludes_maintenance_suppressed_events() {
        let (base_url, server_task) = spawn_mock_zabbix(2, |req| {
            let payload = match req["method"].as_str().unwrap() {
                "trigger.get" => json!({
                    "jsonrpc": "2.0",
                    "result": [
                        {
                            "triggerid": "10",
                            "description": "High CPU on active host",
                            "priority": "4",
                            "value": "1",
                            "lastchange": "1700000100",
                            "error": "",
                            "url": "",
                            "hosts": [{"hostid": "1", "host": "active-host", "maintenance_status": "0"}],
                            "comments": "",
                            "expression": ""
                        },
                        {
                            "triggerid": "20",
                            "description": "Disk full on maintenance host",
                            "priority": "5",
                            "value": "1",
                            "lastchange": "1700000200",
                            "error": "",
                            "url": "",
                            "hosts": [{"hostid": "2", "host": "maint-host", "maintenance_status": "1"}],
                            "comments": "",
                            "expression": ""
                        },
                        {
                            "triggerid": "30",
                            "description": "Unmatched tag problem on tag-maint host",
                            "priority": "3",
                            "value": "1",
                            "lastchange": "1700000300",
                            "error": "",
                            "url": "",
                            "hosts": [{"hostid": "3", "host": "tag-maint-host", "maintenance_status": "1"}],
                            "comments": "",
                            "expression": ""
                        }
                    ],
                    "id": req["id"]
                }),
                "problem.get" => json!({
                    "jsonrpc": "2.0",
                    "result": [
                        {"eventid": "1001", "objectid": "10"},
                        {"eventid": "1003", "objectid": "30"}
                    ],
                    "id": req["id"]
                }),
                other => panic!("Unexpected RPC method: {}", other),
            };
            (200, payload.to_string())
        })
        .await;

        let client = test_client(&base_url);
        let triggers = client.get_triggers().await.unwrap();

        let ids: Vec<&str> = triggers.iter().map(|t| t.trigger_id.as_str()).collect();
        assert_eq!(ids, vec!["10", "30"]);
        assert_eq!(triggers[0].hostname.as_deref(), Some("active-host"));
        assert_eq!(triggers[1].hostname.as_deref(), Some("tag-maint-host"));

        let requests = server_task.await.unwrap();
        assert_eq!(requests[1]["method"], "problem.get");
        assert_eq!(requests[1]["params"]["suppressed"], false);
        assert_eq!(
            requests[1]["params"]["objectids"],
            json!(["10", "20", "30"])
        );
    }

    #[tokio::test]
    async fn test_get_triggers_skips_problem_get_when_no_triggers() {
        let (base_url, server_task) = spawn_mock_zabbix(1, |req| {
            assert_eq!(req["method"], "trigger.get");
            (
                200,
                json!({
                    "jsonrpc": "2.0",
                    "result": [],
                    "id": req["id"]
                })
                .to_string(),
            )
        })
        .await;

        let client = test_client(&base_url);
        let triggers = client.get_triggers().await.unwrap();

        assert!(triggers.is_empty());
        let requests = server_task.await.unwrap();
        assert_eq!(requests.len(), 1);
    }

    #[tokio::test]
    async fn test_get_triggers_falls_back_when_problem_get_fails() {
        let (base_url, server_task) = spawn_mock_zabbix(2, |req| {
            let payload = match req["method"].as_str().unwrap() {
                "trigger.get" => json!({
                    "jsonrpc": "2.0",
                    "result": [
                        {
                            "triggerid": "10",
                            "description": "Active trigger",
                            "priority": "2",
                            "value": "1",
                            "lastchange": "1700000100",
                            "error": "",
                            "url": "",
                            "hosts": [{"hostid": "1", "host": "active-host", "maintenance_status": "0"}],
                            "comments": "",
                            "expression": ""
                        },
                        {
                            "triggerid": "20",
                            "description": "Maint trigger",
                            "priority": "4",
                            "value": "1",
                            "lastchange": "1700000200",
                            "error": "",
                            "url": "",
                            "hosts": [{"hostid": "2", "host": "maint-host", "maintenance_status": "1"}],
                            "comments": "",
                            "expression": ""
                        }
                    ],
                    "id": req["id"]
                }),
                "problem.get" => json!({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32602,
                        "message": "Invalid params.",
                        "data": "Unexpected parameter \"suppressed\"."
                    },
                    "id": req["id"]
                }),
                other => panic!("Unexpected RPC method: {}", other),
            };
            (200, payload.to_string())
        })
        .await;

        let client = test_client(&base_url);
        let triggers = client.get_triggers().await.unwrap();

        assert_eq!(triggers.len(), 1);
        assert_eq!(triggers[0].trigger_id, "10");
        assert_eq!(triggers[0].hostname.as_deref(), Some("active-host"));
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn test_get_triggers_surfaces_http_error_status() {
        let (base_url, server_task) =
            spawn_mock_zabbix(1, |_req| (502, "<html>Bad Gateway</html>".to_string())).await;

        let client = test_client(&base_url);
        let err = client.get_triggers().await.unwrap_err().to_string();

        assert!(
            err.contains("502"),
            "expected HTTP status 502 in error, got: {}",
            err
        );
        server_task.await.unwrap();
    }
}
