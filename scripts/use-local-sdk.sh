#!/usr/bin/env bash
# Installs @teachmehipaa/node from a local checkout instead of npm.
#
# The SDK is not on npm yet, so `npm ci` and a plain `npm install` cannot
# resolve the `@teachmehipaa/node` dependency. This script packs a built SDK
# checkout and installs the tarball together with every other dependency,
# without writing it to package.json.
#
# Usage: scripts/use-local-sdk.sh [path-to-teachmehipaa-node]
#        (default: ../teachmehipaa-node)
#
# The checkout must already be built (`npm ci && npm run build` in it).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sdk_dir="${1:-${repo_root}/../teachmehipaa-node}"

if [[ ! -f "${sdk_dir}/package.json" ]]; then
  echo "use-local-sdk: no package.json in ${sdk_dir}" >&2
  echo "Pass the path to a teachmehipaa-node checkout." >&2
  exit 1
fi
sdk_dir="$(cd "${sdk_dir}" && pwd)"

if [[ ! -f "${sdk_dir}/dist/index.js" ]]; then
  echo "use-local-sdk: ${sdk_dir}/dist is missing." >&2
  echo "Build the SDK first: (cd ${sdk_dir} && npm ci && npm run build)" >&2
  exit 1
fi

pack_dir="${repo_root}/.local-sdk"
rm -rf "${pack_dir}"
mkdir -p "${pack_dir}"

# --ignore-scripts: the tarball is the already-built dist; nothing to run.
tarball="$(cd "${sdk_dir}" && npm pack --ignore-scripts --silent --pack-destination "${pack_dir}" | tail -n 1)"

cd "${repo_root}"
npm install --no-save --no-audit --no-fund "${pack_dir}/${tarball}"

echo "use-local-sdk: installed @teachmehipaa/node from ${sdk_dir}" >&2
