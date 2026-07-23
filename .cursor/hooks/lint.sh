#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
file_path=$(node -pe "JSON.parse(process.argv[1]).file_path || ''" "$input")

if [[ -z "$file_path" ]]; then
  exit 0
fi

case "$file_path" in
  *.ts | *.tsx | *.astro | *.mts | *.cts) ;;
  *)
    exit 0
    ;;
esac

project_dir="${CURSOR_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$project_dir"

if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && -f .nvmrc ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || true
fi

echo "[lint hook] eslint --fix $file_path" >&2
npm exec eslint --fix "$file_path" >&2
