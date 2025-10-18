# Simplified Run Script Implementation Plan

## Problem Statement
The current `run.sh` script is overly complex, causing hangs and reliability issues. The stop/start process has become convoluted with excessive PID tracking, diagnostic logging, and retry logic that creates more problems than it solves.

## Solution Overview
Replace the current complex script with a simple, direct approach that:
1. Uses port-based process identification instead of PID files
2. Implements direct process killing without complex retry logic
3. Removes unnecessary diagnostic logging and timeouts
4. Provides clear, immediate feedback

## New Script Structure

### Core Functions

#### 1. Simple Stop Function
```bash
stop() {
    echo "Stopping all services..."
    
    # Kill processes on ports directly (most reliable)
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:8080 | xargs -r kill -9 2>/dev/null || true
        lsof -ti:5173 | xargs -r kill -9 2>/dev/null || true
    fi
    
    # Kill by process name as backup
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "npm.*run.*dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    # Clean up any remaining PID files
    rm -f backend.pid frontend.pid
    
    echo "All services stopped"
}
```

#### 2. Simple Start Function
```bash
start() {
    echo "Starting NeuroSense FX services..."
    
    # Stop any existing processes first
    stop
    
    # Start backend
    echo "Starting backend service..."
    cd services/tick-backend
    nohup node server.js > ../../backend.log 2>&1 &
    cd - > /dev/null
    echo "Backend started on port 8080"
    
    # Start frontend
    echo "Starting frontend service..."
    nohup npm run dev > frontend.log 2>&1 &
    echo "Frontend starting on port 5173..."
    
    echo ""
    echo "=== Services Started ==="
    echo "Frontend: http://localhost:5173"
    echo "Backend:  ws://localhost:8080"
    echo "Logs: ./run.sh logs"
    echo "Status: ./run.sh status"
}
```

#### 3. Simple Status Function
```bash
status() {
    echo "=== NeuroSense FX Service Status ==="
    
    # Check backend
    if lsof -i:8080 >/dev/null 2>&1; then
        local backend_pid=$(lsof -ti:8080 2>/dev/null)
        echo "Backend:  RUNNING (PID: $backend_pid, Port: 8080)"
    else
        echo "Backend:  STOPPED"
    fi
    
    # Check frontend
    if lsof -i:5173 >/dev/null 2>&1; then
        local frontend_pid=$(lsof -ti:5173 2>/dev/null)
        echo "Frontend: RUNNING (PID: $frontend_pid, Port: 5173)"
    else
        echo "Frontend: STOPPED"
    fi
    
    echo ""
    echo "=== Access URLs ==="
    echo "Frontend: http://localhost:5173"
    echo "Backend:  ws://localhost:8080"
}
```

#### 4. Simple Logs Function
```bash
logs() {
    local service=${1:-"all"}
    
    case $service in
        "backend")
            if [ -f "backend.log" ]; then
                echo "=== Backend Logs ==="
                tail -f backend.log
            else
                echo "No backend log file found"
            fi
            ;;
        "frontend")
            if [ -f "frontend.log" ]; then
                echo "=== Frontend Logs ==="
                tail -f frontend.log
            else
                echo "No frontend log file found"
            fi
            ;;
        "all"|*)
            echo "=== All Logs ==="
            if [ -f "backend.log" ] && [ -f "frontend.log" ]; then
                tail -f backend.log frontend.log
            elif [ -f "backend.log" ]; then
                tail -f backend.log
            elif [ -f "frontend.log" ]; then
                tail -f frontend.log
            else
                echo "No log files found"
            fi
            ;;
    esac
}
```

#### 5. Simple Restart Function
```bash
restart() {
    echo "Restarting services..."
    stop
    sleep 2
    start
}
```

### Complete Script Structure
```bash
#!/bin/bash

# NeuroSense FX Service Management Script - Simplified Version
# Direct, reliable process management without complexity

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

# Core functions (as defined above)
stop() { ... }
start() { ... }
status() { ... }
logs() { ... }
restart() { ... }

# Usage function
usage() {
    echo "NeuroSense FX Service Management"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Commands:"
    echo "  start   - Start all services (backend + frontend)"
    echo "  stop    - Stop all services"
    echo "  restart - Restart all services"
    echo "  status  - Show service status"
    echo "  logs    - Show service logs (all|backend|frontend)"
    echo ""
    echo "Examples:"
    echo "  $0 start           # Start all services"
    echo "  $0 logs frontend   # Show frontend logs only"
    echo "  $0 status          # Check service status"
}

# Main execution
case "${1:-}" in
    "start")
        start
        ;;
    "stop")
        stop
        ;;
    "restart")
        restart
        ;;
    "status")
        status
        ;;
    "logs")
        logs "${2:-all}"
        ;;
    *)
        usage
        exit 1
        ;;
esac
```

## Key Improvements

### 1. Elimination of Complexity
- **No PID files** - Uses port-based identification
- **No retry logic** - Direct execution with immediate results
- **No diagnostic logging** - Simple, clear output
- **No container/host detection** - Same approach works everywhere

### 2. Reliability Focus
- **Direct process killing** - Uses `kill -9` for immediate termination
- **Multiple fallback methods** - Port-based + process name killing
- **Clean state** - Always stops before starting
- **Clear feedback** - Immediate status updates

### 3. Simplicity
- **50% less code** - From 732 lines to ~150 lines
- **Clear function names** - Self-documenting code
- **Consistent patterns** - Same approach for all operations
- **Easy debugging** - Straightforward execution flow

## Implementation Steps

1. **Backup current script** - Save existing run.sh as run.sh.backup
2. **Create new simplified script** - Implement the structure above
3. **Test basic functionality** - Verify start/stop works correctly
4. **Test edge cases** - Verify behavior with already running/stopped services
5. **Update documentation** - Update any references to complex features

## Testing Plan

### Basic Functionality Tests
1. **Start from clean state** - Verify both services start correctly
2. **Stop from running state** - Verify both services stop immediately
3. **Restart** - Verify stop + start sequence works
4. **Status check** - Verify accurate status reporting
5. **Log access** - Verify log viewing works correctly

### Edge Case Tests
1. **Start when already running** - Should stop and restart cleanly
2. **Stop when already stopped** - Should handle gracefully
3. **Multiple start commands** - Should not create duplicate processes
4. **Log access without logs** - Should handle missing files gracefully

### Success Criteria
- **Start time**: <5 seconds
- **Stop time**: <2 seconds
- **Reliability**: 100% success rate for basic operations
- **No hangs**: Script never hangs or waits indefinitely
- **Clear output**: User always knows what's happening

## Rollback Plan

If issues arise with the simplified approach:
1. **Restore backup** - `mv run.sh.backup run.sh`
2. **Document issues** - Note what didn't work with simplified approach
3. **Iterative improvement** - Address specific issues while maintaining simplicity

## Conclusion

This simplified approach addresses the core issues with the current script:
- **Eliminates complexity** that causes hangs and reliability issues
- **Provides immediate feedback** for better user experience
- **Maintains all essential functionality** while being more reliable
- **Easy to understand and modify** for future maintenance

The new script follows the KISS principle and focuses on doing the essential tasks well, rather than trying to handle every possible edge case.