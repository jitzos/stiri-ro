const MAX_KNOWN_ARTICLES = 2_000;

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
  if (articles.length === 1) {
    const article = articles[0];
    return {
      title: "Știre nouă",
      body: `${article.sourceName}: ${article.title}`
    };
  }

  return {
    title: `${articles.length} știri noi`,
    body: `${articles[0].title} · și încă ${articles.length - 1}`
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
  if (!preferences.notificationsEnabled || isQuietTime(preferences)) return [];
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

module.exports = { buildNotificationContent, collectNewArticles, filterNotificationArticles, isQuietTime };
