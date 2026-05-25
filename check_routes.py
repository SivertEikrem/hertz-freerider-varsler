"""
Hertz Freerider ruteovervåker.

Sjekker Hertz Freerider for tilgjengelige turer på definerte ruter,
og sender Telegram-varsel ved nye treff. Sender også en
"jeg lever"-melding hver 3. time så du vet systemet kjører.

Kjøres automatisk via GitHub Actions.
"""

import os
import sys
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
import requests

# ============================================================
# KONFIGURASJON — endre her hvis du vil overvåke flere ruter
# ============================================================
ROUTES = [
    {"from": "Trondheim", "to": "Ålesund"},
    # Skru på når du er klar for å overvåke flere ruter — bare fjern '#':
    # {"from": "Ålesund", "to": "*"},   # "*" = hvor som helst
    # {"from": "*", "to": "Trondheim"}, # alle turer TIL Trondheim
    # {"from": "Oslo", "to": "Bergen"},
]

HEARTBEAT_INTERVAL_HOURS = 3  # Hvor ofte du får "jeg lever"-melding

API_URL = "https://hertzfreerider.no/api/transport-routes/?country=NORWAY"
STATE_FILE = Path("seen_trips.json")
HEARTBEAT_FILE = Path("heartbeat.json")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.0 Safari/605.1.15"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "nb-NO,nb;q=0.9",
    "Referer": "https://hertzfreerider.no/no-no/",
}


