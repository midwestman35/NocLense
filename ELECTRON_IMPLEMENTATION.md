# Electron Implementation Guide

This is a step-by-step guide for implementing Electron packaging for NocLense.

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Windows machine for testing (or Windows VM)

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
npm install --save-dev electron electron-builder
npm install --save-dev concurrently wait-on cross-env
```

### Step 2: Create Electron Main Process

Create `electron/main.js`:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png'),
    titleBarStyle: 'default',
    show: false // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // Development: Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});
```

### Step 3: Create Preload Script (Optional but Recommended)

Create `electron/preload.js`:

```javascript
// Preload script for secure context bridge
const { contextBridge } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any native integrations here if needed
  platform: process.platform
});
```

### Step 4: Update package.json

Add these sections to your `package.json`:

```json
{
  "main": "electron/main.js",
  "homepage": "./",
  "scripts": {
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && cross-env NODE_ENV=development electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:pack": "npm run build && electron-builder --dir",
    "electron:dist": "npm run build && electron-builder --win"
  },
  "build": {
    "appId": "com.midwestman35.noclense",
    "productName": "NocLense",
    "directories": {
      "output": "dist-electron",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "NocLense"
    }
  }
}
```

### Step 5: Update Vite Config

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})
```

### Step 6: Create App Icon

1. Create a 256x256 PNG icon
2. Convert to ICO format for Windows
3. Place in `build/icon.ico` and `build/icon.png`

You can use online tools like:
- https://convertio.co/png-ico/
- https://www.icoconverter.com/

### Step 7: Test Development Mode

```bash
npm run electron:dev
```

This should:
1. Start Vite dev server
2. Wait for it to be ready
3. Launch Electron window
4. Load your app

### Step 8: Build for Production

```bash
# First, build the React app
npm run build

# Then package Electron app
npm run electron:build
```

This creates:
- `dist-electron/` - Packaged application
- `dist-electron/NocLense Setup x.x.x.exe` - Windows installer

### Step 9: Test the Executable

1. Run the installer
2. Install to default location
3. Launch the app
4. Test all features
5. Test file operations
6. Test with large files

## Troubleshooting

### Issue: Blank window in production
**Solution**: Check that `base: './'` is set in vite.config.ts

### Issue: Assets not loading
**Solution**: Ensure paths are relative, not absolute

### Issue: File operations not working
**Solution**: Check file:// protocol handling in main.js

### Issue: Build fails
**Solution**: 
- Check all paths are correct
- Ensure icon files exist
- Check electron-builder logs

## Code Signing (Optional but Recommended)

For production releases, you should code sign your executable:

1. Obtain a code signing certificate
2. Add to electron-builder config:
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password"
}
```

## Auto-Updater (Future)

For automatic updates:

1. Install electron-updater
2. Configure update server
3. Add update logic to main process

## File Structure After Implementation

```
NocLense/
├── electron/
│   ├── main.js
│   └── preload.js
├── build/
│   ├── icon.ico
│   └── icon.png
├── dist/              # Vite build output
├── dist-electron/     # Electron build output
└── package.json
```

## Next Steps

1. Follow steps 1-9 above
2. Test thoroughly
3. Create beta release
4. Distribute to testers

