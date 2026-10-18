const test = require("node:test");
const assert = require("node:assert/strict");
const { describeForecastWeather, describeWeather, fetchForecast, fetchForecastBundle, fetchWeather, parseForecastPayload, parseHourlyForecastPayload, parseWeatherPayload } = require("../src/weather");

const payload = {
  current_condition: [{ temp_C: "12", FeelsLikeC: "10", humidity: "74", windspeedKmph: "9", weatherCode: "116", localObsDateTime: "2026-10-18 11:00 AM" }],
  nearest_area: [{ areaName: [{ value: "Brașov" }], region: [{ value: "Brașov" }], country: [{ value: "România" }], latitude: "45.65", longitude: "25.60" }]
};

test("weather payload is converted to a Romanian local summary", () => {
  const weather = parseWeatherPayload(payload);
  assert.equal(weather.location.name, "Brașov");
  assert.equal(weather.temperature, 12);
  assert.equal(weather.precipitation, 0);
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

test("five-day forecast is normalized with Romanian descriptions", async () => {
  const forecastPayload = {
    daily: {
      time: ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"],
      weather_code: [0, 2, 61, 71, 95],
      temperature_2m_min: [3, 4, 5, -1, 2],
      temperature_2m_max: [10, 11, 9, 4, 7],
      precipitation_probability_max: [0, 10, 70, 60, 80]
    },
    hourly: {
      time: Array.from({ length: 24 }, (_, hour) => `2026-10-18T${String(hour).padStart(2, "0")}:00`),
      weather_code: Array(24).fill(2),
      temperature_2m: Array.from({ length: 24 }, (_, hour) => hour - 2),
      precipitation_probability: Array.from({ length: 24 }, (_, hour) => hour)
    }
  };
  let requestedUrl;
  const forecast = await fetchForecast({ latitude: 45.65, longitude: 25.6 }, async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => forecastPayload };
  });

  assert.equal(forecast.length, 5);
  assert.deepEqual(forecast[0], { date: "2026-10-18", minimum: 3, maximum: 10, precipitationChance: 0, description: "Senin", icon: "☀️" });
  assert.equal(forecast[4].description, "Furtună");
  assert.match(requestedUrl, /forecast_days=5/);
  assert.match(requestedUrl, /hourly=weather_code%2Ctemperature_2m%2Cprecipitation_probability/);
  assert.deepEqual(describeForecastWeather(71), ["Ninsoare", "❄️"]);
  assert.equal(parseForecastPayload(forecastPayload).length, 5);
  assert.equal(parseHourlyForecastPayload(forecastPayload).length, 24);

  const bundle = await fetchForecastBundle({ latitude: 45.65, longitude: 25.6 }, async () => ({ ok: true, json: async () => forecastPayload }));
  assert.equal(bundle.forecast.length, 5);
  assert.deepEqual(bundle.hourlyForecast[6], { time: "2026-10-18T06:00", temperature: 4, precipitationChance: 6, description: "Parțial noros", icon: "⛅" });
});
