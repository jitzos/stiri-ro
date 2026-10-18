const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildNotificationContent,
  collectNewArticles,
  filterNotificationArticles,
  isNotificationBatchDue,
  isQuietTime,
  queueNotificationArticles,
  NOTIFICATION_INTERVAL_MS
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
    body: "Sursa: Prima\nSursa: Titlul b"
  });
});

test("six-hour notification interval respects quiet hours and enable switch", () => {
  const preferences = { notificationsEnabled: true, quietHoursEnabled: false };
  const base = new Date(2026, 9, 18, 12, 0);
  assert.equal(isNotificationBatchDue(base.getTime(), preferences, new Date(base.getTime() + NOTIFICATION_INTERVAL_MS - 1)), false);
  assert.equal(isNotificationBatchDue(base.getTime(), preferences, new Date(base.getTime() + NOTIFICATION_INTERVAL_MS)), true);
  assert.equal(isNotificationBatchDue(base.getTime(), { ...preferences, notificationsEnabled: false }, new Date(base.getTime() + NOTIFICATION_INTERVAL_MS)), false);
  assert.equal(isNotificationBatchDue(base.getTime(), { ...preferences, quietHoursEnabled: true, quietHoursStart: "18:00", quietHoursEnd: "23:00" }, new Date(base.getTime() + NOTIFICATION_INTERVAL_MS)), false);
});

test("new stories are collected during quiet hours for a later digest", () => {
  const preferences = { notificationsEnabled: true, quietHoursEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "08:00", notificationSourceIds: [], notificationCategoryIds: [], notificationKeywords: "" };
  assert.deepEqual(filterNotificationArticles([article("a")], preferences).map(({ id }) => id), ["a"]);
});

test("notification batch keeps five newest unique articles across refreshes", () => {
  const news = (id, offset) => ({ ...article(id), publishedAt: new Date(2026, 9, 18, 12, offset).toISOString() });
  const first = queueNotificationArticles([], [news("1", 1), news("2", 2), news("3", 3), news("4", 4)]);
  const second = queueNotificationArticles(first, [news("3", 3), news("5", 5), news("6", 6), news("7", 7)]);
  assert.deepEqual(second.map(({ id }) => id), ["7", "6", "5", "4", "3"]);
  const content = buildNotificationContent([...second, news("8", 8)]);
  assert.equal(content.title, "5 știri noi");
  assert.equal(content.body.split("\n").length, 5);
});
