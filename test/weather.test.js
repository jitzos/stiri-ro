const test = require("node:test");
const assert = require("node:assert/strict");
const { describeWeather, fetchWeather, parseWeatherPayload } = require("../src/weather");

const payload = {
  current_condition: [{ temp_C: "12", FeelsLikeC: "10", humidity: "74", windspeedKmph: "9", weatherCode: "116", localObsDateTime: "2026-10-18 11:00 AM" }],
  nearest_area: [{ areaName: [{ value: "Brașov" }], region: [{ value: "Brașov" }], country: [{ value: "România" }], latitude: "45.65", longitude: "25.60" }]
};

test("weather payload is converted to a Romanian local summary", () => {
  const weather = parseWeatherPayload(payload);
  assert.equal(weather.location.name, "Brașov");
  assert.equal(weather.temperature, 12);
  assert.equal(weather.description, "Parțial noros");
  assert.equal(weather.icon, "⛅");
});

test("weather codes have Romanian descriptions", () => {
  assert.deepEqual(describeWeather(113), ["Senin", "☀️"]);
  assert.deepEqual(describeWeather(302), ["Ploaie", "🌧️"]);
  assert.deepEqual(describeWeather(338), ["Ninsoare", "❄️"]);
});

test("weather requests use the free wttr.in JSON endpoint", async () => {
  let requestedUrl;
  const weather = await fetchWeather("Brașov", async (url) => {
    requestedUrl = url;
    return { ok: true, json: async () => payload };
  });
  assert.match(requestedUrl, /^https:\/\/wttr\.in\/Bra%C8%99ov\?format=j2$/);
  assert.equal(weather.location.name, "Brașov");
});
