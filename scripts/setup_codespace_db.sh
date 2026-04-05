#!/bin/bash
# Setup PostgreSQL user and database for Codespace native PG
# Called from devcontainer postCreateCommand

echo "Setting up PostgreSQL for Codespace..."

# Create PG user
sudo -n su - postgres -c "psql -c \"CREATE ROLE neurosensefx WITH LOGIN PASSWORD 'neurosensefx_dev_123';\"" 2>/dev/null || true

# Create database
sudo -n su - postgres -c "psql -c \"CREATE DATABASE neurosensefx_dev OWNER neurosensefx;\"" 2>/dev/null || true

# Grant permissions
sudo -n su - postgres -c "psql -d neurosensefx_dev -c 'GRANT ALL ON SCHEMA public TO neurosensefx;'" 2>/dev/null || true

# Run init scripts
for f in /workspaces/neurosensefx/docker/postgres/init/*.sql; do
    if [ -f "$f" ]; then
        echo "Running init script: $(basename $f)"
        PGPASSWORD=neurosensefx_dev_123 psql -U neurosensefx -h 127.0.0.1 -d neurosensefx_dev -f "$f" 2>/dev/null || true
    fi
done

echo "PostgreSQL setup complete."
