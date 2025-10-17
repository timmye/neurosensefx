#!/bin/bash

# NeuroSense FX MCP Tools Initialization Script
# Handles MCP server startup and configuration restoration after container rebuilds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration paths
MCP_CONFIG_DIR="/home/node/.vscode-server/data/User/globalStorage/saoudrizlan.claude-dev/settings"
MCP_CONFIG_FILE="${MCP_CONFIG_DIR}/cline_mcp_settings.json"
BACKUP_DIR="/workspaces/c/backups"
TOOLS_LOG="/workspaces/c/logs/tools.log"

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$TOOLS_LOG")"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$TOOLS_LOG"
}

# Print colored output
print_status() {
    echo -e "${BLUE}[TOOLS]${NC} $1"
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

# MCP Configuration JSON
MCP_CONFIG='{
  "mcpServers": {
    "github.com/upstash/context7-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp@latest"
      ],
      "disabled": false,
      "autoApprove": [
        "resolve-library-id",
        "get-library-docs"
      ]
    },
    "serena": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "ide-assistant",
        "--project",
        "/workspaces/c"
      ],
      "disabled": false,
      "autoApprove": [
        "list_dir",
        "find_file",
        "search_for_pattern",
        "find_symbol",
        "find_referencing_symbols",
        "replace_symbol_body",
        "insert_after_symbol",
        "insert_before_symbol",
        "write_memory",
        "read_memory",
        "list_memories",
        "delete_memory",
        "check_onboarding_performed",
        "onboarding",
        "think_about_collected_information",
        "think_about_task_adherence",
        "think_about_whether_you_are_done",
        "get_symbols_overview"
      ]
    },
    "web-search-prime": {
      "type": "sse",
      "url": "https://api.z.ai/api/mcp/web_search_prime/sse?Authorization=be8a9b89da7440d8863dce8129e04e9b.gYXC9igd6VQHZyGj",
      "autoApprove": [
        "webSearchPrime"
      ]
    },
    "github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ],
      "disabled": false,
      "autoApprove": [
        "sequentialthinking"
      ]
    }
  }
}'

# Function to backup existing configuration
backup_config() {
    if [ -f "$MCP_CONFIG_FILE" ]; then
        local backup_file="${BACKUP_DIR}/cline_mcp_settings_$(date +%Y%m%d_%H%M%S).json"
        cp "$MCP_CONFIG_FILE" "$backup_file"
        log "Backed up existing configuration to $backup_file"
        print_status "Existing configuration backed up"
    fi
}

# Function to restore MCP configuration
restore_mcp_config() {
    print_status "Restoring MCP configuration..."
    
    # Create config directory if it doesn't exist
    mkdir -p "$MCP_CONFIG_DIR"
    
    # Write the configuration
    echo "$MCP_CONFIG" > "$MCP_CONFIG_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "MCP configuration restored successfully"
        log "MCP configuration restored to $MCP_CONFIG_FILE"
    else
        print_error "Failed to restore MCP configuration"
        log "ERROR: Failed to restore MCP configuration"
        exit 1
    fi
}


# Function to verify MCP servers are accessible
verify_mcp_servers() {
    print_status "Verifying MCP server accessibility..."
    
    local servers_verified=0
    local total_servers=4
    
    # Note: MCP servers are managed by Cline directly
    # We can only verify the configuration is in place
    if [ -f "$MCP_CONFIG_FILE" ]; then
        print_success "✅ MCP Configuration - File exists"
        ((servers_verified++))
    else
        print_error "❌ MCP Configuration - File missing"
    fi
    
    # Check configuration contains all servers
    local server_count=$(jq '.mcpServers | keys | length' "$MCP_CONFIG_FILE" 2>/dev/null || echo "0")
    if [ "$server_count" -eq "$total_servers" ]; then
        print_success "✅ All $total_servers MCP servers configured"
        ((servers_verified++))
    else
        print_warning "⚠️  Expected $total_servers servers, found $server_count"
    fi
    
    # Check for essential tools
    if command -v npx > /dev/null; then
        print_success "✅ Node.js/NPX - Available"
        ((servers_verified++))
    else
        print_error "❌ Node.js/NPX - Not available"
    fi
    
    if command -v uvx > /dev/null; then
        print_success "✅ UVX - Available"
        ((servers_verified++))
    else
        print_warning "⚠️  UVX - Not available (Serena MCP may not work)"
    fi
    
    print_status "Verification complete: $servers_verified/$((total_servers + 2)) checks passed"
}

# Function to show running processes
show_status() {
    print_status "MCP Services Status"
    
    echo ""
    echo "⚙️  MCP Configuration:"
    if [ -f "$MCP_CONFIG_FILE" ]; then
        local server_count=$(jq '.mcpServers | keys | length' "$MCP_CONFIG_FILE" 2>/dev/null || echo "0")
        print_success "✅ Configured ($server_count servers)"
        echo ""
        echo "   Available MCP Servers:"
        jq -r '.mcpServers | keys[]' "$MCP_CONFIG_FILE" 2>/dev/null | while read server; do
            local short_name=$(echo "$server" | sed 's|github.com/||' | sed 's|/.*||')
            echo "   • $short_name"
        done
    else
        print_error "❌ Configuration file missing"
    fi
    
    echo ""
    echo "📊 System Tools:"
    if command -v npx > /dev/null; then
        print_success "✅ Node.js/NPX available"
    else
        print_error "❌ Node.js/NPX missing"
    fi
    
    if command -v uvx > /dev/null; then
        print_success "✅ UVX available"
    else
        print_warning "⚠️  UVX missing (Serena MCP)"
    fi
}

# Function to stop all MCP-related services
stop_services() {
    print_status "Stopping MCP-related services..."
    
    # Note: MCP servers are managed by Cline and don't need manual stopping
    print_status "MCP services stopped"
}


# Function to show help
show_help() {
    echo "NeuroSense FX MCP Tools Initialization Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start all MCP services and restore configuration"
    echo "  stop      Stop all MCP services"
    echo "  status    Show current status of MCP services"
    echo "  config    Restore MCP configuration only"
    echo "  verify    Verify MCP server accessibility"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start     # Start everything (default)"
    echo "  $0 status    # Show current status"
    echo "  $0 stop      # Stop services"
}

# Main script logic
main() {
    local command="${1:-start}"
    
    print_status "NeuroSense FX MCP Tools Script"
    print_status "Command: $command"
    
    case "$command" in
        "start")
            log "Starting MCP services initialization"
            backup_config
            restore_mcp_config
            verify_mcp_servers
            print_success "MCP tools initialization complete"
            ;;
        "stop")
            log "Stopping MCP services"
            stop_services
            ;;
        "status")
            show_status
            ;;
        "config")
            log "Restoring MCP configuration only"
            backup_config
            restore_mcp_config
            ;;
        "verify")
            verify_mcp_servers
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
