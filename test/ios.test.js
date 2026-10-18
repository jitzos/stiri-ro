const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");

test("native iOS catalog contains the same 24 publishers", () => {
  const models = fs.readFileSync(path.join(root, "ios", "StiriRO", "Models.swift"), "utf8");
  const sourceEntries = models.match(/source\("[^"]+",/g) || [];
  assert.equal(sourceEntries.length, 24);
});

test("iOS articles open in an in-app WKWebView", () => {
  const reader = fs.readFileSync(path.join(root, "ios", "StiriRO", "ArticleReader.swift"), "utf8");
  assert.match(reader, /WKWebView/);
  assert.match(reader, /allowsBackForwardNavigationGestures = true/);
});

test("Codemagic creates an unsigned IPA for Sideloadly", () => {
  const workflow = fs.readFileSync(path.join(root, "codemagic.yaml"), "utf8");
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(workflow, /StiriRO-unsigned\.ipa/);
  assert.match(workflow, /iphoneos/);
});


test("iOS groups at most five news notifications with six-hour cooldown", () => {
  const store = fs.readFileSync(path.join(root, "ios", "StiriRO", "NewsStore.swift"), "utf8");
  assert.match(store, /notificationInterval:\s*TimeInterval\s*=\s*6\s*\*\s*60\s*\*\s*60/);
  assert.match(store, /notificationLimit\s*=\s*5/);
  assert.match(store, /pendingNotifications/);
  assert.match(store, /lastNotificationAt/);
  assert.match(store, /timeIntervalSince\(lastNotificationAt\)/);
  assert.match(store, /joined\(separator: "\\n"\)/);
});

test("iOS version matches the Windows version and is visible in the interface", () => {
  const windows = require("../package.json").version;
  const project = fs.readFileSync(path.join(root, "ios", "project.yml"), "utf8");
  const content = fs.readFileSync(path.join(root, "ios", "StiriRO", "ContentView.swift"), "utf8");
  const settings = fs.readFileSync(path.join(root, "ios", "StiriRO", "SettingsView.swift"), "utf8");
  assert.match(project, new RegExp(`MARKETING_VERSION: ${windows.replaceAll(".", "\\.")}`));
  assert.match(content, /AppVersion\.number/);
  assert.match(settings, /AppVersion\.number/);
});

test("native iOS has historical news, local filtering, muted topics and daily digest", () => {
  const store = fs.readFileSync(path.join(root, "ios", "StiriRO", "NewsStore.swift"), "utf8");
  const view = fs.readFileSync(path.join(root, "ios", "StiriRO", "ContentView.swift"), "utf8");
  for (const keyword of ["articleHistory", "showHistoryOnly", "showLocalOnly", "isMuted", "dailyDigest", "mergeHistory"]) {
    assert.ok(store.includes(keyword), `missing iOS behavior: ${keyword}`);
  }
  assert.match(view, /DigestSheet/);
  assert.match(view, /historyStartDate/);
  assert.match(view, /historyEndDate/);
});

test("iOS includes weather, backup and source ordering", () => {
  const weather = fs.readFileSync(path.join(root, "ios", "StiriRO", "WeatherService.swift"), "utf8");
  const store = fs.readFileSync(path.join(root, "ios", "StiriRO", "NewsStore.swift"), "utf8");
  const settings = fs.readFileSync(path.join(root, "ios", "StiriRO", "SettingsView.swift"), "utf8");
  const plist = fs.readFileSync(path.join(root, "ios", "StiriRO", "Info.plist"), "utf8");
  assert.match(weather, /api.open-meteo.com/);
  assert.match(weather, /forecast_days/);
  assert.match(store, /func makeBackup/);
  assert.match(store, /func restoreBackup/);
  assert.match(settings, /\.onMove\(perform: store.moveSources\)/);
  assert.match(plist, /NSLocationWhenInUseUsageDescription/);
});

test("iOS preference decoding remains backward compatible", () => {
  const models = fs.readFileSync(path.join(root, "ios", "StiriRO", "Models.swift"), "utf8");
  assert.match(models, /init\(from decoder: Decoder\) throws/);
  assert.match(models, /decodeIfPresent/);
});
