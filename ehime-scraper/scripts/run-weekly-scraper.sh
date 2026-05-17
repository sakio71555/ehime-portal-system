#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/opt/ehime-portal-system/ehime-scraper"
LOG_DIR="$BASE_DIR/logs"
LOG_FILE="$LOG_DIR/weekly-scraper-$(date +%Y%m%d-%H%M%S).log"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # cronはログインシェルではないため、nvm管理のNode.jsを明示的に読み込みます。
  # shellcheck source=/dev/null
  . "${HOME}/.nvm/nvm.sh"
fi

if [ ! -d "$BASE_DIR" ]; then
  echo "BASE_DIR not found: $BASE_DIR" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm command not found. Please install Node.js/npm or update PATH." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

{
  cd "$BASE_DIR"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] weekly scraper start"
  echo "BASE_DIR: $BASE_DIR"
  echo "LOG_FILE: $LOG_FILE"

  if [ ! -f "$BASE_DIR/.env" ]; then
    echo ".env not found: $BASE_DIR/.env"
    echo "Create .env manually on the VPS before running the weekly crawler."
    exit 1
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] official site crawler start"
  SCRAPER_DRY_RUN=0 SCRAPER_MAX_URLS=180 SCRAPER_MAX_INSERTS=40 npm run scraper
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] official site crawler end"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] jgrants importer start"
  JGRANTS_DRY_RUN=0 JGRANTS_LIMIT=100 npm run jgrants
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] jgrants importer end"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] weekly scraper end"
} 2>&1 | tee "$LOG_FILE"
