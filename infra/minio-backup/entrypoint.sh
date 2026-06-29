#!/bin/sh
# Run one snapshot immediately on startup (so a fresh deployment has a
# baseline backup right away), then hand off to crond for the daily 01:00 run.
/backup.sh || true
exec crond -f -l 2
