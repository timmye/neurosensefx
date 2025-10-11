# Serena MCP Server - Complete Capabilities Overview

## Installation Status ✅
- **Fully Installed**: Serena MCP server installed via UVX in NeuroSense FX DevContainer
- **MCP Integration**: Configured in cline_mcp_settings.json with all 25 tools auto-approved
- **Project Context**: Configured for NeuroSense FX with IDE-assistant context
- **Language Support**: JavaScript/TypeScript with TypeScript Language Server integration

## Available Tools (25 Total)

### 🗂️ File Operations
- `list_dir`: List directory contents with recursive options
- `find_file`: Find files by path patterns
- `search_for_pattern`: Search patterns across codebase
- `read_file`: Read file contents
- `create_text_file`: Create new files
- `replace_regex`: Replace content using regex patterns

### 🔍 Symbol Navigation & Analysis
- `find_symbol`: Search for symbols by name/substring
- `find_referencing_symbols`: Find symbols that reference given symbol
- `get_symbols_overview`: Get overview of symbols in files
- `insert_after_symbol`: Insert content after symbol definition
- `insert_before_symbol`: Insert content before symbol definition
- `replace_symbol_body`: Replace entire symbol definition

### 🧠 Memory Management
- `write_memory`: Store project-specific knowledge
- `read_memory`: Retrieve stored memories
- `list_memories`: List all stored memories
- `delete_memory`: Remove memories

### ⚙️ Project Management
- `activate_project`: Switch between projects
- `get_current_config`: View project configuration
- `onboarding`: Initialize project understanding
- `check_onboarding_performed`: Check onboarding status
- `prepare_for_new_conversation`: Prepare context for new sessions

### 🤔 Thinking Tools
- `think_about_collected_information`: Assess information completeness
- `think_about_task_adherence`: Stay on track with tasks
- `think_about_whether_you_are_done`: Determine task completion

### 🔧 System Operations
- `execute_shell_command`: Execute shell commands (enabled for DevContainer)

## NeuroSense FX Specific Configuration

### Project Context
- **Architecture**: Two-server pattern (Frontend Server Vite/5173 + Backend Server Node/8080)
- **Language**: JavaScript/TypeScript with Svelte components
- **Performance Targets**: 60fps rendering, 20 display limit, 500MB memory constraint
- **Key Directories**: src/components/viz, src/stores, src/workers, services/tick-backend, libs/cTrader-Layer, memory-bank

### Integration Benefits
1. **Semantic Code Understanding**: Beyond text matching for Svelte/JavaScript
2. **Intelligent Navigation**: Quick symbol finding across components and stores
3. **Context-Aware Editing**: Semantic changes respecting code structure
4. **Project Memory**: Store and retrieve architecture knowledge
5. **Multi-Language Support**: Handle JavaScript, Svelte, and TypeScript files

## Usage Examples for LLMs

### Code Analysis
```
serena.get_symbols_overview('src/components/viz/Container.svelte')
serena.find_symbol('Container', 'src/components')
serena.search_for_pattern('WebSocket', 'src')
```

### Project Navigation
```
serena.list_dir('src', recursive=true)
serena.find_file('*.svelte', 'src/components')
serena.find_referencing_symbols('configStore', 'src/stores')
```

### Knowledge Management
```
serena.write_memory('architecture_decisions', 'Two-server pattern chosen for...')
serena.read_memory('architecture_decisions')
serena.list_memories()
```

### Semantic Editing
```
serena.replace_symbol_body('draw', 'src/components/viz/Container.svelte', new_function_body)
serena.insert_after_symbol('onMount', 'src/components/viz/Container.svelte', new_code)
```

## LLM Integration Notes

### Availability
- **Always Available**: Serena MCP server is configured and ready to use
- **Auto-Approved**: All 25 tools are pre-approved for immediate use
- **No Permission Delays**: Tools can be used without manual approval

### Best Practices
1. **Use Symbol Tools**: For code navigation and understanding
2. **Leverage Memory**: Store important project insights and decisions
3. **Think Tools**: Use thinking tools for complex task management
4. **File Operations**: Use for comprehensive codebase analysis
5. **Semantic Editing**: Prefer over text replacements for code changes

### Context Awareness
- **Project Structure**: Understands NeuroSense FX architecture
- **Performance Constraints**: Aware of 60fps and memory limits
- **Two-Server Pattern**: Knows frontend/backend separation
- **Technology Stack**: Configured for Svelte, Vite, Node.js, Canvas

This MCP server significantly enhances LLM capabilities for NeuroSense FX development by providing semantic code understanding, intelligent navigation, and persistent project knowledge management.