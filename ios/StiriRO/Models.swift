import Foundation
import SwiftUI

struct NewsSource: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let feedURL: URL
    let homepage: URL
    let colorHex: String
}

struct NewsCategory: Identifiable, Codable, Hashable {
    let id: String
    let name: String
}

struct Article: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let link: URL
    let excerpt: String
    let publishedAt: Date
    let imageURL: URL?
    let sourceID: String
    let sourceName: String
    let categoryID: String
}

enum AppTheme: String, Codable, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var label: String { switch self { case .system: "Automată"; case .light: "Luminoasă"; case .dark: "Întunecată" } }
}

enum TextSize: String, Codable, CaseIterable, Identifiable {
    case small, normal, large
    var id: String { rawValue }
    var label: String { switch self { case .small: "Mic"; case .normal: "Normal"; case .large: "Mare" } }
    var scale: CGFloat { switch self { case .small: 0.9; case .normal: 1; case .large: 1.15 } }
}

enum CardDensity: String, Codable, CaseIterable, Identifiable {
    case compact, comfortable
    var id: String { rawValue }
    var label: String { self == .compact ? "Compactă" : "Confortabilă" }
}

enum WeatherLocationMode: String, Codable, CaseIterable, Identifiable {
    case automatic, manual
    var id: String { rawValue }
    var label: String { self == .automatic ? "Automată" : "Manuală" }
}

enum AppVersion {
    static var number: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.8"
    }
    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "8"
    }
}

struct Preferences: Codable, Equatable {
    var notificationsEnabled = true
    var notificationSourceIDs: Set<String> = []
    var notificationCategoryIDs: Set<String> = []
    var notificationKeywords = ""
    var quietHoursEnabled = false
    var quietHoursStart = 22
    var quietHoursEnd = 8
    var refreshMinutes = 15
    var hiddenSourceIDs: Set<String> = []
    var favoriteSourceIDs: Set<String> = []
    var sourceOrder: [String] = []
    var mutedKeywords: [String] = []
    var weatherEnabled = true
    var weatherLocationMode = WeatherLocationMode.automatic
    var weatherManualCity = ""
    var weatherAutomaticLatitude: Double?
    var weatherAutomaticLongitude: Double?
    var weatherAutomaticName = ""
    var theme = AppTheme.system
    var textSize = TextSize.normal
    var density = CardDensity.comfortable

    var colorScheme: ColorScheme? {
        switch theme { case .system: nil; case .light: .light; case .dark: .dark }
    }

    // Decode older installed preferences without losing the user's choices when a new field is added.
    init() {}
    enum CodingKeys: String, CodingKey {
        case notificationsEnabled, notificationSourceIDs, notificationCategoryIDs, notificationKeywords
        case quietHoursEnabled, quietHoursStart, quietHoursEnd, refreshMinutes
        case hiddenSourceIDs, favoriteSourceIDs, sourceOrder, mutedKeywords
        case weatherEnabled, weatherLocationMode, weatherManualCity
        case weatherAutomaticLatitude, weatherAutomaticLongitude, weatherAutomaticName
        case theme, textSize, density
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        notificationsEnabled = try c.decodeIfPresent(Bool.self, forKey: .notificationsEnabled) ?? true
        notificationSourceIDs = try c.decodeIfPresent(Set<String>.self, forKey: .notificationSourceIDs) ?? []
        notificationCategoryIDs = try c.decodeIfPresent(Set<String>.self, forKey: .notificationCategoryIDs) ?? []
        notificationKeywords = try c.decodeIfPresent(String.self, forKey: .notificationKeywords) ?? ""
        quietHoursEnabled = try c.decodeIfPresent(Bool.self, forKey: .quietHoursEnabled) ?? false
        quietHoursStart = try c.decodeIfPresent(Int.self, forKey: .quietHoursStart) ?? 22
        quietHoursEnd = try c.decodeIfPresent(Int.self, forKey: .quietHoursEnd) ?? 8
        refreshMinutes = try c.decodeIfPresent(Int.self, forKey: .refreshMinutes) ?? 15
        hiddenSourceIDs = try c.decodeIfPresent(Set<String>.self, forKey: .hiddenSourceIDs) ?? []
        favoriteSourceIDs = try c.decodeIfPresent(Set<String>.self, forKey: .favoriteSourceIDs) ?? []
        sourceOrder = try c.decodeIfPresent([String].self, forKey: .sourceOrder) ?? []
        mutedKeywords = try c.decodeIfPresent([String].self, forKey: .mutedKeywords) ?? []
        weatherEnabled = try c.decodeIfPresent(Bool.self, forKey: .weatherEnabled) ?? true
        weatherLocationMode = try c.decodeIfPresent(WeatherLocationMode.self, forKey: .weatherLocationMode) ?? .automatic
        weatherManualCity = try c.decodeIfPresent(String.self, forKey: .weatherManualCity) ?? ""
        weatherAutomaticLatitude = try c.decodeIfPresent(Double.self, forKey: .weatherAutomaticLatitude)
        weatherAutomaticLongitude = try c.decodeIfPresent(Double.self, forKey: .weatherAutomaticLongitude)
        weatherAutomaticName = try c.decodeIfPresent(String.self, forKey: .weatherAutomaticName) ?? ""
        theme = try c.decodeIfPresent(AppTheme.self, forKey: .theme) ?? .system
        textSize = try c.decodeIfPresent(TextSize.self, forKey: .textSize) ?? .normal
        density = try c.decodeIfPresent(CardDensity.self, forKey: .density) ?? .comfortable
    }
}

