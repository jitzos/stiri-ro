"use strict";

const FORMAT = 1;
const LIMIT = 10 * 1024 * 1024;
const boundedStrings = (items, count = 2000) => Array.isArray(items)
  ? [...new Set(items.filter((s) => typeof s === "string" && s.length > 0 && s.length <= 512))].slice(0, count) : [];

function syncArticle(article) {
  if (!article || typeof article !== "object" || typeof article.id !== "string" || !article.id) return null;
  const link = article.link;
  try {
    const url = new URL(link);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    return {
      id: article.id.slice(0, 512),
      title: String(article.title || "").slice(0, 500),
      link: url.toString(),
      excerpt: String(article.excerpt || "").slice(0, 1000),
      publishedAt: Number.isFinite(Date.parse(article.publishedAt)) ? new Date(article.publishedAt).toISOString() : new Date(0).toISOString(),
      imageURL: typeof article.imageURL === "string" && /^https?:\/\//i.test(article.imageURL) ? article.imageURL : null,
      sourceID: String(article.sourceID || "").slice(0, 80),
      sourceName: String(article.sourceName || "").slice(0, 120),
      categoryID: String(article.categoryID || "").slice(0, 80)
    };
  } catch { return null; }
}

function fromWindows(article) {
  return syncArticle({
    ...article, sourceID: article.sourceId, categoryID: article.categoryId,
    imageURL: article.image || article.imageURL || null
  });
}

function toWindows(article) {
  const item = syncArticle(article);
  if (!item) return null;
  return {
    id: item.id, title: item.title, link: item.link, excerpt: item.excerpt,
    publishedAt: item.publishedAt, image: item.imageURL,
    sourceId: item.sourceID, sourceName: item.sourceName, categoryId: item.categoryID
  };
}

function normalizeSync(input) {
  if (!input || input.app !== "StiriRO-sync" || input.formatVersion !== FORMAT) throw new Error("Format de sincronizare invalid");
  const articles = Array.isArray(input.savedArticles) ? input.savedArticles.slice(0, 500) : [];
  const events = Array.isArray(input.readingEvents) ? input.readingEvents.slice(-5000) : [];
  return {
    app: "StiriRO-sync",
    formatVersion: FORMAT,
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : new Date().toISOString(),
    followedTopics: boundedStrings(input.followedTopics, 20).map((x) => x.slice(0, 80)),
    favoriteSourceIDs: boundedStrings(input.favoriteSourceIDs, 100),
    hiddenSourceIDs: boundedStrings(input.hiddenSourceIDs, 100),
    readIDs: boundedStrings(input.readIDs),
    savedArticles: [...new Map(articles.map(syncArticle).filter(Boolean).map((a) => [a.id, a])).values()],
    readingEvents: [...new Map(events.filter((e) => e && typeof e.id === "string" && typeof e.articleId === "string" && Number.isFinite(Date.parse(e.at))).map((e) => [e.id, {
      id: e.id.slice(0, 100), articleId: e.articleId.slice(0, 512), at: new Date(e.at).toISOString()
    }])).values()]
  };
}
function parseSync(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > LIMIT) throw new Error("Fișier prea mare");
  return normalizeSync(JSON.parse(text));
}

function makeSync(data) {
  return normalizeSync({
    app: "StiriRO-sync", formatVersion: FORMAT, exportedAt: new Date().toISOString(),
    followedTopics: data.followedTopics,
    favoriteSourceIDs: data.favoriteSourceIDs, hiddenSourceIDs: data.hiddenSourceIDs,
    readIDs: data.readIDs,
    savedArticles: Array.isArray(data.savedArticles) ? data.savedArticles.map(fromWindows).filter(Boolean) : [],
    readingEvents: data.readingEvents
  });
}

module.exports = { fromWindows, makeSync, normalizeSync, parseSync, toWindows };
