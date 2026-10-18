import SwiftUI
import CoreLocation

struct ContentView: View {
    @EnvironmentObject private var store: NewsStore
    @StateObject private var locationManager = AppLocationManager()
    @State private var showSettings = false
    @State private var showDigest = false
    @State private var showStats = false
    @State private var showWeather = false
    @State private var selectedArticle: Article?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if store.preferences.weatherEnabled { weatherSummary }
                filters
                if store.isLoading && store.articles.isEmpty {
                    ProgressView("Se încarcă știrile…").frame(maxHeight: .infinity)
                } else if store.filteredArticles.isEmpty {
                    emptyState
                } else {
                    articleList
                }
            }
            .navigationTitle("Știri RO · v\(AppVersion.number)")
            .searchable(text: $store.searchText, prompt: "Caută știri")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }
                        .accessibilityLabel("Setări")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showDigest = true } label: { Image(systemName: "text.book.closed") }
                        .accessibilityLabel("Rezumatul zilei")
                    Button {
                        Task {
                            await store.refresh()
                            await store.loadWeather()
                        }
                    } label: {
                        if store.isLoading { ProgressView() }
                        else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(store.isLoading)
                    .accessibilityLabel("Actualizează știrile")
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .sheet(isPresented: $showDigest) { DigestSheet() }
            .sheet(isPresented: $showStats) { PersonalStatsSheet() }
            .sheet(isPresented: $showWeather) {
                if let weather = store.weather { WeatherSheet(report: weather) }
            }
            .fullScreenCover(item: $selectedArticle) { ArticleReader(article: $0) }
        }
        .dynamicTypeSize(store.preferences.textSize == .small ? .small : store.preferences.textSize == .large ? .xLarge : .large)
        .onAppear { requestAutomaticLocationIfNeeded() }
        .onChange(of: store.preferences.weatherEnabled) { _ in requestAutomaticLocationIfNeeded() }
        .onChange(of: store.preferences.weatherLocationMode) { _ in requestAutomaticLocationIfNeeded() }
        .onReceive(locationManager.$coordinate) { coordinate in
            if let coordinate { Task { await store.setAutomaticLocation(coordinate) } }
        }
    }

    private func requestAutomaticLocationIfNeeded() {
        if store.preferences.weatherEnabled && store.preferences.weatherLocationMode == .automatic {
            locationManager.request()
        }
    }

    private var weatherSummary: some View {
        Button {
            if store.weather != nil { showWeather = true }
            else { Task { await store.loadWeather() } }
        } label: {
            HStack(spacing: 10) {
                if let report = store.weather {
                    Image(systemName: report.symbol).font(.title3).symbolRenderingMode(.multicolor)
                    VStack(alignment: .leading) {
                        Text(report.place).font(.subheadline.bold())
                        Text(report.description).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("\(report.temperature)°C").font(.title3.bold())
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                } else if store.weatherLoading {
                    ProgressView()
                    Text("Se încarcă vremea…")
                } else {
                    Image(systemName: "cloud.sun")
                    Text(store.weatherError ?? (store.preferences.weatherLocationMode == .automatic
                         ? locationManager.errorMessage ?? "Așteptăm locația pentru meteo"
                         : "Setează localitatea în Setări"))
                        .font(.caption)
                    Spacer()
                    Image(systemName: "arrow.clockwise").font(.caption)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(.thinMaterial)
        }
        .buttonStyle(.plain)
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
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    toggleChip("Top 10", icon: "chart.line.uptrend.xyaxis", active: store.showTopOnly) {
                        let next = !store.showTopOnly
                        store.showTopOnly = next
                        if next { store.showTopicsOnly = false; store.showSavedOnly = false; store.showHistoryOnly = false }
                    }
                    toggleChip("Subiectele mele", icon: "number", active: store.showTopicsOnly) {
                        let next = !store.showTopicsOnly
                        store.showTopicsOnly = next
                        if next { store.showTopOnly = false; store.showSavedOnly = false; store.showHistoryOnly = false }
                    }
                    Button { showStats = true } label: { Label("Statistici", systemImage: "chart.bar") }
                        .buttonStyle(.bordered).controlSize(.small)
                    toggleChip("Salvate", icon: "star.fill", active: store.showSavedOnly) {
                        store.showSavedOnly.toggle()
                        if store.showSavedOnly { store.showTopOnly = false; store.showTopicsOnly = false }
                    }
                    toggleChip("Necitite", icon: "circle.fill", active: store.showUnreadOnly) { store.showUnreadOnly.toggle() }
                    toggleChip("Istoric", icon: "clock.arrow.circlepath", active: store.showHistoryOnly) {
                        store.showHistoryOnly.toggle()
                        if store.showHistoryOnly { store.showTopOnly = false; store.showTopicsOnly = false }
                    }
                    toggleChip("Știri locale", icon: "mappin", active: store.showLocalOnly) { store.showLocalOnly.toggle() }
                    if store.showUnreadOnly {
                        Button("Marchează citite") { store.markAllVisibleRead() }.font(.caption)
                    }
                }.padding(.horizontal)
            }
            if store.showHistoryOnly {
                HStack {
                    DatePicker("De la", selection: $store.historyStartDate, displayedComponents: .date)
                    DatePicker("Până la", selection: $store.historyEndDate, displayedComponents: .date)
                }.font(.caption).padding(.horizontal)
            }
            if store.showLocalOnly && store.localPlace.isEmpty {
                Text("Alege o localitate în Setări → Meteo pentru știrile locale.")
                    .font(.caption).foregroundStyle(.secondary).padding(.horizontal)
            }
        }
        .padding(.vertical, 8)
        .background(.bar)
    }

    private var articleList: some View {
        List(store.filteredArticles) { article in
            ArticleRow(
                article: article, compact: store.preferences.density == .compact,
                saved: store.savedIDs.contains(article.id),
                unread: !store.readIDs.contains(article.id)
            ) {
                store.toggleSaved(article)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                store.markRead(article)
                selectedArticle = article
            }
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
        }
        .listStyle(.plain)
        .refreshable {
            await store.refresh()
            await store.loadWeather()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "newspaper")
                .font(.system(size: 42))
                .foregroundStyle(.secondary)
            Text("Nicio știre").font(.title3.bold())
            Text("Schimbă filtrele sau actualizează fluxul.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding().frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func filterChip(_ text: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(text, action: action)
            .buttonStyle(.borderedProminent)
            .tint(active ? .accentColor : .gray.opacity(0.35))
            .controlSize(.small)
    }

    private func toggleChip(_ text: String, icon: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Label(text, systemImage: icon) }
            .buttonStyle(.bordered)
            .tint(active ? .accentColor : .secondary)
            .controlSize(.small)
    }
}

