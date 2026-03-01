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
  clearCrashReports: () => ipcRenderer.invoke('app:clear-crash-reports'),

  // Secure storage bridge for API keys.
  isSecureStorageAvailable: () => ipcRenderer.invoke('secure-storage:is-available'),
  getSecureStorage: (key) => ipcRenderer.invoke('secure-storage:get', key),
  setSecureStorage: (key, value) => ipcRenderer.invoke('secure-storage:set', key, value),
  deleteSecureStorage: (key) => ipcRenderer.invoke('secure-storage:delete', key),
  migrateToSecureStorage: (values) => ipcRenderer.invoke('secure-storage:migrate', values),

  // Codex CLI bridge (Electron only)
  codexHealth: () => ipcRenderer.invoke('codex:health'),
  codexAnalyze: (payload) => ipcRenderer.invoke('codex:analyze', payload),
});

