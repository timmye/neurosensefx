#!/bin/bash

# Script to test the exact postCreateCommand from devcontainer.json
# This helps identify why the command fails during DevContainer startup

set -e

echo "🧪 Testing postCreateCommand execution..."
echo "========================================"

# Log the start time
echo "⏰ Started at: $(date)"

# Set up environment variables that might be missing during DevContainer startup
export PATH="/home/node/.local/bin:$PATH"

# Test the exact command from devcontainer.json
echo "🔧 Running: ./scripts/setup_serena.sh && ./scripts/setup_sequential_thinking.sh"

# Run with error handling and detailed output
if ./scripts/setup_serena.sh; then
    echo "✅ setup_serena.sh completed successfully"
else
    echo "❌ setup_serena.sh failed with exit code $?"
    exit 1
fi

if ./scripts/setup_sequential_thinking.sh; then
    echo "✅ setup_sequential_thinking.sh completed successfully"
else
    echo "❌ setup_sequential_thinking.sh failed with exit code $?"
    exit 1
fi

echo "✅ Both scripts completed successfully"
echo "⏰ Completed at: $(date)"
echo "========================================"