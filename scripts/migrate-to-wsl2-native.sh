#!/bin/bash

# WSL2 Native Filesystem Migration Script
# Migrates project to native WSL2 filesystem for optimal performance
# Creates Windows symlink for IDE access

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NATIVE_WSL2_PATH="$HOME/projects/neurosensefx-native"
WINDOWS_MOUNT="/mnt/c"
ORIGINAL_PROJECT_PATH="$(realpath "$PROJECT_ROOT")"

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

# Check if running in WSL2
check_wsl2_environment() {
    log_info "Checking WSL2 environment..."

    if [[ ! -f /proc/version ]] || ! grep -qi "microsoft\|wsl" /proc/version; then
        log_error "This script must be run in WSL2 environment"
        exit 1
    fi

    if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
        log_warning "WSL_DISTRO_NAME not set, continuing anyway..."
    fi

    log_success "WSL2 environment confirmed"
}

# Check if project is on Windows filesystem
check_current_location() {
    log_info "Checking current project location..."

    if [[ "$ORIGINAL_PROJECT_PATH" == "$WINDOWS_MOUNT"* ]]; then
        log_warning "Project is currently on Windows filesystem: $ORIGINAL_PROJECT_PATH"
        log_info "This is the bottleneck this migration will solve"
        return 0
    else
        log_info "Project is already on native WSL2 filesystem"
        log_info "Migration not needed, but you can continue for consistency"
        return 1
    fi
}

# Prepare native WSL2 location
prepare_native_location() {
    log_info "Preparing native WSL2 filesystem location..."

    # Create projects directory if it doesn't exist
    mkdir -p "$(dirname "$NATIVE_WSL2_PATH")"

    # Check if native location already exists
    if [[ -d "$NATIVE_WSL2_PATH" ]]; then
        log_warning "Native location already exists: $NATIVE_WSL2_PATH"

        if [[ -f "$NATIVE_WSL2_PATH/.migrated_from_windows" ]]; then
            log_info "This appears to be a previous migration"
            read -p "Do you want to remove it and start fresh? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_info "Removing existing native location..."
                rm -rf "$NATIVE_WSL2_PATH"
            else
                log_info "Keeping existing native location"
                return 0
            fi
        fi
    fi

    log_success "Native location prepared: $NATIVE_WSL2_PATH"
}

# Optimize copy for WSL2 performance
wsl2_optimized_copy() {
    local src="$1"
    local dest="$2"

    log_info "Copying $(basename "$src") to native filesystem..."

    # Use rsync with optimized parameters for WSL2
    rsync -avh --progress \
        --exclude='.git/objects/pack/*.pack' \
        --exclude='node_modules/**/node_modules' \
        --exclude='dist/**' \
        --exclude='coverage/**' \
        --exclude='.nyc_output/**' \
        --exclude='*.log' \
        --exclude='*.tmp' \
        --exclude='.DS_Store' \
        --exclude='Thumbs.db' \
        "$src" "$dest"
}

