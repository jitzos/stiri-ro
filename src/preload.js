const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("newsApi", {
  listSources: () => ipcRenderer.invoke("feeds:list"),
  listCategories: () => ipcRenderer.invoke("categories:list"),
  refresh: () => ipcRenderer.invoke("feeds:refresh"),
  setMinimizeToTray: (enabled) => ipcRenderer.invoke("settings:minimize-to-tray", enabled),
  getStartAtLogin: () => ipcRenderer.invoke("settings:get-start-at-login"),
  setStartAtLogin: (enabled) => ipcRenderer.invoke("settings:set-start-at-login", enabled),
  getPreferences: () => ipcRenderer.invoke("settings:get-preferences"),
  updatePreferences: (patch) => ipcRenderer.invoke("settings:update-preferences", patch),
  getUpdateStatus: () => ipcRenderer.invoke("updates:get-status"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
  onFeedsUpdated: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("feeds:updated", listener);
    return () => ipcRenderer.removeListener("feeds:updated", listener);
  },
  openArticle: (url) => ipcRenderer.invoke("article:open", url),
  closeArticle: () => ipcRenderer.invoke("article:close")
});
