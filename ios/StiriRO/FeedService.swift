import Foundation

actor FeedService {
    private let session: URLSession

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.httpAdditionalHeaders = [
            "User-Agent": "StiriRO-iOS/0.1",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"
        ]
        session = URLSession(configuration: configuration)
    }

    func fetch(sources: [NewsSource]) async -> ([Article], [String]) {
        await withTaskGroup(of: (String, Result<[Article], Error>).self) { group in
            for source in sources {
                group.addTask { [session] in
                    do {
                        let (data, response) = try await session.data(from: source.feedURL)
                        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                            throw URLError(.badServerResponse)
                        }
                        return (source.name, .success(FeedParser.parse(data: data, source: source)))
                    } catch { return (source.name, .failure(error)) }
                }
            }

            var articles: [Article] = []
            var failures: [String] = []
            for await (name, result) in group {
                switch result {
                case .success(let items): articles.append(contentsOf: items.prefix(50))
                case .failure: failures.append(name)
                }
            }

            let unique = Dictionary(articles.map { ($0.link.absoluteString, $0) }, uniquingKeysWith: { first, _ in first })
            return (unique.values.sorted { $0.publishedAt > $1.publishedAt }, failures.sorted())
        }
    }
}

private struct RawItem {
    var title = ""
    var link = ""
    var guid = ""
    var summary = ""
    var content = ""
    var date = ""
    var categories: [String] = []
    var image = ""
}

private final class FeedParser: NSObject, XMLParserDelegate {
    private let source: NewsSource
    private var items: [RawItem] = []
    private var current: RawItem?
    private var element = ""
    private var buffer = ""

    private init(source: NewsSource) { self.source = source }

    static func parse(data: Data, source: NewsSource) -> [Article] {
        let delegate = FeedParser(source: source)
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        parser.shouldProcessNamespaces = false
        parser.parse()
        return delegate.items.compactMap { delegate.article(from: $0) }
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes: [String: String] = [:]) {
        let name = elementName.lowercased()
        if name == "item" || name == "entry" { current = RawItem() }
        guard current != nil else { return }
        element = name
        buffer = ""
        if name == "enclosure" || name.hasSuffix(":content") || name.hasSuffix(":thumbnail") {
            if let url = attributes["url"] { current?.image = url }
        }
        if name == "link", let href = attributes["href"], attributes["rel"] != "self" { current?.link = href }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) { if current != nil { buffer += string } }
    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
        if let string = String(data: CDATABlock, encoding: .utf8) { buffer += string }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        let name = elementName.lowercased()
        guard var item = current else { return }
        let value = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        switch name {
        case "title": item.title += value
        case "link": if item.link.isEmpty { item.link = value }
        case "guid", "id": item.guid = value
        case "description", "summary": item.summary += value
        case "content", "content:encoded": item.content += value
        case "pubdate", "published", "updated", "dc:date": if item.date.isEmpty { item.date = value }
        case "category": if !value.isEmpty { item.categories.append(value) }
        default: break
        }
        current = item
        if name == "item" || name == "entry" {
            items.append(item)
            current = nil
        }
        buffer = ""
    }

    private func article(from item: RawItem) -> Article? {
        let rawLink = item.link.isEmpty ? item.guid : item.link
        guard let link = URL(string: rawLink, relativeTo: source.homepage)?.absoluteURL,
              ["http", "https"].contains(link.scheme?.lowercased() ?? ""),
              !item.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let html = item.content.isEmpty ? item.summary : item.content
        let image = URL(string: item.image, relativeTo: source.homepage)?.absoluteURL ?? Self.imageURL(in: html, base: source.homepage)
        let title = Self.clean(item.title)
        let excerpt = String(Self.clean(item.summary.isEmpty ? html : item.summary).prefix(260))
        return Article(
            id: item.guid.isEmpty ? link.absoluteString : item.guid,
            title: title,
            link: link,
            excerpt: excerpt,
            publishedAt: Self.parseDate(item.date) ?? .distantPast,
            imageURL: image,
            sourceID: source.id,
            sourceName: source.name,
            categoryID: Self.category(for: item, title: title, link: link)
        )
    }

    private static func clean(_ html: String) -> String {
        html.replacingOccurrences(of: "<script[\\s\\S]*?</script>", with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "<style[\\s\\S]*?</style>", with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func imageURL(in html: String, base: URL) -> URL? {
        guard let regex = try? NSRegularExpression(pattern: #"<img[^>]+src=["']([^"']+)["']"#, options: .caseInsensitive),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else { return nil }
        let url = URL(string: String(html[range]), relativeTo: base)?.absoluteURL
        return ["http", "https"].contains(url?.scheme?.lowercased() ?? "") ? url : nil
    }

    private static func parseDate(_ value: String) -> Date? {
        let iso = ISO8601DateFormatter()
        if let date = iso.date(from: value) { return date }
        for format in ["E, d MMM yyyy HH:mm:ss Z", "E, dd MMM yyyy HH:mm:ss Z", "yyyy-MM-dd HH:mm:ss Z"] {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = format
            if let date = formatter.date(from: value) { return date }
        }
        return nil
    }

    private static func category(for item: RawItem, title: String, link: URL) -> String {
        let text = (item.categories.joined(separator: " ") + " " + title + " " + link.absoluteString)
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "ro_RO")).lowercased()
        let rules: [(String, [String])] = [
            ("sport", ["sport", "fotbal", "tenis", "handbal", "baschet"]),
            ("sanatate", ["sanatate", "medical", "medic", "spital", "pacient", "vaccin"]),
            ("tehnologie", ["tehnologie", "stiinta", "software", "internet", "cyber", "inteligenta artificiala"]),
            ("economie", ["economie", "finante", "business", "bursa", "banci", "energie", "taxe"]),
            ("externe", ["externe", "international", "ucraina", "rusia", "nato", "orientul mijlociu"]),
            ("politica", ["politica", "guvern", "parlament", "presedinte", "ministru", "alegeri"]),
            ("cultura", ["cultura", "monden", "film", "muzica", "lifestyle", "turism"]),
            ("societate", ["societate", "educatie", "scoala", "justitie", "politie", "meteo", "bucuresti"])
        ]
        return rules.first(where: { rule in rule.1.contains(where: text.contains) })?.0 ?? "actualitate"
    }
}

