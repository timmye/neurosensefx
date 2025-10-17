#!/bin/bash

# Watch and Test Script for NeuroSense FX
# This script watches for file changes and automatically runs tests

set -e

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

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Function to run tests
run_tests() {
    log "Changes detected, running tests..."
    echo "----------------------------------------"
    
    # Run the monitor-tests.js script
    if node scripts/monitor-tests.js; then
        log "✅ Tests completed successfully!"
    else
        log_error "❌ Tests failed!"
    fi
    
    echo "----------------------------------------"
    echo "Watching for changes... (Press Ctrl+C to stop)"
}

# Function to check if required tools are available
check_dependencies() {
    # Check for inotifywait (Linux)
    if command -v inotifywait >/dev/null 2>&1; then
        WATCHER="inotifywait"
        return 0
    fi
    
    # Check for fswatch (macOS, cross-platform)
    if command -v fswatch >/dev/null 2>&1; then
        WATCHER="fswatch"
        return 0
    fi
    
    # Check for entr (alternative)
    if command -v entr >/dev/null 2>&1; then
        WATCHER="entr"
        return 0
    fi
    
    log_error "No file watcher found. Please install one of:"
    log_error "  - Linux: inotifywait (inotify-tools package)"
    log_error "  - macOS: fswatch (brew install fswatch)"
    log_error "  - Cross-platform: entr (gem install entr)"
    return 1
}

# Function to start file watching with inotifywait (Linux)
start_inotifywait() {
    log_info "Using inotifywait for file watching"
    
    # Watch for changes in src directory and test files
    inotifywait -m -r -e modify,create,delete \
        --include '\.svelte$' \
        --include '\.js$' \
        --include '\.ts$' \
        --include '\.spec\.js$' \
        --include '\.spec\.ts$' \
        src/ e2e/ |
    while read path action file; do
        log_info "File $file was $action in $path"
        run_tests
    done
}

# Function to start file watching with fswatch (macOS, cross-platform)
start_fswatch() {
    log_info "Using fswatch for file watching"
    
    # Watch for changes in src directory and test files
    fswatch -o -1 -r \
        --include '\.svelte$' \
        --include '\.js$' \
        --include '\.ts$' \
        --include '\.spec\.js$' \
        --include '\.spec\.ts$' \
        src/ e2e/ |
    while read path; do
        log_info "File $path was modified"
        run_tests
    done
}

# Function to start file watching with entr
start_entr() {
    log_info "Using entr for file watching"
    
    # Find all relevant files and pipe to entr
    find src/ e2e/ -name '*.svelte' -o -name '*.js' -o -name '*.ts' -o -name '*.spec.js' -o -name '*.spec.ts' |
    entr -s "echo 'Files changed, running tests...' && node scripts/monitor-tests.js"
}

# Main execution
main() {
    log "Starting Continuous Testing Loop for NeuroSense FX"
    log "=================================================="
    
    # Check dependencies
    if ! check_dependencies; then
        log_error "Missing dependencies. Exiting."
        exit 1
    fi
    
    # Initial test run
    log "Running initial tests..."
    run_tests
    
    # Start file watching based on available tool
    case $WATCHER in
        "inotifywait")
            start_inotifywait
            ;;
        "fswatch")
            start_fswatch
            ;;
        "entr")
            start_entr
            ;;
        *)
            log_error "Unknown watcher: $WATCHER"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'log "Continuous testing stopped."; exit 0' INT TERM

# Run main function
main "$@"