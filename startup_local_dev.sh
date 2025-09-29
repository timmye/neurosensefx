#!/bin/bash
# This script replicates the startup sequence from the .idx/dev.nix file
# for the local VS Code Dev Container environment, ensuring perfect consistency.
# It includes better error handling and process management.

echo "=== NeuroSense FX Local Dev Startup ==="
echo "Starting development environment..."
echo ""

# Function to handle errors
handle_error() {
    echo "Error occurred in startup script at line: $1"
    echo "Please check the error message above and resolve the issue."
    exit 1
}

# Set up error trap
trap 'handle_error $LINENO' ERR

# Function to check if required files exist
check_prerequisites() {
    if [ ! -f "package.json" ]; then
        echo "Error: This script must be run from the project root directory."
        echo "Please navigate to the project root and try again."
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        echo "Warning: .env file not found. Please create one with your cTrader API credentials."
        echo "You can copy .env.example to .env and fill in your credentials."
    fi
    
    if [ ! -d "ctrader_tick_backend" ]; then
        echo "Error: Backend directory not found. Please run setup_project.sh first."
        exit 1
    fi
    
    if [ ! -d "ctrader_tick_backend/cTrader-Layer" ]; then
        echo "Error: cTrader-Layer submodule not found. Please run setup_project.sh first."
        exit 1
    fi
}

# Function to stop any existing backend processes
stop_existing_processes() {
    echo "[1/4] Cleaning up old server processes..."
    
    # Kill any processes using port 8080
    echo "Killing processes using port 8080..."
    lsof -ti :8080 | xargs -r kill -9
    
    # Kill any existing backend processes
    pkill -f 'node ctrader_tick_backend/server.js' || true
    
    # Kill any existing frontend processes (just in case)
    pkill -f 'vite' || true
    
    # Wait a moment for processes to terminate
    sleep 2
}

# Function to update submodules
update_submodules() {
    echo "[2/4] Updating Git submodules..."
    
    # Update submodules to latest version
    git submodule update --remote --merge || echo "Warning: Could not update submodules to latest version, using current version."
}

# Function to start backend server
start_backend() {
    echo "[3/4] Starting backend server in the background..."
    
    # Check if backend log file exists and remove it
    if [ -f "backend.log" ]; then
        rm backend.log
    fi
    
    # Start the backend server in the background and log its output
    (cd ctrader_tick_backend && npm start > ../backend.log 2>&1) &
    BACKEND_PID=$!
    
    # Give the backend a moment to initialize
    echo "Waiting for backend to initialize..."
    sleep 5
    
    # Check if the backend process is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Error: Backend server failed to start. Check backend.log for details."
        cat backend.log
        exit 1
    fi
    
    echo "Backend server started successfully (PID: ${BACKEND_PID})"
}

# Function to start frontend server
start_frontend() {
    echo "[5/5] Starting frontend dev server (Vite)..."
    
    # Check if vite is installed
    if [ ! -f "node_modules/.bin/vite" ]; then
        echo "Error: Vite not found. Please run setup_project.sh first."
        exit 1
    fi
    
    # Start the frontend development server
    echo "Starting Vite development server..."
    npm run dev
}

# Main execution
echo "Checking prerequisites..."
check_prerequisites

echo "Stopping any existing processes..."
stop_existing_processes

echo "Updating submodules..."
update_submodules

echo "Building cTrader-Layer..."
npm run build --prefix ctrader_tick_backend/cTrader-Layer

echo "Starting backend server..."
start_backend

echo "Starting frontend server..."
start_frontend

echo "--- Startup complete ---"
echo "To stop the application, use Ctrl+C in the primary terminal."
echo "To view backend logs, run: tail -f backend.log"
