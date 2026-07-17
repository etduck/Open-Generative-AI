#!/usr/bin/env bash
# One-time installer for the mufa.ai auto-deploy timer.
#
# Creates a systemd oneshot service + timer that runs auto-update.sh every
# minute: new commits on origin/<branch> are pulled, built and the app
# service is restarted automatically. Your existing app service, Nginx and
# Cloudflare are NOT touched — this only ADDS a separate timer unit.
#
# Usage (on the server, from the repo root):
#   sudo bash scripts/deploy/install-autodeploy.sh <app-service-name> [branch]
#
#   <app-service-name>  the systemd unit that runs `next start` for mufa.ai
#                       (find it with: systemctl list-units --type=service | grep -iE 'mufa|next|node')
#   [branch]            branch to track, default: main
#
# Uninstall:
#   sudo systemctl disable --now mufa-autodeploy.timer
#   sudo rm /etc/systemd/system/mufa-autodeploy.{service,timer}
#   sudo systemctl daemon-reload

set -euo pipefail

SERVICE_NAME="${1:?Usage: sudo bash scripts/deploy/install-autodeploy.sh <app-service-name> [branch]}"
BRANCH="${2:-main}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo (systemd units are written to /etc/systemd/system)." >&2
    exit 1
fi

if ! systemctl cat "$SERVICE_NAME" >/dev/null 2>&1; then
    echo "WARNING: systemd service '$SERVICE_NAME' not found — installing anyway." >&2
    echo "         Find the right name with: systemctl list-units --type=service | grep -iE 'mufa|generative|next|node'" >&2
fi

# Root-maintained checkout: pre-authorize the repo path so git never refuses
# with "detected dubious ownership".
git config --system --add safe.directory "$APP_DIR" 2>/dev/null \
    || git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

cat > /etc/systemd/system/mufa-autodeploy.service <<EOF
[Unit]
Description=mufa.ai auto-deploy (git pull + build + restart on new commits)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=MUFA_APP_DIR=${APP_DIR}
Environment=MUFA_BRANCH=${BRANCH}
Environment=MUFA_SERVICE=${SERVICE_NAME}
ExecStart=/usr/bin/env bash ${APP_DIR}/scripts/deploy/auto-update.sh
# Builds can take several minutes on small servers.
TimeoutStartSec=30min
EOF

cat > /etc/systemd/system/mufa-autodeploy.timer <<EOF
[Unit]
Description=Check for mufa.ai deploys every minute

[Timer]
OnBootSec=2min
# Re-arm 60s after the previous run finishes — runs never overlap.
OnUnitInactiveSec=60s
Persistent=true

[Install]
WantedBy=timers.target
EOF

chmod +x "${APP_DIR}/scripts/deploy/auto-update.sh"
systemctl daemon-reload
systemctl enable --now mufa-autodeploy.timer

echo "Installed and started."
echo "  status:   systemctl list-timers mufa-autodeploy.timer"
echo "  last run: systemctl status mufa-autodeploy.service"
echo "  log:      ${APP_DIR}/.deploy/auto-update.log"
