"""
Hertz Freerider-varsler.

Sjekker https://hertzfreerider.no/api/transport-routes/ for ledige biler
som matcher ruten i config.json, og sender Telegram-varsel ved nye treff.

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
        data={
            "chat_id": chat_id,
            "text": text,
        },
        timeout=15,
    )
    resp.raise_for_status()


def fetch_routes():
    """Henter alle tilgjengelige transportruter fra Freerider sitt API."""
    resp = requests.get(TRANSPORT_ROUTES_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def format_route_message(config, matches):
    """Bygger en lesbar Telegram-melding for en liste med nye treff."""
    lines = [
        f"🚗 Fant {len(matches)} ny(e) Freerider-tur(er) "
        f"fra {config['from']} til {config['to']}:\n"
    ]
    for route in matches:
        lines.append(
            f"• {route.get('carModel', 'Ukjent bilmodell')}\n"
            f"  Tilgjengelig fra: {route.get('availableAt')}\n"
            f"  Senest levert: {route.get('latestReturn')}"
        )
    return "\n\n".join(lines)


def main():
    config = load_json(CONFIG_PATH, None)
    if config is None:
        print("Fant ingen config.json - avbryter.")
        sys.exit(1)

    wanted_from = config["from"].strip().upper()
    wanted_to = config["to"].strip().upper()

    seen = load_json(SEEN_PATH, {"notified_ids": []})
    notified_ids = set(seen.get("notified_ids", []))

    data = fetch_routes()

    new_matches = []
    for group in data:
        pickup_name = group.get("pickupLocationName", "").strip().upper()
        return_name = group.get("returnLocationName", "").strip().upper()

        if pickup_name != wanted_from or return_name != wanted_to:
            continue

        for route in group.get("routes", []):
            route_id = route["id"]
            if route_id in notified_ids:
                continue
            new_matches.append(route)
            notified_ids.add(route_id)

    if new_matches:
        message = format_route_message(config, new_matches)
        send_telegram_message(message)
        print(f"Sendte varsel om {len(new_matches)} nye tur(er).")
    else:
        print("Ingen nye turer funnet.")

    seen["notified_ids"] = list(notified_ids)
    save_json(SEEN_PATH, seen)


if __name__ == "__main__":
    main()
