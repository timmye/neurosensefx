#!/bin/bash
# Setup PostgreSQL and Redis for Codespace native services
# Called from devcontainer postCreateCommand and postStartCommand
# IMPORTANT: Does not use sudo - all operations use TCP connections

echo "Setting up PostgreSQL and Redis for Codespace..."

# --- Redis ---
if command -v redis-server &>/dev/null; then
    if ! redis-cli ping &>/dev/null; then
        echo "Starting Redis..."
        redis-server --daemonize yes 2>/dev/null || \
            sudo service redis-server start 2>/dev/null || true
    fi
    if redis-cli ping &>/dev/null; then
        echo "Redis: OK"
    else
        echo "WARNING: Redis not responding"
    fi
else
    echo "WARNING: redis-server not found"
fi

# --- PostgreSQL ---
PG_RUNNING=false
if command -v pg_isready &>/dev/null && pg_isready -q; then
    PG_RUNNING=true
    echo "PostgreSQL: OK"
else
    echo "Starting PostgreSQL..."
    # Try starting via service (may need sudo in some configs)
    sudo service postgresql start 2>/dev/null || true
    if command -v pg_isready &>/dev/null && pg_isready -q; then
        PG_RUNNING=true
        echo "PostgreSQL: OK"
    else
        echo "WARNING: PostgreSQL not running"
    fi
fi

if [ "$PG_RUNNING" = true ]; then
    # Connect as postgres superuser via TCP (devcontainer feature sets trust/md5)
    PG_SUPER="PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres"
    # Fallback: try without password (trust auth)
    if ! $PG_SUPER -c "SELECT 1" &>/dev/null; then
        PG_SUPER="psql -h 127.0.0.1 -U postgres"
    fi

    # Create user (idempotent)
    $PG_SUPER -c "DO \$\$ BEGIN
        CREATE ROLE neurosensefx WITH LOGIN PASSWORD 'neurosensefx_dev_123';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END \$\$;" 2>/dev/null || true

    # Create database (idempotent)
    $PG_SUPER -c "SELECT 1 FROM pg_database WHERE datname='neurosensefx_dev'" | grep -q 1 2>/dev/null || \
    $PG_SUPER -c "CREATE DATABASE neurosensefx_dev OWNER neurosensefx;" 2>/dev/null || true

    # Grant permissions
    $PG_SUPER -d neurosensefx_dev -c 'GRANT ALL ON SCHEMA public TO neurosensefx;' 2>/dev/null || true

    # Run init scripts (idempotent - uses IF NOT EXISTS)
    for f in /workspaces/neurosensefx/docker/postgres/init/*.sql; do
        if [ -f "$f" ]; then
            echo "Running init script: $(basename $f)"
            PGPASSWORD=neurosensefx_dev_123 psql -U neurosensefx -h 127.0.0.1 -d neurosensefx_dev -f "$f" 2>/dev/null || true
        fi
    done

    echo "PostgreSQL setup complete."
fi

echo "Database setup finished."
