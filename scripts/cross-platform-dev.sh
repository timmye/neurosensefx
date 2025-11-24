#!/bin/bash

# Cross-Platform Development Script
# Works across Windows, macOS, Linux, WSL2, and Docker environments
# Automatically detects environment and optimizes performance

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT_CONFIG="$PROJECT_ROOT/scripts/environment-config.js"

# Detect Node.js
NODE_CMD="node"
if ! command -v node &> /dev/null; then
    if command -v nodejs &> /dev/null; then
        NODE_CMD="nodejs"
    else
        log_error "Node.js not found. Please install Node.js to continue."
        exit 1
    fi
fi

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

log_debug() {
    echo -e "${MAGENTA}[DEBUG]${NC} $1"
}

# Get environment configuration
get_env_config() {
    if [[ -f "$ENVIRONMENT_CONFIG" ]]; then
        $NODE_CMD "$ENVIRONMENT_CONFIG" "$@" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Detect current environment
detect_environment() {
    local env_info
    env_info=$(get_env_config info 2>/dev/null || echo "")

    if [[ -n "$env_info" ]]; then
        ENVIRONMENT=$(echo "$env_info" | grep "Environment:" | cut -d' ' -f2)
        PLATFORM=$(echo "$env_info" | grep "Platform:" | cut -d' ' -f2)
    else
        # Fallback detection
        if [[ -f "/proc/version" ]] && grep -qi "microsoft\|wsl" /proc/version; then
            if [[ "$(pwd)" == "/mnt/"* ]]; then
                ENVIRONMENT="wsl2-mounted"
            else
                ENVIRONMENT="wsl2-native"
            fi
        elif [[ -f "/.dockerenv" ]] || [[ -n "${DOCKER_CONTAINER:-}" ]]; then
            ENVIRONMENT="docker"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            ENVIRONMENT="macos"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
            ENVIRONMENT="windows-native"
        else
            ENVIRONMENT="linux-native"
        fi
        PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
    fi

    log_debug "Detected environment: $ENVIRONMENT"
    log_debug "Platform: $PLATFORM"
}

# Optimize command execution for environment
execute_command() {
    local cmd="$1"
    local description="${2:-$cmd}"

    log_step "Executing: $description"

    case "$ENVIRONMENT" in
        "wsl2-mounted")
            # Use native temp directory for better performance
            export TMPDIR="/tmp/neurosensefx"
            mkdir -p "$TMPDIR" 2>/dev/null || true
            ;;
        "docker")
            # Docker-specific optimizations
            export NODE_OPTIONS="--max-old-space-size=4096"
            ;;
    esac

    # Execute the command with error handling
    if eval "$cmd"; then
        log_success "Command completed: $description"
        return 0
    else
        local exit_code=$?
        log_error "Command failed with exit code $exit_code: $description"
        return $exit_code
    fi
}

# Enhanced npm commands with environment optimization
npm_command() {
    local npm_action="$1"
    local description="$2"

    local npm_opts=""
    local cmd="npm"

    # Environment-specific npm optimizations
    case "$ENVIRONMENT" in
        "wsl2-mounted")
            # Use native filesystem for node_modules if possible
            npm_opts="--cache /tmp/npm-cache"
            ;;
        "docker")
            npm_opts="--no-audit --no-fund"
            ;;
        "ci")
            npm_opts="--prefer-offline --no-audit --no-fund"
            ;;
    esac

    case "$npm_action" in
        "install")
            execute_command "$cmd install $npm_opts" "Installing dependencies"
            ;;
        "dev")
            execute_command "$cmd run dev $npm_opts" "Starting development server"
            ;;
        "build")
            execute_command "$cmd run build $npm_opts" "Building project"
            ;;
        "test")
            execute_command "$cmd run test $npm_opts" "Running tests"
            ;;
        *)
            execute_command "$cmd $npm_action $npm_opts" "Running npm $npm_action"
            ;;
    esac
}

# Project management commands
project_setup() {
    log_step "Setting up development environment..."

    # Initialize environment configuration
    if [[ -f "$ENVIRONMENT_CONFIG" ]]; then
        execute_command "$NODE_CMD $ENVIRONMENT_CONFIG init" "Initializing environment configuration"
    fi

    # Install dependencies
    npm_command install "Installing npm dependencies"

    # Create necessary directories
    local dirs=("logs" "temp" "backups" "dist")
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_info "Creating directory: $dir"
            mkdir -p "$dir"
        fi
    done

    # Environment-specific setup
    case "$ENVIRONMENT" in
        "wsl2-mounted")
            log_warning "Running on WSL2 mounted filesystem"
            log_info "For better performance, consider:"
            log_info "  1. Running: ./scripts/migrate-to-wsl2-native.sh"
            log_info "  2. Using Docker with: ./scripts/enhanced-docker-setup.sh"
            ;;
        "docker")
            log_info "Running in Docker environment"
            ;;
    esac

    log_success "Development environment setup completed"
}

