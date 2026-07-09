mod commands;
mod config;
mod zabbix;

use tauri::generate_handler;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
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

fn setup_system_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Set up system tray menu items
    let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let check_update_i =
        MenuItem::with_id(app, "check_update", "Check for Updates", true, None::<&str>)?;
    let install_update_i =
        MenuItem::with_id(app, "install_update", "Install Update", true, None::<&str>)?;
    let relaunch_i = MenuItem::with_id(app, "relaunch", "Relaunch", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_i,
            &PredefinedMenuItem::separator(app)?,
            &check_update_i,
            &install_update_i,
            &relaunch_i,
            &PredefinedMenuItem::separator(app)?,
            &quit_i,
        ],
    )?;

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
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    check_and_prompt_update(&app_handle).await;
                });
            }
            "install_update" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    perform_update_immediately(&app_handle).await;
                });
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
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug")).init();

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
        ])
        .run(context)
        .expect("error while running tauri application");
}

async fn check_and_prompt_update(app: &tauri::AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let message = format!(
                        "A new version v{} is available (current version: v{}).\nDo you want to download and install it now?",
                        update.version,
                        app.package_info().version
                    );
                let confirmed = app
                    .dialog()
                    .message(message)
                    .title("Update Available")
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::YesNo)
                    .blocking_show();

                if confirmed {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                            app_handle
                                .dialog()
                                .message(format!("Failed to install update: {}", e))
                                .title("Update Error")
                                .kind(MessageDialogKind::Error)
                                .show(|_| {});
                        } else {
                            app_handle.dialog()
                                    .message("Update installed successfully. The application will now restart.")
                                    .title("Update Success")
                                    .kind(MessageDialogKind::Info)
                                    .show(|_| {});
                            let _ = app_handle.save_window_state(StateFlags::all());
                            app_handle.restart();
                        }
                    });
                }
            }
            Ok(None) => {
                app.dialog()
                    .message(format!(
                        "You are up to date! Current version is v{}.",
                        app.package_info().version
                    ))
                    .title("Up to Date")
                    .kind(MessageDialogKind::Info)
                    .show(|_| {});
            }
            Err(e) => {
                app.dialog()
                    .message(format!("Failed to check for updates:\n{}", e))
                    .title("Update Error")
                    .kind(MessageDialogKind::Error)
                    .show(|_| {});
            }
        },
        Err(e) => {
            app.dialog()
                .message(format!("Updater not available:\n{}", e))
                .title("Update Error")
                .kind(MessageDialogKind::Error)
                .show(|_| {});
        }
    }
}

async fn perform_update_immediately(app: &tauri::AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                if let Err(e) = update.download_and_install(|_, _| {}, || {}).await {
                    app.dialog()
                        .message(format!("Failed to install update: {}", e))
                        .title("Update Error")
                        .kind(MessageDialogKind::Error)
                        .show(|_| {});
                } else {
                    app.dialog()
                        .message("Update installed successfully. The application will now restart.")
                        .title("Update Success")
                        .kind(MessageDialogKind::Info)
                        .show(|_| {});
                    let _ = app.save_window_state(StateFlags::all());
                    app.restart();
                }
            }
            Ok(None) => {
                app.dialog()
                    .message("No updates available.")
                    .title("Up to Date")
                    .kind(MessageDialogKind::Info)
                    .show(|_| {});
            }
            Err(e) => {
                app.dialog()
                    .message(format!("Failed to check for updates:\n{}", e))
                    .title("Update Error")
                    .kind(MessageDialogKind::Error)
                    .show(|_| {});
            }
        },
        Err(e) => {
            app.dialog()
                .message(format!("Updater not available:\n{}", e))
                .title("Update Error")
                .kind(MessageDialogKind::Error)
                .show(|_| {});
        }
    }
}
