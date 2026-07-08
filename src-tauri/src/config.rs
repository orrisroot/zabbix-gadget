use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::App;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub label: String,
    pub host: String,
    pub user: String,
    pub pass: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub refresh_interval_seconds: u64,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_theme() -> String {
    "dark".to_string()
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
                theme: "dark".to_string(),
            },
        }
    }
}

static CONFIG_PATH: OnceLock<PathBuf> = OnceLock::new();
static CONFIG_DIR: OnceLock<PathBuf> = OnceLock::new();

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

pub fn init_config(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = app.path().config_dir()?.join("zabbix-gadget");
    let config_path = config_dir.join("zabbix.toml");

    let _ = CONFIG_DIR.set(config_dir.clone());
    let _ = CONFIG_PATH.set(config_path.clone());

    // Create config directory if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
    }

    // Create default config file if it doesn't exist
    if !config_path.exists() {
        let default_config = AppConfig::default();
        let toml_string = toml::to_string_pretty(&default_config)?;
        fs::write(&config_path, toml_string)?;
    }

    Ok(())
}

pub fn load_config() -> Result<AppConfig, Box<dyn std::error::Error>> {
    let config_path = get_config_path();
    let content = fs::read_to_string(&config_path)?;
    let config: AppConfig = toml::from_str(&content)?;
    Ok(config)
}

pub fn save_config(config: &AppConfig) -> Result<(), Box<dyn std::error::Error>> {
    let config_path = get_config_path();
    let toml_string = toml::to_string_pretty(config)?;
    fs::write(&config_path, toml_string)?;
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

        // Deserializing TOML without theme should default to "dark"
        let config: AppConfig = toml::from_str(toml_content).unwrap();
        assert_eq!(config.settings.theme, "dark");
        assert_eq!(config.settings.refresh_interval_seconds, 120);

        // Serializing back to TOML should include theme
        let serialized = toml::to_string_pretty(&config).unwrap();
        assert!(serialized.contains("theme = 'dark'") || serialized.contains("theme = \"dark\""));

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
}
