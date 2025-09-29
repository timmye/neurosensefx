#!/bin/bash

# NeuroSense FX Local Development Runner
# Enhanced automation script with error handling and status checking

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=8080
FRONTEND_PORT=5173
BACKEND_DIR="ctrader_tick_backend"
ENV_FILE="$BACKEND_DIR/.env"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        print_warning "Port $port is in use. Killing processes: $pids"
        kill -9 $pids
        sleep 2
    fi
}

# Function to check if service is ready
wait_for_service() {
    local url=$1
    local service=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service is ready!"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_error "$service failed to start within $max_attempts seconds"
    return 1
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js v16 or higher."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check .env file
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found!"
        print_status "Please create $ENV_FILE with the following content:"
        echo ""
        echo "CTRADER_CLIENT_ID=your_client_id_here"
        echo "CTRADER_SECRET=your_secret_here"
        echo "CTRADER_ACCESS_TOKEN=your_access_token_here"
        echo ""
        print_status "Get these values from your cTrader account: Settings → API Access"
        exit 1
    fi
    
    # Check if .env has required variables
    if ! grep -q "CTRADER_CLIENT_ID=" "$ENV_FILE" || \
       ! grep -q "CTRADER_SECRET=" "$ENV_FILE" || \
       ! grep -q "CTRADER_ACCESS_TOKEN=" "$ENV_FILE"; then
        print_error "Missing required environment variables in $ENV_FILE"
        print_status "Ensure all three variables are set: CTRADER_CLIENT_ID, CTRADER_SECRET, CTRADER_ACCESS_TOKEN"
        exit 1
    fi
    
    print_success "Environment validation passed!"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Frontend dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    else
        print_status "Frontend dependencies already installed"
    fi
    
    # Backend dependencies
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        print_status "Installing backend dependencies..."
        cd $BACKEND_DIR
        npm install
        cd ..
    else
        print_status "Backend dependencies already installed"
    fi
    
    print_success "Dependencies installed!"
}

# Function to start services
start_services() {
    print_status "Starting NeuroSense FX services..."
    
    # Clean up any existing processes
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    # Start backend
    print_status "Starting backend server on port $BACKEND_PORT..."
    cd $BACKEND_DIR
    nohup npm start > backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to be ready
    if ! wait_for_service "http://localhost:$BACKEND_PORT/health" "Backend"; then
        print_error "Backend failed to start. Check $BACKEND_DIR/backend.log"
        exit 1
    fi
    
    # Start frontend
    print_status "Starting frontend server on port $FRONTEND_PORT..."
    nohup npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    if ! wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"; then
        print_error "Frontend failed to start. Check frontend.log"
        exit 1
    fi
    
    print_success "All services started successfully!"
}

# Function to display status
display_status() {
    print_status "NeuroSense FX Status:"
    echo ""
    
    if check_port $BACKEND_PORT; then
        print_success "Backend: http://localhost:$BACKEND_PORT"
    else
        print_error "Backend: Not running"
    fi
    
    if check_port $FRONTEND_PORT; then
        print_success "Frontend: http://localhost:$FRONTEND_PORT"
    else
        print_error "Frontend: Not running"
    fi
    
    echo ""
    print_status "Logs:"
    echo "  Backend: $BACKEND_DIR/backend.log"
    echo "  Frontend: frontend.log"
    echo ""
    print_status "To stop all services, run: ./cleanup_dev_env.sh"
}

# Function to show help
show_help() {
    echo "NeuroSense FX Local Development Runner"
    echo ""
    echo "Usage: ./run_neurosense.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start all services (default)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  status    Show service status"
    echo "  logs      Show recent logs"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run_neurosense.sh start"
    echo "  ./run_neurosense.sh status"
    echo "  ./run_neurosense.sh logs"
}

# Function to show logs
show_logs() {
    print_status "Recent logs:"
    echo ""
    
    if [ -f "$BACKEND_DIR/backend.log" ]; then
        echo "=== Backend Logs ==="
        tail -20 "$BACKEND_DIR/backend.log"
        echo ""
    fi
    
    if [ -f "frontend.log" ]; then
        echo "=== Frontend Logs ==="
        tail -20 frontend.log
    fi
}

# Main execution
main() {
    case "${1:-start}" in
        start)
            validate_environment
            install_dependencies
            start_services
            display_status
            ;;
        stop)
            ./cleanup_dev_env.sh
            ;;
        restart)
            ./cleanup_dev_env.sh
            sleep 2
            validate_environment
            install_dependencies
            start_services
            display_status
            ;;
        status)
            display_status
            ;;
        logs)
            show_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"