# ============================================================
# Henting og parsing
# ============================================================
def fetch_route_groups():
    """Hent alle rute-grupper fra Hertz Freerider API."""
    r = requests.get(API_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError(
            f"Forventet liste fra API, fikk {type(data).__name__}: "
            f"{str(data)[:200]}"
        )
    return data


def matches_route(group, route):
    """Sjekk om en rute-gruppe matcher en konfigurert rute."""
    origin = (group.get("pickupLocationName") or "").lower()
    dest = (group.get("returnLocationName") or "").lower()

    def matches(query, text):
        q = query.lower().strip()
        # "*" eller tom streng = matcher hva som helst
        if q in ("", "*"):
            return True
        if q in text:
            return True
        # Ålesund kan også skrives Aalesund
        if "ålesund" in q and "aalesund" in text:
            return True
        if "aalesund" in q and "ålesund" in text:
            return True
        return False

    return matches(route["from"], origin) and matches(route["to"], dest)


def trip_id(group, trip):
    """Stabil ID per tur — bruker transportOfferId hvis tilgjengelig."""
    for key in ("transportOfferId", "id"):
        if trip.get(key):
            return f"tid:{trip[key]}"
    parts = [
        str(group.get("pickupLocationName") or ""),
        str(group.get("returnLocationName") or ""),
        str(trip.get("pickupDate") or trip.get("availableFrom") or ""),
        str(trip.get("vehicleModel") or trip.get("vehicle") or ""),
    ]
    return "hash:" + hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


# ============================================================
# Telegram-varsling
# ============================================================
def format_trip(group, trip):
    """Formater en Telegram-melding for en tur."""
    origin = group.get("pickupLocationName", "?")
    dest = group.get("returnLocationName", "?")

    pickup_date = (trip.get("pickupDate") or trip.get("availableFrom")
                   or trip.get("validFrom") or trip.get("startDate"))
    expiry_date = (trip.get("expirationDate") or trip.get("offerExpiresAt")
                   or trip.get("returnDate") or trip.get("validTo")
                   or trip.get("endDate"))
    vehicle = (trip.get("vehicleModel") or trip.get("vehicle")
               or trip.get("carModel"))
    distance = trip.get("maxDistance") or trip.get("distance")

    lines = ["🚗 *Ny Freerider-tur!*", ""]

    # Utløpsdato øverst — det mest tidskritiske
    if expiry_date:
        lines.append(f"⏰ Tilbud utløper: *{expiry_date}*")
        lines.append("")

    # Fra og til
    lines.append(f"📍 Fra: *{origin}*")
    lines.append(f"📍 Til: *{dest}*")

    # Klokkeslett for henting etter lokasjoner
    if pickup_date:
        lines.append(f"🕐 Hentes: {pickup_date}")

    if vehicle:
        lines.append(f"🚙 Bil: {vehicle}")
    if distance:
        lines.append(f"📏 Maks: {distance} km")
    lines.append("")
    lines.append("👉 Book på hertzfreerider.no")
    return "\n".join(lines)


def format_trip_summary(group, trip, index):
    """Kompakt énlinje-oppsummering til heartbeat-listen."""
    expiry = (trip.get("expirationDate") or trip.get("offerExpiresAt")
              or trip.get("returnDate") or trip.get("validTo") or trip.get("endDate"))
    pickup = (trip.get("pickupDate") or trip.get("availableFrom")
              or trip.get("validFrom") or trip.get("startDate"))
    vehicle = (trip.get("vehicleModel") or trip.get("vehicle")
               or trip.get("carModel") or "?")

    parts = []
    if expiry:
        parts.append(f"Utløper: {expiry}")
    if pickup:
        parts.append(f"Hentes: {pickup}")
    parts.append(vehicle)
    return f"  {index}. {' | '.join(parts)}"


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
# Tilstand
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


def load_last_heartbeat():
    if HEARTBEAT_FILE.exists():
        try:
            data = json.loads(HEARTBEAT_FILE.read_text(encoding="utf-8"))
            return datetime.fromisoformat(data["last"])
        except Exception:
            return None
    return None


def save_heartbeat(now):
    HEARTBEAT_FILE.write_text(
        json.dumps({"last": now.isoformat()}, indent=2),
        encoding="utf-8",
    )


def maybe_send_heartbeat(total_trips, route_stats):
    """Send en 'jeg lever'-melding hvis det er minst N timer siden forrige.
    route_stats: liste av (route_name, [(group, trip), ...])
    """
    last = load_last_heartbeat()
    now = datetime.now(timezone.utc)

    if last is not None:
        hours_since = (now - last).total_seconds() / 3600
        if hours_since < HEARTBEAT_INTERVAL_HOURS:
            print(f"Heartbeat sendt for {hours_since:.1f} timer siden — venter.")
            return

    available = [(name, trips) for name, trips in route_stats if trips]
    empty = [(name, trips) for name, trips in route_stats if not trips]

    lines = []
    if available:
        total_avail = sum(len(trips) for _, trips in available)
        lines.append(f"🎯 *{total_avail} tur(er) tilgjengelig akkurat nå:*")
        lines.append("")
        for name, trips in available:
            lines.append(f"✅ *{name}* ({len(trips)} stk)")
            for i, (group, trip) in enumerate(trips, start=1):
                lines.append(format_trip_summary(group, trip, i))
        if empty:
            lines.append("")
            for name, _ in empty:
                lines.append(f"🚫 {name}: ingen tilgjengelig")
        lines.append("")
        lines.append("_(Statusoppdatering — varsleren lever)_")
    else:
        lines.append("💓 *Varsleren lever*")
        lines.append("")
        for name, _ in route_stats:
            lines.append(f"🚫 {name}: ingen tilgjengelig nå")

    if send_telegram("\n".join(lines)):
        save_heartbeat(now)
        print("Heartbeat sendt.")


# ============================================================
# Hovedflyt
# ============================================================
def main():
    print(f"Sjekker Hertz Freerider for {len(ROUTES)} rute(r)...")
    for route in ROUTES:
        print(f"  • {route['from']} → {route['to']}")

    groups = fetch_route_groups()
    total_trips = sum(len(g.get("routes", [])) for g in groups)
    print(f"Hentet {len(groups)} rute-grupper, totalt {total_trips} turer")

    seen = load_seen()
    nye = 0
    route_stats = []  # liste av (route_name, [(group, trip), ...])

    for route in ROUTES:
        matching_groups = [g for g in groups if matches_route(g, route)]
        n_trips = sum(len(g.get("routes", [])) for g in matching_groups)
        route_name = f"{route['from']} → {route['to']}"
        print(f"  {route_name}: {len(matching_groups)} grupper / {n_trips} turer")

        # Samle alle (group, trip)-par for heartbeat-listen
        all_trips = [
            (group, trip)
            for group in matching_groups
            for trip in group.get("routes", [])
        ]
        route_stats.append((route_name, all_trips))

        for group, trip in all_trips:
            tid = trip_id(group, trip)
            if tid in seen:
                continue
            msg = format_trip(group, trip)
            if send_telegram(msg):
                nye += 1
                seen.add(tid)
                print(f"    ✓ Varslet om {tid}")

    save_seen(seen)
    maybe_send_heartbeat(total_trips, route_stats)
    print(f"Ferdig. Sendte {nye} nye trip-varsel.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        err_msg = f"⚠️ Hertz Freerider-varsleren feilet:\n\n`{e}`"
        try:
            send_telegram(err_msg)
        except Exception:
            pass
        print(f"FEIL: {e}", file=sys.stderr)
        sys.exit(1)
