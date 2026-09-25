"""
Hertz Freerider-varsler (flerbruker).

Sjekker https://hertzfreerider.no/api/transport-routes/ for ledige biler,
henter ALLE brukeres overvåkede ruter fra Supabase, og sender Telegram-varsel
til hver enkelt bruker sin egen chat når en av deres ruter får treff.
Lagrer i tillegg en offentlig, anonym oversikt over ALLE ledige biler til
docs/live-routes.json (uendret fra tidligere - nettsiden viser den samme
filen både på forsiden for innloggede brukere og på den offentlige
oversiktssiden).

Kjøres periodisk via GitHub Actions (se .github/workflows/check.yml).
Kontoer og ruter administreres nå via nettsiden (Supabase), ikke lenger
via config.json i repoet.
"""

import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import freerider_api
import supabase_client
import telegram_api

OSLO_TZ = ZoneInfo("Europe/Oslo")
DAGLIG_OPPSUMMERING_TIDER = [14, 20]  # klokketimer (norsk lokaltid) for daglig oppsummering

LIVE_ROUTES_PATH = "docs/live-routes.json"


def normalize(value):
    return value.strip().upper() if value else ""


def describe_watch(watch):
    from_label = watch.get("from_station") or f"alle stasjoner i {watch.get('from_city')}"
    to_label = watch.get("to_station") or f"alle stasjoner i {watch.get('to_city')}"
    return f"{from_label} \u2192 {to_label}"


def matches_watch(route, watch):
    pickup = route["pickupLocation"]
    ret = route["returnLocation"]

    if watch.get("from_station"):
        if normalize(pickup["name"]) != normalize(watch["from_station"]):
            return False
    elif watch.get("from_city"):
        if freerider_api.canonical_city(pickup["city"]) != normalize(watch["from_city"]):
            return False

    if watch.get("to_station"):
        if normalize(ret["name"]) != normalize(watch["to_station"]):
            return False
    elif watch.get("to_city"):
        if freerider_api.canonical_city(ret["city"]) != normalize(watch["to_city"]):
            return False

    return True


NORSKE_UKEDAGER = ["man", "tir", "ons", "tor", "fre", "l\u00f8r", "s\u00f8n"]
NORSKE_MAANEDER = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"]


def format_dato(iso_str):
    if not iso_str:
        return "ukjent"
    try:
        dt = datetime.fromisoformat(iso_str)
    except ValueError:
        return iso_str
    return f"{NORSKE_UKEDAGER[dt.weekday()]} {dt.day}. {NORSKE_MAANEDER[dt.month - 1]} kl. {dt.strftime('%H:%M')}"


def format_dato_kort(iso_str):
    if not iso_str:
        return "ukjent"
    try:
        dt = datetime.fromisoformat(iso_str)
    except ValueError:
        return iso_str
    return f"{NORSKE_UKEDAGER[dt.weekday()]} {dt.day}. {NORSKE_MAANEDER[dt.month - 1]}"


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


def build_daily_summary(watches, all_routes):
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


def load_users():
    """Henter ruter gruppert per bruker, og hvilke brukere som har en
    aktiv Telegram-tilkobling. Returnerer (routes_by_user, chat_id_by_user)."""
    routes = supabase_client.select("routes", {"select": "*"})
    telegram_rows = supabase_client.select(
        "telegram_links", {"select": "user_id,chat_id", "chat_id": "not.is.null"}
    )
    chat_id_by_user = {row["user_id"]: row["chat_id"] for row in telegram_rows}

    routes_by_user = {}
    for route in routes:
        routes_by_user.setdefault(route["user_id"], []).append(route)

    return routes_by_user, chat_id_by_user


def load_already_notified():
    """Én oppslagstabell {user_id: set(route_id)} for allerede varslede treff,
    hentet i ett kall i stedet for ett per bruker."""
    rows = supabase_client.select("notifications_sent", {"select": "user_id,route_id"})
    result = {}
    for row in rows:
        result.setdefault(row["user_id"], set()).add(row["route_id"])
    return result


def notify_matches(routes_by_user, chat_id_by_user, all_routes):
    already_notified = load_already_notified()
    any_new = False

    for user_id, watches in routes_by_user.items():
        chat_id = chat_id_by_user.get(user_id)
        if not chat_id:
            continue  # brukeren har ikke koblet til Telegram ennå

        try:
            notified_ids = already_notified.get(user_id, set())
            newly_notified_rows = []

            for watch in watches:
                new_matches = []
                for route in all_routes:
                    if not matches_watch(route, watch):
                        continue
                    route_id = str(route["id"])
                    if route_id in notified_ids:
                        continue
                    new_matches.append(route)
                    notified_ids.add(route_id)
                    newly_notified_rows.append({"user_id": user_id, "route_id": route_id})

                if new_matches:
                    any_new = True
                    message = format_route_message(watch, new_matches)
                    telegram_api.send_message(chat_id, message)
                    print(f"Sendte varsel til {user_id} om {len(new_matches)} tur(er) for {describe_watch(watch)}.")

            if newly_notified_rows:
                supabase_client.insert("notifications_sent", newly_notified_rows)
        except Exception as exc:
            # Én brukers feil (f.eks. blokkert bot, forbigående nettverksfeil)
            # skal ikke stoppe varsling for alle de andre brukerne, eller
            # hindre at live-routes.json blir oppdatert etterpå.
            print(f"Klarte ikke å varsle bruker {user_id}: {exc}")

    if not any_new:
        print("Ingen nye turer funnet for noen bruker.")


def maybe_send_daily_summaries(routes_by_user, chat_id_by_user, all_routes):
    now_oslo = datetime.now(OSLO_TZ)
    if now_oslo.hour not in DAGLIG_OPPSUMMERING_TIDER:
        return

    slot_key = f"{now_oslo.date().isoformat()}T{now_oslo.hour:02d}"
    already_sent_rows = supabase_client.select(
        "daily_summary_sent", {"select": "user_id", "slot_key": f"eq.{slot_key}"}
    )
    already_sent = {row["user_id"] for row in already_sent_rows}

    for user_id, watches in routes_by_user.items():
        if user_id in already_sent:
            continue
        chat_id = chat_id_by_user.get(user_id)
        if not chat_id:
            continue

        try:
            summary = build_daily_summary(watches, all_routes)
            if summary:
                telegram_api.send_message(chat_id, summary)
                supabase_client.insert("daily_summary_sent", [{"user_id": user_id, "slot_key": slot_key}])
                print(f"Sendte daglig oppsummering til {user_id} (kl. {now_oslo.hour}).")
        except Exception as exc:
            print(f"Klarte ikke å sende daglig oppsummering til {user_id}: {exc}")


def write_live_routes(all_routes):
    """Lagrer en kompakt, offentlig oversikt over alle ledige biler."""
    compact = []
    for route in all_routes:
        compact.append(
            {
                "from": route["pickupLocation"]["name"],
                "from_city": freerider_api.canonical_city(route["pickupLocation"]["city"]),
                "to": route["returnLocation"]["name"],
                "to_city": freerider_api.canonical_city(route["returnLocation"]["city"]),
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
    data = freerider_api.fetch_routes()
    all_routes = [route for group in data for route in group.get("routes", [])]

    routes_by_user, chat_id_by_user = load_users()

    notify_matches(routes_by_user, chat_id_by_user, all_routes)
    maybe_send_daily_summaries(routes_by_user, chat_id_by_user, all_routes)
    write_live_routes(all_routes)


if __name__ == "__main__":
    main()
