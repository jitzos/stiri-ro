const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDailyDigest, isLocalArticle, isMutedArticle, mergeArticleHistory } = require("../src/article-utils");

test("local news matching ignores Romanian diacritics", () => {
  assert.equal(isLocalArticle({ title: "Noutăți importante din Brașov" }, { name: "Brasov" }), true);
  assert.equal(isLocalArticle({ title: "Noutăți din Constanța" }, { name: "Brașov" }), false);
  assert.equal(isLocalArticle({ title: "Trafic aglomerat în București" }, { name: "Bucharest" }), true);
});

test("muted topics are removed by title or excerpt", () => {
  assert.equal(isMutedArticle({ title: "Horoscopul zilei" }, ["horoscop"]), true);
  assert.equal(isMutedArticle({ title: "Economie", excerpt: "Știri mondene" }, ["monden"]), true);
});

test("history merge deduplicates and keeps newest articles", () => {
  const merged = mergeArticleHistory([{ id: "a", publishedAt: "2026-01-01" }], [{ id: "b", publishedAt: "2026-02-01" }, { id: "a", publishedAt: "2026-01-01" }]);
  assert.deepEqual(merged.map(({ id }) => id), ["b", "a"]);
});

test("daily digest favors favorite sources and limits each publisher", () => {
  const now = new Date().toISOString();
  const articles = [
    { id: "a", sourceId: "normal", publishedAt: now },
    { id: "b", sourceId: "favorite", publishedAt: now },
    { id: "c", sourceId: "favorite", publishedAt: now },
    { id: "d", sourceId: "favorite", publishedAt: now },
    { id: "e", sourceId: "muted", title: "Horoscop", publishedAt: now }
  ];
  const digest = buildDailyDigest(articles, { favoriteSourceIds: ["favorite"], mutedKeywords: ["horoscop"] });
  assert.deepEqual(digest.map(({ id }) => id), ["b", "c", "a"]);
});
