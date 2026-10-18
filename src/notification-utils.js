const MAX_KNOWN_ARTICLES = 2_000;
const NOTIFICATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_NOTIFICATION_ARTICLES = 5;

function queueNotificationArticles(pending, incoming) {
  const byId = new Map();
  for (const article of [...pending, ...incoming]) {
    if (typeof article?.id === "string" && article.id) byId.set(article.id, article);
  }
  const dateOf = (article) => Date.parse(article.publishedAt || "") || 0;
  return [...byId.values()]
    .sort((a, b) => dateOf(b) - dateOf(a))
    .slice(0, MAX_NOTIFICATION_ARTICLES);
}

function isNotificationBatchDue(lastSentAt, preferences, now = new Date()) {
  return preferences.notificationsEnabled
    && !isQuietTime(preferences, now)
    && Number.isFinite(lastSentAt)
    && now.getTime() - lastSentAt >= NOTIFICATION_INTERVAL_MS;
}

function collectNewArticles(articles, knownArticleIds, baselineReady) {
  const newArticles = baselineReady
    ? articles.filter((article) => !knownArticleIds.has(article.id))
    : [];

  for (const article of articles) knownArticleIds.add(article.id);
  while (knownArticleIds.size > MAX_KNOWN_ARTICLES) {
    knownArticleIds.delete(knownArticleIds.values().next().value);
  }

  return newArticles;
}

function buildNotificationContent(articles) {
  const selected = articles.slice(0, MAX_NOTIFICATION_ARTICLES);
  return {
    title: selected.length === 1 ? "Știre nouă" : `${selected.length} știri noi`,
    body: selected.map((article) => `${article.sourceName}: ${article.title}`).join("\n")
  };
}

function isQuietTime(preferences, now = new Date()) {
  if (!preferences.quietHoursEnabled) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = preferences.quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = preferences.quietHoursEnd.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function filterNotificationArticles(articles, preferences) {
  if (!preferences.notificationsEnabled) return [];
  const sourceIds = new Set(preferences.notificationSourceIds);
  const categoryIds = new Set(preferences.notificationCategoryIds);
  const keywords = preferences.notificationKeywords
    .split(",")
    .map((keyword) => keyword.trim().toLocaleLowerCase("ro"))
    .filter(Boolean);

  return articles.filter((article) => {
    if (sourceIds.size && !sourceIds.has(article.sourceId)) return false;
    if (categoryIds.size && !categoryIds.has(article.categoryId)) return false;
    if (!keywords.length) return true;
    const text = `${article.title} ${article.excerpt || ""}`.toLocaleLowerCase("ro");
    return keywords.some((keyword) => text.includes(keyword));
  });
}

module.exports = {
  MAX_NOTIFICATION_ARTICLES,
  NOTIFICATION_INTERVAL_MS,
  buildNotificationContent,
  collectNewArticles,
  filterNotificationArticles,
  isNotificationBatchDue,
  isQuietTime,
  queueNotificationArticles
};
