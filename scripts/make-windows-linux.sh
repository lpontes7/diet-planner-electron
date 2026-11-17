#!/usr/bin/env bash
# Build with this checkout's local Wine/Mono, or with system-installed tools.
set -euo pipefail
DIETAS_REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIETAS_REPO_DIR"
if [[ -x .tools/windows-build/root/usr/bin/mono ]]; then
  source scripts/windows-build-env.sh
fi
for DIETAS_TOOL in mono wine zip; do
  if ! command -v "$DIETAS_TOOL" >/dev/null 2>&1; then
    echo "Ferramenta ausente: $DIETAS_TOOL. Consulte a seção de geração Linux no README." >&2
    exit 1
  fi
done
exec npm run make:windows -- "$@"