private struct PersonalStatsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: NewsStore

    var body: some View {
        NavigationStack {
            List {
                Section("Ultimele 30 de zile") {
                    LabeledContent("Deschideri de articole", value: "\(store.personalStats.opens)")
                    LabeledContent("Articole distincte", value: "\(store.personalStats.unique)")
                    Text("Datele sunt păstrate local. Se numără deschiderile efectuate după activarea funcției.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Publicații citite") {
                    if store.personalStats.sources.isEmpty { Text("Încă nu există date.") }
                    ForEach(store.personalStats.sources, id: \.0) { item in
                        LabeledContent(item.0, value: "\(item.1)")
                    }
                }
                Section("Categorii citite") {
                    if store.personalStats.categories.isEmpty { Text("Încă nu există date.") }
                    ForEach(store.personalStats.categories, id: \.0) { item in
                        LabeledContent(item.0, value: "\(item.1)")
                    }
                }
            }
            .navigationTitle("Statistici personale")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Gata") { dismiss() } } }
        }
    }
}

private struct DigestSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: NewsStore
    @State private var selectedArticle: Article?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Selecție din ultimele 24 de ore, maximum două articole per publicație. Sunt prioritizate sursele favorite.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if store.dailyDigest.isEmpty {
                    Text("Nu există suficiente știri noi pentru rezumat.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(store.dailyDigest) { article in
                        Button {
                            store.markRead(article)
                            selectedArticle = article
                        } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(article.sourceName).font(.caption).foregroundStyle(.secondary)
                                Text(article.title).font(.headline).foregroundStyle(.primary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Rezumatul zilei")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Gata") { dismiss() } } }
            .fullScreenCover(item: $selectedArticle) { ArticleReader(article: $0) }
        }
    }
}

private struct WeatherSheet: View {
    @Environment(\.dismiss) private var dismiss
    let report: WeatherReport

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack {
                        Image(systemName: report.symbol).font(.largeTitle).symbolRenderingMode(.multicolor)
                        VStack(alignment: .leading) {
                            Text(report.place).font(.title2.bold())
                            Text(report.description).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(report.temperature)°").font(.largeTitle.bold())
                    }
                    HStack {
                        Label("Resimțite: \(report.feelsLike)°", systemImage: "thermometer.medium")
                        Spacer()
                        Label("Umiditate: \(report.humidity)%", systemImage: "humidity")
                    }.font(.caption)
                    Label("Vânt: \(report.wind) km/h", systemImage: "wind").font(.caption)

                    Text("Azi — prognoză pe ore").font(.headline)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(report.hours) { hour in
                                VStack(spacing: 8) {
                                    Text(String(hour.time.suffix(5))).font(.caption)
                                    Image(systemName: hour.symbol).symbolRenderingMode(.multicolor)
                                    Text("\(hour.temperature)°").bold()
                                    Label("\(hour.rainChance)%", systemImage: "drop")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                                .frame(width: 72).padding(.vertical, 10)
                                .background(.thinMaterial).clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }

                    Text("Următoarele 5 zile").font(.headline)
                    ForEach(report.days) { day in
                        HStack {
                            Image(systemName: day.symbol).symbolRenderingMode(.multicolor).frame(width: 30)
                            VStack(alignment: .leading) {
                                Text(day.date).font(.subheadline.bold())
                                Text(day.description).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("\(day.minimum)° / \(day.maximum)°").font(.subheadline)
                            Label("\(day.rainChance)%", systemImage: "drop").font(.caption)
                        }
                        Divider()
                    }
                }.padding()
            }
            .navigationTitle("Prognoza meteo")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Gata") { dismiss() } } }
        }
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
