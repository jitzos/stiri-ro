import SwiftUI
import WebKit

struct ArticleReader: View {
    @Environment(\.dismiss) private var dismiss
    let article: Article

    var body: some View {
        NavigationStack {
            WebView(url: article.link)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle(article.sourceName)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Înapoi") { dismiss() } } }
        }
    }
}

private struct WebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.allowsBackForwardNavigationGestures = true
        view.load(URLRequest(url: url))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

