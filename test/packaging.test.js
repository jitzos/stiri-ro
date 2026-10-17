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

test("installer offers login startup and removes it on uninstall", () => {
  const installer = fs.readFileSync(path.join(root, "build", "installer.nsh"), "utf8");

  assert.match(installer, /Pornește Știri RO când mă conectez la Windows/);
  assert.match(installer, /FileExists.*APP_PRODUCT_FILENAME/);
  assert.doesNotMatch(installer, /isUpdated/);
  assert.doesNotMatch(installer, /MUI_HEADER_TEXT/);
  assert.match(installer, /WriteRegStr HKCU .*CurrentVersion\\Run/);
  assert.match(installer, /--hidden/);
  assert.match(installer, /customUnInstall[\s\S]*DeleteRegValue HKCU/);
});
