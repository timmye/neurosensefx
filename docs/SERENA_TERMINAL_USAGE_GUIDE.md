# Serena Terminal Usage Guide

This guide provides comprehensive instructions for using Serena MCP server via terminal commands, specifically configured for the NeuroSense FX project.

## Overview

Serena is a powerful coding agent toolkit that provides semantic retrieval and editing capabilities through the Model Context Protocol (MCP). In NeuroSense FX, Serena is configured to work with TypeScript/Svelte codebases and provides intelligent code analysis, navigation, and editing tools.

## Prerequisites

### Required Tools
- **UV Package Manager**: Required for running Serena
- **Git**: For version control operations
- **Node.js**: For TypeScript language server functionality

### Installation Status Check
```bash
# Check if UV is installed
which uv

# UV version should be available
uv --version
```

## Basic Serena Commands

### Main Command Structure
```bash
uvx --from git+https://github.com/oraios/serena serena [COMMAND] [OPTIONS]
```

### Available Commands
- `config` - Manage Serena configuration
- `context` - Manage Serena contexts  
- `mode` - Manage Serena modes
- `project` - Manage Serena projects
- `prompts` - Commands related to Serena's prompts
- `start-mcp-server` - Starts the Serena MCP server
- `tools` - Commands related to Serena's tools

## MCP Server Operations

### Start MCP Server (Basic)
```bash
# Start with default settings
uvx --from git+https://github.com/oraios/serena serena start-mcp-server
```

### Start MCP Server for NeuroSense FX
```bash
# Recommended configuration for NeuroSense FX
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant \
  --project /workspaces/c \
  --transport stdio
```

### Start MCP Server with Web Dashboard
```bash
# Start with web dashboard enabled
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant \
  --project /workspaces/c \
  --transport streamable-http \
  --port 9121 \
  --enable-web-dashboard true
```

### MCP Server Options
- `--project`: Path or name of project to activate
- `--context`: Built-in context name or path to custom context (default: desktop-app)
- `--mode`: Built-in mode names or paths to custom mode YAMLs (default: interactive, editing)
- `--transport`: Transport protocol (stdio, sse, streamable-http)
- `--host`: Server host (default: 0.0.0.0)
- `--port`: Server port (default: 8000)
- `--enable-web-dashboard`: Override dashboard setting
- `--log-level`: Override log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

### Get Help for MCP Server
```bash
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --help
```

## Project Management

### List Available Tools
```bash
uvx --from git+https://github.com/oraios/serena serena tools list
```

### Generate Project Configuration
```bash
# Generate a new project.yml file
uvx --from git+https://github.com/oraios/serena serena project generate-yml
```

### Index Project for Performance
```bash
# Index project to accelerate Serena's tools (recommended for large projects)
uvx --from git+https://github.com/oraios/serena serena project index

# Index specific file
uvx --from git+https://github.com/oraios/serena serena project index-file src/main.js
```

### Project Health Check
```bash
# Perform comprehensive health check
uvx --from git+https://github.com/oraios/serena serena project health-check
```

### Check if Path is Ignored
```bash
# Check if a path is ignored by project configuration
uvx --from git+https://github.com/oraios/serena serena project is_ignored-path node_modules/
```

## Configuration Management

### Edit Configuration
```bash
# Edit serena_config.yml in default editor
uvx --from git+https://github.com/oraios/serena serena config edit
```

## Context Management

### List Available Contexts
```bash
uvx --from git+https://github.com/oraios/serena serena context --help
```

## Mode Management

### List Available Modes
```bash
uvx --from git+https://github.com/oraios/serena serena mode --help
```

## Tool Descriptions

### Get Tool Description
```bash
# Get description of a specific tool
uvx --from git+https://github.com/oraios/serena serena tools description find_symbol

# Get description with example
uvx --from git+https://github.com/oraios/serena serena tools description find_symbol --with-example
```

## NeuroSense FX Specific Configuration

### Current Project Setup
The NeuroSense FX project is configured in `.serena/project.yml` with:

- **Language**: TypeScript
- **Context**: ide-assistant
- **Modes**: planning, editing, interactive
- **Key Directories**:
  - `src/components/viz`
  - `src/stores`
  - `src/workers`
  - `services/tick-backend`
  - `libs/cTrader-Layer`
  - `memory-bank`

### Performance Requirements
- Target FPS: 60
- Max Displays: 20
- Memory Limit: 500MB
- CPU Limit: 50%

### Available Tools (19 Active)
1. **Code Analysis**:
   - `find_symbol` - Find symbols by name/substring
   - `find_referencing_symbols` - Find references to symbols
   - `get_symbols_overview` - Get overview of file symbols
   - `search_for_pattern` - Search for patterns in code

