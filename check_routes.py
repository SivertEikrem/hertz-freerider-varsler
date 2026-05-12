"""
Hertz Freerider ruteovervåker.

Sjekker Hertz Freerider for tilgjengelige turer på definerte ruter,
og sender Telegram-varsel ved nye treff.

Kjøres automatisk via GitHub Actions.
"""

import os
import sys
import json
import hashlib
from pathlib import Path
import requests

# ============================================================
# KONFIGURASJON — endre her hvis du vil overvåke flere ruter
# ============================================================
ROUTES = [
    {"from": "Trondheim", "to": "Ålesund"},
    # Fjern '#' under for å også overvåke returen:
    # {"from": "Ålesund", "to": "Trondheim"},
]

STATE_FILE = Path("seen_trips.json")

# Endepunkter vi prøver i rekkefølge. Den norske Freerider-siden er ny
# (Gatsby/React) og den eksakte API-URL-en kan endre seg. Hvis ingen
# av disse fungerer: åpne hertzfreerider.no i Chrome, trykk F12 →
# fanen "Network" → søk etter en tur → se hvilken URL som returnerer
# JSON med turene. Lim inn øverst i denne lista.
ENDPOINTS_TO_TRY = [
    "https://www.hertzfreerider.no/api/trips",
    "https://www.hertzfreerider.no/api/transport-offers",
    "https://www.hertzfreerider.no/api/transports",
    "https://hertzfreerider.no/api/trips",
    "https://hertzfreerider.no/unauth/list_transport_offer.aspx",
    "https://www.hertzfreerider.se/unauth/list_transport_offer.aspx",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/xml, text/html, */*",
    "Accept-Language": "nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7",
}


# ============================================================
# Henting og parsing
# ============================================================
def fetch_trips():
    """Forsøk å hente turlista fra et av kjente endepunkter."""
    last_error = None
    for url in ENDPOINTS_TO_TRY:
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code != 200:
                last_error = f"{url} → HTTP {r.status_code}"
                continue

            content_type = r.headers.get("Content-Type", "")
            try:
                data = r.json()
                print(f"✓ Hentet JSON fra {url}", file=sys.stderr)
                return data, url
            except ValueError:
                # Ikke JSON — kan være XML/HTML, hopp videre
                last_error = f"{url} → ikke JSON ({content_type[:40]})"
                continue
        except requests.RequestException as e:
            last_error = f"{url} → {e}"
            continue

    raise RuntimeError(
        "Klarte ikke å finne et fungerende Hertz Freerider-endepunkt.\n"
        f"Siste feil: {last_error}\n\n"
        "Åpne hertzfreerider.no i Chrome, trykk F12, gå til Network-fanen, "
        "og finn URL-en som returnerer turene. Legg den øverst i "
        "ENDPOINTS_TO_TRY i check_routes.py."
    )


def extract_trip_list(data):
    """Trekk ut selve lista med turer fra et JSON-svar med ukjent struktur."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("trips", "offers", "transports", "transportOffers",
                    "items", "data", "results"):
            value = data.get(key)
            if isinstance(value, list):
                return value
        # Noen API-er legger lista en nivå dypere
        for value in data.values():
            if isinstance(value, dict):
                result = extract_trip_list(value)
                if result:
                    return result
    return []


def get_field(trip, *candidates):
    """Hent første feltet som finnes blant flere kandidater."""
    for key in candidates:
        if key in trip and trip[key] not in (None, ""):
            return trip[key]
        # Sjekk nestede objekter
        for outer_key in ("pickup", "dropoff", "from", "to", "origin", "destination"):
            outer = trip.get(outer_key)
            if isinstance(outer, dict) and key in outer and outer[key]:
                return outer[key]
    return None


def location_strings(trip):
    """Returner (fra-streng, til-streng) som strings i lowercase."""
    origin = get_field(
        trip,
        "from", "fromCity", "from_city", "origin", "originCity",
        "pickupCity", "pickup_city", "pickupLocation", "pickup_location",
        "startCity", "start_city", "fromStation",
    )
    dest = get_field(
        trip,
        "to", "toCity", "to_city", "destination", "destinationCity",
        "dropoffCity", "dropoff_city", "dropoffLocation", "dropoff_location",
        "endCity", "end_city", "toStation",
    )

    # Hvis fra/til selv er dict (f.eks. {"city": "Trondheim"})
    def stringify(val):
        if isinstance(val, dict):
            for k in ("city", "name", "location", "station"):
                if k in val:
                    return str(val[k])
            return json.dumps(val, ensure_ascii=False)
        return str(val) if val is not None else ""

    return stringify(origin).lower(), stringify(dest).lower()


def matches_route(trip, route):
    """Sjekk om en tur matcher en konfigurert rute."""
    origin, dest = location_strings(trip)
    from_match = route["from"].lower() in origin
    to_match = route["to"].lower() in dest

    # Spesialtilfelle: Ålesund vs Aalesund
    if not from_match and "ålesund" in route["from"].lower():
        from_match = "aalesund" in origin
    if not to_match and "ålesund" in route["to"].lower():
        to_match = "aalesund" in dest

    return from_match and to_match


def trip_id(trip):
    """Lag en stabil ID for en tur, slik at vi ikke varsler to ganger."""
    for key in ("id", "tripId", "trip_id", "offerId", "offer_id", "uuid", "guid"):
        if key in trip and trip[key]:
            return f"id:{trip[key]}"
    # Fallback: hash de viktigste feltene
    parts = [
        str(get_field(trip, "from", "fromCity", "pickupCity") or ""),
        str(get_field(trip, "to", "toCity", "dropoffCity") or ""),
        str(get_field(trip, "pickupDate", "pickup_date", "startDate", "fromDate") or ""),
        str(get_field(trip, "returnDate", "return_date", "endDate", "toDate") or ""),
        str(get_field(trip, "vehicle", "carModel", "car") or ""),
    ]
    return "hash:" + hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


# ============================================================
# Tilstand (hvilke turer vi allerede har varslet om)
# ============================================================
def load_seen():
    if STATE_FILE.exists():
        try:
            return set(json.loads(STATE_FILE.read_text(encoding="utf-8")))
        except Exception:
            return set()
    return set()


def save_seen(seen):
    STATE_FILE.write_text(
        json.dumps(sorted(seen), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


# ============================================================
# Telegram-varsling
# ============================================================
def format_trip(trip, route):
    origin = get_field(trip, "from", "fromCity", "pickupCity") or route["from"]
    dest = get_field(trip, "to", "toCity", "dropoffCity") or route["to"]
    pickup = get_field(trip, "pickupDate", "pickup_date", "startDate", "fromDate")
    dropoff = get_field(trip, "returnDate", "return_date", "endDate", "toDate")
    vehicle = get_field(trip, "vehicle", "carModel", "car", "vehicleType")

    lines = [
        "🚗 *Ny Freerider-tur!*",
        "",
        f"📍 Fra: *{origin}*",
        f"📍 Til: *{dest}*",
    ]
    if pickup:
        lines.append(f"📅 Hentes: {pickup}")
    if dropoff:
        lines.append(f"📅 Leveres: {dropoff}")
    if vehicle:
        lines.append(f"🚙 Bil: {vehicle}")
    lines.append("")
    lines.append("👉 Book på hertzfreerider.no")
    return "\n".join(lines)


def send_telegram(message):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("⚠️  Mangler TELEGRAM_BOT_TOKEN eller TELEGRAM_CHAT_ID — kan ikke sende.",
              file=sys.stderr)
        return False

    r = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        },
        timeout=15,
    )
    if r.status_code != 200:
        print(f"Telegram-feil: {r.status_code} {r.text}", file=sys.stderr)
        return False
    return True


# ============================================================
# Hovedflyt
# ============================================================
def main():
    print(f"Sjekker Hertz Freerider for {len(ROUTES)} rute(r)...")
    for route in ROUTES:
        print(f"  • {route['from']} → {route['to']}")

    data, source_url = fetch_trips()
    trips = extract_trip_list(data)
    print(f"Fant totalt {len(trips)} turer på siden ({source_url})")

    seen = load_seen()
    nye = 0

    for route in ROUTES:
        matches = [t for t in trips if matches_route(t, route)]
        print(f"  {route['from']} → {route['to']}: {len(matches)} treff")

        for trip in matches:
            tid = trip_id(trip)
            if tid in seen:
                continue
            msg = format_trip(trip, route)
            if send_telegram(msg):
                nye += 1
                seen.add(tid)
                print(f"    ✓ Varslet om {tid}")

    save_seen(seen)
    print(f"Ferdig. Sendte {nye} nye varsel.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Send feil til Telegram så du ikke går glipp av at noe er galt
        err_msg = f"⚠️ Hertz Freerider-varsleren feilet:\n\n`{e}`"
        try:
            send_telegram(err_msg)
        except Exception:
            pass
        print(f"FEIL: {e}", file=sys.stderr)
        sys.exit(1)
