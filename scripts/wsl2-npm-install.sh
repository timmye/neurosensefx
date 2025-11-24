#!/bin/bash

# WSL2-optimized npm installation script
# Addresses inode exhaustion and 9P filesystem limitations

set -e

echo "🔧 WSL2-Optimized Node.js Environment Setup"

# Create temporary directory with high inode count
TEMP_DIR="/tmp/wsl2-node-$$"
mkdir -p "$TEMP_DIR"

# Set environment variables for WSL2 I/O optimization
export npm_config_cache="$TEMP_DIR/npm-cache"
export npm_config_tmp="$TEMP_DIR/tmp"
export npm_config_maxsockets=1
export npm_config_progress=false
export npm_config_prefer_online=true
export npm_config_bin_links=false
export npm_config_omit="optional,dev"
export npm_config_foreground_scripts=true

# Reduce parallelism to prevent inode exhaustion
export NODE_OPTIONS="--max-old-space-size=4096"

echo "📦 Installing production dependencies first..."
npm install --production --no-optional --maxsockets=1

echo "📦 Installing development dependencies separately..."
npm install --only=dev --no-optional --maxsockets=1

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "✅ WSL2-optimized installation completed"
echo "💡 To maintain stability: run 'npm install' with --maxsockets=1 flag"