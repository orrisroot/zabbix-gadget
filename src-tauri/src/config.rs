use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub label: String,
    pub host: String,
    #[serde(default)]
    pub user: String,
    #[serde(default)]
    pub pass: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub basic_auth_user: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub basic_auth_pass: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub refresh_interval_seconds: u64,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_theme() -> String {
    "system".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub servers: Vec<ServerConfig>,
    pub settings: AppSettings,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            servers: vec![],
            settings: AppSettings {
                refresh_interval_seconds: 300,
                theme: "system".to_string(),
            },
        }
    }
}

static CONFIG_PATH: OnceLock<PathBuf> = OnceLock::new();
static CONFIG_DIR: OnceLock<PathBuf> = OnceLock::new();
static INIT_ERROR: OnceLock<Option<String>> = OnceLock::new();

pub fn get_config_dir() -> PathBuf {
    CONFIG_DIR
        .get()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn get_config_path() -> PathBuf {
    CONFIG_PATH
        .get()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("zabbix.toml"))
}

#[cfg(unix)]
fn secure_permissions(path: &std::path::Path, mode: u32) -> Result<(), Box<dyn std::error::Error>> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path)?.permissions();
    // Only apply permissions if they differ to avoid redundant syscalls
    if perms.mode() & 0o777 != mode {
        perms.set_mode(mode);
        fs::set_permissions(path, perms)?;
    }
    Ok(())
}

#[cfg(not(unix))]
fn secure_permissions(
    _path: &std::path::Path,
    _mode: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

fn get_system_config_dir() -> Option<PathBuf> {
    if let Some(path) = dirs::config_dir() {
        return Some(path);
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        return Some(PathBuf::from(appdata));
    }
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        return Some(PathBuf::from(userprofile).join("AppData").join("Roaming"));
    }
    None
}

pub fn init_config(product_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = get_system_config_dir()
        .ok_or_else(|| "Failed to get user config directory".to_string())?
        .join(product_name);
    let config_path = config_dir.join("zabbix.toml");

    let _ = CONFIG_DIR.set(config_dir.clone());
    let _ = CONFIG_PATH.set(config_path.clone());

    let result = init_config_inner(&config_dir, &config_path);
    if let Err(ref e) = result {
        let _ = INIT_ERROR.set(Some(e.to_string()));
    } else {
        let _ = INIT_ERROR.set(None);
    }
    result
}

fn init_config_inner(
    config_dir: &PathBuf,
    config_path: &PathBuf,
) -> Result<(), Box<dyn std::error::Error>> {
    // Create config directory if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(config_dir)?;
    }
    // Restrict access to the configuration directory to prevent other users on the system
    // from reading its contents or listing configuration files.
    secure_permissions(config_dir, 0o700)?;

    // Create default config file if it doesn't exist
    if !config_path.exists() {
        let default_config = AppConfig::default();
        let toml_string = toml::to_string_pretty(&default_config)?;
        fs::write(config_path, toml_string)?;
    }
    // Restrict access to the configuration file since it contains credentials (passwords).
    secure_permissions(config_path, 0o600)?;

    Ok(())
}

pub fn load_config() -> Result<AppConfig, Box<dyn std::error::Error>> {
    if let Some(Some(err)) = INIT_ERROR.get() {
        return Err(format!("Config initialization failed: {}", err).into());
    }
    let config_path = get_config_path();
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            let config: AppConfig = toml::from_str(&content)?;
            Ok(config)
        }
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Return default config gracefully if file does not exist (e.g. first boot)
            Ok(AppConfig::default())
        }
        Err(e) => Err(e.into()),
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), Box<dyn std::error::Error>> {
    let config_path = get_config_path();
    let toml_string = toml::to_string_pretty(config)?;
    fs::write(&config_path, toml_string)?;
    // Ensure the config file permissions are restricted to owner-only read/write
    // to protect sensitive credentials (passwords).
    secure_permissions(&config_path, 0o600)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_theme_serialization() {
        let toml_content = r#"
            [[servers]]
            label = "Test"
            host = "http://localhost"
            user = "Admin"
            pass = "zabbix"

            [settings]
            refresh_interval_seconds = 120
        "#;

        // Deserializing TOML without theme should default to "system"
        let config: AppConfig = toml::from_str(toml_content).unwrap();
        assert_eq!(config.settings.theme, "system");
        assert_eq!(config.settings.refresh_interval_seconds, 120);

        // Serializing back to TOML should include theme
        let serialized = toml::to_string_pretty(&config).unwrap();
        assert!(serialized.contains("theme = 'system'") || serialized.contains("theme = \"system\""));

        // Deserializing with theme light
        let toml_with_light = r#"
            [[servers]]
            label = "Test"
            host = "http://localhost"
            user = "Admin"
            pass = "zabbix"

            [settings]
            refresh_interval_seconds = 120
            theme = "light"
        "#;
        let config_light: AppConfig = toml::from_str(toml_with_light).unwrap();
        assert_eq!(config_light.settings.theme, "light");
    }

    #[test]
    fn test_config_basic_auth_serialization() {
        let toml_content = r#"
            [[servers]]
            label = "Test"
            host = "http://localhost"
            user = "Admin"
            pass = "zabbix"
            basic_auth_user = "basic_user"
            basic_auth_pass = "basic_pass"

            [settings]
            refresh_interval_seconds = 120
        "#;

        let config: AppConfig = toml::from_str(toml_content).unwrap();
        assert_eq!(
            config.servers[0].basic_auth_user.as_deref(),
            Some("basic_user")
        );
        assert_eq!(
            config.servers[0].basic_auth_pass.as_deref(),
            Some("basic_pass")
        );

        // Serialization should include basic auth
        let serialized = toml::to_string_pretty(&config).unwrap();
        assert!(
            serialized.contains("basic_auth_user = \"basic_user\"")
                || serialized.contains("basic_auth_user = 'basic_user'")
        );

        // Serialization should NOT include basic auth if None
        let config_no_auth = AppConfig {
            servers: vec![ServerConfig {
                label: "NoAuth".to_string(),
                host: "http://localhost".to_string(),
                user: "Admin".to_string(),
                pass: "zabbix".to_string(),
                api_key: None,
                basic_auth_user: None,
                basic_auth_pass: None,
            }],
            settings: crate::config::AppSettings {
                refresh_interval_seconds: 120,
                theme: "dark".to_string(),
            },
        };
        let serialized_no_auth = toml::to_string_pretty(&config_no_auth).unwrap();
        assert!(!serialized_no_auth.contains("basic_auth_user"));
    }

    #[test]
    #[cfg(unix)]
    fn test_secure_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let unique_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("zabbix-gadget-test-{}", unique_id));
        fs::create_dir_all(&temp_dir).unwrap();

        // 1. Verify directory permission is secured to 0o700
        secure_permissions(&temp_dir, 0o700).unwrap();
        let dir_perms = fs::metadata(&temp_dir).unwrap().permissions();
        assert_eq!(dir_perms.mode() & 0o777, 0o700);

        // 2. Verify file permission is secured to 0o600
        let test_file = temp_dir.join("zabbix.toml");
        fs::write(&test_file, "test").unwrap();
        secure_permissions(&test_file, 0o600).unwrap();
        let file_perms = fs::metadata(&test_file).unwrap().permissions();
        assert_eq!(file_perms.mode() & 0o777, 0o600);

        // Clean up
        fs::remove_dir_all(&temp_dir).unwrap();
    }
}
