package ro.stiriro.android

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

class NewsStore(context: Context) {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences("stiriro_android", Context.MODE_PRIVATE)
    val articles = mutableStateListOf<Article>()
    val history = mutableStateListOf<Article>()
    val saved = mutableStateListOf<String>()
    val read = mutableStateListOf<String>()
    val events = mutableStateListOf<ReadingEvent>()
    val followed = mutableStateListOf<String>()
    val muted = mutableStateListOf<String>()
    val favorites = mutableStateListOf<String>()
    val hidden = mutableStateListOf<String>()
    var notificationsEnabled by mutableStateOf(prefs.getBoolean("notificationsEnabled", true))
    var quietEnabled by mutableStateOf(prefs.getBoolean("quietEnabled", false))
    var quietStart by mutableStateOf(prefs.getInt("quietStart", 22))
    var quietEnd by mutableStateOf(prefs.getInt("quietEnd", 8))
    var refreshMinutes by mutableStateOf(prefs.getInt("refreshMinutes", 15))
    var darkTheme by mutableStateOf(prefs.getBoolean("darkTheme", false))
    var weatherCity by mutableStateOf(prefs.getString("weatherCity", "București") ?: "București")
    var weather by mutableStateOf<Forecast?>(null)
    var weatherError by mutableStateOf("")
    var lastRefresh by mutableStateOf(prefs.getLong("lastRefresh", 0L))
    var loading by mutableStateOf(false)
    var error by mutableStateOf("")
    val known = mutableSetOf<String>()

    init {
        followed.addAll(strings("followed"))
        muted.addAll(strings("muted"))
        favorites.addAll(strings("favorites"))
        hidden.addAll(strings("hidden"))
        saved.addAll(strings("saved"))
        read.addAll(strings("read"))
        known.addAll(strings("known"))
        history.addAll(fromJsonArray(prefs.getString("history", "[]") ?: "[]").take(2000))
        try {
            val stored = JSONArray(prefs.getString("readingEvents", "[]") ?: "[]")
            for (i in 0 until stored.length()) {
                val e = stored.optJSONObject(i) ?: continue
                if (e.optString("id").isNotBlank() && e.optString("articleId").isNotBlank())
                    events.add(ReadingEvent(e.getString("id"), e.getString("articleId"), e.optString("at")))
            }
        } catch (_: Exception) { }
    }
    private fun strings(key: String) = try {
        val arr = JSONArray(prefs.getString(key, "[]") ?: "[]")
        (0 until arr.length()).mapNotNull { arr.optString(it).takeIf(String::isNotBlank) }
    } catch (_: Exception) { emptyList() }

    fun persist() {
        val changes = prefs.edit()
        fun array(list: Collection<String>) = JSONArray(list.toList()).toString()
        changes.putString("followed", array(followed.take(20)))
        changes.putString("muted", array(muted.take(100)))
        changes.putString("favorites", array(favorites))
        changes.putString("hidden", array(hidden))
        changes.putString("saved", array(saved.takeLast(500)))
        changes.putString("read", array(read.takeLast(2000)))
        changes.putString("known", array(known.take(2000)))
        changes.putString("history", JSONArray(history.take(2000).map(::articleJson)).toString())
        changes.putString("readingEvents", JSONArray(events.takeLast(5000).map(::eventJson)).toString())
        changes.putBoolean("notificationsEnabled", notificationsEnabled)
        changes.putBoolean("quietEnabled", quietEnabled)
        changes.putInt("quietStart", quietStart)
        changes.putInt("quietEnd", quietEnd)
        changes.putInt("refreshMinutes", refreshMinutes)
        changes.putBoolean("darkTheme", darkTheme)
        changes.putString("weatherCity", weatherCity)
        changes.putLong("lastRefresh", lastRefresh)
        changes.apply()
    }
    fun setTopics(text: String) {
        followed.clear(); followed.addAll(text.split(",").map(String::trim).filter(String::isNotBlank).distinct().take(20).map { it.take(80) }); persist()
    }
    fun setMuted(text: String) {
        muted.clear(); muted.addAll(text.split(",").map(String::trim).filter(String::isNotBlank).distinct().take(100)); persist()
    }
    fun toggleSaved(article: Article) {
        if (article.id in saved) saved.remove(article.id) else saved.add(article.id)
        if (history.none { it.id == article.id }) history.add(0, article)
        persist()
    }
    fun markRead(article: Article) {
        if (article.id !in read) read.add(article.id)
        events.add(ReadingEvent(UUID.randomUUID().toString(), article.id, Instant.now().toString()))
        if (events.size > 5000) events.removeAt(0)
        persist()
    }
    fun mergeNews(incoming: List<Article>, failures: List<String>) {
        articles.clear(); articles.addAll(incoming)
        val updated = (incoming + history).distinctBy { it.id }.sortedByDescending { it.publishedAt }.take(2000)
        history.clear(); history.addAll(updated)
        known.addAll(incoming.map { it.id })
        if (known.size > 2000) {
            known.clear(); known.addAll(updated.take(2000).map { it.id })
        }
        lastRefresh = System.currentTimeMillis()
        error = if (failures.isEmpty()) "" else "Surse indisponibile: " + failures.joinToString(", ")
        persist()
    }
    fun visibleSources() = Catalog.sources.filter { it.id !in hidden }
        .sortedWith(compareByDescending<NewsSource> { it.id in favorites }.thenBy { it.name })

