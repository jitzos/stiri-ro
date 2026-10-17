const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildNotificationContent,
  collectNewArticles,
  filterNotificationArticles,
  isQuietTime
} = require("../src/notification-utils");

function article(id, title = `Titlul ${id}`) {
  return { id, title, excerpt: "Detalii", sourceId: "sursa", sourceName: "Sursa", categoryId: "actualitate" };
}

test("first feed load establishes a baseline without announcing old articles", () => {
  const known = new Set();

  assert.deepEqual(collectNewArticles([article("a"), article("b")], known, false), []);
  assert.deepEqual([...known], ["a", "b"]);
});

test("notification filters honor source, category and keywords", () => {
  const articles = [article("a", "Alegeri locale"), { ...article("b", "Fotbal"), categoryId: "sport" }];
  const preferences = {
    notificationsEnabled: true,
    notificationSourceIds: ["sursa"],
    notificationCategoryIds: ["actualitate"],
    notificationKeywords: "alegeri",
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00"
  };

  assert.deepEqual(filterNotificationArticles(articles, preferences).map(({ id }) => id), ["a"]);
});

test("quiet hours support overnight intervals", () => {
  const preferences = { quietHoursEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "08:00" };
  assert.equal(isQuietTime(preferences, new Date(2026, 1, 1, 23, 30)), true);
  assert.equal(isQuietTime(preferences, new Date(2026, 1, 1, 7, 30)), true);
  assert.equal(isQuietTime(preferences, new Date(2026, 1, 1, 12, 0)), false);
});

test("later feed loads return only articles that were not seen before", () => {
  const known = new Set(["a", "b"]);

  assert.deepEqual(collectNewArticles([article("c"), article("a")], known, true).map(({ id }) => id), ["c"]);
  assert.deepEqual([...known], ["a", "b", "c"]);
});

test("notification content summarizes one or multiple new articles", () => {
  assert.deepEqual(buildNotificationContent([article("a", "O știre")]), {
    title: "Știre nouă",
    body: "Sursa: O știre"
  });
  assert.deepEqual(buildNotificationContent([article("a", "Prima"), article("b")]), {
    title: "2 știri noi",
    body: "Prima · și încă 1"
  });
});
