#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")
echo "=== Building OpenKBS CLI v${VERSION} ==="

# Check bun
if ! command -v bun &>/dev/null; then
  echo "bun not found. Installing..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "  bun: $(bun --version)"
echo ""

mkdir -p dist/bin

TARGETS=(
  "bun-linux-x64:openkbs-linux-x64"
  "bun-linux-arm64:openkbs-linux-arm64"
  "bun-darwin-x64:openkbs-darwin-x64"
  "bun-darwin-arm64:openkbs-darwin-arm64"
  "bun-windows-x64:openkbs-windows-x64.exe"
)

for entry in "${TARGETS[@]}"; do
  target="${entry%%:*}"
  output="${entry##*:}"
  echo "  Building ${output}..."
  bun build --compile --target="${target}" src/index.ts --outfile "dist/bin/${output}"
done

# Create version.json (includes skill version)
SKILL_VERSION=$(node -e "const m=require('fs').readFileSync('src/lib/updater.ts','utf8').match(/SKILL_VERSION\s*=\s*'([^']+)'/);console.log(m?m[1]:'1.0.0')")
echo "{\"version\":\"${VERSION}\",\"skillVersion\":\"${SKILL_VERSION}\"}" > dist/bin/version.json

# Tar skill + templates for auto-update / compiled binary
if [ -d "skill" ]; then
  echo "  Packaging skill v${SKILL_VERSION} + templates..."
  # Create a staging dir with both skill and templates
  rm -rf dist/skill-pkg
  mkdir -p dist/skill-pkg/templates
  cp -r skill/* dist/skill-pkg/
  cp -a templates/. dist/skill-pkg/templates/
  COPYFILE_DISABLE=1 tar czf dist/bin/skill.tar.gz -C dist/skill-pkg .
  rm -rf dist/skill-pkg
fi

echo ""
echo "=== Build complete ==="
ls -lh dist/bin/
