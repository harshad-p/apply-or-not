#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(command -v node)"
LABEL="com.applyornot.relay"
AGENT_DIRECTORY="$HOME/Library/LaunchAgents"
AGENT_PATH="$AGENT_DIRECTORY/$LABEL.plist"
TEMPLATE="$PROJECT_ROOT/launchd/$LABEL.plist.template"
USER_DOMAIN="gui/$(id -u)"

mkdir -p "$PROJECT_ROOT/logs" "$AGENT_DIRECTORY"
sed \
  -e "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" \
  -e "s|__NODE_PATH__|$NODE_PATH|g" \
  "$TEMPLATE" > "$AGENT_PATH"

launchctl bootout "$USER_DOMAIN" "$AGENT_PATH" 2>/dev/null || true
launchctl bootstrap "$USER_DOMAIN" "$AGENT_PATH"
launchctl kickstart -k "$USER_DOMAIN/$LABEL"

print "Apply or Not relay is running automatically."
print "Logs: $PROJECT_ROOT/logs/local-relay.out.log"
