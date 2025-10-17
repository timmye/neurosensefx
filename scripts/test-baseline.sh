#!/bin/bash

# Workflow-Based Baseline Test Runner Script
# Runs primary trader workflow tests with enhanced browser log monitoring

echo "=========================================="
echo "Running Workflow-Based Baseline Tests"
echo "Testing primary trader workflows"
echo "=========================================="

# Set exit on error
set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run workflow-based baseline tests with enhanced output
echo "Running primary trader workflow tests..."
echo ""

npx playwright test e2e/baseline --config=e2e/baseline/config.ts --reporter=line

# Capture exit code
EXIT_CODE=$?

echo ""
echo "=========================================="

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All workflow tests passed!"
    echo "Primary trader workflows are working correctly."
else
    echo "❌ Some workflow tests failed!"
    echo "Check the output above for details."
fi

echo ""
echo "Test Results Summary:"
echo "- Workspace to Live Prices workflow"
echo "- Multi-Symbol Workspace workflow" 
echo "- Market Analysis workflow"
echo "- Enhanced browser log monitoring"
echo "=========================================="

# Exit with test result code
exit $EXIT_CODE