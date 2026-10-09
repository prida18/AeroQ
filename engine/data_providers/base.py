from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple
from ..models import FlightNode

class AirportProvider(ABC):
    """Abstract interface for fetching airport metadata."""

    @abstractmethod
    def get_all_airports(self) -> List[FlightNode]:
        pass

    @abstractmethod
    def get_airport_by_code(self, code: str) -> Optional[FlightNode]:
        pass

class WeatherProvider(ABC):
    """Abstract interface for fetching real-time weather and wind data."""

    @abstractmethod
    def get_weather_penalty(self, lat: float, lon: float) -> Tuple[float, Dict[str, Any]]:
        pass

class AircraftTrackingProvider(ABC):
    """Abstract interface for fetching live airspace congestion and flight positions."""

    @abstractmethod
    def get_congestion_penalty(self, lat: float, lon: float, radius_km: float = 100.0) -> Tuple[float, Dict[str, Any]]:
        pass
