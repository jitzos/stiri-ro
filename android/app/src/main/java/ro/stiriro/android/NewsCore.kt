package ro.stiriro.android

import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

data class NewsSource(val id: String, val name: String, val feed: String)
data class Article(
    val id: String,
    val title: String,
    val link: String,
    val excerpt: String,
    val publishedAt: Long,
    val imageURL: String?,
    val sourceID: String,
    val sourceName: String,
    val categoryID: String
)
data class ReadingEvent(val id: String, val articleId: String, val at: String)
data class RankedArticle(val article: Article, val sources: Int, val score: Double)
data class Forecast(val place: String, val current: Int, val description: String, val hours: List<Pair<String, Int>>, val days: List<Pair<String, String>>)

object Catalog {
    val categories = linkedMapOf(
        "actualitate" to "Actualitate", "politica" to "Politică",
        "economie" to "Economie", "externe" to "Externe",
        "societate" to "Societate", "sanatate" to "Sănătate",
        "sport" to "Sport", "tehnologie" to "Tehnologie",
        "cultura" to "Cultură & lifestyle"
    )
    // Keep IDs and feed URLs aligned with ios/StiriRO/Models.swift.
    val sources = listOf(
        NewsSource("digi24", "Digi24", "https://www.digi24.ro/rss"),
        NewsSource("antena3", "Antena 3 CNN", "https://www.antena3.ro/rss"),
        NewsSource("stiripesurse", "Știripesurse", "https://www.stiripesurse.ro/rss/stiri.xml"),
        NewsSource("b1tv", "B1TV", "https://www.b1tv.ro/feed"),
        NewsSource("hotnews", "HotNews", "https://hotnews.ro/feed"),
        NewsSource("g4media", "G4Media", "https://www.g4media.ro/feed"),
        NewsSource("adevarul", "Adevărul", "https://adevarul.ro/rss/index"),
        NewsSource("libertatea", "Libertatea", "https://www.libertatea.ro/feed"),
        NewsSource("mediafax", "Mediafax", "https://www.mediafax.ro/feed"),
        NewsSource("stirileprotv", "Știrile ProTV", "https://stirileprotv.ro/rss/"),
        NewsSource("observator", "Observator News", "https://observatornews.ro/rss/"),
        NewsSource("rfi", "RFI România", "https://www.rfi.fr/ro/rss"),
        NewsSource("economica", "Economica.net", "https://www.economica.net/feed"),
        NewsSource("gsp", "Gazeta Sporturilor", "https://www.gsp.ro/rss.xml"),
        NewsSource("prosport", "ProSport", "https://www.prosport.ro/feed"),
        NewsSource("spotmedia", "SpotMedia", "https://spotmedia.ro/feed"),
        NewsSource("recorder", "Recorder", "https://recorder.ro/feed/"),
        NewsSource("descopera", "Descoperă", "https://www.descopera.ro/feed"),
        NewsSource("cotidianul", "Cotidianul", "https://www.cotidianul.ro/feed/"),
        NewsSource("context", "Context.ro", "https://context.ro/feed/"),
        NewsSource("edupedu", "Edupedu", "https://www.edupedu.ro/feed/"),
        NewsSource("autocritica", "Autocritica", "https://www.autocritica.ro/feed/"),
        NewsSource("defapt", "DeFapt.ro", "https://defapt.ro/rss"),
        NewsSource("buletindebucuresti", "Buletin de București", "https://buletin.de/bucuresti/feed/")
    )
}

object NewsLogic {
    fun normalize(input: String) = Normalizer.normalize(input, Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT)
    fun content(item: Article) = normalize(item.title + " " + item.excerpt)
    fun matches(item: Article, terms: List<String>) = terms.any { it.isNotBlank() && content(item).contains(normalize(it.trim())) }
    fun classify(text: String): String {
        val t = normalize(text)
        val rules = listOf(
            "sport" to listOf("sport", "fotbal", "tenis", "handbal", "baschet"),
            "sanatate" to listOf("sanatate", "medical", "medic", "spital", "pacient"),
            "tehnologie" to listOf("tehnologie", "stiinta", "software", "internet", "inteligenta artificiala"),
            "economie" to listOf("economie", "finante", "business", "bursa", "energie", "taxe"),
            "externe" to listOf("externe", "international", "ucraina", "rusia", "nato"),
            "politica" to listOf("politica", "guvern", "parlament", "presedinte", "ministru", "alegeri"),
            "cultura" to listOf("cultura", "film", "muzica", "lifestyle", "turism"),
            "societate" to listOf("societate", "educatie", "scoala", "justitie", "politie", "meteo")
        )
        return rules.firstOrNull { (_, keys) -> keys.any(t::contains) }?.first ?: "actualitate"
    }
    fun top10(items: List<Article>, favorites: Set<String>, now: Long = System.currentTimeMillis()): List<RankedArticle> {
        val stop = setOf("pentru","despre","dupa","intre","acesta","aceasta","care","sunt","este","din","prin","fost","unui","unei","romania")
        fun tokens(title: String) = normalize(title).split(Regex("[^a-z0-9]+"))
            .filter { it.length >= 4 && it !in stop }.toSet()
        data class Group(val main: Article, val terms: Set<String>, val sources: MutableSet<String>)
        val groups = mutableListOf<Group>()
        items.distinctBy { it.id }.filter { it.publishedAt > now - 36 * 3600_000 && it.publishedAt <= now + 3600_000 }
            .sortedByDescending { it.publishedAt }.take(1500).forEach { item ->
                val terms = tokens(item.title)
                val existing = if (terms.size >= 3) groups.firstOrNull { group ->
                    val overlap = (terms intersect group.terms).size
                    overlap >= 3 && overlap.toDouble() / minOf(terms.size, group.terms.size) >= 0.65
                } else null
                if (existing == null) groups.add(Group(item, terms, mutableSetOf(item.sourceID)))
                else existing.sources.add(item.sourceID)
            }
        return groups.map { group ->
            val age = (now - group.main.publishedAt).coerceAtLeast(0) / 3_600_000.0
            val points = (36 - age).coerceAtLeast(0.0) + 14 * (group.sources.size - 1).coerceAtMost(4) +
                (if (group.main.sourceID in favorites) 6 else 0)
            RankedArticle(group.main, group.sources.size, points)
        }.sortedWith(compareByDescending<RankedArticle> { it.score }.thenByDescending { it.article.publishedAt }).take(10)
    }
    fun digest(items: List<Article>, favorites: Set<String>, now: Long = System.currentTimeMillis()): List<Article> {
        val counts = mutableMapOf<String, Int>()
        return items.filter { it.publishedAt >= now - 36 * 3600_000 }.sortedWith(
            compareByDescending<Article> { it.sourceID in favorites }.thenByDescending { it.publishedAt }
        ).filter { item ->
            val count = counts.getOrDefault(item.sourceID, 0)
            if (count >= 2) false else { counts[item.sourceID] = count + 1; true }
        }.take(10)
    }
}

