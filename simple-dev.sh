#!/bin/bash

# Simple Development Environment Manager
# Crystal Clarity: Reliable, deterministic startup for LLM developers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=8080
FRONTEND_PORT=5175
BACKEND_DIR="services/tick-backend"
FRONTEND_DIR="src-simple"
BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"

# Logging functions
log_info() { echo -e "${BLUE}ℹ️${NC} $1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }

# Function to check if backend is running
is_backend_running() {
    if pgrep -f "node.*server.js" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check if frontend is running
is_frontend_running() {
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start backend
start_backend() {
    if is_backend_running; then
        log_success "Backend already running on port $BACKEND_PORT"
        return 0
    fi

    log_info "Starting backend service..."
    cd "$BACKEND_DIR"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing backend dependencies..."
        npm install
    fi

    # Start backend in background
    nohup node server.js > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../$BACKEND_PID_FILE
    cd - > /dev/null

    # Wait for backend to be ready
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if nc -z localhost $BACKEND_PORT 2>/dev/null; then
            log_success "Backend started successfully (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
        echo -n "."
    done

    echo ""
    log_error "Backend failed to start within ${max_attempts} seconds"
    return 1
}

# Function to start frontend
start_frontend() {
    if is_frontend_running; then
        log_success "Frontend already running on port $FRONTEND_PORT"
        return 0
    fi

    log_info "Starting frontend service..."
    cd "$FRONTEND_DIR"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi

    # Start frontend in background
    nohup npm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../$FRONTEND_PID_FILE
    cd - > /dev/null

    # Wait for frontend to be ready
    local max_attempts=60
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            log_success "Frontend started successfully (PID: $FRONTEND_PID)"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
        echo -n "."
    done

    echo ""
    log_error "Frontend failed to start within ${max_attempts} seconds"
    return 1
}

# Function to stop backend
stop_backend() {
    if ! is_backend_running; then
        log_info "Backend is not running"
        return 0
    fi

    log_info "Stopping backend service..."

    # Try graceful shutdown first
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if kill -0 $backend_pid 2>/dev/null; then
            kill $backend_pid 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 $backend_pid 2>/dev/null; then
                kill -9 $backend_pid 2>/dev/null || true
            fi
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # Kill any remaining backend processes
    pkill -f "node.*server.js" 2>/dev/null || true

    log_success "Backend stopped"
}

# Function to stop frontend
stop_frontend() {
    if ! is_frontend_running; then
        log_info "Frontend is not running"
        return 0
    fi

    log_info "Stopping frontend service..."

    # Kill any frontend processes using port 5175
    local port_pids=$(lsof -ti:5175 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        echo "$port_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        echo "$port_pids" | xargs -r kill -9 2>/dev/null || true
    fi

    # Try graceful shutdown first (if we have a PID file)
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local frontend_pid=$(cat "$FRONTEND_PID_FILE")
        if kill -0 $frontend_pid 2>/dev/null; then
            kill $frontend_pid 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if kill -0 $frontend_pid 2>/dev/null; then
                kill -9 $frontend_pid 2>/dev/null || true
            fi
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # Kill any remaining frontend processes as backup
    pkill -f "vite.*dev" 2>/dev/null || true
    pkill -f "npm.*run.*dev" 2>/dev/null || true

    # Final verification
    sleep 1
    if is_frontend_running; then
        log_warning "Frontend may still be running - forcing cleanup"
        lsof -ti:5175 | xargs -r kill -9 2>/dev/null || true
    fi

    log_success "Frontend stopped"
}

# Function to show status
show_status() {
    echo ""
    echo "=== Simple Development Environment Status ==="
    echo ""

    # Backend status
    if is_backend_running; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        log_success "Backend: RUNNING (PID: $backend_pid, Port: $BACKEND_PORT)"
    else
        log_error "Backend: STOPPED"
    fi

    echo ""

    # Frontend status
    if is_frontend_running; then
        local frontend_pid=$(pgrep -f "vite" | head -1)
        log_success "Frontend: RUNNING (PID: $frontend_pid, Port: $FRONTEND_PORT)"
    else
        log_error "Frontend: STOPPED"
    fi

    echo ""
    echo "Quick Actions:"
    echo "  ./simple-dev.sh start    # Start all services"
    echo "  ./simple-dev.sh stop     # Stop all services"
    echo "  ./simple-dev.sh restart  # Restart all services"
    echo "  ./simple-dev.sh status   # Show this status"
    echo ""
    echo "Services:"
    echo "  Frontend: http://localhost:$FRONTEND_PORT"
    echo "  Backend:  ws://localhost:$BACKEND_PORT"
    echo ""
}

# Function to start all services
start_all() {
    log_info "Starting Simple Development Environment..."

    if start_backend && start_frontend; then
        echo ""
        log_success "🚀 Simple Development Environment is ready!"
        echo ""
        echo "🌐 Frontend: http://localhost:$FRONTEND_PORT"
        echo "🔧 Backend:  ws://localhost:$BACKEND_PORT"
        echo ""
        echo "🔥 Hot reload enabled - changes will auto-refresh"
        echo "📝 Logs: backend.log, frontend.log"
        echo "🛑 Stop with: ./simple-dev.sh stop"
        echo ""
    else
        log_error "Failed to start development environment"
        stop_all
        exit 1
    fi
}

# Function to stop all services
stop_all() {
    log_info "Stopping Simple Development Environment..."
    stop_frontend
    stop_backend
    log_success "All services stopped"
}

# Function to restart all services
restart_all() {
    log_info "Restarting Simple Development Environment..."
    stop_all
    sleep 2
    start_all
}

# Main command handling
case "${1:-}" in
    "start")
        start_all
        ;;
    "stop")
        stop_all
        ;;
    "restart")
        restart_all
        ;;
    "status")
        show_status
        ;;
    "backend")
        case "${2:-}" in
            "start")
                start_backend
                ;;
            "stop")
                stop_backend
                ;;
            *)
                echo "Usage: $0 backend [start|stop]"
                exit 1
                ;;
        esac
        ;;
    "frontend")
        case "${2:-}" in
            "start")
                start_frontend
                ;;
            "stop")
                stop_frontend
                ;;
            *)
                echo "Usage: $0 frontend [start|stop]"
                exit 1
                ;;
        esac
        ;;
    "help"|"-h"|"--help")
        echo "Simple Development Environment Manager"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start              Start all services (backend + frontend)"
        echo "  stop               Stop all services"
        echo "  restart            Restart all services"
        echo "  status             Show service status"
        echo "  backend [start|stop]  Manage backend service only"
        echo "  frontend [start|stop] Manage frontend service only"
        echo "  help               Show this help"
        echo ""
        echo "Crystal Clarity Philosophy: Simple, reliable, deterministic behavior"
        ;;
    "")
        log_error "No command provided"
        echo ""
        echo "Usage: $0 [command]"
        echo "Use '$0 help' for detailed information"
        exit 1
        ;;
    *)
        log_error "Unknown command: $1"
        echo ""
        echo "Available commands: start, stop, restart, status, backend, frontend, help"
        exit 1
        ;;
esac

exit 0