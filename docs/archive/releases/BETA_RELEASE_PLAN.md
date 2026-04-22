# Beta Release Implementation Plan

## Overview
This document outlines the plan for releasing NocLense (LogScrub) as a beta version, including options for packaging as a Windows executable.

**Target Release Date**: TBD  
**Version**: 1.0.0-beta.1

---

## Pre-Beta Checklist

### Code Quality
- [x] TypeScript compilation passes
- [x] Linter passes with no errors
- [x] Build succeeds
- [ ] All features tested manually
- [ ] Error handling tested
- [ ] Performance tested with large files (100MB+)
- [ ] Memory usage profiled

### Documentation
- [x] README.md updated
- [x] CHANGELOG.md maintained
- [ ] User guide/documentation
- [ ] Known issues documented
- [ ] Installation instructions
- [ ] Troubleshooting guide

### Testing
- [ ] Manual testing on Windows
- [ ] Manual testing on macOS
- [ ] Manual testing on Linux (if applicable)
- [ ] Test with various log file formats
- [ ] Test with large files (50MB, 100MB, 200MB+)
- [ ] Test multiple file merging
- [ ] Test error scenarios

### Beta-Specific Features
- [ ] Beta banner/watermark (optional)
- [ ] Feedback mechanism (GitHub Issues link)
- [ ] Version display in UI
- [ ] Analytics/telemetry (optional)

---

## Windows Executable Options

### Option 1: Electron ⭐ (Recommended)

**Best for**: Full-featured desktop app, cross-platform support, mature ecosystem

#### Pros
- ✅ Mature and stable (used by VS Code, Slack, Discord)
- ✅ Excellent cross-platform support (Windows, macOS, Linux)
- ✅ Rich ecosystem and documentation
- ✅ Easy integration with existing React/Vite app
- ✅ Native OS integrations (file dialogs, notifications, etc.)
- ✅ Code signing support
- ✅ Auto-updater support

#### Cons
- ❌ Larger bundle size (~100-150MB)
- ❌ Higher memory usage
- ❌ Slower startup time
- ❌ Requires Node.js runtime bundled

#### Implementation Steps

1. **Install Dependencies**
   ```bash
   npm install --save-dev electron electron-builder
   npm install --save-dev concurrently wait-on cross-env
   ```

2. **Create Electron Main Process**
   - Create `electron/main.js` (handles window creation)
   - Configure to load Vite dev server in development
   - Load built files in production

3. **Update package.json**
   - Add `main` entry point
   - Add electron scripts
   - Configure electron-builder for Windows

4. **Build Configuration**
   - Configure electron-builder for NSIS installer
   - Add app icon
   - Configure code signing (optional)

5. **Testing**
   - Test in development mode
   - Test packaged executable
   - Test on clean Windows VM

**Estimated Implementation Time**: 4-6 hours  
**Bundle Size**: ~120-150MB  
**Memory Usage**: ~150-200MB base

---

### Option 2: Tauri 🚀 (Lightweight Alternative)

**Best for**: Smaller bundle size, better performance, Rust backend

#### Pros
- ✅ Much smaller bundle size (~5-15MB)
- ✅ Lower memory usage
- ✅ Faster startup time
- ✅ Better security (sandboxed)
- ✅ Native OS integrations
- ✅ No Node.js runtime required

#### Cons
- ❌ Requires Rust toolchain
- ❌ Less mature ecosystem
- ❌ More complex setup
- ❌ Smaller community
- ❌ Windows code signing more complex

#### Implementation Steps

1. **Install Prerequisites**
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install Tauri CLI**
   ```bash
   npm install --save-dev @tauri-apps/cli
   npm install @tauri-apps/api
   ```

3. **Initialize Tauri**
   ```bash
   npx tauri init
   ```

4. **Configure Tauri**
   - Update `tauri.conf.json`
   - Configure build settings
   - Set up Windows-specific configs

5. **Build**
   ```bash
   npm run tauri build
   ```

**Estimated Implementation Time**: 6-8 hours  
**Bundle Size**: ~8-15MB  
**Memory Usage**: ~80-120MB base

---

### Option 3: PWA (Progressive Web App)

**Best for**: Quick deployment, no installation, cross-platform

#### Pros
- ✅ No installation required
- ✅ Works on all platforms
- ✅ Small download size
- ✅ Easy updates
- ✅ Can be "installed" to desktop
- ✅ No packaging needed

#### Cons
- ❌ Requires browser
- ❌ Limited native OS integration
- ❌ File access limitations
- ❌ Not a "true" executable
- ❌ Offline support requires service workers

#### Implementation Steps

1. **Add PWA Support**
   ```bash
   npm install --save-dev vite-plugin-pwa
   ```

2. **Configure Vite PWA Plugin**
   - Add manifest.json
   - Configure service worker
   - Add icons

3. **Build and Deploy**
   - Build for production
   - Deploy to hosting (GitHub Pages, Netlify, etc.)
   - Users can "Install" from browser

**Estimated Implementation Time**: 2-3 hours  
**Bundle Size**: Same as web app (~250KB)  
**Memory Usage**: Browser-dependent

---

### Option 4: Native Windows Build (Advanced)

**Best for**: Maximum performance, smallest size, Windows-only

#### Pros
- ✅ Smallest bundle size
- ✅ Best performance
- ✅ Native Windows look/feel
- ✅ No runtime dependencies

#### Cons
- ❌ Requires complete rewrite
- ❌ Windows-only
- ❌ Much longer development time
- ❌ Need C++/C# expertise

**Not Recommended** for beta release - too much work.

---

## Recommendation Matrix

