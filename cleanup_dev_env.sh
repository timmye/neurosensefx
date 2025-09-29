#!/bin/bash
# This script cleans up the development environment by removing all node_modules,
# package-lock.json files, and resetting submodules to a clean state.

echo "=== NeuroSense FX Development Environment Cleanup ==="
echo "This script will clean up your development environment."
echo "WARNING: This will remove all node_modules directories and package-lock.json files."
echo ""

# Confirm with user before proceeding
read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "Starting cleanup process..."
echo ""

# Function to handle errors
handle_error() {
    echo "Error occurred in cleanup script at line: $1"
    echo "Please check the error message above and resolve the issue."
    exit 1
}

# Set up error trap
trap 'handle_error $LINENO' ERR

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ]; then
        echo "Error: This script must be run from the project root directory."
        echo "Please navigate to the project root and try again."
        exit 1
    fi
}

echo "--- 1. Checking directory ---"
check_directory
echo "Directory check passed."
echo ""

echo "--- 2. Stopping any running processes ---"
# Kill any existing backend processes
pkill -f 'node ctrader_tick_backend/server.js' || true

# Kill any existing frontend processes
pkill -f 'vite' || true

# Wait a moment for processes to terminate
sleep 2
echo "Processes stopped."
echo ""

echo "--- 3. Removing node_modules directories ---"
# Remove all node_modules directories
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
echo "node_modules directories removed."
echo ""

echo "--- 4. Removing package-lock.json files ---"
# Remove all package-lock.json files
find . -name "package-lock.json" -type f -delete 2>/dev/null || true
echo "package-lock.json files removed."
echo ""

echo "--- 5. Cleaning submodule directories ---"
# Deinitialize submodules
git submodule deinit -f . 2>/dev/null || true
echo "Submodules deinitialized."
echo ""

echo "--- 6. Reinitializing submodules ---"
# Reinitialize submodules
git submodule update --init --recursive
echo "Submodules reinitialized."
echo ""

echo "=== Cleanup Complete! ==="
echo ""
echo "To set up your environment again, run:"
echo "  ./setup_project.sh"
echo ""
echo "This will install all dependencies and build the project from scratch."