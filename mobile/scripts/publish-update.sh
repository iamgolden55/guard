#!/usr/bin/env bash
#
# Publish an over-the-air update to the production channel, safely.
#
#   npm run update:prod -- "What changed (#PR)"            # iOS and Android
#   npm run update:prod -- --platform ios "What changed"    # one platform
#   npm run update:prod -- --dry-run "What changed"         # export and check only
#
# Why this exists: `eas update` bundles on this machine with mobile/.env, a
# local-development file. The `env` block of eas.json's production profile
# only applies to EAS *builds*. On 2026-09-30 four updates went out without
# EXPO_PUBLIC_SENTRY_DSN or the Google client IDs: Sentry was silently off and
# Google sign-in broken on every phone that took them. Setting the variables
# was not enough either — Metro reused modules it had transformed without
# them from $TMPDIR/metro-cache, and `--clear` did not help.
#
# So this script:
#   1. refuses to publish uncommitted work or anything that isn't origin/main;
#   2. exports the production profile's env from eas.json and deletes the
#      Metro cache;
#   3. exports one platform at a time (both at once has run out of memory),
#      checks that every EXPO_PUBLIC_* value from eas.json is in the bundle,
#      and publishes exactly that bundle — or stops, having published nothing
#      for that platform.
set -euo pipefail

cd "$(dirname "$0")/.."
MOBILE_DIR="$(pwd)"

PLATFORMS=(ios android)
DRY_RUN=0
MESSAGE=""

usage() {
  sed -n '3,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

# --check-bundle <file>: verify one bundle and exit (used below; also lets the
# check itself be tested).
check_bundle() {
  local bundle="$1" missing=0
  while IFS=$'\t' read -r name value; do
    if grep -aqF -- "$value" "$bundle"; then
      echo "  ✓ $name"
    else
      echo "  ✗ $name is not in the bundle" >&2
      missing=1
    fi
  done < <(node -e '
    const env = require("./eas.json").build.production.env;
    for (const [k, v] of Object.entries(env)) if (k.startsWith("EXPO_PUBLIC_")) console.log(`${k}\t${v}`);
  ')
  return $missing
}

while [ $# -gt 0 ]; do
  case "$1" in
    --platform) PLATFORMS=("$2"); shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --check-bundle) check_bundle "$2"; exit $? ;;
    -h|--help) usage ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *) MESSAGE="$1"; shift ;;
  esac
done

[ -n "$MESSAGE" ] || { echo "A message is required: what changed, and the PR number." >&2; usage; }
for p in "${PLATFORMS[@]}"; do
  case "$p" in ios|android) ;; *) echo "Unknown platform: $p" >&2; exit 1 ;; esac
done

# 1. Only reviewed, merged code. A dry run publishes nothing, so it only warns.
refuse() {
  if [ "$DRY_RUN" = 1 ]; then echo "warning (dry run): $1" >&2; else echo "$1" >&2; exit 1; fi
}
if [ -n "$(git status --porcelain -- "$MOBILE_DIR")" ]; then
  refuse "mobile/ has uncommitted changes; they would be bundled. Commit or stash them first."
fi
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  refuse "HEAD is not origin/main. Check out main and pull, so only merged code is published."
fi

# 2. The production profile's settings, and no stale transforms.
eval "$(node -e '
  const env = require("./eas.json").build.production.env;
  for (const [k, v] of Object.entries(env)) console.log(`export ${k}=${JSON.stringify(v)}`);
')"
export NODE_ENV=production

HERMESC="node_modules/react-native/sdks/hermesc/osx-bin/hermesc"
if [ "$(uname)" = "Darwin" ] && [ ! -x "$HERMESC" ]; then
  echo "$HERMESC is missing. Reinstall it: npm pack react-native@<version> and copy sdks/hermesc/osx-bin/hermesc back." >&2
  exit 1
fi

for p in "${PLATFORMS[@]}"; do
  out="dist-$p"
  echo "── $p: exporting $(git rev-parse --short HEAD)"
  rm -rf "${TMPDIR:-/tmp}/metro-cache" "$out"
  npx expo export --platform "$p" --output-dir "$out" --dump-sourcemap --dump-assetmap

  bundle="$(find "$out" -type f -name '*.hbc' | head -1)"
  [ -n "$bundle" ] || bundle="$(find "$out/_expo/static/js/$p" -type f -name '*.js' | head -1)"
  [ -n "$bundle" ] || { echo "No bundle found in $out" >&2; exit 1; }

  echo "── $p: checking production settings are in the bundle"
  if ! check_bundle "$bundle"; then
    echo "Not published: the $p bundle is missing production settings." >&2
    exit 1
  fi

  if [ "$DRY_RUN" = 1 ]; then
    echo "── $p: dry run, not published ($out kept for inspection)"
    continue
  fi

  echo "── $p: publishing"
  npx eas-cli update --channel production --platform "$p" --skip-bundler --input-dir "$out" \
    --message "$MESSAGE" --non-interactive
  rm -rf "$out"
done
