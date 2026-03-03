const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Split
  startSplit: (params) => ipcRenderer.invoke('split:start', params),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('history:delete', id),

  // Shell
  openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),

  // Real-time events
  onHistoryUpdated: (cb) => ipcRenderer.on('history:updated', (_, data) => cb(data)),
  onSplitProgress: (cb) => ipcRenderer.on('split:progress', (_, data) => cb(data)),
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Platform info
  platform: process.platform,
});
