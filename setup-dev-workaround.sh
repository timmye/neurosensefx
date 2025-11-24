#!/bin/bash
# Development Server Setup Workaround for WSL2 I/O Issues

echo "🔧 Setting up NeuroSense FX development environment..."
echo "This works around WSL2 filesystem I/O issues with npm dependencies"
echo

# Check if required global packages are installed
echo "📦 Checking global packages..."
if ! command -v vite &> /dev/null; then
    echo "Installing vite globally..."
    npm install --global vite
fi

if ! npm list -g @sveltejs/vite-plugin-svelte &> /dev/null; then
    echo "Installing @sveltejs/vite-plugin-svelte globally..."
    npm install --global @sveltejs/vite-plugin-svelte
fi

# Create working node_modules in tmpfs if needed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/vite/package.json" ]; then
    echo "🏗️  Setting up working node_modules..."
    rm -rf node_modules

    # Create isolated working directory
    mkdir -p /tmp/vite-workaround
    cd /tmp/vite-workaround

    # Install core packages in tmpfs (Linux filesystem)
    npm init -y
    npm install vite @sveltejs/vite-plugin-svelte

    # Copy back to project
    cd /workspaces/neurosensefx
    cp -r /tmp/vite-workaround/node_modules .

    echo "✅ Working node_modules created"
fi

# Check backend service
echo "🔗 Checking WebSocket backend..."
if netstat -tlnp | grep -q ":8080.*LISTEN"; then
    echo "✅ WebSocket backend is running on port 8080"
else
    echo "⚠️  WebSocket backend not detected on port 8080"
    echo "   Start it with: ./run.sh start"
fi

echo
echo "🚀 Development environment ready!"
echo
echo "Start the development server with:"
echo "  vite --config vite.config.simple.js --mode development"
echo
echo "Or use npm script:"
echo "  npm run dev:simple"
echo
echo "Access points:"
echo "  Frontend: http://localhost:5174/"
echo "  Backend:  ws://localhost:8080/"