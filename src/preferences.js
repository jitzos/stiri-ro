const REFRESH_INTERVALS = [5, 10, 15, 30, 60];
const THEMES = ["system", "light", "dark"];
const FONT_SIZES = ["small", "normal", "large"];
const DENSITIES = ["compact", "comfortable"];

const DEFAULT_PREFERENCES = Object.freeze({
  notificationsEnabled: true,
  notificationSourceIds: [],
  notificationCategoryIds: [],
  notificationKeywords: "",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  refreshIntervalMinutes: 10,
  trayRefreshIntervalMinutes: 5,
  hiddenSourceIds: [],
  favoriteSourceIds: [],
  sourceOrder: [],
  theme: "system",
  fontSize: "normal",
  density: "comfortable"
});

function allowedUnique(values, allowed) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => allowed.has(value)))];
}

function validTime(value, fallback) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function normalizePreferences(input = {}, sourceIds = [], categoryIds = []) {
  const sourceSet = new Set(sourceIds);
  const categorySet = new Set(categoryIds);
  const sourceOrder = allowedUnique(input.sourceOrder, sourceSet);
  for (const id of sourceIds) {
    if (!sourceOrder.includes(id)) sourceOrder.push(id);
  }

  return {
    notificationsEnabled: input.notificationsEnabled !== false,
    notificationSourceIds: allowedUnique(input.notificationSourceIds, sourceSet),
    notificationCategoryIds: allowedUnique(input.notificationCategoryIds, categorySet),
    notificationKeywords: typeof input.notificationKeywords === "string"
      ? input.notificationKeywords.trim().slice(0, 500)
      : DEFAULT_PREFERENCES.notificationKeywords,
    quietHoursEnabled: input.quietHoursEnabled === true,
    quietHoursStart: validTime(input.quietHoursStart, DEFAULT_PREFERENCES.quietHoursStart),
    quietHoursEnd: validTime(input.quietHoursEnd, DEFAULT_PREFERENCES.quietHoursEnd),
    refreshIntervalMinutes: REFRESH_INTERVALS.includes(Number(input.refreshIntervalMinutes))
      ? Number(input.refreshIntervalMinutes)
      : DEFAULT_PREFERENCES.refreshIntervalMinutes,
    trayRefreshIntervalMinutes: REFRESH_INTERVALS.includes(Number(input.trayRefreshIntervalMinutes))
      ? Number(input.trayRefreshIntervalMinutes)
      : DEFAULT_PREFERENCES.trayRefreshIntervalMinutes,
    hiddenSourceIds: allowedUnique(input.hiddenSourceIds, sourceSet),
    favoriteSourceIds: allowedUnique(input.favoriteSourceIds, sourceSet),
    sourceOrder,
    theme: THEMES.includes(input.theme) ? input.theme : DEFAULT_PREFERENCES.theme,
    fontSize: FONT_SIZES.includes(input.fontSize) ? input.fontSize : DEFAULT_PREFERENCES.fontSize,
    density: DENSITIES.includes(input.density) ? input.density : DEFAULT_PREFERENCES.density
  };
}

function orderedSources(sources, preferences) {
  const order = new Map(preferences.sourceOrder.map((id, index) => [id, index]));
  const favorites = new Set(preferences.favoriteSourceIds);
  return [...sources].sort((a, b) => {
    const favoriteDifference = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
    return favoriteDifference || (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity);
  });
}

module.exports = {
  DEFAULT_PREFERENCES,
  DENSITIES,
  FONT_SIZES,
  REFRESH_INTERVALS,
  THEMES,
  normalizePreferences,
  orderedSources
};
