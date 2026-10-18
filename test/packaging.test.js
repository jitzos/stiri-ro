const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");

test("Windows packaging produces an assisted NSIS installer", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  assert.equal(packageJson.scripts["package:win"], "node scripts/build-windows.js");
  assert.equal(packageJson.dependencies["electron-updater"].startsWith("^6."), true);
  assert.equal(packageJson.build.nsis.oneClick, false);
  assert.equal(packageJson.build.nsis.include, "build/installer.nsh");
  assert.equal(packageJson.build.win.icon, "build/icon.ico");
  assert.equal(packageJson.build.win.artifactName, "StiriRO-Setup-${version}.${ext}");
  assert.deepEqual(packageJson.build.publish, [{
    provider: "github",
    owner: "jitzos",
    repo: "stiri-ro",
    releaseType: "release"
  }]);
});

test("release build is bound to the real GitHub update channel", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const buildScript = fs.readFileSync(path.join(root, "scripts", "build-windows.js"), "utf8");

  assert.equal(packageJson.build.publish[0].provider, "github");
  assert.equal(packageJson.build.publish[0].owner, "jitzos");
  assert.equal(packageJson.build.publish[0].repo, "stiri-ro");
  assert.match(buildScript, /Platform\.WINDOWS.*nsis/s);
});

test("app exposes check, download and install update actions", () => {
  const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(root, "src", "preload.js"), "utf8");

  assert.match(main, /autoUpdater\.checkForUpdates/);
  assert.match(main, /autoUpdater\.downloadUpdate/);
  assert.match(main, /autoUpdater\.quitAndInstall/);
  assert.match(preload, /updates:get-status/);
  assert.match(preload, /updates:status/);
});

test("masthead displays the runtime application version", () => {
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");

  assert.match(html, /id="appVersion"/);
  assert.doesNotMatch(html, /v0\.0\.1/);
  assert.match(renderer, /appVersion\.textContent = `v\$\{status\.currentVersion\}`/);
});

test("settings expose persistent native notification controls", () => {
  const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(root, "src", "preload.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");

  assert.match(main, /new Notification/);
  assert.match(main, /settings:get-preferences/);
  assert.match(main, /settings:update-preferences/);
  assert.match(preload, /settings:get-preferences/);
  assert.match(preload, /settings:update-preferences/);
  assert.match(html, /id="notificationsToggle"/);
  assert.match(html, /id="quietHoursToggle"/);
  assert.match(html, /id="notificationSourceOptions"/);
});

test("reader settings include refresh, sources, saved articles, unread and appearance controls", () => {
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");

  for (const id of ["refreshInterval", "trayRefreshInterval", "sourceManager", "savedFilterButton", "unreadFilterButton", "themeSelect", "fontSizeSelect", "densitySelect"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(renderer, /savedArticles/);
  assert.match(renderer, /seenArticles/);
  assert.match(renderer, /openArticle\(article\.link\)/);
});

test("feed includes a Romanian back-to-top control", () => {
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

  assert.match(html, /id="backToTopButton"[\s\S]*Înapoi sus/);
  assert.match(renderer, /window\.scrollTo\(\{ top: 0, behavior: preferredScrollBehavior\(\) \}\)/);
  assert.match(renderer, /prefers-reduced-motion/);
  assert.match(styles, /\.back-to-top[\s\S]*position: fixed/);
  assert.match(styles, /\.back-to-top[\s\S]*right: 10px[\s\S]*background: #c83e35/);
});

test("settings include their own Romanian back-to-top control", () => {
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

  assert.match(html, /id="settingsBackToTopButton"[\s\S]*Înapoi sus/);
  assert.match(renderer, /settingsCard\.scrollTo\(\{ top: 0, behavior: preferredScrollBehavior\(\) \}\)/);
  assert.match(renderer, /settingsCard\.addEventListener\("scroll"/);
  assert.match(styles, /\.settings-back-to-top[\s\S]*position: absolute/);
  assert.match(styles, /\.settings-back-to-top[\s\S]*right: 8px[\s\S]*background: #c83e35/);
});

test("header refresh button opens synchronized refresh options", () => {
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");

  for (const id of ["refreshMenu", "refreshNowButton", "quickRefreshInterval", "quickTrayRefreshInterval"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Opțiuni de actualizare/);
  assert.match(renderer, /setRefreshMenuOpen/);
  assert.match(renderer, /quickRefreshInterval\.value = String\(preferences\.refreshIntervalMinutes\)/);
  assert.match(renderer, /quickTrayRefreshInterval\.value = String\(preferences\.trayRefreshIntervalMinutes\)/);
});

test("masthead is compact and filter groups stay on one horizontal row", () => {
  const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

  assert.match(styles, /\.masthead[\s\S]*padding: 16px/);
  assert.match(styles, /#sourceFilters,[\s\S]*#categoryFilters[\s\S]*flex-wrap: nowrap/);
  assert.match(styles, /#sourceFilters,[\s\S]*#categoryFilters[\s\S]*overflow-x: auto/);
});

test("local weather supports first-run geolocation, manual location and an off switch", () => {
  const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(root, "src", "preload.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src", "renderer.js"), "utf8");

  for (const id of ["weatherWidget", "weatherForecast", "todayForecastTab", "fiveDayForecastTab", "weatherTodayForecast", "weatherForecastDays", "weatherEnabledToggle", "automaticWeatherMode", "manualWeatherMode", "useCurrentLocationButton", "manualLocationInput", "saveManualLocationButton"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(main, /permission === "geolocation"/);
  assert.match(main, /ipcMain\.handle\("weather:get"/);
  assert.match(preload, /weather:get/);
  assert.match(renderer, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(renderer, /weatherLocationRequested/);
  assert.match(renderer, /weatherLocationMode !== "automatic"/);
  assert.match(renderer, /weatherLocationMode !== "manual"/);
  assert.match(renderer, /Intl\.DateTimeFormat\("ro-RO"/);
  assert.match(renderer, /setWeatherForecastOpen/);
  assert.match(renderer, /setWeatherForecastView/);
  assert.match(renderer, /addTodayDetail\(details, "Umiditate"/);
  assert.match(main, /fetchForecast/);
});

test("startup is managed only by the app and removed on uninstall", () => {
  const installer = fs.readFileSync(path.join(root, "build", "installer.nsh"), "utf8");
  const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");

  assert.doesNotMatch(installer, /WriteRegStr HKCU/);
  assert.doesNotMatch(installer, /StartAtLoginCheckbox/);
  assert.match(installer, /customUnInstall[\s\S]*DeleteRegValue HKCU/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /second-instance/);
  assert.match(main, /LEGACY_LOGIN_ITEM_NAME/);
  assert.match(main, /name,\s*path: process\.execPath,\s*args: LOGIN_ARGS/);
});
