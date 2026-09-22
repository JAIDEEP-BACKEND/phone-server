#!/data/data/com.termux/files/usr/bin/bash

# start-daemon.sh - Launches phone-server completely detached in background
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if command -v termux-wake-lock &> /dev/null; then
  echo "[POWER] Acquiring Termux Wake Lock..."
  termux-wake-lock
fi

LOG_FILE="$PROJECT_ROOT/phone-server.log"
echo "Starting Phone Server in detached daemon mode..."
nohup bash "$SCRIPT_DIR/start.sh" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "=========================================================="
echo "  PHONE SERVER RUNNING IN BACKGROUND"
echo "=========================================================="
echo "  PID:      $SERVER_PID"
echo "  Logs:     tail -f $LOG_FILE"
echo "  Hotspot:  http://10.78.153.85:3001"
echo "=========================================================="
echo "You can now safely minimize Termux or switch apps!"
