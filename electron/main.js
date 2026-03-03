const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chardet = require('chardet');
const iconv = require('iconv-lite');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0F0F0F',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── History Storage ──────────────────────────────────────────────────────────

const historyPath = path.join(app.getPath('userData'), 'filesplitter-history.json');

function loadHistory() {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function updateHistoryEntry(id, updates) {
  const history = loadHistory();
  const idx = history.findIndex((h) => h.id === id);
  if (idx !== -1) {
    history[idx] = { ...history[idx], ...updates };
    saveHistory(history);
    return history[idx];
  }
  return null;
}

// ─── Encoding Detection ───────────────────────────────────────────────────────

/**
 * Detect encoding and BOM from a raw Buffer.
 * BOM detection takes priority over chardet (more reliable for UTF-16).
 * Returns { encoding: string, bom: Buffer|null }
 */
function detectEncodingAndBOM(buffer) {
  // UTF-32 must be checked before UTF-16 (shares first two bytes)
  if (buffer.length >= 4) {
    if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0xFE && buffer[3] === 0xFF)
      return { encoding: 'UTF-32BE', bom: buffer.slice(0, 4) };
    if (buffer[0] === 0xFF && buffer[1] === 0xFE && buffer[2] === 0x00 && buffer[3] === 0x00)
      return { encoding: 'UTF-32LE', bom: buffer.slice(0, 4) };
  }
  if (buffer.length >= 3) {
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF)
      return { encoding: 'UTF-8', bom: buffer.slice(0, 3) };
  }
  if (buffer.length >= 2) {
    if (buffer[0] === 0xFF && buffer[1] === 0xFE)
      return { encoding: 'UTF-16LE', bom: buffer.slice(0, 2) };
    if (buffer[0] === 0xFE && buffer[1] === 0xFF)
      return { encoding: 'UTF-16BE', bom: buffer.slice(0, 2) };
  }
  // No BOM — use chardet statistical detection
  const detected = chardet.detect(buffer);
  return { encoding: detected || 'UTF-8', bom: null };
}

// ─── File Splitting Logic ─────────────────────────────────────────────────────

function sanitizeFilename(str) {
  return str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 120) || 'untitled';
}

function getFolderKey(firstGroup) {
  const char = (firstGroup || '').trim().charAt(0).toUpperCase();
  if (/[A-Z]/.test(char)) return char;
  if (/[0-9]/.test(char)) return '0-9';
  return '_misc';
}

async function performSplit(sourcePath, pattern, outputDir, historyId) {
  // ── 1. Read raw bytes and detect encoding ──────────────────────────────────
  const rawBuffer = fs.readFileSync(sourcePath);
  const { encoding, bom } = detectEncodingAndBOM(rawBuffer);

  // iconv-lite decodes the buffer (automatically strips BOM for UTF-8/16)
  const content = iconv.decode(rawBuffer, encoding);

  console.log(`[FileSplitter] Detected encoding: ${encoding}${bom ? ' (with BOM)' : ''}`);

  // ── 2. Compile regex ───────────────────────────────────────────────────────
  let regex;
  try {
    regex = new RegExp(pattern, 'gm');
  } catch (e) {
    throw new Error(`Invalid regex: ${e.message}`);
  }

  // ── 3. Find all match positions ────────────────────────────────────────────
  const matches = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      fullMatch: m[0],
      firstGroup: m[1] !== undefined ? m[1] : m[0],
    });
    if (m.index === regex.lastIndex) regex.lastIndex++; // prevent infinite loop on zero-length match
  }

  if (matches.length === 0) {
    throw new Error('No matches found. Check your regex pattern.');
  }

  // ── 4. Write each chunk re-encoded to the source encoding ─────────────────
  let filesCreated = 0;
  const createdFiles = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const chunk = content.slice(start, end);

    // Re-encode the text chunk back to the original encoding
    const encodedChunk = iconv.encode(chunk, encoding);

    // Only the first output file gets the BOM (if the source had one)
    const outputBuffer = (i === 0 && bom)
      ? Buffer.concat([bom, encodedChunk])
      : encodedChunk;

    // Determine folder from first capture group (alphabetical grouping)
    const folderKey = getFolderKey(matches[i].firstGroup);
    const folderPath = path.join(outputDir, folderKey);
    fs.mkdirSync(folderPath, { recursive: true });

    // Build filename from first group or full match
    const baseName = sanitizeFilename(matches[i].firstGroup || matches[i].fullMatch);
    let fileName = `${baseName}.txt`;
    let filePath = path.join(folderPath, fileName);

    // Avoid overwriting: append index if file exists
    if (fs.existsSync(filePath)) {
      fileName = `${baseName}_${i + 1}.txt`;
      filePath = path.join(folderPath, fileName);
    }

    // Write raw bytes — no encoding argument so Node doesn't re-interpret content
    fs.writeFileSync(filePath, outputBuffer);
    createdFiles.push(filePath);
    filesCreated++;

    const progress = Math.round((filesCreated / matches.length) * 100);
    updateHistoryEntry(historyId, { filesCreated, progress });

    // Emit real-time progress
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('split:progress', {
        id: historyId,
        filesCreated,
        progress,
        status: 'running',
      });
    }

    // Yield to event loop for UI responsiveness
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  return { filesCreated, createdFiles, encoding };
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt', 'log', 'csv', 'md', 'json', 'xml', 'sql'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('history:get', () => loadHistory());

ipcMain.handle('history:clear', () => {
  saveHistory([]);
  return true;
});

ipcMain.handle('history:delete', (_, id) => {
  const history = loadHistory().filter((h) => h.id !== id);
  saveHistory(history);
  return true;
});

ipcMain.handle('shell:openPath', async (_, filePath) => {
  await shell.openPath(filePath);
});

ipcMain.handle('split:start', async (_, { sourcePath, pattern, outputDir }) => {
  const historyId = `split_${Date.now()}`;

  const entry = {
    id: historyId,
    sourcePath,
    sourceFile: path.basename(sourcePath),
    sourceSize: (() => {
      try { return fs.statSync(sourcePath).size; } catch { return 0; }
    })(),
    pattern,
    outputDir,
    createdAt: new Date().toISOString(),
    status: 'running',
    filesCreated: 0,
    progress: 0,
    error: null,
  };

  // Persist to history and notify renderer
  const history = loadHistory();
  history.unshift(entry);
  saveHistory(history);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history:updated', entry);
  }

  try {
    const { filesCreated, encoding } = await performSplit(sourcePath, pattern, outputDir, historyId);
    updateHistoryEntry(historyId, { status: 'done', filesCreated, progress: 100, encoding });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('split:progress', {
        id: historyId, status: 'done', filesCreated, progress: 100, encoding,
      });
    }
    return { success: true, filesCreated, encoding };
  } catch (err) {
    updateHistoryEntry(historyId, { status: 'error', error: err.message, progress: 0 });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('split:progress', {
        id: historyId, status: 'error', error: err.message,
      });
    }
    return { success: false, error: err.message };
  }
});

// ─── Window Controls ──────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
