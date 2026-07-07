#!/usr/bin/env bash
# Assembles the loadable/installable extension into dist/chrome and
# dist/firefox, plus zip archives of each.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
for target in chrome firefox; do
  mkdir -p "dist/$target"
  cp -r extension/shared/. "dist/$target/"
  cp "extension/manifest.$target.json" "dist/$target/manifest.json"
  (cd "dist/$target" && zip -qr "../auto-accept-$target.zip" .)
  echo "built dist/$target (and dist/auto-accept-$target.zip)"
done
