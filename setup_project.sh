#!/bin/bash
# NeuroSense FX — one-command setup
#
# Installs every dependency tree in the project (frontend root, backend service,
# and the vendored cTrader layer) and (re)builds the cTrader layer's compiled
# output. Idempotent and safe to re-run.
#
# Why build the layer here? `libs/cTrader-Layer/build/` is committed to the repo,
# so a fresh clone already runs without building — this step is belt-and-suspenders
# that guarantees the compiled output matches the current TypeScript sources
# (guards against a source change being committed without its rebuilt output).
#
# Usage:
#   ./setup_project.sh          # install + build everything
#   ./setup_project.sh --clean  # wipe all node_modules + lockfiles first, then install

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

clean() {
    echo "--- Deep clean: removing node_modules + lockfiles ---"
    pkill -f 'node services/tick-backend/server.js' 2>/dev/null || true
    pkill -f 'vite' 2>/dev/null || true
    find . -name node_modules -type d -prune -exec rm -rf {} + 2>/dev/null || true
    find . -name package-lock.json -delete 2>/dev/null || true
    rm -f logs/*.log 2>/dev/null || true
    echo "Cleanup complete."
}

install_layer() {
    echo "--- cTrader layer (vendored, libs/cTrader-Layer): install deps + build ---"
    # Installs the layer's own devDeps (incl. ttypescript) into libs/cTrader-Layer/node_modules,
    # then compiles with `ttsc` (NOT standard `tsc` — it needs the typescript-transform-paths plugin).
    (cd libs/cTrader-Layer && npm install && npm run build)
}

install_backend() {
    echo "--- backend service (services/tick-backend): install deps ---"
    (cd services/tick-backend && npm install)
}

install_root() {
    echo "--- frontend / root: install deps ---"
    npm install
}

echo "=== NeuroSense FX Setup ==="
if [[ "${1:-}" == "--clean" ]]; then
    clean
fi

install_layer
install_backend
install_root

cat <<'EOF'

=== Setup complete ===
All dependencies installed and the cTrader layer is built.

Next steps (full guide: docs/local-dev-setup.md):
  1. cp .env.example .env   # then fill in cTrader creds + PostgreSQL/Redis
  2. Start PostgreSQL 15 + Redis 7
       (Docker):  docker compose -f docker-compose.dev.yml up postgres-dev redis-dev -d
  3. ./run.sh dev           # backend :8080, frontend :5174
EOF
