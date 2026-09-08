#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
npm exec vite build -- --config desktop/vite.config.ts
bundle="$HOME/Library/Caches/Headspace/Build/Headspace.app"
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
swiftc -O -target arm64-apple-macos14.0 desktop/native/Headspace.swift -framework Cocoa -framework WebKit -framework Network -framework Security -o "$bundle/Contents/MacOS/Headspace"
mkdir -p "$bundle/Contents/Resources/web" "$bundle/Contents/Helpers"
rsync -a --delete desktop/build/web/ "$bundle/Contents/Resources/web/"
# Remove the obsolete copied Spotify client from earlier local builds.
rm -rf "$bundle/Contents/Helpers/Spotify.app"
cp desktop/assets/Headspace.icns "$bundle/Contents/Resources/"
cat > "$bundle/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Headspace</string>
<key>CFBundleIdentifier</key><string>local.headspace.player</string>
<key>CFBundleName</key><string>Headspace</string>
<key>CFBundleDisplayName</key><string>Headspace</string>
<key>CFBundleIconFile</key><string>Headspace</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
xattr -cr "$bundle"
codesign --force --sign - --identifier local.headspace.player "$bundle"
codesign --verify --deep --strict "$bundle"
echo "Built $bundle"