2. **Code Editing**:
   - `replace_symbol_body` - Replace entire symbol definition
   - `insert_after_symbol` - Insert content after symbol
   - `insert_before_symbol` - Insert content before symbol
   - `rename_symbol` - Rename symbol throughout codebase

3. **File Operations**:
   - `list_dir` - List directory contents
   - `find_file` - Find files by pattern
   - `read_file` - Read file contents

4. **Memory Management**:
   - `write_memory` - Store project memories
   - `read_memory` - Read stored memories
   - `list_memories` - List available memories
   - `delete_memory` - Delete stored memories

5. **Project Management**:
   - `check_onboarding_performed` - Check if onboarding done
   - `onboarding` - Perform project onboarding
   - `think_about_collected_information` - Analysis thinking tool
   - `think_about_task_adherence` - Task tracking tool
   - `think_about_whether_you_are_done` - Completion checking tool

## Web Dashboard Access

When running with web dashboard enabled:
- **URL**: http://127.0.0.1:24282/dashboard/index.html
- **Alternative Port**: If using custom port, adjust accordingly

## Integration with Development Tools

### Claude Desktop Integration
```json
{
    "mcpServers": {
        "serena": {
            "command": "/abs/path/to/uvx",
            "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]
        }
    }
}
```

### Claude Code Integration
```bash
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check what's using the port
lsof -i :24282  # macOS/Linux
netstat -ano | findstr :24282  # Windows
```

#### Server Not Starting
1. Check UV installation: `uv --version`
2. Verify project configuration: `ls -la .serena/project.yml`
3. Check logs in: `~/.serena/logs/`

#### Language Server Issues
1. Restart language server through MCP tools
2. Check TypeScript installation: `npm list typescript`
3. Verify project structure

### Debug Mode
```bash
# Start with debug logging
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant \
  --project /workspaces/c \
  --log-level DEBUG
```

## Performance Optimization

### For Large Projects
1. **Index Project**: Run `serena project index` after major changes
2. **Use Specific Paths**: Restrict tool operations to specific directories
3. **Exclude Tools**: Remove unnecessary tools from configuration

### Memory Management
1. **Clear Cache**: Remove `.serena/cache/` directory if needed
2. **Monitor Resources**: Check memory usage during operation
3. **Use timeouts**: Set appropriate tool timeouts

## Advanced Usage

### Custom Contexts
Create custom context YAML files for specific use cases:
```yaml
name: "custom-context"
description: "Custom context for specific workflow"
excluded_tools:
  - execute_shell_command
included_optional_tools:
  - specific_tool
```

### Docker Usage
```bash
# Run with Docker
docker run --rm -i --network host \
  -v /path/to/projects:/workspaces/projects \
  ghcr.io/oraios/serena:latest \
  serena start-mcp-server --transport stdio
```

### Production Deployment
```bash
# Production mode with Docker Compose
docker-compose up serena
```

## Best Practices

1. **Always Use Project Context**: Specify project path for consistent behavior
2. **Index Regularly**: Keep symbol cache updated for better performance
3. **Monitor Logs**: Check logs for issues and performance metrics
4. **Use Specific Tools**: Choose appropriate tools for specific tasks
5. **Memory Management**: Use Serena memory for project-specific knowledge

## Getting Help

### Command Help
```bash
# Main help
uvx --from git+https://github.com/oraios/serena serena --help

# Command-specific help
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --help
uvx --from git+https://github.com/oraios/serena serena tools --help
```

### Documentation
- **Serena GitHub**: https://github.com/oraios/serena
- **Context7 Documentation**: Available via MCP server
- **Project Configuration**: `.serena/project.yml`

### Community Resources
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Examples**: Project-specific examples in `docs/`

## Quick Reference

### Essential Commands
```bash
# Start server (NeuroSense FX)
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project /workspaces/c --transport stdio

# List tools
uvx --from git+https://github.com/oraios/serena serena tools list

# Edit config
uvx --from git+https://github.com/oraios/serena serena config edit

# Index project
uvx --from git+https://github.com/oraios/serena serena project index

# Health check
uvx --from git+https://github.com/oraios/serena serena project health-check
```

### Web Dashboard URLs
- **Default**: http://127.0.0.1:24282/dashboard/index.html
- **Custom Port**: http://127.0.0.1:9121/dashboard/index.html

This guide provides comprehensive coverage of Serena terminal usage for the NeuroSense FX project. For specific use cases or advanced configurations, refer to the official Serena documentation and project-specific configuration files.
