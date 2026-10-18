import Foundation

struct ReadingEvent: Codable, Identifiable, Hashable {
    let id: String
    let articleId: String
    let at: String
}

struct PortableArticle: Codable {
    let id: String
    let title: String
    let link: String
    let excerpt: String
    let publishedAt: String
    let imageURL: String?
    let sourceID: String
    let sourceName: String
    let categoryID: String

    init(_ article: Article) {
        id = article.id
        title = article.title
        link = article.link.absoluteString
        excerpt = article.excerpt
        publishedAt = Self.formatter.string(from: article.publishedAt)
        imageURL = article.imageURL?.absoluteString
        sourceID = article.sourceID
        sourceName = article.sourceName
        categoryID = article.categoryID
    }

    func article() -> Article? {
        guard !id.isEmpty, id.count <= 512, let url = URL(string: link),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        let date = Self.formatter.date(from: publishedAt) ?? ISO8601DateFormatter().date(from: publishedAt) ?? .distantPast
        let picture = imageURL.flatMap(URL.init(string:))
        return Article(id: id, title: String(title.prefix(500)), link: url,
                       excerpt: String(excerpt.prefix(1000)), publishedAt: date,
                       imageURL: ["http", "https"].contains(picture?.scheme?.lowercased() ?? "") ? picture : nil,
                       sourceID: sourceID, sourceName: sourceName, categoryID: categoryID)
    }

    static var formatter: ISO8601DateFormatter {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }
}

struct SyncSnapshot: Codable {
    let app: String
    let formatVersion: Int
    let exportedAt: String
    let followedTopics: [String]
    let favoriteSourceIDs: [String]
    let hiddenSourceIDs: [String]
    let readIDs: [String]
    let savedArticles: [PortableArticle]
    let readingEvents: [ReadingEvent]
}
