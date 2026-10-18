package ro.stiriro.android

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NotificationWorker.schedule(this)
        if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        setContent { StiriROApplication() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StiriROApplication() {
    val context = LocalContext.current
    val store = remember { NewsStore(context) }
    val scope = rememberCoroutineScope()
    var screen by remember { mutableStateOf("feed") }
    var source by remember { mutableStateOf("all") }
    var category by remember { mutableStateOf("all") }
    var query by remember { mutableStateOf("") }
    var localOnly by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<Article?>(null) }
    var message by remember { mutableStateOf("") }
    var digestPeriod by remember { mutableStateOf("seara") }

    fun refresh() {
        if (store.loading) return
        store.loading = true
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) { NewsNetwork.fetchAll(store.visibleSources()) }
                store.mergeNews(result.first, result.second)
            } catch (_: Exception) { store.error = "Actualizarea nu a reușit. Verifică internetul." }
            finally { store.loading = false }
        }
    }
    fun refreshWeather() {
        if (store.weatherCity.isBlank()) { store.weatherError = "Alege un oraș în Setări."; return }
        scope.launch {
            try { store.weather = withContext(Dispatchers.IO) { WeatherNetwork.forecast(store.weatherCity) }; store.weatherError = "" }
            catch (_: Exception) { store.weatherError = "Prognoza nu este disponibilă." }
        }
    }
    LaunchedEffect(Unit) {
        refresh()
        if (store.weatherCity.isNotBlank()) refreshWeather()
    }
    LaunchedEffect(store.refreshMinutes) {
        while (true) {
            delay(store.refreshMinutes.coerceAtLeast(5) * 60_000L)
            refresh()
        }
    }

    val exportLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) try {
            context.contentResolver.openOutputStream(uri)?.use {
                it.write(store.exportSync().toByteArray(Charsets.UTF_8))
            }
            message = "Fișierul de transfer a fost exportat."
        } catch (_: Exception) { message = "Exportul nu a reușit." }
    }
    val importLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) try {
            val text = context.contentResolver.openInputStream(uri)?.use { input ->
                val bytes = input.readBytes()
                require(bytes.size <= 10 * 1024 * 1024) { "Fișier prea mare" }
                String(bytes, Charsets.UTF_8)
            } ?: error("Fișier indisponibil")
            store.importSync(text)
            message = "Datele au fost combinate cu cele locale."
        } catch (_: Exception) { message = "Fișier invalid sau import nereușit." }
    }

    MaterialTheme(colorScheme = if (store.darkTheme) darkColorScheme() else lightColorScheme()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(if (selected == null) "Știri RO · 0.0.10" else "Articol") },
                    navigationIcon = { if (selected != null) TextButton(onClick = { selected = null }) { Text("‹ Înapoi") } },
                    actions = {
                        if (selected == null) {
                            TextButton(onClick = ::refresh, enabled = !store.loading) { Text(if (store.loading) "…" else "↻") }
                            TextButton(onClick = { screen = "settings" }) { Text("⚙") }
                        }
                    }
                )
            },
            bottomBar = {
                if (selected == null) NavigationBar {
                    listOf("feed" to "Știri", "top" to "Top 10", "topics" to "Subiecte",
                        "saved" to "Salvate", "more" to "Mai mult").forEach { (key, name) ->
                        NavigationBarItem(
                            selected = screen == key, onClick = { screen = key },
                            icon = { Text(when(key) {"feed"->"▤";"top"->"★";"topics"->"#";"saved"->"☆";else->"⋯"}) },
                            label = { Text(name) }
                        )
                    }
                }
            }
        ) { insets ->
            if (selected != null) {
                val article = selected!!
                AndroidView(factory = {
                    WebView(it).apply {
                        webViewClient = WebViewClient()
                        settings.javaScriptEnabled = false
                        loadUrl(article.link)
                    }
                }, modifier = Modifier.fillMaxSize().padding(insets),
                    update = { view -> if (view.url != article.link) view.loadUrl(article.link) })
            } else {
                Column(Modifier.fillMaxSize().padding(insets)) {
                    when (screen) {
                        "settings" -> SettingsScreen(
                            store, message, onRefreshWeather = ::refreshWeather,
                            onExport = { exportLauncher.launch("StiriRO-sync.json") },
                            onImport = { importLauncher.launch(arrayOf("application/json", "text/plain")) },
                            onBack = { screen = "more" },
                            onApplySources = ::refresh
                        )
                        "more" -> MoreScreen(store,
                            onShow = { screen = it }, onWeather = ::refreshWeather,
                            onSettings = { screen = "settings" })
                        "stats" -> StatsScreen(store) { screen = "more" }
                        "weather" -> WeatherScreen(store, onBack = { screen = "more" }, onRefresh = ::refreshWeather)
                        "digest" -> DigestScreen(store,digestPeriod,
                            onChangePeriod = { digestPeriod = it },
                            onOpen = { store.markRead(it); selected = it },
                            onBack = { screen = "more" })
                        else -> {
                            if (store.weather != null) {
                                val w = store.weather!!
                                Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
                                    Row(Modifier.fillMaxWidth().clickable { screen = "weather" }.padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("☁ " + w.place + " · " + w.description)
                                        Text(w.current.toString() + "°C", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                            if (store.loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                            if (store.error.isNotBlank())
                                Text(store.error, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(8.dp))
                            OutlinedTextField(query, { query = it }, label = { Text("Caută știri") },
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                                singleLine = true)
                            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(8.dp)) {
                                FilterChip(selected = source == "all", onClick = { source = "all" },
                                    label = { Text("Toate sursele") })
                                Spacer(Modifier.width(6.dp))
                                store.visibleSources().forEach { src ->
                                    FilterChip(selected = source == src.id, onClick = { source = src.id },
                                        label = { Text(src.name) }, modifier = Modifier.padding(end = 6.dp))
                                }
                            }
                            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 8.dp)) {
                                FilterChip(selected = category == "all", onClick = { category = "all" },
                                    label = { Text("Toate") }, modifier = Modifier.padding(end = 6.dp))
                                Catalog.categories.forEach { (id, label) ->
                                    FilterChip(selected = category == id, onClick = { category = id },
                                        label = { Text(label) }, modifier = Modifier.padding(end = 6.dp))
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = localOnly, onCheckedChange = { localOnly = it })
                                Text("Știri locale")
                                Spacer(Modifier.weight(1f))
                                if (store.lastRefresh > 0)
                                    Text("Actualizat " + DateTimeFormatter.ofPattern("HH:mm")
                                        .format(Instant.ofEpochMilli(store.lastRefresh).atZone(ZoneId.systemDefault())),
                                        style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(8.dp))
                            }
                            val visible = store.matching(screen, source, category, query, localOnly)
                            Text(visible.size.toString() + " articole", style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier.padding(horizontal = 16.dp))
                            if (visible.isEmpty()) {
                                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Text(if (screen == "topics" && store.followed.isEmpty())
                                        "Adaugă subiecte urmărite în Setări." else "Nu există articole pentru filtrele selectate.")
                                }
                            } else {
                                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    items(visible, key = { it.id }) { article ->
                                        NewsArticleCard(article, article.id in store.saved, article.id in store.read,
                                            onSave = { store.toggleSaved(article) },
                                            onOpen = { store.markRead(article); selected = article })
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NewsArticleCard(article: Article, isSaved: Boolean, read: Boolean, onSave: () -> Unit, onOpen: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(article.sourceName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text(Catalog.categories[article.categoryID] ?: article.categoryID,
                    style = MaterialTheme.typography.labelSmall)
                Spacer(Modifier.weight(1f))
                if (!read) Text("● Nou", color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelSmall)
            }
            Text(article.title, style = MaterialTheme.typography.titleMedium,
                fontWeight = if (read) FontWeight.Normal else FontWeight.SemiBold,
                maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (article.excerpt.isNotBlank())
                Text(article.excerpt, style = MaterialTheme.typography.bodySmall, maxLines = 3,
                    overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically) {
                val time = if (article.publishedAt > 0) DateTimeFormatter.ofPattern("dd.MM · HH:mm")
                    .format(Instant.ofEpochMilli(article.publishedAt).atZone(ZoneId.systemDefault())) else ""
                Text(time, style = MaterialTheme.typography.labelSmall)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onSave) { Text(if (isSaved) "★ Salvat" else "☆ Salvează") }
            }
        }
    }
}

@Composable
fun MoreScreen(store: NewsStore, onShow: (String) -> Unit, onWeather: () -> Unit, onSettings: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Mai mult", style = MaterialTheme.typography.headlineSmall)
        Button(onClick = { onShow("digest") }, modifier = Modifier.fillMaxWidth()) { Text("Rezumatul dimineții și serii") }
        Button(onClick = { onShow("stats") }, modifier = Modifier.fillMaxWidth()) { Text("Statistici personale") }
        Button(onClick = { onShow("history") }, modifier = Modifier.fillMaxWidth()) { Text("Istoric articole") }
        Button(onClick = { onShow("unread") }, modifier = Modifier.fillMaxWidth()) { Text("Știri necitite") }
        Button(onClick = { onShow("weather"); onWeather() }, modifier = Modifier.fillMaxWidth()) { Text("Prognoza meteo") }
        Button(onClick = onSettings, modifier = Modifier.fillMaxWidth()) { Text("Setări · transfer între dispozitive") }
        Text("Versiune Android 0.0.10", style = MaterialTheme.typography.bodySmall)
        Text("Actualizarea automată funcționează în prim-plan; notificările periodice sunt aproximative din cauza limitărilor Android.",
            style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun DigestScreen(store: NewsStore, period: String, onChangePeriod: (String) -> Unit,
                 onOpen: (Article) -> Unit, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹ Înapoi") }
            Text("Rezumat dimineața / seara", style = MaterialTheme.typography.titleMedium)
        }
        Row(Modifier.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = period == "dimineata", onClick = { onChangePeriod("dimineata") }, label = { Text("Dimineața") })
            FilterChip(selected = period == "seara", onClick = { onChangePeriod("seara") }, label = { Text("Seara") })
        }
        Text("Până la 10 articole din ultimele 36 de ore, maximum două per publicație.",
            modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall)
        LazyColumn(contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(store.digest(period)) { a ->
                NewsArticleCard(a, a.id in store.saved, a.id in store.read,
                    onSave = { store.toggleSaved(a) }, onOpen = { onOpen(a) })
            }
        }
    }
}

@Composable
fun StatsScreen(store: NewsStore, onBack: () -> Unit) {
    val stats = store.statistics()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        TextButton(onClick = onBack) { Text("‹ Înapoi") }
        Text("Statistici personale", style = MaterialTheme.typography.headlineSmall)
        Text("Ultimele 30 de zile · date păstrate pe dispozitiv.")
        Text("Deschideri: " + stats.first, style = MaterialTheme.typography.titleMedium)
        Text("Articole distincte: " + stats.second, style = MaterialTheme.typography.titleMedium)
        Text("Publicații citite", style = MaterialTheme.typography.titleMedium)
        stats.third.forEach { (name, amount) -> Text(name + ": " + amount) }
        Text("Categorii citite", style = MaterialTheme.typography.titleMedium)
        store.categoryStats().forEach { (name, amount) -> Text(name + ": " + amount) }
        if (stats.first == 0) Text("Statisticile încep să fie colectate după deschiderea unui articol.")
    }
}

@Composable
fun WeatherScreen(store: NewsStore, onBack: () -> Unit, onRefresh: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = onBack) { Text("‹ Înapoi") }
        Text("Prognoza meteo", style = MaterialTheme.typography.headlineSmall)
        OutlinedTextField(store.weatherCity, { store.weatherCity = it; store.persist() },
            label = { Text("Localitate") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = onRefresh) { Text("Actualizează prognoza") }
        if (store.weatherError.isNotEmpty()) Text(store.weatherError)
        val report = store.weather
        if (report != null) {
            Text(report.place + " · " + report.current + "°C", style = MaterialTheme.typography.headlineMedium)
            Text(report.description)
            Text("Următoarele 24 de ore", style = MaterialTheme.typography.titleMedium)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(report.hours) { h -> Card { Text(h.first + "\n" + h.second + "°", Modifier.padding(12.dp)) } }
            }
            Text("Următoarele 5 zile", style = MaterialTheme.typography.titleMedium)
            report.days.forEach { Text(it.first + " · " + it.second) }
        }
    }
}

@Composable
fun SettingsScreen(store: NewsStore, message: String, onRefreshWeather: () -> Unit,
                   onExport: () -> Unit, onImport: () -> Unit, onBack: () -> Unit, onApplySources: () -> Unit) {
    var topicText by remember { mutableStateOf(store.followed.joinToString(", ")) }
    var mutedText by remember { mutableStateOf(store.muted.joinToString(", ")) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹ Înapoi") }
            Text("Setări", style = MaterialTheme.typography.headlineSmall)
        }
        HorizontalDivider()
        Text("Subiectele mele", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(topicText, { topicText = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text("Cuvinte și expresii (separate prin virgulă)") }, minLines = 2)
        Button(onClick = { store.setTopics(topicText) }) { Text("Salvează subiectele") }

        Text("Subiecte ascunse", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(mutedText, { mutedText = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text("Expresii de exclus") })
        Button(onClick = { store.setMuted(mutedText) }) { Text("Salvează filtrele") }
        HorizontalDivider()

        Text("Notificări", style = MaterialTheme.typography.titleMedium)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = store.notificationsEnabled, onCheckedChange = { store.notificationsEnabled = it; store.persist() })
            Spacer(Modifier.width(12.dp)); Text("Cel mult o notificare la 6 ore")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = store.quietEnabled, onCheckedChange = { store.quietEnabled = it; store.persist() })
            Spacer(Modifier.width(12.dp)); Text("Ore de liniște")
        }
        if (store.quietEnabled) {
            Text("De la " + store.quietStart + ":00 până la " + store.quietEnd + ":00")
            Row {
                TextButton(onClick = { store.quietStart = (store.quietStart + 1) % 24; store.persist() }) { Text("Schimbă început") }
                TextButton(onClick = { store.quietEnd = (store.quietEnd + 1) % 24; store.persist() }) { Text("Schimbă sfârșit") }
            }
        }
        HorizontalDivider()
        Text("Aspect și actualizare", style = MaterialTheme.typography.titleMedium)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = store.darkTheme, onCheckedChange = { store.darkTheme = it; store.persist() })
            Spacer(Modifier.width(12.dp)); Text("Temă întunecată")
        }
        Text("Actualizare în prim-plan la fiecare " + store.refreshMinutes + " minute")
        Row {
            listOf(5,15,30,60).forEach { n ->
                FilterChip(selected = store.refreshMinutes == n,
                    onClick = { store.refreshMinutes = n; store.persist() },
                    label = { Text(n.toString()) }, modifier = Modifier.padding(end = 6.dp))
            }
        }
        Text("Localitatea pentru meteo", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(store.weatherCity, { store.weatherCity = it; store.persist() },
            modifier = Modifier.fillMaxWidth(), label = { Text("Oraș") })
        Button(onClick = onRefreshWeather) { Text("Actualizează meteo") }
        HorizontalDivider()
        Text("Publicații favorite și ascunse", style = MaterialTheme.typography.titleMedium)
        Catalog.sources.forEach { s ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(s.name, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = {
                    if (s.id in store.favorites) store.favorites.remove(s.id) else store.favorites.add(s.id)
                    store.persist()
                }) { Text(if (s.id in store.favorites) "★" else "☆") }
                Checkbox(checked = s.id !in store.hidden, onCheckedChange = { visible ->
                    if (visible) store.hidden.remove(s.id) else if (s.id !in store.hidden) store.hidden.add(s.id)
                    store.persist()
                })
            }
        }
        Button(onClick = onApplySources) { Text("Aplică sursele vizibile") }
        HorizontalDivider()
        Text("Transfer Windows – iPhone – Android", style = MaterialTheme.typography.titleMedium)
        Text("Export și import manual JSON. Datele existente sunt combinate, nu șterse.",
            style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = onExport) { Text("Exportă") }
            Button(onClick = onImport) { Text("Importă") }
        }
        if (message.isNotBlank()) Text(message)
        Text("Știri RO Android · versiune de test 0.0.10",
            style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(32.dp))
    }
}
