# Zabbix Desktop Gadget

A modern desktop gadget for monitoring Zabbix server triggers, built with **Tauri v2 + React + TypeScript**.

## Features

- **Real-time trigger monitoring**: Displays active triggers classified by severity level
- **Trigger deduplication**: Filters out redundant lower-severity triggers using Zabbix dependencies (`skipDependent: true`)
- **Multi-server support**: Monitors multiple Zabbix servers simultaneously
- **Color-coded status**: Distinguishes 6 severity levels with distinct status colors
- **Hover tooltips**: Shows detailed trigger information on hover
- **Auto-refresh**: Automatically updates triggers at a configurable interval (default: 5 minutes)
- **Frameless window**: Provides an always-on-top window with state restoration for position and size
- **System Tray support**: Runs in the background with tray menu actions for updates and visibility
- **Settings UI**: Offers interactive configuration including drag-and-drop server reordering
- **Lightweight footprint**: Runs with minimal resource usage powered by Tauri v2

## Prerequisites

- Node.js 22+ (Active LTS)
- Rust 1.77.2+ (stable)
- System dependencies for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Installation

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Configuration

The configuration can be modified directly within the application using the **Settings UI** (accessible via the gear icon in the header or the system tray menu). Alternatively, you can configure it manually by creating or editing a configuration file at the following path depending on your operating system:

- **Linux**: `~/.config/zabbix-gadget/zabbix.toml`
- **macOS**: `~/Library/Application Support/zabbix-gadget/zabbix.toml`
- **Windows**: `%APPDATA%\zabbix-gadget\zabbix.toml` (typically `C:\Users\<User>\AppData\Roaming\zabbix-gadget\zabbix.toml`)

```toml
# Authentication using API Key (Default / Recommended)
[[servers]]
label = "Production (API Key)"
host = "https://zabbix.example.com/"
api_key = "your_zabbix_api_key"

# Or authentication using User/Password
[[servers]]
label = "Production (User/Pass)"
host = "https://zabbix.example.com/"
user = "Admin"
pass = "your_password"
# Optional HTTP Basic Authentication if Zabbix is behind a basic auth proxy
basic_auth_user = "proxy_user"
basic_auth_pass = "proxy_pass"

[settings]
refresh_interval_seconds = 300
theme = "dark" # Visual theme: "dark" (default) or "light"
```

See [config/zabbix.toml.example](config/zabbix.toml.example) for a template.

## Trigger Severity Levels

| Priority | Level | Color |
|----------|-------|-------|
| 0 | Not classified | Gray |
| 1 | Information | Blue |
| 2 | Warning | Yellow |
| 3 | Average | Orange |
| 4 | High | Dark orange |
| 5 | Disaster | Red |

## Project Structure

- `src/`: Frontend React + TypeScript application.
- `src-tauri/`: Backend Rust + Tauri v2 core logic and commands.
- `config/`: Setup configuration templates.

## Development

```bash
# Start development server
npm run tauri dev

# Type check
npx tsc --noEmit

# Build frontend only
npx vite build

# Check Rust code
cd src-tauri && cargo check
```

## Building Release Artifacts

There are two ways to build release artifacts, depending on whether you want to package the installer or simply build the standalone executable.

### 1. Build Standalone Executable Only (No Code Signing Required)

If you do not need to generate installer bundles (like `.deb`, `.appimage`, `.msi`, `.dmg`) and just want the compiled standalone executable, you can skip the bundling step. This does **not** require any update signing keys.

Run the build command with the `--no-bundle` flag:

```bash
npm run tauri build -- --no-bundle
```

The compiled execution binary will be generated at:
- **Linux / macOS**: `src-tauri/target/release/zabbix-gadget`
- **Windows**: `src-tauri/target/release/zabbix-gadget.exe`

### 2. Build and Package Installers (Code Signing Required)

Because this application uses the Tauri auto-update plugin (`tauri-plugin-updater`) and defines a verification public key (`pubkey`) in `tauri.conf.json`, you cannot package installer bundles without the corresponding signing private key.

#### Prerequisites for Packaging

To compile and package the installer bundles locally, you must set the following environment variables:

- `TAURI_SIGNING_PRIVATE_KEY`: The content of your private key (Minisign key) matching the public key in `tauri.conf.json`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: (Optional) The passphrase used to decrypt the private key.

If these environment variables are missing or incorrect, the updater plugin will fail to sign the update bundle, causing the `tauri build` process to abort with an error.

#### How to Build

1. Configure the environment variables:
   - **Linux/macOS**:
     ```bash
     export TAURI_SIGNING_PRIVATE_KEY="your-private-key-content"
     export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-passphrase"
     ```
   - **Windows (PowerShell)**:
     ```powershell
     $env:TAURI_SIGNING_PRIVATE_KEY="your-private-key-content"
     $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-passphrase"
     ```
2. Run the build command:
   ```bash
   npm run tauri build
   ```

#### Custom Build/Fork Configuration (Generating New Keys)

If you are compiling your own fork and want to generate new signing keys:
1. Generate a new key pair using the Tauri CLI:
   ```bash
   npx tauri signer generate
   ```
2. Update the public key `pubkey` field in `src-tauri/tauri.conf.json` under `plugins.updater`.
3. Use the newly generated private key and passphrase as the `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` variables when building.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for details about the release history.