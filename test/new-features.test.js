const test = require("node:test");
const assert = require("node:assert/strict");
const { matchTopic, readingStats, topStories } = require("../src/article-utils");
const { makeSync, normalizeSync, parseSync, toWindows } = require("../src/sync-utils");

const at = new Date("2026-10-18T12:00:00Z").getTime();
const article = (id, title, sourceId, age = 1) => ({
  id, title, sourceId, sourceName: sourceId, categoryId: "actualitate",
  link: `https://example.com/${id}`, publishedAt: new Date(at - age * 3600000).toISOString()
});

test("Top 10 is bounded, deduplicates near-identical headlines and excludes muted stories", () => {
  const stories = [
    article("a", "Guvernul anunță măsuri economice pentru sectorul energetic", "digi24"),
    article("b", "Guvernul anunță măsuri economice pentru sectorul energetic astăzi", "hotnews"),
    article("c", "Horoscopul zilei pentru toate zodiile", "libertatea"),
    ...["planete saturn astronomi observator", "recolta grau fermieri irigatii", "elevi scoala examene profesori", "autostrada tunel poduri constructii", "electricitate turbine panouri solare", "spitale pacienti vaccin chirurgie", "feroviar trenuri gara locomotive", "teatru festival expozitie muzeu", "finantare investitii bursa credite", "magistrati instante sentinte procese", "calatori munte hotel vacanta", "cercetatori experiment laborator fizica", "fotbal jucatori campionat antrenor"].map((topic, n) => article(`z${n}`, topic, `s${n}`, 2))
  ];
  const ranked = topStories(stories, { mutedKeywords: ["horoscop"], favoriteSourceIds: [] }, 10, at);
  assert.equal(ranked.length, 10);
  assert.equal(ranked.some((row) => row.article.id === "c"), false);
  assert.equal(ranked.some((row) => row.sourceCount >= 2), true);
});

test("Topics are matched ignoring Romanian diacritics", () => {
  assert.equal(matchTopic(article("a", "Tehnologia în România", "digi24"), ["tehnologie", "romania"]), true);
  assert.equal(matchTopic(article("b", "Fotbal astăzi", "gsp"), ["economie"]), false);
});

test("Personal stats use only reading events and group known articles", () => {
  const articles = [article("a", "Prima", "s1"), article("b", "A doua", "s2")];
  const events = [
    {id:"1",articleId:"a",at:new Date(at-1000).toISOString()},
    {id:"2",articleId:"a",at:new Date(at-2000).toISOString()},
    {id:"3",articleId:"b",at:new Date(at-3000).toISOString()},
    {id:"4",articleId:"b",at:new Date(at-45*86400000).toISOString()}
  ];
  const stats = readingStats(events,articles,at,30);
  assert.equal(stats.opens,3); assert.equal(stats.uniqueArticles,2);
  assert.deepEqual(stats.bySource,[["s1",1],["s2",1]]);
});

test("Portable sync snapshots validate format and round-trip Windows articles", () => {
  const snapshot = makeSync({
    followedTopics:["tehnologie"], favoriteSourceIDs:["digi24"], hiddenSourceIDs:[],
    readIDs:["a"],savedArticles:[article("a","Prima","digi24")],readingEvents:[{id:"e1",articleId:"a",at:new Date(at).toISOString()}]
  });
  const parsed = parseSync(JSON.stringify(snapshot));
  assert.equal(parsed.savedArticles[0].sourceID,"digi24");
  assert.equal(toWindows(parsed.savedArticles[0]).sourceId,"digi24");
  assert.equal(parsed.readIDs[0],"a");
  assert.throws(()=>normalizeSync({...snapshot,app:"wrong"}));
  assert.deepEqual(normalizeSync({...snapshot,savedArticles:[{id:"x",link:"javascript:alert(1)"}]}).savedArticles,[]);
});
