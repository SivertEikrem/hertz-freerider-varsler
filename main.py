"""
Hertz Freerider-varsler.

Sjekker https://hertzfreerider.no/api/transport-routes/ for ledige biler som
matcher rutene i config.json (satt via nettsiden i docs/), og sender
Telegram-varsel ved nye treff.

Kjøres periodisk via GitHub Actions (se .github/workflows/check.yml).
"""

import freerider_api
import telegram_api
from state_store import load_config, load_seen, save_seen


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
    config = load_config()
    seen = load_seen()

    watches = config.get("watches", [])
    if not watches:
        print("Ingen ruter er satt opp i config.json - ingenting å sjekke.")
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
                f"for {describe_watch(watch)}."
            )

    if not any_new:
        print("Ingen nye turer funnet.")

    seen["notified_ids"] = list(notified_ids)
    save_seen(seen)


if __name__ == "__main__":
    main()