enum Catalog {
    static let categories = [
        NewsCategory(id: "actualitate", name: "Actualitate"), NewsCategory(id: "politica", name: "Politică"),
        NewsCategory(id: "economie", name: "Economie"), NewsCategory(id: "externe", name: "Externe"),
        NewsCategory(id: "societate", name: "Societate"), NewsCategory(id: "sanatate", name: "Sănătate"),
        NewsCategory(id: "sport", name: "Sport"), NewsCategory(id: "tehnologie", name: "Tehnologie"),
        NewsCategory(id: "cultura", name: "Cultură & lifestyle")
    ]

    static let sources: [NewsSource] = [
        source("digi24", "Digi24", "https://www.digi24.ro/rss", "https://www.digi24.ro", "1F5FBF"),
        source("antena3", "Antena 3 CNN", "https://www.antena3.ro/rss", "https://www.antena3.ro", "B20D30"),
        source("stiripesurse", "Știripesurse", "https://www.stiripesurse.ro/rss/stiri.xml", "https://www.stiripesurse.ro", "D94820"),
        source("b1tv", "B1TV", "https://www.b1tv.ro/feed", "https://www.b1tv.ro", "ED1C24"),
        source("hotnews", "HotNews", "https://hotnews.ro/feed", "https://hotnews.ro", "E62B2F"),
        source("g4media", "G4Media", "https://www.g4media.ro/feed", "https://www.g4media.ro", "244A78"),
        source("adevarul", "Adevărul", "https://adevarul.ro/rss/index", "https://adevarul.ro", "1F1F1F"),
        source("libertatea", "Libertatea", "https://www.libertatea.ro/feed", "https://www.libertatea.ro", "E52329"),
        source("mediafax", "Mediafax", "https://www.mediafax.ro/feed", "https://www.mediafax.ro", "1366B1"),
        source("stirileprotv", "Știrile ProTV", "https://stirileprotv.ro/rss/", "https://stirileprotv.ro", "1769AA"),
        source("observator", "Observator News", "https://observatornews.ro/rss/", "https://observatornews.ro", "F04A24"),
        source("rfi", "RFI România", "https://www.rfi.fr/ro/rss", "https://www.rfi.ro", "E2001A"),
        source("economica", "Economica.net", "https://www.economica.net/feed", "https://www.economica.net", "14745A"),
        source("gsp", "Gazeta Sporturilor", "https://www.gsp.ro/rss.xml", "https://www.gsp.ro", "E55325"),
        source("prosport", "ProSport", "https://www.prosport.ro/feed", "https://www.prosport.ro", "D71920"),
        source("spotmedia", "SpotMedia", "https://spotmedia.ro/feed", "https://spotmedia.ro", "744A90"),
        source("recorder", "Recorder", "https://recorder.ro/feed/", "https://recorder.ro", "111111"),
        source("descopera", "Descoperă", "https://www.descopera.ro/feed", "https://www.descopera.ro", "177F86"),
        source("cotidianul", "Cotidianul", "https://www.cotidianul.ro/feed/", "https://www.cotidianul.ro", "7A1F28"),
        source("context", "Context.ro", "https://context.ro/feed/", "https://context.ro", "563F8D"),
        source("edupedu", "Edupedu", "https://www.edupedu.ro/feed/", "https://www.edupedu.ro", "146CA5"),
        source("autocritica", "Autocritica", "https://www.autocritica.ro/feed/", "https://www.autocritica.ro", "2F3D46"),
        source("defapt", "DeFapt.ro", "https://defapt.ro/rss", "https://defapt.ro", "BC2026"),
        source("buletindebucuresti", "Buletin de București", "https://buletin.de/bucuresti/feed/", "https://buletin.de/bucuresti", "415F72")
    ]

    private static func source(_ id: String, _ name: String, _ feed: String, _ home: String, _ color: String) -> NewsSource {
        NewsSource(id: id, name: name, feedURL: URL(string: feed)!, homepage: URL(string: home)!, colorHex: color)
    }
}

