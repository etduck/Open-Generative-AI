#!/usr/bin/env bash
# Auto-deploy for mufa.ai.
#
# Polls origin/<branch>; when new commits land it pulls, rebuilds and restarts
# the app service. A failed build rolls back to the previously deployed commit
# and rebuilds it, so the site never stays down on a bad push.
#
# Designed to be run every minute by the systemd timer installed via
# install-autodeploy.sh (or by cron — see scripts/deploy/README.md).
# Exits immediately (0) when there is nothing to deploy or another run is
# already in progress.
#
# Configuration (environment variables, all optional):
#   MUFA_APP_DIR   repo root      (default: two levels above this script)
#   MUFA_BRANCH    branch to track (default: main)
#   MUFA_SERVICE   systemd service to restart (default: mufa)
#
# NOTE: this script runs `git reset --hard origin/<branch>` — the server
# checkout is treated as a deploy target, local edits there will be discarded.

set -euo pipefail

APP_DIR="${MUFA_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${MUFA_BRANCH:-main}"
SERVICE="${MUFA_SERVICE:-mufa}"
DEPLOY_DIR="$APP_DIR/.deploy"
LOG_FILE="$DEPLOY_DIR/auto-update.log"
LOCK_FILE="$DEPLOY_DIR/auto-update.lock"

mkdir -p "$DEPLOY_DIR"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG_FILE"; }

# Single-flight: skip silently if a deploy is already running.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    exit 0
fi

cd "$APP_DIR"

# systemd/cron ship a minimal PATH; find npm even for nvm-based installs.
if ! command -v npm >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
fi
if ! command -v npm >/dev/null 2>&1; then
    for d in /usr/local/bin /usr/local/node/bin /opt/node*/bin; do
        if [ -x "$d/npm" ]; then PATH="$d:$PATH"; break; fi
    done
fi
if ! command -v npm >/dev/null 2>&1; then
    log "ERROR: npm not found on PATH — set PATH or NVM_DIR for the timer unit"
    exit 1
fi

git fetch origin "$BRANCH" --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

log "new commits on $BRANCH: ${LOCAL:0:7} -> ${REMOTE:0:7} — deploying"

checkout() {
    git reset --hard "$1" --quiet
    git submodule update --init --recursive --quiet 2>>"$LOG_FILE" || true
}

build() {
    npm install --no-audit --no-fund >>"$LOG_FILE" 2>&1 &&
    npm run build:packages >>"$LOG_FILE" 2>&1 &&
    npm run build >>"$LOG_FILE" 2>&1
}

restart_service() {
    if systemctl restart "$SERVICE" 2>>"$LOG_FILE"; then
        log "restarted $SERVICE"
    else
        log "WARNING: failed to restart $SERVICE — restart it manually"
    fi
}

checkout "origin/$BRANCH"

if build; then
    log "build ok at ${REMOTE:0:7}"
    restart_service
    log "deploy complete: ${REMOTE:0:7}"
else
    log "BUILD FAILED at ${REMOTE:0:7} — rolling back to ${LOCAL:0:7}"
    checkout "$LOCAL"
    if build; then
        log "rollback build ok — restarting on ${LOCAL:0:7}"
        restart_service
    else
        log "ERROR: rollback build also failed — leaving the running process untouched"
    fi
    exit 1
fi

# Keep the log bounded.
tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
