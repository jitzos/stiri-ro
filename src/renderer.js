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
  unreadOnly: false, savedOnly: false, feedScrollY: 0
};

const elements = {
  grid: document.querySelector("#articleGrid"), template: document.querySelector("#articleTemplate"),
  filters: document.querySelector("#sourceFilters"), categoryFilters: document.querySelector("#categoryFilters"),
  search: document.querySelector("#searchInput"), refresh: document.querySelector("#refreshButton"),
  settingsButton: document.querySelector("#settingsButton"), settingsDialog: document.querySelector("#settingsDialog"),
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
  updateStatus: document.querySelector("#updateStatus"), updateButton: document.querySelector("#updateButton"),
  appVersion: document.querySelector("#appVersion"), status: document.querySelector("#statusText"),
  count: document.querySelector("#articleCount"), title: document.querySelector("#feedTitle"),
  errors: document.querySelector("#errorBanner"), empty: document.querySelector("#emptyState"),
  savedFilter: document.querySelector("#savedFilterButton"), unreadFilter: document.querySelector("#unreadFilterButton"),
  markAllRead: document.querySelector("#markAllReadButton"), readerToolbar: document.querySelector("#readerToolbar"),
  readerBack: document.querySelector("#readerBackButton"), readerTitle: document.querySelector("#readerTitle"),
  readerSource: document.querySelector("#readerSource")
};

async function closeReader() {
  await window.newsApi.closeArticle();
  document.body.classList.remove("reader-open");
  elements.readerToolbar.hidden = true;
  renderArticles();
  requestAnimationFrame(() => window.scrollTo(0, state.feedScrollY));
}

async function openReader(article) {
  state.feedScrollY = window.scrollY;
  elements.readerTitle.textContent = article.title;
  elements.readerSource.textContent = article.sourceName;
  elements.readerToolbar.hidden = false;
  document.body.classList.add("reader-open");
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
  const query = state.query.trim().toLocaleLowerCase("ro");
  const articles = state.savedOnly ? [...state.saved.values()] : state.articles;
  return articles.filter((article) => {
    const sourceMatches = state.selectedSource === "all" || article.sourceId === state.selectedSource;
    const categoryMatches = state.selectedCategory === "all" || article.categoryId === state.selectedCategory;
    const textMatches = !query || `${article.title} ${article.excerpt}`.toLocaleLowerCase("ro").includes(query);
    return sourceMatches && categoryMatches && textMatches && (!state.unreadOnly || !state.seen.has(article.id));
  });
}

function updateFeedTitle() {
  if (state.savedOnly) elements.title.textContent = "Articole salvate";
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
    : enabled ? "Anunță știrile noi după actualizarea fluxurilor." : "Notificările pentru știrile noi sunt oprite.";
}

function renderSettings() {
  const preferences = state.preferences;
  elements.notificationKeywords.value = preferences.notificationKeywords;
  elements.quietHoursToggle.checked = preferences.quietHoursEnabled;
  elements.quietHoursStart.value = preferences.quietHoursStart;
  elements.quietHoursEnd.value = preferences.quietHoursEnd;
  elements.refreshInterval.value = String(preferences.refreshIntervalMinutes);
  elements.trayRefreshInterval.value = String(preferences.trayRefreshIntervalMinutes);
  elements.themeSelect.value = preferences.theme;
  elements.fontSizeSelect.value = preferences.fontSize;
  elements.densitySelect.value = preferences.density;
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
  state.articles = result.articles; state.fetchedAt = result.fetchedAt; renderArticles();
  elements.status.textContent = `Actualizat ${relativeTime(result.fetchedAt)} · automat la ${state.preferences.refreshIntervalMinutes} minute`;
  elements.errors.hidden = result.errors.length === 0;
  if (result.errors.length) elements.errors.textContent = `Nu s-au putut încărca: ${result.errors.map((error) => error.sourceName).join(", ")}.`;
}

async function refresh() {
  elements.refresh.disabled = true; elements.status.textContent = "Se actualizează fluxurile…"; elements.errors.hidden = true;
  try { applyFeedResult(await window.newsApi.refresh()); }
  catch { elements.status.textContent = "Actualizarea nu a reușit."; elements.errors.textContent = "Verifică legătura la internet și încearcă din nou."; elements.errors.hidden = false; }
  finally { elements.refresh.disabled = false; }
}

elements.search.addEventListener("input", (event) => { state.query = event.target.value; renderArticles(); });
elements.refresh.addEventListener("click", refresh);
elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
elements.settingsDialog.addEventListener("click", (event) => { if (event.target === elements.settingsDialog) elements.settingsDialog.close(); });
elements.readerBack.addEventListener("click", closeReader);
elements.savedFilter.addEventListener("click", () => { state.savedOnly = !state.savedOnly; renderArticles(); });
elements.unreadFilter.addEventListener("click", () => { state.unreadOnly = !state.unreadOnly; renderArticles(); });
elements.markAllRead.addEventListener("click", () => { for (const article of filteredArticles()) state.seen.add(article.id); saveSeen(); renderArticles(); });
elements.trayToggle.addEventListener("change", async (event) => {
  state.minimizeToTray = event.target.checked; localStorage.setItem("minimizeToTray", String(state.minimizeToTray));
  await window.newsApi.setMinimizeToTray(state.minimizeToTray);
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
elements.quietHoursToggle.addEventListener("change", (event) => updatePreferences({ quietHoursEnabled: event.target.checked }));
elements.quietHoursStart.addEventListener("change", (event) => updatePreferences({ quietHoursStart: event.target.value }));
elements.quietHoursEnd.addEventListener("change", (event) => updatePreferences({ quietHoursEnd: event.target.value }));
elements.refreshInterval.addEventListener("change", async (event) => { await updatePreferences({ refreshIntervalMinutes: Number(event.target.value) }); renderArticles(); });
elements.trayRefreshInterval.addEventListener("change", (event) => updatePreferences({ trayRefreshIntervalMinutes: Number(event.target.value) }));
elements.themeSelect.addEventListener("change", (event) => updatePreferences({ theme: event.target.value }));
elements.fontSizeSelect.addEventListener("change", (event) => updatePreferences({ fontSize: event.target.value }));
elements.densitySelect.addEventListener("change", (event) => updatePreferences({ density: event.target.value }));
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
  renderUpdateStatus(await window.newsApi.getUpdateStatus()); window.newsApi.onFeedsUpdated(applyFeedResult);
  renderFilters(); renderCategoryFilters(); await refresh();
}

init();
