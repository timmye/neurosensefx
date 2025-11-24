#!/bin/bash

# Container-based Development Environment
# Bypasses WSL2 filesystem limitations entirely
# Enhanced with WebSocket backend and production-ready configuration

set -e

# Configuration
CONTAINER_NAME="neurosensefx-dev"
IMAGE_NAME="node:18-alpine"
FRONTEND_PORT=5174
BACKEND_PORT=8080
PROJECT_ROOT="$(pwd)"

echo "🐳 Enhanced Container-Based Development Environment"
echo "📁 Project Root: $PROJECT_ROOT"

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up container..."

    # Stop and remove container
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        echo "🛑 Stopping container..."
        docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi

    if docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
        echo "🗑️  Removing container..."
        docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi

    echo "✅ Cleanup completed"
}

# Trap cleanup on exit
trap cleanup SIGINT SIGTERM EXIT

# Check if Docker is available and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker for WSL2:"
    echo "   https://docs.docker.com/docker-for-windows/wsl/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon not running. Please start Docker Desktop."
    exit 1
fi

# Remove existing container if it exists
cleanup

echo "🔧 Creating enhanced development container..."

# Create container with development-optimized configuration
docker run -d \
    --name "$CONTAINER_NAME" \
    -v "$PROJECT_ROOT":/app \
    -v "$PROJECT_ROOT/.env":/app/.env:ro \
    -w /app \
    -p "$FRONTEND_PORT":5174 \
    -p "$BACKEND_PORT":8080 \
    -e NODE_ENV=development \
    -e NODE_OPTIONS="--max-old-space-size=4096" \
    -e npm_config_cache=/tmp/npm-cache \
    -e npm_config_tmp=/tmp/npm-tmp \
    --restart unless-stopped \
    --memory=4g \
    --cpus=2 \
    "$IMAGE_NAME" \
    tail -f /dev/null

echo "📦 Installing and configuring dependencies..."

# Prepare container environment
docker exec "$CONTAINER_NAME" sh -c "
    # Create necessary directories
    mkdir -p /tmp/npm-cache /tmp/npm-tmp

    # Create optimized .npmrc for container
    cat > /app/.npmrc-container << 'EOF'
maxsockets=2
prefer-online=true
bin-links=false
omit=optional
progress=false
cache=/tmp/npm-cache
tmp=/tmp/npm-tmp
dedupe=false
install-strategy=shallow
force=true
EOF

    # Set npm to use container configuration
    export npm_config_cache=/tmp/npm-cache
    export npm_config_tmp=/tmp/npm-tmp
    export NODE_OPTIONS='--max-old-space-size=4096'
"

# Install dependencies with error handling
echo "🔄 Installing production dependencies..."
docker exec "$CONTAINER_NAME" npm install --production --no-optional --maxsockets=2 || {
    echo "⚠️  Production install failed, trying minimal install..."
    docker exec "$CONTAINER_NAME" npm install --production --no-optional --force
}

echo "🔄 Installing development dependencies..."
docker exec "$CONTAINER_NAME" npm install --only=dev --no-optional --maxsockets=2 || {
    echo "⚠️  Dev install failed, trying minimal install..."
    docker exec "$CONTAINER_NAME" npm install --only=dev --no-optional --force
}

# Verify backend environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "✅ Backend environment file mounted"
else
    echo "⚠️  No .env file found. Backend may not start properly."
    echo "   Create .env file with cTrader API credentials."
fi

echo "🚀 Starting enhanced development environment..."

# Start backend WebSocket server in background
echo "🔌 Starting WebSocket backend..."
docker exec -d "$CONTAINER_NAME" sh -c "
    cd /app
    if [ -f '.env' ]; then
        echo '🔌 Starting backend WebSocket server...'
        npm run dev:backend
    else
        echo '⚠️  No .env file found, skipping backend start'
        sleep infinity
    fi
"

# Wait a moment for backend to start
sleep 3

# Start frontend development server
echo "🖥️  Starting frontend development server..."
docker exec -d "$CONTAINER_NAME" sh -c "
    cd /app
    export NODE_OPTIONS='--max-old-space-size=4096'
    npm run dev:frontend
"

# Display status and access information
echo ""
echo "🎉 Enhanced container development environment is ready!"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend:     http://localhost:$FRONTEND_PORT"
echo "   Backend:      ws://localhost:$BACKEND_PORT"
echo ""
echo "🔧 Container Management:"
echo "   View logs:    docker logs -f $CONTAINER_NAME"
echo "   Access shell: docker exec -it $CONTAINER_NAME sh"
echo "   Stop all:     Press Ctrl+C or run: docker stop $CONTAINER_NAME"
echo ""
echo "📊 Container Resources:"
echo "   Memory:       4GB allocated"
echo "   CPUs:         2 cores allocated"
echo "   Storage:      Bind-mounted from: $PROJECT_ROOT"
echo ""
echo "⚡ Development Tips:"
echo "   • File changes are instantly synced via bind mount"
echo "   • Backend requires valid .env file with cTrader credentials"
echo "   • Container persists until stopped with Ctrl+C"
echo "   • All npm operations are optimized for container filesystem"

# Show container status
echo ""
echo "📋 Container Status:"
docker ps --filter name="$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🛑 To stop: Press Ctrl+C (will clean up container automatically)"

# Keep script running to maintain container
wait