mod commands;
mod config;
mod zabbix;

use tauri::generate_handler;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

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

#[derive(Debug, Clone, Copy)]
pub(crate) enum TrayMenuState {
    Normal,
    UpdateAvailable,
    RelaunchPending,
}

pub(crate) fn set_tray_menu(
    app: &tauri::AppHandle,
    state: TrayMenuState,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};

    let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let check_update_i =
        MenuItem::with_id(app, "check_update", "Check for Updates", true, None::<&str>)?;
    let install_update_i =
        MenuItem::with_id(app, "install_update", "Install Update", true, None::<&str>)?;
    let relaunch_i = MenuItem::with_id(app, "relaunch", "Relaunch", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = vec![&show_i, &sep1];

    match state {
        TrayMenuState::Normal => {
            menu_items.push(&check_update_i);
        }
        TrayMenuState::UpdateAvailable => {
            menu_items.push(&install_update_i);
        }
        TrayMenuState::RelaunchPending => {
            menu_items.push(&relaunch_i);
        }
    }

    menu_items.push(&sep2);
    menu_items.push(&quit_i);

    let menu = Menu::with_items(app, &menu_items)?;

    if let Some(tray) = app.tray_by_id("main_tray") {
        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

fn setup_system_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Set up initial system tray menu items (Normal state)
    let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let check_update_i =
        MenuItem::with_id(app, "check_update", "Check for Updates", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_i,
            &PredefinedMenuItem::separator(app)?,
            &check_update_i,
            &PredefinedMenuItem::separator(app)?,
            &quit_i,
        ],
    )?;

    // Build system tray icon
    let mut tray_builder = TrayIconBuilder::with_id("main_tray")
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
                let _ = app.save_window_state(StateFlags::all());
                for window in app.webview_windows().values() {
                    let _ = window.destroy();
                }
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = set_window_visibility(&window, true);
                }
            }
            "check_update" => {
                if let Some(update_win) = app.get_webview_window("update") {
                    let _ = update_win.show();
                    let _ = update_win.set_focus();
                    let _ = update_win.emit("trigger-check", ());
                }
            }
            "install_update" => {
                if let Some(update_win) = app.get_webview_window("update") {
                    let _ = update_win.show();
                    let _ = update_win.set_focus();
                    let _ = update_win.emit("trigger-check", ());
                }
            }
            "relaunch" => {
                let _ = app.save_window_state(StateFlags::all());
                app.restart();
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let context = tauri::generate_context!();
    let product_name = context
        .config()
        .product_name
        .as_deref()
        .unwrap_or("zabbix-gadget");

    // Initialize config immediately on startup
    if let Err(e) = config::init_config(product_name) {
        log::error!("Failed to initialize config: {}", e);
    }

    tauri::Builder::default()
        .manage(zabbix::ZabbixSessionStore::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                let _ = window.emit("window-visibility", false);
                api.prevent_close();
            }
        })
        .setup(|app| {
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
            commands::check_for_update,
            commands::install_update,
            commands::relaunch_app,
        ])
        .run(context)
        .expect("error while running tauri application");
}
