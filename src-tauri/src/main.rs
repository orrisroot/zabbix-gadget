#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Disable DMABUF renderer for WebKitGTK on NVIDIA to avoid rendering issues on X11 based systems
        // Reference: https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/Debug/linux-graphics.md
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    zabbix_gadget_lib::run();
}
