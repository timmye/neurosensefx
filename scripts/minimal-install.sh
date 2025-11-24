#!/bin/bash

# Minimal Core Dependencies Installation for WSL2
# Only installs essential dependencies to avoid inode exhaustion

set -e

echo "🎯 Installing Minimal Core Dependencies"

# Clean environment
rm -rf node_modules package-lock.json

# Create minimal package.json for development
cat > package-minimal.json << 'EOF'
{
  "name": "neurosense-fx-minimal",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --mode development",
    "build": "vite build"
  },
  "dependencies": {
    "svelte": "^4.2.7",
    "d3": "^7.9.0",
    "ws": "^8.18.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.0.1",
    "vite": "^5.4.19"
  }
}
EOF

echo "📦 Installing minimal core dependencies..."
npm config set maxsockets 1
npm config set progress false
npm config set bin-links false

# Install minimal dependencies
npm install --production --no-optional

echo "✅ Minimal installation completed"
echo "🚀 Run 'npm run dev' to start development server"
echo ""
echo "⚠️  Note: Testing and linting dependencies omitted for WSL2 stability"