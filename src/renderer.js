function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const state = {
  articles: [], sources: [], categories: [], preferences: null,
  selectedSource: "all", selectedCategory: "all", query: "", fetchedAt: null,
  minimizeToTray: localStorage.getItem("minimizeToTray") !== "false",
  seen: new Set(readStoredArray("seenArticles")),
  saved: new Map(readStoredArray("savedArticles").filter((article) => article?.id).map((article) => [article.id, article])),
  history: new Map(readStoredArray("articleHistory").filter((article) => article?.id).map((article) => [article.id, article])),
  unreadOnly: false, savedOnly: false, localOnly: false, historySearch: false, dateRange: "all", readingStatus: "all",
  feedScrollY: 0, currentWeather: null, weatherForecast: [], hourlyWeatherForecast: [], weatherForecastView: "today"
};

const elements = {
  grid: document.querySelector("#articleGrid"), template: document.querySelector("#articleTemplate"),
  filters: document.querySelector("#sourceFilters"), categoryFilters: document.querySelector("#categoryFilters"),
  search: document.querySelector("#searchInput"), refresh: document.querySelector("#refreshButton"),
  advancedSearch: document.querySelector("#advancedSearchDetails"), historySearch: document.querySelector("#historySearchToggle"),
  dateRange: document.querySelector("#dateRangeFilter"), readingStatus: document.querySelector("#readingStatusFilter"),
  weatherWidget: document.querySelector("#weatherWidget"), weatherIcon: document.querySelector("#weatherIcon"),
  weatherTemperature: document.querySelector("#weatherTemperature"), weatherDescription: document.querySelector("#weatherDescription"),
  weatherLocation: document.querySelector("#weatherLocation"), weatherDetails: document.querySelector("#weatherDetails"),
  weatherForecast: document.querySelector("#weatherForecast"), weatherForecastDays: document.querySelector("#weatherForecastDays"),
  weatherTodayForecast: document.querySelector("#weatherTodayForecast"), todayForecastTab: document.querySelector("#todayForecastTab"),
  fiveDayForecastTab: document.querySelector("#fiveDayForecastTab"),
  closeWeatherForecast: document.querySelector("#closeWeatherForecastButton"),
  refreshMenu: document.querySelector("#refreshMenu"), refreshNow: document.querySelector("#refreshNowButton"),
  quickRefreshInterval: document.querySelector("#quickRefreshInterval"), quickTrayRefreshInterval: document.querySelector("#quickTrayRefreshInterval"),
  settingsButton: document.querySelector("#settingsButton"), settingsDialog: document.querySelector("#settingsDialog"),
  digestButton: document.querySelector("#digestButton"), digestDialog: document.querySelector("#digestDialog"),
  closeDigest: document.querySelector("#closeDigestButton"), digestSubtitle: document.querySelector("#digestSubtitle"),
  digestArticles: document.querySelector("#digestArticles"),
  settingsCard: document.querySelector("#settingsCard"), settingsBackToTop: document.querySelector("#settingsBackToTopButton"),
  weatherEnabledToggle: document.querySelector("#weatherEnabledToggle"), weatherOptions: document.querySelector("#weatherOptions"),
  automaticWeatherMode: document.querySelector("#automaticWeatherMode"), manualWeatherMode: document.querySelector("#manualWeatherMode"),
  weatherLocationStatus: document.querySelector("#weatherLocationStatus"), useCurrentLocation: document.querySelector("#useCurrentLocationButton"),
  manualLocation: document.querySelector("#manualLocationInput"), saveManualLocation: document.querySelector("#saveManualLocationButton"),
  trayToggle: document.querySelector("#trayToggle"), startupToggle: document.querySelector("#startupToggle"),
  startupHelp: document.querySelector("#startupHelp"), notificationsToggle: document.querySelector("#notificationsToggle"),
  notificationsHelp: document.querySelector("#notificationsHelp"), notificationOptions: document.querySelector("#notificationOptions"),
  notificationKeywords: document.querySelector("#notificationKeywords"), quietHoursToggle: document.querySelector("#quietHoursToggle"),
  quietHoursStart: document.querySelector("#quietHoursStart"), quietHoursEnd: document.querySelector("#quietHoursEnd"),
  notificationSourceOptions: document.querySelector("#notificationSourceOptions"),
  notificationCategoryOptions: document.querySelector("#notificationCategoryOptions"),
  refreshInterval: document.querySelector("#refreshInterval"), trayRefreshInterval: document.querySelector("#trayRefreshInterval"),
  sourceManager: document.querySelector("#sourceManager"), themeSelect: document.querySelector("#themeSelect"),
  fontSizeSelect: document.querySelector("#fontSizeSelect"), densitySelect: document.querySelector("#densitySelect"),
  mutedKeywords: document.querySelector("#mutedKeywordsInput"), exportBackup: document.querySelector("#exportBackupButton"),
  importBackup: document.querySelector("#importBackupButton"), backupStatus: document.querySelector("#backupStatus"),
  updateStatus: document.querySelector("#updateStatus"), updateButton: document.querySelector("#updateButton"),
  appVersion: document.querySelector("#appVersion"), status: document.querySelector("#statusText"),
  count: document.querySelector("#articleCount"), title: document.querySelector("#feedTitle"),
  errors: document.querySelector("#errorBanner"), empty: document.querySelector("#emptyState"),
  localFilter: document.querySelector("#localFilterButton"), savedFilter: document.querySelector("#savedFilterButton"), unreadFilter: document.querySelector("#unreadFilterButton"),
  markAllRead: document.querySelector("#markAllReadButton"), readerToolbar: document.querySelector("#readerToolbar"),
  readerBack: document.querySelector("#readerBackButton"), readerTitle: document.querySelector("#readerTitle"),
  readerSource: document.querySelector("#readerSource"), backToTop: document.querySelector("#backToTopButton")
};