# Start development servers
start_dev() {
    log_step "Starting development environment..."

    # Get port configuration
    local frontend_port=$(get_env_config get "ports.frontend" || echo "5173")
    local backend_port=$(get_env_config get "ports.backend" || echo "8080")

    log_info "Starting frontend on port $frontend_port..."
    log_info "Backend will be available on port $backend_port..."

    # Start development server
    npm_command dev "Starting development server"
}

# Build project with optimizations
build_project() {
    local build_type="${1:-production}"
    log_step "Building project for $build_type..."

    # Clean previous build
    if [[ -d "dist" ]]; then
        log_info "Cleaning previous build..."
        rm -rf dist
    fi

    # Build with optimizations
    case "$build_type" in
        "development")
            npm_command build "Building for development"
            ;;
        "production")
            export NODE_ENV=production
            npm_command build "Building for production"
            ;;
        *)
            npm_command build "Building project"
            ;;
    esac

    log_success "Build completed for $build_type"
}

# Run tests with environment optimizations
run_tests() {
    local test_type="${1:-unit}"
    log_step "Running $test_type tests..."

    case "$test_type" in
        "unit")
            npm_command test "Running unit tests"
            ;;
        "e2e")
            execute_command "npm run test:e2e" "Running end-to-end tests"
            ;;
        "all")
            execute_command "npm run test:all" "Running all tests"
            ;;
        "coverage")
            execute_command "npm run test:unit:coverage" "Running tests with coverage"
            ;;
        *)
            npm_command "test:$test_type" "Running $test_type tests"
            ;;
    esac
}

# Performance optimization
optimize_performance() {
    log_step "Optimizing development environment performance..."

    case "$ENVIRONMENT" in
        "wsl2-mounted")
            # Create temp directories in native filesystem
            mkdir -p "/tmp/neurosensefx"
            mkdir -p "/tmp/npm-cache"

            # Set environment variables
            export TMPDIR="/tmp/neurosensefx"
            export npm_config_cache="/tmp/npm-cache"

            log_success "WSL2 performance optimizations applied"
            ;;
        "wsl2-native")
            # Already optimal
            log_info "Running on native WSL2 filesystem (optimal)"
            ;;
        "docker")
            # Docker optimizations handled by container setup
            log_info "Docker optimizations applied"
            ;;
        *)
            log_info "General optimizations applied"
            ;;
    esac

    # npm performance settings
    npm config set prefer-offline true
    npm config set audit false
    npm config set fund false

    log_success "Performance optimizations completed"
}

# Clean project with environment awareness
clean_project() {
    log_step "Cleaning project..."

    # Standard cleanup
    local clean_dirs=("node_modules/.cache" "dist" "coverage" ".nyc_output" "temp" "logs")

    for dir in "${clean_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            log_info "Removing: $dir"
            rm -rf "$dir"
        fi
    done

    # Environment-specific cleanup
    case "$ENVIRONMENT" in
        "wsl2-mounted")
            # Clean native temp directories
            rm -rf "/tmp/neurosensefx" 2>/dev/null || true
            rm -rf "/tmp/npm-cache" 2>/dev/null || true
            ;;
        "wsl2-native")
            # Standard cleanup
            ;;
        "docker")
            # Docker cleanup handled by volume management
            ;;
    esac

    # npm cache cleanup
    execute_command "npm cache clean --force" "Cleaning npm cache"

    log_success "Project cleanup completed"
}

# Environment information
show_environment() {
    log_step "Environment Information"

    if [[ -f "$ENVIRONMENT_CONFIG" ]]; then
        get_env_config info
    else
        log_info "Environment detector not available"
        log_info "Environment: $ENVIRONMENT"
        log_info "Platform: $PLATFORM"
        log_info "Node.js: $($NODE_CMD --version)"
        log_info "npm: $(npm --version)"
    fi

    # Performance recommendations
    echo
    log_info "Performance Recommendations:"

    case "$ENVIRONMENT" in
        "wsl2-mounted")
            log_warning "⚠️  Running on WSL2 mounted filesystem (suboptimal)"
            log_info "✅ Run: ./scripts/migrate-to-wsl2-native.sh"
            log_info "✅ Or use: ./scripts/enhanced-docker-setup.sh"
            ;;
        "wsl2-native")
            log_success "✅ Running on native WSL2 filesystem (optimal)"
            ;;
        "docker")
            log_success "✅ Running in optimized Docker environment"
            ;;
        "macos"|"linux-native")
            log_success "✅ Running on native filesystem (optimal)"
            ;;
        "windows-native")
            log_info "ℹ️  Running on Windows native"
            log_info "✅ Consider WSL2 for better development experience"
            ;;
    esac
}

