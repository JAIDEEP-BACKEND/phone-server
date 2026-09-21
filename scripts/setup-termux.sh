#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "========================================================"
echo "  ANDROID PHONE NAS & PERSONAL SERVER SETUP"
echo "========================================================"

echo "[1/6] Updating Termux packages..."
pkg update -y && pkg upgrade -y

echo "[2/6] Installing Node.js, Python, Build Essentials & Termux API..."
pkg install -y nodejs-lts git python make clang termux-api

echo "[3/6] Requesting Android shared storage permission..."
termux-setup-storage

echo "[4/6] Initializing Environment Variables..."
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate cryptographically secure random keys
  SESSION_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
  COOKIE_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)
  sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
  sed -i "s/COOKIE_SECRET=.*/COOKIE_SECRET=$COOKIE_SECRET/" .env
  echo "Created .env with auto-generated session & cookie secrets."
fi

echo "[5/6] Installing Node dependencies..."
npm install

echo "[6/6] Building production packages..."
npm run build

echo "========================================================"
echo "  INSTALLATION COMPLETE!"
echo "========================================================"
echo "To start the server, run:"
echo "  npm start"
echo ""
echo "Or using the start script:"
echo "  bash scripts/start.sh"
echo "========================================================"
