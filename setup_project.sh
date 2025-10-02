#!/bin/bash
# NeuroSense FX Unified Setup Script
# Version 2.0 - Consolidated setup/cleanup

set -e

echo "=== NeuroSense FX Setup ==="
echo "Usage: ./setup.sh [--clean]"
echo

# Error handling
handle_error() {
    echo "Error at line: $1"
    exit 1
}
trap 'handle_error $LINENO' ERR

cleanup_environment() {
    echo "--- Performing Deep Clean ---"
    
    # Kill running services
    pkill -f 'node services/tick-backend/server.js' || true
    pkill -f 'vite' || true
    
    # Remove node modules
    echo "Removing node_modules..."
    find . -name "node_modules" -type d -prune -exec rm -rf {} \;
    
    # Remove lock files
    echo "Removing package locks..."
    find . -name "package-lock.json" -delete
    
    # Clean logs
    rm -rf logs/*.log 2>/dev/null
    
    echo "Cleanup complete."
}

install_dependencies() {
    echo "--- Installing Dependencies ---"
    
    echo "Installing cTrader-Layer..."
    (cd libs/cTrader-Layer && npm install && npm run safe-build)
    
    echo "Installing backend dependencies..."
    (cd services/tick-backend && npm install)
    
    echo "Installing frontend dependencies..."
    npm install
}

# Main execution
if [[ "$1" == "--clean" ]]; then
    cleanup_environment
fi

install_dependencies

echo "=== Setup Complete ==="
echo "Run './run.sh start' to launch services"
