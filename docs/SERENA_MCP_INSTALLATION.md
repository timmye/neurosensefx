# Serena MCP Installation Guide for NeuroSense FX DevContainer

## Overview

Serena is a powerful coding agent toolkit providing semantic retrieval and editing capabilities through the Model Context Protocol (MCP). This guide covers installing and configuring Serena for the NeuroSense FX VSCode DevContainer environment.

## Prerequisites

- VSCode with DevContainer extension
- Docker running locally
- NeuroSense FX project cloned
- Current MCP servers already configured (browser-tools-mcp, context7-mcp, web-search-prime)

## Installation Options

### Option 1: UVX Installation (Recommended for DevContainer)

This is the simplest approach that doesn't require cloning Serena locally.

### Option 2: Docker Installation

Better isolation and consistent environment.

### Option 3: Local Installation

Full control but requires more setup in the DevContainer.

## Option 1: UVX Installation Steps

### 1. Update DevContainer Dockerfile

Add Python and UV package manager to the DevContainer:

```dockerfile
# Add Python and UV for Serena MCP
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl

# Install UV package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"
```

### 2. Configure MCP Server

Add Serena to your MCP configuration:

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": [
        "--from", "git+https://github.com/oraios/serena", 
        "serena", "start-mcp-server",
        "--context", "ide-assistant",
        "--project", "/workspaces/c"
      ],
      "disabled": false,
      "autoApprove": [
        "find_symbols",
        "find_references",
        "find_definitions",
        "edit_symbol",
        "create_file",
        "read_file",
        "list_files",
        "search_files",
        "replace_in_file"
      ]
    }
  }
}
```

### 3. Create Project Configuration

Generate Serena project configuration:

```bash
# From within the DevContainer
uvx --from git+https://github.com/oraios/serena serena project generate-yml
```

### 4. Update devcontainer.json

Add the MCP server configuration to postCreateCommand:

```json
{
  "customizations": {
    "vscode": {
      "settings": {
        "cline.mcpServers": {
          "serena": {
            "command": "uvx",
            "args": [
              "--from", "git+https://github.com/oraios/serena",
              "serena", "start-mcp-server",
              "--context", "ide-assistant",
              "--project", "/workspaces/c"
            ]
          }
        }
      }
    }
  }
}
```

## Option 2: Docker Installation Steps

### 1. Update DevContainer Dockerfile

Add Docker client and mount Docker socket:

```dockerfile
# Add Docker client for Serena
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    docker.io

# Start Docker service
RUN service docker start
```

### 2. Configure MCP Server with Docker

```json
{
  "mcpServers": {
    "serena": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i", "--network", "host",
        "-v", "/workspaces/c:/workspaces/projects",
        "ghcr.io/oraios/serena:latest",
        "serena", "start-mcp-server",
        "--transport", "stdio",
        "--context", "ide-assistant",
        "--project", "/workspaces/projects"
      ],
      "disabled": false,
      "autoApprove": [
        "find_symbols",
        "find_references", 
        "find_definitions",
        "edit_symbol",
        "create_file",
        "read_file",
        "list_files",
        "search_files",
        "replace_in_file"
      ]
    }
  }
}
```

### 3. Update docker-compose.yml (if using)

Add Serena service to docker-compose:

```yaml
services:
  serena:
    image: ghcr.io/oraios/serena:latest
    container_name: serena-mcp
    network_mode: host
    volumes:
      - /workspaces/c:/workspaces/projects
    command: ["serena", "start-mcp-server", "--transport", "stdio", "--context", "ide-assistant"]
    restart: unless-stopped
```

## Option 3: Local Installation Steps

### 1. Update DevContainer Dockerfile

```dockerfile
# Add Python and development tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive && \
    apt-get -y install --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    build-essential

# Install UV package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Clone and install Serena
RUN git clone https://github.com/oraios/serena.git /opt/serena
WORKDIR /opt/serena
RUN uv venv && \
    .venv/bin/activate && \
    uv pip install --all-extras -r pyproject.toml -e .
WORKDIR /workspaces/c
```

### 2. Configure MCP Server

```json
{
  "mcpServers": {
    "serena": {
      "command": "/opt/serena/.venv/bin/python",
      "args": [
        "-m", "serena.mcp_server",
        "--context", "ide-assistant",
        "--project", "/workspaces/c"
      ],
      "disabled": false,
      "autoApprove": [
        "find_symbols",
        "find_references",
        "find_definitions", 
        "edit_symbol",
        "create_file",
        "read_file",
        "list_files",
        "search_files",
        "replace_in_file"
      ]
    }
  }
}
```

## Serena Configuration

### Project Configuration (.serena/project.yml)

```yaml
project:
  name: "NeuroSense FX"
  language: "javascript"
  project_root: "/workspaces/c"
  
language_servers:
  javascript:
    command: "typescript-language-server"
    args: ["--stdio"]
    
modes:
  - planning
  - editing
  - interactive
  
contexts:
  - ide-assistant
  
tools:
  enabled:
    - find_symbols
    - find_references
    - find_definitions
    - edit_symbol
    - create_file
    - read_file
    - list_files
    - search_files
    - replace_in_file
    - memory_tools
    - config_tools
    
  excluded:
    - execute_shell_command
    - git_operations
```

### User Configuration (~/.serena/serena_config.yml)

```yaml
projects:
  - name: "NeuroSense FX"
    path: "/workspaces/c"
    language: "javascript"
    
