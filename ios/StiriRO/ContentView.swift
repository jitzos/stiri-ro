import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: NewsStore
    @State private var showSettings = false
    @State private var selectedArticle: Article?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                filters
                if store.isLoading && store.articles.isEmpty { ProgressView("Se încarcă știrile…").frame(maxHeight: .infinity) }
                else if store.filteredArticles.isEmpty { emptyState }
                else { articleList }
            }
            .navigationTitle("Știri RO")
            .searchable(text: $store.searchText, prompt: "Caută știri")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await store.refresh() } } label: {
                        if store.isLoading { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }.disabled(store.isLoading)
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .fullScreenCover(item: $selectedArticle) { ArticleReader(article: $0) }
        }
        .dynamicTypeSize(store.preferences.textSize == .small ? .small : store.preferences.textSize == .large ? .xLarge : .large)
    }

    private var filters: some View {
        VStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    filterChip("Toate", active: store.selectedSourceID == nil) { store.selectedSourceID = nil }
                    ForEach(store.visibleSources) { source in
                        filterChip(source.name, active: store.selectedSourceID == source.id) { store.selectedSourceID = source.id }
                    }
                }.padding(.horizontal)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    filterChip("Toate categoriile", active: store.selectedCategoryID == nil) { store.selectedCategoryID = nil }
                    ForEach(Catalog.categories) { category in
                        filterChip(category.name, active: store.selectedCategoryID == category.id) { store.selectedCategoryID = category.id }
                    }
                }.padding(.horizontal)
            }
            HStack {
                toggleChip("Salvate", icon: "star.fill", active: store.showSavedOnly) { store.showSavedOnly.toggle() }
                toggleChip("Necitite", icon: "circle.fill", active: store.showUnreadOnly) { store.showUnreadOnly.toggle() }
                Spacer()
                if store.showUnreadOnly { Button("Citește toate") { store.markAllVisibleRead() }.font(.caption) }
            }.padding(.horizontal)
        }.padding(.vertical, 8).background(.bar)
    }

    private var articleList: some View {
        List(store.filteredArticles) { article in
            ArticleRow(article: article, compact: store.preferences.density == .compact, saved: store.savedIDs.contains(article.id), unread: !store.readIDs.contains(article.id)) {
                store.toggleSaved(article)
            }
            .contentShape(Rectangle())
            .onTapGesture { store.markRead(article); selectedArticle = article }
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
        }
        .listStyle(.plain)
        .refreshable { await store.refresh() }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "newspaper")
                .font(.system(size: 42))
                .foregroundStyle(.secondary)
            Text("Nicio știre").font(.title3.bold())
            Text("Schimbă filtrele sau actualizează fluxul.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func filterChip(_ text: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(text, action: action).buttonStyle(.borderedProminent).tint(active ? .accentColor : .gray.opacity(0.35)).controlSize(.small)
    }

    private func toggleChip(_ text: String, icon: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Label(text, systemImage: icon) }.buttonStyle(.bordered).tint(active ? .accentColor : .secondary).controlSize(.small)
    }
}

private struct ArticleRow: View {
    let article: Article
    let compact: Bool
    let saved: Bool
    let unread: Bool
    let toggleSaved: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            AsyncImage(url: article.imageURL) { image in image.resizable().scaledToFill() } placeholder: { Color.secondary.opacity(0.12).overlay(Image(systemName: "newspaper")) }
                .frame(width: compact ? 82 : 105, height: compact ? 72 : 94).clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: compact ? 4 : 7) {
                HStack {
                    if unread { Circle().fill(.blue).frame(width: 7, height: 7) }
                    Text(article.sourceName).font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button(action: toggleSaved) { Image(systemName: saved ? "star.fill" : "star").foregroundStyle(saved ? .yellow : .secondary) }.buttonStyle(.plain)
                }
                Text(article.title).font(.headline).lineLimit(compact ? 2 : 3)
                if !compact && !article.excerpt.isEmpty { Text(article.excerpt).font(.subheadline).foregroundStyle(.secondary).lineLimit(2) }
                Text(article.publishedAt, style: .relative).font(.caption2).foregroundStyle(.tertiary)
            }
        }
        .padding(compact ? 8 : 11).background(.background).clipShape(RoundedRectangle(cornerRadius: 14)).shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }
}
