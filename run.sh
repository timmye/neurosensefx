#!/bin/bash

# NeuroSense FX Service Management Script - Improved Version
# Unified interface for starting, stopping, and managing all services
# Enhanced for container environments with better timing and health checks

set -e

# Configuration
BACKEND_DIR="services/tick-backend"
BACKEND_LOG="backend.log"
BACKEND_PID_FILE="backend.pid"
FRONTEND_PID_FILE="frontend.pid"
BROWSER_TOOLS_PID_FILE="browser-tools.pid"
BROWSER_TOOLS_LOG="browser-tools.log"

# Container-aware timing configuration
if [ -f "/.dockerenv" ] || [ -n "$CONTAINER_MODE" ]; then
    echo "Container environment detected - using extended startup delays"
    BACKEND_INITIAL_WAIT=5
    BACKEND_RETRY_WAIT=10
    FRONTEND_INITIAL_WAIT=10
    FRONTEND_RETRY_WAIT=15
    HEALTH_CHECK_INTERVAL=2
    MAX_RETRIES=5
else
    BACKEND_INITIAL_WAIT=2
    BACKEND_RETRY_WAIT=3
    FRONTEND_INITIAL_WAIT=5
    FRONTEND_RETRY_WAIT=3
    HEALTH_CHECK_INTERVAL=1
    MAX_RETRIES=3
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] DEBUG:${NC} $1"
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