    fun matching(mode: String, sourceId: String, categoryId: String, search: String, localOnly: Boolean = false): List<Article> {
        val base = when (mode) {
            "top" -> NewsLogic.top10(articles, favorites.toSet()).map { it.article }
            "topics" -> articles.filter { NewsLogic.matches(it, followed) }
            "saved" -> history.filter { it.id in saved }
            "history" -> history.toList()
            "unread" -> articles.filter { it.id !in read }
            else -> articles.toList()
        }
        val needle = NewsLogic.normalize(search.trim())
        val locality = NewsLogic.normalize(weatherCity).takeIf { it.length > 3 } ?: ""
        return base.filter { a ->
            a.sourceID !in hidden && !NewsLogic.matches(a, muted) &&
                (sourceId == "all" || a.sourceID == sourceId) &&
                (categoryId == "all" || a.categoryID == categoryId) &&
                (needle.isEmpty() || NewsLogic.content(a).contains(needle) || NewsLogic.normalize(a.sourceName).contains(needle)) &&
                (!localOnly || (locality.isNotEmpty() && NewsLogic.content(a).contains(locality)))
        }
    }
    fun digest(period: String): List<Article> {
        val hoursAgo = if (period == "dimineata") 12 else 0
        val end = System.currentTimeMillis() - hoursAgo * 3600_000
        return NewsLogic.digest(history.filter { it.publishedAt <= end && !NewsLogic.matches(it, muted) },
            favorites.toSet(), end)
    }

    fun statistics(): Triple<Int, Int, List<Pair<String, Int>>> {
        val cutoff = System.currentTimeMillis() - 30L * 86400_000
        val recent = events.filter { parseDate(it.at) >= cutoff }
        val articleMap = history.associateBy { it.id }
        val publications = recent.map { it.articleId }.distinct().mapNotNull { articleMap[it]?.sourceName }
            .groupingBy { it }.eachCount().toList().sortedByDescending { it.second }.take(5)
        return Triple(recent.size, recent.map { it.articleId }.distinct().size, publications)
    }
    fun categoryStats(): List<Pair<String, Int>> {
        val cutoff = System.currentTimeMillis() - 30L * 86400_000
        val ids = events.filter { parseDate(it.at) >= cutoff }.map { it.articleId }.distinct().toSet()
        return history.filter { it.id in ids }
            .map { Catalog.categories[it.categoryID] ?: it.categoryID }
            .groupingBy { it }.eachCount().toList().sortedByDescending { it.second }.take(5)
    }

    fun exportSync(): String {
        val savedArticles = history.filter { it.id in saved }.take(500)
        return JSONObject().apply {
            put("app", "StiriRO-sync"); put("formatVersion", 1)
            put("exportedAt", Instant.now().toString())
            put("followedTopics", JSONArray(followed))
            put("favoriteSourceIDs", JSONArray(favorites))
            put("hiddenSourceIDs", JSONArray(hidden))
            put("readIDs", JSONArray(read.takeLast(2000)))
            put("savedArticles", JSONArray(savedArticles.map(::articleJson)))
            put("readingEvents", JSONArray(events.takeLast(5000).map(::eventJson)))
        }.toString(2)
    }
    fun importSync(data: String) {
        require(data.toByteArray(Charsets.UTF_8).size <= 10 * 1024 * 1024) { "Fișier prea mare" }
        val root = JSONObject(data)
        require(root.optString("app") == "StiriRO-sync" && root.optInt("formatVersion") == 1) { "Format invalid" }
        fun entries(key: String, limit: Int) = root.optJSONArray(key)?.let { a ->
            (0 until minOf(a.length(), limit)).mapNotNull { a.optString(it).takeIf(String::isNotBlank) }
        } ?: emptyList()
        val allowedSources = Catalog.sources.map { it.id }.toSet()
        for (word in entries("followedTopics", 20)) if (word.length <= 80 && word !in followed && followed.size < 20) followed.add(word)
        for (id in entries("favoriteSourceIDs", 100)) if (id in allowedSources && id !in favorites) favorites.add(id)
        for (id in entries("hiddenSourceIDs", 100)) if (id in allowedSources && id !in hidden) hidden.add(id)
        for (id in entries("readIDs", 2000)) if (id.length <= 512 && id !in read) read.add(id)
        val savedData = root.optJSONArray("savedArticles") ?: JSONArray()
        val imported = (0 until minOf(500, savedData.length())).mapNotNull { articleFromJson(savedData.optJSONObject(it)) }
        for (a in imported) if (a.id !in saved) saved.add(a.id)
        val merged = (imported + history).distinctBy { it.id }.sortedByDescending { it.publishedAt }.take(2000)
        history.clear(); history.addAll(merged)
        val eventData = root.optJSONArray("readingEvents") ?: JSONArray()
        val existingIds = events.map { it.id }.toMutableSet()
        for (i in 0 until minOf(eventData.length(), 5000)) {
            val e = eventData.optJSONObject(i) ?: continue
            val id = e.optString("id")
            val articleId = e.optString("articleId")
            val at = e.optString("at")
            if (id.isNotBlank() && id.length <= 100 && articleId.isNotBlank() && articleId.length <= 512 &&
                at.length <= 35 && parseDate(at) > 0 && existingIds.add(id)) {
                events.add(ReadingEvent(id, articleId, at))
            }
        }
        while (events.size > 5000) events.removeAt(0)
        persist()
    }

