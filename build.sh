#!/usr/bin/env bash
# Builds the React/shadcn UI, then assembles the loadable/installable
# extension into dist/chrome and dist/firefox, plus zip archives of each.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ui/node_modules ]; then
  npm --prefix ui install --no-audit --no-fund
fi
npm --prefix ui run build

rm -rf dist
for target in chrome firefox; do
  mkdir -p "dist/$target"
  cp -r extension/static/. "dist/$target/"
  cp -r ui/dist/. "dist/$target/"
  cp "extension/manifest.$target.json" "dist/$target/manifest.json"
  (cd "dist/$target" && zip -qr "../auto-approve-$target.zip" .)
  echo "built dist/$target (and dist/auto-approve-$target.zip)"
done
