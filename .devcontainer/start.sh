#!/bin/bash

# Exit on error
set -e

echo "=== WalkMate Developer Environment Startup ==="

# 1. Setup Python Environment
echo "[1/4] Checking Python dependencies..."
pip install -r backend/requirements.txt --quiet

# 2. Setup Node.js Environment (NVM)
echo "[2/4] Initializing Node.js environment..."
export NVM_DIR="/usr/local/share/nvm"
. "$NVM_DIR/nvm.sh"
# Install Node 20 if not present
if ! nvm ls 20 >/dev/null 2>&1; then
    echo "Node 20 not found. Installing Node 20..."
    nvm install 20
fi
nvm use 20
nvm alias default 20 >/dev/null

# 3. Verify/Install Node packages
echo "[3/4] Checking Node.js dependencies..."
echo "  - Checking adminUI..."
cd UI/adminUI && npm install --no-audit --no-fund

# 4. Start Services in background
echo "[4/4] Starting services..."

# Start FastAPI backend
echo "  - Starting FastAPI backend on port 8000..."
(cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!


# Start adminUI
if [ -d "UI/adminUI" ]; then
    echo "  - Starting adminUI dev server on port 3000..."
    (cd UI/adminUI && npm run dev) &
    ADMINUI_PID=$!
fi

echo "=== WalkMate Services Started ==="
echo "FastAPI backend: http://localhost:8000"
echo "Admin UI:        http://localhost:3000"

# Keep container running and handle termination signals gracefully
cleanup() {
    echo "Stopping services..."
    kill $BACKEND_PID
    [ -n "$ADMINUI_PID" ] && kill $ADMINUI_PID
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for background processes to exit
wait
