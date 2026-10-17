const state = {
  articles: [],
  sources: [],
  categories: [],
  selectedSource: "all",
  selectedCategory: "all",
  query: "",
  fetchedAt: null,
  minimizeToTray: localStorage.getItem("minimizeToTray") !== "false",
  seen: new Set(JSON.parse(localStorage.getItem("seenArticles") || "[]")),
  feedScrollY: 0
};

const elements = {
  grid: document.querySelector("#articleGrid"),
  template: document.querySelector("#articleTemplate"),
  filters: document.querySelector("#sourceFilters"),
  categoryFilters: document.querySelector("#categoryFilters"),
  search: document.querySelector("#searchInput"),
  refresh: document.querySelector("#refreshButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  trayToggle: document.querySelector("#trayToggle"),
  startupToggle: document.querySelector("#startupToggle"),
  startupHelp: document.querySelector("#startupHelp"),
  updateStatus: document.querySelector("#updateStatus"),
  updateButton: document.querySelector("#updateButton"),
  status: document.querySelector("#statusText"),
  count: document.querySelector("#articleCount"),
  title: document.querySelector("#feedTitle"),
  errors: document.querySelector("#errorBanner"),
  empty: document.querySelector("#emptyState"),
  readerToolbar: document.querySelector("#readerToolbar"),
  readerBack: document.querySelector("#readerBackButton"),
  readerTitle: document.querySelector("#readerTitle"),
  readerSource: document.querySelector("#readerSource")
};

async function closeReader() {
  await window.newsApi.closeArticle();
  document.body.classList.remove("reader-open");
  elements.readerToolbar.hidden = true;
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
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "minute") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
}

function renderUpdateStatus(status) {
  elements.updateStatus.textContent = status.message;
  elements.updateButton.disabled = !status.supported || ["checking", "downloading"].includes(status.phase);

  if (!status.supported) {
    elements.updateButton.textContent = "Indisponibil";
    elements.updateButton.dataset.action = "none";
  } else if (status.phase === "available") {
    elements.updateButton.textContent = "Descarcă actualizarea";
    elements.updateButton.dataset.action = "download";
  } else if (status.phase === "downloaded") {
    elements.updateButton.textContent = "Repornește și instalează";
    elements.updateButton.dataset.action = "install";
  } else if (status.phase === "downloading") {
    elements.updateButton.textContent = `${status.percent ?? 0}%`;
    elements.updateButton.dataset.action = "none";
  } else {
    elements.updateButton.textContent = status.phase === "checking" ? "Se verifică…" : "Verifică acum";
    elements.updateButton.dataset.action = "check";
  }
}

function filteredArticles() {
  const query = state.query.trim().toLocaleLowerCase("ro");
  return state.articles.filter((article) => {
    const sourceMatches = state.selectedSource === "all" || article.sourceId === state.selectedSource;
    const categoryMatches = state.selectedCategory === "all" || article.categoryId === state.selectedCategory;
    const textMatches = !query || `${article.title} ${article.excerpt}`.toLocaleLowerCase("ro").includes(query);
    return sourceMatches && categoryMatches && textMatches;
  });
}

function saveSeen() {
  localStorage.setItem("seenArticles", JSON.stringify([...state.seen].slice(-500)));
}

function renderArticles() {
  const articles = filteredArticles();
  elements.grid.replaceChildren();

  for (const article of articles) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".article-card");
    const button = fragment.querySelector(".card-link");
    const image = fragment.querySelector(".article-image");
    const fallback = fragment.querySelector(".image-fallback");
    const badge = fragment.querySelector(".source-badge");
    const categoryBadge = fragment.querySelector(".category-badge");
    const time = fragment.querySelector(".published-at");

    fragment.querySelector(".article-title").textContent = article.title;
    fragment.querySelector(".article-excerpt").textContent = article.excerpt || "Deschide articolul pentru detalii.";
    badge.textContent = article.sourceName;
    badge.style.color = article.sourceColor;
    categoryBadge.textContent = article.categoryName;
    time.textContent = relativeTime(article.publishedAt);
    time.dateTime = article.publishedAt || "";
    fallback.textContent = article.sourceName.charAt(0);
    card.classList.toggle("seen", state.seen.has(article.id));

    if (article.image) {
      image.src = article.image;
      image.addEventListener("error", () => image.remove());
    } else {
      image.remove();
    }

    button.setAttribute("aria-label", `Deschide: ${article.title}`);
    button.addEventListener("click", async () => {
      state.seen.add(article.id);
      saveSeen();
      card.classList.add("seen");
      await openReader(article);
    });

    elements.grid.append(fragment);
  }

  elements.count.textContent = `${articles.length} ${articles.length === 1 ? "articol" : "articole"}`;
  elements.empty.hidden = articles.length > 0;
  elements.grid.hidden = articles.length === 0;
}

