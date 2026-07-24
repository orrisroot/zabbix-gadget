#!/usr/bin/env bash
set -e

# Run the original tauri CLI with all arguments passed by tauri-action
npx tauri "$@"

# Perform cleanup and repackaging only when building
if [ "$1" = "build" ]; then
  APPDIR_PATH=$(ls -d src-tauri/target/release/bundle/appimage/*.AppDir 2>/dev/null | head -n 1)
  APPIMAGE_PATH=$(ls src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null | head -n 1)

  if [ -n "$APPDIR_PATH" ]; then
    echo "Cleaning up libwayland from AppDir..."
    rm -f "$APPDIR_PATH"/usr/lib/libwayland-*

    if [ -n "$APPIMAGE_PATH" ]; then
      ARCH=$(uname -m)
      if [ "$ARCH" = "x86_64" ]; then
        APPIMAGETOOL_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
      elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        ARCH="aarch64"
        APPIMAGETOOL_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-aarch64.AppImage"
      else
        echo "Unsupported architecture for appimagetool: $ARCH"
        exit 1
      fi

      echo "Repackaging AppImage using appimagetool ($ARCH)..."
      curl -L -o appimagetool "$APPIMAGETOOL_URL"
      chmod +x appimagetool
      APPIMAGE_EXTRACT_AND_RUN=1 ARCH="$ARCH" ./appimagetool "$APPDIR_PATH" "$APPIMAGE_PATH"
      rm -f appimagetool
      echo "AppImage repackaging complete."
    fi
  fi
fi
