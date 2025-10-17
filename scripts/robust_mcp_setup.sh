#!/bin/bash

# Robust MCP Setup Script for NeuroSense FX DevContainer
# This script addresses potential timing and environment issues during DevContainer startup

set -e

echo "🚀 Robust MCP Setup for NeuroSense FX..."
echo "========================================"

# Add error handling function
handle_error() {
    echo "❌ Error occurred in script at line $1"
    echo "🔍 Command that failed: $2"
    exit 1
}

# Set up error trapping
trap 'handle_error $LINENO "$BASH_COMMAND"' ERR

# Ensure PATH includes UV and other tools
export PATH="/home/node/.local/bin:$PATH"

# Wait for system to be ready
echo "⏳ Waiting for system to be ready..."
sleep 2

# Function to setup Serena with retry logic
setup_serena_with_retry() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔧 Serena setup attempt $attempt/$max_attempts..."
        
        if ./scripts/setup_serena.sh 2>&1 | tee /tmp/serena_setup.log; then
            echo "✅ Serena setup successful on attempt $attempt"
            return 0
        else
            echo "⚠️ Serena setup failed on attempt $attempt"
            if [ $attempt -lt $max_attempts ]; then
                echo "⏳ Waiting 5 seconds before retry..."
                sleep 5
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo "❌ Serena setup failed after $max_attempts attempts"
    echo "🔍 Check /tmp/serena_setup.log for details"
    return 1
}

# Function to setup Sequential Thinking with retry logic
setup_sequential_thinking_with_retry() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔧 Sequential Thinking setup attempt $attempt/$max_attempts..."
        
        if ./scripts/setup_sequential_thinking.sh 2>&1 | tee /tmp/sequential_thinking_setup.log; then
            echo "✅ Sequential Thinking setup successful on attempt $attempt"
            return 0
        else
            echo "⚠️ Sequential Thinking setup failed on attempt $attempt"
            if [ $attempt -lt $max_attempts ]; then
                echo "⏳ Waiting 5 seconds before retry..."
                sleep 5
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo "❌ Sequential Thinking setup failed after $max_attempts attempts"
    echo "🔍 Check /tmp/sequential_thinking_setup.log for details"
    return 1
}

# Run setup with error handling
echo "🔧 Starting MCP server setup..."

if setup_serena_with_retry; then
    echo "✅ Serena MCP setup completed successfully"
else
    echo "❌ Serena MCP setup failed"
    exit 1
fi

if setup_sequential_thinking_with_retry; then
    echo "✅ Sequential Thinking MCP setup completed successfully"
else
    echo "❌ Sequential Thinking MCP setup failed"
    exit 1
fi

echo ""
echo "🎉 All MCP setup completed successfully!"
echo ""
echo "📋 Setup Summary:"
echo "  - Serena MCP server: ✅ Configured"
echo "  - Sequential Thinking MCP server: ✅ Configured"
echo "  - Environment: ✅ Ready"
echo ""
echo "📋 Next steps:"
echo "1. Restart your DevContainer to apply changes"
echo "2. Check that MCP servers appear in your available tools"
echo "3. Test MCP functionality with simple commands"
echo ""
echo "🔗 Useful commands:"
echo "  - Test Serena: uvx --from git+https://github.com/oraios/serena serena tools list"
echo "  - Test Sequential Thinking: npx -y @modelcontextprotocol/server-sequential-thinking --help"
echo ""
echo "🌐 Serena Web dashboard: http://127.0.0.1:24282/dashboard/index.html (when server is running)"
echo "========================================"