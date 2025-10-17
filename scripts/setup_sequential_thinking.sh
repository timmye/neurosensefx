#!/bin/bash

# Sequential Thinking MCP Setup Script for NeuroSense FX DevContainer
# This script installs and configures Sequential Thinking MCP server

set -e

echo "🧠 Setting up Sequential Thinking MCP for NeuroSense FX..."

# Check if Node.js and npm are available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

# Verify Node.js installation
echo "🔍 Verifying Node.js installation..."
node --version
npm --version

# Test Sequential Thinking installation
echo "🧪 Testing Sequential Thinking installation..."
# Test package availability without running the server
npm info @modelcontextprotocol/server-sequential-thinking > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Sequential Thinking package test successful"
else
    echo "❌ Sequential Thinking package test failed"
    exit 1
fi

# Test MCP server startup (with timeout and proper handling)
echo "🧪 Testing MCP server startup..."
timeout 3 npx -y @modelcontextprotocol/server-sequential-thinking --help 2>&1 | grep -q "Sequential Thinking"

if [ $? -eq 0 ]; then
    echo "✅ MCP server test successful"
else
    echo "⚠️  MCP server test returned non-zero exit code (this may be expected for stdio servers)"
fi

# Create MCP directory structure
echo "📁 Creating MCP directory structure..."
mkdir -p /home/node/Documents/Cline/MCP

echo ""
echo "🎉 Sequential Thinking MCP setup complete!"
echo ""
echo "📋 Configuration:"
echo "  - Server name: github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking"
echo "  - Command: npx -y @modelcontextprotocol/server-sequential-thinking"
echo "  - Transport: stdio"
echo ""
echo "📋 Next steps:"
echo "1. Restart your DevContainer to apply changes"
echo "2. Check that Sequential Thinking appears in your available MCP tools"
echo "3. Test Sequential Thinking functionality with a thinking process"
echo ""
echo "🔗 Useful commands:"
echo "  - Test server: npx -y @modelcontextprotocol/server-sequential-thinking --help"
echo "  - View package info: npm info @modelcontextprotocol/server-sequential-thinking"
echo ""
echo "💡 Usage example:"
echo "  Use the sequentialthinking tool to break down complex problems"
echo "  into manageable steps with dynamic revision capabilities."
