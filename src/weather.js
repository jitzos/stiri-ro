const WEATHER_CODES = new Map([
  [113, ["Senin", "☀️"]],
  [116, ["Parțial noros", "⛅"]],
  [119, ["Noros", "☁️"]],
  [122, ["Cer acoperit", "☁️"]],
  [143, ["Ceață ușoară", "🌫️"]],
  [200, ["Furtună", "⛈️"]],
  [227, ["Viscol", "🌨️"]],
  [230, ["Viscol puternic", "🌨️"]],
  [248, ["Ceață", "🌫️"]],
  [260, ["Ceață înghețată", "🌫️"]],
  [350, ["Grindină", "🌨️"]]
]);

function describeWeather(code) {
  const numericCode = Number(code);
  if (WEATHER_CODES.has(numericCode)) return WEATHER_CODES.get(numericCode);
  if ([176, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 353, 356, 359].includes(numericCode)) return ["Ploaie", "🌧️"];
  if ([179, 182, 185, 311, 314, 317, 320, 362, 365].includes(numericCode)) return ["Lapoviță", "🌨️"];
  if ([323, 326, 329, 332, 335, 338, 368, 371].includes(numericCode)) return ["Ninsoare", "❄️"];
  if ([386, 389, 392, 395].includes(numericCode)) return ["Furtună", "⛈️"];
  return ["Vreme variabilă", "🌤️"];
}

function describeForecastWeather(code) {
  const numericCode = Number(code);
  if (numericCode === 0) return ["Senin", "☀️"];
  if ([1, 2].includes(numericCode)) return ["Parțial noros", "⛅"];
  if (numericCode === 3) return ["Cer acoperit", "☁️"];
  if ([45, 48].includes(numericCode)) return ["Ceață", "🌫️"];
  if (numericCode >= 51 && numericCode <= 67 || numericCode >= 80 && numericCode <= 82) return ["Ploaie", "🌧️"];
  if (numericCode >= 71 && numericCode <= 77 || numericCode >= 85 && numericCode <= 86) return ["Ninsoare", "❄️"];
  if (numericCode >= 95) return ["Furtună", "⛈️"];
  return ["Vreme variabilă", "🌤️"];
}

function localizedValue(field) {
  return Array.isArray(field) && typeof field[0]?.value === "string" ? field[0].value.trim() : "";
}

function parseWeatherPayload(payload) {
  const current = payload?.current_condition?.[0];
  const area = payload?.nearest_area?.[0];
  if (!current || !area) throw new Error("Răspuns meteo invalid");

  const areaName = localizedValue(area.areaName);
  const region = localizedValue(area.region);
  const country = localizedValue(area.country);
  const locationName = [areaName, region || country].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(", ");
  const [description, icon] = describeWeather(current.weatherCode);

  return {
    location: {
      name: locationName || "Locația curentă",
      latitude: Number(area.latitude),
      longitude: Number(area.longitude)
    },
    temperature: Number(current.temp_C),
    feelsLike: Number(current.FeelsLikeC),
    precipitation: Number(current.precipMM || 0),
    humidity: Number(current.humidity),
    windSpeed: Number(current.windspeedKmph),
    description,
    icon,
    observedAt: current.localObsDateTime || null
  };
}

async function fetchWeather(location, fetchImplementation = fetch) {
  let query;
  if (typeof location === "string") {
    query = location.trim().slice(0, 120);
  } else {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) query = `${latitude},${longitude}`;
  }
  if (!query) throw new Error("Locație invalidă");

  const response = await fetchImplementation(`https://wttr.in/${encodeURIComponent(query)}?format=j2`, {
    headers: { Accept: "application/json", "User-Agent": "StiriRO/0.0.6" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Serviciul meteo a răspuns cu ${response.status}`);
  return parseWeatherPayload(await response.json());
}

function parseForecastPayload(payload) {
  const daily = payload?.daily;
  if (!Array.isArray(daily?.time) || daily.time.length < 5) throw new Error("Prognoză meteo invalidă");

  return daily.time.slice(0, 5).map((date, index) => {
    const [description, icon] = describeForecastWeather(daily.weather_code?.[index]);
    return {
      date,
      minimum: Number(daily.temperature_2m_min?.[index]),
      maximum: Number(daily.temperature_2m_max?.[index]),
      precipitationChance: Number(daily.precipitation_probability_max?.[index]),
      description,
      icon
    };
  });
}

async function fetchForecast(location, fetchImplementation = fetch) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Coordonate invalide");

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "5");
  const response = await fetchImplementation(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Serviciul de prognoză a răspuns cu ${response.status}`);
  return parseForecastPayload(await response.json());
}

module.exports = { describeForecastWeather, describeWeather, fetchForecast, fetchWeather, parseForecastPayload, parseWeatherPayload };