| Criteria | Electron | Tauri | PWA | Native |
|----------|----------|-------|-----|--------|
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **Bundle Size** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cross-Platform** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **Maturity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Time to Market** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |

**Recommended for Beta**: **Electron** - Best balance of features, maturity, and development speed.

---

## Detailed Electron Implementation Plan

### Phase 1: Setup (1-2 hours)

1. **Install Dependencies**
   ```bash
   npm install --save-dev electron electron-builder
   npm install --save-dev concurrently wait-on cross-env
   ```

2. **Create Electron Main Process**
   - File: `electron/main.js`
   - Handles window creation
   - Manages app lifecycle
   - Loads Vite dev server or built files

3. **Update package.json**
   ```json
   {
     "main": "electron/main.js",
     "scripts": {
       "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
       "electron:build": "npm run build && electron-builder",
       "electron:pack": "npm run build && electron-builder --dir"
     }
   }
   ```

### Phase 2: Configuration (1-2 hours)

1. **Create electron-builder config**
   ```json
   {
     "build": {
       "appId": "com.midwestman35.noclense",
       "productName": "NocLense",
       "directories": {
         "output": "dist-electron"
       },
       "files": [
         "dist/**/*",
         "electron/**/*",
         "package.json"
       ],
       "win": {
         "target": ["nsis"],
         "icon": "build/icon.ico"
       },
       "nsis": {
         "oneClick": false,
         "allowToChangeInstallationDirectory": true
       }
     }
   }
   ```

2. **Create App Icon**
   - Generate icon.ico (256x256 minimum)
   - Place in `build/` directory

### Phase 3: Integration (1-2 hours)

1. **Update Vite Config**
   - Ensure base path is correct
   - Configure for Electron environment

2. **Update Main Process**
   - Handle file:// protocol
   - Configure security settings
   - Add native file dialogs (optional)

3. **Test Development Mode**
   ```bash
   npm run electron:dev
   ```

### Phase 4: Build & Package (1 hour)

1. **Build for Production**
   ```bash
   npm run electron:build
   ```

2. **Test Executable**
   - Run on Windows
   - Test file operations
   - Test all features

### Phase 5: Distribution (Ongoing)

1. **Create Installer**
   - NSIS installer (default)
   - Custom installer options

2. **Code Signing** (Optional but Recommended)
   - Obtain code signing certificate
   - Configure electron-builder

3. **Auto-Updater** (Future)
   - Set up update server
   - Configure electron-updater

---

## Beta Release Checklist

### Before Beta Release

- [ ] Choose packaging solution (Electron recommended)
- [ ] Implement chosen solution
- [ ] Test on clean Windows 10/11 installation
- [ ] Test with various log file sizes
- [ ] Create installer
- [ ] Test installer on clean system
- [ ] Document known issues
- [ ] Create beta release notes
- [ ] Set up GitHub Releases
- [ ] Create beta feedback form/issue template

### Beta Release

- [ ] Tag release in git: `v1.0.0-beta.1`
- [ ] Create GitHub Release
- [ ] Upload Windows installer
- [ ] Write release notes
- [ ] Announce to beta testers
- [ ] Monitor for issues

### Post-Beta

- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Plan next beta or stable release
- [ ] Update documentation

---

## Distribution Options

### Option 1: GitHub Releases (Recommended for Beta)
- ✅ Free
- ✅ Easy to set up
- ✅ Version control
- ✅ Release notes
- ✅ Download tracking

### Option 2: Direct Download
- Host on your own server
- More control
- Requires hosting

### Option 3: Package Managers (Future)
- Chocolatey (Windows)
- Scoop (Windows)
- Homebrew (macOS)
- Requires package maintainer approval

---

## Testing Plan

### Windows Testing Matrix

| Windows Version | Test Status | Notes |
|----------------|-------------|-------|
| Windows 10 (64-bit) | [ ] | Minimum supported |
| Windows 11 (64-bit) | [ ] | Latest |
| Windows 10 (32-bit) | [ ] | If supporting |

### Test Scenarios

1. **Installation**
   - [ ] Fresh install
   - [ ] Upgrade from previous version
   - [ ] Uninstall
   - [ ] Install to custom directory

2. **File Operations**
   - [ ] Single file upload
   - [ ] Multiple file upload
   - [ ] Large files (50MB+)
   - [ ] Very large files (200MB+)
   - [ ] Invalid file types
   - [ ] Drag and drop

3. **Functionality**
   - [ ] Search/filter
   - [ ] Smart filter
   - [ ] Timeline scrubber
   - [ ] Log details panel
   - [ ] Clear logs

4. **Performance**
   - [ ] Startup time
   - [ ] Memory usage
   - [ ] Large file parsing
   - [ ] UI responsiveness

5. **Error Handling**
   - [ ] Invalid files
   - [ ] Corrupted files
   - [ ] Network errors (if applicable)
   - [ ] Out of memory

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Choose solution | 1 hour | Research |
| Electron setup | 2 hours | - |
| Configuration | 2 hours | Setup complete |
| Integration | 2 hours | Config complete |
| Testing | 4 hours | Integration complete |
| Build & Package | 1 hour | Testing complete |
| Beta Release | 1 hour | Package ready |
| **Total** | **~13 hours** | |

---

## Next Steps

1. **Decide on packaging solution** (Electron recommended)
2. **Create implementation branch**: `git checkout -b feature/electron-packaging`
3. **Follow implementation plan**
4. **Test thoroughly**
5. **Create beta release**

---

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Tauri Documentation](https://tauri.app/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

---

**Last Updated**: 2025-12-31  
**Status**: Planning Phase

