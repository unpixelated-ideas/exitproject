#!/bin/sh
cd "$(dirname "$0")/application" || exit 1

if command -v node >/dev/null 2>&1; then
  MTA_NODE="$(command -v node)"
else
  MTA_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi

if [ ! -x "$MTA_NODE" ]; then
  echo 'Node.js is missing. Install Node.js 22.12 or newer, then try again.'
  printf 'Press Return to close. '
  read -r MTA_REPLY
  exit 1
fi

"$MTA_NODE" launch.mjs
MTA_STATUS=$?
if [ "$MTA_STATUS" -ne 0 ]; then
  printf 'Press Return to close. '
  read -r MTA_REPLY
fi
exit "$MTA_STATUS"
