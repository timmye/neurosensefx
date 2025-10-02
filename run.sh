#!/bin/bash

# NeuroSense FX Service Management Script
# Unified interface for starting, stopping, and managing all services

set -e

# Configuration
BACKEND_DIR="services/tick-backend"
BACKEND_LOG="backend.log"
BACKEND_PID_FILE="backend.pid"
FRONTEND_PID_FILE="frontend.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Check if a process is running
is_running() {
    local pid_file=$1
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# Start backend service
start_backend() {
    if is_running "$BACKEND_PID_FILE"; then
        log "Backend is already running (PID: $(cat $BACKEND_PID_FILE))"
        return 0
    fi
    
    log "Starting backend service..."
    
    # Start backend in background with logging
    cd "$BACKEND_DIR"
    nohup node server.js > "../$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    cd - > /dev/null
    
    # Save PID
    echo $backend_pid > "$BACKEND_PID_FILE"
    
    # Wait a moment for startup
    sleep 2
    
    # Check if process is still running and responding
    if kill -0 $backend_pid 2>/dev/null; then
        # Additional health check - see if it's listening on the expected port
        if netstat -tlnp 2>/dev/null | grep -q "8080"; then
            log "Backend started successfully (PID: $backend_pid)"
            log "Backend logs: $BACKEND_LOG"
            return 0
        else
            log_warn "Backend process running but not listening on port 8080"
            # Check recent log entries for errors
            if [[ -f "../$BACKEND_LOG" ]]; then
                tail -n 10 "../$BACKEND_LOG" | log_warn
            fi
            kill $backend_pid 2>/dev/null || true
            rm -f "$BACKEND_PID_FILE"
            return 1
        fi
    else
        log_error "Failed to start backend - process exited immediately"
        # Check recent log entries for errors
        if [[ -f "../$BACKEND_LOG" ]]; then
            tail -n 10 "../$BACKEND_LOG" | log_error
        fi
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

# Start frontend service
start_frontend() {
    if is_running "$FRONTEND_PID_FILE"; then
        log "Frontend is already running (PID: $(cat $FRONTEND_PID_FILE))"
        return 0
    fi
    
    log "Starting frontend service..."
    
    # Start frontend in background
    nohup npm run dev > frontend.log 2>&1 &
    local frontend_pid=$!
    
    # Save PID
    echo $frontend_pid > "$FRONTEND_PID_FILE"
    
    # Wait a moment for startup
    sleep 5
    
    # Check if process is still running and responding
    if kill -0 $frontend_pid 2>/dev/null; then
        # Debug: Show what netstat sees
        netstat_output=$(netstat -tlnp 2>/dev/null | grep "5173" || echo "No match")
        log "DEBUG: Netstat output for 5173: $netstat_output"
        log "DEBUG: Current working directory: $(pwd)"
        
        # Additional health check - see if it's listening on the expected port
        # Try curl as an alternative to netstat
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            log "Frontend started successfully (PID: $frontend_pid) - verified with curl"
            log "Frontend logs: frontend.log"
            log "Access application at: http://localhost:5173"
            return 0
        elif netstat -tlnp 2>/dev/null | grep -q "5173"; then
            log "Frontend started successfully (PID: $frontend_pid)"
            log "Frontend logs: frontend.log"
            log "Access application at: http://localhost:5173"
            return 0
        else
            log_warn "Frontend process running but not listening on port 5173"
            # Check recent log entries for errors
            if [[ -f "frontend.log" ]]; then
                tail -n 10 "frontend.log" | log_warn
            fi
            kill $frontend_pid 2>/dev/null || true
            rm -f "$FRONTEND_PID_FILE"
            return 1
        fi
    else
        log_error "Failed to start frontend - process exited immediately"
        # Check recent log entries for errors
        if [[ -f "frontend.log" ]]; then
            tail -n 10 "frontend.log" | log_error
        fi
        rm -f "$FRONTEND_PID_FILE"
        return 1
    fi
}

# Stop backend service
stop_backend() {
    if [[ -f "$BACKEND_PID_FILE" ]]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        log "Stopping backend (PID: $pid)..."
        if kill $pid 2>/dev/null; then
            rm -f "$BACKEND_PID_FILE"
            log "Backend stopped successfully"
        else
            log_warn "Backend process not found, cleaning up PID file"
            rm -f "$BACKEND_PID_FILE"
        fi
    else
        log "Backend is not running"
    fi
}

# Stop frontend service
stop_frontend() {
    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        log "Stopping frontend (PID: $pid)..."
        if kill $pid 2>/dev/null; then
            rm -f "$FRONTEND_PID_FILE"
            log "Frontend stopped successfully"
        else
            log_warn "Frontend process not found, cleaning up PID file"
            rm -f "$FRONTEND_PID_FILE"
        fi
    else
        log "Frontend is not running"
    fi
}

# Check service status
status() {
    log "=== Service Status ==="
    
    if is_running "$BACKEND_PID_FILE"; then
        log "Backend: ${GREEN}RUNNING${NC} (PID: $(cat $BACKEND_PID_FILE))"
    else
        log "Backend: ${RED}STOPPED${NC}"
    fi
    
    if is_running "$FRONTEND_PID_FILE"; then
        log "Frontend: ${GREEN}RUNNING${NC} (PID: $(cat $FRONTEND_PID_FILE))"
    else
        log "Frontend: ${RED}STOPPED${NC}"
    fi
    
    log "=== Port Status ==="
    if command -v netstat >/dev/null 2>&1; then
        log "Port 8080 (Backend): $(if netstat -tlnp 2>/dev/null | grep -q '8080'; then echo -e "${GREEN}LISTENING${NC}"; else echo -e "${RED}NOT LISTENING${NC}"; fi)"
        log "Port 5173 (Frontend): $(if netstat -tlnp 2>/dev/null | grep -q '5173'; then echo -e "${GREEN}LISTENING${NC}"; else echo -e "${RED}NOT LISTENING${NC}"; fi)"
    else
        log "netstat not available, skipping port check"
    fi
}

# View logs
logs() {
    local service=${1:-"all"}
    
    case $service in
        "backend")
            if [[ -f "$BACKEND_LOG" ]]; then
                log "Showing backend logs (Ctrl+C to exit):"
                tail -f "$BACKEND_LOG"
            else
                log "Backend log file not found: $BACKEND_LOG"
            fi
            ;;
        "frontend")
            if [[ -f "frontend.log" ]]; then
                log "Showing frontend logs (Ctrl+C to exit):"
                tail -f "frontend.log"
            else
                log "Frontend log file not found: frontend.log"
            fi
            ;;
        "all"|*)
            log "Showing all logs (Ctrl+C to exit):"
            if [[ -f "$BACKEND_LOG" ]] && [[ -f "frontend.log" ]]; then
                tail -f "$BACKEND_LOG" "frontend.log"
            elif [[ -f "$BACKEND_LOG" ]]; then
                tail -f "$BACKEND_LOG"
            elif [[ -f "frontend.log" ]]; then
                tail -f "frontend.log"
            else
                log "No log files found"
            fi
            ;;
    esac
}

