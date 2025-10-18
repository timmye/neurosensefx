# Startup Process Fundamental Issues Analysis

## Critical Findings from Forensic Analysis

### Issue 1: Process Hierarchy Complexity
**Problem**: The current approach doesn't account for the actual process hierarchy:

```
npm run dev (parent)
├── npm (child 1)
├── vite (child 2)
    └── Multiple Vite subprocesses
```

**Root Cause**: When we run `nohup npm run dev > frontend.log 2>&1 &`, we're only backgrounding the npm process, not the entire process tree. The vite process and its children may still be attached to the terminal.

### Issue 2: Signal Handling Mismatch
**Problem**: The backend has proper SIGINT handling, but the frontend doesn't:

```javascript
// Backend (server.js) - Proper signal handling
process.on('SIGINT', async () => {
    console.log('Shutting down backend...');
    session.disconnect();
    wsServer.wss.close(() => {
        console.log('WebSocket server closed.');
        process.exit(0);
    });
});
```

**Root Cause**: Vite doesn't necessarily respond to SIGTERM the same way, and npm may not propagate signals properly to child processes.

### Issue 3: Port Binding Race Conditions
**Problem**: The status check happens immediately after startup, but processes may not be fully initialized:

```bash
# From run.sh
sleep 3  # Not enough time for Vite to fully start
if lsof -i:5173 >/dev/null 2>&1; then
    log "Frontend confirmed running on port 5173"
else
    log_warn "Frontend may not be running on port 5173"
fi
```

**Root Cause**: Vite takes time to compile and bind to the port, especially in container environments. The 3-second delay is insufficient.

### Issue 4: Process Orphaning in Interactive Terminals
**Problem**: When you run commands interactively, the process behavior is different from when I run them through tools:

**Root Cause**: Interactive terminals have different signal handling, TTY attachment, and process group management than non-interactive execution.

### Issue 5: No Process Tree Cleanup
**Problem**: The stop function kills individual processes but doesn't handle the entire process tree:

```bash
# Current approach - kills individual processes
pkill -f "npm.*run.*dev"
pkill -f "vite"

# Missing - doesn't kill child processes of npm/vite
```

## Radical Simplification Solution

### Core Principle: Process Group Management
Instead of tracking individual PIDs, we need to manage process groups properly.

### Solution 1: Use Process Groups
```bash
# Start with process group
set -m  # Enable job control
npm run dev &  # Creates new process group
FG_PID=$!  # Get the foreground process group ID

# Stop by killing the entire process group
kill -- -TERM $FG_PID  # Kills all processes in the group
```

### Solution 2: Use Screen/Tmux Sessions
```bash
# Start in detached screen session
screen -dmS neurosense-backend bash -c "cd services/tick-backend && node server.js"
screen -dmS neurosense-frontend bash -c "npm run dev"

# Stop by killing screen sessions
screen -S neurosense-backend -X quit
screen -S neurosense-frontend -X quit
```

### Solution 3: Use Systemd User Services
```ini
# ~/.config/systemd/user/neurosense-backend.service
[Unit]
Description=NeuroSense FX Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/projects/neurosense-fx/services/tick-backend
ExecStart=%h/.nvm/versions/node/v22.20.0/bin/node server.js
Restart=on-failure

[Install]
WantedBy=default.target
```

### Solution 4: Direct Process Management (Recommended)
The simplest, most reliable approach:

```bash
#!/bin/bash

# Ultra-simplified approach
start() {
    echo "Starting services..."
    
    # Kill any existing processes first
    pkill -f "node.*server.js" || true
    pkill -f "vite" || true
    sleep 2
    
    # Start backend directly
    cd services/tick-backend
    nohup node server.js > ../../backend.log 2>&1 &
    cd ..
    
    # Start frontend directly (bypass npm)
    nohup npx vite > frontend.log 2>&1 &
    
    echo "Services started. Check with: ./run.sh status"
}

stop() {
    echo "Stopping services..."
    
    # Kill by process name
    pkill -f "node.*server.js" || true
    pkill -f "vite" || true
    
    # Wait and force kill if needed
    sleep 3
    pkill -9 -f "node.*server.js" || true
    pkill -9 -f "vite" || true
    
    echo "Services stopped"
}

status() {
    echo "=== Service Status ==="
    
    # Simple process checks
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "Backend: RUNNING"
    else
        echo "Backend: STOPPED"
    fi
    
    if pgrep -f "vite" > /dev/null; then
        echo "Frontend: RUNNING"
    else
        echo "Frontend: STOPPED"
    fi
}
```

## Why the Simplified Approach Works

### 1. Bypasses npm Process Tree
By calling `npx vite` directly, we avoid the npm → vite process hierarchy that causes signal propagation issues.

### 2. Simple Process Identification
Using `pgrep -f "pattern"` is more reliable than port-based detection, especially during startup.

### 3. No Complex PID Tracking
We don't need PID files when we can identify processes by their command patterns.

### 4. Immediate Signal Handling
Direct process killing ensures signals reach the target processes without propagation delays.

### 5. No Terminal Attachment Issues
By using simple backgrounding with nohup, we avoid TTY attachment problems.

## Implementation Strategy

### Phase 1: Immediate Fix
- Implement the ultra-simplified approach
- Test thoroughly in interactive terminals
- Ensure no hanging or waiting

### Phase 2: Enhanced Monitoring
- Add better status detection
- Implement startup verification
- Add error handling for edge cases

### Phase 3: Advanced Features (Optional)
- Add log rotation
- Implement health checks
- Add automatic restart capabilities

## Success Criteria

1. **No hanging**: All commands return immediately in interactive terminals
2. **Reliable stopping**: Processes actually stop when commanded
3. **Accurate status**: Status reflects actual process state
4. **Simple debugging**: Easy to understand what's happening
5. **Minimal complexity**: Under 50 lines of code total

## Risk Mitigation

1. **Backup current script**: Keep the existing version as fallback
2. **Test incrementally**: Test stop functionality before start
3. **Monitor logs**: Watch for any unexpected behavior
4. **Rollback plan**: Quick revert to previous version if needed

The key insight is that we've been over-engineering the solution. The simplest approach—direct process management without npm wrappers—is likely the most reliable.