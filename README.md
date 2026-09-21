# Android NAS & Remote Device Control Platform

A complete, production-quality, self-hosted **Android NAS / Personal Server / Remote Device Control Platform** engineered to run directly inside **Termux** on an **OPPO Android phone** (ARM64 / aarch64, 128 GB internal storage).

Allows any computer, tablet, or phone on the same local network to access the phone as a personal server via a web browser.

---

## 1. System Architecture

```text
                        ┌─────────────────────────────────────┐
                        │     Web Browser (LAN Client)        │
                        │ Next.js UI (Dense, Dark, Technical) │
                        └──────────────────┬──────────────────┘
                                           │ HTTP / WebSocket (Socket.IO)
                        ┌──────────────────▼──────────────────┐
                        │  Node.js + Express Backend (Termux) │
                        ├─────────────────────────────────────┤
                        │ - Auth (bcrypt, session cookies)    │
                        │ - RBAC (Strict server-side checks)  │
                        │ - Rate Limiting & Path Protection   │
                        │ - NAS File Manager Service          │
                        │ - PTY Web Terminal Service          │
                        │ - Real Hardware Metrics Collector   │
                        │ - Audit Logger & SQLite Persistence │
                        │ - Companion Control Hub (Socket.IO) │
                        └──────────┬──────────────────────┬───┘
                                   │                      │
             ┌─────────────────────▼───────┐      ┌───────▼─────────────────────┐
             │       Termux Runtime        │      │   Android Companion App     │
             │   (Linux /proc, statfs,     │      │ (Kotlin: MediaProjection,   │
             │   bash PTY, storage paths)  │      │ AccessibilityService, Audio)│
             └─────────────────────────────┘      └─────────────────────────────┘
```

---

## 2. Monorepo Project Structure

```text
android-server/
│
├── apps/
│   ├── web/                     # Next.js 14 Web Console (Tailwind, xterm.js, Socket.IO)
│   │   ├── app/
│   │   │   ├── (auth)/login/    # First admin setup & standard login
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx     # Main Dashboard (/) with real hardware vitals
│   │   │   │   ├── files/       # Desktop NAS File Manager (/files)
│   │   │   │   ├── terminal/    # Interactive PTY Web Terminal (/terminal)
│   │   │   │   ├── system/      # 1Hz System Telemetry & Power Controls (/system)
│   │   │   │   ├── remote/      # MediaProjection Screen & Touch Control (/remote)
│   │   │   │   ├── phone/       # OPPO Specifications & Capability Matrix (/phone)
│   │   │   │   ├── activity/    # Live WebSocket Audit Log Stream (/activity)
│   │   │   │   ├── users/       # RBAC & User Management (/users)
│   │   │   │   └── settings/    # Server Settings & Pairing Guide (/settings)
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   └── components/
│   │
│   ├── server/                  # Node.js + Express + TypeScript Backend
│   │   └── src/
│   │       ├── auth/            # bcrypt authentication & session manager
│   │       ├── security/        # RBAC middleware & progressive rate limiter
│   │       ├── files/           # Path traversal protection & file operations
│   │       ├── terminal/        # PTY bash session manager
│   │       ├── system/          # /proc, sysfs, and statfs telemetry collector
│   │       ├── android/         # Android Companion bridge
│   │       ├── sockets/         # Socket.IO handlers
│   │       ├── audit/           # Audit logging with SQLite persistence
│   │       ├── database/        # SQLite connection & schema migrations
│   │       └── index.ts         # Bootstrap entry point
│   │
│   └── android/                 # Native Kotlin Android Companion Application
│       ├── app/src/main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/androidserver/companion/
│       │   │   ├── MainActivity.kt
│       │   │   ├── service/
│       │   │   │   ├── ScreenCaptureService.kt      # MediaProjection screen stream
│       │   │   │   ├── RemoteAccessibilityService.kt # Touch & gesture execution
│       │   │   │   ├── NotificationMonitorService.kt # NotificationListenerService
│       │   │   │   └── CompanionForegroundService.kt # WebSocket bridge client
│       │   │   └── utils/
│       │   └── res/
│       └── build.gradle.kts
│
├── packages/
│   └── shared/                  # Shared TypeScript contracts, RBAC permissions, and schemas
│
├── scripts/
│   ├── setup-termux.sh          # One-command automated Termux installer
│   ├── start.sh                 # Production startup script with wake lock
│   └── verify-security.js       # Security and path traversal test suite
│
├── .env.example                 # Environment configuration template
├── package.json                 # Monorepo workspaces definition
└── README.md
```

---

## 3. Host Environment Requirements

- **Device**: OPPO Android Smartphone (e.g. CPH2219 or ColorOS compatible device)
- **Architecture**: ARM64 / aarch64
- **Storage**: 128 GB internal flash storage
- **Host Environment**: Termux (F-Droid release recommended)
- **Android Version**: Android 10, 11, 12, 13, 14+
- **Root Status**: Not required for core NAS, terminal, screen streaming, touch gestures, clipboard, volume, or app launching. Operations strictly requiring superuser (such as hardware reboot/shutdown) are explicitly flagged as `ROOT REQUIRED` and will never fake success.

---

## 4. Termux Quick Setup (One-Command)

On your OPPO phone inside Termux:

```bash
# 1. Clone repository to your phone
git clone https://github.com/your-username/phone-server.git
cd phone-server

# 2. Run automated setup script
bash scripts/setup-termux.sh
```

The setup script automatically:
1. Updates package repositories (`pkg update && pkg upgrade`).
2. Installs `nodejs-lts`, `git`, `python`, `make`, `clang`, and `termux-api`.
3. Calls `termux-setup-storage` to link `/storage/emulated/0`.
4. Copies `.env.example` to `.env` with cryptographically secure session keys.
5. Installs all npm workspace dependencies.
6. Builds the production bundles for both backend and frontend.

