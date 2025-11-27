const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openIco: () => ipcRenderer.invoke('open-ico'),
  parseIcoBuffer: (arrayBuffer, fileName) => ipcRenderer.invoke('parse-ico-buffer', { arrayBuffer, fileName }),
  saveImage: (data) => ipcRenderer.invoke('save-image', data),
  saveIcon: (data) => ipcRenderer.invoke('save-icon', data),
  saveIconPngs: (data) => ipcRenderer.invoke('save-icon-pngs', data),
  extractIcoImage: (data) => ipcRenderer.invoke('extract-ico-image', data)
});