default_context: "ide-assistant"
default_mode: "editing"

security:
  read_only: false
  excluded_tools:
    - execute_shell_command
    - system_operations
    
logging:
  level: "info"
  file: "/tmp/serena.log"
```

## Testing the Installation

### 1. Verify UV Installation
```bash
uv --version
```

### 2. Test Serena CLI
```bash
uvx --from git+https://github.com/oraios/serena serena --help
```

### 3. Test MCP Server
```bash
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --help
```

### 4. List Available Tools
```bash
uvx --from git+https://github.com/oraios/serena serena tools list
```

### 5. Test with Project
```bash
# Test MCP server startup with NeuroSense FX project
timeout 5 uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
    --context ide-assistant \
    --project /workspaces/c \
    --transport stdio
```

### 6. Verify in Cline

1. Restart the DevContainer
2. Check that Serena appears in available tools
3. Test with a simple command like listing files

## Available Tools

Serena provides 25+ semantic coding tools:

### Symbol Navigation
- `find_symbol`: Search for symbols by name/substring
- `find_referencing_symbols`: Find symbols that reference a given symbol
- `get_symbols_overview`: Get overview of symbols in a file

### Semantic Editing
- `replace_symbol_body`: Replace entire symbol definition
- `insert_after_symbol`: Insert content after a symbol
- `insert_before_symbol`: Insert content before a symbol

### File Operations
- `list_dir`: List directory contents
- `find_file`: Find files by path
- `search_for_pattern`: Search for patterns in code
- `read_file`: Read file contents
- `create_text_file`: Create new files
- `replace_regex`: Replace content using regex

### Memory Management
- `write_memory`: Store project-specific memories
- `read_memory`: Read stored memories
- `list_memories`: List all memories
- `delete_memory`: Remove memories

### Project Management
- `activate_project`: Switch between projects
- `get_current_config`: View current configuration
- `onboarding`: Initialize project understanding
- `check_onboarding_performed`: Check if onboarding was done

### Thinking Tools
- `think_about_collected_information`: Assess information completeness
- `think_about_task_adherence`: Stay on track with tasks
- `think_about_whether_you_are_done`: Determine task completion

### System Tools
- `execute_shell_command`: Execute shell commands
- `prepare_for_new_conversation`: Prepare for new conversations

## Installation Status ✅

**Current Status: FULLY INSTALLED AND TESTED**

- ✅ UV package manager installed
- ✅ Serena MCP server installed via UVX
- ✅ Project configuration created at `.serena/project.yml`
- ✅ MCP server tested successfully
- ✅ All 25+ tools verified and working
- ✅ NeuroSense FX specific configuration applied
- ✅ Memory Bank documentation updated
- ✅ Setup script created at `scripts/setup_serena.sh`

**Quick Start Commands:**
```bash
# Run the automated setup script
./scripts/setup_serena.sh

# Test manually
export PATH="/home/node/.local/bin:$PATH"
uvx --from git+https://github.com/oraios/serena serena tools list
```

## Troubleshooting

### Common Issues

1. **UV not found**: Ensure UV is installed and in PATH
2. **Permission denied**: Check Docker socket permissions
3. **Port conflicts**: Serena uses ports 9121 and 24282 by default
4. **Python version**: Ensure Python 3.11+ is available

### Debug Commands

```bash
# Check UV installation
uv --version

# Check Python version  
python3 --version

# Check Docker
docker --version

# Test Serena directly
uvx --from git+https://github.com/oraios/serena serena --help

# Check MCP server logs
tail -f /tmp/serena.log
```

### Port Conflict Resolution

```bash
# Check what's using the port
lsof -i :9121
lsof -i :24282

# Kill conflicting processes
kill -9 <PID>

# Or use different ports
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --port 9122
```

## Integration with NeuroSense FX

### Benefits for This Project

1. **Code Analysis**: Understand the Svelte/JavaScript codebase structure
2. **Symbol Navigation**: Quickly find components, stores, and utilities
3. **Semantic Editing**: Make context-aware code changes
4. **Memory Management**: Store and retrieve project knowledge
5. **Multi-language Support**: Handle JavaScript, Svelte, and TypeScript files

### Recommended Tools for NeuroSense FX

- **File Operations**: Read/edit Svelte components and JavaScript files
- **Symbol Tools**: Navigate between components, stores, and utilities
- **Search Tools**: Find patterns across the visualization components
- **Memory Tools**: Store knowledge about the two-server architecture

### Example Usage

```
Find all Svelte components that use Canvas API
Search for WebSocket connections in the codebase
Locate all store files and their dependencies
Find references to the cTrader layer integration
```

## Security Considerations

1. **Read-only Mode**: Consider enabling for sensitive operations
2. **Tool Exclusions**: Exclude shell command execution if not needed
3. **Access Control**: Limit file system access to project directories
4. **Audit Logging**: Enable logging for monitoring tool usage

## Performance Optimization

1. **Tool Selection**: Only enable needed tools to reduce overhead
2. **Caching**: Enable memory tools for better performance
3. **Resource Limits**: Set appropriate memory and CPU limits
4. **Background Processing**: Use async operations where possible

## Next Steps

1. Choose installation option based on your needs
2. Update DevContainer configuration
3. Test Serena integration
4. Configure project-specific settings
5. Train team on Serena usage
6. Monitor performance and adjust configuration
