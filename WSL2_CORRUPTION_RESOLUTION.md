# WSL2 Filesystem Corruption Resolution

## Root Cause Analysis
- **Filesystem**: v9fs (Plan 9) with only 999 inodes total
- **Corruption Type**: Severe I/O errors preventing npm installation
- **Location**: `/workspaces/neurosensefx` mounted from Windows C:\
- **Kernel**: Linux 5.15.167.4-microsoft-standard-WSL2

## Technical Issues Identified
1. **Inode Exhaustion**: Complex node_modules require thousands of inodes, only 999 available
2. **9P Protocol Limitations**: Cannot handle deep nested directory structures
3. **Cross-platform Metadata Corruption**: Windows NTFS vs Linux filesystem conflicts
4. **File Locking Failures**: npm concurrent operations fail due to inadequate locking

## Immediate Workaround Solutions

### Option 1: Memory-Based Development (RECOMMENDED)
```bash
./scripts/wsl2-memory-dev.sh
```
Creates in-memory development environment bypassing filesystem limitations.

### Option 2: Container Development (MOST RELIABLE)
```bash
# Use Docker/Podman containers mounted to local filesystem
docker run -v $(pwd):/app -w /app -p 5174:5174 node:18-alpine npm run dev
```

### Option 3: Alternative Filesystem
Move development to native Linux filesystem (not Windows-mounted paths):
```bash
mkdir -p ~/projects && cp -r /workspaces/neurosensefx ~/projects/
cd ~/projects/neurosensefx && npm install
```

## Long-Term Resolution

### Windows Host Configuration
Create `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
memory=4GB
swap=4GB
processors=4
experimental=true
```

### WSL2 Distribution Recommandation
Consider switching to WSL2 with ext4 backend instead of Windows-mounted drives for development.

## Status: FILESYSTEM UNUSABLE FOR NPM OPERATIONS
The 9P filesystem corruption is severe enough that conventional npm installation will continue to fail.
Use memory-based or containerized development workflows until resolved.