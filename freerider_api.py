"""
Hjelpefunksjoner for å hente data fra hertzfreerider.no sitt (offentlige) API.
"""

import requests

LOCATIONS_URL = "https://hertzfreerider.no/api/locations/"
TRANSPORT_ROUTES_URL = "https://hertzfreerider.no/api/transport-routes/?country=NORWAY"

# Noen flyplasser/stasjoner er registrert hos Hertz med det lille stedet de
# fysisk ligger i, ikke byen folk faktisk mener når de sier f.eks. "Oslo".
# Denne tabellen normaliserer slike tilfeller til den byen de i praksis hører
# til, slik at "by"-basert overvåking (from_city/to_city) fungerer intuitivt.
# (SANDNESSNJØEN -> SANDNESSJØEN retter i tillegg en skrivefeil i Hertz sine
# egne data, der samme by er stavet forskjellig på to forskjellige stasjoner.)
CITY_ALIASES = {
    "GARDERMOEN": "OSLO",  # Oslo Lufthavn
    "BLOMSTERDALEN": "BERGEN",  # Bergen Lufthavn
    "KOKSTAD": "BERGEN",  # Bergen Kokstad
    "STJØRDAL": "TRONDHEIM",  # Trondheim Lufthavn (Værnes)
    "SOLA": "STAVANGER",  # Stavanger Sola
    "KJEVIK": "KRISTIANSAND",  # Kristiansand Lufthavn
    "VIGRA": "ÅLESUND",  # Ålesund Lufthavn
    "LIERSTRANDA": "DRAMMEN",
    "AVALDSNES": "HAUGESUND",  # Haugesund Lufthavn
    "BYGSTAD": "FØRDE",  # Førde Lufthavn
    "HESSENG": "KIRKENES",  # Kirkenes Lufthavn/Sentrum
    "SKONSENG": "MO I RANA",  # Mo i Rana Lufthavn
    "SANDNESSNJØEN": "SANDNESSJØEN",  # Skrivefeil i kildedata
}


def canonical_city(city):
    """Returnerer den 'egentlige' byen en stasjon hører til, om den finnes
    i alias-tabellen - ellers uendret."""
    if not city:
        return city
    return CITY_ALIASES.get(city.strip().upper(), city.strip().upper())


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
    """Henter unike norske byer (fra stasjonslisten, med aliaser normalisert), sortert alfabetisk."""
    stations = fetch_norwegian_stations()
    cities = sorted({canonical_city(s["city"]) for s in stations if s.get("city")})
    return cities


def fetch_routes():
    """Henter alle tilgjengelige transportruter (Norge)."""
    resp = requests.get(TRANSPORT_ROUTES_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()