function updateBackToTopVisibility() {
  elements.backToTop.hidden = document.body.classList.contains("reader-open") || window.scrollY < 500;
}

function updateSettingsBackToTopVisibility() {
  elements.settingsBackToTop.hidden = elements.settingsCard.scrollTop < 300;
}

function preferredScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function showWeatherMessage(message) {
  if (!state.preferences.weatherEnabled) {
    elements.weatherWidget.hidden = true;
    return;
  }
  elements.weatherWidget.hidden = false;
  elements.weatherIcon.textContent = "🌤️";
  elements.weatherTemperature.textContent = "--°C";
  elements.weatherDescription.textContent = message;
  elements.weatherLocation.textContent = state.preferences.weatherLocation?.name || "Locație neconfigurată";
  elements.weatherDetails.textContent = "";
  state.weatherForecast = [];
  state.hourlyWeatherForecast = [];
  state.currentWeather = null;
  setWeatherForecastOpen(false);
}

function renderWeather(weather) {
  elements.weatherWidget.hidden = false;
  elements.weatherIcon.textContent = weather.icon;
  elements.weatherTemperature.textContent = `${Math.round(weather.temperature)}°C`;
  elements.weatherDescription.textContent = weather.description;
  elements.weatherLocation.textContent = weather.location.name;
  elements.weatherDetails.textContent = `Se simt ${Math.round(weather.feelsLike)}° · vânt ${Math.round(weather.windSpeed)} km/h`;
  state.weatherForecast = Array.isArray(weather.forecast) ? weather.forecast : [];
  state.hourlyWeatherForecast = Array.isArray(weather.hourlyForecast) ? weather.hourlyForecast : [];
  state.currentWeather = weather;
}

function renderFiveDayForecast() {
  elements.weatherForecastDays.replaceChildren();
  if (state.weatherForecast.length === 0) {
    const message = document.createElement("p");
    message.className = "forecast-unavailable";
    message.textContent = "Prognoza nu este disponibilă momentan.";
    elements.weatherForecastDays.append(message);
    return;
  }

  const formatter = new Intl.DateTimeFormat("ro-RO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  for (const day of state.weatherForecast) {
    const item = document.createElement("article"); item.className = "forecast-day";
    const date = document.createElement("time"); date.dateTime = day.date; date.textContent = formatter.format(new Date(`${day.date}T12:00:00Z`));
    const icon = document.createElement("span"); icon.className = "forecast-icon"; icon.textContent = day.icon; icon.setAttribute("aria-hidden", "true");
    const temperatures = document.createElement("strong"); temperatures.textContent = `${Math.round(day.maximum)}° / ${Math.round(day.minimum)}°`;
    const description = document.createElement("small"); description.textContent = `${day.description} · ploaie ${Math.round(day.precipitationChance)}%`;
    item.append(date, icon, temperatures, description); elements.weatherForecastDays.append(item);
  }
}

function addTodayDetail(container, label, value) {
  const detail = document.createElement("span"); detail.className = "today-detail";
  const name = document.createElement("span"); name.textContent = label;
  const reading = document.createElement("strong"); reading.textContent = value;
  detail.append(name, reading); container.append(detail);
}

function renderTodayForecast() {
  elements.weatherTodayForecast.replaceChildren();
  const weather = state.currentWeather;
  if (!weather) {
    const message = document.createElement("p"); message.className = "forecast-unavailable"; message.textContent = "Prognoza pentru azi nu este disponibilă momentan.";
    elements.weatherTodayForecast.append(message); return;
  }

  const today = state.weatherForecast[0];
  const summary = document.createElement("div"); summary.className = "today-summary";
  const icon = document.createElement("span"); icon.className = "forecast-icon"; icon.textContent = weather.icon; icon.setAttribute("aria-hidden", "true");
  const temperature = document.createElement("strong"); temperature.textContent = `${Math.round(weather.temperature)}°C`;
  const description = document.createElement("span"); description.textContent = weather.description;
  summary.append(icon, temperature, description);
  const details = document.createElement("div"); details.className = "today-details";
  addTodayDetail(details, "Se simt", `${Math.round(weather.feelsLike)}°C`);
  addTodayDetail(details, "Min / Max", today ? `${Math.round(today.minimum)}° / ${Math.round(today.maximum)}°` : "—");
  addTodayDetail(details, "Ploaie", today ? `${Math.round(today.precipitationChance)}%` : `${weather.precipitation || 0} mm`);
  addTodayDetail(details, "Umiditate", `${Math.round(weather.humidity)}%`);
  addTodayDetail(details, "Vânt", `${Math.round(weather.windSpeed)} km/h`);

  const hourlySection = document.createElement("section"); hourlySection.className = "today-hourly";
  const hourlyTitle = document.createElement("h3"); hourlyTitle.textContent = "Prognoza pe ore";
  const hourlyList = document.createElement("div"); hourlyList.className = "hourly-forecast"; hourlyList.setAttribute("aria-label", "Prognoza meteo pe ore pentru azi");
  if (state.hourlyWeatherForecast.length === 0) {
    const message = document.createElement("p"); message.className = "forecast-unavailable"; message.textContent = "Prognoza pe ore nu este disponibilă momentan.";
    hourlyList.append(message);
  } else {
    for (const hour of state.hourlyWeatherForecast) {
      const item = document.createElement("article"); item.className = "forecast-hour"; item.title = hour.description;
      const time = document.createElement("time"); time.dateTime = hour.time; time.textContent = hour.time.slice(11, 16);
      const hourIcon = document.createElement("span"); hourIcon.className = "forecast-icon"; hourIcon.textContent = hour.icon; hourIcon.setAttribute("aria-hidden", "true");
      const hourTemperature = document.createElement("strong"); hourTemperature.textContent = `${Math.round(hour.temperature)}°`;
      const rain = document.createElement("small"); rain.textContent = `💧 ${Math.round(hour.precipitationChance)}%`;
      item.append(time, hourIcon, hourTemperature, rain); hourlyList.append(item);
    }
  }
  hourlySection.append(hourlyTitle, hourlyList);
  elements.weatherTodayForecast.append(summary, details, hourlySection);
}

