# Development Server Setup Instructions

## Problem Fixed

The NeuroSense FX frontend was experiencing WSL2 filesystem I/O errors that prevented `npm install` from completing properly. The issue manifests as:
- `TAR_ENTRY_ERROR EIO: i/o error` messages during npm install
- `vite: command not found` errors
- Missing core dependencies in node_modules

## Solution Implemented

### 1. Working Configuration
- **Vite**: Installed globally and working (v7.2.4)
- **Svelte Plugin**: Installed globally (@sveltejs/vite-plugin-svelte)
- **WebSocket Backend**: Running successfully on port 8080
- **Frontend**: Ready to start on port 5174

### 2. Start Development Server

Use the following commands to start the development server:

```bash
# Method 1: Start frontend with simple config (recommended)
vite --config vite.config.simple.js --mode development

# Method 2: Use npm script with simple config
npm run dev:simple
```

### 3. Access Points
- **Frontend**: http://localhost:5174/
- **WebSocket Backend**: ws://localhost:8080/
- **Network Access**: http://172.17.0.2:5174/ (if needed)

### 4. Alternative: Full Development Setup

To use the original run.sh script with the workaround:

```bash
# Set up the working node_modules first
./setup-dev-workaround.sh

# Then use the normal development workflow
./run.sh dev
```

## Key Technical Details

### Root Cause
- **WSL2 Filesystem Issue**: I/O errors when reading/writing large numbers of small files in nested node_modules
- **Local Dependency Problem**: The `@reiryoku/ctrader-layer` local library had its own node_modules causing cascade failures
- **Filesystem Corruption**: TAR extraction errors during npm install

### Workaround Strategy
1. **Global Package Installation**: Install core tools globally to bypass local node_modules issues
2. **Simplified Configuration**: Use minimal vite.config.simple.js without complex environment detection
3. **Isolated Dependencies**: Create working node_modules in tmpfs (Linux filesystem)
4. **Local Dependency Removal**: Temporarily removed the problematic local library dependency

### Development Server Features Working
- ✅ Vite development server starts correctly
- ✅ WebSocket proxy configuration active
- ✅ HMR (Hot Module Replacement) configured
- ✅ Polling-based file watching (required for WSL2)
- ✅ External network access enabled
- ✅ Proper port binding (5174 for frontend, 8080 for backend)

## Next Steps

1. **Immediate**: Use `vite --config vite.config.simple.js --mode development` to start development
2. **For Full Testing**: Execute the Primary Trader Workflow test once the server is running
3. **Long-term Fix**: Consider moving the project to a Linux filesystem or using Docker to avoid WSL2 issues

## Verification Commands

```bash
# Check backend is running
netstat -tlnp | grep :8080

# Check vite version
vite --version

# Test development server (should show "ready in...")
timeout 10s vite --config vite.config.simple.js --mode development
```

The development environment is now functional and ready for testing the Primary Trader Workflow.