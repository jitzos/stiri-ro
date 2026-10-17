const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "StiriRO/0.0.1 (+desktop RSS reader)",
    Accept: "application/rss+xml, application/xml, text/xml"
  }
});

const SOURCES = [
  {
    id: "digi24",
    name: "Digi24",
    feedUrl: "https://www.digi24.ro/rss",
    homepage: "https://www.digi24.ro",
    color: "#1f5fbf"
  },
  {
    id: "antena3",
    name: "Antena 3 CNN",
    feedUrl: "https://www.antena3.ro/rss",
    homepage: "https://www.antena3.ro",
    color: "#b20d30"
  },
  {
    id: "stiripesurse",
    name: "Știripesurse",
    feedUrl: "https://www.stiripesurse.ro/rss/stiri.xml",
    homepage: "https://www.stiripesurse.ro",
    color: "#d94820"
  },
  {
    id: "b1tv",
    name: "B1TV",
    feedUrl: "https://www.b1tv.ro/feed",
    homepage: "https://www.b1tv.ro",
    color: "#ed1c24"
  },
  {
    id: "hotnews",
    name: "HotNews",
    feedUrl: "https://hotnews.ro/feed",
    homepage: "https://hotnews.ro",
    color: "#e62b2f"
  },
  {
    id: "g4media",
    name: "G4Media",
    feedUrl: "https://www.g4media.ro/feed",
    homepage: "https://www.g4media.ro",
    color: "#244a78"
  },
  {
    id: "adevarul",
    name: "Adevărul",
    feedUrl: "https://adevarul.ro/rss/index",
    homepage: "https://adevarul.ro",
    color: "#1f1f1f"
  },
  {
    id: "libertatea",
    name: "Libertatea",
    feedUrl: "https://www.libertatea.ro/feed",
    homepage: "https://www.libertatea.ro",
    color: "#e52329"
  },
  {
    id: "mediafax",
    name: "Mediafax",
    feedUrl: "https://www.mediafax.ro/feed",
    homepage: "https://www.mediafax.ro",
    color: "#1366b1"
  },
  {
    id: "stirileprotv",
    name: "Știrile ProTV",
    feedUrl: "https://stirileprotv.ro/rss/",
    homepage: "https://stirileprotv.ro",
    color: "#1769aa"
  },
  {
    id: "observator",
    name: "Observator News",
    feedUrl: "https://observatornews.ro/rss/",
    homepage: "https://observatornews.ro",
    color: "#f04a24"
  },
  {
    id: "rfi",
    name: "RFI România",
    feedUrl: "https://www.rfi.fr/ro/rss",
    homepage: "https://www.rfi.ro",
    color: "#e2001a"
  },
  {
    id: "economica",
    name: "Economica.net",
    feedUrl: "https://www.economica.net/feed",
    homepage: "https://www.economica.net",
    color: "#14745a"
  },
  {
    id: "gsp",
    name: "Gazeta Sporturilor",
    feedUrl: "https://www.gsp.ro/rss.xml",
    homepage: "https://www.gsp.ro",
    color: "#e55325"
  },
  {
    id: "prosport",
    name: "ProSport",
    feedUrl: "https://www.prosport.ro/feed",
    homepage: "https://www.prosport.ro",
    color: "#d71920"
  },
  {
    id: "spotmedia",
    name: "SpotMedia",
    feedUrl: "https://spotmedia.ro/feed",
    homepage: "https://spotmedia.ro",
    color: "#744a90"
  },
  {
    id: "recorder",
    name: "Recorder",
    feedUrl: "https://recorder.ro/feed/",
    homepage: "https://recorder.ro",
    color: "#111111"
  },
  {
    id: "descopera",
    name: "Descoperă",
    feedUrl: "https://www.descopera.ro/feed",
    homepage: "https://www.descopera.ro",
    color: "#177f86"
  },
  {
    id: "cotidianul",
    name: "Cotidianul",
    feedUrl: "https://www.cotidianul.ro/feed/",
    homepage: "https://www.cotidianul.ro",
    color: "#7a1f28"
  },
  {
    id: "context",
    name: "Context.ro",
    feedUrl: "https://context.ro/feed/",
    homepage: "https://context.ro",
    color: "#563f8d"
  },
  {
    id: "edupedu",
    name: "Edupedu",
    feedUrl: "https://www.edupedu.ro/feed/",
    homepage: "https://www.edupedu.ro",
    color: "#146ca5"
  },
  {
    id: "autocritica",
    name: "Autocritica",
    feedUrl: "https://www.autocritica.ro/feed/",
    homepage: "https://www.autocritica.ro",
    color: "#2f3d46"
  },
  {
    id: "defapt",
    name: "DeFapt.ro",
    feedUrl: "https://defapt.ro/rss",
    homepage: "https://defapt.ro",
    color: "#bc2026"
  },
  {
    id: "buletindebucuresti",
    name: "Buletin de București",
    feedUrl: "https://buletin.de/bucuresti/feed/",
    homepage: "https://buletin.de/bucuresti",
    color: "#415f72"
  }
];