function setWeatherForecastView(view) {
  state.weatherForecastView = view;
  const showToday = view === "today";
  elements.todayForecastTab.classList.toggle("active", showToday);
  elements.todayForecastTab.setAttribute("aria-selected", String(showToday));
  elements.fiveDayForecastTab.classList.toggle("active", !showToday);
  elements.fiveDayForecastTab.setAttribute("aria-selected", String(!showToday));
  elements.weatherTodayForecast.hidden = !showToday;
  elements.weatherForecastDays.hidden = showToday;
  if (showToday) renderTodayForecast(); else renderFiveDayForecast();
}

function setWeatherForecastOpen(open) {
  elements.weatherForecast.hidden = !open;
  elements.weatherWidget.setAttribute("aria-expanded", String(open));
  if (open) setWeatherForecastView(state.weatherForecastView);
}

async function loadWeather(location = state.preferences.weatherLocation) {
  if (!state.preferences.weatherEnabled) {
    elements.weatherWidget.hidden = true;
    return;
  }
  if (!location) {
    showWeatherMessage("Alege locația din Setări");
    return;
  }

  showWeatherMessage("Se încarcă vremea…");
  const result = await window.newsApi.getWeather(location);
  if (!result.ok) {
    showWeatherMessage(result.message);
    return;
  }
  renderWeather(result.weather);
}

async function saveWeatherResult(weather, mode) {
  await updatePreferences({
    weatherLocationRequested: true,
    weatherLocationMode: mode,
    [mode === "automatic" ? "weatherAutomaticLocation" : "weatherManualLocation"]: weather.location
  });
  renderSettings();
  renderWeather(weather);
  renderArticles();
}

async function requestAutomaticLocation() {
  await updatePreferences({ weatherLocationRequested: true });
  renderSettings();
  showWeatherMessage("Se solicită locația…");
  if (!navigator.geolocation) {
    showWeatherMessage("Locația nu este disponibilă. Alege un oraș din Setări.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    const result = await window.newsApi.getWeather({ latitude: coords.latitude, longitude: coords.longitude });
    if (result.ok) await saveWeatherResult(result.weather, "automatic");
    else showWeatherMessage(result.message);
  }, () => {
    showWeatherMessage("Accesul la locație nu a fost acordat. Alege un oraș din Setări.");
    renderSettings();
  }, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 24 * 60 * 60 * 1000 });
}

function initializeWeather() {
  if (!state.preferences.weatherEnabled) {
    elements.weatherWidget.hidden = true;
  } else if (state.preferences.weatherLocation) {
    loadWeather();
  } else if (!state.preferences.weatherLocationRequested) {
    requestAutomaticLocation();
  } else {
    showWeatherMessage("Alege locația din Setări");
  }
}

async function closeReader() {
  await window.newsApi.closeArticle();
  document.body.classList.remove("reader-open");
  elements.readerToolbar.hidden = true;
  renderArticles();
  requestAnimationFrame(() => {
    window.scrollTo(0, state.feedScrollY);
    updateBackToTopVisibility();
  });
}

async function openReader(article) {
  state.feedScrollY = window.scrollY;
  elements.readerTitle.textContent = article.title;
  elements.readerSource.textContent = article.sourceName;
  elements.readerToolbar.hidden = false;
  document.body.classList.add("reader-open");
  updateBackToTopVisibility();
  try {
    await window.newsApi.openArticle(article.link);
  } catch {
    await closeReader();
    elements.errors.textContent = "Articolul nu a putut fi deschis în aplicație.";
    elements.errors.hidden = false;
  }
}

function relativeTime(isoDate) {
  if (!isoDate) return "";
  const seconds = Math.round((Date.parse(isoDate) - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("ro", { numeric: "auto" });
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(seconds) >= size || unit === "minute") return formatter.format(Math.round(seconds / size), unit);
  }
}

function renderUpdateStatus(status) {
  elements.appVersion.textContent = `v${status.currentVersion}`;
  elements.updateStatus.textContent = status.message;
  elements.updateButton.disabled = !status.supported || ["checking", "downloading"].includes(status.phase);
  if (!status.supported) {
    elements.updateButton.textContent = "Indisponibil"; elements.updateButton.dataset.action = "none";
  } else if (status.phase === "available") {
    elements.updateButton.textContent = "Descarcă actualizarea"; elements.updateButton.dataset.action = "download";
  } else if (status.phase === "downloaded") {
    elements.updateButton.textContent = "Repornește și instalează"; elements.updateButton.dataset.action = "install";
  } else if (status.phase === "downloading") {
    elements.updateButton.textContent = `${status.percent ?? 0}%`; elements.updateButton.dataset.action = "none";
  } else {
    elements.updateButton.textContent = status.phase === "checking" ? "Se verifică…" : "Verifică acum";
    elements.updateButton.dataset.action = "check";
  }
}

