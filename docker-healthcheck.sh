#!/bin/sh
# =============================================================================
# NEUROSENSE FX - DOCKER HEALTH CHECK
# =============================================================================
# Verifies both frontend and backend services are healthy

set -e

echo "=== NeuroSense FX Health Check ==="

# Check if backend WebSocket server is responding
echo "Checking backend WebSocket server..."
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "✅ Backend WebSocket server is responding"
else
    echo "❌ Backend WebSocket server is not responding"
    exit 1
fi

# Check if frontend is serving
echo "Checking frontend server..."
if curl -s http://localhost:4173 > /dev/null 2>&1; then
    echo "✅ Frontend server is responding"
else
    echo "❌ Frontend server is not responding"
    exit 1
fi

# Check process health
if pgrep -f "node.*server.js" > /dev/null; then
    echo "✅ Backend process is running"
else
    echo "❌ Backend process is not running"
    exit 1
fi

if pgrep -f "vite.*preview" > /dev/null; then
    echo "✅ Frontend process is running"
else
    echo "❌ Frontend process is not running"
    exit 1
fi

echo "✅ All services are healthy"
exit 0