function renderFilters() {
  const options = [{ id: "all", name: "Toate" }, ...state.sources];
  elements.filters.replaceChildren();

  for (const source of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = source.name;
    button.classList.toggle("active", source.id === state.selectedSource);
    button.addEventListener("click", () => {
      state.selectedSource = source.id;
      elements.title.textContent = source.id === "all" ? "Ultimele știri" : source.name;
      renderFilters();
      renderArticles();
    });
    elements.filters.append(button);
  }
}

function renderCategoryFilters() {
  const options = [{ id: "all", name: "Toate" }, ...state.categories];
  elements.categoryFilters.replaceChildren();

  for (const category of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-button";
    button.textContent = category.name;
    button.classList.toggle("active", category.id === state.selectedCategory);
    button.addEventListener("click", () => {
      state.selectedCategory = category.id;
      renderCategoryFilters();
      renderArticles();
    });
    elements.categoryFilters.append(button);
  }
}

function applyFeedResult(result) {
  state.articles = result.articles;
  state.fetchedAt = result.fetchedAt;
  renderArticles();
  elements.status.textContent = `Actualizat ${relativeTime(result.fetchedAt)} · automat la 10 minute, sau 5 minute în tray`;
  elements.errors.hidden = result.errors.length === 0;

  if (result.errors.length) {
    elements.errors.textContent = `Nu s-au putut încărca: ${result.errors.map((error) => error.sourceName).join(", ")}.`;
  }
}

async function refresh() {
  elements.refresh.disabled = true;
  elements.status.textContent = "Se actualizează fluxurile…";
  elements.errors.hidden = true;

  try {
    applyFeedResult(await window.newsApi.refresh());
  } catch (error) {
    elements.status.textContent = "Actualizarea nu a reușit.";
    elements.errors.textContent = "Verifică legătura la internet și încearcă din nou.";
    elements.errors.hidden = false;
  } finally {
    elements.refresh.disabled = false;
  }
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderArticles();
});

elements.refresh.addEventListener("click", refresh);
elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
elements.settingsDialog.addEventListener("click", (event) => {
  if (event.target === elements.settingsDialog) elements.settingsDialog.close();
});
elements.readerBack.addEventListener("click", closeReader);
elements.trayToggle.addEventListener("change", async (event) => {
  state.minimizeToTray = event.target.checked;
  localStorage.setItem("minimizeToTray", String(state.minimizeToTray));
  await window.newsApi.setMinimizeToTray(state.minimizeToTray);
});

async function init() {
  state.sources = await window.newsApi.listSources();
  state.categories = await window.newsApi.listCategories();
  elements.trayToggle.checked = state.minimizeToTray;
  await window.newsApi.setMinimizeToTray(state.minimizeToTray);
  const startup = await window.newsApi.getStartAtLogin();
  elements.startupToggle.checked = startup.enabled;
  elements.startupToggle.disabled = !startup.supported;
  if (!startup.supported) {
    elements.startupHelp.textContent = "Opțiunea devine disponibilă în versiunea instalată pe Windows.";
  }
  window.newsApi.onUpdateStatus(renderUpdateStatus);
  renderUpdateStatus(await window.newsApi.getUpdateStatus());
  window.newsApi.onFeedsUpdated(applyFeedResult);
  renderFilters();
  renderCategoryFilters();
  await refresh();
}

elements.startupToggle.addEventListener("change", async (event) => {
  const requested = event.target.checked;
  elements.startupToggle.disabled = true;
  elements.startupHelp.textContent = "Se salvează…";

  try {
    const result = await window.newsApi.setStartAtLogin(requested);
    elements.startupToggle.checked = result.enabled;
    elements.startupHelp.textContent = result.enabled
      ? "Aplicația va porni ascunsă în tray după autentificare."
      : "Aplicația nu va porni automat cu Windows.";
  } catch {
    elements.startupToggle.checked = !requested;
    elements.startupHelp.textContent = "Setarea nu a putut fi schimbată.";
  } finally {
    elements.startupToggle.disabled = false;
  }
});

elements.updateButton.addEventListener("click", async () => {
  const action = elements.updateButton.dataset.action;
  elements.updateButton.disabled = true;
  if (action === "download") renderUpdateStatus(await window.newsApi.downloadUpdate());
  else if (action === "install") await window.newsApi.installUpdate();
  else if (action === "check") renderUpdateStatus(await window.newsApi.checkForUpdates());
});

init();
