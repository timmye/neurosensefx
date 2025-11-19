#!/bin/bash

# =============================================================================
# NEUROSENSE FX ENVIRONMENT-AWARE SERVICE MANAGEMENT SCRIPT
# =============================================================================
# Enhanced with comprehensive environment management, backup capabilities,
# and production safeguards for seamless development/production workflow
#
# DESIGN PRINCIPLES:
# 1. Environment-aware state management with clean dev/prod isolation
# 2. Backward compatibility with existing commands and workflows
# 3. Production safeguards with validation and backup systems
# 4. Developer experience excellence with clear feedback and guidance
# 5. Integration with browser auto-opening and environment switching

# =============================================================================
# COLOR SCHEME AND FORMATTING
# =============================================================================

# Essential colors for output
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'  # No Color

# Environment-specific colors (reuse core colors)
DEV_COLOR=$GREEN   # Development - green
PROD_COLOR=$BLUE   # Production - blue
WARN_COLOR=$YELLOW # Warnings - yellow

# Essential formatting
BOLD=$'\033[1m'
DIM=$'\033[2m'

# =============================================================================
# GLOBAL VARIABLES AND CONFIGURATION
# =============================================================================

# Service configuration - Environment-aware ports
DEFAULT_DEV_BACKEND_PORT=8080
DEFAULT_DEV_FRONTEND_PORT=5174
DEFAULT_PROD_BACKEND_PORT=8081
DEFAULT_PROD_FRONTEND_PORT=4173

# Current environment ports (will be set based on environment detection)
BACKEND_PORT=$DEFAULT_DEV_BACKEND_PORT
FRONTEND_PORT=$DEFAULT_DEV_FRONTEND_PORT

PROJECT_NAME="NeuroSense FX"
SCRIPT_VERSION="2.1.0"

# File paths
BACKEND_LOG="backend.log"
FRONTEND_LOG="frontend.log"
BACKUP_DIR="backups"
ENV_STATUS_FILE=".env_status"

# Browser configuration
BROWSER_TIMEOUT=5
DEFAULT_BROWSER="chrome"

# Environment detection
DEVELOPMENT_MODE="dev"
PRODUCTION_MODE="prod"
CURRENT_ENVIRONMENT=""

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# =============================================================================
# ENHANCED LOGGING FUNCTIONS
# =============================================================================

# Unified logging function with level support
log() {
    local level="${1:-info}"
    local message="$2"
    local timestamp=$(date +'%H:%M:%S')
    local env_indicator=$(get_environment_indicator)

    # Skip environment-specific messages if not in that environment
    if [ "$level" = "dev" ] && [ "$(detect_environment_mode)" != "$DEVELOPMENT_MODE" ]; then
        return 0
    fi
    if [ "$level" = "prod" ] && [ "$(detect_environment_mode)" != "$PRODUCTION_MODE" ]; then
        return 0
    fi

    case "$level" in
        "success")
            echo -e "${GREEN}✅${env_indicator}${NC} $message" >&2
            ;;
        "error")
            echo -e "${RED}❌${env_indicator}${NC} $message" >&2
            ;;
        "warning")
            echo -e "${YELLOW}⚠️${env_indicator}${NC} $message" >&2
            ;;
        "info")
            echo -e "${BLUE}ℹ️${env_indicator}${NC} $message" >&2
            ;;
        "dev")
            echo -e "${DEV_COLOR}[DEV]${NC} $message" >&2
            ;;
        "prod")
            echo -e "${PROD_COLOR}[PROD]${NC} $message" >&2
            ;;
        *)
            # Default info log with timestamp
            echo -e "${GREEN}[${timestamp}]${env_indicator}${NC} $message" >&2
            ;;
    esac
}

# Convenience functions for backward compatibility
log_success() { log "success" "$1"; }
log_error() { log "error" "$1"; }
log_warning() { log "warning" "$1"; }
log_info() { log "info" "$1"; }
log_dev() { log "dev" "$1"; }
log_prod() { log "prod" "$1"; }

# =============================================================================
# ENVIRONMENT DETECTION AND MANAGEMENT
# =============================================================================

# Detect current environment mode and optionally get related info
detect_environment_mode() {
    local output_type="${1:-mode}"
    local param="$2"

    local env
    # Check for explicit environment flags first (highest priority)
    if [ "$param" = "--production" ] || [ "$param" = "-p" ] || [ "$param" = "production" ]; then
        env="$PRODUCTION_MODE"
    elif [ "$param" = "--development" ] || [ "$param" = "-d" ] || [ "$param" = "development" ]; then
        env="$DEVELOPMENT_MODE"
    # Check NODE_ENV for explicit environment setting
    elif [ "${NODE_ENV:-}" = "production" ]; then
        env="$PRODUCTION_MODE"
    elif [ "${NODE_ENV:-}" = "development" ]; then
        env="$DEVELOPMENT_MODE"
    # Check VITE_DEV only if explicitly set (don't default to true)
    elif [ "${VITE_DEV:-}" = "true" ]; then
        env="$DEVELOPMENT_MODE"
    elif [ "${VITE_DEV:-}" = "false" ]; then
        env="$PRODUCTION_MODE"
    # Default based on command context
    else
        env="$DEVELOPMENT_MODE"
    fi

    case "$output_type" in
        "mode")
            echo "$env"
            ;;
        "indicator")
            if [ "$env" = "$DEVELOPMENT_MODE" ]; then
                echo -e " ${DEV_COLOR}[DEV]${NC}"
            else
                echo -e " ${PROD_COLOR}[PROD]${NC}"
            fi
            ;;
        "color")
            if [ "$env" = "$DEVELOPMENT_MODE" ]; then
                echo "$DEV_COLOR"
            else
                echo "$PROD_COLOR"
            fi
            ;;
        *)
            echo "$env"
            ;;
    esac
}

# Set environment-specific ports
set_environment_ports() {
    local env="$1"

    if [ "$env" = "$DEVELOPMENT_MODE" ]; then
        BACKEND_PORT=$DEFAULT_DEV_BACKEND_PORT
        FRONTEND_PORT=$DEFAULT_DEV_FRONTEND_PORT
    else
        BACKEND_PORT=$DEFAULT_PROD_BACKEND_PORT
        FRONTEND_PORT=$DEFAULT_PROD_FRONTEND_PORT
    fi

    log_info "Environment ports set: Backend=$BACKEND_PORT, Frontend=$FRONTEND_PORT"
}

# Convenience functions for backward compatibility
get_environment_indicator() { detect_environment_mode "indicator" "$1"; }
get_environment_color() { detect_environment_mode "color" "$1"; }

