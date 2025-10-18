#!/bin/bash

# NeuroSense FX Service Management Script - Emergency Fix
# Fire-and-forget approach to prevent terminal hanging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function with immediate output
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" >&2
}

# Emergency stop - fire-and-forget, no waiting
stop() {
    log "Stopping services..."
    
    # Direct killing - no background subshell
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "npm.*run.*dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    # Return immediately - don't wait for processes to die
    log "Services stop initiated"
}

# Start with immediate return
start() {
    log "Starting services..."
    
    # Stop first (fire-and-forget)
    stop
    
    # Small delay to let stop begin
    sleep 1
    
    # Start backend with proper detachment
    log "Starting backend..."
    cd services/tick-backend
    # Use nohup with proper I/O redirection and disown
    nohup node server.js > ../../backend.log 2>&1 &
    # Disown the process to detach it from the shell
    disown $! 2>/dev/null || true
    cd - > /dev/null
    
    # Start frontend with proper detachment
    log "Starting frontend..."
    # Use nohup with proper I/O redirection and disown
    nohup npm run dev > frontend.log 2>&1 &
    # Disown the process to detach it from the shell
    disown $! 2>/dev/null || true
    
    # Return immediately - don't wait for services to start
    log "Services start initiated"
    log "Backend: http://localhost:8080"
    log "Frontend: http://localhost:5173"
    log "Check status with: ./run.sh status"
}

# Quick status check - no waiting
status() {
    echo "=== NeuroSense FX Service Status ==="
    
    # Check backend
    if pgrep -f "node.*server.js" > /dev/null; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        echo "Backend:  RUNNING (PID: $backend_pid)"
    else
        echo "Backend:  STOPPED"
    fi
    
    # Check frontend
    if pgrep -f "vite" > /dev/null; then
        local frontend_pid=$(pgrep -f "vite" | head -1)
        echo "Frontend: RUNNING (PID: $frontend_pid)"
    else
        echo "Frontend: STOPPED"
    fi
    
    echo ""
    echo "=== Access URLs ==="
    echo "Frontend: http://localhost:5173"
    echo "Backend:  ws://localhost:8080"
}

# Show logs
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

# Restart with immediate return
restart() {
    log "Restarting services..."
    stop
    sleep 2
    start
}

# Show usage
usage() {
    echo "NeuroSense FX Service Management - Emergency Version"
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Commands:"
    echo "  start   - Start all services (immediate return)"
    echo "  stop    - Stop all services (immediate return)"
    echo "  restart - Restart all services (immediate return)"
    echo "  status  - Show service status"
    echo "  logs    - Show service logs (all|backend|frontend)"
    echo ""
    echo "Note: All commands return immediately. Use status to check results."
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

# Always return immediately
exit 0
