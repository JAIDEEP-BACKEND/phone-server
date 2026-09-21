#!/data/data/com.termux/files/usr/bin/bash

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "  OPPO ANDROID NAS & PERSONAL SERVER"
echo "=========================================================="

# 1. Acquire Termux wake lock so ColorOS/Android doesn't freeze CPU
if command -v termux-wake-lock &> /dev/null; then
  echo "[POWER] Acquiring Termux Wake Lock..."
  termux-wake-lock
fi

# 2. Check for missing dependencies
if [ ! -d "node_modules/express" ] && [ ! -d "apps/server/node_modules/express" ]; then
  echo "[DEPENDENCIES] Packages not found. Running npm install --omit=dev..."
  npm install --omit=dev
fi

# 3. Initialize .env if missing
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi
  SESSION_SECRET=$(head /dev/urandom 2>/dev/null | tr -dc A-Za-z0-9 2>/dev/null | head -c 32 || echo "secret_session_$(date +%s)")
  COOKIE_SECRET=$(head /dev/urandom 2>/dev/null | tr -dc A-Za-z0-9 2>/dev/null | head -c 32 || echo "secret_cookie_$(date +%s)")
  echo "" >> .env
  echo "PORT=3001" >> .env
  echo "SESSION_SECRET=$SESSION_SECRET" >> .env
  echo "COOKIE_SECRET=$COOKIE_SECRET" >> .env
  echo "[CONFIG] Generated .env with secure random tokens."
fi

# Load environment
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs 2>/dev/null)
fi

# 4. Ensure server is built
if [ ! -f "apps/server/dist/index.js" ]; then
  echo "[BUILD] Building server and shared packages..."
  npm run build --workspace=@android-server/shared
  npm run build --workspace=@android-server/server
fi

PORT="${PORT:-3001}"
echo ""
echo "=========================================================="
echo "  SERVER ACTIVE & LISTENING ON PORT $PORT"
echo "=========================================================="
echo "  Direct Phone Hotspot: http://192.168.43.1:$PORT"
WLAN_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1)
if [ -n "$WLAN_IP" ]; then
  echo "  Home Wi-Fi Network:   http://$WLAN_IP:$PORT"
fi
echo "  Local Device:         http://localhost:$PORT"
echo "=========================================================="
echo ""

# 5. Start Server
exec node apps/server/dist/index.js
