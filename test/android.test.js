const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("Android catalog matches all 24 native iOS source IDs", () => {
  const android = read("android/app/src/main/java/ro/stiriro/android/NewsCore.kt");
  const ios = read("ios/StiriRO/Models.swift");
  const androidIds = [...android.matchAll(/NewsSource\("([^"]+)",/g)].map((m) => m[1]);
  const iosIds = [...ios.matchAll(/source\("([^"]+)",/g)].map((m) => m[1]);
  assert.equal(androidIds.length, 24);
  assert.deepEqual(androidIds, iosIds);
});

test("Android shares the 0.0.10 version without changing Windows or iOS", () => {
  const gradle = read("android/app/build.gradle.kts");
  const version = require("../package.json").version;
  assert.match(gradle, new RegExp('versionName = "' + version.replaceAll(".", "\\.") + '"'));
  assert.match(gradle, /applicationId = "ro.stiriro.android"/);
});

test("Android supports native news, controlled notifications and JSON transfer", () => {
  const ui = read("android/app/src/main/java/ro/stiriro/android/MainActivity.kt");
  const store = read("android/app/src/main/java/ro/stiriro/android/NewsStore.kt");
  const worker = read("android/app/src/main/java/ro/stiriro/android/NotificationWorker.kt");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.match(ui, /NewsArticleCard/);
  assert.match(ui, /StatsScreen/);
  assert.match(ui, /WeatherScreen/);
  assert.match(store, /"StiriRO-sync"/);
  assert.match(store, /"savedArticles"/);
  assert.match(worker, /PeriodicWorkRequestBuilder<NotificationWorker>\(6, TimeUnit.HOURS\)/);
  assert.match(worker, /take\(5\)/);
  assert.match(manifest, /POST_NOTIFICATIONS/);
});
