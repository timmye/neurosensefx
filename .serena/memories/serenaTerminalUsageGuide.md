# Serena Terminal Usage Guide

## Overview
Serena MCP server provides powerful semantic code analysis and editing capabilities through terminal commands. This guide covers essential usage patterns for NeuroSense FX.

## Installation Status
✅ UV Package Manager: Installed at /home/node/.local/bin/uv
✅ Serena MCP Server: Working via uvx from GitHub
✅ Project Configuration: .serena/project.yml configured for TypeScript
✅ Language Server: TypeScript language server operational

## Essential Commands

### Start MCP Server
```bash
# Recommended for NeuroSense FX
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant --project /workspaces/c --transport stdio

# With web dashboard
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant --project /workspaces/c --transport streamable-http --port 9121
```

### Project Management
```bash
# List available tools (37 total, 19 active in ide-assistant context)
uvx --from git+https://github.com/oraios/serena serena tools list

# Index project for performance
uvx --from git+https://github.com/oraios/serena serena project index

# Health check
uvx --from git+https://github.com/oraios/serena serena project health-check

# Edit configuration
uvx --from git+https://github.com/oraios/serena serena config edit
```

## Active Tools (ide-assistant context)

### Code Analysis Tools
- `find_symbol` - Find symbols by name/substring with name_path matching
- `find_referencing_symbols` - Find references to symbols
- `get_symbols_overview` - Get overview of file symbols
- `search_for_pattern` - Search for patterns in codebase

### Code Editing Tools
- `replace_symbol_body` - Replace entire symbol definition
- `insert_after_symbol` - Insert content after symbol
- `insert_before_symbol` - Insert content before symbol
- `rename_symbol` - Rename symbol throughout codebase

### File Operations
- `list_dir` - List directory contents
- `find_file` - Find files by pattern

### Memory Management
- `write_memory` - Store project memories
- `read_memory` - Read stored memories
- `list_memories` - List available memories
- `delete_memory` - Delete stored memories

### Project Management
- `check_onboarding_performed` - Check if onboarding completed
- `onboarding` - Perform project onboarding
- `think_about_collected_information` - Analysis thinking tool
- `think_about_task_adherence` - Task tracking tool
- `think_about_whether_you_are_done` - Completion checking tool

## Web Dashboard
- URL: http://127.0.0.1:24282/dashboard/index.html
- Provides visual interface for Serena operations
- Shows tool usage, logs, and project status

## NeuroSense FX Configuration
- Language: TypeScript
- Context: ide-assistant
- Modes: planning, editing, interactive
- Key directories: src/components/viz, src/stores, src/workers, services/tick-backend, libs/cTrader-Layer, memory-bank
- Performance requirements: 60fps, 20 displays, 500MB RAM, 50% CPU

## Integration Examples

### Claude Code Integration
```bash
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
```

### Claude Desktop Configuration
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

## Troubleshooting

### Port Conflicts
```bash
lsof -i :24282  # macOS/Linux
netstat -ano | findstr :24282  # Windows
```

### Debug Mode
```bash
uvx --from git+https://github.com/oraios/serena serena start-mcp-server \
  --context ide-assistant --project /workspaces/c --log-level DEBUG
```

### Common Issues
1. UV installation: Check with `uv --version`
2. Project configuration: Verify `.serena/project.yml`
3. Logs location: `~/.serena/logs/`
4. Language server: Restart via MCP tools if needed

## Performance Tips
1. Index project regularly: `serena project index`
2. Use specific paths in tool operations
3. Monitor memory usage during operations
4. Clear cache if needed: Remove `.serena/cache/`

## Documentation Files Created
- `docs/SERENA_TERMINAL_USAGE_GUIDE.md` - Comprehensive guide
- `docs/SERENA_TERMINAL_CHEAT_SHEET.md` - Quick reference

## Testing Status
✅ MCP server starts successfully
✅ Tools load correctly (19 active tools)
✅ Language server initializes (TypeScript)
✅ Project configuration loads
✅ Web dashboard accessible
✅ Command-line interface functional

## Next Steps
1. Test individual tool operations
2. Integrate with development workflow
3. Customize configuration for specific needs
4. Explore advanced features like custom contexts
5. Monitor performance in real usage scenarios

Last updated: 2025-10-24
Status: Fully operational and documented