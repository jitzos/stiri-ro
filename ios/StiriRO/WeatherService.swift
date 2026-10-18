import Foundation
import CoreLocation
import Combine

struct ForecastDay: Identifiable {
    var id: String { date }
    let date: String
    let description: String
    let symbol: String
    let maximum: Int
    let minimum: Int
    let rainChance: Int
}

struct ForecastHour: Identifiable {
    var id: String { time }
    let time: String
    let description: String
    let symbol: String
    let temperature: Int
    let rainChance: Int
}

struct WeatherReport {
    let place: String
    let temperature: Int
    let feelsLike: Int
    let humidity: Int
    let wind: Int
    let description: String
    let symbol: String
    let days: [ForecastDay]
    let hours: [ForecastHour]
}

enum WeatherError: LocalizedError {
    case noLocation, invalidResponse
    var errorDescription: String? {
        switch self {
        case .noLocation: return "Localitatea nu a fost găsită."
        case .invalidResponse: return "Prognoza meteo nu este disponibilă."
        }
    }
}

actor WeatherService {
    private struct GeocodingResponse: Decodable {
        struct Place: Decodable {
            let name: String
            let latitude: Double
            let longitude: Double
        }
        let results: [Place]?
    }
    private struct Current: Decodable {
        let temperature_2m: Double
        let apparent_temperature: Double
        let relative_humidity_2m: Double
        let wind_speed_10m: Double
        let weather_code: Int
    }
    private struct Daily: Decodable {
        let time: [String]
        let weather_code: [Int]
        let temperature_2m_max: [Double]
        let temperature_2m_min: [Double]
        let precipitation_probability_max: [Int]
    }
    private struct Hourly: Decodable {
        let time: [String]
        let weather_code: [Int]
        let temperature_2m: [Double]
        let precipitation_probability: [Int]
    }
    private struct ForecastResponse: Decodable {
        let current: Current
        let daily: Daily
        let hourly: Hourly
    }

    func fetch(mode: WeatherLocationMode, manualCity: String, latitude: Double?, longitude: Double?, automaticName: String) async throws -> WeatherReport {
        var placeName = automaticName.isEmpty ? "Locația curentă" : automaticName
        var lat: Double
        var lon: Double
        if mode == .manual {
            let query = manualCity.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !query.isEmpty, query.count <= 120,
                  var parts = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search") else { throw WeatherError.noLocation }
            parts.queryItems = [URLQueryItem(name: "name", value: query),
                                URLQueryItem(name: "count", value: "1"),
                                URLQueryItem(name: "language", value: "ro")]
            guard let url = parts.url else { throw WeatherError.noLocation }
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let location = try JSONDecoder().decode(GeocodingResponse.self, from: data).results?.first else { throw WeatherError.noLocation }
            lat = location.latitude
            lon = location.longitude
            placeName = location.name
        } else {
            guard let latitude, let longitude,
                  (-90...90).contains(latitude), (-180...180).contains(longitude) else { throw WeatherError.noLocation }
            lat = latitude
            lon = longitude
        }

        var components = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        components.queryItems = [
            URLQueryItem(name: "latitude", value: String(lat)),
            URLQueryItem(name: "longitude", value: String(lon)),
            URLQueryItem(name: "current", value: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code"),
            URLQueryItem(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"),
            URLQueryItem(name: "hourly", value: "weather_code,temperature_2m,precipitation_probability"),
            URLQueryItem(name: "forecast_days", value: "5"),
            URLQueryItem(name: "timezone", value: "auto")
        ]
        guard let url = components.url else { throw WeatherError.invalidResponse }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw WeatherError.invalidResponse }
        let result = try JSONDecoder().decode(ForecastResponse.self, from: data)
        let count = [result.daily.time.count, result.daily.weather_code.count, result.daily.temperature_2m_max.count,
                     result.daily.temperature_2m_min.count, result.daily.precipitation_probability_max.count].min() ?? 0
        let days = (0..<min(count, 5)).map { i in
            ForecastDay(date: result.daily.time[i], description: Self.condition(result.daily.weather_code[i]).0,
                        symbol: Self.condition(result.daily.weather_code[i]).1,
                        maximum: Int(result.daily.temperature_2m_max[i].rounded()),
                        minimum: Int(result.daily.temperature_2m_min[i].rounded()),
                        rainChance: result.daily.precipitation_probability_max[i])
        }
        let hourlyCount = [result.hourly.time.count, result.hourly.weather_code.count,
                           result.hourly.temperature_2m.count, result.hourly.precipitation_probability.count].min() ?? 0
        let today = result.daily.time.first ?? ""
        let hours = (0..<hourlyCount).filter { result.hourly.time[$0].hasPrefix(today) }.prefix(24).map { i in
            ForecastHour(time: result.hourly.time[i], description: Self.condition(result.hourly.weather_code[i]).0,
                         symbol: Self.condition(result.hourly.weather_code[i]).1,
                         temperature: Int(result.hourly.temperature_2m[i].rounded()),
                         rainChance: result.hourly.precipitation_probability[i])
        }
        let condition = Self.condition(result.current.weather_code)
        return WeatherReport(place: placeName, temperature: Int(result.current.temperature_2m.rounded()),
                             feelsLike: Int(result.current.apparent_temperature.rounded()),
                             humidity: Int(result.current.relative_humidity_2m.rounded()),
                             wind: Int(result.current.wind_speed_10m.rounded()),
                             description: condition.0, symbol: condition.1, days: days, hours: hours)
    }

    private static func condition(_ code: Int) -> (String, String) {
        switch code {
        case 0: return ("Senin", "sun.max.fill")
        case 1, 2: return ("Parțial noros", "cloud.sun.fill")
        case 3: return ("Înnorat", "cloud.fill")
        case 45, 48: return ("Ceață", "cloud.fog.fill")
        case 51...57: return ("Burniță", "cloud.drizzle.fill")
        case 61...67, 80...82: return ("Ploaie", "cloud.rain.fill")
        case 71...77, 85, 86: return ("Ninsoare", "cloud.snow.fill")
        case 95...99: return ("Furtună", "cloud.bolt.rain.fill")
        default: return ("Vreme variabilă", "cloud.sun.fill")
        }
    }
}

@MainActor
final class AppLocationManager: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published var coordinate: CLLocationCoordinate2D?
    @Published var errorMessage: String?
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
    }

    func request() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
        case .denied, .restricted: errorMessage = "Activează locația în Setările iPhone."
        @unknown default: break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestLocation()
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        coordinate = locations.last?.coordinate
        errorMessage = nil
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        errorMessage = "Locația nu a putut fi detectată."
    }
}