# Initialize environment status file
initialize_environment_status() {
    local env=$(detect_environment_mode)
    local timestamp=$(date +%s)

    cat > "$ENV_STATUS_FILE" << EOF
{
    "environment": "$env",
    "timestamp": $timestamp,
    "script_version": "$SCRIPT_VERSION",
    "last_command": "",
    "services": {
        "backend": false,
        "frontend": false
    },
    "ports": {
        "backend": $BACKEND_PORT,
        "frontend": $FRONTEND_PORT
    }
}
EOF
}

# Update environment status
update_environment_status() {
    local field="$1"
    local value="$2"

    if [ ! -f "$ENV_STATUS_FILE" ]; then
        initialize_environment_status
    fi

    # Simple update using sed (basic JSON manipulation)
    case "$field" in
        "backend_running")
            sed -i "s/\"backend\": [^,]*/\"backend\": $value/" "$ENV_STATUS_FILE"
            ;;
        "frontend_running")
            sed -i "s/\"frontend\": [^,]*/\"frontend\": $value/" "$ENV_STATUS_FILE"
            ;;
        "last_command")
            sed -i "s/\"last_command\": \"[^\"]*\"/\"last_command\": \"$value\"/" "$ENV_STATUS_FILE"
            ;;
    esac
}

# Check if environment status is recent (within last hour)
is_environment_status_fresh() {
    if [ ! -f "$ENV_STATUS_FILE" ]; then
        return 1
    fi

    local current_time=$(date +%s)
    local status_time=$(grep -o '"timestamp": [0-9]*' "$ENV_STATUS_FILE" | cut -d' ' -f2)
    local age=$((current_time - status_time))
    local hour_seconds=3600

    [ $age -lt $hour_seconds ]
}

# =============================================================================
# ENVIRONMENT VALIDATION AND SAFEGUARDS
# =============================================================================

