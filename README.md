# Zabbix Desktop Gadget

A modern desktop gadget for monitoring Zabbix server triggers, built with **Tauri v2 + React + TypeScript**.

## Features

- **Real-time trigger monitoring**: Displays active triggers by severity level
- **Multi-server support**: Monitor multiple Zabbix servers simultaneously
- **Color-coded status**: 6 severity levels with distinct colors
- **Hover tooltips**: See trigger details on hover
- **Auto-refresh**: Configurable refresh interval (default: 5 minutes)
- **Frameless window**: Always-on-top transparent gadget window
- **System Tray support**: Runs in the background and can be toggled from the system tray menu
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

Create a configuration file at `~/.config/zabbix-gadget/zabbix.toml`:

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
├── Cargo.lock
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .gitignore
├── README.md
├── src/                          # React + TypeScript (Vite)
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── TriggerTable.tsx
│   │   └── TriggerCell.tsx
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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.