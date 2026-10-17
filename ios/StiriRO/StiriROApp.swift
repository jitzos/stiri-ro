import SwiftUI

@main
struct StiriROApp: App {
    @StateObject private var store = NewsStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(store.preferences.colorScheme)
                .task { await store.initialLoad() }
        }
    }
}