# Improved health check functions
check_backend_health() {
    # Backend is a WebSocket server, check for upgrade response
    local response=$(curl -s -m 5 http://localhost:8080 2>/dev/null || echo "")
    if echo "$response" | grep -q "426\|Upgrade Required"; then
        return 0
    fi
    # Also check if process is running
    if is_running "$BACKEND_PID_FILE"; then
        return 0
    fi
    return 1
}

check_frontend_health() {
    # Primary check: HTTP status code
    local http_code=$(curl -s -w "%{http_code}" -m 5 http://localhost:5173 -o /dev/null 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ]; then
        return 0
    fi
    # Fallback: check if process is running
    if is_running "$FRONTEND_PID_FILE"; then
        return 0
    fi
    return 1
}

check_browser_tools_health() {
    # BrowserTools server runs on port 3025
    local response=$(curl -s -m 5 http://localhost:3025 2>/dev/null || echo "")
    if echo "$response" | grep -q "Browser Tools Server\|Aggregator listening"; then
        return 0
    fi
    # Also check if process is running
    if is_running "$BROWSER_TOOLS_PID_FILE"; then
        return 0
    fi
    return 1
}

# Generic service wait function with polling
wait_for_service() {
    local service_name=$1
    local health_check_func=$2
    local max_wait=$3
    local retry_count=$4
    
    log "Waiting for $service_name to be ready (max ${max_wait}s)..."
    
    local elapsed=0
    local attempts=0
    
    while [ $elapsed -lt $max_wait ] && [ $attempts -lt $retry_count ]; do
        if $health_check_func; then
            log "$service_name is ready! (${elapsed}s elapsed)"
            return 0
        fi
        
        log_debug "$service_name not ready yet, waiting ${HEALTH_CHECK_INTERVAL}s... (${elapsed}s/${max_wait}s)"
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        attempts=$((attempts + 1))
    done
    
    log_error "$service_name failed to start within ${max_wait}s (attempted $attempts times)"
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
    nohup node server.js > "../../$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    cd - > /dev/null
    
    # Save PID with absolute path
    echo $backend_pid > "$(pwd)/$BACKEND_PID_FILE"
    
    # Initial wait for process to start
    log "Waiting $BACKEND_INITIAL_WAIT seconds for backend to initialize..."
    sleep $BACKEND_INITIAL_WAIT
    
    # Check if process is still running
    if kill -0 $backend_pid 2>/dev/null; then
        log "Backend process started (PID: $backend_pid), verifying health..."
        
        # Wait for backend to be healthy
        if wait_for_service "Backend" "check_backend_health" $BACKEND_RETRY_WAIT $MAX_RETRIES; then
            log "Backend started successfully (PID: $backend_pid)"
            log "Backend logs: $BACKEND_LOG"
            return 0
        else
            log_warn "Backend process running but health check failed"
            # Show recent log entries for debugging
            if [[ -f "$BACKEND_LOG" ]]; then
                log_warn "Recent backend logs:"
                tail -n 5 "$BACKEND_LOG" | sed 's/^/  /'
            fi
            
            # Give it one more chance with extended time in container mode
            if [ -f "/.dockerenv" ]; then
                log "Container mode detected: giving backend more time..."
                sleep 10
                if check_backend_health; then
                    log "Backend started successfully after extended wait (PID: $backend_pid)"
                    return 0
                fi
            fi
            
            log_error "Backend not responding after all attempts"
            kill $backend_pid 2>/dev/null || true
            rm -f "$BACKEND_PID_FILE"
            return 1
        fi
    else
        log_error "Failed to start backend - process exited immediately"
        # Check recent log entries for errors
        if [[ -f "$BACKEND_LOG" ]]; then
            log_error "Recent backend logs:"
            tail -n 10 "$BACKEND_LOG" | sed 's/^/  /'
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
    
    # Save PID with absolute path
    echo $frontend_pid > "$(pwd)/$FRONTEND_PID_FILE"
    
    # Initial wait for Vite to start
    log "Waiting $FRONTEND_INITIAL_WAIT seconds for frontend to initialize..."
    sleep $FRONTEND_INITIAL_WAIT
    
    # Check if process is still running
    if kill -0 $frontend_pid 2>/dev/null; then
        log "Frontend process started (PID: $frontend_pid), verifying health..."
        
        # Debug: Show what curl sees
        curl_output=$(curl -s -w "%{http_code}" http://localhost:5173 2>/dev/null || echo "7")
        log_debug "Frontend health check response: $curl_output"
        
        # Wait for frontend to be healthy
        if wait_for_service "Frontend" "check_frontend_health" $FRONTEND_RETRY_WAIT $MAX_RETRIES; then
            log "Frontend started successfully (PID: $frontend_pid)"
            log "Frontend logs: frontend.log"
            log "Access application at: http://localhost:5173"
            return 0
        else
            log_warn "Frontend process running but health check failed"
            # Show recent log entries for debugging
            if [[ -f "frontend.log" ]]; then
                log_warn "Recent frontend logs:"
                tail -n 10 "frontend.log" | sed 's/^/  /'
            fi
            
            # Give it one more chance with extended time in container mode
            if [ -f "/.dockerenv" ]; then
                log "Container mode detected: giving frontend more time..."
                sleep 15
                if check_frontend_health; then
                    log "Frontend started successfully after extended wait (PID: $frontend_pid)"
                    return 0
                fi
            fi
            
            log_error "Frontend not responding after all attempts"
            kill $frontend_pid 2>/dev/null || true
            rm -f "$FRONTEND_PID_FILE"
            return 1
        fi
    else
        log_error "Failed to start frontend - process exited immediately"
        # Check recent log entries for errors
        if [[ -f "frontend.log" ]]; then
            log_error "Recent frontend logs:"
            tail -n 10 "frontend.log" | sed 's/^/  /'
        fi
        rm -f "$FRONTEND_PID_FILE"
        return 1
    fi
}

# Start BrowserTools server
start_browser_tools() {
    if is_running "$BROWSER_TOOLS_PID_FILE"; then
        log "BrowserTools server is already running (PID: $(cat $BROWSER_TOOLS_PID_FILE))"
        return 0
    fi
    
    log "Starting BrowserTools server for frontend development support..."
    
    # Check if npx is available
    if ! command -v npx >/dev/null 2>&1; then
        log_error "npx is not available. Cannot start BrowserTools server."
        return 1
    fi
    
    # Start BrowserTools server in background with logging
    nohup npx @agentdeskai/browser-tools-server@latest > "$BROWSER_TOOLS_LOG" 2>&1 &
    local browser_tools_pid=$!
    
    # Save PID
    echo $browser_tools_pid > "$BROWSER_TOOLS_PID_FILE"
    
    # Initial wait for BrowserTools server to start
    log "Waiting 5 seconds for BrowserTools server to initialize..."
    sleep 5
    
    # Check if process is still running
    if kill -0 $browser_tools_pid 2>/dev/null; then
        log "BrowserTools server process started (PID: $browser_tools_pid), verifying health..."
        
        # Wait for BrowserTools server to be healthy
        if wait_for_service "BrowserTools" "check_browser_tools_health" 15 5; then
            log "BrowserTools server started successfully (PID: $browser_tools_pid)"
            log "BrowserTools logs: $BROWSER_TOOLS_LOG"
            log "BrowserTools server available at: http://localhost:3025"
            log "MCP tools are now available for Cline to use"
            return 0
        else
            log_warn "BrowserTools server process running but health check failed"
            # Show recent log entries for debugging
            if [[ -f "$BROWSER_TOOLS_LOG" ]]; then
                log_warn "Recent BrowserTools logs:"
                tail -n 5 "$BROWSER_TOOLS_LOG" | sed 's/^/  /'
            fi
            
            log_error "BrowserTools server not responding after all attempts"
            kill $browser_tools_pid 2>/dev/null || true
            rm -f "$BROWSER_TOOLS_PID_FILE"
            return 1
        fi
    else
        log_error "Failed to start BrowserTools server - process exited immediately"
        # Check recent log entries for errors
        if [[ -f "$BROWSER_TOOLS_LOG" ]]; then
            log_error "Recent BrowserTools logs:"
            tail -n 10 "$BROWSER_TOOLS_LOG" | sed 's/^/  /'
        fi
        rm -f "$BROWSER_TOOLS_PID_FILE"
        return 1
    fi
}

# Stop BrowserTools server
stop_browser_tools() {
    if [[ -f "$BROWSER_TOOLS_PID_FILE" ]]; then
        local pid=$(cat "$BROWSER_TOOLS_PID_FILE")
        log "Stopping BrowserTools server (PID: $pid)..."
        if kill $pid 2>/dev/null; then
            # Wait for graceful shutdown
            local count=0
            while kill -0 $pid 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
            rm -f "$BROWSER_TOOLS_PID_FILE"
            log "BrowserTools server stopped successfully"
        else
            log_warn "BrowserTools server process not found, cleaning up PID file"
            rm -f "$BROWSER_TOOLS_PID_FILE"
        fi
    else
        log "BrowserTools server is not running"
    fi
}

# Stop backend service
stop_backend() {
    if [[ -f "$BACKEND_PID_FILE" ]]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        log "Stopping backend (PID: $pid)..."
        if kill $pid 2>/dev/null; then
            # Wait for graceful shutdown
            local count=0
            while kill -0 $pid 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
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
            # Wait for graceful shutdown
            local count=0
            while kill -0 $pid 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                kill -9 $pid 2>/dev/null || true
            fi
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
    
    if is_running "$BROWSER_TOOLS_PID_FILE"; then
        log "BrowserTools: ${GREEN}RUNNING${NC} (PID: $(cat $BROWSER_TOOLS_PID_FILE))"
    else
        log "BrowserTools: ${RED}STOPPED${NC}"
    fi
    
    log "=== Port Status ==="
    if command -v curl >/dev/null 2>&1; then
        if check_backend_health; then
            log "Port 8080 (Backend): ${GREEN}RESPONDING${NC}"
        else
            log "Port 8080 (Backend): ${RED}NOT RESPONDING${NC}"
        fi
        
        if check_frontend_health; then
            log "Port 5173 (Frontend): ${GREEN}RESPONDING${NC}"
        else
            log "Port 5173 (Frontend): ${RED}NOT RESPONDING${NC}"
        fi
        
        if check_browser_tools_health; then
            log "Port 3025 (BrowserTools): ${GREEN}RESPONDING${NC}"
        else
            log "Port 3025 (BrowserTools): ${RED}NOT RESPONDING${NC}"
        fi
    else
        log "curl not available, skipping port check"
    fi
    
    log "=== Environment Info ==="
    if [ -f "/.dockerenv" ]; then
        log "Environment: ${BLUE}CONTAINER${NC} (extended timeouts active)"
    else
        log "Environment: ${BLUE}HOST${NC} (standard timeouts)"
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
        "browser-tools")
            if [[ -f "$BROWSER_TOOLS_LOG" ]]; then
                log "Showing BrowserTools logs (Ctrl+C to exit):"
                tail -f "$BROWSER_TOOLS_LOG"
            else
                log "BrowserTools log file not found: $BROWSER_TOOLS_LOG"
            fi
            ;;
        "all"|*)
            log "Showing all logs (Ctrl+C to exit):"
            if [[ -f "$BACKEND_LOG" ]] && [[ -f "frontend.log" ]] && [[ -f "$BROWSER_TOOLS_LOG" ]]; then
                tail -f "$BACKEND_LOG" "frontend.log" "$BROWSER_TOOLS_LOG"
            elif [[ -f "$BACKEND_LOG" ]] && [[ -f "frontend.log" ]]; then
                tail -f "$BACKEND_LOG" "frontend.log"
            elif [[ -f "$BACKEND_LOG" ]]; then
                tail -f "$BACKEND_LOG"
            elif [[ -f "frontend.log" ]]; then
                tail -f "frontend.log"
            elif [[ -f "$BROWSER_TOOLS_LOG" ]]; then
                tail -f "$BROWSER_TOOLS_LOG"
            else
                log "No log files found"
            fi
            ;;
    esac
}

# Clean up old processes
cleanup() {
    log "Cleaning up old processes..."
    
    # Kill any existing backend processes (more aggressive)
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "server.js" 2>/dev/null || true
    
    # Kill any processes using ports 8080, 5173, and 3025
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:8080 | xargs kill -9 2>/dev/null || true
        lsof -ti:5173 | xargs kill -9 2>/dev/null || true
        lsof -ti:3025 | xargs kill -9 2>/dev/null || true
    elif command -v fuser >/dev/null 2>&1; then
        fuser -k 8080/tcp 2>/dev/null || true
        fuser -k 5173/tcp 2>/dev/null || true
        fuser -k 3025/tcp 2>/dev/null || true
    fi
    
    # Kill any existing frontend processes
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    
    # Kill BrowserTools processes
    pkill -f "browser-tools-server" 2>/dev/null || true
    pkill -f "@agentdeskai/browser-tools-server" 2>/dev/null || true
    
    # Wait a moment for processes to terminate
    sleep 2
    
    # Remove PID files
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE" "$BROWSER_TOOLS_PID_FILE"
    
    log "Cleanup complete"
}

# Main start function - start all services
start() {
    log "=== NeuroSense FX Startup ==="
    
    # Clean up old processes
    cleanup
    
    # Show environment info
    if [ -f "/.dockerenv" ]; then
        log "Running in container environment with extended timeouts"
    else
        log "Running in host environment with standard timeouts"
    fi
    
    # Start services
    if start_backend && start_frontend && start_browser_tools; then
        log "=== All Services Started Successfully ==="
        log "Frontend: http://localhost:5173"
        log "Backend WebSocket: ws://localhost:8080"
        log "BrowserTools Server: http://localhost:3025"
        log "MCP Tools: Available for Cline to use"
        log "Use './run.sh logs' to view service logs"
        log "Use './run.sh status' to check service health"
    else
        log_error "Failed to start one or more services"
        log_error "Check the logs above for details"
        exit 1
    fi
}

# Stop all services
stop() {
    log "=== Stopping All Services ==="
    stop_browser_tools
    stop_frontend  # Stop frontend first (may depend on backend)
    stop_backend
    log "=== All Services Stopped ==="
}

# Show usage
usage() {
    echo "Usage: $0 {start|start-background|wait-for-services|stop|status|logs|cleanup}"
    echo
    echo "Commands:"
    echo "  start             - Start all services with health checks (backend, frontend, BrowserTools)"
    echo "  start-background  - Start services in background (for DevContainer postStartCommand)"
    echo "  wait-for-services - Wait for services to be ready (for DevContainer postAttachCommand)"
    echo "  stop              - Stop all services"
    echo "  status            - Check service status"
    echo "  logs              - View service logs (use: logs backend|frontend|browser-tools|all)"
    echo "  cleanup           - Clean up old processes"
    echo
    echo "Examples:"
    echo "  $0 start                  # Start all services with health checks"
    echo "  $0 start-background       # Start services in background (DevContainer)"
    echo "  $0 wait-for-services      # Wait for services to be ready"
    echo "  $0 logs browser-tools     # View BrowserTools logs"
    echo "  $0 status                 # Check service status"
    echo
    echo "Services:"
    echo "  - Backend (Node.js WebSocket server): Port 8080"
    echo "  - Frontend (Vite development server): Port 5173"
    echo "  - BrowserTools (MCP server for browser analysis): Port 3025"
    echo "  - MCP Tools: Available for Cline when BrowserTools is running"
    echo
    echo "Environment Detection:"
    echo "  Container mode: Extended timeouts for devcontainer startup"
    echo "  Host mode: Standard timeouts for manual execution"
    echo
    echo "DevContainer Usage:"
    echo "  postStartCommand: './run.sh start-background'"
    echo "  postAttachCommand: './run.sh wait-for-services'"
}

# Start services in background for DevContainer
start_background() {
    log "=== NeuroSense FX Background Startup ==="
    
    # Clean up old processes first
    cleanup
    
    # Start backend in background with nohup
    log "Starting backend service in background..."
    cd "$BACKEND_DIR"
    nohup node server.js > "../../$BACKEND_LOG" 2>&1 &
    local backend_pid=$!
    cd - > /dev/null
    echo $backend_pid > "$(pwd)/$BACKEND_PID_FILE"
    log "Backend started in background (PID: $backend_pid)"
    
    # Start frontend in background with nohup
    log "Starting frontend service in background..."
    nohup npm run dev > frontend.log 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$(pwd)/$FRONTEND_PID_FILE"
    log "Frontend started in background (PID: $frontend_pid)"
    
    log "=== Services Started in Background ==="
    log "Backend PID: $backend_pid, Frontend PID: $frontend_pid"
    log "Services will be available shortly at:"
    log "  Frontend: http://localhost:5173"
    log "  Backend WebSocket: ws://localhost:8080"
}

# Wait for services to be ready (for postAttachCommand)
wait_for_services() {
    log "=== Waiting for Services to Be Ready ==="
    
    local max_wait=60
    local elapsed=0
    
    while [ $elapsed -lt $max_wait ]; do
        if check_backend_health && check_frontend_health; then
            log "=== All Services Are Ready ==="
            log "Frontend: http://localhost:5173"
            log "Backend WebSocket: ws://localhost:8080"
            status
            return 0
        fi
        
        log "Waiting for services... (${elapsed}s/${max_wait}s)"
        sleep 5
        elapsed=$((elapsed + 5))
    done
    
    log_error "Services failed to start within $max_wait seconds"
    status
    return 1
}

# Main execution
case "${1:-}" in
    "start")
        start
        ;;
    "start-background")
        start_background
        ;;
    "wait-for-services")
        wait_for_services
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
