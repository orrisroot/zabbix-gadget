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
      echo "Repackaging AppImage using appimagetool..."
      curl -L -o appimagetool https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
      chmod +x appimagetool
      APPIMAGE_EXTRACT_AND_RUN=1 ARCH=x86_64 ./appimagetool "$APPDIR_PATH" "$APPIMAGE_PATH"
      rm -f appimagetool
      echo "AppImage repackaging complete."
    fi
  fi
fi
