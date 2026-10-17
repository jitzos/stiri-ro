import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: NewsStore

    var body: some View {
        NavigationStack {
            Form {
                Section("Actualizare") {
                    Picker("Interval", selection: binding(\.refreshMinutes)) {
                        ForEach([5, 10, 15, 30, 60], id: \.self) { Text("\($0) minute").tag($0) }
                    }
                    if let date = store.lastUpdated { LabeledContent("Ultima actualizare", value: date.formatted(date: .omitted, time: .shortened)) }
                    if !store.failures.isEmpty { Text("Surse indisponibile: \(store.failures.joined(separator: ", "))").font(.caption).foregroundStyle(.orange) }
                }

                Section("Aspect") {
                    Picker("Temă", selection: binding(\.theme)) { ForEach(AppTheme.allCases) { Text($0.label).tag($0) } }
                    Picker("Text", selection: binding(\.textSize)) { ForEach(TextSize.allCases) { Text($0.label).tag($0) } }
                    Picker("Carduri", selection: binding(\.density)) { ForEach(CardDensity.allCases) { Text($0.label).tag($0) } }
                }

                Section("Notificări locale") {
                    Toggle("Activează notificările", isOn: binding(\.notificationsEnabled))
                        .onChange(of: store.preferences.notificationsEnabled) { enabled in if enabled { Task { await store.requestNotificationsIfNeeded() } } }
                    TextField("Cuvinte-cheie separate prin virgulă", text: binding(\.notificationKeywords))
                    Toggle("Ore de liniște", isOn: binding(\.quietHoursEnabled))
                    if store.preferences.quietHoursEnabled {
                        Stepper("De la ora \(store.preferences.quietHoursStart):00", value: binding(\.quietHoursStart), in: 0...23)
                        Stepper("Până la ora \(store.preferences.quietHoursEnd):00", value: binding(\.quietHoursEnd), in: 0...23)
                    }
                    Text("iOS poate suspenda aplicațiile instalate prin sideload; verificarea în fundal nu poate fi garantată.").font(.caption).foregroundStyle(.secondary)
                }

                Section("Surse") {
                    ForEach(Catalog.sources) { source in
                        VStack(alignment: .leading) {
                            Text(source.name).font(.headline)
                            HStack {
                                Toggle("Vizibilă", isOn: sourceVisibleBinding(source.id))
                                Spacer()
                                Button { toggleFavorite(source.id) } label: {
                                    Image(systemName: store.preferences.favoriteSourceIDs.contains(source.id) ? "star.fill" : "star")
                                }.buttonStyle(.plain).foregroundStyle(.yellow)
                            }
                        }
                    }
                }

                Section("Filtre notificări") {
                    NavigationLink("Surse pentru notificări") { SelectionList(title: "Surse", entries: Catalog.sources.map { ($0.id, $0.name) }, selection: binding(\.notificationSourceIDs)) }
                    NavigationLink("Categorii pentru notificări") { SelectionList(title: "Categorii", entries: Catalog.categories.map { ($0.id, $0.name) }, selection: binding(\.notificationCategoryIDs)) }
                    Text("Dacă nu selectezi nimic, sunt acceptate toate.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Setări")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Gata") { dismiss() } } }
        }
    }

    private func binding<T>(_ keyPath: WritableKeyPath<Preferences, T>) -> Binding<T> {
        Binding(get: { store.preferences[keyPath: keyPath] }, set: { value in store.updatePreferences { $0[keyPath: keyPath] = value } })
    }

    private func sourceVisibleBinding(_ id: String) -> Binding<Bool> {
        Binding(get: { !store.preferences.hiddenSourceIDs.contains(id) }, set: { visible in
            store.updatePreferences { if visible { $0.hiddenSourceIDs.remove(id) } else { $0.hiddenSourceIDs.insert(id) } }
        })
    }

    private func toggleFavorite(_ id: String) {
        store.updatePreferences { if !$0.favoriteSourceIDs.insert(id).inserted { $0.favoriteSourceIDs.remove(id) } }
    }
}

private struct SelectionList: View {
    let title: String
    let entries: [(String, String)]
    @Binding var selection: Set<String>
    var body: some View {
        List(entries, id: \.0) { id, name in
            Button { if !selection.insert(id).inserted { selection.remove(id) } } label: {
                HStack { Text(name); Spacer(); if selection.contains(id) { Image(systemName: "checkmark") } }
            }.foregroundStyle(.primary)
        }.navigationTitle(title)
    }
}

