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

module.exports = { describeWeather, fetchWeather, parseWeatherPayload };
