import Foundation
import SwiftUI
import CoreLocation
import UserNotifications

struct NewsBackup: Codable {
    let app: String
    let formatVersion: Int
    let exportedAt: Date
    let preferences: Preferences
    let savedIDs: [String]
    let readIDs: [String]
    let articleHistory: [Article]
}

@MainActor
final class NewsStore: ObservableObject {
    @Published var articles: [Article] = []
    @Published var articleHistory: [Article] = []
    @Published var readingEvents: [ReadingEvent] = []
    @Published var showTopOnly = false
    @Published var showTopicsOnly = false
    @Published var preferences: Preferences
    @Published var savedIDs: Set<String>
    @Published var readIDs: Set<String>
    @Published var selectedSourceID: String?
    @Published var selectedCategoryID: String?
    @Published var showSavedOnly = false
    @Published var showUnreadOnly = false
    @Published var showHistoryOnly = false
    @Published var historyStartDate = Calendar.current.date(byAdding: .day, value: -7, to: .now) ?? .now
    @Published var historyEndDate = Date()
    @Published var showLocalOnly = false
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var failures: [String] = []
    @Published var lastUpdated: Date?
    @Published var weather: WeatherReport?
    @Published var weatherError: String?
    @Published var weatherLoading = false

    private let service = FeedService()
    private let weatherService = WeatherService()
    private var knownIDs: Set<String>
    private var baselineReady: Bool
    private var refreshTask: Task<Void, Never>?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let notificationInterval: TimeInterval = 6 * 60 * 60
    private let notificationLimit = 5
    private var pendingNotifications: [Article] = []
    private var lastNotificationAt: Date = .now

    init() {
        preferences = Self.load(Preferences.self, key: "preferences") ?? Preferences()
        savedIDs = Set(UserDefaults.standard.stringArray(forKey: "savedIDs") ?? [])
        readIDs = Set(UserDefaults.standard.stringArray(forKey: "readIDs") ?? [])
        knownIDs = Set(UserDefaults.standard.stringArray(forKey: "knownIDs") ?? [])
        baselineReady = !knownIDs.isEmpty
        articleHistory = Array((Self.load([Article].self, key: "articleHistory") ?? []).prefix(2_000))
        readingEvents = Array((Self.load([ReadingEvent].self, key: "readingEvents") ?? []).suffix(5_000))
        let defaults = UserDefaults.standard
        lastNotificationAt = defaults.object(forKey: "lastNotificationAt") as? Date ?? .now
        pendingNotifications = (defaults.data(forKey: "pendingNotifications").flatMap { try? JSONDecoder().decode([Article].self, from: $0) } ?? []).prefix(5).map { $0 }
    }

    var visibleSources: [NewsSource] {
        let order = Dictionary(preferences.sourceOrder.enumerated().map { ($0.element, $0.offset) }, uniquingKeysWith: { first, _ in first })
        return Catalog.sources.filter { !preferences.hiddenSourceIDs.contains($0.id) }.sorted {
            let left = preferences.favoriteSourceIDs.contains($0.id)
            let right = preferences.favoriteSourceIDs.contains($1.id)
            if left != right { return left }
            return (order[$0.id] ?? Int.max, $0.name) < (order[$1.id] ?? Int.max, $1.name)
        }
    }

    var localPlace: String {
        if preferences.weatherLocationMode == .manual {
            return weather?.place ?? preferences.weatherManualCity
        }
        return preferences.weatherAutomaticName
    }

