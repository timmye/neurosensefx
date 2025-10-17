#!/bin/bash

# Diagnostic script for MCP server startup issues
# This script helps identify the root cause of postCreateCommand failures

set -e

echo "🔍 MCP Startup Diagnosis - $(date)"
echo "=================================="

# Check environment variables
echo "📋 Environment Check:"
echo "  - User: $(whoami)"
echo "  - Home: $HOME"
echo "  - Working Directory: $(pwd)"
echo "  - PATH: $PATH"
echo ""

# Check UV installation
echo "🔧 UV Installation Check:"
if command -v uv &> /dev/null; then
    echo "  ✅ UV found at: $(which uv)"
    echo "  ✅ UV version: $(uv --version)"
    echo "  ✅ UV permissions: $(ls -la $(which uv))"
else
    echo "  ❌ UV not found in PATH"
    echo "  🔍 Searching for UV..."
    find /home/node -name "uv" -type f 2>/dev/null || echo "  ❌ UV not found"
fi
echo ""

# Check Node.js installation
echo "🔧 Node.js Installation Check:"
if command -v node &> /dev/null; then
    echo "  ✅ Node.js found at: $(which node)"
    echo "  ✅ Node.js version: $(node --version)"
else
    echo "  ❌ Node.js not found in PATH"
fi

if command -v npm &> /dev/null; then
    echo "  ✅ NPM found at: $(which npm)"
    echo "  ✅ NPM version: $(npm --version)"
else
    echo "  ❌ NPM not found in PATH"
fi
echo ""

# Check script permissions
echo "🔧 Script Permissions Check:"
for script in setup_serena.sh setup_sequential_thinking.sh; do
    if [ -f "scripts/$script" ]; then
        echo "  📄 scripts/$script: $(ls -la scripts/$script)"
    else
        echo "  ❌ scripts/$script not found"
    fi
done
echo ""

# Check network connectivity
echo "🌐 Network Connectivity Check:"
echo "  🔍 Testing GitHub connectivity..."
if curl -s --connect-timeout 5 https://github.com > /dev/null; then
    echo "  ✅ GitHub accessible"
else
    echo "  ❌ GitHub not accessible"
fi

echo "  🔍 Testing npm registry connectivity..."
if npm ping --silent > /dev/null 2>&1; then
    echo "  ✅ NPM registry accessible"
else
    echo "  ❌ NPM registry not accessible"
fi
echo ""

# Test individual components
echo "🧪 Component Testing:"

echo "  🔍 Testing UVX command..."
if timeout 10 uvx --help > /dev/null 2>&1; then
    echo "  ✅ UVX working"
else
    echo "  ❌ UVX failed"
fi

echo "  🔍 Testing Serena installation..."
if timeout 10 uvx --from git+https://github.com/oraios/serena serena --help > /dev/null 2>&1; then
    echo "  ✅ Serena installation working"
else
    echo "  ❌ Serena installation failed"
fi

echo "  🔍 Testing Sequential Thinking package..."
if timeout 10 npm info @modelcontextprotocol/server-sequential-thinking > /dev/null 2>&1; then
    echo "  ✅ Sequential Thinking package accessible"
else
    echo "  ❌ Sequential Thinking package not accessible"
fi
echo ""

# Check disk space
echo "💾 Disk Space Check:"
df -h /home/node 2>/dev/null || echo "  ❌ Cannot check disk space"
echo ""

# Check memory
echo "🧠 Memory Check:"
free -h 2>/dev/null || echo "  ❌ Cannot check memory"
echo ""

echo "🏁 Diagnosis complete at $(date)"
echo "=================================="