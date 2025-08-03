const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ucloud', {
  listFiles: () => ipcRenderer.invoke('files:list'),
  scanFiles: () => ipcRenderer.invoke('files:scan'),
  onFilesIndex: (cb) => ipcRenderer.on('files:index', (_, files) => cb(files)),
});