object NewsNetwork {
    private fun connection(url: String): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 10_000
        c.readTimeout = 15_000
        c.setRequestProperty("User-Agent", "StiriRO-Android/0.0.10")
        c.setRequestProperty("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")
        return c
    }
    private fun clean(s: String) = android.text.Html.fromHtml(s, android.text.Html.FROM_HTML_MODE_LEGACY)
        .toString().replace(Regex("\\s+"), " ").trim()
    private fun date(raw: String): Long {
        try { return Instant.parse(raw).toEpochMilli() } catch (_: Exception) {}
        try { return OffsetDateTime.parse(raw).toInstant().toEpochMilli() } catch (_: Exception) {}
        for (f in listOf("EEE, dd MMM yyyy HH:mm:ss Z", "EEE, d MMM yyyy HH:mm:ss Z", "yyyy-MM-dd HH:mm:ss Z")) {
            try {
                val parsed = java.text.SimpleDateFormat(f, Locale.US).parse(raw)
                if (parsed != null) return parsed.time
            } catch (_: Exception) {}
        }
        return 0
    }
    private fun parse(source: NewsSource): List<Article> {
        val conn = connection(source.feed)
        try {
            if (conn.responseCode !in 200..299) return emptyList()
            conn.inputStream.use { input ->
                val parser = Xml.newPullParser()
                parser.setInput(input, "UTF-8")
                var inItem = false
                var title = ""; var link = ""; var guid = ""; var summary = ""; var pubDate = ""; var image = ""
                var categories = ""
                val results = mutableListOf<Article>()
                while (parser.eventType != XmlPullParser.END_DOCUMENT) {
                    val name = parser.name?.lowercase(Locale.ROOT) ?: ""
                    if (parser.eventType == XmlPullParser.START_TAG) {
                        when (name) {
                            "item", "entry" -> {
                                inItem = true; title = ""; link = ""; guid = ""; summary = ""; pubDate = ""; image = ""; categories = ""
                            }
                            "enclosure", "thumbnail", "media:thumbnail", "media:content" -> if (inItem && image.isEmpty()) {
                                image = parser.getAttributeValue(null, "url") ?: ""
                            }
                            "link" -> if (inItem) {
                                val href = parser.getAttributeValue(null, "href")
                                if (!href.isNullOrBlank() && (parser.getAttributeValue(null, "rel") ?: "") != "self") link = href
                                else if (link.isEmpty()) link = parser.nextText().trim()
                            }
                            "title" -> if (inItem) title = clean(parser.nextText())
                            "guid", "id" -> if (inItem) guid = parser.nextText().trim()
                            "description", "summary", "content:encoded" -> if (inItem) summary = clean(parser.nextText()).take(1000)
                            "pubdate", "published", "updated", "dc:date" -> if (inItem) pubDate = parser.nextText().trim()
                            "category" -> if (inItem) categories += " " + parser.nextText()
                        }
                    } else if (parser.eventType == XmlPullParser.END_TAG && name in listOf("item", "entry")) {
                        inItem = false
                        val url = link.ifBlank { guid }
                        val valid = try { URL(url).protocol in listOf("https", "http") } catch (_: Exception) { false }
                        if (title.isNotBlank() && valid) {
                            results.add(Article(guid.ifBlank { url }, title, url, summary, date(pubDate),
                                image.takeIf { it.startsWith("https://") }, source.id, source.name,
                                NewsLogic.classify(categories + " " + title + " " + url)))
                        }
                    }
                    parser.next()
                }
                return results.take(50)
            }
        } finally { conn.disconnect() }
    }
    fun fetchAll(sources: List<NewsSource> = Catalog.sources): Pair<List<Article>, List<String>> {
        val executor = Executors.newFixedThreadPool(6)
        try {
            val tasks = sources.map { source -> source to executor.submit<List<Article>> { parse(source) } }
            val out = mutableListOf<Article>()
            val failed = mutableListOf<String>()
            for ((source, future) in tasks) {
                try { out.addAll(future.get(25, TimeUnit.SECONDS)) }
                catch (_: Exception) { failed.add(source.name); future.cancel(true) }
            }
            return out.distinctBy { it.link }.sortedByDescending { it.publishedAt } to failed
        } finally { executor.shutdownNow() }
    }
}
