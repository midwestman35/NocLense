// Preload script for secure context bridge
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,
  
  // Version information
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  // Error reporting bridge used by renderer/global handlers.
  reportError: (payload) => ipcRenderer.invoke('app:report-error', payload),
  getCrashReports: (options) => ipcRenderer.invoke('app:get-crash-reports', options),
  openCrashLogLocation: () => ipcRenderer.invoke('app:open-crash-log-location'),
  clearCrashReports: () => ipcRenderer.invoke('app:clear-crash-reports')
});

