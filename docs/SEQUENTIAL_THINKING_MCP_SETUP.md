# Sequential Thinking MCP Server Setup

This document describes the setup and configuration of the Sequential Thinking MCP server for the NeuroSense FX project.

## Overview

The Sequential Thinking MCP server provides a tool for dynamic and reflective problem-solving through a structured thinking process. It helps break down complex problems into manageable steps, allows for revision of thoughts as understanding deepens, and supports branching into alternative reasoning paths.

## Installation

### DevContainer Integration

The Sequential Thinking MCP server is automatically configured as part of the DevContainer setup process:

1. **Setup Script**: `scripts/setup_sequential_thinking.sh`
   - Verifies Node.js and npm installation
   - Tests Sequential Thinking package installation
   - Creates necessary directory structure
   - Provides usage guidance

2. **DevContainer Configuration**: `.devcontainer/devcontainer.json`
   - Includes the setup script in `postCreateCommand`
   - Ensures automatic installation during DevContainer creation

### Manual Installation

If you need to install the Sequential Thinking MCP server manually:

```bash
# Test the installation
npx -y @modelcontextprotocol/server-sequential-thinking --help

# Create MCP directory
mkdir -p /home/node/Documents/Cline/MCP
```

## Configuration

### MCP Settings

The server is configured in `cline_mcp_settings.json`:

```json
"github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  "disabled": false,
  "autoApprove": []
}
```

### Server Details

- **Server Name**: `github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking`
- **Command**: `npx -y @modelcontextprotocol/server-sequential-thinking`
- **Transport**: stdio
- **Auto-approval**: Disabled (manual approval required for tools)

## Usage

### Available Tool

The server provides the `sequentialthinking` tool with the following parameters:

- `thought` (string, required): The current thinking step
- `nextThoughtNeeded` (boolean, required): Whether another thought step is needed
- `thoughtNumber` (integer, required): Current thought number
- `totalThoughts` (integer, required): Estimated total thoughts needed
- `isRevision` (boolean, optional): Whether this revises previous thinking
- `revisesThought` (integer, optional): Which thought is being reconsidered
- `branchFromThought` (integer, optional): Branching point thought number
- `branchId` (string, optional): Branch identifier
- `needsMoreThoughts` (boolean, optional): If more thoughts are needed

### Use Cases

The Sequential Thinking tool is designed for:

- **Complex Problem Decomposition**: Breaking down complex problems into manageable steps
- **Planning and Design**: Planning with room for revision and refinement
- **Analysis and Course Correction**: Analysis that might need course correction
- **Unclear Scope Problems**: Problems where the full scope might not be clear initially
- **Multi-step Tasks**: Tasks that need to maintain context over multiple steps
- **Information Filtering**: Situations where irrelevant information needs to be filtered out

### Example Usage

```javascript
// First thought
{
  "thought": "I need to analyze this complex problem by breaking it down into smaller components.",
  "nextThoughtNeeded": true,
  "thoughtNumber": 1,
  "totalThoughts": 5
}

// Second thought
{
  "thought": "The first component is understanding the user requirements and constraints.",
  "nextThoughtNeeded": true,
  "thoughtNumber": 2,
  "totalThoughts": 5
}

// Final thought
{
  "thought": "After analyzing all components, I now have a comprehensive understanding of the problem.",
  "nextThoughtNeeded": false,
  "thoughtNumber": 5,
  "totalThoughts": 5
}
```

## Features

### Core Capabilities

1. **Sequential Thinking Process**: Structured step-by-step thinking
2. **Dynamic Revision**: Ability to revise and refine previous thoughts
3. **Branching**: Support for alternative reasoning paths
4. **Context Maintenance**: Maintains thought history and context
5. **Flexible Estimation**: Adjust total thought count as needed

### Response Format

The tool returns structured information about the thinking process:

```json
{
  "thoughtNumber": 3,
  "totalThoughts": 5,
  "nextThoughtNeeded": true,
  "branches": [],
  "thoughtHistoryLength": 3
}
```

## Troubleshooting

### Common Issues

1. **Server Not Connecting**: Ensure the MCP configuration is correct and the server is not disabled
2. **Tool Not Available**: Check that the server has been properly installed and configured
3. **Permission Issues**: Verify that the setup script has execute permissions

### Verification Commands

```bash
# Test server installation
npx -y @modelcontextprotocol/server-sequential-thinking --help

# Check package information
npm info @modelcontextprotocol/server-sequential-thinking

# Verify MCP configuration
cat ../../home/node/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

## Integration with NeuroSense FX

The Sequential Thinking MCP server integrates seamlessly with the existing NeuroSense FX development environment:

- **Compatible**: Works alongside existing MCP servers (Serena, Browser Tools, Context7, Web Search Prime)
- **Performance**: Lightweight NPX-based installation with minimal resource overhead
- **Development**: Supports complex architectural planning and problem-solving for the two-server architecture
- **Documentation**: Enhances the project's documentation-driven development approach

## Best Practices

1. **Use for Complex Problems**: Apply to complex architectural decisions, feature planning, and troubleshooting
2. **Maintain Context**: Leverage the thought history feature to maintain context across long reasoning chains
3. **Revise When Needed**: Don't hesitate to use the revision features when understanding evolves
4. **Branch for Alternatives**: Use branching to explore different approaches to problems
5. **Document Results**: Use the sequential thinking process to create clear, documented reasoning for decisions

## Related Documentation

- [Serena MCP Installation](docs/SERENA_MCP_INSTALLATION.md)
- [Phase 1 Implementation](memory-bank/phase1Implementation.md)
- [System Patterns](memory-bank/systemPatterns.md)
- [Active Context](memory-bank/activeContext.md)
