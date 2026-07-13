# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
