# Serena MCP Server Troubleshooting

## Issue Identified
**Date**: 2025-11-10
**Problem**: "Unknown tool: read_file" error when trying to use Serena MCP server

## Root Cause Analysis
The MCP configuration file (`cline_mcp_settings.json`) contained `read_file` in the `autoApprove` array for the Serena server, but Serena doesn't actually provide a `read_file` tool. This created a configuration mismatch.

### Configuration Mismatch Details
- **Expected Tool**: `read_file` (listed in autoApprove)
- **Actual Available Tools**: `list_dir`, `find_file`, `search_for_pattern`, `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`, memory management tools, and thinking tools
- **Missing Tool**: `read_file` - Serena doesn't have this tool

## Solution Applied
### MCP Configuration Fix
Updated `cline_mcp_settings.json` to remove non-existent tools from Serena's autoApprove list:

**Removed Tools** (not available in Serena):
- `activate_project`
- `create_text_file` 
- `execute_shell_command`
- `prepare_for_new_conversation`
- `read_file` ← **This was causing the error**
- `replace_regex`
- `get_current_config`

**Kept Tools** (actually available in Serena):
- `check_onboarding_performed`
- `find_file`
- `find_referencing_symbols`
- `find_symbol`
- `insert_after_symbol`
- `insert_before_symbol`
- `list_dir`
- `list_memories`
- `onboarding`
- `read_memory`
- `replace_symbol_body`
- `search_for_pattern`
- `think_about_collected_information`
- `think_about_task_adherence`
- `think_about_whether_you_are_done`
- `write_memory`
- `delete_memory`

## Correct Usage Patterns

### For Reading Files
- **Use Standard Cline Tool**: `read_file` (not via Serena)
- **Use Serena Tool**: `get_symbols_overview` for code analysis
- **Use Serena Tool**: `search_for_pattern` for content searching

### For File Operations
- **Standard Cline**: `read_file`, `write_to_file`, `replace_in_file`
- **Serena**: `find_file`, `list_dir`, `search_for_pattern`

### For Code Analysis
- **Serena**: `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`
- **Serena**: `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`

## Verification
- ✅ Serena MCP server is now functional
- ✅ All auto-approved tools match available tools
- ✅ No more "Unknown tool" errors
- ✅ Standard Cline tools work for file operations
- ✅ Serena tools work for semantic code analysis

## Lessons Learned
1. **Tool Availability**: Always verify actual tool availability vs configuration
2. **MCP Configuration**: autoApprove lists must match actual server capabilities
3. **Tool Separation**: Standard Cline tools vs MCP server tools have different purposes
4. **Configuration Sync**: Keep MCP settings synchronized with server capabilities

## Project-Specific Context for NeuroSense FX
- **Serena Purpose**: Semantic code analysis and editing, not file I/O
- **File Operations**: Use standard Cline tools (`read_file`, `write_to_file`, `replace_in_file`)
- **Code Analysis**: Use Serena tools for symbol navigation and semantic understanding
- **Memory Management**: Use Serena memory tools for project knowledge persistence

This troubleshooting ensures Serena can be used effectively for its intended purpose: semantic code analysis and editing within the NeuroSense FX codebase.
