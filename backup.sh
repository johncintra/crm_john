#!/bin/bash
set -e

# Hourly safety-net backup of the production Postgres database — sellers are
# actively organizing real data in the CRM now (stages, leads, tags), so any
# future deploy/migration mistake needs a recent snapshot to recover from.
# Does not touch any other container or cron job on this shared droplet.

BACKUP_DIR="/root/crm-john-backups"
CONTAINER="crm-john-postgres-prod"
DB_USER="crmjohn"
DB_NAME="crm_john"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/crm_john_${TIMESTAMP}.sql.gz"

find "$BACKUP_DIR" -name 'crm_john_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup salvo em $BACKUP_DIR/crm_john_${TIMESTAMP}.sql.gz"
