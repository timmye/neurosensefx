#!/bin/bash

# Simple Frontend Startup Script
# Crystal Clarity Philosophy: Deterministic, predictable behavior

set -e  # Exit on any error

echo "🚀 Starting Simple Frontend on port 5175..."

# Function to cleanup port 5175
cleanup_port() {
    local port_pids=$(lsof -ti:5175 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        echo "🗑️  Cleaning up port 5175..."
        echo "$port_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        echo "$port_pids" | xargs -r kill -KILL 2>/dev/null || true
        sleep 1
    fi
}

# Function to check if port is available
check_port_available() {
    if lsof -i:5175 >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local max_attempts=30
    local attempt=0

    echo "⏳ Waiting for service to be ready..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:5175 >/dev/null 2>&1; then
            echo "✅ Service is ready!"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
        echo -n "."
    done

    echo ""
    echo "❌ Service failed to start within ${max_attempts} seconds"
    return 1
}

# Main execution
cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clean up port 5175
cleanup_port

# Verify port is available
if ! check_port_available; then
    echo "❌ Port 5175 is still in use after cleanup"
    echo "💡 Manually check with: lsof -i:5175"
    exit 1
fi

echo "✅ Port 5175 is available"

# Start the development server
echo "🔧 Starting Vite development server..."
npm run dev &
VITE_PID=$!

# Wait a moment for the process to start
sleep 2

# Check if the process is still running
if ! kill -0 $VITE_PID 2>/dev/null; then
    echo "❌ Vite server failed to start"
    exit 1
fi

echo "✅ Vite server started (PID: $VITE_PID)"

# Wait for service to be ready
if wait_for_service; then
    echo ""
    echo "🌐 Simple Frontend is running at: http://localhost:5175"
    echo "🔥 Hot reload enabled - changes will auto-refresh"
    echo "🛑 Use Ctrl+C to stop the server"
    echo ""

    # Keep the script running and trap Ctrl+C
    trap 'echo ""; echo "🛑 Stopping server..."; kill $VITE_PID 2>/dev/null || true; exit 0' INT

    # Wait for the Vite process
    wait $VITE_PID
else
    echo "❌ Failed to start Simple Frontend"
    kill $VITE_PID 2>/dev/null || true
    exit 1
fi