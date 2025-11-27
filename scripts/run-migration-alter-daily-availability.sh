#!/usr/bin/env bash
set -euo pipefail

# Run migration to alter daily availability tables (teacher & student)
# Usage:
#   export DATABASE_URL="postgres://user:pass@host:port/dbname"  # or set in env
#   ./scripts/run-migration-alter-daily-availability.sh

MIGRATION_SQL="./src/server/db/migrations/20251111_modify_daily_availability.sql"
BACKUP_DIR="./backups/migrations/20251111"

if [ -z "${DATABASE_URL-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Export it and re-run."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d%H%M%S)
BACKUP_FILE="$BACKUP_DIR/availability_backup_$TS.sql"

echo "Dumping teacher_daily_availability and student_daily_availability to $BACKUP_FILE"
pg_dump --dbname="$DATABASE_URL" -t teacher_daily_availability -t student_daily_availability > "$BACKUP_FILE"

echo "Backup completed. Running migration SQL: $MIGRATION_SQL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"

echo "Migration completed. Backup kept at: $BACKUP_FILE"
