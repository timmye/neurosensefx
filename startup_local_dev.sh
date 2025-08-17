#!/bin/bash
# This script replicates the startup sequence from the .idx/dev.nix file
# for the local VS Code Dev Container environment, ensuring perfect consistency.

echo "--- NeuroSense FX Local Dev Startup ---"

# 1. Ensure any lingering backend process from a previous session is stopped
echo "[1/4] Cleaning up old server processes..."
pkill -f 'node ctrader_tick_backend/server.js' || true

# 2. Automatically update the backend submodule to the latest version on start
echo "[2/4] Updating Git submodules..."
git submodule update --remote --merge

# 3. Start the backend server in the background and log its output
echo "[3/4] Starting backend server in the background..."
(cd ctrader_tick_backend && npm start > ../backend.log 2>&1) &

# Give the backend a moment to initialize before the frontend starts
sleep 3

# 4. Start the frontend development server in the foreground
echo "[4/4] Starting frontend dev server (Vite)..."
npm run dev

echo "--- Startup complete ---"
