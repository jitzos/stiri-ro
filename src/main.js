const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, session, shell, Tray, WebContentsView } = require("electron");
const { autoUpdater } = require("electron-updater");
const { SOURCES, CATEGORIES, fetchAllFeeds } = require("./feeds");
const {
  buildNotificationContent,
  collectNewArticles,
  filterNotificationArticles
} = require("./notification-utils");
const { normalizePreferences, orderedSources } = require("./preferences");
const { fetchForecast, fetchWeather } = require("./weather");
const { buildDailyDigest, isMutedArticle } = require("./article-utils");

let mainWindow = null;
let tray = null;
let refreshTimer = null;
let refreshInFlight = null;
let latestFeed = null;
let minimizeToTray = true;
let isQuitting = false;
let articleView = null;
let feedBaselineReady = false;
let refreshMode = "foreground";
const knownArticleIds = new Set();

const ARTICLE_TOOLBAR_HEIGHT = 58;
const LOGIN_ARGS = ["--hidden"];
const LOGIN_ITEM_NAME = "ro.stiriro.desktop";
const LEGACY_LOGIN_ITEM_NAME = "Știri RO";
const startHidden = process.argv.includes("--hidden");
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let updateTimer = null;
let updateState = {
  supported: false,
  phase: "idle",
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: null,
  message: "Actualizările sunt disponibile în versiunea instalată."
};
const sourceIds = SOURCES.map(({ id }) => id);
const categoryIds = CATEGORIES.map(({ id }) => id);
let preferences = normalizePreferences({}, sourceIds, categoryIds);

function preferencesPath() {
  return path.join(app.getPath("userData"), "preferences.json");
}

function loadPreferences() {
  try {
    const stored = JSON.parse(fs.readFileSync(preferencesPath(), "utf8"));
    return normalizePreferences(stored, sourceIds, categoryIds);
  } catch {
    return normalizePreferences({}, sourceIds, categoryIds);
  }
}