function saveSeen() { localStorage.setItem("seenArticles", JSON.stringify([...state.seen].slice(-2_000))); }
function saveSaved() { localStorage.setItem("savedArticles", JSON.stringify([...state.saved.values()].slice(-500))); }
function saveHistory() { localStorage.setItem("articleHistory", JSON.stringify([...state.history.values()].slice(0, 2_000))); }

function displaySources() {
  if (!state.preferences) return state.sources;
  const hidden = new Set(state.preferences.hiddenSourceIds);
  const favorites = new Set(state.preferences.favoriteSourceIds);
  const order = new Map(state.preferences.sourceOrder.map((id, index) => [id, index]));
  return [...state.sources]
    .filter(({ id }) => !hidden.has(id))
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)) || (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
}

function filteredArticles() {
  const query = window.articleUtils.normalizeText(state.query.trim());
  const articles = state.savedOnly
    ? [...state.saved.values()]
    : state.historySearch ? [...state.history.values()] : state.articles;
  const cutoff = state.dateRange === "all" ? null : Date.now() - Number(state.dateRange) * 24 * 60 * 60 * 1_000;
  return articles.filter((article) => {
    const sourceMatches = state.selectedSource === "all" || article.sourceId === state.selectedSource;
    const categoryMatches = state.selectedCategory === "all" || article.categoryId === state.selectedCategory;
    const textMatches = !query || window.articleUtils.articleText(article).includes(query);
    const dateMatches = !cutoff || !article.publishedAt || Date.parse(article.publishedAt) >= cutoff;
    const localMatches = !state.localOnly || window.articleUtils.isLocalArticle(article, state.preferences.weatherLocation);
    const muted = window.articleUtils.isMutedArticle(article, state.preferences.mutedKeywords);
    const readingMatches = state.readingStatus === "all"
      || state.readingStatus === "unread" && !state.seen.has(article.id)
      || state.readingStatus === "read" && state.seen.has(article.id)
      || state.readingStatus === "saved" && state.saved.has(article.id);
    return sourceMatches && categoryMatches && textMatches && dateMatches && localMatches && !muted
      && readingMatches && (!state.unreadOnly || !state.seen.has(article.id));
  });
}

function updateFeedTitle() {
  if (state.savedOnly) elements.title.textContent = "Articole salvate";
  else if (state.localOnly) elements.title.textContent = `Știri locale · ${state.preferences.weatherLocation?.name || "locație"}`;
  else if (state.historySearch) elements.title.textContent = "Căutare în istoric";
  else if (state.selectedSource !== "all") {
    elements.title.textContent = state.sources.find(({ id }) => id === state.selectedSource)?.name || "Ultimele știri";
  } else elements.title.textContent = state.unreadOnly ? "Știri necitite" : "Ultimele știri";
}

function renderArticles() {
  const articles = filteredArticles();
  elements.grid.replaceChildren();
  for (const article of articles) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".article-card");
    const button = fragment.querySelector(".card-link");
    const saveButton = fragment.querySelector(".save-button");
    const image = fragment.querySelector(".article-image");
    const fallback = fragment.querySelector(".image-fallback");
    const badge = fragment.querySelector(".source-badge");
    const categoryBadge = fragment.querySelector(".category-badge");
    const time = fragment.querySelector(".published-at");
    const isSaved = state.saved.has(article.id);
    fragment.querySelector(".article-title").textContent = article.title;
    fragment.querySelector(".article-excerpt").textContent = article.excerpt || "Deschide articolul pentru detalii.";
    badge.textContent = article.sourceName; badge.style.color = article.sourceColor;
    categoryBadge.textContent = article.categoryName;
    time.textContent = relativeTime(article.publishedAt); time.dateTime = article.publishedAt || "";
    fallback.textContent = article.sourceName.charAt(0);
    card.classList.toggle("seen", state.seen.has(article.id));
    saveButton.classList.toggle("active", isSaved);
    saveButton.textContent = isSaved ? "★" : "☆";
    saveButton.setAttribute("aria-label", isSaved ? "Elimină articolul din salvate" : "Salvează articolul");
    if (article.image) {
      image.src = article.image; image.addEventListener("error", () => image.remove());
    } else image.remove();
    saveButton.addEventListener("click", () => {
      if (state.saved.has(article.id)) state.saved.delete(article.id); else state.saved.set(article.id, article);
      saveSaved(); renderArticles();
    });
    button.setAttribute("aria-label", `Deschide: ${article.title}`);
    button.addEventListener("click", async () => {
      state.seen.add(article.id); saveSeen(); card.classList.add("seen"); await openReader(article);
    });
    elements.grid.append(fragment);
  }
  const allDisplayed = state.savedOnly ? [...state.saved.values()] : state.articles;
  const unreadCount = allDisplayed.filter(({ id }) => !state.seen.has(id)).length;
  elements.count.textContent = `${articles.length} ${articles.length === 1 ? "articol" : "articole"}`;
  elements.savedFilter.classList.toggle("active", state.savedOnly);
  elements.savedFilter.textContent = `${state.savedOnly ? "★" : "☆"} Salvate (${state.saved.size})`;
  elements.unreadFilter.classList.toggle("active", state.unreadOnly);
  elements.unreadFilter.textContent = `Necitite (${unreadCount})`;
  elements.localFilter.classList.toggle("active", state.localOnly);
  elements.localFilter.disabled = !state.preferences.weatherLocation;
  elements.localFilter.title = state.preferences.weatherLocation ? `Știri despre ${state.preferences.weatherLocation.name}` : "Configurează locația în Setări";
  elements.markAllRead.disabled = articles.length === 0 || articles.every(({ id }) => state.seen.has(id));
  elements.empty.hidden = articles.length > 0; elements.grid.hidden = articles.length === 0;
  updateFeedTitle();
}

