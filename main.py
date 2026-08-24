"""
Hertz Freerider-varsler.

Sjekker https://hertzfreerider.no/api/transport-routes/ for ledige biler
som matcher en eller flere ruter i config.json, og sender Telegram-varsel
ved nye treff.

Hver rute i "watches" kan matches på enten eksakt stasjon eller hele byen:
  {"from": "TRONDHEIM SLUPPEN", "to": "OSLO SENTRALSTASJON"}   -> eksakte stasjoner
  {"from": "TRONDHEIM SLUPPEN", "to_city": "ÅLESUND"}          -> hvilken som helst
                                                                   stasjon i Ålesund

Bruk enten "from"/"to" (eksakt stasjonsnavn) ELLER "from_city"/"to_city"
(hele byen) per side av ruten - ikke begge samtidig.

Kjøres periodisk via GitHub Actions (se .github/workflows/check.yml).
"""

import json
import os
import sys

import requests

CONFIG_PATH = "config.json"
SEEN_PATH = "seen.json"

TRANSPORT_ROUTES_URL = "https://hertzfreerider.no/api/transport-routes/?country=NORWAY"


def load_json(path, default):
    """Laster JSON fra fil, eller returnerer default hvis filen ikke finnes."""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data):
    """Lagrer data som JSON til fil."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def send_telegram_message(text):
    """Sender en tekstmelding til brukeren via Telegram-boten."""
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    resp = requests.post(
        url,
        data={"chat_id": chat_id, "text": text},
        timeout=15,
    )
    resp.raise_for_status()


def fetch_routes():
    """Henter alle tilgjengelige transportruter fra Freerider sitt API."""
    resp = requests.get(TRANSPORT_ROUTES_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def normalize(value):
    """Gjør en tekststreng klar for sammenligning (trim + store bokstaver)."""
    return value.strip().upper() if value else ""


def describe_watch(watch):
    """Lager en lesbar beskrivelse av en overvåket rute, til bruk i meldinger."""
    from_label = watch.get("from") or f"alle stasjoner i {watch.get('from_city')}"
    to_label = watch.get("to") or f"alle stasjoner i {watch.get('to_city')}"
    return f"{from_label} \u2192 {to_label}"


def matches_watch(route, watch):
    """Sjekker om en enkelt tur matcher en gitt overvåket rute."""
    pickup = route["pickupLocation"]
    ret = route["returnLocation"]

    if "from" in watch:
        if normalize(pickup["name"]) != normalize(watch["from"]):
            return False
    elif "from_city" in watch:
        if normalize(pickup["city"]) != normalize(watch["from_city"]):
            return False

    if "to" in watch:
        if normalize(ret["name"]) != normalize(watch["to"]):
            return False
    elif "to_city" in watch:
        if normalize(ret["city"]) != normalize(watch["to_city"]):
            return False

    return True


def format_route_message(watch, matches):
    """Bygger en lesbar Telegram-melding for en liste med nye treff på én rute."""
    label = describe_watch(watch)
    lines = [f"\U0001F697 Fant {len(matches)} ny(e) Freerider-tur(er) for {label}:\n"]
    for route in matches:
        pickup_name = route["pickupLocation"]["name"]
        return_name = route["returnLocation"]["name"]
        lines.append(
            f"\u2022 {pickup_name} \u2192 {return_name}\n"
            f"  Bil: {route.get('carModel', 'Ukjent bilmodell')}\n"
            f"  Tilgjengelig fra: {route.get('availableAt')}\n"
            f"  Senest levert: {route.get('latestReturn')}"
        )
    return "\n\n".join(lines)


def main():
    config = load_json(CONFIG_PATH, None)
    if config is None or "watches" not in config:
        print("Fant ingen gyldig config.json (mangler 'watches') - avbryter.")
        sys.exit(1)

    watches = config["watches"]
    if not watches:
        print("Ingen ruter er satt opp i config.json - ingenting å sjekke.")
        return

    seen = load_json(SEEN_PATH, {"notified_ids": []})
    notified_ids = set(seen.get("notified_ids", []))

    data = fetch_routes()

    # Flat liste over alle enkeltturer, uansett gruppering i API-svaret
    all_routes = [route for group in data for route in group.get("routes", [])]

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
            send_telegram_message(message)
            print(
                f"Sendte varsel om {len(new_matches)} nye tur(er) "
                f"for {describe_watch(watch)}."
            )

    if not any_new:
        print("Ingen nye turer funnet.")

    seen["notified_ids"] = list(notified_ids)
    save_json(SEEN_PATH, seen)


if __name__ == "__main__":
    main()