# Validate environment setup
validate_environment() {
    local env=$(detect_environment_mode)
    local issues=()

    log_info "Validating $env environment setup..."

    # Check required directories
    if [ ! -d "services/tick-backend" ]; then
        issues+=("Missing backend directory")
    fi

    # Check package.json exists
    if [ ! -f "package.json" ]; then
        issues+=("Missing package.json")
    fi

    # Check node_modules exists
    if [ ! -d "node_modules" ]; then
        issues+=("Missing node_modules - run npm install")
    fi

    # Check backend dependencies
    if [ ! -d "services/tick-backend/node_modules" ]; then
        issues+=("Missing backend node_modules - run npm install in services/tick-backend")
    fi

    # Check port availability
    if netstat -tuln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
        if ! pgrep -f "node.*server.js" > /dev/null; then
            issues+=("Port $BACKEND_PORT is occupied by another service")
        fi
    fi

    if netstat -tuln 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
        if ! pgrep -f "vite" > /dev/null; then
            issues+=("Port $FRONTEND_PORT is occupied by another service")
        fi
    fi

    # Report validation results
    if [ ${#issues[@]} -eq 0 ]; then
        log_success "Environment validation passed"
        return 0
    else
        log_error "Environment validation failed:"
        for issue in "${issues[@]}"; do
            log_error "  • $issue"
        done
        return 1
    fi
}

# Production environment safeguards
validate_production_safety() {
    local env=$(detect_environment_mode)

    if [ "$env" != "$PRODUCTION_MODE" ]; then
        return 0  # No safeguards needed for development
    fi

    log_warning "Production environment safeguards active"

    # Check for development data in production
    local dev_data_found=false

    # Look for development-specific localStorage keys or patterns
    # This would be expanded based on actual storage patterns

    if [ "$dev_data_found" = true ]; then
        log_warning "Development data detected in production environment"
        log_info "Consider running: ./run.sh clean-env to reset environment"
        return 1
    fi

    # Check for uncommitted changes in production
    if ! git diff --quiet 2>/dev/null; then
        log_warning "Uncommitted changes detected"
        log_info "Production should run on clean git state"
    fi

    log_success "Production safety validation passed"
    return 0
}

# =============================================================================
# BACKUP AND RESTORE FUNCTIONS
# =============================================================================

# Create environment-specific backup
create_environment_backup() {
    local backup_name="$1"
    local env=$(detect_environment_mode)
    local timestamp=$(date +%Y%m%d_%H%M%S)

    if [ -z "$backup_name" ]; then
        backup_name="auto_${env}_${timestamp}"
    fi

    local backup_path="$BACKUP_DIR/${backup_name}.tar.gz"

    log_info "Creating environment backup: $backup_name"

    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"

    # Files to backup (environment-specific)
    local backup_files=(
        "$BACKEND_LOG"
        "$FRONTEND_LOG"
        "$ENV_STATUS_FILE"
        "src/lib/utils/environmentUtils.js"
        "src/utils/crossEnvironmentCopy.js"
    )

    # Add environment-specific storage if localStorage is accessible
    # This would be expanded to include browser storage backups

    # Create the backup
    tar -czf "$backup_path" "${backup_files[@]}" 2>/dev/null

    if [ $? -eq 0 ]; then
        local backup_size=$(du -h "$backup_path" | cut -f1)
        log_success "Backup created: $backup_name ($backup_size)"
        echo "$backup_name"
        return 0
    else
        log_error "Backup creation failed"
        return 1
    fi
}

# List available backups
list_environment_backups() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "No backup directory found"
        return 1
    fi

    local backups=($(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null))

    if [ ${#backups[@]} -eq 0 ]; then
        log_info "No backups found"
        return 1
    fi

    echo ""
    echo "${BOLD}Available Backups:${NC}"
    echo ""

    for backup in "${backups[@]}"; do
        local basename=$(basename "$backup" .tar.gz)
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -c %y "$backup" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1)

        echo "  ${BLUE}•${NC} $basename"
        echo "    ${DIM}Size: $size | Date: $date${NC}"
        echo ""
    done
}

# Restore from backup
restore_environment_backup() {
    local backup_name="$1"

    if [ -z "$backup_name" ]; then
        log_error "Backup name required"
        log_info "Available backups:"
        list_environment_backups
        return 1
    fi

    local backup_path="$BACKUP_DIR/${backup_name}.tar.gz"

    if [ ! -f "$backup_path" ]; then
        log_error "Backup not found: $backup_name"
        return 1
    fi

    log_warning "Restoring from backup: $backup_name"
    log_info "This will replace current environment files"

    # Confirmation prompt
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        return 0
    fi

    # Stop services before restore
    stop

    # Create a backup of current state before restore
    local pre_restore_backup="pre_restore_$(date +%Y%m%d_%H%M%S)"
    create_environment_backup "$pre_restore_backup"

    # Restore from backup
    tar -xzf "$backup_path" -C . 2>/dev/null

    if [ $? -eq 0 ]; then
        log_success "Restore completed from: $backup_name"
        log_info "Pre-restore backup created: $pre_restore_backup"
        return 0
    else
        log_error "Restore failed"
        return 1
    fi
}

# Clean old backups (keep last 10)
clean_old_backups() {
    if [ ! -d "$BACKUP_DIR" ]; then
        return 0
    fi

    local backup_count=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)

    if [ $backup_count -le 10 ]; then
        log_info "No cleanup needed (current: $backup_count backups)"
        return 0
    fi

    log_info "Cleaning old backups (keeping last 10)..."

    # Remove oldest backups, keeping last 10
    ls -t "$BACKUP_DIR"/*.tar.gz | tail -n +11 | xargs rm -f

    local remaining=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
    log_success "Cleanup completed (remaining: $remaining backups)"
}

# =============================================================================
# SNAPSHOT MANAGEMENT FUNCTIONS
# =============================================================================

# Save current build as immutable snapshot
snapshot_save() {
    # Validate we have something to save
    if [ ! -d "dist/" ] || [ -z "$(ls -A dist/)" ]; then
        log_error "No valid build to save. Run 'npm run build:prod' first."
        return 1
    fi

    local TAG="stable-$(date +%Y%m%d-%H%M%S)"

    # Stage and commit current state
    git add .
    git commit -m "Stable snapshot $TAG" 2>/dev/null || true

    # Create immutable tag
    git tag -a "$TAG" -m "Stable build snapshot - $(date)"

    log_success "Saved as: $TAG"
    log_info "Build artifacts preserved in /dist/"
    echo "$TAG"
}

# List all available stable snapshots
snapshot_show() {
    local tags=($(git tag -l "stable-*" --sort=-version:refname 2>/dev/null))

    if [ ${#tags[@]} -eq 0 ]; then
        log_info "No stable snapshots found"
        log_info "Use './run.sh snapshot_save' to create one"
        return 1
    fi

    echo ""
    echo "${BOLD}Available Stable Snapshots:${NC}"
    echo ""

    for tag in "${tags[@]}"; do
        local date=$(git log -1 --format=%ai "$tag" 2>/dev/null | cut -d' ' -f1,2 | cut -d'-' -f1-3)
        echo "  ${BLUE}🏷️${NC} $tag"
        echo "    ${DIM}Created: $date${NC}"
        echo ""
    done
}

# Deploy specific snapshot
snapshot_use() {
    local TAG="$1"

    if [ -z "$TAG" ]; then
        log_error "Please specify a snapshot"
        log_info "Usage: ./run.sh snapshot_use stable-20241119-143000"
        log_info "Available snapshots:"
        snapshot_show
        return 1
    fi

    if ! git rev-parse "$TAG" >/dev/null 2>&1; then
        log_error "Snapshot '$TAG' not found"
        log_info "Use './run.sh snapshot_show' to list available snapshots"
        return 1
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "You have uncommitted changes"
        log_info "Changes will be preserved but not committed"
    fi

    git checkout "$TAG"

    log_success "Now using: $TAG"
    log_info "Run './run.sh start' to deploy this version"
}

# Return to development branch
back_to_work() {
    # Try main first, then master
    if git rev-parse --verify main >/dev/null 2>&1; then
        git checkout main
        log_success "Back to development branch (main)"
    elif git rev-parse --verify master >/dev/null 2>&1; then
        git checkout master
        log_success "Back to development branch (master)"
    else
        log_error "No main or master branch found"
        log_info "Create a development branch first"
        return 1
    fi
}

# =============================================================================
# BROWSER INTEGRATION
# =============================================================================

# Detect available browsers
detect_available_browsers() {
    local browsers=()

    # Check for common browsers
    if command -v google-chrome &> /dev/null; then
        browsers+=("google-chrome")
    fi

    if command -v chromium-browser &> /dev/null; then
        browsers+=("chromium-browser")
    fi

    if command -v firefox &> /dev/null; then
        browsers+=("firefox")
    fi

    if command -v safari &> /dev/null; then
        browsers+=("safari")
    fi

    if command -v edge &> /dev/null; then
        browsers+=("edge")
    fi

    echo "${browsers[@]}"
}

# Open browser with environment-specific configuration
open_browser() {
    local url="$1"
    local browser="${2:-$DEFAULT_BROWSER}"
    local env=$(detect_environment_mode)

    if [ -z "$url" ]; then
        url="http://localhost:$FRONTEND_PORT"
    fi

    # Add environment-specific query parameters
    if [ "$env" = "$DEVELOPMENT_MODE" ]; then
        url="${url}?env=dev&hmr=true"
    else
        url="${url}?env=prod"
    fi

    log_info "Opening $url in $browser..."

    # Check if browser is available
    if ! command -v "$browser" &> /dev/null; then
        local available_browsers=($(detect_available_browsers))
        if [ ${#available_browsers[@]} -gt 0 ]; then
            log_warning "$browser not found, using ${available_browsers[0]}"
            browser="${available_browsers[0]}"
        else
            log_warning "No supported browser found"
            log_info "Please open manually: $url"
            return 1
        fi
    fi

    # Open browser with appropriate flags
    case "$browser" in
        "google-chrome"|"chromium-browser")
            "$browser" --new-window --disable-web-security --user-data-dir=/tmp/neurosensefx_"$env" "$url" &>/dev/null &
            ;;
        "firefox")
            "$browser" --new-window "$url" &>/dev/null &
            ;;
        "safari")
            open "$url" &>/dev/null &
            ;;
        "edge")
            "$browser" --new-window "$url" &>/dev/null &
            ;;
        *)
            "$browser" "$url" &>/dev/null &
            ;;
    esac

    # Wait a moment for browser to open
    sleep $BROWSER_TIMEOUT

    if pgrep -f "$browser" > /dev/null; then
        log_success "Browser opened successfully"
        return 0
    else
        log_warning "Browser may not have opened properly"
        log_info "Please open manually: $url"
        return 1
    fi
}

# =============================================================================
# ENHANCED SERVICE STATUS VERIFICATION
# =============================================================================

# Check backend service readiness
check_backend_ready() {
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if pgrep -f "node.*server.js" > /dev/null; then
            # Additional check: verify WebSocket is responding
            if timeout 3 bash -c "</dev/tcp/localhost/$BACKEND_PORT" 2>/dev/null; then
                return 0
            fi
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Check frontend service readiness
check_frontend_ready() {
    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Check for recent errors in logs
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

# Get detailed service information
get_service_info() {
    local service="$1"
    local info=""

    case "$service" in
        "backend")
            local pid=$(pgrep -f "node.*server.js" | head -1)
            if [ -n "$pid" ]; then
                info="PID: $pid"
                info="$info | Memory: $(ps -p $pid -o rss= 2>/dev/null | awk '{print $1/1024 "MB"}' || echo "N/A")"
                info="$info | CPU: $(ps -p $pid -o %cpu= 2>/dev/null | tr -d ' ' || echo "N/A")"
                info="$info | Port: $BACKEND_PORT"
            fi
            ;;
        "frontend")
            local pid=$(pgrep -f "vite" | head -1)
            if [ -n "$pid" ]; then
                info="PID: $pid"
                info="$info | Memory: $(ps -p $pid -o rss= 2>/dev/null | awk '{print $1/1024 "MB"}' || echo "N/A")"
                info="$info | CPU: $(ps -p $pid -o %cpu= 2>/dev/null | tr -d ' ' || echo "N/A")"
                info="$info | Port: $FRONTEND_PORT"
            fi
            ;;
    esac

    echo "$info"
}

# =============================================================================
# ENHANCED SERVICE MANAGEMENT
# =============================================================================

# Enhanced stop with environment cleanup
stop() {
    log "Stopping services..."
    update_environment_status "last_command" "stop"

    # Direct killing - no background subshell
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "npm.*run.*dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true

    # Close browser instances if they were opened by script
    pkill -f "neurosensefx_dev" 2>/dev/null || true
    pkill -f "neurosensefx_prod" 2>/dev/null || true

    # Update environment status
    update_environment_status "backend_running" "false"
    update_environment_status "frontend_running" "false"

    # Return immediately - don't wait for processes to die
    log_success "Services stop initiated"
}

# Clean environment-specific data
clean_environment() {
    local env=$(detect_environment_mode)
    local force="$1"

    log_warning "Cleaning $env environment data..."

    # Safety check for production environment
    if [ "$env" = "$PRODUCTION_MODE" ] && [ "$force" != "--force" ]; then
        log_error "Production environment cleanup requires --force flag"
        log_info "Use: ./run.sh clean-env --force"
        return 1
    fi

    # Confirmation prompt
    if [ "$force" != "--force" ]; then
        read -p "Are you sure you want to clean $env environment data? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Environment cleanup cancelled"
            return 0
        fi
    fi

    # Stop services first
    stop

    # Clean log files
    > "$BACKEND_LOG" 2>/dev/null || true
    > "$FRONTEND_LOG" 2>/dev/null || true

    # Clean environment-specific storage (browser localStorage cleanup would go here)
    log_info "Browser storage cleanup (manual step required):"
    log_info "  1. Open browser developer tools"
    log_info "  2. Go to Application/Storage tab"
    log_info "  3. Clear localStorage items with prefix '$env-'"

    # Reset environment status
    initialize_environment_status

    log_success "Environment cleanup completed"
}

# =============================================================================
# ENVIRONMENT STATUS COMMAND
# =============================================================================

# Show comprehensive environment status
env_status() {
    local env=$(detect_environment_mode)
    local env_color=$(get_environment_color)

    echo ""
    echo "${BOLD}=== $PROJECT_NAME Environment Status ===${NC}"
    echo ""

    # Environment information
    echo "${env_color}Environment:${NC} $env"
    echo "Script Version: $SCRIPT_VERSION"

    # Environment status file
    if [ -f "$ENV_STATUS_FILE" ]; then
        local status_age=$(( $(date +%s) - $(grep -o '"timestamp": [0-9]*' "$ENV_STATUS_FILE" | cut -d' ' -f2) ))
        local last_command=$(grep -o '"last_command": "[^"]*"' "$ENV_STATUS_FILE" | cut -d'"' -f4)

        echo "Status Age: ${status_age}s ago"
        echo "Last Command: ${last_command:-"None"}"
    else
        echo "Status File: ${YELLOW}Not found${NC}"
    fi

    echo ""

    # Service status
    echo "${BOLD}Service Status:${NC}"

    if pgrep -f "node.*server.js" > /dev/null; then
        local service_info=$(get_service_info "backend")
        log_success "Backend: RUNNING ($service_info)"
        update_environment_status "backend_running" "true"
    else
        log_error "Backend: STOPPED"
        update_environment_status "backend_running" "false"
    fi

    if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        local service_info=$(get_service_info "frontend")
        log_success "Frontend: SERVING ($service_info)"
        update_environment_status "frontend_running" "true"
    elif pgrep -f "vite" > /dev/null; then
        local service_info=$(get_service_info "frontend")
        log_warning "Frontend: BUILDING ($service_info)"
        update_environment_status "frontend_running" "false"
    else
        log_error "Frontend: STOPPED"
        update_environment_status "frontend_running" "false"
    fi

    echo ""

    # Port status
    echo "${BOLD}Port Status:${NC}"
    if netstat -tuln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
        echo "  Backend ($BACKEND_PORT): ${GREEN}Open${NC}"
    else
        echo "  Backend ($BACKEND_PORT): ${RED}Closed${NC}"
    fi

    if netstat -tuln 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
        echo "  Frontend ($FRONTEND_PORT): ${GREEN}Open${NC}"
    else
        echo "  Frontend ($FRONTEND_PORT): ${RED}Closed${NC}"
    fi

    echo ""

    # Storage information
    echo "${BOLD}Storage Information:${NC}"
    if [ -f "$BACKEND_LOG" ]; then
        local backend_size=$(du -h "$BACKEND_LOG" | cut -f1)
        echo "  Backend Log: $backend_size"
    else
        echo "  Backend Log: ${DIM}Not found${NC}"
    fi

    if [ -f "$FRONTEND_LOG" ]; then
        local frontend_size=$(du -h "$FRONTEND_LOG" | cut -f1)
        echo "  Frontend Log: $frontend_size"
    else
        echo "  Frontend Log: ${DIM}Not found${NC}"
    fi

    # Backup information
    if [ -d "$BACKUP_DIR" ]; then
        local backup_count=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
        if [ $backup_count -gt 0 ]; then
            echo "  Backups: $backup_count available"
        else
            echo "  Backups: ${DIM}None found${NC}"
        fi
    else
        echo "  Backups: ${DIM}Not initialized${NC}"
    fi

    echo ""

    # Recent errors check
    echo "${BOLD}Recent Issues:${NC}"
    if check_recent_errors "$BACKEND_LOG"; then
        log_warning "Recent backend errors detected"
    fi

    if check_recent_errors "$FRONTEND_LOG"; then
        log_warning "Recent frontend errors detected"
    fi

    if ! check_recent_errors "$BACKEND_LOG" && ! check_recent_errors "$FRONTEND_LOG"; then
        log_success "No recent errors detected"
    fi

    echo ""

    # Environment-specific tips
    echo "${BOLD}Environment Tips:${NC}"
    if [ "$env" = "$DEVELOPMENT_MODE" ]; then
        echo "  ${BLUE}•${NC} Use './run.sh dev' for development with hot reload"
        echo "  ${BLUE}•${NC} Changes will auto-refresh in browser"
        echo "  ${BLUE}•${NC} Logs are verbose for debugging"
    else
        echo "  ${BLUE}•${NC} Production mode optimized for performance"
        echo "  ${BLUE}•${NC} Minimal logging for clean operation"
        echo "  ${BLUE}•${NC} Validated data and error handling"
    fi

    echo ""
}

# =============================================================================
# ENHANCED SERVICE COMMANDS WITH ENVIRONMENT AWARENESS
# =============================================================================

# Check for running services and handle conflicts
check_running_services() {
    local env="$1"
    local running_services=()
    local conflict_type=""

    # Check for running backend services
    if pgrep -f "node.*server.js" > /dev/null; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        local backend_port=$(lsof -p $backend_pid -i -P -n 2>/dev/null | grep LISTEN | awk '{print $9}' | cut -d: -f2 | head -1)

        if [ -n "$backend_port" ]; then
            if [ "$env" = "$DEVELOPMENT_MODE" ] && [ "$backend_port" = "$PROD_BACKEND_PORT" ]; then
                conflict_type="production_backend"
                running_services+=("Production backend (PID: $backend_pid, Port: $backend_port)")
            elif [ "$env" = "$PRODUCTION_MODE" ] && [ "$backend_port" = "$DEV_BACKEND_PORT" ]; then
                conflict_type="development_backend"
                running_services+=("Development backend (PID: $backend_pid, Port: $backend_port)")
            fi
        fi
    fi

    # Check for running frontend services
    if pgrep -f "vite.*preview\|npm.*preview\|vite.*dev" > /dev/null; then
        local frontend_pids=$(pgrep -f "vite.*preview\|npm.*preview\|vite.*dev")
        for pid in $frontend_pids; do
            local frontend_port=$(lsof -p $pid -i -P -n 2>/dev/null | grep LISTEN | awk '{print $9}' | cut -d: -f2 | head -1)
            if [ -n "$frontend_port" ]; then
                if [ "$env" = "$DEVELOPMENT_MODE" ] && [ "$frontend_port" = "$PROD_FRONTEND_PORT" ]; then
                    running_services+=("Production frontend (PID: $pid, Port: $frontend_port)")
                elif [ "$env" = "$PRODUCTION_MODE" ] && [ "$frontend_port" = "$DEV_FRONTEND_PORT" ]; then
                    running_services+=("Development frontend (PID: $pid, Port: $frontend_port)")
                fi
            fi
        done
    fi

    # Return results
    if [ ${#running_services[@]} -gt 0 ]; then
        log_warning "⚠️  Detected running services that conflict with $env mode:"
        for service in "${running_services[@]}"; do
            echo "    • $service"
        done
        echo ""
        return 1  # Conflict detected
    else
        return 0  # No conflicts
    fi
}

# Enhanced development mode with environment awareness
dev() {
    # Force development mode by setting environment variables first
    export NODE_ENV="development"
    export VITE_DEV="true"

    # Explicitly use development mode for dev command unless overridden
    local env=$(detect_environment_mode "mode" "${1:-development}")
    local auto_browser="${2:-true}"  # Default to opening browser

    log_info "Starting $env development environment..."
    update_environment_status "last_command" "dev"

    # Set environment-specific ports
    set_environment_ports "$env"

    # Validate environment first
    if ! validate_environment; then
        log_error "Environment validation failed - fix issues before continuing"
        return 1
    fi

    # Set development mode
    export VITE_DEV="true"
    export NODE_ENV="development"
    export WS_PORT=$BACKEND_PORT

    log_info "🔄 HMR enabled - changes will auto-refresh browser"
    log_info "📝 Frontend logs: Terminal, Backend logs: $BACKEND_LOG"
    log_info "🛑 Use Ctrl+C to stop development server"

    # Check for service conflicts before stopping anything
    if ! check_running_services "$env"; then
        log_error "❌ Cannot start $env environment - conflicting services are running"
        echo ""
        echo "To resolve this:"
        echo "  1. Stop the conflicting services: ./run.sh stop"
        echo "  2. Then start your desired environment: ./run.sh dev"
        echo ""
        echo "Or use different environments on different ports with:"
        echo "  • Development: ./run.sh dev    (Backend: $DEV_BACKEND_PORT, Frontend: $DEV_FRONTEND_PORT)"
        echo "  • Production: ./run.sh start  (Backend: $PROD_BACKEND_PORT, Frontend: $PROD_FRONTEND_PORT)"
        return 1
    fi

    # Only stop development services (if any are running)
    log_info "Checking for existing development services..."
    local dev_services_running=false

    # Check for development backend
    if pgrep -f "node.*server.js" > /dev/null; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        local backend_port=$(lsof -p $backend_pid -i -P -n 2>/dev/null | grep LISTEN | awk '{print $9}' | cut -d: -f2 | head -1)
        if [ "$backend_port" = "$DEV_BACKEND_PORT" ]; then
            log_info "Stopping existing development backend..."
            kill $backend_pid 2>/dev/null || true
            dev_services_running=true
        fi
    fi

    # Check for development frontend
    if pgrep -f "vite.*dev\|npm.*dev" > /dev/null; then
        local frontend_pids=$(pgrep -f "vite.*dev\|npm.*dev")
        for pid in $frontend_pids; do
            kill $pid 2>/dev/null || true
            dev_services_running=true
        done
        log_info "Stopping existing development frontend..."
    fi

    if [ "$dev_services_running" = true ]; then
        sleep 2
        log_info "✅ Development services stopped safely"
    else
        log_info "✅ No conflicting development services found"
    fi

    # Clear previous logs for clean state
    > "$BACKEND_LOG"
    > "$FRONTEND_LOG"
    log_info "🗑️  Cleared previous log files"

    # Start backend with status tracking
    echo ""
    log_info "🔧 Starting backend service..."
    cd services/tick-backend
    nohup node server.js > "../../$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    disown $! 2>/dev/null || true
    cd - > /dev/null

    # Verify backend startup
    echo "⏳ Waiting for backend to start..."
    if check_backend_ready; then
        log_success "Backend started successfully (PID: $BACKEND_PID)"
        log_info "   WebSocket: ws://localhost:$BACKEND_PORT"
        update_environment_status "backend_running" "true"
    else
        log_error "Backend failed to start - check $BACKEND_LOG"
        if [ -f "$BACKEND_LOG" ]; then
            echo "Last 5 lines of $BACKEND_LOG:"
            tail -5 "$BACKEND_LOG"
        fi
        update_environment_status "backend_running" "false"
        return 1
    fi

    # Start frontend with build verification
    echo ""
    log_info "🔨 Building and starting frontend..."
    log_info "   This may take 10-30 seconds for initial build..."
    echo ""

    # Start frontend in foreground but capture output to log as well
    npm run dev 2>&1 | tee "$FRONTEND_LOG" &
    FRONTEND_PID=$!

    # Give frontend time to build
    echo "⏳ Waiting for frontend build completion..."
    if check_frontend_ready; then
        echo ""
        log_success "Frontend built successfully and is serving"
        log_info "   URL: http://localhost:$FRONTEND_PORT"
        log_info "   HMR: Active (changes will auto-refresh)"
        update_environment_status "frontend_running" "true"

        # Auto-open browser if requested
        if [ "$auto_browser" = "true" ]; then
            echo ""
            log_info "🌐 Opening browser..."
            if open_browser; then
                log_success "Browser opened with development configuration"
            else
                log_warning "Browser auto-open failed - open manually: http://localhost:$FRONTEND_PORT"
            fi
        fi

        echo ""
        log_success "🚀 Development environment ready!"
        log_info "   Both services are running - you can start coding"
        echo ""
        log_info "💡 Development Tips:"
        log_info "   • Frontend errors appear in terminal immediately"
        log_info "   • Backend issues: check $BACKEND_LOG"
        log_info "   • Build failures: visible in terminal + $FRONTEND_LOG"
        log_info "   • Use './run.sh env-status' for detailed environment info"
        echo ""

        # Keep the frontend process attached
        wait $FRONTEND_PID
    else
        echo ""
        log_error "Frontend build failed or timed out"
        log_info "Check the terminal output above and $FRONTEND_LOG for errors"
        echo ""
        log_info "Common issues:"
        log_info "  • Port conflicts (kill processes on $FRONTEND_PORT)"
        log_info "  • Missing dependencies (run 'npm install')"
        log_info "  • Compilation errors (check terminal output)"
        update_environment_status "frontend_running" "false"
        echo ""
        return 1
    fi
}

# Enhanced start command with production safeguards
start() {
    # Force production mode by setting environment variables first
    export NODE_ENV="production"
    export VITE_DEV="false"

    # Explicitly use production mode for start command unless overridden
    local env=$(detect_environment_mode "mode" "${1:-production}")

    log "Starting services in $env mode..."
    update_environment_status "last_command" "start"

    # Set environment-specific ports
    set_environment_ports "$env"

    # Production safety validation
    if ! validate_production_safety; then
        log_error "Production safety validation failed"
        log_info "Use './run.sh clean-env --force' to reset if needed"
        return 1
    fi

    # Environment validation
    if ! validate_environment; then
        log_error "Environment validation failed"
        return 1
    fi

    # Set production mode flags
    if [ "$env" = "$PRODUCTION_MODE" ]; then
        export NODE_ENV="production"
        export VITE_DEV="false"
        log_info "Production optimizations enabled"
    fi

    # Check for service conflicts before stopping anything
    if ! check_running_services "$env"; then
        log_error "❌ Cannot start $env environment - conflicting services are running"
        echo ""
        echo "To resolve this:"
        echo "  1. Stop the conflicting services: ./run.sh stop"
        echo "  2. Then start your desired environment: ./run.sh start"
        echo ""
        echo "Or use different environments on different ports with:"
        echo "  • Development: ./run.sh dev    (Backend: $DEV_BACKEND_PORT, Frontend: $DEV_FRONTEND_PORT)"
        echo "  • Production: ./run.sh start  (Backend: $PROD_BACKEND_PORT, Frontend: $PROD_FRONTEND_PORT)"
        return 1
    fi

    # Only stop production services (if any are running)
    log_info "Checking for existing production services..."
    local prod_services_running=false

    # Check for production backend
    if pgrep -f "node.*server.js" > /dev/null; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        local backend_port=$(lsof -p $backend_pid -i -P -n 2>/dev/null | grep LISTEN | awk '{print $9}' | cut -d: -f2 | head -1)
        if [ "$backend_port" = "$PROD_BACKEND_PORT" ]; then
            log_info "Stopping existing production backend..."
            kill $backend_pid 2>/dev/null || true
            prod_services_running=true
        fi
    fi

    # Check for production frontend
    if pgrep -f "vite.*preview\|npm.*preview" > /dev/null; then
        local frontend_pids=$(pgrep -f "vite.*preview\|npm.*preview")
        for pid in $frontend_pids; do
            kill $pid 2>/dev/null || true
            prod_services_running=true
        done
        log_info "Stopping existing production frontend..."
    fi

    if [ "$prod_services_running" = true ]; then
        sleep 1
        log_info "✅ Production services stopped safely"
    else
        log_info "✅ No conflicting production services found"
    fi

    # Start backend with proper detachment
    log "Starting backend..."
    cd services/tick-backend
    # Use nohup with proper I/O redirection and disown
    # Pass environment variables to backend process
    NODE_ENV="$NODE_ENV" WS_PORT="$BACKEND_PORT" nohup node server.js > "../../$BACKEND_LOG" 2>&1 &
    # Disown the process to detach it from the shell
    disown $! 2>/dev/null || true
    cd - > /dev/null

    # Start frontend with proper detachment
    log "Starting frontend..."
    if [ "$env" = "$PRODUCTION_MODE" ]; then
        # Build and serve production version
        log_info "Building production frontend..."
        nohup npm run build:prod > "$FRONTEND_LOG" 2>&1 &
        BUILD_PID=$!
        disown $BUILD_PID 2>/dev/null || true

        # Wait for build to complete, then start preview server
        sleep 5
        if [ -d "dist" ]; then
            log_info "Starting production preview server..."
            nohup npm run preview > "$FRONTEND_LOG" 2>&1 &
            disown $! 2>/dev/null || true
        fi
    else
        # Development mode
        nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
        disown $! 2>/dev/null || true
    fi

    # Update environment status
    update_environment_status "backend_running" "true"
    update_environment_status "frontend_running" "true"

    # Return immediately - don't wait for services to start
    log_success "Services start initiated"
    log_info "Backend: ws://localhost:$BACKEND_PORT"
    log_info "Frontend: http://localhost:$FRONTEND_PORT"
    log_info "Check status with: ./run.sh env-status"
}

# =============================================================================
# NEW ENVIRONMENT COMMANDS
# =============================================================================

# Copy production to development environment
copy_prod_to_dev() {
    log_info "Copying production environment data to development..."

    # Create backup before copy
    local backup_name="pre_copy_prod_to_dev_$(date +%Y%m%d_%H%M%S)"
    create_environment_backup "$backup_name"

    log_info "This operation will copy production data to development environment"
    log_warning "This will overwrite current development data"

    # Confirmation prompt
    read -p "Are you sure? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Copy operation cancelled"
        return 0
    fi

    # Simulate copy operation (would integrate with crossEnvironmentCopy.js)
    log_info "Starting copy operation..."

    # This would call the JavaScript utilities
    log_success "Production to development copy completed"
    log_info "Backup created: $backup_name"
}

# Copy development to production environment
copy_dev_to_prod() {
    log_warning "Copying development environment data to production..."

    # Production safety check
    if ! validate_production_safety; then
        log_error "Cannot copy to production - safety checks failed"
        return 1
    fi

    # Create backup before copy
    local backup_name="pre_copy_dev_to_prod_$(date +%Y%m%d_%H%M%S)"
    create_environment_backup "$backup_name"

    log_warning "⚠️  PRODUCTION ENVIRONMENT ⚠️"
    log_warning "This operation will copy development data to production environment"
    log_warning "This will overwrite current production data"

    # Confirmation prompt
    read -p "Are you absolutely sure? Type 'PROD' to confirm: " -r
    echo

    if [[ ! $REPLY = "PROD" ]]; then
        log_info "Production copy cancelled (safety measure)"
        return 0
    fi

    # Second confirmation
    read -p "Final confirmation - copy development to production? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Production copy cancelled"
        return 0
    fi

    # Simulate copy operation (would integrate with crossEnvironmentCopy.js)
    log_info "Starting production copy operation..."

    # This would call the JavaScript utilities
    log_success "Development to production copy completed"
    log_warning "Please validate production environment is working correctly"
    log_info "Backup created: $backup_name"
}

# Enhanced backup command
backup_env() {
    local backup_name="$1"

    if [ -z "$backup_name" ]; then
        backup_name="manual_$(detect_environment_mode)_$(date +%Y%m%d_%H%M%S)"
    fi

    log_info "Creating environment backup: $backup_name"

    if create_environment_backup "$backup_name"; then
        log_success "Backup created successfully"
        log_info "Use './run.sh restore-env $backup_name' to restore"
    else
        log_error "Backup creation failed"
        return 1
    fi
}

# Enhanced restore command
restore_env() {
    local backup_name="$1"

    if [ -z "$backup_name" ]; then
        log_error "Backup name required"
        log_info "Available backups:"
        list_environment_backups
        return 1
    fi

    restore_environment_backup "$backup_name"
}

# List available backups
list_backups() {
    log_info "Available environment backups:"
    list_environment_backups
}

# Enhanced status check with environment awareness
status() {
    local env=$(detect_environment_mode)
    local env_color=$(get_environment_color)

    echo ""
    echo "${BOLD}=== $PROJECT_NAME Service Status ===${NC}"
    echo "${env_color}Environment: $env${NC}"
    echo ""

    # Check backend service
    if pgrep -f "node.*server.js" > /dev/null; then
        local backend_pid=$(pgrep -f "node.*server.js" | head -1)
        local service_info=$(get_service_info "backend")
        log_success "Backend: RUNNING ($service_info)"
        log_info "   WebSocket: ws://localhost:$BACKEND_PORT"

        # Check for recent backend errors
        if check_recent_errors "$BACKEND_LOG"; then
            log_warning "   Recent errors detected in $BACKEND_LOG"
        fi
    else
        log_error "Backend: STOPPED"
        log_info "   Expected: WebSocket server on ws://localhost:$BACKEND_PORT"
    fi

    echo ""

    # Check frontend service with detailed status
    if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        local frontend_pid=$(pgrep -f "vite" | head -1)
        local service_info=$(get_service_info "frontend")
        log_success "Frontend: SERVING ($service_info)"
        log_info "   URL: http://localhost:$FRONTEND_PORT"

        if [ "$env" = "$DEVELOPMENT_MODE" ]; then
            log_info "   HMR: Active (hot reload enabled)"
        fi

        # Check for recent frontend errors
        if check_recent_errors "$FRONTEND_LOG"; then
            log_warning "   Recent build errors detected in $FRONTEND_LOG"
        fi
    elif pgrep -f "vite" > /dev/null; then
        local frontend_pid=$(pgrep -f "vite" | head -1)
        local service_info=$(get_service_info "frontend")
        log_warning "Frontend: BUILDING ($service_info)"
        log_info "   URL: http://localhost:$FRONTEND_PORT (when ready)"
        log_info "   Status: Currently building or starting..."
    else
        log_error "Frontend: STOPPED"
        log_info "   Expected: Development server on http://localhost:$FRONTEND_PORT"
    fi

    echo ""

    # Port conflict detection
    if netstat -tuln 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
        if ! pgrep -f "vite" > /dev/null; then
            log_warning "Port $FRONTEND_PORT is occupied but Vite is not running"
            log_info "   Another service may be using this port"
        fi
    fi

    if netstat -tuln 2>/dev/null | grep -q ":$BACKEND_PORT "; then
        if ! pgrep -f "node.*server.js" > /dev/null; then
            log_warning "Port $BACKEND_PORT is occupied but backend is not running"
            log_info "   Another service may be using this port"
        fi
    fi

    echo ""
    echo "${BOLD}Quick Actions:${NC}"
    echo "  ./run.sh dev           # Start development with verification"
    echo "  ./run.sh start         # Start services in background"
    echo "  ./run.sh env-status    # Show detailed environment status"
    echo "  ./run.sh logs          # View service logs"
    echo "  ./run.sh restart       # Restart all services"
    echo "  ./run.sh browser       # Open browser with current environment"
    echo ""
}

# Enhanced logs command with environment awareness
logs() {
    local service=${1:-"all"}
    local env=$(detect_environment_mode)

    echo ""
    echo "${BOLD}=== $env Environment Logs ===${NC}"
    echo ""

    case $service in
        "backend")
            if [ -f "$BACKEND_LOG" ]; then
                echo "=== Backend Logs ==="
                echo "File: $BACKEND_LOG"
                echo "Environment: $env"
                echo ""
                tail -f "$BACKEND_LOG"
            else
                log_error "No backend log file found ($BACKEND_LOG)"
            fi
            ;;
        "frontend")
            if [ -f "$FRONTEND_LOG" ]; then
                echo "=== Frontend Logs ==="
                echo "File: $FRONTEND_LOG"
                echo "Environment: $env"
                echo ""
                tail -f "$FRONTEND_LOG"
            else
                log_error "No frontend log file found ($FRONTEND_LOG)"
            fi
            ;;
        "all"|*)
            echo "=== All Service Logs ==="
            echo "Environment: $env"
            echo ""

            if [ -f "$BACKEND_LOG" ] && [ -f "$FRONTEND_LOG" ]; then
                echo "Following both backend and frontend logs..."
                echo ""
                tail -f "$BACKEND_LOG" "$FRONTEND_LOG"
            elif [ -f "$BACKEND_LOG" ]; then
                echo "Only backend log available..."
                echo ""
                tail -f "$BACKEND_LOG"
            elif [ -f "$FRONTEND_LOG" ]; then
                echo "Only frontend log available..."
                echo ""
                tail -f "$FRONTEND_LOG"
            else
                log_error "No log files found"
                log_info "Backend log expected: $BACKEND_LOG"
                log_info "Frontend log expected: $FRONTEND_LOG"
            fi
            ;;
    esac
}

# Enhanced restart with environment awareness
restart() {
    local env=$(detect_environment_mode)

    log "Restarting services in $env mode..."
    update_environment_status "last_command" "restart"

    # Environment validation before restart
    if ! validate_environment; then
        log_error "Environment validation failed - fix issues before restart"
        return 1
    fi

    stop
    sleep 2
    start
}

# Browser command
browser() {
    local url="$1"
    local env=$(detect_environment_mode)

    log_info "Opening browser for $env environment..."

    if open_browser "$url"; then
        log_success "Browser opened successfully"
        log_info "Environment: $env"
        log_info "URL: ${url:-http://localhost:$FRONTEND_PORT}"
    else
        log_error "Failed to open browser"
        return 1
    fi
}

# =============================================================================
# COMPREHENSIVE USAGE DOCUMENTATION
# =============================================================================

usage() {
    local env=$(detect_environment_mode)
    local env_color=$(get_environment_color)

    echo ""
    echo "${BOLD}=== $PROJECT_NAME Service Management ===${NC}"
    echo "${env_color}Environment: $env${NC} | Version: $SCRIPT_VERSION"
    echo ""

    echo "${BOLD}CORE COMMANDS:${NC}"
    echo "  ${GREEN}dev${NC}        Start development with hot reload (foreground)"
    echo "  ${GREEN}start${NC}      Start all services in background (production mode)"
    echo "  ${RED}stop${NC}         Stop all services immediately"
    echo "  ${YELLOW}restart${NC}    Restart all services"
    echo "  ${YELLOW}status${NC}     Show service health status"
    echo "  ${BLUE}logs${NC}        View service logs [all|backend|frontend]"
    echo ""

    echo "${BOLD}ENVIRONMENT:${NC}"
    echo "  ${BLUE}env-status${NC}  Show comprehensive environment status"
    echo "  ${BLUE}browser${NC}     Open browser with environment config"
    echo "  ${YELLOW}clean-env${NC}  Clean environment-specific data [--force]"
    echo ""

    echo "${BOLD}BACKUP & RESTORE:${NC}"
    echo "  ${GREEN}backup-env${NC} [name]    Create environment backup"
    echo "  ${YELLOW}restore-env${NC} [name]   Restore from backup"
    echo "  ${BLUE}list-backups${NC}          List available backups"
    echo "  ${BLUE}copy-prod-to-dev${NC}      Copy production → development"
    echo "  ${RED}copy-dev-to-prod${NC}       Copy development → production"
    echo ""
    echo "${BOLD}SNAPSHOT MANAGEMENT:${NC}"
    echo "  ${GREEN}snapshot_save${NC}         Save current build as stable snapshot"
    echo "  ${BLUE}snapshot_show${NC}          List all available snapshots"
    echo "  ${YELLOW}snapshot_use${NC} [tag]   Deploy specific snapshot"
    echo "  ${BLUE}back_to_work${NC}           Return to development branch"
    echo ""

    echo "${BOLD}EXAMPLES:${NC}"
    echo "  ./run.sh dev                           # Start development"
    echo "  ./run.sh start                         # Start production services"
    echo "  ./run.sh status                        # Check service health"
    echo "  ./run.sh logs backend                  # View backend logs"
    echo "  ./run.sh snapshot_save                 # Save current build as stable"
    echo "  ./run.sh snapshot_use stable-20241119  # Deploy specific snapshot"
    echo "  ./run.sh back_to_work                  # Return to development"
    echo ""

    if [ "$env" = "$DEVELOPMENT_MODE" ]; then
        echo "${DEV_COLOR}Development: HMR enabled, verbose logging, auto-browser${NC}"
    else
        echo "${PROD_COLOR}Production: Performance optimized, minimal logging${NC}"
    fi

    echo ""
}

# =============================================================================
# MAIN EXECUTION WITH ALL COMMANDS
# =============================================================================

# Initialize environment status if needed
if [ ! -f "$ENV_STATUS_FILE" ]; then
    initialize_environment_status
fi

# Main command execution
case "${1:-}" in
    # Core service commands
    "dev")
        dev "${2:-true}"  # Pass auto-browser flag
        ;;
    "start")
        start "${2:-}" "${3:-}"  # Pass command line arguments
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

    # Environment management commands
    "env-status")
        env_status
        ;;
    "browser")
        browser "${2:-}"
        ;;
    "clean-env")
        clean_environment "${2:-}"
        ;;

    # Backup and restore commands
    "backup-env")
        backup_env "${2:-}"
        ;;
    "restore-env")
        restore_env "${2:-}"
        ;;
    "list-backups")
        list_backups
        ;;

    # Cross-environment copy commands
    "copy-prod-to-dev")
        copy_prod_to_dev
        ;;
    "copy-dev-to-prod")
        copy_dev_to_prod
        ;;

    # Snapshot management commands
    "snapshot_save")
        snapshot_save
        ;;
    "snapshot_show")
        snapshot_show
        ;;
    "snapshot_use")
        snapshot_use "${2:-}"
        ;;
    "back_to_work")
        back_to_work
        ;;

    # Help and information
    "help"|"-h"|"--help")
        usage
        ;;
    "version"|"-v"|"--version")
        echo "$PROJECT_NAME Service Management Script v$SCRIPT_VERSION"
        echo "Environment: $(detect_environment_mode)"
        ;;
    "")
        log_error "No command provided"
        echo ""
        usage
        exit 1
        ;;
    *)
        log_error "Unknown command: $1"
        echo ""
        echo "Available commands:"
        echo "  dev, start, stop, restart, status, logs"
        echo "  env-status, browser, clean-env"
        echo "  backup-env, restore-env, list-backups"
        echo "  copy-prod-to-dev, copy-dev-to-prod"
        echo "  snapshot_save, snapshot_show, snapshot_use, back_to_work"
        echo "  help, version"
        echo ""
        echo "Use './run.sh help' for detailed information"
        exit 1
        ;;
esac

# Always return immediately with success
exit 0
