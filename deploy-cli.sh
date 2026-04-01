#!/usr/bin/env bash
# Internal: deploys CLI binaries to openkbs.com CDN. Used by maintainers only — not needed for development.
set -euo pipefail

cd "$(dirname "$0")"

# ── Configuration ──
S3_BUCKET="www.openkbs.com"
CF_DISTRIBUTION_ID="E39HBRWPQUABS5"
BUMP_TYPE="${1:-patch}"

# ── Bump version ──
VERSION=$(node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  pkg.version = '${BUMP_TYPE}' === 'minor'
    ? major + '.' + (minor + 1) + '.0'
    : major + '.' + minor + '.' + (patch + 1);
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log(pkg.version);
")

# Sync version into updater.ts
sed -i '' "s/CLI_VERSION = '.*'/CLI_VERSION = '${VERSION}'/" src/lib/updater.ts

echo "=== Deploying OpenKBS CLI v${VERSION} (${BUMP_TYPE}) ==="
echo ""

# ── Build ──
bash build.sh

# ── Upload binaries ──
echo ""
echo "[1/4] Uploading binaries..."
for binary in dist/bin/openkbs-*; do
  name=$(basename "$binary")
  echo "  ${name}"
  aws s3 cp "$binary" "s3://${S3_BUCKET}/cli/${name}" \
    --cache-control "public, max-age=86400"
done

# ── Upload version.json (no-cache) ──
echo ""
echo "[2/4] Uploading version.json..."
aws s3 cp dist/bin/version.json "s3://${S3_BUCKET}/cli/version.json" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "application/json"

# ── Upload install.sh (no-cache) ──
echo ""
echo "[3/4] Uploading install.sh..."
aws s3 cp ../install.sh "s3://${S3_BUCKET}/install.sh" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/plain"

# ── Invalidate CloudFront ──
echo ""
echo "[4/4] Invalidating CloudFront..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/cli/*" "/install.sh" \
  --query 'Invalidation.Id' \
  --output text)
echo "  Invalidation: ${INVALIDATION_ID}"

echo ""
echo "=== CLI v${VERSION} deployed ==="
echo ""
echo "────────────────────────────────────────────"
echo "  Install CLI:"
echo "  curl -fsSL https://openkbs.com/install.sh | bash"
echo "────────────────────────────────────────────"
