#!/bin/sh
# Builds a Chrome Web Store upload with manifest.json at the zip's root.
set -e
cd "$(dirname "$0")/../extension"
VERSION=$(grep '"version"' manifest.json | sed 's/.*: *"\(.*\)".*/\1/')
OUT="../lumen-dark-$VERSION.zip"
rm -f "$OUT"
zip -rq "$OUT" . -x ".*"
echo "Built $OUT"
