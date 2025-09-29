#!/bin/bash
# This script handles the complete setup of the project,
# ensuring all submodules and dependencies are installed and built correctly.
# It includes error handling and cleanup to make the process more robust.

set -e # Exit immediately if a command exits with a non-zero status.

echo "=== NeuroSense FX Setup Script ==="
echo "This script will set up the entire development environment."
echo ""

# Function to handle errors
handle_error() {
    echo "Error occurred in setup script at line: $1"
    echo "Please check the error message above and resolve the issue."
    echo "You may need to clean up partially installed dependencies manually."
    exit 1
}

# Set up error trap
trap 'handle_error $LINENO' ERR

# Function to clean up node_modules and package-lock.json files with retry logic
cleanup_node_files() {
    echo "Cleaning up existing node_modules and package-lock.json files..."
    
    # First try to kill any processes using node_modules
    echo "Terminating processes that might be using node_modules..."
    pkill -f node || true
    pkill -f npm || true
    pkill -f yarn || true
    
    # Add retry logic for cleanup operations
    MAX_RETRIES=3
    RETRY_DELAY=2
    
    # Clean up node_modules with retries
    for i in $(seq 1 $MAX_RETRIES); do
        echo "Attempt $i to remove node_modules directories..."
        if find . -name "node_modules" -type d -prune -exec rm -rf {} \; 2>/dev/null; then
            echo "Successfully removed node_modules directories"
            break
        else
            echo "Failed to remove node_modules directories, retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        fi
    done
    
    # Clean up package-lock.json files with retries
    for i in $(seq 1 $MAX_RETRIES); do
        echo "Attempt $i to remove package-lock.json files..."
        if find . -name "package-lock.json" -type f -delete 2>/dev/null; then
            echo "Successfully removed package-lock.json files"
            break
        else
            echo "Failed to remove package-lock.json files, retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
        fi
    done
}

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ]; then
        echo "Error: This script must be run from the project root directory."
        echo "Please navigate to the project root and try again."
        exit 1
    fi
}

# Function to check if git is available
check_git() {
    if ! command -v git &> /dev/null; then
        echo "Error: Git is not installed or not available in PATH."
        echo "Please install Git and try again."
        exit 1
    fi
}

# Function to check if npm is available
check_npm() {
    if ! command -v npm &> /dev/null; then
        echo "Error: npm is not installed or not available in PATH."
        echo "Please install Node.js (which includes npm) and try again."
        exit 1
    fi
}

echo "--- 0. Checking prerequisites ---"
check_directory
check_git
check_npm
echo "All prerequisites satisfied."
echo ""

echo "--- 1. Initializing Git Submodules ---"
# Clean up any existing submodules that might be in a bad state
# Clean both working directory and git module configuration
# Properly deinitialize the submodule first
if [ -d "ctrader_tick_backend" ]; then
    echo "Deinitializing existing backend submodule..."
    git submodule deinit -f ctrader_tick_backend
fi

# Clean up any residual files
if [ -d "ctrader_tick_backend" ]; then
    echo "Cleaning existing backend submodule working directory..."
    rm -rf ctrader_tick_backend
fi

if [ -d ".git/modules/ctrader_tick_backend" ]; then
    echo "Cleaning existing backend submodule git configuration..."
    rm -rf .git/modules/ctrader_tick_backend
fi

echo "Initializing and updating all submodules..."
git submodule update --init --recursive

# Verify submodules were cloned successfully
if [ ! -d "ctrader_tick_backend" ] || [ ! -d "ctrader_tick_backend/cTrader-Layer" ]; then
    echo "Error: Failed to initialize submodules correctly."
    echo "Please check your internet connection and try again."
    exit 1
fi
echo "Submodules initialized successfully."
echo ""

echo "--- 2. Installing and Building cTrader-Layer ---"
cd ctrader_tick_backend/cTrader-Layer

# Clean up any existing node files
cleanup_node_files

echo "Installing cTrader-Layer dependencies..."
npm install

echo "Linting cTrader-Layer code..."
npm run lint -- --fix || echo "Warning: Linting had issues, but continuing with build..."

echo "Building cTrader-Layer..."
npm run safe-build
cd ../../ # Return to the root directory
echo "cTrader-Layer installed and built successfully."
echo ""

echo "--- 3. Installing Backend Dependencies ---"
cd ctrader_tick_backend

# Clean up any existing node files
cleanup_node_files

echo "Installing backend dependencies..."
npm install
cd .. # Return to the root directory
echo "Backend dependencies installed successfully."
echo ""

echo "--- 4. Installing Frontend Dependencies ---"
# Clean up any existing node files
cleanup_node_files

echo "Installing frontend dependencies..."
npm install

# Verify vite installation
if [ ! -f "node_modules/.bin/vite" ] || [ ! -f "node_modules/vite/bin/vite.js" ]; then
    echo "Warning: Vite installation may be incomplete. Reinstalling Vite..."
    npm uninstall vite
    npm install vite --save-dev
fi
echo "Frontend dependencies installed successfully."
echo ""

echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "1. Make sure you have a valid .env file with your cTrader API credentials"
echo "2. Run './startup_local_dev.sh' to start the development environment"
echo "3. Access the application at http://localhost:5173 (or the port shown in the terminal)"
