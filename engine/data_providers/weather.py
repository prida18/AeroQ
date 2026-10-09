import requests
import time
from typing import Tuple, Dict, Any
from .base import WeatherProvider

WMO_WEATHER_MAP = {
    0: ("Clear Sky", "☀️"),
    1: ("Mainly Clear", "🌤️"),
    2: ("Partly Cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Foggy", "🌫️"),
    48: ("Depositing Rime Fog", "🌫️"),
    51: ("Light Drizzle", "🌦️"),
    53: ("Moderate Drizzle", "🌦️"),
    55: ("Dense Drizzle", "🌧️"),
    61: ("Slight Rain", "🌧️"),
    63: ("Moderate Rain", "🌧️"),
    65: ("Heavy Rain", "🌧️"),
    71: ("Slight Snow", "🌨️"),
    73: ("Moderate Snow", "❄️"),
    75: ("Heavy Snow", "❄️"),
    80: ("Slight Rain Showers", "🌦️"),
    81: ("Moderate Rain Showers", "🌧️"),
    82: ("Violent Rain Showers", "⛈️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm with Slight Hail", "⛈️"),
    99: ("Thunderstorm with Heavy Hail", "⛈️"),
}

class OpenMeteoWeatherProvider(WeatherProvider):
    """
    Live Weather & Wind Provider using Open-Meteo API (Free, no API key required).
    Falls back gracefully to simulated weather parameters if network is offline or throttled.
    """

    def __init__(self, timeout_sec: float = 3.5):
        self.timeout_sec = timeout_sec
        self.api_url = "https://api.open-meteo.com/v1/forecast"
        self._cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._cache_ttl = 120  # 2 minutes cache

    def get_live_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Fetches detailed live meteorological conditions for coordinates.
        Returns temperature, wind speed/direction, weather condition label, and icon.
        """
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
        now = time.time()
        if cache_key in self._cache:
            cached_time, cached_data = self._cache[cache_key]
            if now - cached_time < self._cache_ttl:
                return cached_data

        try:
            params = {
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "current_weather": True
            }
            resp = requests.get(self.api_url, params=params, timeout=self.timeout_sec)
            if resp.status_code == 200:
                cw = resp.json().get("current_weather", {})
                wind_speed_kmh = round(float(cw.get("windspeed", 12.0)), 1)
                wind_dir = round(float(cw.get("winddirection", 0.0)), 1)
                weather_code = int(cw.get("weathercode", 0))
                temp_c = round(float(cw.get("temperature", 24.0)), 1)

                penalty = min(10.0, max(1.0, round(wind_speed_kmh / 5.5, 1)))
                condition_label, icon = WMO_WEATHER_MAP.get(weather_code, ("Fair Sky", "☀️"))

                result = {
                    "source": "Open-Meteo Live API",
                    "is_live": True,
                    "temperature_c": temp_c,
                    "wind_speed_kmh": wind_speed_kmh,
                    "wind_direction_deg": wind_dir,
                    "weather_code": weather_code,
                    "condition": condition_label,
                    "icon": icon,
                    "penalty": penalty
                }
                self._cache[cache_key] = (now, result)
                return result
        except Exception:
            pass

        # Realistic simulated fallback
        pseudo_temp = round(22.0 + (lat % 8) * 1.5, 1)
        pseudo_wind = round(10.0 + (lon % 7) * 2.2, 1)
        sim_result = {
            "source": "Simulation Fallback",
            "is_live": False,
            "temperature_c": pseudo_temp,
            "wind_speed_kmh": pseudo_wind,
            "wind_direction_deg": round((lat * 15 + lon * 7) % 360, 1),
            "weather_code": 1,
            "condition": "Mainly Clear",
            "icon": "🌤️",
            "penalty": min(6.0, round(pseudo_wind / 6.0, 1))
        }
        self._cache[cache_key] = (now, sim_result)
        return sim_result

    def get_weather_penalty(self, lat: float, lon: float) -> Tuple[float, Dict[str, Any]]:
        """
        Fetches live wind speed and weather metrics for coordinates and converts them
        into a weather penalty score between 0.0 (calm) and 10.0 (severe storm/headwind).
        """
        wx = self.get_live_weather(lat, lon)
        return wx["penalty"], wx

