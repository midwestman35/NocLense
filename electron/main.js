const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const isDev = !app.isPackaged;

let mainWindow;
let crashLogFilePath = null;

function getCrashLogPath() {
  if (!crashLogFilePath) {
    crashLogFilePath = path.join(app.getPath('userData'), 'crash-reports.log');
  }
  return crashLogFilePath;
}

function rotateCrashLogIfNeeded(logPath) {
  try {
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      // Keep a simple 5MB cap by rotating the file.
      if (stats.size > 5 * 1024 * 1024) {
        const rotated = `${logPath}.1`;
        if (fs.existsSync(rotated)) {
          fs.unlinkSync(rotated);
        }
        fs.renameSync(logPath, rotated);
      }
    }
  } catch (error) {
    console.error('Failed rotating crash log:', error);
  }
}

function safeSerializeError(error) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { value: String(error) };
  }
}

function sendRemoteCrashReportIfConfigured(record) {
  const webhookUrl = process.env.NOCLENSE_ERROR_REPORT_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    const url = new URL(webhookUrl);
    const payload = JSON.stringify(record);
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        port: url.port || 443,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        // Consume response so socket closes cleanly.
        res.on('data', () => {});
      }
    );
    req.on('error', (error) => {
      console.error('Remote crash report failed:', error.message);
    });
    req.write(payload);
    req.end();
  } catch (error) {
    console.error('Invalid NOCLENSE_ERROR_REPORT_URL:', error);
  }
}

function persistCrashRecord(source, payload) {
  const reportId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const record = {
    reportId,
    source,
    timestamp: new Date().toISOString(),
    payload,
  };

  try {
    const logPath = getCrashLogPath();
    rotateCrashLogIfNeeded(logPath);
    fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    console.error('Failed writing crash report to disk:', error);
  }

  sendRemoteCrashReportIfConfigured(record);
  return reportId;
}

function readCrashRecords(limit = 50) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const logPath = getCrashLogPath();
  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const records = [];

    for (let i = lines.length - 1; i >= 0 && records.length < safeLimit; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        records.push(parsed);
      } catch {
        // Skip malformed lines so one bad record does not block the report view.
      }
    }

    return records;
  } catch (error) {
    console.error('Failed reading crash records:', error);
    return [];
  }
}

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
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Capture renderer crashes for post-mortem debugging.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const reportId = persistCrashRecord('renderer-process-gone', details);
    console.error(`Renderer process crashed. reportId=${reportId}`, details);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    const reportId = persistCrashRecord('did-fail-load', {
      errorCode,
      errorDescription,
      validatedURL,
    });
    console.error(`Renderer failed to load URL. reportId=${reportId}`, {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  mainWindow.on('unresponsive', () => {
    const reportId = persistCrashRecord('window-unresponsive', {});
    console.error(`Main window became unresponsive. reportId=${reportId}`);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle('app:report-error', async (_event, payload) => {
    try {
      const reportId = persistCrashRecord('renderer-reported-error', payload);
      return { ok: true, reportId };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('app:get-crash-reports', async (_event, options) => {
    try {
      const limit = options?.limit ?? 50;
      const reports = readCrashRecords(limit);
      return { ok: true, reports, logPath: getCrashLogPath() };
    } catch (error) {
      return {
        ok: false,
        reports: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('app:open-crash-log-location', async () => {
    try {
      const logPath = getCrashLogPath();
      if (!fs.existsSync(logPath)) {
        // Ensure path exists so shell can reveal it.
        fs.writeFileSync(logPath, '', 'utf8');
      }
      shell.showItemInFolder(logPath);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('app:clear-crash-reports', async () => {
    try {
      const logPath = getCrashLogPath();
      fs.writeFileSync(logPath, '', 'utf8');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

process.on('uncaughtException', (error) => {
  const reportId = persistCrashRecord('main-uncaught-exception', safeSerializeError(error));
  console.error(`Uncaught exception in main process. reportId=${reportId}`, error);
});

process.on('unhandledRejection', (reason) => {
  const reportId = persistCrashRecord('main-unhandled-rejection', safeSerializeError(reason));
  console.error(`Unhandled promise rejection in main process. reportId=${reportId}`, reason);
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
  
  // Prevent navigation to external URLs
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:5173' && !isDev) {
      event.preventDefault();
    }
  });
});

