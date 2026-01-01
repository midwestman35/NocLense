#!/bin/bash
# Create a simple black icon as placeholder
# User can replace this with their actual icon later

# Create 256x256 black PNG using sips
sips -s format png -z 256 256 --setProperty format png /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericDocumentIcon.icns --out icon.png 2>/dev/null

# For ICO, we'll need to convert or use online tool
# For now, copy PNG as placeholder
cp icon.png icon.ico 2>/dev/null || echo "Note: ICO conversion needed for Windows"

echo "✅ Icon files created (placeholder)"
echo "Replace build/icon.png and build/icon.ico with your actual icons"
