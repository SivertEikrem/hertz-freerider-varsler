"""
Hertz Freerider-varsler.

Sjekker https://hertzfreerider.no/api/transport-routes/ for ledige biler som
matcher rutene i config.json (satt via nettsiden i docs/), sender
Telegram-varsel ved nye treff, og lagrer en fersk oversikt over ALLE ledige
biler til docs/live-routes.json (som nettsiden viser).

Kjøres periodisk via GitHub Actions (se .github/workflows/check.yml).
"""

import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import freerider_api
import telegram_api
from state_store import load_config, load_seen, save_seen

OSLO_TZ = ZoneInfo("Europe/Oslo")
DAGLIG_OPPSUMMERING_TIDER = [14, 20]  # klokketimer (norsk lokaltid) for daglig oppsummering

LIVE_ROUTES_PATH = "docs/live-routes.json"


def normalize(value):
    return value.strip().upper() if value else ""


def describe_watch(watch):
    from_label = watch.get("from") or f"alle stasjoner i {watch.get('from_city')}"
    to_label = watch.get("to") or f"alle stasjoner i {watch.get('to_city')}"
    return f"{from_label} \u2192 {to_label}"


def matches_watch(route, watch):
    pickup = route["pickupLocation"]
    ret = route["returnLocation"]

    if "from" in watch:
        if normalize(pickup["name"]) != normalize(watch["from"]):
            return False
    elif "from_city" in watch:
        if freerider_api.canonical_city(pickup["city"]) != normalize(
            watch["from_city"]
        ):
            return False

    if "to" in watch:
        if normalize(ret["name"]) != normalize(watch["to"]):
            return False
    elif "to_city" in watch:
        if freerider_api.canonical_city(ret["city"]) != normalize(watch["to_city"]):
            return False

    return True


NORSKE_MAANEDER = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
]

def format_dato(iso_str):
    """Gjør om '2026-08-24T10:00:00' til '24. aug kl. 10:00'."""
    if not iso_str:
        return "ukjent"
    try:
        dt = datetime.fromisoformat(iso_str)
    except ValueError:
        return iso_str
    return f"{dt.day}. {NORSKE_MAANEDER[dt.month - 1]} kl. {dt.strftime('%H:%M')}"


def format_route_message(watch, matches):
    label = describe_watch(watch)
    lines = [f"\U0001F697 Fant {len(matches)} ny(e) Freerider-tur(er) for {label}:\n"]
    for route in matches:
        pickup_name = route["pickupLocation"]["name"]
        return_name = route["returnLocation"]["name"]
        lines.append(
            f"\u2022 {pickup_name} \u2192 {return_name}\n"
            f"  Bil: {route.get('carModel', 'Ukjent bilmodell')}\n"
            f"  Tilbudet utl\u00f8per: {format_dato(route.get('expireTime'))}\n"
            f"  Tilgjengelig fra: {format_dato(route.get('availableAt'))}"
        )
    return "\n\n".join(lines)


def format_dato_kort(iso_str):
    """Gjør om '2026-08-25T10:00:00' til '25. aug' (uten klokkeslett)."""
    if not iso_str:
        return "ukjent"
    try:
        dt = datetime.fromisoformat(iso_str)
    except ValueError:
        return iso_str
    return f"{dt.day}. {NORSKE_MAANEDER[dt.month - 1]}"


def build_daily_summary(config, all_routes):
    watches = config.get("watches", [])
    if not watches:
        return None

    now_oslo = datetime.now(OSLO_TZ)
    sections = [f"\U0001F4CB Daglig oversikt - {format_dato_kort(now_oslo.isoformat())}\n"]

    for watch in watches:
        label = describe_watch(watch)
        matches = [r for r in all_routes if matches_watch(r, watch)]
        if not matches:
            sections.append(f"{label}\nIngen ledige biler akkurat n\u00e5.")
            continue
        lines = [f"{label} ({len(matches)} stk):"]
        for route in matches:
            lines.append(
                f"  \u2022 {route['pickupLocation']['name']} \u2192 {route['returnLocation']['name']}\n"
                f"    {route.get('carModel', 'Ukjent bilmodell')}, book innen "
                f"{format_dato(route.get('expireTime'))}"
            )
        sections.append("\n".join(lines))

    return "\n\n".join(sections)


def maybe_send_daily_summary(config, seen, all_routes):
    now_oslo = datetime.now(OSLO_TZ)

    if now_oslo.hour not in DAGLIG_OPPSUMMERING_TIDER:
        return

    today_str = now_oslo.date().isoformat()
    slot_key = f"{today_str}T{now_oslo.hour:02d}"
    sent_slots = seen.get("summary_sent_slots", [])

    if slot_key in sent_slots:
        return  # allerede sendt for denne timen i dag

    summary = build_daily_summary(config, all_routes)
    if summary:
        telegram_api.send_message(summary)
        print(f"Sendte daglig oppsummering (kl. {now_oslo.hour}).")

    # Behold kun dagens tidspunkter, så listen ikke vokser i det uendelige
    sent_slots = [s for s in sent_slots if s.startswith(today_str)]
    sent_slots.append(slot_key)
    seen["summary_sent_slots"] = sent_slots


def notify_matches(config, seen, all_routes):
    watches = config.get("watches", [])
    if not watches:
        print("Ingen ruter er satt opp i config.json - ingenting å sjekke.")
        return

    notified_ids = set(seen.get("notified_ids", []))

    any_new = False
    for watch in watches:
        new_matches = []
        for route in all_routes:
            if not matches_watch(route, watch):
                continue
            route_id = route["id"]
            if route_id in notified_ids:
                continue
            new_matches.append(route)
            notified_ids.add(route_id)

        if new_matches:
            any_new = True
            message = format_route_message(watch, new_matches)
            telegram_api.send_message(message)
            print(
                f"Sendte varsel om {len(new_matches)} nye tur(er) "
                f"for {describe_watch(watch)}."
            )

    if not any_new:
        print("Ingen nye turer funnet.")

    seen["notified_ids"] = list(notified_ids)


def write_live_routes(all_routes):
    """Lagrer en kompakt oversikt over alle ledige biler, til bruk på nettsiden."""
    compact = []
    for route in all_routes:
        compact.append(
            {
                "from": route["pickupLocation"]["name"],
                "from_city": route["pickupLocation"]["city"],
                "to": route["returnLocation"]["name"],
                "to_city": route["returnLocation"]["city"],
                "car_model": route.get("carModel", "Ukjent bilmodell"),
                "available_at": route.get("availableAt"),
                "latest_return": route.get("latestReturn"),
                "expire_time": route.get("expireTime"),
            }
        )
    compact.sort(key=lambda r: r["available_at"] or "")

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "routes": compact,
    }
    with open(LIVE_ROUTES_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Lagret {len(compact)} ledige biler til {LIVE_ROUTES_PATH}.")


def main():
    config = load_config()
    seen = load_seen()

    data = freerider_api.fetch_routes()
    all_routes = [route for group in data for route in group.get("routes", [])]

    notify_matches(config, seen, all_routes)
    maybe_send_daily_summary(config, seen, all_routes)
    write_live_routes(all_routes)

    save_seen(seen)


if __name__ == "__main__":
    main()
