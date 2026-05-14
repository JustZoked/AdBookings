#!/bin/sh
set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/adsemble_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup at $(date)"

pg_dump \
  -h db \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-password \
  | gzip > "$FILENAME"

echo "[backup] Backup saved: $FILENAME ($(du -h "$FILENAME" | cut -f1))"

# Rotate: delete backups older than 14 days
find "$BACKUP_DIR" -name "adsemble_*.sql.gz" -mtime +14 -delete
echo "[backup] Cleanup done. Remaining backups: $(ls "$BACKUP_DIR" | wc -l)"
