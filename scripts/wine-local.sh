#!/usr/bin/env bash
# The locally installed 32-bit ELF loader is set during tool setup.
# No system paths, root privileges or ptrace wrappers are required at runtime.
set -euo pipefail
DIETAS_REPO_DIR="$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")/.." && pwd)"
source "$DIETAS_REPO_DIR/scripts/windows-build-env.sh"
export LD_LIBRARY_PATH="$DIETAS_BUILD_DIR/root/lib/i386-linux-gnu:$DIETAS_BUILD_DIR/root/usr/lib/i386-linux-gnu:$LD_LIBRARY_PATH"
export WINELOADER="$DIETAS_BUILD_DIR/root/usr/lib/wine/wine"
exec "$DIETAS_BUILD_DIR/root/usr/lib/wine/wine" "$@"
