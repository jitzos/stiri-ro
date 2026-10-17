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
  assert.equal(packageJson.build.win.artifactName, "StiriRO-Setup-${version}.${ext}");
  assert.deepEqual(packageJson.build.publish, [{
    provider: "github",
    owner: "jitzos",
    repo: "stiri-ro",
    releaseType: "release"
  }]);
});

test("release build is bound to the real GitHub update channel", () => {
  const buildScript = fs.readFileSync(path.join(root, "scripts", "build-windows.js"), "utf8");

  assert.match(buildScript, /STIRIRO_GITHUB_OWNER/);
  assert.match(buildScript, /STIRIRO_GITHUB_REPO/);
  assert.match(buildScript, /\|\| "jitzos"/);
  assert.match(buildScript, /\|\| "stiri-ro"/);
  assert.match(buildScript, /provider: "github"/);
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

test("installer offers login startup and removes it on uninstall", () => {
  const installer = fs.readFileSync(path.join(root, "build", "installer.nsh"), "utf8");

  assert.match(installer, /Pornește Știri RO când mă conectez la Windows/);
  assert.match(installer, /WriteRegStr HKCU .*CurrentVersion\\Run/);
  assert.match(installer, /--hidden/);
  assert.match(installer, /customUnInstall[\s\S]*DeleteRegValue HKCU/);
});
