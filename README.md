# Android Phone NAS & Personal Server

A lightweight, production-quality, self-hosted **Android NAS and Personal Server** running entirely inside **Termux** on an **Android phone** (ARM64, 128 GB internal storage).

Access storage files, web terminal console, real-time hardware telemetry, system management, and RBAC security from any computer, tablet, or phone connected to your phone's **Wi-Fi Hotspot** or home LAN without requiring root access.

---

## ⚡ Key Highlights
* **Zero Root Needed**: Runs in standard Termux environment.
* **Direct Hotspot Access**: Emits its own Wi-Fi hotspot (`192.168.43.1:3001`) — works outdoors, off-grid, and anywhere with zero external router.
* **Full NAS Storage**: Browse, upload large files (chunked streaming), download, delete, rename, and manage Android internal storage (`/sdcard`).
* **Web Terminal Console**: Full interactive Termux PTY shell (`bash` / `sh`) over WebSocket with command quick-actions (`ls -la`, `df -h`, `free -m`, `uptime`, etc.).
* **Real-time Telemetry (HUD / Sci-Fi FUI)**: Accurate CPU delta load, dynamic multi-zone thermal sensing, RAM breakdown, disk space, and battery levels.
* **Auto-Recovery Daemon**: SIGHUP protection and persistent supervisor loop prevent Android background suspension.
* **RBAC & Security**: Bcrypt-hashed credentials, JWT/cookie authentication, rate limiting, and SQLite audit logging.

---

## 🚀 Quick Setup on Phone (Termux)

### Prerequisites
Install **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/) (do NOT use Google Play Store version as it is deprecated).

### 1-Line Setup
Open Termux and run:
```bash
pkg update && pkg install git nodejs-lts -y
git clone https://github.com/JAIDEEP-BACKEND/phone-server.git
cd phone-server
bash scripts/setup-termux.sh
```

### Start Server
```bash
npm start
```
Or start persistent background daemon:
```bash
bash scripts/start.sh
```

---

## 📱 Connecting via Hotspot
1. On your phone, turn on **Personal Hotspot** (in Settings → Connection & sharing).
2. Connect your PC / laptop / tablet Wi-Fi to your **phone's hotspot**.
3. Open your browser and go to:
   ```text
   http://192.168.43.1:3001
   ```

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