# Docker development integration
docker_dev() {
    if [[ ! -f "scripts/enhanced-docker-setup.sh" ]]; then
        log_error "Docker setup script not found"
        exit 1
    fi

    log_step "Starting Docker-based development..."
    execute_command "./scripts/enhanced-docker-setup.sh" "Setting up enhanced Docker environment"
}

# WSL2 migration assistant
wsl2_migrate() {
    if [[ ! -f "scripts/migrate-to-wsl2-native.sh" ]]; then
        log_error "WSL2 migration script not found"
        exit 1
    fi

    log_step "Starting WSL2 native filesystem migration..."
    execute_command "./scripts/migrate-to-wsl2-native.sh" "Migrating to native WSL2 filesystem"
}

# Health check for development environment
health_check() {
    log_step "Performing development environment health check..."

    local issues=0

    # Check Node.js installation
    if ! command -v $NODE_CMD &> /dev/null; then
        log_error "Node.js not found"
        ((issues++))
    else
        log_success "Node.js: $($NODE_CMD --version)"
    fi

    # Check npm installation
    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        ((issues++))
    else
        log_success "npm: $(npm --version)"
    fi

    # Check project structure
    local required_files=("package.json" "src" "services")
    for file in "${required_files[@]}"; do
        if [[ ! -e "$file" ]]; then
            log_error "Missing required file/directory: $file"
            ((issues++))
        fi
    done

    # Check node_modules
    if [[ ! -d "node_modules" ]]; then
        log_warning "node_modules not found - run 'dev.sh setup'"
        ((issues++))
    else
        log_success "Dependencies installed"
    fi

    # Environment-specific checks
    case "$ENVIRONMENT" in
        "wsl2-mounted")
            log_warning "Running on WSL2 mounted filesystem (performance impact)"
            ;;
        "docker")
            if [[ ! -f "docker-compose.yml" ]]; then
                log_warning "Docker compose file not found"
            fi
            ;;
    esac

    if [[ $issues -eq 0 ]]; then
        log_success "Development environment is healthy"
        return 0
    else
        log_error "Found $issues issue(s) - see above"
        return 1
    fi
}

# Main command dispatcher
main() {
    # Ensure we're in the project directory
    cd "$PROJECT_ROOT" || {
        log_error "Cannot change to project directory: $PROJECT_ROOT"
        exit 1
    }

    # Detect environment
    detect_environment

    # Parse command
    local command="${1:-help}"

    case "$command" in
        "setup")
            project_setup
            ;;
        "start"|"dev")
            start_dev
            ;;
        "build")
            build_project "${2:-production}"
            ;;
        "test")
            run_tests "${2:-unit}"
            ;;
        "clean")
            clean_project
            ;;
        "optimize")
            optimize_performance
            ;;
        "env"|"environment")
            show_environment
            ;;
        "health")
            health_check
            ;;
        "docker")
            docker_dev
            ;;
        "migrate-wsl2")
            wsl2_migrate
            ;;
        "npm")
            npm_command "${2:-}" "${3:-}"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Help message
show_help() {
    echo "NeuroSense FX Cross-Platform Development Script"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Environment Commands:"
    echo "  setup                - Set up development environment"
    echo "  start, dev           - Start development servers"
    echo "  build [type]         - Build project (production|development)"
    echo "  test [type]          - Run tests (unit|e2e|all|coverage)"
    echo "  clean                - Clean project files and caches"
    echo "  optimize             - Apply performance optimizations"
    echo
    echo "Environment Information:"
    echo "  env, environment     - Show environment information"
    echo "  health               - Check development environment health"
    echo
    echo "Platform Commands:"
    echo "  docker               - Start Docker-based development"
    echo "  migrate-wsl2         - Migrate to native WSL2 filesystem"
    echo
    echo "Utility Commands:"
    echo "  npm <command>        - Run npm command with optimizations"
    echo "  help                 - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 setup                      # Initial setup"
    echo "  $0 dev                        # Start development"
    echo "  $0 test e2e                   # Run end-to-end tests"
    echo "  $0 build production           # Production build"
    echo "  $0 env                        # Show environment info"
}

# Trap cleanup
trap 'log_error "Script interrupted"; exit 130' INT TERM

# Run main function
main "$@"