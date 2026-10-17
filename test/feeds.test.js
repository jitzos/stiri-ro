const test = require("node:test");
const assert = require("node:assert/strict");
const { SOURCES, cleanText, classifyCategory, normalizeItem } = require("../src/feeds");

const source = {
  id: "test",
  name: "Test",
  homepage: "https://example.com",
  color: "#000"
};

test("cleanText removes markup and normalizes whitespace", () => {
  assert.equal(cleanText("<p>Știre &amp; detalii</p>\n  azi"), "Știre & detalii azi");
});

test("normalizeItem creates a safe article", () => {
  const article = normalizeItem({
    title: "Titlu",
    link: "/articol",
    description: '<p>Descriere</p><img src="/imagine.jpg">',
    pubDate: "2026-10-17T08:00:00Z"
  }, source);

  assert.equal(article.link, "https://example.com/articol");
  assert.equal(article.image, "https://example.com/imagine.jpg");
  assert.equal(article.excerpt, "Descriere");
});

test("normalizeItem rejects unsafe links", () => {
  assert.equal(normalizeItem({ title: "Titlu", link: "javascript:alert(1)" }, source), null);
});

test("normalizeItem tolerates object-valued RSS identifiers", () => {
  const article = normalizeItem({
    title: "Titlu",
    link: "https://example.com/articol",
    guid: { $: { isPermaLink: "false" } }
  }, source);

  assert.equal(article.id, "test:https://example.com/articol");
});

test("classifyCategory prefers categories supplied by the publisher", () => {
  assert.equal(classifyCategory({
    title: "Un titlu generic",
    link: "https://example.com/articol",
    categories: ["Politică"]
  }).id, "politica");
});

test("classifyCategory uses headline and URL as fallback", () => {
  assert.equal(classifyCategory({
    title: "Echipa a câștigat meciul de fotbal",
    link: "https://example.com/stiri/sport/articol"
  }).id, "sport");
});

test("source list contains 24 unique publishers", () => {
  assert.equal(SOURCES.length, 24);
  assert.equal(new Set(SOURCES.map((source) => source.id)).size, SOURCES.length);
  assert.equal(new Set(SOURCES.map((source) => source.feedUrl)).size, SOURCES.length);
});
