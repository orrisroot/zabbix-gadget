#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
#[link(name = "webkit2gtk-4.1")]
extern "C" {
    fn webkit_get_major_version() -> u32;
    fn webkit_get_minor_version() -> u32;
}

#[cfg(target_os = "linux")]
fn select_dmabuf_workaround_env(webkit_version: (u32, u32)) -> &'static str {
    // WebKitGTK 2.44+ supports WEBKIT_DMABUF_RENDERER_FORCE_SHM, which bypasses broken
    // NVIDIA/GBM buffer imports while keeping AcceleratedBackingStore valid. Setting
    // WEBKIT_DISABLE_DMABUF_RENDERER=1 on WebKitGTK 2.52/2.54+ breaks transparent windows.
    if webkit_version >= (2, 44) {
        "WEBKIT_DMABUF_RENDERER_FORCE_SHM"
    } else {
        "WEBKIT_DISABLE_DMABUF_RENDERER"
    }
}

#[cfg(target_os = "linux")]
fn configure_webkit_dmabuf_workaround() {
    // Respect explicit user overrides before applying the default WebKitGTK workaround.
    if std::env::var_os("WEBKIT_DMABUF_RENDERER_FORCE_SHM").is_some()
        || std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_some()
    {
        return;
    }

    // SAFETY: webkit_get_{major,minor}_version return WebKitGTK library version numbers
    // and require no GTK initialization.
    let webkit_version = unsafe { (webkit_get_major_version(), webkit_get_minor_version()) };
    std::env::set_var(select_dmabuf_workaround_env(webkit_version), "1");
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_webkit_dmabuf_workaround();

    zabbix_gadget_lib::run();
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;

    #[test]
    fn test_select_dmabuf_workaround_env() {
        assert_eq!(
            select_dmabuf_workaround_env((2, 42)),
            "WEBKIT_DISABLE_DMABUF_RENDERER"
        );
        assert_eq!(
            select_dmabuf_workaround_env((2, 44)),
            "WEBKIT_DMABUF_RENDERER_FORCE_SHM"
        );
        assert_eq!(
            select_dmabuf_workaround_env((2, 54)),
            "WEBKIT_DMABUF_RENDERER_FORCE_SHM"
        );
    }

    #[test]
    fn test_webkit_version_is_readable() {
        let (major, minor) = unsafe { (webkit_get_major_version(), webkit_get_minor_version()) };
        assert!(major >= 2, "unexpected WebKitGTK major version: {}", major);
        assert!(minor > 0, "unexpected WebKitGTK minor version: {}", minor);
    }
}
