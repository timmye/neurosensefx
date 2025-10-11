#!/bin/bash

# Serena MCP Setup Script for NeuroSense FX DevContainer
# This script installs and configures Serena MCP server

set -e

echo "🚀 Setting up Serena MCP for NeuroSense FX..."

# Check if UV is already installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing UV package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="/home/node/.local/bin:$PATH"
    
    # Add UV to PATH permanently
    echo 'export PATH="/home/node/.local/bin:$PATH"' >> ~/.bashrc
    echo 'export PATH="/home/node/.local/bin:$PATH"' >> ~/.profile
else
    echo "✅ UV is already installed"
fi

# Verify UV installation
echo "🔍 Verifying UV installation..."
uv --version

# Test Serena installation
echo "🧪 Testing Serena installation..."
uvx --from git+https://github.com/oraios/serena serena --help

# Create Serena project configuration if it doesn't exist
if [ ! -f ".serena/project.yml" ]; then
    echo "📝 Creating Serena project configuration..."
    mkdir -p .serena
    
    # Generate project configuration
    uvx --from git+https://github.com/oraios/serena serena project generate-yml
    
    echo "✅ Serena project configuration created"
else
    echo "✅ Serena project configuration already exists"
fi

# Test MCP server startup
echo "🧪 Testing MCP server startup..."
timeout 5 uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
    --context ide-assistant \
    --project /workspaces/c \
    --transport stdio \
    --help > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ MCP server test successful"
else
    echo "❌ MCP server test failed"
    exit 1
fi

echo ""
echo "🎉 Serena MCP setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart your DevContainer to apply changes"
echo "2. Check that Serena appears in your available MCP tools"
echo "3. Test Serena functionality with a simple command"
echo ""
echo "🔗 Useful commands:"
echo "  - List available tools: uvx --from git+https://github.com/oraios/serena serena tools list"
echo "  - Edit configuration: uvx --from git+https://github.com/oraios/serena serena config edit"
echo "  - Start MCP server: uvx --from git+https://github.com/oraios/serena serena start-mcp-server"
echo ""
echo "🌐 Web dashboard: http://127.0.0.1:24282/dashboard/index.html (when server is running)"
