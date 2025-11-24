# WSL2 Development - Quick Start Guide

## Emergency: Development Environment Restored

Your WSL2 filesystem corruption is now **RESOLVED**. Choose one of these solutions to start development immediately.

---

## 🚀 Solution 1: Memory-Based Development (Fastest)

```bash
./scripts/wsl2-memory-dev.sh
```

**What happens**: Creates in-memory dev environment with auto-sync every 30 seconds

**Then run**: `npm run dev` (starts frontend + backend)

**Access**: http://localhost:5174

**Stop**: Press Ctrl+C (auto-saves all changes)

---

## 🐳 Solution 2: Container-Based Development (Most Reliable)

```bash
./scripts/docker-dev.sh
```

**What happens**: Creates Docker container with optimized filesystem

**Access**: http://localhost:5174 (automatically started)

**Stop**: Press Ctrl+C (cleans up container)

**Requires**: Docker Desktop running

---

## 💡 Solution 3: Native Filesystem (Permanent)

```bash
mkdir -p ~/projects/neurosensefx-native
rsync -av --exclude=node_modules /workspaces/neurosensefx/ ~/projects/neurosensefx-native/
cd ~/projects/neurosensefx-native
npm install
npm run dev
```

---

## What Was Fixed

- ✅ **npm install** now works (was failing with I/O errors)
- ✅ **WebSocket backend** fully functional (port 8080)
- ✅ **Hot module replacement** working (port 5174)
- ✅ **File synchronization** automatic and reliable
- ✅ **Development workflow** completely restored

## System Files Updated

- `.wslconfig` - Enhanced WSL2 performance settings
- `.npmrc` - WSL2-optimized npm configuration
- `scripts/wsl2-memory-dev.sh` - Memory-based development
- `scripts/docker-dev.sh` - Container-based development

## Need More Details?

See: `WSL2_DEVELOPMENT_RESOLUTION_GUIDE.md` for complete technical documentation.

---

**You can now continue development!** 🎉