const CATEGORIES = [
  { id: "actualitate", name: "Actualitate" },
  { id: "politica", name: "Politică" },
  { id: "economie", name: "Economie" },
  { id: "externe", name: "Externe" },
  { id: "societate", name: "Societate" },
  { id: "sanatate", name: "Sănătate" },
  { id: "sport", name: "Sport" },
  { id: "tehnologie", name: "Tehnologie" },
  { id: "cultura", name: "Cultură & lifestyle" }
];

const CATEGORY_RULES = [
  ["sport", /\b(sport|fotbal|tenis|handbal|baschet|formula 1|champions league|liga 1)\b/],
  ["sanatate", /\b(sanatate|medical|medicina|medic|spital|pacient|covid|boala|vaccin)\b/],
  ["tehnologie", /\b(tehnologie|stiinta|gadget|software|internet|cyber|spatiu|inteligenta artificiala)\b/],
  ["economie", /\b(economie|economic|finante|financiar|bani|business|companii|bursa|banci|energie|carburanti|taxe|impozit)\b/],
  ["externe", /\b(externe|international|ucraina|rusia|sua|statele unite|europa|nato|trump|zelenski|orientul mijlociu)\b/],
  ["politica", /\b(politica|guvern|parlament|presedinte|ministru|alegeri|psd|pnl|usr|aur|udmr|cotroceni)\b/],
  ["cultura", /\b(cultura|media|monden|showbiz|film|muzica|vedete|lifestyle|life|turism|vacanta)\b/],
  ["societate", /\b(social|societate|eveniment|educatie|scoala|justitie|politie|meteo|vreme|bucuresti|locale|actualitate)\b/]
];

function searchableText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classifyCategory(item) {
  const rssCategories = Array.isArray(item.categories) ? item.categories.join(" ") : "";
  const haystack = searchableText(`${rssCategories} ${item.link || ""} ${item.title || ""}`);
  const match = CATEGORY_RULES.find(([, pattern]) => pattern.test(haystack));
  const id = match?.[0] || "actualitate";
  return CATEGORIES.find((category) => category.id === id);
}

function cleanText(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHttpUrl(value, baseUrl) {
  if (!value) return null;

  try {
    const url = new URL(value, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function imageFromHtml(html, baseUrl) {
  const match = String(html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return safeHttpUrl(match?.[1], baseUrl);
}

function extractImage(item, baseUrl) {
  const enclosure = item.enclosure?.url;
  const media = item["media:content"]?.$?.url || item["media:thumbnail"]?.$?.url;
  return (
    safeHttpUrl(enclosure, baseUrl) ||
    safeHttpUrl(media, baseUrl) ||
    imageFromHtml(item["content:encoded"] || item.content || item.description, baseUrl)
  );
}

function normalizeItem(item, source) {
  const link = safeHttpUrl(item.link || item.guid, source.homepage);
  if (!link || !item.title) return null;
  const itemKey = typeof item.guid === "string" ? item.guid : link;

  const rawDescription = item.contentSnippet || item.content || item.description || "";
  const publishedAt = item.isoDate || item.pubDate || null;

  const category = classifyCategory(item);

  return {
    id: `${source.id}:${itemKey}`,
    sourceId: source.id,
    sourceName: source.name,
    sourceColor: source.color,
    categoryId: category.id,
    categoryName: category.name,
    title: cleanText(item.title),
    excerpt: cleanText(rawDescription).slice(0, 240),
    link,
    image: extractImage(item, source.homepage),
    publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt))
      ? new Date(publishedAt).toISOString()
      : null
  };
}

async function fetchSource(source) {
  const response = await fetch(source.feedUrl, {
    headers: parser.options.headers,
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const feed = await parser.parseString(xml);
  const articles = feed.items
    .map((item) => normalizeItem(item, source))
    .filter(Boolean)
    .slice(0, 60);

  return { sourceId: source.id, articles };
}

async function fetchAllFeeds(sources = SOURCES) {
  const settled = await Promise.allSettled(sources.map(fetchSource));
  const articles = [];
  const errors = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value.articles);
    } else {
      errors.push({
        sourceId: sources[index].id,
        sourceName: sources[index].name,
        message: result.reason?.message || "Feed indisponibil"
      });
    }
  });

  const unique = [...new Map(articles.map((article) => [article.link, article])).values()];
  unique.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));

  return {
    articles: unique,
    errors,
    fetchedAt: new Date().toISOString()
  };
}

module.exports = { SOURCES, CATEGORIES, cleanText, classifyCategory, normalizeItem, fetchAllFeeds };
