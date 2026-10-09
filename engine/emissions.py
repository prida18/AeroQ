from typing import Dict, Tuple
from .models import AircraftProfile

# Configurable expanded aircraft database (Simulated values)
AIRCRAFT_DATABASE: Dict[str, AircraftProfile] = {
    "A320": AircraftProfile(
        model_name="Airbus A320ceo",
        description="Standard narrow-body twin airliner",
        fuel_burn_rate_l_per_km=4.0,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=840.0
    ),
    "A320NEO": AircraftProfile(
        model_name="Airbus A320neo",
        description="Next-gen efficient narrow-body airliner (-15% fuel burn)",
        fuel_burn_rate_l_per_km=3.4,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=845.0
    ),
    "B737": AircraftProfile(
        model_name="Boeing 737-800",
        description="Narrow-body short-to-medium range airliner",
        fuel_burn_rate_l_per_km=4.2,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=830.0
    ),
    "B737MAX": AircraftProfile(
        model_name="Boeing 737 MAX 8",
        description="Modern narrow-body airliner (-14% fuel burn)",
        fuel_burn_rate_l_per_km=3.6,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=839.0
    ),
    "A350": AircraftProfile(
        model_name="Airbus A350-900",
        description="Long-range wide-body airliner",
        fuel_burn_rate_l_per_km=6.8,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=903.0
    ),
    "B787": AircraftProfile(
        model_name="Boeing 787-9 Dreamliner",
        description="Composite long-range wide-body airliner",
        fuel_burn_rate_l_per_km=6.1,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=903.0
    ),
    "B777": AircraftProfile(
        model_name="Boeing 777-300ER",
        description="High-capacity long-range twin-aisle airliner",
        fuel_burn_rate_l_per_km=8.9,
        emission_factor_kg_per_l=2.52,
        cruise_speed_kmh=892.0
    )
}

class EmissionsCalculator:
    """
    Simulation module for estimated aircraft fuel consumption and CO2 emissions.
    
    IMPORTANT: All outputs are simulated estimates based on simplified drag/burn models
    and weather adjustments, not certified aviation performance benchmarks.
    """

    @classmethod
    def get_aircraft_profile(cls, model_key: str | AircraftProfile = "A320") -> AircraftProfile:
        """Retrieves an aircraft profile by key or returns object if already profile."""
        if isinstance(model_key, AircraftProfile):
            return model_key
        
        key_str = str(model_key).upper().replace(" ", "").replace("-", "")
        if "777" in key_str:
            return AIRCRAFT_DATABASE["B777"]
        if "787" in key_str:
            return AIRCRAFT_DATABASE["B787"]
        if "350" in key_str:
            return AIRCRAFT_DATABASE["A350"]
        if "MAX" in key_str:
            return AIRCRAFT_DATABASE["B737MAX"]
        if "737" in key_str:
            return AIRCRAFT_DATABASE["B737"]
        if "NEO" in key_str:
            return AIRCRAFT_DATABASE["A320NEO"]
        if "320" in key_str:
            return AIRCRAFT_DATABASE["A320"]

        return AIRCRAFT_DATABASE.get(key_str, AIRCRAFT_DATABASE["A320"])

    @classmethod
    def calculate_segment_emissions(
        cls,
        distance_km: float,
        weather_penalty: float = 0.0,
        aircraft: str | AircraftProfile = "A320"
    ) -> Tuple[float, float]:
        """
        Calculates estimated fuel consumption (Liters) and CO2 emissions (kg) for a flight segment.

        Formula:
          weather_adjustment = 1.0 + (weather_penalty * 0.02)
          estimated_fuel = distance_km * fuel_burn_rate * weather_adjustment
          estimated_co2 = estimated_fuel * emission_factor

        Returns:
          Tuple (estimated_fuel_liters, estimated_co2_kg)
        """
        profile = cls.get_aircraft_profile(aircraft)

        # Weather / headwind penalty increases fuel consumption slightly
        weather_adjustment = 1.0 + (max(0.0, weather_penalty) * 0.02)
        
        fuel_liters = distance_km * profile.fuel_burn_rate_l_per_km * weather_adjustment
        co2_kg = fuel_liters * profile.emission_factor_kg_per_l

        return round(fuel_liters, 2), round(co2_kg, 2)
