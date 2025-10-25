# Serena Terminal Cheat Sheet

Quick reference for common Serena MCP server terminal commands.

## Essential Commands

### Start Server
```bash
# NeuroSense FX (recommended)
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant --project /workspaces/c --transport stdio

# With web dashboard
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant --project /workspaces/c --transport streamable-http --port 9121
```

### Project Management
```bash
# List tools
uvx --from git+https://github.com/oraios/serena serena tools list

# Index project (performance)
uvx --from git+https://github.com/oraios/serena serena project index

# Health check
uvx --from git+https://github.com/oraios/serena serena project health-check

# Edit config
uvx --from git+https://github.com/oraios/serena serena config edit
```

### Tool Information
```bash
# Get tool description
uvx --from git+https://github.com/oraios/serena serena tools description [TOOL_NAME]

# Get help for commands
uvx --from git+https://github.com/oraios/serena serena [COMMAND] --help
```

## Key Tools Overview

### Code Analysis
- `find_symbol` - Find symbols by name/substring
- `find_referencing_symbols` - Find references to symbols  
- `get_symbols_overview` - Get overview of file symbols
- `search_for_pattern` - Search for patterns in code

### Code Editing
- `replace_symbol_body` - Replace entire symbol definition
- `insert_after_symbol` - Insert content after symbol
- `insert_before_symbol` - Insert content before symbol
- `rename_symbol` - Rename symbol throughout codebase

### File Operations
- `list_dir` - List directory contents
- `find_file` - Find files by pattern
- `read_file` - Read file contents

### Memory Management
- `write_memory` - Store project memories
- `read_memory` - Read stored memories
- `list_memories` - List available memories
- `delete_memory` - Delete stored memories

## Web Dashboard URLs
- Default: http://127.0.0.1:24282/dashboard/index.html
- Custom Port: http://127.0.0.1:9121/dashboard/index.html

## Troubleshooting
```bash
# Check port usage
lsof -i :24282  # macOS/Linux
netstat -ano | findstr :24282  # Windows

# Debug mode
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant --project /workspaces/c --log-level DEBUG
```

## Integration Commands
```bash
# Claude Code integration
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
