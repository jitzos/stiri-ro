import Foundation
import UserNotifications

@MainActor
final class NewsStore: ObservableObject {
    @Published var articles: [Article] = []
    @Published var preferences: Preferences
    @Published var savedIDs: Set<String>
    @Published var readIDs: Set<String>
    @Published var selectedSourceID: String?
    @Published var selectedCategoryID: String?
    @Published var showSavedOnly = false
    @Published var showUnreadOnly = false
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var failures: [String] = []
    @Published var lastUpdated: Date?

    private let service = FeedService()
    private var knownIDs: Set<String> = []
    private var baselineReady = false
    private var refreshTask: Task<Void, Never>?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        preferences = Self.load(Preferences.self, key: "preferences") ?? Preferences()
        savedIDs = Set(UserDefaults.standard.stringArray(forKey: "savedIDs") ?? [])
        readIDs = Set(UserDefaults.standard.stringArray(forKey: "readIDs") ?? [])
    }

    var visibleSources: [NewsSource] {
        Catalog.sources.filter { !preferences.hiddenSourceIDs.contains($0.id) }.sorted {
            let favoriteDifference = (preferences.favoriteSourceIDs.contains($1.id) ? 1 : 0)
                - (preferences.favoriteSourceIDs.contains($0.id) ? 1 : 0)
            return favoriteDifference != 0 ? favoriteDifference < 0 : $0.name < $1.name
        }
    }

    var filteredArticles: [Article] {
        articles.filter { article in
            if let selectedSourceID, article.sourceID != selectedSourceID { return false }
            if let selectedCategoryID, article.categoryID != selectedCategoryID { return false }
            if showSavedOnly && !savedIDs.contains(article.id) { return false }
            if showUnreadOnly && readIDs.contains(article.id) { return false }
            if !searchText.isEmpty {
                let needle = searchText.folding(options: .diacriticInsensitive, locale: .current).lowercased()
                let text = "\(article.title) \(article.excerpt) \(article.sourceName)".folding(options: .diacriticInsensitive, locale: .current).lowercased()
                if !text.contains(needle) { return false }
            }
            return true
        }
    }

    func initialLoad() async {
        guard articles.isEmpty else { return }
        await refresh()
        scheduleRefresh()
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
        if knownIDs.count > 2_000 { knownIDs = Set(newArticles.prefix(2_000).map(\.id)) }
        baselineReady = true
        isLoading = false
        await notify(for: unseen)
    }

    func updatePreferences(_ change: (inout Preferences) -> Void) {
        change(&preferences)
        persist()
        scheduleRefresh()
    }

    func toggleSaved(_ article: Article) {
        if !savedIDs.insert(article.id).inserted { savedIDs.remove(article.id) }
        UserDefaults.standard.set(Array(savedIDs), forKey: "savedIDs")
    }

    func markRead(_ article: Article) {
        readIDs.insert(article.id)
        UserDefaults.standard.set(Array(readIDs), forKey: "readIDs")
    }

    func markAllVisibleRead() {
        readIDs.formUnion(filteredArticles.map(\.id))
        UserDefaults.standard.set(Array(readIDs), forKey: "readIDs")
    }

    func requestNotificationsIfNeeded() async {
        guard preferences.notificationsEnabled else { return }
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
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

    private func notify(for candidates: [Article]) async {
        guard preferences.notificationsEnabled, !isQuietTime else { return }
        let keywords = preferences.notificationKeywords.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }.filter { !$0.isEmpty }
        let matches = candidates.filter { article in
            if !preferences.notificationSourceIDs.isEmpty && !preferences.notificationSourceIDs.contains(article.sourceID) { return false }
            if !preferences.notificationCategoryIDs.isEmpty && !preferences.notificationCategoryIDs.contains(article.categoryID) { return false }
            if keywords.isEmpty { return true }
            let text = "\(article.title) \(article.excerpt)".lowercased()
            return keywords.contains(where: text.contains)
        }
        guard let first = matches.first else { return }
        let content = UNMutableNotificationContent()
        content.title = matches.count == 1 ? "Știre nouă" : "\(matches.count) știri noi"
        content.body = matches.count == 1 ? "\(first.sourceName): \(first.title)" : "\(first.title) și încă \(matches.count - 1)"
        content.sound = .default
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }

    private var isQuietTime: Bool {
        guard preferences.quietHoursEnabled else { return false }
        let hour = Calendar.current.component(.hour, from: .now)
        let start = preferences.quietHoursStart, end = preferences.quietHoursEnd
        if start == end { return true }
        return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end)
    }
}
