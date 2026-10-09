from typing import Dict, List, Optional
from ..models import FlightNode
from .base import AirportProvider

# Real Airport Database (Indian & International hubs)
REAL_AIRPORT_DATABASE: Dict[str, FlightNode] = {
    "DEL": FlightNode(id="DEL", name="Indira Gandhi Intl Airport", type="airport", latitude=28.5562, longitude=77.1000),
    "BOM": FlightNode(id="BOM", name="Chhatrapati Shivaji Maharaj Intl", type="airport", latitude=19.0896, longitude=72.8656),
    "BLR": FlightNode(id="BLR", name="Kempegowda Intl Airport", type="airport", latitude=13.1986, longitude=77.7066),
    "MAA": FlightNode(id="MAA", name="Chennai Intl Airport", type="airport", latitude=12.9941, longitude=80.1709),
    "HYD": FlightNode(id="HYD", name="Rajiv Gandhi Intl Airport", type="airport", latitude=17.2403, longitude=78.4294),
    "CCU": FlightNode(id="CCU", name="Netaji Subhash Chandra Bose Intl", type="airport", latitude=22.6547, longitude=88.4467),
    "AMD": FlightNode(id="AMD", name="Sardar Vallabhbhai Patel Intl", type="airport", latitude=23.0772, longitude=72.6347),
    "PNQ": FlightNode(id="PNQ", name="Pune Airport", type="airport", latitude=18.5822, longitude=73.9197),
    "DXB": FlightNode(id="DXB", name="Dubai Intl Airport", type="airport", latitude=25.2532, longitude=55.3657),
    "DOH": FlightNode(id="DOH", name="Hamad Intl Airport", type="airport", latitude=25.2731, longitude=51.6081),
    "LHR": FlightNode(id="LHR", name="London Heathrow Airport", type="airport", latitude=51.4700, longitude=-0.4543),
    "JFK": FlightNode(id="JFK", name="John F. Kennedy Intl Airport", type="airport", latitude=40.6413, longitude=-73.7781)
}

class RealAirportDatasetProvider(AirportProvider):
    """
    Provides real-world airport metadata including coordinates, IATA codes, and names.
    """

    def get_all_airports(self) -> List[FlightNode]:
        return list(REAL_AIRPORT_DATABASE.values())

    def get_airport_by_code(self, code: str) -> Optional[FlightNode]:
        return REAL_AIRPORT_DATABASE.get(code.upper())