function savePreferences(patch) {
  preferences = normalizePreferences({ ...preferences, ...patch }, sourceIds, categoryIds);
  fs.mkdirSync(path.dirname(preferencesPath()), { recursive: true });
  fs.writeFileSync(preferencesPath(), `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
  return preferences;
}

function loginItemSettings(name = LOGIN_ITEM_NAME) {
  return {
    name,
    path: process.execPath,
    args: LOGIN_ARGS
  };
}

function migrateLegacyLoginItem() {
  if (process.platform !== "win32" || !app.isPackaged) return;

  const { launchItems = [] } = app.getLoginItemSettings(loginItemSettings());
  const legacyItem = launchItems.find(({ name }) => name === LEGACY_LOGIN_ITEM_NAME);
  if (!legacyItem) return;

  if (legacyItem.enabled) {
    app.setLoginItemSettings({
      ...loginItemSettings(),
      openAtLogin: true
    });
  }

  app.setLoginItemSettings({
    ...loginItemSettings(LEGACY_LOGIN_ITEM_NAME),
    openAtLogin: false
  });
}

function notifyAboutNewArticles(articles) {
  const newArticles = collectNewArticles(articles, knownArticleIds, feedBaselineReady);
  feedBaselineReady = true;
  const notificationArticles = filterNotificationArticles(newArticles.filter((article) => !isMutedArticle(article, preferences.mutedKeywords)), preferences);
  if (!Notification.isSupported() || notificationArticles.length === 0) return;

  const notification = new Notification(buildNotificationContent(notificationArticles));
  notification.on("click", showWindow);
  notification.show();
}

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updates:status", updateState);
  }
  return updateState;
}

async function checkForUpdates() {
  if (!updateState.supported) return updateState;
  publishUpdateState({ phase: "checking", percent: null, message: "Se caută actualizări…" });
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    publishUpdateState({ phase: "error", message: "Verificarea actualizărilor nu a reușit." });
  }
  return updateState;
}

function initializeUpdater() {
  const supported = process.platform === "win32" && app.isPackaged;
  publishUpdateState({
    supported,
    message: supported
      ? `Versiunea ${app.getVersion()} este instalată.`
      : "Actualizările sunt disponibile în versiunea instalată pe Windows."
  });
  if (!supported) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("update-available", (info) => publishUpdateState({
    phase: "available",
    availableVersion: info.version,
    percent: null,
    message: `Versiunea ${info.version} este disponibilă.`
  }));
  autoUpdater.on("update-not-available", () => publishUpdateState({
    phase: "current",
    availableVersion: null,
    percent: null,
    message: `Versiunea ${app.getVersion()} este la zi.`
  }));
  autoUpdater.on("download-progress", (progress) => publishUpdateState({
    phase: "downloading",
    percent: Math.round(progress.percent),
    message: `Se descarcă actualizarea… ${Math.round(progress.percent)}%`
  }));
  autoUpdater.on("update-downloaded", (info) => publishUpdateState({
    phase: "downloaded",
    availableVersion: info.version,
    percent: 100,
    message: `Versiunea ${info.version} este pregătită pentru instalare.`
  }));
  autoUpdater.on("error", () => publishUpdateState({
    phase: "error",
    percent: null,
    message: "Actualizarea nu a reușit. Încearcă din nou mai târziu."
  }));

  setTimeout(() => checkForUpdates(), 12_000);
  updateTimer = setInterval(() => checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
}

function isSafeArticleUrl(url) {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function layoutArticleView() {
  if (!articleView || !mainWindow || mainWindow.isDestroyed()) return;
  const [width, height] = mainWindow.getContentSize();
  articleView.setBounds({
    x: 0,
    y: ARTICLE_TOOLBAR_HEIGHT,
    width,
    height: Math.max(0, height - ARTICLE_TOOLBAR_HEIGHT)
  });
}

function closeArticleView() {
  if (!articleView) return;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(articleView);
  if (!articleView.webContents.isDestroyed()) articleView.webContents.close();
  articleView = null;
}

async function openArticleView(url) {
  if (!isSafeArticleUrl(url) || !mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Adresă invalidă");
  }

  closeArticleView();
  articleView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  articleView.setBackgroundColor("#f4f1ea");
  articleView.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isSafeArticleUrl(nextUrl)) articleView?.webContents.loadURL(nextUrl).catch(() => {});
    return { action: "deny" };
  });
  articleView.webContents.on("will-navigate", (event, nextUrl) => {
    if (!isSafeArticleUrl(nextUrl)) event.preventDefault();
  });

  mainWindow.contentView.addChildView(articleView);
  layoutArticleView();
  await articleView.webContents.loadURL(url);
  return true;
}

function scheduleRefresh(mode = refreshMode) {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshMode = mode;
  const minutes = mode === "tray"
    ? preferences.trayRefreshIntervalMinutes
    : preferences.refreshIntervalMinutes;
  refreshTimer = setInterval(() => refreshFeeds().catch(() => {}), minutes * 60 * 1000);
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  scheduleRefresh("foreground");
}

async function refreshFeeds() {
  if (refreshInFlight) return refreshInFlight;

  const hiddenSourceIds = new Set(preferences.hiddenSourceIds);
  const activeSources = orderedSources(SOURCES, preferences).filter(({ id }) => !hiddenSourceIds.has(id));
  refreshInFlight = fetchAllFeeds(activeSources)
    .then((result) => {
      notifyAboutNewArticles(result.articles);
      latestFeed = result;
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send("feeds:updated", result);
      }
      tray?.setToolTip(`Știri RO · actualizat ${new Date(result.fetchedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`);
      return result;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Știri RO");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Deschide Știri RO", click: showWindow },
    { label: "Actualizează acum", click: () => refreshFeeds().catch(() => {}) },
    { type: "separator" },
    {
      label: "Ieșire",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on("click", showWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: "#f4f1ea",
    title: `Știri RO ${app.getVersion()}`,
    show: !startHidden,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "tray-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (latestFeed) mainWindow.webContents.send("feeds:updated", latestFeed);
  });

  mainWindow.on("resize", layoutArticleView);

  mainWindow.on("minimize", (event) => {
    if (!minimizeToTray) return;
    event.preventDefault();
    mainWindow.hide();
    scheduleRefresh("tray");
  });

  mainWindow.on("close", (event) => {
    if (isQuitting || !minimizeToTray) return;
    event.preventDefault();
    mainWindow.hide();
    scheduleRefresh("tray");
  });

  mainWindow.on("closed", () => {
    closeArticleView();
    mainWindow = null;
  });
}

ipcMain.handle("feeds:list", () => orderedSources(SOURCES, preferences).map(({ feedUrl, ...source }) => source));
ipcMain.handle("categories:list", () => CATEGORIES);
ipcMain.handle("feeds:refresh", () => refreshFeeds());
ipcMain.handle("digest:create", () => buildDailyDigest(latestFeed?.articles || [], preferences));
ipcMain.handle("backup:export", async (_event, localData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Exportă backup Știri RO",
    defaultPath: `StiriRO-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Backup Știri RO", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  const backup = {
    app: "Știri RO",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    preferences,
    minimizeToTray: localData?.minimizeToTray !== false,
    savedArticles: Array.isArray(localData?.savedArticles) ? localData.savedArticles.slice(-500) : [],
    seenArticles: Array.isArray(localData?.seenArticles) ? localData.seenArticles.slice(-2_000) : [],
    articleHistory: Array.isArray(localData?.articleHistory) ? localData.articleHistory.slice(0, 2_000) : []
  };
  try {
    fs.writeFileSync(result.filePath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
    return { ok: true };
  } catch {
    return { ok: false, canceled: false, message: "Backupul nu a putut fi scris." };
  }
});
ipcMain.handle("backup:import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Restaurează backup Știri RO",
    properties: ["openFile"],
    filters: [{ name: "Backup Știri RO", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
  try {
    const filePath = result.filePaths[0];
    if (fs.statSync(filePath).size > 10 * 1024 * 1024) throw new Error("Backup prea mare");
    const backup = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (backup?.app !== "Știri RO" || backup?.formatVersion !== 1) throw new Error("Format invalid");
    return { ok: true, backup };
  } catch {
    return { ok: false, canceled: false, message: "Fișierul de backup nu este valid." };
  }
});
ipcMain.handle("weather:get", async (_event, location) => {
  try {
    const weather = await fetchWeather(location);
    try {
      weather.forecast = await fetchForecast(weather.location);
    } catch {
      weather.forecast = [];
    }
    return { ok: true, weather };
  } catch {
    return { ok: false, message: "Vremea nu a putut fi încărcată." };
  }
});
ipcMain.handle("settings:minimize-to-tray", (_event, enabled) => {
  minimizeToTray = Boolean(enabled);
  if (!minimizeToTray || mainWindow?.isVisible()) scheduleRefresh("foreground");
  return minimizeToTray;
});
ipcMain.handle("settings:get-start-at-login", () => {
  const supported = process.platform === "win32" && app.isPackaged;
  return {
    supported,
    enabled: supported
      ? app.getLoginItemSettings(loginItemSettings()).openAtLogin
      : false
  };
});
ipcMain.handle("settings:set-start-at-login", (_event, enabled) => {
  const supported = process.platform === "win32" && app.isPackaged;
  if (!supported) return { supported, enabled: false };

  app.setLoginItemSettings({
    ...loginItemSettings(),
    openAtLogin: Boolean(enabled),
  });

  return {
    supported,
    enabled: app.getLoginItemSettings(loginItemSettings()).openAtLogin
  };
});
ipcMain.handle("settings:get-preferences", () => ({
  ...preferences,
  notificationsSupported: Notification.isSupported()
}));
ipcMain.handle("settings:update-preferences", (_event, patch) => {
  const updated = savePreferences(patch && typeof patch === "object" ? patch : {});
  scheduleRefresh(refreshMode);
  return {
    ...updated,
    notificationsSupported: Notification.isSupported()
  };
});
ipcMain.handle("updates:get-status", () => updateState);
ipcMain.handle("updates:check", () => checkForUpdates());
ipcMain.handle("updates:download", async () => {
  if (!updateState.supported || updateState.phase !== "available") return updateState;
  publishUpdateState({ phase: "downloading", percent: 0, message: "Se începe descărcarea…" });
  try {
    await autoUpdater.downloadUpdate();
  } catch {
    publishUpdateState({ phase: "error", percent: null, message: "Descărcarea actualizării nu a reușit." });
  }
  return updateState;
});
ipcMain.handle("updates:install", () => {
  if (!updateState.supported || updateState.phase !== "downloaded") return false;
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
  return true;
});
ipcMain.handle("article:open", (_event, url) => openArticleView(url));
ipcMain.handle("article:close", () => {
  closeArticleView();
  return true;
});

app.setAppUserModelId("ro.stiriro.desktop");

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    if (!commandLine.includes("--hidden")) showWindow();
  });

  app.whenReady().then(() => {
    migrateLegacyLoginItem();
    preferences = loadPreferences();
    refreshMode = startHidden ? "tray" : "foreground";
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === "geolocation" && webContents === mainWindow?.webContents);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(permission === "geolocation" && webContents === mainWindow?.webContents);
    });
    createTray();
    createWindow();
    scheduleRefresh(refreshMode);
    initializeUpdater();
    app.on("activate", showWindow);
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  if (refreshTimer) clearInterval(refreshTimer);
  if (updateTimer) clearInterval(updateTimer);
});

app.on("window-all-closed", () => {
  if (!minimizeToTray && process.platform !== "darwin") app.quit();
});
