#!/bin/bash

# Claude Code Setup Script for NeuroSense FX DevContainer
# This script installs and configures Claude CLI for the development environment

set -e

echo "🤖 Setting up Claude Code for NeuroSense FX development..."

# Check if Claude is already installed
if command -v claude &> /dev/null; then
    echo "✅ Claude CLI already installed"
    claude --version
else
    echo "📦 Installing Claude CLI..."
    # Install Claude CLI using the official installer
    # Note: Using bash (not sh) as the installer script contains bash-specific syntax
    curl -fsSL https://claude.ai/install.sh | bash
fi

# Install Claude Code npm package globally
echo "📦 Installing Claude Code npm package..."
# Adding flags for container environments to avoid permission issues
npm install -g @anthropic-ai/claude-code --unsafe-perm=true --allow-root

# Verify installations
echo "🔍 Verifying installations..."

if command -v claude &> /dev/null; then
    echo "✅ Claude CLI installed successfully"
    claude --version
else
    echo "❌ Claude CLI installation failed"
    exit 1
fi

if npm list -g @anthropic-ai/claude-code &> /dev/null; then
    echo "✅ Claude Code npm package installed successfully"
    npm list -g @anthropic-ai/claude-code
else
    echo "❌ Claude Code npm package installation failed"
    exit 1
fi

# Create Claude configuration directory if it doesn't exist
CLAUDE_CONFIG_DIR="$HOME/.config/claude"
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo "📁 Creating Claude configuration directory..."
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Set up Claude environment variables for the container
echo "🔧 Setting up Claude environment variables..."

# Add Claude to PATH if not already there
if ! echo $PATH | grep -q "$HOME/.local/bin"; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    export PATH="$HOME/.local/bin:$PATH"
fi

echo "✅ Claude Code setup complete!"
echo ""
echo "🚀 You can now use Claude CLI in your DevContainer with:"
echo "   claude --help                    # Show Claude CLI help"
echo "   claude                           # Start Claude Code interactive mode"
echo "   claude -p 'your question'        # Ask Claude a question"
echo ""
echo "📝 Next step: Authenticate with Claude"
echo "   claude auth login                # Authenticate with your Claude account"
echo ""
echo "📚 For more information, visit: https://docs.anthropic.com/claude/docs/claude-code"