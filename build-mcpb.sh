#!/usr/bin/env bash
# Build the Claude Desktop extension (.mcpb) for s4l.
# Output: build/s4l-plugin-<version>.mcpb
#
# The same repo serves two runtimes:
#   - Claude Code (CLI) plugin   -> .mcp.json + .claude-plugin/
#   - Claude Desktop extension   -> manifest.json (this build)
set -euo pipefail
cd "$(dirname "$0")"

export PATH="/opt/homebrew/bin:$PATH"

echo "==> rebuilding dist bundle"
npx esbuild src/mcp.mjs --bundle --platform=node --format=esm \
  --outfile=dist/mcp.mjs --external:playwright

echo "==> ensuring production deps"
npm install --omit=dev --no-audit --no-fund

echo "==> staging bundle"
rm -rf build/mcpb
mkdir -p build/mcpb
cp manifest.json build/mcpb/
cp package.json   build/mcpb/
cp -R dist        build/mcpb/
cp -R node_modules build/mcpb/

echo "==> validating manifest"
mcpb validate build/mcpb/manifest.json

echo "==> packing"
mcpb pack build/mcpb build/s4l-plugin.mcpb

echo "==> done"
ls -lh build/*.mcpb
