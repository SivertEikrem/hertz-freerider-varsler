"""
Hertz Freerider-bot: hovedskript.

Kjøres periodisk via GitHub Actions. Hver kjøring:
 1. Behandler eventuelle nye Telegram-kommandoer/knappetrykk (meny/veiviser)
 2. Sjekker Freerider sitt API for nye biler som matcher lagrede ruter
 3. Sender Telegram-varsel ved nye treff
"""

import bot_menu
import freerider_api
import telegram_api
from state_store import (
    load_config,
    save_config,
    load_seen,
    save_seen,
    load_state,
    save_state,
)


def normalize(value):
    return value.strip().upper() if value else ""


def matches_watch(route, watch):
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
    label = bot_menu.describe_watch(watch)
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


def check_for_matches(config, seen):
    watches = config.get("watches", [])
    if not watches:
        print("Ingen ruter er satt opp - hopper over bilsjekk.")
        return

    notified_ids = set(seen.get("notified_ids", []))
    data = freerider_api.fetch_routes()
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
            telegram_api.send_message(message)
            print(
                f"Sendte varsel om {len(new_matches)} nye tur(er) "
                f"for {bot_menu.describe_watch(watch)}."
            )

    if not any_new:
        print("Ingen nye turer funnet.")

    seen["notified_ids"] = list(notified_ids)


def main():
    config = load_config()
    state = load_state()
    seen = load_seen()

    try:
        had_updates = bot_menu.process_updates(state, config)
        if had_updates:
            print("Behandlet nye Telegram-kommandoer.")
    except Exception as e:  # noqa: BLE001 - vil ikke at dette skal stoppe bilsjekken
        print(f"Advarsel: klarte ikke behandle Telegram-oppdateringer: {e}")

    check_for_matches(config, seen)

    save_config(config)
    save_state(state)
    save_seen(seen)


if __name__ == "__main__":
    main()
