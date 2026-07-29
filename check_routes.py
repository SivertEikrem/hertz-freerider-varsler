"""
Returbil-varsler: Hertz Freerider + Hjemferd.no + Leiebilretur.no

Sjekker flere tjenester for tilgjengelige returbil-turer,
og sender Telegram-varsel når nye turer dukker opp på rutene dine.

Kjøres automatisk via GitHub Actions.
"""

import os
import sys
import json
import hashlib
from pathlib import Path
from datetime import datetime
import requests

# ============================================================
# KONFIGURASJON
# ============================================================
ROUTES = [
    {"from": "Ålesund", "to": "Trondheim", "label": "🏠 Til Trondheim"},
    {"from": "Ålesund", "to": "*",         "label": "🗺️ Andre fra Ålesund"},
]

# Skru av/på kilder her (True = aktiv, False = ignorer)
SOURCES = {
    "hertz":         True,
    "hjemferd":      True,
    "leiebilretur":  True,
}

STATE_FILE    = Path("seen_trips.json")

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
    debug_printed = False
    for group in groups:
        from_loc = group.get("pickupLocationName") or ""
        to_loc   = group.get("returnLocationName") or ""
        for raw in group.get("routes", []):
            if not debug_printed:
                print(f"  [DEBUG] Hertz raw felter: {sorted(raw.keys())}", file=sys.stderr)
                print(f"  [DEBUG] Hertz raw eksempel: {json.dumps(raw, ensure_ascii=False)[:1000]}", file=sys.stderr)
                debug_printed = True

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
    """Hent og normaliser turer fra Hjemferd.no (HTML-scraping).

    Hjemferd bruker Bootstrap-kort med klassene .portfolio-item.
    Hvert kort inneholder:
      .order-header  → rutenavn (f.eks. "Ålesund - Kristiansund")
      .strdate       → Ledig Fra-dato
      .row.order-text (andre) → Må hentes før-dato
      .fa-user       → antall seter
      .fa-dashboard  → drivstoff inkludert/ikke
      .fa-exclamation → bom/ferge inkludert/ikke
    """
    from bs4 import BeautifulSoup

    r = requests.get(HJEMFERD_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    items = soup.select(".portfolio-item")
    print(f"  Hjemferd: fant {len(items)} listinger", file=sys.stderr)

    trips = []
    for item in items:
        # ---- Rutenavn ----
        header = item.select_one(".order-header")
        if not header:
            continue
        route_name = header.get_text(strip=True)
        parts    = [p.strip() for p in route_name.split(" - ") if p.strip()]
        from_loc = parts[0] if parts else route_name
        to_loc   = parts[-1] if len(parts) > 1 else ""

        # ---- Ledig fra ----
        strdate = item.select_one(".strdate")
        available_from = (
            " ".join(strdate.get_text(strip=True).split())
            if strdate else None
        )

        # ---- Må hentes før (leter etter riktig etikett, ikke posisjon) ----
        order_rows = item.select(".row.order-text")
        deadline = None
        for row in order_rows:
            label_elem = row.select_one(".col-xs-6:not(.text-right)")
            value_elem = row.select_one(".col-xs-6.text-right")
            if not label_elem or not value_elem:
                continue
            label_text = label_elem.get_text(strip=True).lower()
            if "hentes" in label_text or "frist" in label_text or "utløp" in label_text:
                deadline = value_elem.get_text(strip=True)
                break

        # ---- Drivstoff ----
        fuel_elem = item.select_one(".fa-dashboard")
        fuel_text = " ".join(fuel_elem.get_text(strip=True).lower().split()) if fuel_elem else ""
        if "ikke" in fuel_text:
            fuel_included = False
        elif "inkludert" in fuel_text:
            fuel_included = True
        else:
            fuel_included = None

        # ---- Bom/ferge ----
        exc_elem = item.select_one(".fa-exclamation")
        exc_text = " ".join(exc_elem.get_text(strip=True).lower().split()) if exc_elem else ""
        if "ikke" in exc_text:
            extra_included = False
        elif "inkludert" in exc_text:
            extra_included = True
        else:
            extra_included = None

        # ---- Seter ----
        seats_elem = item.select_one(".fa-user")
        seats_txt  = seats_elem.get_text(strip=True) if seats_elem else ""
        seats = int(seats_txt) if seats_txt.isdigit() else None

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
# KILDE 3: LEIEBILRETUR.NO
# ============================================================
LEIEBILRETUR_URL = "https://www.leiebilretur.no/headless/jobs/"

def fetch_leiebilretur():
    """Hent og normaliser turer fra Leiebilretur.no (JSON API)."""
    r = requests.get(LEIEBILRETUR_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    jobs = r.json()
    if not isinstance(jobs, list):
        raise RuntimeError(f"Leiebilretur: forventet liste, fikk {type(jobs).__name__}")

    trips = []
    for job in jobs:
        from_loc = (job.get("pickupFrom") or {}).get("name") or ""
        to_loc   = (job.get("deliverTo")  or {}).get("name") or ""

        # Dato: "2026-07-20T16:00:00" → "20.07.2026 16:00"
        raw_date = job.get("availableForPickup") or ""
        try:
            dt = datetime.fromisoformat(raw_date)
            available_from = dt.strftime("%d.%m.%Y %H:%M")
        except Exception:
            available_from = raw_date[:16].replace("T", " ") if raw_date else None

        admin_fee   = job.get("adminFee", 0) or 0
        no_show_fee = job.get("feeForNoShow", 0) or 0
        extra_info  = job.get("extraInfo") or ""

        trips.append({
            "source":   "Leiebilretur",
            "id":       f"leiebilretur:{job['id']}",
            "from_loc": from_loc,
            "to_loc":   to_loc,
            "available_from": available_from,
            "deadline": None,
            "vehicle":  None,
            "fuel_included":        job.get("freeFuel"),
            "extra_costs_included": job.get("freeAdditionalCosts"),
            "seats":    job.get("seats"),
            "booking_url": "https://www.leiebilretur.no",
            # Leiebilretur-spesifikke felt
            "admin_fee":   admin_fee,
            "no_show_fee": no_show_fee,
            "extra_info":  extra_info,
        })
    return trips
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
def safe_md(text):
    """Escaper tegn som kan ødelegge Telegram Markdown."""
    return str(text).replace("*", "alle").replace("_", "\\_").replace("`", "\\`")

SOURCE_EMOJI = {"Hertz": "🔵", "Hjemferd": "🟢", "Leiebilretur": "🟠"}

def format_trip(trip, total_available):
    """Fullstendig Telegram-melding for én ny tur."""
    source = trip["source"]
    lines  = [f"🚗 *{source.upper()}*", ""]

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
    if trip["fuel_included"] is not None:
        lines.append(f"⛽ Drivstoff: {'inkludert' if trip['fuel_included'] else 'ikke inkludert'}")
    if trip["extra_costs_included"] is not None:
        lines.append(f"🛣️ Bom/ferge: {'inkludert' if trip['extra_costs_included'] else 'ikke inkludert'}")

    # Leiebilretur-spesifikke felt
    admin_fee = trip.get("admin_fee", 0) or 0
    if admin_fee > 0:
        lines.append(f"💰 Formidlingsgebyr: {admin_fee} kr")
    no_show = trip.get("no_show_fee", 0) or 0
    if no_show > 0:
        lines.append(f"⚠️ No-show gebyr: {no_show} kr")
    extra = trip.get("extra_info", "") or ""
    if extra:
        lines.append(f"ℹ️ Info: {extra}")

    lines.append("")
    lines.append(f"📊 Tilgjengelig totalt akkurat nå: *{total_available}* tur(er) på dine ruter")
    lines.append("")
    lines.append(f"👉 Book på {trip['booking_url']}")
    return "\n".join(lines)


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

    if SOURCES.get("leiebilretur"):
        try:
            lr_trips = fetch_leiebilretur()
            print(f"Leiebilretur: hentet {len(lr_trips)} turer")
            all_trips.extend(lr_trips)
        except Exception as e:
            print(f"Leiebilretur FEIL: {e}", file=sys.stderr)
            send_telegram(f"⚠️ Leiebilretur-henting feilet:\n`{e}`")

    # --- Match og varsle ---
    seen = load_seen()
    nye  = 0
    route_stats = []

    # Unike turer (uansett hvilken rute de matcher) - brukes til "totalt tilgjengelig"
    unique_matching = {}

    for route in ROUTES:
        route_name = route.get("label") or f"{route['from']} → {safe_md(route['to'])}"
        matching   = [t for t in all_trips if trip_matches_route(t, route)]
        print(f"  {route_name}: {len(matching)} treff "
              f"({sum(1 for t in matching if t['source']=='Hertz')} Hertz, "
              f"{sum(1 for t in matching if t['source']=='Hjemferd')} Hjemferd)")
        route_stats.append((route_name, matching))
        for t in matching:
            unique_matching[t["id"]] = t

    total_available = len(unique_matching)

    for route_name, matching in route_stats:
        for trip in matching:
            if trip["id"] in seen:
                continue
            msg = format_trip(trip, total_available)
            if send_telegram(msg):
                nye += 1
                seen.add(trip["id"])
                print(f"    ✓ Varslet om {trip['id']}")

    save_seen(seen)
    print(f"Ferdig. Sendte {nye} nye varsel. Totalt tilgjengelig nå: {total_available}.")


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