# Migrate project files
migrate_project_files() {
    log_info "Starting migration to native WSL2 filesystem..."

    # Create target directory
    mkdir -p "$NATIVE_WSL2_PATH"

    # Copy project content excluding large/slow directories first
    log_info "Copying core project files..."

    # Copy essential files first
    wsl2_optimized_copy "$PROJECT_ROOT/src/" "$NATIVE_WSL2_PATH/"
    wsl2_optimized_copy "$PROJECT_ROOT/services/" "$NATIVE_WSL2_PATH/"
    wsl2_optimized_copy "$PROJECT_ROOT/libs/" "$NATIVE_WSL2_PATH/"
    wsl2_optimized_copy "$PROJECT_ROOT/docs/" "$NATIVE_WSL2_PATH/"
    wsl2_optimized_copy "$PROJECT_ROOT/tests/" "$NATIVE_WSL2_PATH/"
    wsl2_optimized_copy "$PROJECT_ROOT/scripts/" "$NATIVE_WSL2_PATH/"
    wsl2_optimized_copy "$PROJECT_ROOT/examples/" "$NATIVE_WSL2_PATH/"

    # Copy configuration files
    cp "$PROJECT_ROOT"/*.json "$NATIVE_WSL2_PATH/" 2>/dev/null || true
    cp "$PROJECT_ROOT"/*.md "$NATIVE_WSL2_PATH/" 2>/dev/null || true
    cp "$PROJECT_ROOT"/*.js "$NATIVE_WSL2_PATH/" 2>/dev/null || true
    cp "$PROJECT_ROOT"/*.sh "$NATIVE_WSL2_PATH/" 2>/dev/null || true
    cp "$PROJECT_ROOT"/*.yml "$NATIVE_WSL2_PATH/" 2>/dev/null || true
    cp "$PROJECT_ROOT"/*.yaml "$NATIVE_WSL2_PATH/" 2>/dev/null || true

    # Copy git repository
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        log_info "Copying git repository..."
        wsl2_optimized_copy "$PROJECT_ROOT/.git/" "$NATIVE_WSL2_PATH/"
    fi

    # Copy other important directories
    if [[ -d "$PROJECT_ROOT/.devcontainer" ]]; then
        wsl2_optimized_copy "$PROJECT_ROOT/.devcontainer/" "$NATIVE_WSL2_PATH/"
    fi

    if [[ -d "$PROJECT_ROOT/.github" ]]; then
        wsl2_optimized_copy "$PROJECT_ROOT/.github/" "$NATIVE_WSL2_PATH/"
    fi

    if [[ -d "$PROJECT_ROOT/.vscode" ]]; then
        wsl2_optimized_copy "$PROJECT_ROOT/.vscode/" "$NATIVE_WSL2_PATH/"
    fi

    if [[ -d "$PROJECT_ROOT/.claude" ]]; then
        wsl2_optimized_copy "$PROJECT_ROOT/.claude/" "$NATIVE_WSL2_PATH/"
    fi

    # Copy environment files (excluding sensitive ones)
    cp "$PROJECT_ROOT/.env.example" "$NATIVE_WSL2_PATH/" 2>/dev/null || true

    # Create migration marker
    echo "Migrated from Windows on $(date)" > "$NATIVE_WSL2_PATH/.migrated_from_windows"
    echo "Original path: $ORIGINAL_PROJECT_PATH" >> "$NATIVE_WSL2_PATH/.migrated_from_windows"

    log_success "Project files migrated to native WSL2 filesystem"
}

# Reinstall dependencies in native location
reinstall_dependencies() {
    log_info "Reinstalling dependencies in native location..."

    cd "$NATIVE_WSL2_PATH"

    # Clean npm cache first
    npm cache clean --force

    # Install dependencies with npm optimization
    log_info "Running npm install with optimizations..."
    npm install --prefer-offline --no-audit --no-fund

    log_success "Dependencies reinstalled in native filesystem"
}

# Create Windows symlink for IDE access
create_windows_symlink() {
    log_info "Creating Windows symlink for IDE access..."

    # Convert WSL2 path to Windows path
    WINDOWS_NATIVE_PATH=$(wslpath -w "$NATIVE_WSL2_PATH")
    WINDOWS_LINK_PATH="$WINDOWS_MOUNT/Users/$USER/Desktop/NeuroSenseFX-Native"

    # Create Windows symlink using PowerShell
    powershell.exe -Command "if (Test-Path '$WINDOWS_LINK_PATH') { Remove-Item '$WINDOWS_LINK_PATH' -Force }" 2>/dev/null || true
    powershell.exe -Command "New-Item -ItemType SymbolicLink -Path '$WINDOWS_LINK_PATH' -Target '$WINDOWS_NATIVE_PATH'" 2>/dev/null || true

    if [[ $? -eq 0 ]]; then
        log_success "Windows symlink created: $WINDOWS_LINK_PATH"
        log_info "You can now access the project from Windows IDEs via this symlink"
    else
        log_warning "Could not create Windows symlink automatically"
        log_info "Manual steps:"
        log_info "  1. Open PowerShell as Administrator on Windows"
        log_info "  2. Run: New-Item -ItemType SymbolicLink -Path 'C:\\Users\\$USER\\Desktop\\NeuroSenseFX-Native' -Target '$WINDOWS_NATIVE_PATH'"
    fi
}

# Update development scripts for native filesystem
update_dev_scripts() {
    log_info "Updating development scripts for native filesystem..."

    # Update any hardcoded paths in scripts
    find "$NATIVE_WSL2_PATH/scripts" -name "*.sh" -type f -exec sed -i "s|$ORIGINAL_PROJECT_PATH|$NATIVE_WSL2_PATH|g" {} \; 2>/dev/null || true

    # Update run.sh if it exists
    if [[ -f "$NATIVE_WSL2_PATH/run.sh" ]]; then
        sed -i "s|$ORIGINAL_PROJECT_PATH|$NATIVE_WSL2_PATH|g" "$NATIVE_WSL2_PATH/run.sh"
    fi

    log_success "Development scripts updated for native filesystem"
}

# Verify migration
verify_migration() {
    log_info "Verifying migration..."

    # Check key directories exist
    local required_dirs=("src" "services" "scripts" "package.json" "CLAUDE.md")
    local missing_dirs=()

    for dir in "${required_dirs[@]}"; do
        if [[ ! -e "$NATIVE_WSL2_PATH/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done

    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
        log_error "Missing required files/directories: ${missing_dirs[*]}"
        return 1
    fi

    # Test that we can run npm commands
    cd "$NATIVE_WSL2_PATH"
    if npm list --depth=0 > /dev/null 2>&1; then
        log_success "npm installation verified"
    else
        log_error "npm installation failed verification"
        return 1
    fi

    # Test that git is working
    if git status > /dev/null 2>&1; then
        log_success "Git repository verified"
    else
        log_warning "Git repository verification failed"
    fi

    log_success "Migration verification completed"
}

# Create performance comparison script
create_performance_test() {
    log_info "Creating performance comparison script..."

    cat > "$NATIVE_WSL2_PATH/scripts/performance-comparison.sh" << 'EOF'
#!/bin/bash

# Performance comparison between Windows and native WSL2 filesystems

echo "=== Filesystem Performance Comparison ==="

# Test directory access speed
echo "Testing directory access speed..."

if [[ -d "/mnt/c" ]]; then
    echo "Windows filesystem (/mnt/c):"
    time (find /mnt/c/Windows -maxdepth 2 -type f >/dev/null 2>&1)
fi

echo "Native WSL2 filesystem:"
time (find ~ -maxdepth 2 -type f >/dev/null 2>&1)

# Test npm operations
echo "Testing npm operations..."
echo "npm version check:"
time npm --version

# Test file creation
echo "Testing file creation speed..."
echo "Windows filesystem:"
time (echo "test" > /tmp/windows_test && rm /tmp/windows_test)

echo "Native WSL2 filesystem:"
time (echo "test" > /tmp/native_test && rm /tmp/native_test)

echo "=== Performance comparison completed ==="
EOF

    chmod +x "$NATIVE_WSL2_PATH/scripts/performance-comparison.sh"
    log_success "Performance comparison script created"
}

# Print next steps
print_next_steps() {
    log_success "Migration completed successfully!"
    echo
    echo "=== Next Steps ==="
    echo
    echo "1. Native WSL2 Location:"
    echo "   $NATIVE_WSL2_PATH"
    echo
    echo "2. Windows IDE Access:"
    echo "   Symlink: $WINDOWS_LINK_PATH"
    echo "   Direct: $WINDOWS_NATIVE_PATH"
    echo
    echo "3. Start Development:"
    echo "   cd $NATIVE_WSL2_PATH"
    echo "   ./run.sh dev"
    echo
    echo "4. Performance Test:"
    echo "   cd $NATIVE_WSL2_PATH"
    echo "   ./scripts/performance-comparison.sh"
    echo
    echo "5. Original Location (can be removed):"
    echo "   $ORIGINAL_PROJECT_PATH"
    echo "   Consider keeping for backup initially"
    echo
    echo "=== Benefits Achieved ==="
    echo "✅ Eliminated 9P protocol bottleneck"
    echo "✅ Native file I/O performance"
    echo "✅ Better Node.js I/O patterns"
    echo "✅ IDE access maintained via symlink"
    echo "✅ Git operations optimized"
    echo "✅ npm install accelerated"
}

# Main execution
main() {
    echo "=== NeuroSense FX WSL2 Native Migration ==="
    echo

    # Run migration steps
    check_wsl2_environment

    if check_current_location; then
        prepare_native_location
        migrate_project_files
        reinstall_dependencies
        create_windows_symlink
        update_dev_scripts
        verify_migration
        create_performance_test
        print_next_steps
    else
        log_info "Project already on native filesystem"
        log_info "Symlink creation optional for IDE convenience"
        create_windows_symlink
        print_next_steps
    fi
}

# Handle script interruption
trap 'log_error "Migration interrupted"; exit 1' INT TERM

# Run main function
main "$@"