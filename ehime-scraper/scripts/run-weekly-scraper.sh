#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
SCRAPER_DIR=${SCRIPT_DIR:h}
LOG_DIR="$SCRAPER_DIR/logs"
LOG_FILE="$LOG_DIR/weekly-scraper-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"
cd "$SCRAPER_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] weekly scraper start" | tee "$LOG_FILE"
npm run scraper:weekly 2>&1 | tee -a "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] weekly scraper end" | tee -a "$LOG_FILE"
