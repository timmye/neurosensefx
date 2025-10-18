# Terminal Hanging Emergency Fix

## Critical Issue
The stop command is still hanging the terminal, which means we need to implement an even more aggressive approach to ensure immediate command return.

## Root Cause of Hanging
The terminal hangs when:
1. **Commands wait for process termination** instead of returning immediately
2. **Subprocesses don't die properly** and keep the script waiting
3. **I/O redirection blocks** waiting for output that never comes
4. **Signal handling waits** for confirmation that never arrives

## Emergency Solution: Fire-and-Forget Approach

### Principle: Immediate Return + Background Cleanup
Instead of waiting for processes to die, we return immediately and let cleanup happen in the background.

### Ultra-Minimalist Implementation
```bash
#!/bin/bash

# Emergency fix - immediate return, no waiting
stop() {
    echo "Stopping services..." >&2
    
    # Fire-and-forget killing - no waiting
    {
        pkill -f "node.*server.js" 2>/dev/null || true
        pkill -f "npm.*run.*dev" 2>/dev/null || true
        pkill -f "vite" 2>/dev/null || true
        sleep 2
        pkill -9 -f "node.*server.js" 2>/dev/null || true
        pkill -9 -f "npm.*run.*dev" 2>/dev/null || true
        pkill -9 -f "vite" 2>/dev/null || true
    } &
    
    # Return immediately - don't wait for background cleanup
    echo "Services stop initiated" >&2
}

start() {
    echo "Starting services..." >&2
    
    # Stop first (fire-and-forget)
    stop
    
    # Start with immediate return
    {
        cd services/tick-backend
        nohup node server.js > ../../backend.log 2>&1 &
        cd - > /dev/null
        
        nohup npm run dev > frontend.log 2>&1 &
    } &
    
    echo "Services start initiated" >&2
}

status() {
    echo "=== Service Status ==="
    
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

case "${1:-}" in
    "stop")
        stop
        ;;
    "start")
        start
        ;;
    "status")
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac

# Always return immediately
exit 0
```

## Alternative: Direct System Calls
If the above still hangs, we need to bypass shell process management entirely:

```bash
#!/bin/bash

# System call approach - bypass shell process management
stop() {
    echo "Stopping services..." >&2
    
    # Use system calls directly
    kill -9 $(pgrep -f "node.*server.js" 2>/dev/null) 2>/dev/null || true
    kill -9 $(pgrep -f "npm.*run.*dev" 2>/dev/null) 2>/dev/null || true
    kill -9 $(pgrep -f "vite" 2>/dev/null) 2>/dev/null || true
    
    echo "Services stopped" >&2
}

start() {
    echo "Starting services..." >&2
    
    # Stop first
    stop
    
    # Start with system calls
    cd services/tick-backend
    node server.js > ../../backend.log 2>&1 &
    BACKEND_PID=$!
    cd - > /dev/null
    
    npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    echo "Backend PID: $BACKEND_PID" >&2
    echo "Frontend PID: $FRONTEND_PID" >&2
    echo "Services started" >&2
}
```

## Alternative: Port-Based Killing
If process name matching fails, use port-based approach:

```bash
stop() {
    echo "Stopping services..." >&2
    
    # Kill by port - most reliable
    fuser -k 8080/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
    
    # Wait a moment for port release
    sleep 1
    
    echo "Services stopped" >&2
}
```

## Alternative: External Process Manager
If all else fails, use an external process manager:

```bash
stop() {
    echo "Stopping services..." >&2
    
    # Use timeout to prevent hanging
    timeout 5s bash -c "
        pkill -f 'node.*server.js' || true
        pkill -f 'npm.*run.*dev' || true
        pkill -f 'vite' || true
        sleep 2
        pkill -9 -f 'node.*server.js' || true
        pkill -9 -f 'npm.*run.*dev' || true
        pkill -9 -f 'vite' || true
    " || true
    
    echo "Services stopped" >&2
}
```

## Testing Strategy

1. **Test stop command first** - ensure it returns immediately
2. **Test with timeout** - use `timeout 3s ./run.sh stop` to verify
3. **Test in different terminals** - ensure consistent behavior
4. **Test with services running** - verify actual stopping works

## Implementation Priority

1. **Fire-and-forget approach** (most likely to work)
2. **Direct system calls** (if #1 fails)
3. **Port-based killing** (if #2 fails)
4. **External process manager** (last resort)

## Key Principle

**NEVER WAIT FOR ANYTHING** - Every command must return immediately, regardless of what processes are doing.

The hanging is caused by the script waiting for something. The solution is to never wait for anything.