    private func normalized(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "ro_RO")).lowercased()
    }

    private func isMuted(_ article: Article) -> Bool {
        let content = normalized("\(article.title) \(article.excerpt)")
        return preferences.mutedKeywords.contains { keyword in
            let needle = normalized(keyword.trimmingCharacters(in: .whitespacesAndNewlines))
            return !needle.isEmpty && content.contains(needle)
        }
    }

    private func isLocal(_ article: Article) -> Bool {
        let place = normalized(localPlace.trimmingCharacters(in: .whitespacesAndNewlines))
        if place.isEmpty || place == normalized("Locația curentă") { return false }
        let text = normalized("\(article.title) \(article.excerpt)")
        let names = place == "bucuresti" ? ["bucuresti", "bucharest"] : [place]
        return names.contains { text.contains($0) }
    }

    var topStories: [Article] {
        let recent = articles.filter { $0.publishedAt > Date().addingTimeInterval(-36 * 3600) && !isMuted($0) }
        let sorted = recent.sorted { $0.publishedAt > $1.publishedAt }
        func words(_ title: String) -> Set<String> {
            let stop: Set<String> = ["pentru", "despre", "aceasta", "acesta", "sunt", "este", "fost", "prin", "romania"]
            return Set(normalized(title).components(separatedBy: CharacterSet.alphanumerics.inverted)
                .filter { $0.count >= 4 && !stop.contains($0) })
        }
        var groups: [(main: Article, words: Set<String>, sources: Set<String>)] = []
        for item in sorted {
            let tokens = words(item.title)
            if let index = groups.firstIndex(where: { group in
                let overlap = group.words.intersection(tokens).count
                return overlap >= 3 && Double(overlap) / Double(max(1, min(tokens.count, group.words.count))) >= 0.65
            }) {
                groups[index].sources.insert(item.sourceID)
            } else {
                groups.append((main: item, words: tokens, sources: [item.sourceID]))
            }
        }
        let favorites = preferences.favoriteSourceIDs
        return Array(groups.sorted { a, b in
            let aScore = max(0, 36 - Date().timeIntervalSince(a.main.publishedAt) / 3600) +
                Double(14 * min(4, a.sources.count - 1)) + (favorites.contains(a.main.sourceID) ? 6 : 0)
            let bScore = max(0, 36 - Date().timeIntervalSince(b.main.publishedAt) / 3600) +
                Double(14 * min(4, b.sources.count - 1)) + (favorites.contains(b.main.sourceID) ? 6 : 0)
            return aScore == bScore ? a.main.publishedAt > b.main.publishedAt : aScore > bScore
        }.prefix(10).map(\.main))
    }

    private func matchesTopics(_ article: Article) -> Bool {
        let haystack = normalized("\(article.title) \(article.excerpt)")
        return preferences.followedTopics.contains { topic in
            let needle = normalized(topic)
            return !needle.isEmpty && haystack.contains(needle)
        }
    }

    var personalStats: (opens: Int, unique: Int, sources: [(String, Int)], categories: [(String, Int)]) {
        let cutoff = Date().addingTimeInterval(-30 * 86400)
        let recent = readingEvents.filter { event in
            (PortableArticle.formatter.date(from: event.at) ?? ISO8601DateFormatter().date(from: event.at) ?? .distantPast) >= cutoff
        }
        let ids = Set(recent.map(\.articleId))
        let articlesByID = Dictionary(articleHistory.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var sourceCounts: [String: Int] = [:], categoryCounts: [String: Int] = [:]
        for id in ids {
            guard let a = articlesByID[id] else { continue }
            sourceCounts[a.sourceName, default: 0] += 1
            let category = Catalog.categories.first(where: { $0.id == a.categoryID })?.name ?? a.categoryID
            categoryCounts[category, default: 0] += 1
        }
        return (recent.count, ids.count,
                Array(sourceCounts.sorted { $0.value > $1.value }.prefix(5).map { ($0.key, $0.value) }),
                Array(categoryCounts.sorted { $0.value > $1.value }.prefix(5).map { ($0.key, $0.value) }))
    }

    var filteredArticles: [Article] {
        let source = showHistoryOnly || showSavedOnly ? articleHistory :
            showTopOnly ? topStories : showTopicsOnly ? articles.filter(matchesTopics) : articles
        return source.filter { article in
            if isMuted(article) { return false }
            if preferences.hiddenSourceIDs.contains(article.sourceID) { return false }
            if showHistoryOnly {
                let calendar = Calendar.current
                guard let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: historyEndDate)) else { return false }
                if article.publishedAt < calendar.startOfDay(for: historyStartDate) || article.publishedAt >= end { return false }
            }
            if let selectedSourceID, article.sourceID != selectedSourceID { return false }
            if let selectedCategoryID, article.categoryID != selectedCategoryID { return false }
            if showSavedOnly && !savedIDs.contains(article.id) { return false }
            if showUnreadOnly && readIDs.contains(article.id) { return false }
            if showLocalOnly && !isLocal(article) { return false }
            if !searchText.isEmpty {
                let needle = normalized(searchText)
                if !normalized("\(article.title) \(article.excerpt) \(article.sourceName)").contains(needle) { return false }
            }
            return true
        }
    }

    var dailyDigest: [Article] {
        let since = Date().addingTimeInterval(-24 * 60 * 60)
        var grouped: [String: Int] = [:]
        let candidates = articleHistory.filter { $0.publishedAt >= since && !isMuted($0) }
            .sorted {
                let a = preferences.favoriteSourceIDs.contains($0.sourceID)
                let b = preferences.favoriteSourceIDs.contains($1.sourceID)
                return a == b ? $0.publishedAt > $1.publishedAt : a
            }
        var result: [Article] = []
        for article in candidates {
            guard grouped[article.sourceID, default: 0] < 2 else { continue }
            result.append(article)
            grouped[article.sourceID, default: 0] += 1
            if result.count >= 10 { break }
        }
        return result
    }

    func initialLoad() async {
        guard articles.isEmpty else { return }
        await refresh()
        scheduleRefresh()
        await loadWeather()
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        let (newArticles, newFailures) = await service.fetch(sources: visibleSources)
        let unseen = baselineReady ? newArticles.filter { !knownIDs.contains($0.id) } : []
        articles = newArticles
        failures = newFailures
        lastUpdated = .now
        knownIDs.formUnion(newArticles.map(\.id))
        if knownIDs.count > 2_000 {
            knownIDs = Set((newArticles + articleHistory).prefix(2_000).map(\.id))
        }
        UserDefaults.standard.set(Array(knownIDs), forKey: "knownIDs")
        baselineReady = true
        mergeHistory(newArticles)
        isLoading = false
        await notify(for: unseen.filter { !isMuted($0) })
    }

    private func mergeHistory(_ incoming: [Article]) {
        var byID = Dictionary(articleHistory.map { ($0.id, $0) }, uniquingKeysWith: { current, _ in current })
        for article in incoming { byID[article.id] = article }
        articleHistory = Array(byID.values.sorted { $0.publishedAt > $1.publishedAt }.prefix(2_000))
        persistHistory()
    }

    private func persistHistory() {
        if let data = try? encoder.encode(articleHistory) { UserDefaults.standard.set(data, forKey: "articleHistory") }
    }

    func updatePreferences(_ change: (inout Preferences) -> Void) {
        let old = preferences
        change(&preferences)
        preferences.mutedKeywords = Array(Set(preferences.mutedKeywords.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })).sorted().prefix(100).map { $0 }
        preferences.followedTopics = Array(Set(preferences.followedTopics.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })).sorted().prefix(20).map { String($0.prefix(80)) }
        persist()
        if !preferences.notificationsEnabled {
            pendingNotifications = []
            persistNotificationQueue()
        }
        scheduleRefresh()
        if old.weatherEnabled != preferences.weatherEnabled
            || old.weatherLocationMode != preferences.weatherLocationMode
            || old.weatherManualCity != preferences.weatherManualCity {
            Task { await loadWeather() }
        }
    }

    func toggleSaved(_ article: Article) {
        if !savedIDs.insert(article.id).inserted { savedIDs.remove(article.id) }
        UserDefaults.standard.set(Array(savedIDs), forKey: "savedIDs")
        if !articleHistory.contains(where: { $0.id == article.id }) { mergeHistory([article]) }
    }

    func markRead(_ article: Article) {
        let event = ReadingEvent(id: UUID().uuidString, articleId: article.id, at: PortableArticle.formatter.string(from: .now))
        readingEvents.append(event)
        readingEvents = Array(readingEvents.suffix(5_000))
        if let data = try? encoder.encode(readingEvents) { UserDefaults.standard.set(data, forKey: "readingEvents") }
        readIDs.insert(article.id)
        UserDefaults.standard.set(Array(readIDs), forKey: "readIDs")
    }

    func markAllVisibleRead() {
        readIDs.formUnion(filteredArticles.map(\.id))
        UserDefaults.standard.set(Array(readIDs), forKey: "readIDs")
    }

    func moveSources(from offsets: IndexSet, to destination: Int) {
        var ids = orderedSourceIDs
        ids.move(fromOffsets: offsets, toOffset: destination)
        updatePreferences { $0.sourceOrder = ids }
    }

    var orderedSourceIDs: [String] {
        let valid = Set(Catalog.sources.map(\.id))
        let original = preferences.sourceOrder.filter { valid.contains($0) }
        return original + Catalog.sources.map(\.id).filter { !original.contains($0) }
    }

    func requestNotificationsIfNeeded() async {
        guard preferences.notificationsEnabled else { return }
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
    }

    func setAutomaticLocation(_ coordinate: CLLocationCoordinate2D) async {
        let geocoder = CLGeocoder()
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let placemarks = try? await geocoder.reverseGeocodeLocation(location)
        let place = placemarks?.first?.locality ?? "Locația curentă"
        preferences.weatherAutomaticLatitude = coordinate.latitude
        preferences.weatherAutomaticLongitude = coordinate.longitude
        preferences.weatherAutomaticName = place
        persist()
        if preferences.weatherEnabled && preferences.weatherLocationMode == .automatic { await loadWeather() }
    }

    func loadWeather() async {
        guard preferences.weatherEnabled else {
            weather = nil
            weatherError = nil
            return
        }
        if preferences.weatherLocationMode == .automatic && preferences.weatherAutomaticLatitude == nil { return }
        if preferences.weatherLocationMode == .manual && preferences.weatherManualCity.trimmingCharacters(in: .whitespaces).isEmpty { return }
        weatherLoading = true
        weatherError = nil
        do {
            weather = try await weatherService.fetch(
                mode: preferences.weatherLocationMode, manualCity: preferences.weatherManualCity,
                latitude: preferences.weatherAutomaticLatitude, longitude: preferences.weatherAutomaticLongitude,
                automaticName: preferences.weatherAutomaticName
            )
        } catch {
            weatherError = error.localizedDescription
        }
        weatherLoading = false
    }

    func makeSync() throws -> Data {
        let snapshot = SyncSnapshot(
            app: "StiriRO-sync", formatVersion: 1, exportedAt: PortableArticle.formatter.string(from: .now),
            followedTopics: preferences.followedTopics,
            favoriteSourceIDs: Array(preferences.favoriteSourceIDs),
            hiddenSourceIDs: Array(preferences.hiddenSourceIDs),
            readIDs: Array(readIDs.prefix(2_000)),
            savedArticles: Array(articleHistory.filter { savedIDs.contains($0.id) }.prefix(500).map(PortableArticle.init)),
            readingEvents: Array(readingEvents.suffix(5_000))
        )
        let data = try encoder.encode(snapshot)
        guard data.count <= 10 * 1024 * 1024 else { throw CocoaError(.fileWriteOutOfSpace) }
        return data
    }

    func importSync(_ data: Data) throws {
        guard data.count <= 10 * 1024 * 1024 else { throw CocoaError(.fileReadTooLarge) }
        let snapshot = try decoder.decode(SyncSnapshot.self, from: data)
        guard snapshot.app == "StiriRO-sync" && snapshot.formatVersion == 1 else { throw CocoaError(.fileReadCorruptFile) }
        let allowedSourceIDs = Set(Catalog.sources.map(\.id))
        preferences.followedTopics = Array(Set(preferences.followedTopics + snapshot.followedTopics.filter { !$0.isEmpty && $0.count <= 80 })).prefix(20).map { $0 }
        preferences.favoriteSourceIDs.formUnion(snapshot.favoriteSourceIDs.filter { allowedSourceIDs.contains($0) })
        preferences.hiddenSourceIDs.formUnion(snapshot.hiddenSourceIDs.filter { allowedSourceIDs.contains($0) })
        let imported = Array(snapshot.savedArticles.prefix(500).compactMap { $0.article() })
        savedIDs.formUnion(imported.map(\.id))
        readIDs.formUnion(snapshot.readIDs.filter { !$0.isEmpty && $0.count <= 512 }.prefix(2_000))
        var events = Dictionary(readingEvents.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for item in snapshot.readingEvents.prefix(5_000) where !item.id.isEmpty && !item.articleId.isEmpty && item.at.count <= 35 {
            events[item.id] = item
        }
        readingEvents = Array(events.values.sorted { $0.at < $1.at }.suffix(5_000))
        UserDefaults.standard.set(Array(savedIDs.prefix(500)), forKey: "savedIDs")
        UserDefaults.standard.set(Array(readIDs.prefix(2_000)), forKey: "readIDs")
        if let encoded = try? encoder.encode(readingEvents) { UserDefaults.standard.set(encoded, forKey: "readingEvents") }
        mergeHistory(imported)
        persist()
    }

    func makeBackup() throws -> Data {
        let backup = NewsBackup(app: "Știri RO iOS", formatVersion: 1, exportedAt: .now,
                                preferences: preferences, savedIDs: Array(savedIDs.prefix(500)),
                                readIDs: Array(readIDs.prefix(2_000)), articleHistory: Array(articleHistory.prefix(2_000)))
        let data = try encoder.encode(backup)
        guard data.count <= 10 * 1024 * 1024 else { throw CocoaError(.fileWriteOutOfSpace) }
        return data
    }

    func restoreBackup(_ data: Data) throws {
        guard data.count <= 10 * 1024 * 1024 else { throw CocoaError(.fileReadTooLarge) }
        let backup = try decoder.decode(NewsBackup.self, from: data)
        guard backup.app == "Știri RO iOS", backup.formatVersion == 1 else { throw CocoaError(.fileReadCorruptFile) }
        preferences = backup.preferences
        savedIDs = Set(backup.savedIDs.prefix(500))
        readIDs = Set(backup.readIDs.prefix(2_000))
        articleHistory = Array(backup.articleHistory.filter {
            !$0.id.isEmpty && ["http", "https"].contains($0.link.scheme?.lowercased() ?? "")
        }.sorted { $0.publishedAt > $1.publishedAt }.prefix(2_000))
        UserDefaults.standard.set(Array(savedIDs), forKey: "savedIDs")
        UserDefaults.standard.set(Array(readIDs), forKey: "readIDs")
        persist()
        persistHistory()
        pendingNotifications = []
        lastNotificationAt = .now
        persistNotificationQueue()
        scheduleRefresh()
        Task { await loadWeather() }
    }

    private func persist() {
        if let data = try? encoder.encode(preferences) { UserDefaults.standard.set(data, forKey: "preferences") }
    }

    private static func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private func scheduleRefresh() {
        refreshTask?.cancel()
        let seconds = UInt64(max(5, preferences.refreshMinutes) * 60) * 1_000_000_000
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: seconds)
                guard !Task.isCancelled else { return }
                await self?.refresh()
            }
        }
    }

    private func persistNotificationQueue() {
        let defaults = UserDefaults.standard
        defaults.set(lastNotificationAt, forKey: "lastNotificationAt")
        if let data = try? encoder.encode(pendingNotifications) { defaults.set(data, forKey: "pendingNotifications") }
    }

    private func notify(for candidates: [Article]) async {
        guard preferences.notificationsEnabled else { return }
        let keywords = preferences.notificationKeywords.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        func allowed(_ article: Article) -> Bool {
            if !preferences.notificationSourceIDs.isEmpty && !preferences.notificationSourceIDs.contains(article.sourceID) { return false }
            if !preferences.notificationCategoryIDs.isEmpty && !preferences.notificationCategoryIDs.contains(article.categoryID) { return false }
            if isMuted(article) { return false }
            if keywords.isEmpty { return true }
            return keywords.contains { normalized("\(article.title) \(article.excerpt)").contains(normalized($0)) }
        }
        var unique: [String: Article] = [:]
        for article in pendingNotifications.filter(allowed) + candidates.filter(allowed) { unique[article.id] = article }
        pendingNotifications = Array(unique.values.sorted { $0.publishedAt > $1.publishedAt }.prefix(notificationLimit))
        persistNotificationQueue()

        guard !pendingNotifications.isEmpty, !isQuietTime,
              Date().timeIntervalSince(lastNotificationAt) >= notificationInterval else { return }
        let content = UNMutableNotificationContent()
        content.title = pendingNotifications.count == 1 ? "Știre nouă" : "\(pendingNotifications.count) știri noi"
        content.body = pendingNotifications.map { "\($0.sourceName): \($0.title)" }.joined(separator: "\n")
        content.sound = .default
        do {
            try await UNUserNotificationCenter.current().add(
                UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
            )
            lastNotificationAt = .now
            pendingNotifications = []
            persistNotificationQueue()
        } catch {
            // Keep the pending batch for the next successful refresh.
        }
    }

    private var isQuietTime: Bool {
        guard preferences.quietHoursEnabled else { return false }
        let hour = Calendar.current.component(.hour, from: .now)
        let start = preferences.quietHoursStart, end = preferences.quietHoursEnd
        if start == end { return true }
        return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end)
    }
}