# Clean up old processes
cleanup() {
    log "Cleaning up old processes..."
    
    # Kill any existing backend processes
    pkill -f "node.*server.js" 2>/dev/null || true
    
    # Kill any existing frontend processes
    pkill -f "vite" 2>/dev/null || true
    
    # Remove PID files
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
    
    log "Cleanup complete"
}

# Main start function - start both services
start() {
    log "=== NeuroSense FX Startup ==="
    
    # Clean up old processes
    cleanup
    
    # Update submodules - SKIPPED for monorepo migration
    # if [[ -d ".git" ]]; then
    #     log "Updating submodules..."
    #     git submodule update --init --recursive || log_warn "Failed to update submodules"
    # fi
    
    # Start services
    if start_backend && start_frontend; then
        log "=== All Services Started Successfully ==="
        log "Frontend: http://localhost:5173"
        log "Backend WebSocket: ws://localhost:8080"
        log "Use './run.sh logs' to view service logs"
    else
        log_error "Failed to start one or more services"
        exit 1
    fi
}

# Stop all services
stop() {
    log "=== Stopping All Services ==="
    stop_backend
    stop_frontend
    log "=== All Services Stopped ==="
}

# Show usage
usage() {
    echo "Usage: $0 {start|stop|status|logs|cleanup}"
    echo
    echo "Commands:"
    echo "  start     - Start all services (backend and frontend)"
    echo "  stop      - Stop all services"
    echo "  status    - Check service status"
    echo "  logs      - View service logs (use: logs backend|frontend|all)"
    echo "  cleanup   - Clean up old processes"
    echo
    echo "Examples:"
    echo "  $0 start          # Start all services"
    echo "  $0 logs backend   # View backend logs"
    echo "  $0 status         # Check service status"
}

# Main execution
case "${1:-}" in
    "start")
        start
        ;;
    "stop")
        stop
        ;;
    "status")
        status
        ;;
    "logs")
        logs "${2:-all}"
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        usage
        exit 1
        ;;
esac