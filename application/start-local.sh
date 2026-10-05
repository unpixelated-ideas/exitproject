#!/bin/sh
# Prefer a normal Node installation; support this computer's bundled Codex runtime.
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  MTA_NODE="$(command -v node)"
else
  MTA_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$MTA_NODE" ]; then
  echo 'Install Node.js 22.12+ and run pnpm install, then pnpm dev.'
  exit 1
fi
if [ ! -f node_modules/vite/bin/vite.js ]; then
  echo 'Dependencies are missing. Run pnpm install first.'
  exit 1
fi
exec "$MTA_NODE" node_modules/vite/bin/vite.js --host 127.0.0.1
