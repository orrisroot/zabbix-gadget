mod commands;
mod config;
mod zabbix;

use tauri::generate_handler;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

fn set_window_visibility(window: &tauri::WebviewWindow, visible: bool) -> Result<(), tauri::Error> {
    if visible {
        window.show()?;
        window.set_focus()?;
    } else {
        window.hide()?;
    }
    let _ = window.emit("window-visibility", visible);
    Ok(())
}

fn setup_system_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Set up system tray menu items
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    // Build system tray icon
    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false);

    if let Some(icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(icon);
    }

    let _tray = tray_builder
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    let _ = set_window_visibility(&window, !is_visible);
                }
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = set_window_visibility(&window, true);
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug")).init();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                let _ = window.emit("window-visibility", false);
                api.prevent_close();
            }
        })
        .setup(|app| {
            if let Err(e) = config::init_config(app) {
                log::error!("Failed to initialize config: {}", e);
            }
            setup_system_tray(app)?;
            Ok(())
        })
        .invoke_handler(generate_handler![
            commands::get_config,
            commands::save_config,
            commands::fetch_triggers,
            commands::login,
            commands::get_config_dir,
            commands::close_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
