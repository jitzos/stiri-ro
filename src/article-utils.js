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

  return { articleText, buildDailyDigest, isLocalArticle, isMutedArticle, locationTerms, mergeArticleHistory, normalizeText, parseKeywords };
});
