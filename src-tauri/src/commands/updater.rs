use tauri::Emitter;

#[derive(serde::Serialize, Clone)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateCheckResult {
    NoUpdate,
    #[serde(rename_all = "camelCase")]
    Available {
        current_version: String,
        new_version: String,
        body: Option<String>,
    },
    Error {
        message: String,
    },
}

#[derive(serde::Serialize, Clone)]
struct ProgressPayload {
    downloaded: usize,
    total_len: Option<u64>,
}

#[tauri::command]
pub async fn check_for_update(app_handle: tauri::AppHandle) -> Result<UpdateCheckResult, String> {
    use tauri_plugin_updater::UpdaterExt;
    match app_handle.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::UpdateAvailable);
                Ok(UpdateCheckResult::Available {
                    current_version: app_handle.package_info().version.to_string(),
                    new_version: update.version.to_string(),
                    body: update.body.clone(),
                })
            }
            Ok(None) => {
                let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::Normal);
                Ok(UpdateCheckResult::NoUpdate)
            }
            Err(e) => {
                use tauri_plugin_updater::Error as UpdaterError;
                let is_not_found = match &e {
                    UpdaterError::ReleaseNotFound => true,
                    UpdaterError::Reqwest(reqwest_err) => {
                        reqwest_err.status() == Some(reqwest::StatusCode::NOT_FOUND)
                    }
                    _ => false,
                };

                if is_not_found {
                    let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::Normal);
                    Ok(UpdateCheckResult::NoUpdate)
                } else {
                    Ok(UpdateCheckResult::Error {
                        message: e.to_string(),
                    })
                }
            }
        },
        Err(e) => Ok(UpdateCheckResult::Error {
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub async fn install_update(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    match app_handle.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let app_clone = app_handle.clone();
                let _ = crate::set_tray_menu(&app_clone, crate::TrayMenuState::UpdateAvailable);

                let progress_app = app_handle.clone();
                let mut downloaded = 0;
                let mut last_total_len: Option<u64> = None;

                if let Err(e) = update
                    .download_and_install(
                        move |chunk_len, total_len| {
                            if total_len != last_total_len {
                                last_total_len = total_len;
                                downloaded = 0;
                            }
                            downloaded += chunk_len;
                            let _ = progress_app.emit(
                                "update-progress",
                                ProgressPayload {
                                    downloaded,
                                    total_len,
                                },
                            );
                        },
                        move || {
                            // Finished download
                        },
                    )
                    .await
                {
                    return Err(e.to_string());
                }

                let _ = crate::set_tray_menu(&app_handle, crate::TrayMenuState::RelaunchPending);
                Ok(())
            }
            Ok(None) => Err("No update available".to_string()),
            Err(e) => Err(e.to_string()),
        },
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn relaunch_app(app_handle: tauri::AppHandle) {
    app_handle.restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_check_result_serialization() {
        let res = UpdateCheckResult::Available {
            current_version: "0.1.2".to_string(),
            new_version: "0.1.3".to_string(),
            body: Some("Release notes".to_string()),
        };
        let json = serde_json::to_string(&res).unwrap();
        println!("SERDE_JSON_OUTPUT: {}", json);
    }
}
