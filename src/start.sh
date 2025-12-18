#!/bin/bash

# Enhanced Crystal Clarity startup script with backend detection
# Philosophy: Backend First, Then Frontend Choice

echo "🔍 Crystal Clarity Frontend Startup"
echo "=================================="

# Get script directory (src-simple)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if backend is running on port 8080
echo "🔍 Checking backend status..."
if lsof -i :8080 >/dev/null 2>&1; then
    echo "✅ Backend WebSocket server detected on port 8080"
    BACKEND_RUNNING=true
else
    echo "⚠️  No backend detected on port 8080"
    BACKEND_RUNNING=false
fi

# Auto-start backend if not running
if [ "$BACKEND_RUNNING" = false ]; then
    echo ""
    echo "🚀 Auto-starting backend WebSocket server..."

    # Navigate to backend directory from src-simple -> ../services/tick-backend
    cd ../services/tick-backend

    # Start backend in background
    npm run dev > ../../backend.log 2>&1 &
    BACKEND_PID=$!

    # Go back to src-simple
    cd "$SCRIPT_DIR"

    # Wait for backend to initialize
    echo "⏳ Waiting for backend to initialize..."
    sleep 3

    # Verify backend started successfully
    if lsof -i :8080 >/dev/null 2>&1; then
        echo "✅ Backend auto-started successfully (PID: $BACKEND_PID)"
        echo "📝 Backend logs: ../backend.log"
    else
        echo "❌ Failed to start backend - check ../backend.log"
        exit 1
    fi
fi

echo ""
echo "🔧 Ensuring port 5175 is available for frontend..."

# Find and kill processes using port 5175
PORT_PID=$(lsof -ti:5175 2>/dev/null)

if [ ! -z "$PORT_PID" ]; then
    echo "🗑️  Terminating process $PORT_PID using port 5175"
    kill -9 $PORT_PID 2>/dev/null
    sleep 1

    # Verify port is free
    if lsof -ti:5175 >/dev/null 2>&1; then
        echo "⚠️  Port 5175 still in use, forcing termination..."
        lsof -ti:5175 | xargs -r kill -9
        sleep 2
    fi

    if ! lsof -ti:5175 >/dev/null 2>&1; then
        echo "✅ Port 5175 is now available"
    else
        echo "❌ Failed to free port 5175"
        exit 1
    fi
else
    echo "✅ Port 5175 is already available"
fi

echo ""
echo "🚀 Starting Crystal Clarity frontend on port 5175..."
echo "📡 Backend WebSocket: ws://localhost:8080"
echo "🌐 Frontend URL: http://localhost:5175"
echo ""

# Start the frontend
npm run dev