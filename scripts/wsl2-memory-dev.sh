#!/bin/bash

# WSL2 Memory-Based Development Environment
# Bypasses 9P filesystem limitations entirely
# Enhanced with persistence and WebSocket backend support

set -e

# Configuration
MEMORY_DEV_BASE="/tmp/wsl2-memory-dev"
MEMORY_DEV="$MEMORY_DEV_BASE-$(date +%s)"
SYNC_INTERVAL=30  # Auto-sync every 30 seconds

echo "🚀 WSL2 Enhanced Memory-Based Development Environment"
echo "📍 Target: $MEMORY_DEV"

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up memory environment..."

    # Final sync before cleanup
    if [ -d "$MEMORY_DEV" ] && [ -d "/workspaces/neurosensefx" ]; then
        echo "💾 Final sync to project directory..."
        rsync -av --exclude=node_modules \
                  --exclude=dist \
                  --exclude=/tmp \
                  "$MEMORY_DEV/" /workspaces/neurosensefx/ 2>/dev/null || true
    fi

    # Kill background processes
    pkill -f "inotifywait" 2>/dev/null || true
    pkill -f "rsync.*memory-dev" 2>/dev/null || true

    echo "✅ Cleanup completed"
    exit 0
}

# Trap cleanup on exit
trap cleanup SIGINT SIGTERM EXIT

# Create in-memory workspace
mkdir -p "$MEMORY_DEV"

echo "📁 Creating in-memory development environment..."

# Copy source files with intelligent exclusions
rsync -av --exclude=node_modules \
          --exclude=dist \
          --exclude=.git \
          --exclude=playwright-report \
          --exclude=test-results \
          --exclude=*.log \
          --exclude=/tmp \
          /workspaces/neurosensefx/ "$MEMORY_DEV/"

echo "📦 Installing dependencies in memory..."
cd "$MEMORY_DEV"

# Create optimized .npmrc for memory environment
cat > .npmrc << 'EOF'
# Memory-optimized npm configuration
maxsockets=1
prefer-online=true
bin-links=false
omit=optional
progress=false
cache=/tmp/npm-cache-memory
tmp=/tmp/npm-tmp-memory
dedupe=false
install-strategy=shallow
force=true
EOF

# Ensure tmp directories exist
mkdir -p /tmp/npm-cache-memory /tmp/npm-tmp-memory

# Set environment for memory development
export NODE_OPTIONS="--max-old-space-size=3072"
export npm_config_cache="/tmp/npm-cache-memory"
export npm_config_tmp="/tmp/npm-tmp-memory"

# Install with memory-optimized settings
echo "🔄 Installing dependencies..."
npm install --maxsockets=1 --no-optional --prefer-online --force

# Setup bidirectional sync
echo "🔄 Setting up bidirectional file synchronization..."

# Sync function: memory -> project
sync_to_project() {
    rsync -av --exclude=node_modules \
              --exclude=dist \
              --exclude=/tmp \
              "$MEMORY_DEV/" /workspaces/neurosensefx/ 2>/dev/null || true
}

# Sync function: project -> memory
sync_from_project() {
    rsync -av --exclude=node_modules \
              --exclude=dist \
              --exclude=/tmp \
              /workspaces/neurosensefx/ "$MEMORY_DEV/" 2>/dev/null || true
}

# Initial sync from project (catch any changes made during setup)
sync_from_project

# Background auto-sync
{
    while true; do
        sleep $SYNC_INTERVAL
        sync_to_project
        sync_from_project
    done
} &
SYNC_PID=$!

# Manual sync command
echo "💡 Manual sync: rsync -av --exclude=node_modules '$MEMORY_DEV/' /workspaces/neurosensefx/"

# Check for required backend environment
if [ -f "/workspaces/neurosensefx/.env" ]; then
    cp /workspaces/neurosensefx/.env "$MEMORY_DEV/.env"
    echo "✅ Backend environment configuration copied"
fi

echo "🚀 Enhanced memory-based development environment ready!"
echo ""
echo "🔧 Development Commands:"
echo "   cd $MEMORY_DEV"
echo "   npm run dev              # Start frontend + backend"
echo "   npm run dev:frontend     # Frontend only (port 5174)"
echo "   npm run dev:backend      # Backend WebSocket only (port 8080)"
echo ""
echo "🔄 Auto-sync: Running every $SYNC_INTERVAL seconds"
echo "💾 Manual sync: rsync -av --exclude=node_modules '$MEMORY_DEV/' /workspaces/neurosensefx/"
echo "🛑 To stop: Press Ctrl+C (will auto-sync final changes)"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:5174"
echo "   Backend:  ws://localhost:8080"
echo ""
echo "⚠️  Remember: All changes are in memory. Use Ctrl+C to save!"

# Start development shell
cd "$MEMORY_DEV"
exec "$SHELL"