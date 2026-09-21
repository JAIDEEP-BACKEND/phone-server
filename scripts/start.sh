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

echo "[START] Starting Android NAS & Remote Control Server on port ${PORT:-3001}..."
npm run start --workspace=@android-server/server
