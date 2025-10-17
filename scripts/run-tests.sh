#!/bin/bash

# Basic Test Runner Script for NeuroSense FX
# This script starts the application services, runs tests, and stops services

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

# Check if services are already running
check_services() {
    if ./run.sh status | grep -q "RUNNING"; then
        log_warn "Services are already running. Stopping them first..."
        ./run.sh stop
        sleep 3
    fi
}

# Start services
start_services() {
    log "Starting application services..."
    if ./run.sh start; then
        log "Services started successfully"
        # Wait for services to be fully ready
        log_info "Waiting for services to be fully ready..."
        sleep 10
        return 0
    else
        log_error "Failed to start services"
        return 1
    fi
}

# Run tests
run_tests() {
    log "Running Playwright tests..."
    
    # Create test results directory if it doesn't exist
    mkdir -p test-results
    
    # Run tests and capture output
    if npm run test:add-display-menu 2>&1 | tee test-results/test-output.log; then
        TEST_EXIT_CODE=0
        log "✅ All tests passed!"
        return 0
    else
        TEST_EXIT_CODE=$?
        log_error "❌ Some tests failed with exit code: $TEST_EXIT_CODE"
        return $TEST_EXIT_CODE
    fi
}

# Stop services
stop_services() {
    log "Stopping application services..."
    if ./run.sh stop; then
        log "Services stopped successfully"
        return 0
    else
        log_error "Failed to stop services properly"
        return 1
    fi
}

# Main execution
main() {
    log "Starting NeuroSense FX Test Runner"
    log "=================================="
    
    # Check if services are already running and stop them
    check_services
    
    # Start services
    if ! start_services; then
        log_error "Failed to start services. Exiting."
        exit 1
    fi
    
    # Run tests
    if ! run_tests; then
        TEST_FAILED=true
    else
        TEST_FAILED=false
    fi
    
    # Stop services
    if ! stop_services; then
        log_warn "Warning: Failed to stop services properly"
    fi
    
    # Report final result
    log "=================================="
    if [ "$TEST_FAILED" = true ]; then
        log_error "Test run completed with failures"
        log_info "Check test-results/test-output.log for details"
        exit 1
    else
        log "Test run completed successfully"
        log_info "Test results saved to test-results/test-output.log"
        exit 0
    fi
}

# Run main function
main "$@"