#!/bin/bash
# Setup Claude Code API configuration on container (re)build.
# Reads the API key from secrets/claude-api and writes ~/.claude/settings.json.
# This avoids needing to run npx @z_ai/coding-helper manually after each rebuild.

set -euo pipefail

SECRETS_FILE="$(cd "$(dirname "$0")/../secrets" && pwd)/claude-api"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "⚠️  secrets/claude-api not found — skipping Claude Code setup."
  echo "   Copy secrets/claude-api.example to secrets/claude-api and add your API key."
  exit 0
fi

# Source the key (ignore comments and blanks)
API_KEY=$(grep -E '^[^#]' "$SECRETS_FILE" | grep 'ANTHROPIC_AUTH_TOKEN' | head -1 | cut -d'=' -f2- | tr -d '[:space:]')

if [ -z "$API_KEY" ]; then
  echo "⚠️  No ANTHROPIC_AUTH_TOKEN found in secrets/claude-api — skipping."
  exit 0
fi

# Ensure ~/.claude directory exists
mkdir -p "$HOME/.claude"

# Write settings (merge with existing file if present)
if [ -f "$CLAUDE_SETTINGS" ]; then
  # Use node to merge so we don't clobber existing keys
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));
    settings.env = settings.env || {};
    settings.env.ANTHROPIC_AUTH_TOKEN = '$API_KEY';
    settings.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/api/anthropic';
    settings.env.API_TIMEOUT_MS = '3000000';
    settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
    settings.skipDangerousModePermissionPrompt = true;
    fs.writeFileSync('$CLAUDE_SETTINGS', JSON.stringify(settings, null, 2) + '\n');
  "
else
  cat > "$CLAUDE_SETTINGS" <<EOF
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "$API_KEY",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "skipDangerousModePermissionPrompt": true
}
EOF
fi

echo "✅ Claude Code settings configured from secrets/claude-api"
