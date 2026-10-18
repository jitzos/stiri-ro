import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: NewsStore
    @State private var manualCityDraft = ""
    @State private var mutedDraft = ""
    @State private var exportDocument: StiriBackupDocument?
    @State private var exporting = false
    @State private var importing = false
    @State private var backupMessage = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Actualizare") {
                    Picker("Interval", selection: binding(\.refreshMinutes)) {
                        ForEach([5, 10, 15, 30, 60], id: \.self) { Text("\($0) minute").tag($0) }
                    }
                    if let date = store.lastUpdated {
                        LabeledContent("Ultima actualizare", value: date.formatted(date: .omitted, time: .shortened))
                    }
                    if !store.failures.isEmpty {
                        Text("Surse indisponibile: \(store.failures.joined(separator: ", "))")
                            .font(.caption).foregroundStyle(.orange)
                    }
                    Text("Actualizarea automată funcționează cât timp aplicația este activă.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Aspect") {
                    Picker("Temă", selection: binding(\.theme)) {
                        ForEach(AppTheme.allCases) { Text($0.label).tag($0) }
                    }
                    Picker("Text", selection: binding(\.textSize)) {
                        ForEach(TextSize.allCases) { Text($0.label).tag($0) }
                    }
                    Picker("Carduri", selection: binding(\.density)) {
                        ForEach(CardDensity.allCases) { Text($0.label).tag($0) }
                    }
                }

                Section("Meteo") {
                    Toggle("Arată prognoza meteo", isOn: binding(\.weatherEnabled))
                    if store.preferences.weatherEnabled {
                        Picker("Locație", selection: binding(\.weatherLocationMode)) {
                            ForEach(WeatherLocationMode.allCases) { Text($0.label).tag($0) }
                        }.pickerStyle(.segmented)
                        if store.preferences.weatherLocationMode == .automatic {
                            Text("Locație: \(store.preferences.weatherAutomaticName.isEmpty ? "în curs de detectare" : store.preferences.weatherAutomaticName)")
                                .font(.caption)
                            Text("Poți acorda accesul la locație din setările telefonului.")
                                .font(.caption).foregroundStyle(.secondary)
                        } else {
                            TextField("Oraș (ex: Cluj-Napoca)", text: $manualCityDraft)
                                .textInputAutocapitalization(.words)
                            Button("Salvează orașul") {
                                let value = String(manualCityDraft.trimmingCharacters(in: .whitespacesAndNewlines).prefix(120))
                                store.updatePreferences { $0.weatherManualCity = value }
                            }
                        }
                        if let error = store.weatherError { Text(error).font(.caption).foregroundStyle(.orange) }
                    }
                }

                Section("Notificări locale") {
                    Toggle("Activează notificările", isOn: binding(\.notificationsEnabled))
                        .onChange(of: store.preferences.notificationsEnabled) { enabled in
                            if enabled { Task { await store.requestNotificationsIfNeeded() } }
                        }
                    Text("Cel mult o notificare la 6 ore, cu maximum 5 titluri.")
                        .font(.caption).foregroundStyle(.secondary)
                    TextField("Cuvinte-cheie, separate prin virgulă", text: binding(\.notificationKeywords))
                    Toggle("Ore de liniște", isOn: binding(\.quietHoursEnabled))
                    if store.preferences.quietHoursEnabled {
                        Stepper("De la \(store.preferences.quietHoursStart):00", value: binding(\.quietHoursStart), in: 0...23)
                        Stepper("Până la \(store.preferences.quietHoursEnd):00", value: binding(\.quietHoursEnd), in: 0...23)
                    }
                    Text("iOS poate suspenda aplicația în fundal: notificarea nu este garantată la o oră fixă.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Filtre notificări") {
                    NavigationLink("Surse pentru notificări") {
                        SelectionList(title: "Surse", entries: Catalog.sources.map { ($0.id, $0.name) },
                                      selection: binding(\.notificationSourceIDs))
                    }
                    NavigationLink("Categorii pentru notificări") {
                        SelectionList(title: "Categorii",
                                      entries: Catalog.categories.map { ($0.id, $0.name) },
                                      selection: binding(\.notificationCategoryIDs))
                    }
                    Text("Fără selecție = toate sursele și categoriile.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Subiecte ascunse") {
                    TextField("Ex: horoscop, monden", text: $mutedDraft, axis: .vertical)
                        .lineLimit(2...4)
                    Button("Salvează lista") {
                        let words = mutedDraft.split(separator: ",").map(String.init)
                        store.updatePreferences { $0.mutedKeywords = words }
                    }
                    Text("Aceste cuvinte sunt excluse din știri, notificări și rezumat.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Surse — favorite, afișare și ordine") {
                    Text("Apasă Editare pentru a muta sursele în lista ta.")
                        .font(.caption).foregroundStyle(.secondary)
                    ForEach(store.orderedSourceIDs, id: \.self) { id in
                        if let source = Catalog.sources.first(where: { $0.id == id }) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(source.name)
                                    Toggle("Vizibilă", isOn: sourceVisibleBinding(id))
                                        .font(.caption)
                                }
                                Spacer()
                                Button {
                                    store.updatePreferences {
                                        if !$0.favoriteSourceIDs.insert(id).inserted {
                                            $0.favoriteSourceIDs.remove(id)
                                        }
                                    }
                                } label: {
                                    Image(systemName: store.preferences.favoriteSourceIDs.contains(id) ? "star.fill" : "star")
                                        .foregroundStyle(.yellow)
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    .onMove(perform: store.moveSources)
                }

                Section("Copie de siguranță") {
                    Button("Exportă datele în JSON") {
                        do {
                            exportDocument = StiriBackupDocument(data: try store.makeBackup())
                            exporting = true
                        } catch {
                            backupMessage = "Exportul nu a reușit."
                        }
                    }
                    Button("Importă o copie de siguranță") { importing = true }
                    Text("Include setările, istoricul (maxim 2.000 de articole), articolele salvate și citite.")
                        .font(.caption).foregroundStyle(.secondary)
                    if !backupMessage.isEmpty {
                        Text(backupMessage).font(.caption).foregroundStyle(.secondary)
                    }
                }

                Section("Despre") {
                    LabeledContent("Aplicație", value: "Știri RO")
                    LabeledContent("Versiune", value: AppVersion.number)
                    LabeledContent("Build", value: AppVersion.build)
                    Text("Aceleași știri și funcții de bază ca pe Windows, adaptate pentru iPhone.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Setări")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { EditButton() }
                ToolbarItem(placement: .confirmationAction) { Button("Gata") { dismiss() } }
            }
            .onAppear {
                manualCityDraft = store.preferences.weatherManualCity
                mutedDraft = store.preferences.mutedKeywords.joined(separator: ", ")
            }
            .fileExporter(isPresented: $exporting, document: exportDocument, contentType: .json,
                          defaultFilename: "StiriRO-iOS-backup") { result in
                if case .failure = result { backupMessage = "Exportul nu a reușit." }
                else { backupMessage = "Copia de siguranță a fost exportată." }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                do {
                    let url = try result.get()
                    let granted = url.startAccessingSecurityScopedResource()
                    defer { if granted { url.stopAccessingSecurityScopedResource() } }
                    try store.restoreBackup(Data(contentsOf: url))
                    manualCityDraft = store.preferences.weatherManualCity
                    mutedDraft = store.preferences.mutedKeywords.joined(separator: ", ")
                    backupMessage = "Datele au fost restaurate."
                } catch { backupMessage = "Fișierul de backup nu este valid." }
            }
        }
    }

    private func binding<T>(_ keyPath: WritableKeyPath<Preferences, T>) -> Binding<T> {
        Binding(
            get: { store.preferences[keyPath: keyPath] },
            set: { value in store.updatePreferences { $0[keyPath: keyPath] = value } }
        )
    }

    private func sourceVisibleBinding(_ id: String) -> Binding<Bool> {
        Binding(
            get: { !store.preferences.hiddenSourceIDs.contains(id) },
            set: { visible in
                store.updatePreferences {
                    if visible { $0.hiddenSourceIDs.remove(id) }
                    else { $0.hiddenSourceIDs.insert(id) }
                }
            }
        )
    }
}

private struct SelectionList: View {
    let title: String
    let entries: [(String, String)]
    @Binding var selection: Set<String>

    var body: some View {
        List(entries, id: \.0) { id, name in
            Button {
                if !selection.insert(id).inserted { selection.remove(id) }
            } label: {
                HStack {
                    Text(name)
                    Spacer()
                    if selection.contains(id) { Image(systemName: "checkmark") }
                }
            }
            .foregroundStyle(.primary)
        }
        .navigationTitle(title)
    }
}
