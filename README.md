# OPPO Android NAS & Personal Server

A lightweight, production-quality, self-hosted **Android NAS and Personal Server** running entirely inside **Termux** on an **OPPO Android phone** (ARM64, 128 GB internal storage).

No external companion app, no root, and no complicated setup. Access your phone's storage, run an interactive web terminal, and monitor hardware in real time from any browser on the same network or direct phone hotspot.

---

## Features

- **NAS-Style File Manager**: Browse, upload, download, rename, move, copy, and delete files directly on `/storage/emulated/0` (DCIM, Pictures, Documents, Downloads).
- **Web-Based Terminal**: Interactive xterm.js terminal with real PTY connection to the Termux bash shell.
- **Real-Time Hardware Telemetry**: 1Hz live metrics for CPU %, RAM (from `/proc/meminfo`), storage capacity, network throughput, battery status, and uptime.
- **Hotspot Mode (Zero Router)**: Turn on your phone's personal hotspot and connect your PC directly to `http://192.168.43.1:3001`.
- **Security & RBAC**: Strict path traversal protection, bcrypt password hashing, IP rate limiting, and SQLite audit logging.

---

## Quick Start on Your Phone

### 1. In Termux on Your Phone

```bash
# Update and install Node.js & Git
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git python make clang termux-api
termux-setup-storage

# Clone the repository
git clone https://github.com/JAIDEEP-BACKEND/phone-server.git
cd phone-server

# Run the setup script
bash scripts/setup-termux.sh

# Start the server
bash scripts/start.sh
```

---

### 2. Connect via Phone Hotspot (Zero Router Needed)

1. On your OPPO phone, turn on **Personal Hotspot** (in Settings → Connection & sharing).
2. Connect your PC / laptop / tablet Wi-Fi to your **phone's hotspot**.
3. Open your browser and go to:
   ```text
   http://192.168.43.1:3001
   ```
4. Create your administrator account on first visit and log in!

---

### 3. Connect via Shared Wi-Fi

If both your phone and PC are connected to the same home/office Wi-Fi router:
1. Note your phone's IP address displayed in Termux (e.g. `192.168.1.X`).
2. In your browser, open:
   ```text
   http://192.168.1.X:3001
   ```

---

## Project Structure

```text
phone-server/
│
├── apps/
│   ├── web/               # Next.js 14 Web Administration Console
│   │   ├── app/           # Dashboard, Files, Terminal, System, Activity, Users, Settings
│   │   └── components/    # Dark technical UI components
│   │
│   └── server/            # Node.js + Express + TypeScript Backend
│       ├── src/
│       │   ├── auth/      # bcrypt authentication & sessions
│       │   ├── files/     # Path traversal protection & file operations
│       │   ├── terminal/  # Interactive PTY bash shell
│       │   ├── system/    # Real /proc & sysfs hardware metrics
│       │   ├── sockets/   # Socket.IO real-time pipeline
│       │   └── database/  # SQLite persistence & schema migrations
│       └── index.ts       # Server bootstrap
│
├── packages/
│   └── shared/            # Shared TypeScript types & RBAC contracts
│
├── scripts/
│   ├── setup-termux.sh    # Automated Termux setup
│   ├── start.sh           # Server startup script with wake-lock
│   └── verify-security.js # Path traversal security test suite
│
├── .env.example
├── package.json
└── README.md
```

---

## License

MIT
