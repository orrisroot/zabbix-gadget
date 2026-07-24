use tauri::{Emitter, Manager};

#[tauri::command]
pub fn close_app(app_handle: tauri::AppHandle) {
    log::info!("Hiding main window instead of exiting...");
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        let _ = window.emit("window-visibility", false);
    }
}
