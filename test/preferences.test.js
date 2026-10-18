const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePreferences, orderedSources } = require("../src/preferences");

const sourceIds = ["a", "b", "c"];
const categoryIds = ["actualitate", "sport"];

test("preferences reject unsupported values and complete source order", () => {
  const preferences = normalizePreferences({
    refreshIntervalMinutes: 17,
    theme: "neon",
    hiddenSourceIds: ["b", "invalid", "b"],
    sourceOrder: ["c", "invalid"]
  }, sourceIds, categoryIds);

  assert.equal(preferences.refreshIntervalMinutes, 10);
  assert.equal(preferences.theme, "system");
  assert.deepEqual(preferences.hiddenSourceIds, ["b"]);
  assert.deepEqual(preferences.sourceOrder, ["c", "a", "b"]);
});

test("favorite sources are shown first while preserving custom order", () => {
  const sources = sourceIds.map((id) => ({ id }));
  const preferences = normalizePreferences({ sourceOrder: ["c", "b", "a"], favoriteSourceIds: ["a"] }, sourceIds, categoryIds);
  assert.deepEqual(orderedSources(sources, preferences).map(({ id }) => id), ["a", "c", "b"]);
});

test("weather location is persisted only when coordinates are valid", () => {
  const valid = normalizePreferences({ weatherEnabled: true, weatherLocationRequested: true, weatherLocationMode: "manual", weatherLocation: { name: "Cluj-Napoca", latitude: 46.77, longitude: 23.59 } }, sourceIds, categoryIds);
  assert.equal(valid.weatherLocation.name, "Cluj-Napoca");
  assert.equal(valid.weatherLocationMode, "manual");
  assert.equal(valid.weatherLocationRequested, true);

  const invalid = normalizePreferences({ weatherLocation: { name: "Invalid", latitude: 200, longitude: 20 } }, sourceIds, categoryIds);
  assert.equal(invalid.weatherLocation, null);
});

test("automatic and manual weather locations are stored independently", () => {
  const automatic = { name: "Locația curentă", latitude: 44.43, longitude: 26.1 };
  const manual = { name: "Brașov", latitude: 45.65, longitude: 25.6 };
  const preferences = normalizePreferences({ weatherLocationMode: "manual", weatherAutomaticLocation: automatic, weatherManualLocation: manual }, sourceIds, categoryIds);

  assert.deepEqual(preferences.weatherAutomaticLocation, automatic);
  assert.deepEqual(preferences.weatherManualLocation, manual);
  assert.deepEqual(preferences.weatherLocation, manual);

  const switched = normalizePreferences({ ...preferences, weatherLocationMode: "automatic" }, sourceIds, categoryIds);
  assert.deepEqual(switched.weatherLocation, automatic);
});
