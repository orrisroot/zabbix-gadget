# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-07-25

### Added
- **Theme Selection**: Add visual theme selection (System, Dark, Light) in settings UI, defaulting to System theme mode.
- **About Window**: Add an independent "About" window accessible from the main UI.
- **Always-on-Top & Modals**: Enforce always-on-top behavior for modal dialogs and support toggling visibility via system tray.
- **Server Name in Tooltip**: Display target server label in the hover tooltip footer.

### Changed
- **UI Consistency**: Standardize panel headers and window styling across modal dialogs.
- **IPC & Architecture**: Modularize backend command structure, strengthen IPC boundary security, optimize configuration caching, and prevent duplicate application launches.

### Fixed
- **Linux Graphics Compatibility**: Work around `EGL_BAD_PARAMETER` error on Linux systems with Intel iGPUs.
- **Updater Status Handling**: Fix update check result parsing, download progress calculation, and display current app version in status messages.

## [0.1.2] - 2026-07-22

### Added
- **Host URL Validation**: Add URL format validation for Zabbix server targets in the connection editor to prevent invalid inputs.

### Changed
- **Window Styling**: Enable transparent window backgrounds, adjust to more compact layouts and sizes across all windows, and enforce dynamic height auto-fitting to prevent layout gaps.
- **Tauri Permissions**: Refine and restrict window capabilities by disabling minimize, maximize, and manual resize operations.

### Fixed
- **Connection Reordering**: Fix drag-and-drop connection target reordering.
- **Tooltip Auto-Close**: Resolve premature closing of hover tooltips during window transitions.

## [0.1.1] - 2026-07-13

### Added
- **Connection Target Editor**: Add a connection edit panel (`connection-edit` window) for configuring and testing Zabbix server targets directly from the UI.
- **Trigger Deduplication**: Automatically skip redundant lower-severity triggers when a higher-severity dependent trigger is active using Zabbix's built-in dependency resolution (`skipDependent: true`).
- **Custom Update Dialog**: Implement a custom software update interface matching the app theme.
- **System Tray Settings Menu**: Add a "Settings" option to the system tray context menu.

### Changed
- **Window State & Sizing**: Optimize size auto-restoration and center dialog window positioning.
- **Codebase Refactoring**: Unify component granularity, extract custom React hooks for Tauri APIs, and integrate Biome for linting/formatting.
- **Dependencies**: Update Cargo and npm dependencies.

## [0.1.0] - 2026-07-10

- Initial release of Zabbix Desktop Gadget.
