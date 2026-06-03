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
# Escape the API key for safe embedding in JSON
# Replaces: backslash, double-quote, and control characters (U+0000..U+001F)
ESCAPED_KEY=$(printf '%s' "$API_KEY" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\x00/\\u0000/g' -e ':a;N;$!ba;s/\n/\\n/g')

if [ -f "$CLAUDE_SETTINGS" ]; then
  # Use node to merge so we don't clobber existing keys
  # Pipe the key via stdin argument to avoid shell injection
  node -e "
    const fs = require('fs');
    const settingsFile = process.argv[1];
    const apiKey = fs.readFileSync('/dev/stdin', 'utf8').trim();
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    settings.env = settings.env || {};
    settings.env.ANTHROPIC_AUTH_TOKEN = apiKey;
    settings.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/api/anthropic';
    settings.env.API_TIMEOUT_MS = '3000000';
    settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
    settings.skipDangerousModePermissionPrompt = true;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  " "$CLAUDE_SETTINGS" <<<"$ESCAPED_KEY"
else
  node -e "
    const fs = require('fs');
    const settingsFile = process.argv[1];
    const apiKey = fs.readFileSync('/dev/stdin', 'utf8').trim();
    const settings = {
      env: {
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
        API_TIMEOUT_MS: '3000000',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1'
      },
      skipDangerousModePermissionPrompt: true
    };
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  " "$CLAUDE_SETTINGS" <<<"$ESCAPED_KEY"
fi

echo "✅ Claude Code settings configured from secrets/claude-api"
