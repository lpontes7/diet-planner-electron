#!/usr/bin/env bash
# Local Wine/Mono installation used for Windows builds on Linux without sudo.
# Source this file after preparing .tools/windows-build/root from Ubuntu packages.
DIETAS_BUILD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/.tools/windows-build"
export DIETAS_BUILD_DIR
export PATH="$DIETAS_BUILD_DIR/bin:$DIETAS_BUILD_DIR/root/usr/bin:$PATH"
export LD_LIBRARY_PATH="$DIETAS_BUILD_DIR/root/usr/lib:$DIETAS_BUILD_DIR/root/usr/lib/x86_64-linux-gnu:$DIETAS_BUILD_DIR/root/lib/x86_64-linux-gnu:$DIETAS_BUILD_DIR/root/usr/lib/x86_64-linux-gnu/wine:$DIETAS_BUILD_DIR/root/usr/lib/i386-linux-gnu/wine${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export MONO_GAC_PREFIX="$DIETAS_BUILD_DIR/root/usr"
export MONO_PATH="$DIETAS_BUILD_DIR/root/usr/lib/mono/4.5"
export MONO_CFG_DIR="$DIETAS_BUILD_DIR/root/etc"
export XDG_CONFIG_HOME="$DIETAS_BUILD_DIR/config"
export XDG_DATA_HOME="$DIETAS_BUILD_DIR/share"
export NUGET_PACKAGES="$DIETAS_BUILD_DIR/nuget"
export MONO_REGISTRY_PATH="$DIETAS_BUILD_DIR/mono-registry"
export WINEPREFIX="$DIETAS_BUILD_DIR/wineprefix"
export WINEARCH=win64
export WINEDLLPATH="$DIETAS_BUILD_DIR/root/usr/lib/x86_64-linux-gnu/wine:$DIETAS_BUILD_DIR/root/usr/lib/i386-linux-gnu/wine"
export WINESERVER="$DIETAS_BUILD_DIR/root/usr/lib/wine/wineserver64"
export WINEDEBUG="${WINEDEBUG:--all}"
export WINEDLLOVERRIDES='mscoree,mshtml='
