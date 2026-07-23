"""
Returbil-varsler: Hertz Freerider + Hjemferd.no

Sjekker flere tjenester for tilgjengelige returbil-turer,
og sender Telegram-varsel ved nye treff. Sender også en
"jeg lever"-melding med statusoversikt hver 3. time.

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
# KONFIGURASJON
# ============================================================
ROUTES = [
    {"from": "Ålesund", "to": "*"},   # Alle turer fra Ålesund
    # Skru på igjen når du er tilbake i Trondheim:
    # {"from": "Trondheim", "to": "Ålesund"},
]

# Skru av/på kilder her (True = aktiv, False = ignorer)
SOURCES = {
    "hertz":    True,
    "hjemferd": True,
}

HEARTBEAT_INTERVAL_HOURS = 3

STATE_FILE    = Path("seen_trips.json")
HEARTBEAT_FILE = Path("heartbeat.json")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.0 Safari/605.1.15"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
    "Accept-Language": "nb-NO,nb;q=0.9",
}


# ============================================================
# FELLES DATAMODELL
# Alle kilder konverterer til denne strukturen:
# {
#   "source":       "Hertz" | "Hjemferd",
#   "id":           "hertz:22222" | "hjemferd:abc123",
#   "from_loc":     "ÅLESUND LUFTHAVN VIGRA",
#   "to_loc":       "TRONDHEIM",
#   "available_from": "2026-05-15 14:00" | None,
#   "deadline":     "2026-05-13 17:05"  | None,
#   "vehicle":      "VW ID.7"           | None,
#   "fuel_included":        True/False/None,
#   "extra_costs_included": True/False/None,
#   "seats":        2 | None,
#   "booking_url":  "https://...",
# }
# ============================================================


# ============================================================
# KILDE 1: HERTZ FREERIDER
# ============================================================
HERTZ_URL = "https://hertzfreerider.no/api/transport-routes/?country=NORWAY"

def fetch_hertz():
    """Hent og normaliser turer fra Hertz Freerider."""
    r = requests.get(
        HERTZ_URL,
        headers={**HEADERS, "Referer": "https://hertzfreerider.no/no-no/"},
        timeout=20,
    )
    r.raise_for_status()
    groups = r.json()
    if not isinstance(groups, list):
        raise RuntimeError(f"Hertz: forventet liste, fikk {type(groups).__name__}")

    trips = []
    for group in groups:
        from_loc = group.get("pickupLocationName") or ""
        to_loc   = group.get("returnLocationName") or ""
        for raw in group.get("routes", []):
            tid = None
            for key in ("transportOfferId", "id"):
                if raw.get(key):
                    tid = f"hertz:{raw[key]}"
                    break
            if not tid:
                parts = [from_loc, to_loc,
                         str(raw.get("availableFrom") or raw.get("pickupDate") or ""),
                         str(raw.get("vehicleModel") or "")]
                tid = "hertz:" + hashlib.sha1("|".join(parts).encode()).hexdigest()[:16]

            trips.append({
                "source": "Hertz",
                "id":     tid,
                "from_loc": from_loc,
                "to_loc":   to_loc,
                "available_from": (raw.get("availableFrom") or raw.get("pickupDate")
                                   or raw.get("validFrom") or raw.get("startDate")),
                "deadline": (raw.get("expirationDate") or raw.get("offerExpiresAt")
                             or raw.get("returnDate") or raw.get("validTo")
                             or raw.get("endDate")),
                "vehicle":  (raw.get("vehicleModel") or raw.get("vehicle")
                             or raw.get("carModel")),
                "fuel_included":        None,
                "extra_costs_included": None,
                "seats":       None,
                "booking_url": "https://hertzfreerider.no",
            })
    return trips


# ============================================================
# KILDE 2: HJEMFERD.NO
# ============================================================
HJEMFERD_URL = "https://www.hjemferd.no/index.php?page=order"

def fetch_hjemferd():
    """Hent og normaliser turer fra Hjemferd.no (HTML-scraping)."""
    from bs4 import BeautifulSoup

    r = requests.get(HJEMFERD_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    trips = []

    # Hjemferd sin side er en klassisk Bootstrap/PHP-side.
    # Listingene er strukturert slik at rute-navnet kommer rett
    # før en <hr>-tag, og detaljene med "Ledig Fra" / "Må hentes før"
    # følger etter.
    #
    # Vi finner alle <strong>-tagger med "Ledig Fra" og navigerer
    # derfra til resten av listingen.

    def txt(elem):
        return elem.get_text(separator=" ", strip=True) if elem else ""

    def find_value_after(label_elem):
        """Finn tekstverdien som følger etter et <strong>-element."""
        node = label_elem.next_sibling
        while node:
            t = node.get_text(strip=True) if hasattr(node, "get_text") else str(node).strip()
            if t:
                return t
            node = node.next_sibling
        return None

    # Finn alle <strong>-elementer med teksten "Ledig Fra"
    ledig_fra_tags = [
        s for s in soup.find_all("strong")
        if "ledig fra" in s.get_text(strip=True).lower()
    ]

    print(f"  Hjemferd: fant {len(ledig_fra_tags)} listinger", file=sys.stderr)

    for lf_tag in ledig_fra_tags:
        # Gå oppover i DOM for å finne en beholder
        container = lf_tag.find_parent(["div", "section", "article", "li", "td"])
        if not container:
            container = lf_tag.parent

        # ---- Rutenavn ----
        # Rutenavnet er enten i en heading inni containeren,
        # eller i forrige søsken-element til containeren.
        route_name = None
        for htag in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            h = container.find(htag)
            if h:
                route_name = h.get_text(strip=True)
                break
        if not route_name:
            # Prøv forrige søsken
            prev = container.find_previous_sibling()
            while prev and not route_name:
                t = txt(prev)
                if " - " in t and len(t) < 100:
                    route_name = t
                    break
                prev = prev.find_previous_sibling()
        if not route_name:
            # Se etter tekst med " - " i containeren
            for elem in container.find_all(string=True):
                t = elem.strip()
                if " - " in t and 5 < len(t) < 100:
                    route_name = t
                    break

        if not route_name or " - " not in route_name:
            print(f"  Hjemferd: hopper over listing uten rutenavn", file=sys.stderr)
            continue

        # Del rutenavn på " - " og ta første som fra, siste som til
        parts = [p.strip() for p in route_name.split(" - ") if p.strip()]
        from_loc = parts[0] if parts else route_name
        to_loc   = parts[-1] if len(parts) > 1 else ""

        # ---- Datoer ----
        available_from = find_value_after(lf_tag)

        mhf_tag = None
        for s in container.find_all("strong"):
            if "hentes før" in s.get_text(strip=True).lower():
                mhf_tag = s
                break
        deadline = find_value_after(mhf_tag) if mhf_tag else None

        # ---- Drivstoff og kostnader ----
        full_text = container.get_text(separator=" ", strip=True).lower()
        fuel_included  = None
        extra_included = None

        if "inkludert" in full_text:
            # Se etter «Inkludert Drivstoff» vs «Ikke inkludert Drivstoff»
            if "ikke inkludert drivstoff" in full_text or "ikke inkludert.*drivstoff" in full_text:
                fuel_included = False
            elif "inkludert drivstoff" in full_text:
                fuel_included = True

            if "ikke inkludert andre" in full_text:
                extra_included = False
            elif "inkludert andre" in full_text:
                extra_included = True

        # ---- Seter ----
        seats = None
        import re
        seat_match = re.search(r"(\d+)\s*antall seter", full_text)
        if seat_match:
            seats = int(seat_match.group(1))

        # ---- ID ----
        id_parts = [from_loc, to_loc, str(available_from or ""), str(deadline or "")]
        tid = "hjemferd:" + hashlib.sha1("|".join(id_parts).encode()).hexdigest()[:16]

        trips.append({
            "source":   "Hjemferd",
            "id":       tid,
            "from_loc": from_loc,
            "to_loc":   to_loc,
            "available_from": available_from,
            "deadline": deadline,
            "vehicle":  None,
            "fuel_included":        fuel_included,
            "extra_costs_included": extra_included,
            "seats":    seats,
            "booking_url": HJEMFERD_URL,
        })

    return trips


# ============================================================
# RUTE-MATCHING
# ============================================================
def location_matches(query, text):
    """Sjekk om en lokasjon-query matcher en tekst."""
    q = query.lower().strip()
    if q in ("", "*"):
        return True
    t = text.lower()
    if q in t:
        return True
    # Ålesund/Aalesund-variant
    if "ålesund" in q and "aalesund" in t:
        return True
    if "aalesund" in q and "ålesund" in t:
        return True
    return False


def trip_matches_route(trip, route):
    return (location_matches(route["from"], trip["from_loc"])
            and location_matches(route["to"],   trip["to_loc"]))


# ============================================================
# TELEGRAM
# ============================================================
SOURCE_EMOJI = {"Hertz": "🔵", "Hjemferd": "🟢"}

def format_trip(trip):
    """Fullstendig Telegram-melding for én ny tur."""
    emoji  = SOURCE_EMOJI.get(trip["source"], "🚗")
    source = trip["source"]
    lines  = [f"🚗 *Ny returbil — {source}!*", ""]

    if trip["deadline"]:
        lines.append(f"⏰ Tilbud utløper: *{trip['deadline']}*")
        lines.append("")

    lines.append(f"📍 Fra: *{trip['from_loc']}*")
    lines.append(f"📍 Til: *{trip['to_loc']}*")

    if trip["available_from"]:
        lines.append(f"🕐 Hentes: {trip['available_from']}")
    if trip["vehicle"]:
        lines.append(f"🚙 Bil: {trip['vehicle']}")
    if trip["seats"]:
        lines.append(f"💺 Seter: {trip['seats']}")

    # Drivstoff og kostnader (kun vis hvis vi vet det)
    if trip["fuel_included"] is not None:
        lines.append(f"⛽ Drivstoff: {'inkludert' if trip['fuel_included'] else 'ikke inkludert'}")
    if trip["extra_costs_included"] is not None:
        lines.append(f"🛣️ Bom/ferge: {'inkludert' if trip['extra_costs_included'] else 'ikke inkludert'}")

    lines.append("")
    lines.append(f"👉 Book på {trip['booking_url']}")
    return "\n".join(lines)


def format_trip_summary(trip, index):
    """Kompakt énlinje-oppsummering til heartbeat-meldingen."""
    emoji  = SOURCE_EMOJI.get(trip["source"], "🚗")
    parts  = [f"{emoji} [{trip['source']}]"]
    if trip["deadline"]:
        parts.append(f"Utløper: {trip['deadline']}")
    if trip["available_from"]:
        parts.append(f"Hentes: {trip['available_from']}")
    if trip["vehicle"]:
        parts.append(trip["vehicle"])
    if trip["fuel_included"] is not None:
        parts.append("⛽inkl." if trip["fuel_included"] else "⛽ikke inkl.")
    return f"  {index}. {' | '.join(parts)}"


def send_telegram(message):
    token   = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("⚠️  Mangler TELEGRAM_BOT_TOKEN eller TELEGRAM_CHAT_ID", file=sys.stderr)
        return False
    r = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={
            "chat_id":    chat_id,
            "text":       message,
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
# TILSTAND
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


# ============================================================
# HEARTBEAT
# ============================================================
def maybe_send_heartbeat(route_stats):
    """Send 'jeg lever'-melding hvis det er ≥ N timer siden forrige.
    route_stats: liste av (route_name, [trip, ...])
    """
    last = load_last_heartbeat()
    now  = datetime.now(timezone.utc)

    if last is not None:
        hours_since = (now - last).total_seconds() / 3600
        if hours_since < HEARTBEAT_INTERVAL_HOURS:
            print(f"Heartbeat sendt for {hours_since:.1f}t siden — venter.")
            return

    available = [(name, trips) for name, trips in route_stats if trips]
    empty     = [(name, trips) for name, trips in route_stats if not trips]

    lines = []
    if available:
        total = sum(len(t) for _, t in available)
        lines.append(f"🎯 *{total} tur(er) tilgjengelig akkurat nå:*")
        lines.append("")
        for name, trips in available:
            lines.append(f"✅ *{name}* ({len(trips)} stk)")
            for i, trip in enumerate(trips, start=1):
                lines.append(format_trip_summary(trip, i))
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
# HOVEDFLYT
# ============================================================
def main():
    active_sources = [name for name, on in SOURCES.items() if on]
    print(f"Sjekker {len(ROUTES)} rute(r) fra {len(active_sources)} kilde(r): "
          f"{', '.join(active_sources)}")
    for route in ROUTES:
        print(f"  • {route['from']} → {route['to']}")

    # --- Hent fra alle aktive kilder ---
    all_trips = []
    if SOURCES.get("hertz"):
        try:
            hertz_trips = fetch_hertz()
            print(f"Hertz: hentet {len(hertz_trips)} turer")
            all_trips.extend(hertz_trips)
        except Exception as e:
            print(f"Hertz FEIL: {e}", file=sys.stderr)
            send_telegram(f"⚠️ Hertz-henting feilet:\n`{e}`")

    if SOURCES.get("hjemferd"):
        try:
            hj_trips = fetch_hjemferd()
            print(f"Hjemferd: hentet {len(hj_trips)} turer")
            all_trips.extend(hj_trips)
        except Exception as e:
            print(f"Hjemferd FEIL: {e}", file=sys.stderr)
            send_telegram(f"⚠️ Hjemferd-henting feilet:\n`{e}`")

    # --- Match og varsle ---
    seen = load_seen()
    nye  = 0
    route_stats = []

    for route in ROUTES:
        route_name    = f"{route['from']} → {route['to']}"
        matching      = [t for t in all_trips if trip_matches_route(t, route)]
        print(f"  {route_name}: {len(matching)} treff "
              f"({sum(1 for t in matching if t['source']=='Hertz')} Hertz, "
              f"{sum(1 for t in matching if t['source']=='Hjemferd')} Hjemferd)")
        route_stats.append((route_name, matching))

        for trip in matching:
            if trip["id"] in seen:
                continue
            msg = format_trip(trip)
            if send_telegram(msg):
                nye += 1
                seen.add(trip["id"])
                print(f"    ✓ Varslet om {trip['id']}")

    save_seen(seen)
    maybe_send_heartbeat(route_stats)
    print(f"Ferdig. Sendte {nye} nye varsel.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        try:
            send_telegram(f"⚠️ Varsleren krasjet:\n`{e}`")
        except Exception:
            pass
        print(f"FEIL: {e}", file=sys.stderr)
        sys.exit(1)
