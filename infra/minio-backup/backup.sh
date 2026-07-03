#!/bin/sh
set -eu

mc alias set src "$MC_HOST_URL" "$MC_ACCESS_KEY" "$MC_SECRET_KEY" >/dev/null

DATE=$(date +%Y-%m-%d)
DEST="/backups/$DATE"

echo "$(date -Iseconds) starting snapshot of bucket '$MC_BUCKET' to $DEST"
mkdir -p "$DEST"
mc mirror --overwrite --quiet "src/$MC_BUCKET" "$DEST"
echo "$(date -Iseconds) snapshot complete"
