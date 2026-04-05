#!/usr/bin/env bash

set -euo pipefail

# NeuroSense FX - Database backup/restore script
# Usage:
#   ./scripts/backup.sh              # Dump PostgreSQL
#   ./scripts/backup.sh --redis      # Dump PostgreSQL + Redis
#   ./scripts/backup.sh --restore <file>  # Restore PostgreSQL from backup

DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="neurosensefx_dev"
DB_USER="neurosensefx"
DB_PASS="neurosensefx_dev_123"
BACKUP_DIR="backups"

mkdir -p "$BACKUP_DIR"

backup_postgres() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local outfile="${BACKUP_DIR}/neurosensefx_${timestamp}.sql"

    echo "==> Backing up PostgreSQL database '${DB_NAME}'..."
    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -F p -f "$outfile" "$DB_NAME"

    echo "==> PostgreSQL backup saved to ${outfile}"
}

backup_redis() {
    echo "==> Triggering Redis SAVE..."
    redis-cli SAVE

    local dump_file
    dump_file=$(redis-cli CONFIG GET dir | awk '{print $2}')/$(redis-cli CONFIG GET dbfilename | awk '{print $2}')

    if [ -f "$dump_file" ]; then
        local timestamp
        timestamp=$(date +"%Y%m%d_%H%M%S")
        local dest="${BACKUP_DIR}/redis_${timestamp}.rdb"
        cp "$dump_file" "$dest"
        echo "==> Redis backup saved to ${dest}"
    else
        echo "==> WARNING: Redis dump file not found at ${dump_file}"
    fi
}

restore_postgres() {
    local infile="$1"

    if [ ! -f "$infile" ]; then
        echo "ERROR: File not found: ${infile}" >&2
        exit 1
    fi

    echo "==> WARNING: This will drop and recreate database '${DB_NAME}'."
    read -rp "    Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "==> Restore cancelled."
        exit 0
    fi

    echo "==> Restoring PostgreSQL database '${DB_NAME}' from ${infile}..."
    PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d postgres -c "CREATE DATABASE ${DB_NAME};"
    PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$DB_NAME" -f "$infile"

    echo "==> PostgreSQL restore complete."
}

usage() {
    echo "Usage:"
    echo "  $(basename "$0")                  Backup PostgreSQL"
    echo "  $(basename "$0") --redis          Backup PostgreSQL + Redis"
    echo "  $(basename "$0") --restore <file> Restore PostgreSQL from backup file"
}

case "${1:-}" in
    --redis)
        backup_postgres
        backup_redis
        ;;
    --restore)
        if [ -z "${2:-}" ]; then
            echo "ERROR: --restore requires a backup file path." >&2
            usage
            exit 1
        fi
        restore_postgres "$2"
        ;;
    -h|--help)
        usage
        ;;
    "")
        backup_postgres
        ;;
    *)
        echo "ERROR: Unknown option: $1" >&2
        usage
        exit 1
        ;;
esac
