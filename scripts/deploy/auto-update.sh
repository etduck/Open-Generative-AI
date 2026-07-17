#!/usr/bin/env bash
# Auto-deploy for mufa.ai / Open-Generative-AI.
#
# Polls origin/<branch>; when new commits land it fast-forwards, rebuilds and
# restarts the app service. Safety guarantees:
#
#   * Never overwrites local files: updates use `git merge --ff-only`, and the
#     deploy is refused (with a log entry) if tracked files were modified on
#     the server. Untracked files (.env, .deploy/, node_modules) are never
#     touched — no `git clean`, no forward `git reset --hard`.
#   * A failed build does NOT restart the service: .next is backed up before
#     building and restored on failure, the checkout is returned to the
#     previously deployed commit, and the running (old) process is left
#     untouched.
#   * A failed commit is remembered (.deploy/failed-sha) and not retried
#     every minute — the next *new* commit clears it.
#   * git safe.directory is handled for root-maintained checkouts.
#   * File-locked: runs never overlap.
#
# Designed to be run every minute by the systemd timer installed via
# install-autodeploy.sh (or by cron — see scripts/deploy/README.md).
#
# Configuration (environment variables, all optional):
#   MUFA_APP_DIR   repo root                   (default: two levels above this script)
#   MUFA_BRANCH    branch to track             (default: main)
#   MUFA_SERVICE   systemd service to restart  (default: open-generative-ai)

set -euo pipefail

APP_DIR="${MUFA_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${MUFA_BRANCH:-main}"
SERVICE="${MUFA_SERVICE:-open-generative-ai}"
DEPLOY_DIR="$APP_DIR/.deploy"
LOG_FILE="$DEPLOY_DIR/auto-update.log"
LOCK_FILE="$DEPLOY_DIR/auto-update.lock"
FAILED_SHA_FILE="$DEPLOY_DIR/failed-sha"
NEXT_BACKUP="$DEPLOY_DIR/next-backup"

mkdir -p "$DEPLOY_DIR"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG_FILE"; }

# Like log(), but skips the entry if it is identical to the previous one —
# keeps a permanent error condition from writing the same line every minute.
log_once() {
    local last
    last=$(tail -n 1 "$LOG_FILE" 2>/dev/null | cut -d' ' -f3- || true)
    [ "$last" = "$*" ] || log "$@"
}

# Single-flight: skip silently if a deploy is already running.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    exit 0
fi

cd "$APP_DIR"

# Root-maintained checkouts: avoid git's "dubious ownership" refusal.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
fi
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    log_once "ERROR: $APP_DIR is not a usable git repository for $(id -un)"
    exit 1
fi

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
    log_once "ERROR: npm not found on PATH — set PATH or NVM_DIR for the timer unit"
    exit 1
fi

git fetch origin "$BRANCH" --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

# Don't retry a commit that already failed to build; wait for a newer one.
if [ -f "$FAILED_SHA_FILE" ] && [ "$(cat "$FAILED_SHA_FILE")" = "$REMOTE" ]; then
    log_once "skipping ${REMOTE:0:7} — its build already failed; push a fix to $BRANCH to resume"
    exit 0
fi

# Refuse to deploy over server-local edits to tracked files.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log_once "ERROR: tracked files were modified locally in $APP_DIR — refusing to deploy. Commit/discard those changes manually (untracked files like .env are unaffected)."
    exit 1
fi

# Make sure we are actually on the tracked branch (tree is clean, so this is safe).
CURRENT_BRANCH=$(git symbolic-ref --short -q HEAD || echo "")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    git checkout "$BRANCH" --quiet
    LOCAL=$(git rev-parse HEAD)
    [ "$LOCAL" = "$REMOTE" ] && exit 0
fi

log "new commits on $BRANCH: ${LOCAL:0:7} -> ${REMOTE:0:7} — deploying"

build() {
    npm install --no-audit --no-fund >>"$LOG_FILE" 2>&1 &&
    npm run build:packages >>"$LOG_FILE" 2>&1 &&
    npm run build >>"$LOG_FILE" 2>&1
}

# Preserve the currently served build so a failed deploy can't break the
# running process (next build clobbers .next in place).
rm -rf "$NEXT_BACKUP"
if [ -d "$APP_DIR/.next" ]; then
    cp -a "$APP_DIR/.next" "$NEXT_BACKUP"
fi

# Fast-forward only — never rewrites or discards local work.
if ! git merge --ff-only "origin/$BRANCH" --quiet 2>>"$LOG_FILE"; then
    log_once "ERROR: cannot fast-forward to origin/$BRANCH (local history diverged) — resolve manually in $APP_DIR"
    rm -rf "$NEXT_BACKUP"
    exit 1
fi
git submodule update --init --recursive --quiet 2>>"$LOG_FILE" || true

if build; then
    rm -f "$FAILED_SHA_FILE"
    rm -rf "$NEXT_BACKUP"
    log "build ok at ${REMOTE:0:7}"
    if systemctl restart "$SERVICE" 2>>"$LOG_FILE"; then
        log "restarted $SERVICE — deploy complete: ${REMOTE:0:7}"
    else
        log "WARNING: built ${REMOTE:0:7} but failed to restart $SERVICE — restart it manually"
    fi
else
    log "BUILD FAILED at ${REMOTE:0:7} — keeping the old version running (no restart)"
    # Restore the previously served build and return the checkout to the
    # deployed commit. The running process is left completely untouched.
    if [ -d "$NEXT_BACKUP" ]; then
        rm -rf "$APP_DIR/.next"
        mv "$NEXT_BACKUP" "$APP_DIR/.next"
        log "restored previous .next build"
    fi
    git reset --hard "$LOCAL" --quiet   # tree was clean at deploy start; only undoes the ff-merge
    git submodule update --init --recursive --quiet 2>>"$LOG_FILE" || true
    npm install --no-audit --no-fund >>"$LOG_FILE" 2>&1 || log "WARNING: dependency restore failed (running process is unaffected)"
    printf '%s' "$REMOTE" > "$FAILED_SHA_FILE"
    log "rolled back checkout to ${LOCAL:0:7}; ${REMOTE:0:7} marked failed — push a fix to $BRANCH to resume"
    exit 1
fi

# Keep the log bounded.
tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