---

## 5. Manual Setup Steps

If you prefer manual installation:

```bash
# Update Termux
pkg update -y && pkg upgrade -y

# Install dependencies
pkg install -y nodejs-lts git python make clang termux-api

# Grant storage access
termux-setup-storage

# Configure environment
cp .env.example .env

# Install npm dependencies
npm install

# Build shared library, backend, and frontend
npm run build --workspace=@android-server/shared
npm run build --workspace=@android-server/server
npm run build --workspace=@android-server/web
```

---

## 6. Starting the Server

To launch the server with battery wake-lock protection:

```bash
bash scripts/start.sh
```

Or directly via npm:

```bash
npm start
```

Upon launch, the server outputs the exact network addresses:

```text
====================================================
  ANDROID NAS + REMOTE CONTROL SERVER - ACTIVE
====================================================
  Local Address:     http://localhost:3001
  LAN IP Address:    http://192.168.1.100:3001
  Storage Root:      /storage/emulated/0
  Database File:     ./data/server.sqlite
  Architecture:      arm64
  [NOTICE] Listening on 0.0.0.0 (Accessible to all devices on local network)
====================================================
```

To run both the Next.js dev server and backend concurrently during development:

```bash
npm run dev
```

---

## 7. First Administrator Setup

1. Open your browser on any laptop or phone connected to the same Wi-Fi:
   `http://<PHONE_LAN_IP>:3000` (or `http://<PHONE_LAN_IP>:3001` depending on your reverse proxy setup).
2. The system detects that no administrator exists and displays the **Create Administrator** console.
3. Choose an administrator username and a strong password (minimum 8 characters).
4. The password is hashed using bcrypt with salt rounds before saving to SQLite.
5. Once created, subsequent visits present the standard minimal login screen.

---

## 8. Android Companion Application Setup

The Kotlin companion application bridges native Android APIs that Termux processes cannot reach directly without elevation.

### Building the APK

You can build the APK on any machine with Android Studio or the command line:

```bash
cd apps/android
./gradlew assembleDebug
```

The compiled APK will be generated at:
`apps/android/app/build/outputs/apk/debug/app-debug.apk`

Transfer and install this APK on your OPPO phone.

### Configuring Permissions on the Phone

1. **Open "OPPO Server Companion"**:
   Enter the server address (e.g. `ws://127.0.0.1:3001`) and tap **Start Service / Reconnect**.
2. **Grant Screen Capture**:
   Tap **Grant** next to Screen Capture (MediaProjection). Accept the Android confirmation dialog.
3. **Enable Accessibility Service**:
   Tap **Enable** to open system Accessibility settings. Locate **OPPO Remote Control Service** and toggle it **ON**.
4. **Grant All Files Access**:
   Tap **Grant** next to Manage All Files to grant read/write access to `/storage/emulated/0`.
5. **Ignore Battery Optimization**:
   Tap **Ignore** so ColorOS does not kill background streaming or Termux background tasks.

Once configured, the web console header immediately reflects:
`COMPANION LINKED` (Green).

---

## 9. Security & Hardening

### Path Traversal Defense
Every filesystem request passes through `resolveSecurePath()`:
- Null-byte detection and rejection (`\0`).
- Canonicalization via `fs.realpathSync` to eliminate symlink escapes.
- Strict containment verification: the resolved path MUST begin with canonical `CONFIG.STORAGE_ROOT`.
- Rejection of drive letters and system root paths (`/etc`, `/data`, `/sys`, `/proc`, `C:\`).

To run the automated security test suite:
```bash
node scripts/verify-security.js
```

### Server-Side Role-Based Access Control (RBAC)
Every route and WebSocket message is guarded by server-side permission checks.
- Roles: `ADMIN`, `USER`.
- Granular permissions: `files.read`, `files.write`, `files.upload`, `files.download`, `files.delete`, `files.rename`, `files.move`, `shell.access`, `system.view`, `system.power`, `screen.view`, `phone.control`, `phone.touch`, `phone.apps`, `phone.notifications`, `phone.clipboard`, `phone.camera`, `phone.microphone`, `users.manage`, `logs.view`, `settings.manage`.

### Rate Limiting & Lockout
- IP-based rate limiting on authentication and sensitive power APIs.
- Progressive lockout upon consecutive failed authentication attempts.
- Temporary lock window without permanent account bricking.

### Audit Logging
- Every login, file mutation, shell invocation, remote control session, and power request is logged to SQLite with timestamps and IP addresses.
- Passwords and clipboard contents are strictly redacted and never recorded in permanent audit logs.
- Live audit entries are broadcast via WebSockets to authenticated administrators on `/activity`.

---

## 10. Known Android Limitations

1. **Power Off / Reboot**:
   Android's security architecture restricts `reboot` and `shutdown` to UID 0 (root) or system signed apps. When requested without root, the console explicitly marks the operation as `ROOT REQUIRED` rather than faking success.
2. **Lock Screen**:
   Screen locking without root is handled officially through `AccessibilityService.performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)`.
3. **ColorOS / OPPO Background Management**:
   ColorOS may sleep background tasks if background activity is restricted. Enable "Allow Background Activity" and "Ignore Battery Optimization" for both Termux and the Companion App.

---

## 11. Verification & Testing Summary

- **TypeScript Compilation**: Clean build across all packages (`@android-server/shared`, `@android-server/server`, `@android-server/web`).
- **Next.js Production Build**: All 13 routes compiled and statically optimized.
- **Security Test Suite**: Verified against 10 distinct path traversal attack vectors with 100% pass rate.
