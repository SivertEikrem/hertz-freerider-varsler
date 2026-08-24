"""
Hjelpefunksjoner for å hente data fra hertzfreerider.no sitt (offentlige) API.
"""

import requests

LOCATIONS_URL = "https://hertzfreerider.no/api/locations/"
TRANSPORT_ROUTES_URL = "https://hertzfreerider.no/api/transport-routes/?country=NORWAY"


def fetch_locations():
    """Henter alle stasjoner (Norge + Sverige)."""
    resp = requests.get(LOCATIONS_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_norwegian_stations():
    """Henter norske stasjoner, sortert alfabetisk på navn."""
    locations = fetch_locations()
    stations = [loc for loc in locations if loc.get("country") == "no"]
    return sorted(stations, key=lambda s: s["name"])


def fetch_norwegian_cities():
    """Henter unike norske byer (fra stasjonslisten), sortert alfabetisk."""
    stations = fetch_norwegian_stations()
    cities = sorted({s["city"] for s in stations if s.get("city")})
    return cities


def fetch_routes():
    """Henter alle tilgjengelige transportruter (Norge)."""
    resp = requests.get(TRANSPORT_ROUTES_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()
