#!/usr/bin/env bash

set -euo pipefail

UUID="dm-theme-changer-reborn@phenrique-coder.github.com"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "=== Building and Installing DM Theme Changer Reborn ==="

# 1. Clean previous build files
echo "Cleaning old build files..."
rm -rf ./out/*
rm -rf ./schemas/*.compiled
rm -f ./*.zip

# 2. Compile schemas
echo "Compiling GSettings schemas..."
glib-compile-schemas ./schemas

# 3. Create build output directory structure
echo "Creating build package..."
mkdir -p "./out/$UUID/schemas"
cp -r ./src/* "./out/$UUID/"
cp ./schemas/*.xml "./out/$UUID/schemas/"
cp ./metadata.json "./out/$UUID/metadata.json"
cp ./LICENSE "./out/$UUID/LICENSE"

# 4. Install to GNOME Shell extensions directory
echo "Installing extension to $EXTENSION_DIR..."
mkdir -p "$EXTENSION_DIR"
# Delete existing files in the target directory to ensure clean install
rm -rf "${EXTENSION_DIR:?}"/*
cp -r ./out/"$UUID"/* "$EXTENSION_DIR/"
glib-compile-schemas "$EXTENSION_DIR/schemas"

# 5. Pack zip
echo "Creating zip package..."
if cd "out/$UUID"; then
  zip -r "../../$UUID.zip" . > /dev/null
  cd ../..
fi

echo "=== Installation Completed Successfully! ==="
echo "To apply changes, please reload GNOME Shell:"
echo "  - If on Wayland (default on newer GNOME): Log out and log back in."
echo "  - If on X11: Press Alt+F2, type 'r', and press Enter."
echo ""
echo "Then, enable the extension using GNOME Extensions app, Extension Manager, or run:"
echo "  gnome-extensions enable $UUID"
