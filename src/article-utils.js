(function exposeArticleUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.articleUtils = api;
})(typeof window !== "undefined" ? window : null, () => {
  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro");
  }

  function articleText(article) {
    return normalizeText(`${article?.title || ""} ${article?.excerpt || ""}`);
  }

  function parseKeywords(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    return [...new Set(values.map((item) => String(item).trim().slice(0, 80)).filter(Boolean))].slice(0, 100);
  }

  function isMutedArticle(article, keywords) {
    const text = articleText(article);
    return parseKeywords(keywords).some((keyword) => text.includes(normalizeText(keyword)));
  }

  function locationTerms(location) {
    const name = normalizeText(location?.name);
    if (!name) return [];
    const primary = name.split(",")[0].trim();
    const aliases = { bucharest: "bucuresti" };
    return [...new Set([primary, aliases[primary], ...primary.split(/[\s-]+/)].filter((term) => term?.length >= 4))];
  }

  function isLocalArticle(article, location) {
    const terms = locationTerms(location);
    const text = articleText(article);
    return terms.length > 0 && terms.some((term) => text.includes(term));
  }

  function mergeArticleHistory(existing, incoming, maximum = 2_000) {
    const byId = new Map();
    for (const article of [...incoming, ...existing]) {
      if (article?.id && !byId.has(article.id)) byId.set(article.id, article);
    }
    return [...byId.values()]
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
      .slice(0, maximum);
  }

  function buildDailyDigest(articles, preferences = {}, maximum = 10) {
    const favorites = new Set(preferences.favoriteSourceIds || []);
    const muted = preferences.mutedKeywords || [];
    const cutoff = Date.now() - 36 * 60 * 60 * 1_000;
    const candidates = articles
      .filter((article) => !isMutedArticle(article, muted))
      .filter((article) => !article.publishedAt || Date.parse(article.publishedAt) >= cutoff)
      .sort((a, b) => Number(favorites.has(b.sourceId)) - Number(favorites.has(a.sourceId)) || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
    const sourceCounts = new Map();
    const selected = [];
    for (const article of candidates) {
      const count = sourceCounts.get(article.sourceId) || 0;
      if (count >= 2) continue;
      selected.push(article);
      sourceCounts.set(article.sourceId, count + 1);
      if (selected.length >= maximum) break;
    }
    return selected;
  }


  function matchTopic(article, topics) {
    const text = articleText(article);
    return parseKeywords(topics).some((topic) => text.includes(normalizeText(topic)));
  }

  // Transparent editorial ranking, not a claim of independently verified importance.
  // Coverage is estimated from similar RSS headlines across distinct publishers.
  function topStories(articles, preferences = {}, maximum = 10, now = Date.now()) {
    const favorites = new Set(preferences.favoriteSourceIds || []);
    const stopWords = new Set(["pentru", "despre", "dupa", "intre", "acesta", "aceasta", "care", "sunt", "este", "din", "prin", "fost", "unui", "unei", "si", "sau", "mai", "la", "ale", "cel", "cea", "romania"]);
    const tokens = (title) => new Set(normalizeText(title).split(/[^a-z0-9]+/).filter((part) => part.length >= 4 && !stopWords.has(part)));
    const fresh = articles.filter((article) => {
      if (!article?.id || isMutedArticle(article, preferences.mutedKeywords)) return false;
      const time = Date.parse(article.publishedAt);
      return Number.isFinite(time) && time <= now + 3600_000 && now - time <= 36 * 3600_000;
    });
    const unique = [...new Map(fresh.map((a) => [a.id, a])).values()].slice(0, 1500);
    const clusters = [];
    for (const article of unique.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
      const words = tokens(article.title);
      const cluster = words.size >= 3 ? clusters.find((entry) => {
        const overlap = [...words].filter((word) => entry.words.has(word)).length;
        return overlap >= 3 && overlap / Math.min(words.size, entry.words.size) >= 0.65;
      }) : null;
      if (cluster) cluster.articles.push(article);
      else clusters.push({ words, articles: [article] });
    }
    return clusters.map((cluster) => {
      const sources = new Set(cluster.articles.map((item) => item.sourceId));
      const representative = cluster.articles.find((a) => favorites.has(a.sourceId)) || cluster.articles[0];
      const ageHours = Math.max(0, (now - Date.parse(representative.publishedAt)) / 3600_000);
      const score = Math.max(0, 36 - ageHours) + 14 * Math.min(4, sources.size - 1)
        + (favorites.has(representative.sourceId) ? 6 : 0);
      return { article: representative, sourceCount: sources.size, score: Math.round(score * 10) / 10 };
    }).sort((a, b) => b.score - a.score || Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt))
      .slice(0, Math.max(0, Math.min(10, maximum)));
  }

  function readingStats(events, articles, now = Date.now(), days = 30) {
    const since = now - days * 86400_000;
    const recent = Array.isArray(events) ? events.filter((event) => {
      const when = Date.parse(event?.at || "");
      return Number.isFinite(when) && when >= since && when <= now && typeof event.articleId === "string";
    }) : [];
    const lookup = new Map(articles.map((a) => [a.id, a]));
    const ids = new Set(recent.map((e) => e.articleId));
    const bySource = new Map(), byCategory = new Map();
    for (const id of ids) {
      const item = lookup.get(id);
      if (!item) continue;
      bySource.set(item.sourceName || item.sourceId, (bySource.get(item.sourceName || item.sourceId) || 0) + 1);
      byCategory.set(item.categoryName || item.categoryId, (byCategory.get(item.categoryName || item.categoryId) || 0) + 1);
    }
    const ranked = (map) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { opens: recent.length, uniqueArticles: ids.size, bySource: ranked(bySource), byCategory: ranked(byCategory) };
  }

  return { matchTopic, readingStats, topStories, articleText, buildDailyDigest, isLocalArticle, isMutedArticle, locationTerms, mergeArticleHistory, normalizeText, parseKeywords };
});
