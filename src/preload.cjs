const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('conch', {
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setPreference: (key, value) => ipcRenderer.invoke('preferences:set', key, value),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close')
});