function renderFilters() {
  const options = [{ id: "all", name: "Toate" }, ...displaySources()];
  const favorites = new Set(state.preferences?.favoriteSourceIds || []);
  elements.filters.replaceChildren();
  for (const source of options) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "filter-button";
    button.textContent = source.id !== "all" && favorites.has(source.id) ? `★ ${source.name}` : source.name;
    button.classList.toggle("active", source.id === state.selectedSource);
    button.addEventListener("click", () => { state.selectedSource = source.id; renderFilters(); renderArticles(); });
    elements.filters.append(button);
  }
}

function renderCategoryFilters() {
  const options = [{ id: "all", name: "Toate" }, ...state.categories];
  elements.categoryFilters.replaceChildren();
  for (const category of options) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "filter-button"; button.textContent = category.name;
    button.classList.toggle("active", category.id === state.selectedCategory);
    button.addEventListener("click", () => { state.selectedCategory = category.id; renderCategoryFilters(); renderArticles(); });
    elements.categoryFilters.append(button);
  }
}

function applyAppearance() {
  if (!state.preferences) return;
  document.documentElement.dataset.theme = state.preferences.theme;
  document.documentElement.dataset.fontSize = state.preferences.fontSize;
  document.documentElement.dataset.density = state.preferences.density;
}

async function updatePreferences(patch) {
  state.preferences = await window.newsApi.updatePreferences(patch);
  applyAppearance();
  return state.preferences;
}

function renderChoiceGrid(container, items, selectedIds, preferenceKey) {
  const selected = new Set(selectedIds);
  container.replaceChildren();
  for (const item of items) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.checked = selected.has(item.id);
    checkbox.addEventListener("change", async () => {
      if (checkbox.checked) selected.add(item.id); else selected.delete(item.id);
      await updatePreferences({ [preferenceKey]: [...selected] });
    });
    label.append(checkbox, document.createTextNode(item.name)); container.append(label);
  }
}

function updateNotificationControls() {
  const supported = state.preferences.notificationsSupported;
  const enabled = supported && state.preferences.notificationsEnabled;
  elements.notificationsToggle.checked = state.preferences.notificationsEnabled;
  elements.notificationsToggle.disabled = !supported;
  elements.notificationOptions.classList.toggle("disabled", !enabled);
  for (const input of elements.notificationOptions.querySelectorAll("input")) input.disabled = !enabled;
  elements.notificationsHelp.textContent = !supported
    ? "Notificările nu sunt disponibile pe acest sistem."
    : enabled ? "Cel mult o notificare la 6 ore, cu maximum 5 articole noi." : "Notificările pentru știrile noi sunt oprite.";
}

function renderSettings() {
  const preferences = state.preferences;
  elements.notificationKeywords.value = preferences.notificationKeywords;
  elements.quietHoursToggle.checked = preferences.quietHoursEnabled;
  elements.quietHoursStart.value = preferences.quietHoursStart;
  elements.quietHoursEnd.value = preferences.quietHoursEnd;
  elements.refreshInterval.value = String(preferences.refreshIntervalMinutes);
  elements.trayRefreshInterval.value = String(preferences.trayRefreshIntervalMinutes);
  elements.quickRefreshInterval.value = String(preferences.refreshIntervalMinutes);
  elements.quickTrayRefreshInterval.value = String(preferences.trayRefreshIntervalMinutes);
  elements.themeSelect.value = preferences.theme;
  elements.fontSizeSelect.value = preferences.fontSize;
  elements.densitySelect.value = preferences.density;
  elements.mutedKeywords.value = preferences.mutedKeywords.join(", ");
  elements.weatherEnabledToggle.checked = preferences.weatherEnabled;
  elements.automaticWeatherMode.checked = preferences.weatherLocationMode === "automatic";
  elements.manualWeatherMode.checked = preferences.weatherLocationMode === "manual";
  elements.weatherOptions.classList.toggle("disabled", !preferences.weatherEnabled);
  elements.automaticWeatherMode.disabled = !preferences.weatherEnabled;
  elements.manualWeatherMode.disabled = !preferences.weatherEnabled;
  elements.useCurrentLocation.disabled = !preferences.weatherEnabled || preferences.weatherLocationMode !== "automatic";
  elements.manualLocation.disabled = !preferences.weatherEnabled || preferences.weatherLocationMode !== "manual";
  elements.saveManualLocation.disabled = !preferences.weatherEnabled || preferences.weatherLocationMode !== "manual";
  elements.weatherLocationStatus.textContent = preferences.weatherLocation
    ? `${preferences.weatherLocationMode === "automatic" ? "Locație detectată" : "Locație aleasă"}: ${preferences.weatherLocation.name}`
    : preferences.weatherLocationRequested ? "Locația nu este disponibilă. Poți încerca din nou sau poți scrie un oraș." : "Locația va fi solicitată la prima utilizare.";
  renderChoiceGrid(elements.notificationSourceOptions, state.sources, preferences.notificationSourceIds, "notificationSourceIds");
  renderChoiceGrid(elements.notificationCategoryOptions, state.categories, preferences.notificationCategoryIds, "notificationCategoryIds");
  updateNotificationControls(); renderSourceManager();
}