    companion object {
        fun parseDate(value: String): Long {
            try { return Instant.parse(value).toEpochMilli() } catch (_: Exception) {}
            try { return OffsetDateTime.parse(value).toInstant().toEpochMilli() } catch (_: Exception) {}
            return 0L
        }
        private fun eventJson(e: ReadingEvent) = JSONObject()
            .put("id", e.id).put("articleId", e.articleId).put("at", e.at)
        private fun articleJson(a: Article) = JSONObject()
            .put("id", a.id.take(512)).put("title", a.title.take(500)).put("link", a.link)
            .put("excerpt", a.excerpt.take(1000))
            .put("publishedAt", Instant.ofEpochMilli(a.publishedAt.coerceAtLeast(0)).toString())
            .put("imageURL", a.imageURL ?: JSONObject.NULL)
            .put("sourceID", a.sourceID).put("sourceName", a.sourceName)
            .put("categoryID", a.categoryID)
        private fun articleFromJson(o: JSONObject?): Article? {
            if (o == null) return null
            val url = o.optString("link")
            if (!url.startsWith("https://") && !url.startsWith("http://")) return null
            val id = o.optString("id")
            if (id.isBlank() || id.length > 512) return null
            return Article(id, o.optString("title").take(500), url,
                o.optString("excerpt").take(1000), parseDate(o.optString("publishedAt")),
                o.optString("imageURL").takeIf { it.startsWith("https://") },
                o.optString("sourceID"), o.optString("sourceName"), o.optString("categoryID"))
        }
        private fun fromJsonArray(s: String) = try {
            val arr = JSONArray(s)
            (0 until arr.length()).mapNotNull { articleFromJson(arr.optJSONObject(it)) }
        } catch (_: Exception) { emptyList() }
    }
}

object WeatherNetwork {
    private fun json(url: String): JSONObject {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000; conn.readTimeout = 15_000
        try { return JSONObject(conn.inputStream.bufferedReader().use { it.readText() }) }
        finally { conn.disconnect() }
    }
    fun forecast(city: String): Forecast {
        val q = URLEncoder.encode(city.trim(), "UTF-8")
        require(q.isNotEmpty())
        val locations = json("https://geocoding-api.open-meteo.com/v1/search?name=$q&count=1&language=ro")
        val place = locations.optJSONArray("results")?.optJSONObject(0) ?: error("Oraș negăsit")
        val name = place.optString("name", city)
        val lat = place.getDouble("latitude")
        val lon = place.getDouble("longitude")
        val weather = json("https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m,weather_code&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto")
        val current = weather.getJSONObject("current")
        val daily = weather.getJSONObject("daily")
        val hourly = weather.getJSONObject("hourly")
        val hours = mutableListOf<Pair<String, Int>>()
        val times = hourly.getJSONArray("time"); val temperatures = hourly.getJSONArray("temperature_2m")
        for (i in 0 until minOf(24, times.length(), temperatures.length()))
            hours.add(times.getString(i).takeLast(5) to temperatures.getDouble(i).toInt())
        val days = mutableListOf<Pair<String, String>>()
        val dates = daily.getJSONArray("time")
        val min = daily.getJSONArray("temperature_2m_min"); val max = daily.getJSONArray("temperature_2m_max")
        for (i in 0 until minOf(5, dates.length(), min.length(), max.length()))
            days.add(dates.getString(i) to (min.getDouble(i).toInt().toString() + "° / " + max.getDouble(i).toInt() + "°"))
        val code = current.optInt("weather_code", 0)
        val description = when(code) {
            0 -> "Senin"
            1,2,3 -> "Parțial noros"
            45,48 -> "Ceață"
            in 51..67, in 80..82 -> "Ploaie"
            in 71..77, 85,86 -> "Ninsoare"
            in 95..99 -> "Furtună"
            else -> "Vreme variabilă"
        }
        return Forecast(name, current.getDouble("temperature_2m").toInt(), description, hours, days)
    }
}
