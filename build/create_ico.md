# Creating ICO File for Windows

The icon.ico file needs to be in proper ICO format for Windows. Currently we have a placeholder.

## Option 1: Online Converter (Easiest)

1. Go to https://convertio.co/png-ico/ or https://www.icoconverter.com/
2. Upload `build/icon.png`
3. Download the converted `icon.ico`
4. Place it in `build/icon.ico`

## Option 2: Using ImageMagick (if installed)

```bash
convert build/icon.png -define icon:auto-resize=256 build/icon.ico
```

## Option 3: Using electron-icon-maker (installed)

```bash
npx electron-icon-maker --input=build/icon.png --output=build/
```

## For Testing

The build will work without a proper ICO file, but Windows will show a default icon. For production, you should create a proper ICO file.

