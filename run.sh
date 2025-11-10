#!/bin/bash

# NeuroSense FX Service Management Script - LLM-Aware Version
# Enhanced for LLM developer awareness with clear status signaling

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Enhanced logging with status prefixes
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}✅${NC} $1" >&2
}

log_error() {
    echo -e "${RED}❌${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1" >&2
}

log_info() {
    echo -e "${BLUE}ℹ️${NC} $1" >&2
}

# Service status verification functions
check_backend_ready() {
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if pgrep -f "node.*server.js" > /dev/null; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

check_frontend_ready() {
    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:5174 > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

check_recent_errors() {
    local log_file="$1"
    local recent_minutes=5

    if [ -f "$log_file" ]; then
        # Check for errors in recent log entries
        if find "$log_file" -mmin -$recent_minutes 2>/dev/null | grep -q .; then
            if grep -i "error\|failed\|exception\|cannot\|unable" "$log_file" | tail -5 | grep -q .; then
                return 0
            fi
        fi
    fi
    return 1
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

# Development mode with hot reload and LLM-aware status verification
dev() {
    log_info "Starting LLM-aware development environment..."
    log_info "🔄 HMR enabled - changes will auto-refresh browser"
    log_info "📝 Frontend logs: Terminal, Backend logs: backend.log"
    log_info "🛑 Use Ctrl+C to stop development server"

    # Stop existing services first
    stop
    sleep 2

    # Clear previous logs for clean state
    > backend.log
    > frontend.log
    log_info "🗑️  Cleared previous log files"

    # Start backend with status tracking
    echo ""
    log_info "🔧 Starting backend service..."
    cd services/tick-backend
    nohup node server.js > ../../backend.log 2>&1 &
    BACKEND_PID=$!
    disown $! 2>/dev/null || true
    cd - > /dev/null

    # Verify backend startup
    echo "⏳ Waiting for backend to start..."
    if check_backend_ready; then
        log_success "Backend started successfully (PID: $BACKEND_PID)"
        log_info "   WebSocket: ws://localhost:8080"
    else
        log_error "Backend failed to start - check backend.log"
        if [ -f "backend.log" ]; then
            echo "Last 5 lines of backend.log:"
            tail -5 backend.log
        fi
        return 1
    fi

    # Start frontend with build verification
    echo ""
    log_info "🔨 Building and starting frontend..."
    log_info "   This may take 10-30 seconds for initial build..."
    echo ""

    # Start frontend in foreground but capture output to log as well
    npm run dev 2>&1 | tee frontend.log &
    FRONTEND_PID=$!

    # Give frontend time to build
    echo "⏳ Waiting for frontend build completion..."
    if check_frontend_ready; then
        echo ""
        log_success "Frontend built successfully and is serving"
        log_info "   URL: http://localhost:5174"
        log_info "   HMR: Active (changes will auto-refresh)"
        echo ""
        log_success "🚀 Development environment ready!"
        log_info "   Both services are running - you can start coding"
        echo ""
        log_info "💡 LLM Development Tips:"
        log_info "   • Frontend errors appear in terminal immediately"
        log_info "   • Backend issues: check backend.log"
        log_info "   • Build failures: visible in terminal + frontend.log"
        log_info "   • Use './run.sh status' to verify service health"
        echo ""

        # Keep the frontend process attached
        wait $FRONTEND_PID
    else
        echo ""
        log_error "Frontend build failed or timed out"
        log_info "Check the terminal output above and frontend.log for errors"
        echo ""
        log_info "Common issues:"
        log_info "  • Port conflicts (kill processes on 5174)"
        log_info "  • Missing dependencies (run 'npm install')"
        log_info "  • Compilation errors (check terminal output)"
        echo ""
        return 1
    fi
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
    log "Frontend: http://localhost:5174"
    log "Check status with: ./run.sh status"
}

# Enhanced status check with detailed health monitoring
status() {
    echo "=== NeuroSense FX Service Status ==="
    echo ""

    # Check backend service
    if pgrep -f "node.*server.js" > /dev/null; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        log_success "Backend: RUNNING (PID: $backend_pid)"
        log_info "   WebSocket: ws://localhost:8080"

        # Check for recent backend errors
        if check_recent_errors "backend.log"; then
            log_warning "   Recent errors detected in backend.log"
        fi
    else
        log_error "Backend: STOPPED"
        log_info "   Expected: WebSocket server on ws://localhost:8080"
    fi

    echo ""

    # Check frontend service with detailed status
    if curl -s http://localhost:5174 > /dev/null 2>&1; then
        local frontend_pid=$(pgrep -f "vite" | head -1)
        log_success "Frontend: SERVING (PID: $frontend_pid)"
        log_info "   URL: http://localhost:5174"
        log_info "   HMR: Active (hot reload enabled)"

        # Check for recent frontend errors
        if check_recent_errors "frontend.log"; then
            log_warning "   Recent build errors detected in frontend.log"
        fi
    elif pgrep -f "vite" > /dev/null; then
        local frontend_pid=$(pgrep -f "vite" | head -1)
        log_warning "Frontend: BUILDING (PID: $frontend_pid)"
        log_info "   URL: http://localhost:5174 (when ready)"
        log_info "   Status: Currently building or starting..."
    else
        log_error "Frontend: STOPPED"
        log_info "   Expected: Development server on http://localhost:5174"
    fi

    echo ""

    # Port conflict detection
    if netstat -tuln 2>/dev/null | grep -q ":5174 "; then
        if ! pgrep -f "vite" > /dev/null; then
            log_warning "Port 5174 is occupied but Vite is not running"
            log_info "   Another service may be using this port"
        fi
    fi

    if netstat -tuln 2>/dev/null | grep -q ":8080 "; then
        if ! pgrep -f "node.*server.js" > /dev/null; then
            log_warning "Port 8080 is occupied but backend is not running"
            log_info "   Another service may be using this port"
        fi
    fi

    echo ""
    echo "=== Quick Actions ==="
    echo "  ./run.sh dev     # Start development with verification"
    echo "  ./run.sh logs    # View service logs"
    echo "  ./run.sh restart  # Restart all services"
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

# Show usage with LLM-specific guidance
usage() {
    echo "NeuroSense FX Service Management - LLM-Aware Version"
    echo ""
    echo "Usage: $0 {dev|start|stop|restart|status|logs}"
    echo ""
    echo "=== Commands ==="
    echo "  dev     - Start development with build verification (foreground)"
    echo "  start   - Start all services in background (background mode)"
    echo "  stop    - Stop all services (immediate)"
    echo "  restart - Restart all services (background mode)"
    echo "  status  - Show detailed service health status"
    echo "  logs    - View service logs (all|backend|frontend)"
    echo ""
    echo "=== LLM Development Workflow ==="
    echo ""
    log_success "For Active Development:"
    log_info "  ./run.sh dev       # Recommended for LLM developers"
    log_info "                   # • Verifies both services start successfully"
    log_info "                   # • Shows clear success/failure indicators"
    log_info "                   # • Frontend logs in terminal, backend in backend.log"
    log_info "                   # • HMR enabled for instant code updates"
    echo ""
    log_info "For Testing/Production:"
    log_info "  ./run.sh restart   # Services run in background"
    log_info "                   # • Simulates production environment"
    log_info "                   # • Use './run.sh status' to verify health"
    log_info "                   # • Use './run.sh logs' to view output"
    echo ""
    echo "=== Success Indicators for LLM ==="
    echo "✅ SUCCESS: Look for these indicators:"
    echo "   • '✅ Backend started successfully'"
    echo "   • '✅ Frontend built successfully and is serving'"
    echo "   • '✅ Development environment ready!'"
    echo ""
    echo "❌ FAILURE: Watch for these indicators:"
    echo "   • '❌ Backend failed to start'"
    echo "   • '❌ Frontend build failed or timed out'"
    echo "   • '⚠️ Recent errors detected'"
    echo ""
    echo "=== Troubleshooting ==="
    echo "Port Conflicts:   Kill processes on ports 5174 and 8080"
    echo "Build Failures:   Check terminal output + frontend.log"
    echo "Backend Issues:   Check backend.log"
    echo "Health Check:     ./run.sh status"
}

# Main execution
case "${1:-}" in
    "dev")
        dev
        ;;
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
