use tauri::{Emitter, Manager};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

#[tauri::command]
pub fn close_app(app_handle: tauri::AppHandle) {
    log::info!("Hiding main window instead of exiting...");
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        let _ = window.emit("window-visibility", false);
    }
}

#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) {
    log::info!("Toggling devtools for window: {}", window.label());
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}

#[tauri::command]
pub fn quit_app(app_handle: tauri::AppHandle) {
    log::info!("Quitting application via menu...");
    let _ = app_handle.save_window_state(StateFlags::all());
    for window in app_handle.webview_windows().values() {
        let _ = window.destroy();
    }
    app_handle.exit(0);
}

#[tauri::command]
pub fn is_always_on_top() -> bool {
    crate::get_always_on_top_state()
}

#[tauri::command]
pub fn toggle_always_on_top(app_handle: tauri::AppHandle) -> bool {
    crate::toggle_always_on_top_action(&app_handle)
}
