# Build Resources Directory

This directory contains resources needed for building the Electron application.

## Required Files

### Icons

You need to create the following icon files:

1. **icon.ico** - Windows icon (256x256 minimum, ICO format)
2. **icon.png** - PNG icon (256x256 minimum)

### How to Create Icons

1. Create a 256x256 PNG image with your app logo
2. Convert to ICO format using:
   - Online: https://convertio.co/png-ico/
   - Online: https://www.icoconverter.com/
   - Or use ImageMagick: `convert icon.png -define icon:auto-resize=256 icon.ico`

3. Place both files in this directory:
   - `build/icon.ico`
   - `build/icon.png`

### Temporary Solution

For testing, you can use a simple placeholder. The app will work without icons, but Windows will show a default icon.

## Notes

- Icons are used in:
  - Windows taskbar
  - Windows file explorer
  - Installer
  - Desktop shortcut