function renderSourceManager() {
  const byId = new Map(state.sources.map((source) => [source.id, source]));
  const hidden = new Set(state.preferences.hiddenSourceIds);
  const favorites = new Set(state.preferences.favoriteSourceIds);
  const order = state.preferences.sourceOrder.filter((id) => byId.has(id));
  elements.sourceManager.replaceChildren();
  order.forEach((id, index) => {
    const source = byId.get(id); const row = document.createElement("div"); row.className = "source-manager-row";
    const visibleLabel = document.createElement("label"); const visible = document.createElement("input");
    visible.type = "checkbox"; visible.checked = !hidden.has(id); visibleLabel.append(visible, document.createTextNode(source.name));
    const favorite = document.createElement("button"); favorite.type = "button"; favorite.className = "source-icon-button";
    favorite.textContent = favorites.has(id) ? "★" : "☆"; favorite.title = favorites.has(id) ? "Elimină din favorite" : "Adaugă la favorite";
    const up = document.createElement("button"); up.type = "button"; up.className = "source-icon-button"; up.textContent = "↑"; up.title = "Mută mai sus"; up.disabled = index === 0;
    const down = document.createElement("button"); down.type = "button"; down.className = "source-icon-button"; down.textContent = "↓"; down.title = "Mută mai jos"; down.disabled = index === order.length - 1;
    visible.addEventListener("change", async () => {
      if (visible.checked) hidden.delete(id); else hidden.add(id);
      await updatePreferences({ hiddenSourceIds: [...hidden] });
      if (hidden.has(state.selectedSource)) state.selectedSource = "all";
      renderFilters(); renderSourceManager(); await refresh();
    });
    favorite.addEventListener("click", async () => {
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      await updatePreferences({ favoriteSourceIds: [...favorites] }); renderFilters(); renderSourceManager();
    });
    const move = async (offset) => {
      const target = index + offset; [order[index], order[target]] = [order[target], order[index]];
      await updatePreferences({ sourceOrder: order }); renderFilters(); renderSourceManager();
    };
    up.addEventListener("click", () => move(-1)); down.addEventListener("click", () => move(1));
    const actions = document.createElement("div"); actions.className = "source-manager-actions"; actions.append(favorite, up, down);
    row.append(visibleLabel, actions); elements.sourceManager.append(row);
  });
}

function applyFeedResult(result) {
  state.articles = result.articles;
  state.history = new Map(window.articleUtils.mergeArticleHistory([...state.history.values()], result.articles).map((article) => [article.id, article]));
  saveHistory();
  state.fetchedAt = result.fetchedAt; renderArticles();
  elements.status.textContent = `Actualizat ${relativeTime(result.fetchedAt)} · automat la ${state.preferences.refreshIntervalMinutes} minute`;
  elements.errors.hidden = result.errors.length === 0;
  if (result.errors.length) elements.errors.textContent = `Nu s-au putut încărca: ${result.errors.map((error) => error.sourceName).join(", ")}.`;
}

async function openDailyDigest() {
  const articles = await window.newsApi.createDailyDigest();
  elements.digestArticles.replaceChildren();
  elements.digestSubtitle.textContent = articles.length
    ? `${articles.length} știri importante din ultimele 36 de ore, cu prioritate pentru sursele favorite.`
    : "Nu sunt suficiente știri recente pentru rezumat.";
  for (const article of articles) {
    const button = document.createElement("button"); button.type = "button"; button.className = "digest-article";
    const meta = document.createElement("span"); meta.textContent = `${article.sourceName} · ${article.categoryName}`;
    const title = document.createElement("strong"); title.textContent = article.title;
    button.append(meta, title);
    button.addEventListener("click", async () => {
      elements.digestDialog.close(); state.seen.add(article.id); saveSeen(); await openReader(article);
    });
    elements.digestArticles.append(button);
  }
  elements.digestDialog.showModal();
}

async function refresh() {
  elements.refresh.disabled = true; elements.refreshNow.disabled = true; elements.status.textContent = "Se actualizează fluxurile…"; elements.errors.hidden = true;
  try { applyFeedResult(await window.newsApi.refresh()); }
  catch { elements.status.textContent = "Actualizarea nu a reușit."; elements.errors.textContent = "Verifică legătura la internet și încearcă din nou."; elements.errors.hidden = false; }
  finally { elements.refresh.disabled = false; elements.refreshNow.disabled = false; }
}

function setRefreshMenuOpen(open) {
  elements.refreshMenu.hidden = !open;
  elements.refresh.setAttribute("aria-expanded", String(open));
  if (open) elements.refreshNow.focus();
}

