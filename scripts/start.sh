#!/data/data/com.termux/files/usr/bin/bash

# Ensure Termux wake lock so ColorOS/Android doesn't freeze CPU
if command -v termux-wake-lock &> /dev/null; then
  echo "[POWER] Acquiring Termux Wake Lock..."
  termux-wake-lock
fi

# Load environment
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
fi

# Ensure server is built before launching
if [ ! -f "apps/server/dist/index.js" ]; then
  echo "[BUILD] Building server and shared packages..."
  npm run build --workspace=@android-server/shared
  npm run build --workspace=@android-server/server
fi

echo "[START] Starting OPPO Android NAS Server on port ${PORT:-3001}..."
npm run start --workspace=@android-server/server
