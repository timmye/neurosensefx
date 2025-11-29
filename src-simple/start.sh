#!/bin/bash

# Ensure port 5175 is available for simple implementation
# This maintains predictable behavior - Crystal Clarity Philosophy

echo "🔧 Ensuring port 5175 is available..."

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

# Start the simple implementation on port 5175
echo "🚀 Starting simple implementation on port 5175..."
cd "$(dirname "$0")"
npm run dev