elements.search.addEventListener("input", (event) => { state.query = event.target.value; renderArticles(); });
elements.historySearch.addEventListener("change", (event) => { state.historySearch = event.target.checked; renderArticles(); });
elements.dateRange.addEventListener("change", (event) => { state.dateRange = event.target.value; renderArticles(); });
elements.readingStatus.addEventListener("change", (event) => { state.readingStatus = event.target.value; renderArticles(); });
elements.weatherWidget.addEventListener("click", () => setWeatherForecastOpen(elements.weatherForecast.hidden));
elements.closeWeatherForecast.addEventListener("click", () => { setWeatherForecastOpen(false); elements.weatherWidget.focus(); });
elements.todayForecastTab.addEventListener("click", () => setWeatherForecastView("today"));
elements.fiveDayForecastTab.addEventListener("click", () => setWeatherForecastView("five-days"));
elements.refresh.addEventListener("click", () => setRefreshMenuOpen(elements.refreshMenu.hidden));
elements.refreshNow.addEventListener("click", async () => { setRefreshMenuOpen(false); await refresh(); });
document.addEventListener("click", (event) => {
  if (!elements.refreshMenu.hidden && !event.target.closest(".refresh-menu-wrap")) setRefreshMenuOpen(false);
  if (!elements.weatherForecast.hidden && !event.target.closest(".search-weather")) setWeatherForecastOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.refreshMenu.hidden) setRefreshMenuOpen(false);
    if (!elements.weatherForecast.hidden) setWeatherForecastOpen(false);
    return;
  }
  if (event.ctrlKey && event.key === ",") {
    event.preventDefault();
    if (!elements.settingsDialog.open) elements.settingsButton.click();
    return;
  }
  if (event.target.closest("input, textarea, select") || elements.settingsDialog.open || elements.digestDialog.open || document.body.classList.contains("reader-open")) return;
  const key = event.key.toLocaleLowerCase("ro");
  if (key === "/") { event.preventDefault(); elements.search.focus(); }
  else if (key === "r") refresh();
  else if (key === "d") openDailyDigest();
  else if (key === "l" && !elements.localFilter.disabled) elements.localFilter.click();
  else if (key === "g") window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
});
elements.settingsButton.addEventListener("click", () => {
  elements.settingsDialog.showModal();
  document.body.classList.add("settings-open");
  updateSettingsBackToTopVisibility();
});
elements.settingsDialog.addEventListener("close", () => document.body.classList.remove("settings-open"));
elements.settingsDialog.addEventListener("click", (event) => { if (event.target === elements.settingsDialog) elements.settingsDialog.close(); });
elements.digestButton.addEventListener("click", openDailyDigest);
elements.closeDigest.addEventListener("click", () => elements.digestDialog.close());
elements.digestDialog.addEventListener("click", (event) => { if (event.target === elements.digestDialog) elements.digestDialog.close(); });
elements.readerBack.addEventListener("click", closeReader);
elements.backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
});
window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
elements.settingsBackToTop.addEventListener("click", () => {
  elements.settingsCard.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
});
elements.settingsCard.addEventListener("scroll", updateSettingsBackToTopVisibility, { passive: true });
elements.localFilter.addEventListener("click", () => { if (!elements.localFilter.disabled) { state.localOnly = !state.localOnly; renderArticles(); } });
elements.savedFilter.addEventListener("click", () => { state.savedOnly = !state.savedOnly; renderArticles(); });
elements.unreadFilter.addEventListener("click", () => { state.unreadOnly = !state.unreadOnly; renderArticles(); });
elements.markAllRead.addEventListener("click", () => { for (const article of filteredArticles()) state.seen.add(article.id); saveSeen(); renderArticles(); });
elements.trayToggle.addEventListener("change", async (event) => {
  state.minimizeToTray = event.target.checked; localStorage.setItem("minimizeToTray", String(state.minimizeToTray));
  await window.newsApi.setMinimizeToTray(state.minimizeToTray);
});
elements.weatherEnabledToggle.addEventListener("change", async (event) => {
  await updatePreferences({ weatherEnabled: event.target.checked });
  renderSettings();
  if (!event.target.checked) { elements.weatherWidget.hidden = true; setWeatherForecastOpen(false); }
  else if (state.preferences.weatherLocation) loadWeather();
  else if (state.preferences.weatherLocationMode === "automatic") requestAutomaticLocation();
  else showWeatherMessage("Scrie localitatea în Setări");
});
elements.automaticWeatherMode.addEventListener("change", async () => {
  if (!elements.automaticWeatherMode.checked) return;
  await updatePreferences({ weatherLocationMode: "automatic" });
  renderSettings();
  if (state.preferences.weatherLocation) loadWeather(); else requestAutomaticLocation();
});
elements.manualWeatherMode.addEventListener("change", async () => {
  if (!elements.manualWeatherMode.checked) return;
  await updatePreferences({ weatherLocationMode: "manual" });
  renderSettings();
  if (state.preferences.weatherLocation) loadWeather(); else showWeatherMessage("Scrie localitatea în Setări");
  elements.manualLocation.focus();
});
elements.useCurrentLocation.addEventListener("click", requestAutomaticLocation);
elements.saveManualLocation.addEventListener("click", async () => {
  const query = elements.manualLocation.value.trim();
  if (!query) {
    elements.weatherLocationStatus.textContent = "Scrie mai întâi localitatea.";
    return;
  }
  elements.saveManualLocation.disabled = true;
  elements.weatherLocationStatus.textContent = "Se caută localitatea…";
  const result = await window.newsApi.getWeather(query);
  elements.saveManualLocation.disabled = false;
  if (!result.ok) {
    elements.weatherLocationStatus.textContent = "Localitatea nu a fost găsită. Încearcă din nou.";
    return;
  }
  elements.manualLocation.value = "";
  await saveWeatherResult(result.weather, "manual");
});
elements.manualLocation.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); elements.saveManualLocation.click(); }
});
elements.startupToggle.addEventListener("change", async (event) => {
  const requested = event.target.checked; elements.startupToggle.disabled = true; elements.startupHelp.textContent = "Se salvează…";
  try {
    const result = await window.newsApi.setStartAtLogin(requested); elements.startupToggle.checked = result.enabled;
    elements.startupHelp.textContent = result.enabled ? "Aplicația va porni ascunsă în tray după autentificare." : "Aplicația nu va porni automat cu Windows.";
  } catch { elements.startupToggle.checked = !requested; elements.startupHelp.textContent = "Setarea nu a putut fi schimbată."; }
  finally { elements.startupToggle.disabled = false; }
});
elements.notificationsToggle.addEventListener("change", async (event) => { await updatePreferences({ notificationsEnabled: event.target.checked }); updateNotificationControls(); });
elements.notificationKeywords.addEventListener("change", (event) => updatePreferences({ notificationKeywords: event.target.value }));
elements.mutedKeywords.addEventListener("change", async (event) => { await updatePreferences({ mutedKeywords: event.target.value }); renderSettings(); renderArticles(); });
elements.quietHoursToggle.addEventListener("change", (event) => updatePreferences({ quietHoursEnabled: event.target.checked }));
elements.quietHoursStart.addEventListener("change", (event) => updatePreferences({ quietHoursStart: event.target.value }));
elements.quietHoursEnd.addEventListener("change", (event) => updatePreferences({ quietHoursEnd: event.target.value }));
elements.refreshInterval.addEventListener("change", async (event) => { await updatePreferences({ refreshIntervalMinutes: Number(event.target.value) }); renderSettings(); renderArticles(); });
elements.trayRefreshInterval.addEventListener("change", async (event) => { await updatePreferences({ trayRefreshIntervalMinutes: Number(event.target.value) }); renderSettings(); });
elements.quickRefreshInterval.addEventListener("change", async (event) => { await updatePreferences({ refreshIntervalMinutes: Number(event.target.value) }); renderSettings(); renderArticles(); });
elements.quickTrayRefreshInterval.addEventListener("change", async (event) => { await updatePreferences({ trayRefreshIntervalMinutes: Number(event.target.value) }); renderSettings(); });
elements.themeSelect.addEventListener("change", (event) => updatePreferences({ theme: event.target.value }));
elements.fontSizeSelect.addEventListener("change", (event) => updatePreferences({ fontSize: event.target.value }));
elements.densitySelect.addEventListener("change", (event) => updatePreferences({ density: event.target.value }));
elements.exportBackup.addEventListener("click", async () => {
  elements.backupStatus.textContent = "Se exportă backupul…";
  const result = await window.newsApi.exportBackup({
    minimizeToTray: state.minimizeToTray,
    savedArticles: [...state.saved.values()],
    seenArticles: [...state.seen],
    articleHistory: [...state.history.values()]
  });
  elements.backupStatus.textContent = result.ok ? "Backupul a fost exportat." : result.canceled ? "Export anulat." : result.message || "Backupul nu a putut fi exportat.";
});
elements.importBackup.addEventListener("click", async () => {
  elements.backupStatus.textContent = "Se citește backupul…";
  const result = await window.newsApi.importBackup();
  if (!result.ok) {
    elements.backupStatus.textContent = result.canceled ? "Restaurare anulată." : result.message;
    return;
  }
  const backup = result.backup;
  localStorage.setItem("savedArticles", JSON.stringify((Array.isArray(backup.savedArticles) ? backup.savedArticles : []).filter((article) => article?.id).slice(-500)));
  localStorage.setItem("seenArticles", JSON.stringify((Array.isArray(backup.seenArticles) ? backup.seenArticles : []).filter((id) => typeof id === "string").slice(-2_000)));
  localStorage.setItem("articleHistory", JSON.stringify((Array.isArray(backup.articleHistory) ? backup.articleHistory : []).filter((article) => article?.id).slice(0, 2_000)));
  if (typeof backup.minimizeToTray === "boolean") localStorage.setItem("minimizeToTray", String(backup.minimizeToTray));
  await updatePreferences(backup.preferences && typeof backup.preferences === "object" ? backup.preferences : {});
  window.location.reload();
});
elements.updateButton.addEventListener("click", async () => {
  const action = elements.updateButton.dataset.action; elements.updateButton.disabled = true;
  if (action === "download") renderUpdateStatus(await window.newsApi.downloadUpdate());
  else if (action === "install") await window.newsApi.installUpdate();
  else if (action === "check") renderUpdateStatus(await window.newsApi.checkForUpdates());
});

async function init() {
  [state.sources, state.categories, state.preferences] = await Promise.all([
    window.newsApi.listSources(), window.newsApi.listCategories(), window.newsApi.getPreferences()
  ]);
  applyAppearance(); elements.trayToggle.checked = state.minimizeToTray;
  await window.newsApi.setMinimizeToTray(state.minimizeToTray);
  const startup = await window.newsApi.getStartAtLogin();
  elements.startupToggle.checked = startup.enabled; elements.startupToggle.disabled = !startup.supported;
  if (!startup.supported) elements.startupHelp.textContent = "Opțiunea devine disponibilă în versiunea instalată pe Windows.";
  renderSettings(); window.newsApi.onUpdateStatus(renderUpdateStatus);
  initializeWeather();
  renderUpdateStatus(await window.newsApi.getUpdateStatus()); window.newsApi.onFeedsUpdated(applyFeedResult);
  renderFilters(); renderCategoryFilters(); await refresh();
}

init();
