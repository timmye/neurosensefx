#!/bin/bash
# This script handles the complete setup of the project,
# ensuring all submodules and dependencies are installed and built correctly.

set -e # Exit immediately if a command exits with a non-zero status.

echo "--- 1. Initializing Git Submodules ---"
git submodule update --init --recursive

echo "--- 2. Installing and Building cTrader-Layer ---"
cd ctrader_tick_backend/cTrader-Layer
npm install
npm run lint -- --fix
npm run safe-build
cd ../../ # Return to the root directory

echo "--- 3. Installing Backend Dependencies ---"
cd ctrader_tick_backend
npm install
cd .. # Return to the root directory

echo "--- 4. Installing Frontend Dependencies ---"
npm install

echo "--- Setup Complete! ---"
