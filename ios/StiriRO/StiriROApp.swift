import SwiftUI

@main
struct StiriROApp: App {
    @StateObject private var store = NewsStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(store.preferences.colorScheme)
                .task {
                    await store.requestNotificationsIfNeeded()
                    await store.initialLoad()
                }
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        Task {
                            await store.refresh()
                            await store.loadWeather()
                        }
                    }
                }
        }
    }
}

