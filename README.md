# Zabbix Desktop Gadget

A modern desktop gadget for monitoring Zabbix server triggers, built with **Tauri v2 + React + TypeScript**.

## Features

- **Real-time trigger monitoring**: Displays active triggers by severity level
- **Multi-server support**: Monitor multiple Zabbix servers simultaneously
- **Color-coded status**: 6 severity levels with distinct colors
- **Hover tooltips**: See trigger details on hover
- **Auto-refresh**: Configurable refresh interval (default: 5 minutes)
- **Frameless window**: Always-on-top gadget window with automatic position and size restoration across restarts
- **System Tray support**: Runs in the background, toggles window visibility, and supports checking/applying updates and relaunching directly from the tray menu
- **Settings UI**: Configure and reorder (via drag-and-drop) servers directly in the application
- **Lightweight**: Tauri-based, minimal resource usage

## Prerequisites

- Node.js 18+
- Rust 1.70+
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

Create a configuration file at the following path depending on your operating system:

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

```
zabbix-gadget/
├── package.json
├── package-lock.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── biome.json
├── .gitignore
├── README.md
├── AGENTS.md
├── src/                          # React + TypeScript (Vite)
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── TooltipPanel.tsx
│   │   ├── TriggerCell.tsx
│   │   └── TriggerTable.tsx
│   ├── hooks/
│   │   ├── useZabbix.ts
│   │   └── useConfig.ts
│   ├── types/
│   │   ├── zabbix.ts
│   │   └── config.ts
│   └── lib/
│       └── zabbix-api.ts
├── src-tauri/                    # Rust + Tauri
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs
│   ├── tauri.conf.json
│   ├── icons/
│   │   └── icon.png
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── config.rs             # TOML configuration handling
│       ├── zabbix.rs             # Zabbix JSON-RPC client
│       └── commands.rs           # Tauri Commands
└── config/
    └── zabbix.toml.example
```

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

### Troubleshooting Linux AppImage Build

If bundling the AppImage fails on Linux (e.g., due to FUSE errors or `Unable to recognise the format` / `.relr.dyn` section errors in `linuxdeploy`), set the following environment variables before building:

```bash
export APPIMAGE_EXTRACT_AND_RUN=1
export NO_STRIP=true
npm run tauri build
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.