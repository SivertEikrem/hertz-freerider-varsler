"""
Kobler brukerkontoer til Telegram-chatter.

Når en bruker trykker "Koble til Telegram" på nettsiden, opprettes en
midlertidig `link_code` i tabellen `telegram_links` (Supabase), og
brukeren sendes til `t.me/<bot>?start=<link_code>`. Telegram sender da
en melding "/start <link_code>" til boten - denne meldingen er det
eneste som forteller oss hvilken Telegram-chat som tilhører hvilken
bruker, så vi må lese den via getUpdates.

Kjøres som en EGEN, hyppigere GitHub Action enn hovedsjekken
(f.eks. hvert 2. minutt) - se .github/workflows/telegram-link.yml -
siden noen som sitter og venter på at tilkoblingen skal fullføres ikke
bør måtte vente opptil 15 minutter.

Offset for getUpdates lagres i Supabase (`bot_state`) fordi GitHub
Actions-kjøringer er statsløse mellom hver gang.
"""

import supabase_client
import telegram_api

BOT_STATE_OFFSET_KEY = "telegram_update_offset"


def main():
    offset_raw = supabase_client.get_bot_state(BOT_STATE_OFFSET_KEY)
    offset = int(offset_raw) + 1 if offset_raw else None

    updates = telegram_api.get_updates(offset=offset)
    if not updates:
        print("Ingen nye Telegram-meldinger.")
        return

    highest_update_id = offset - 1 if offset else 0

    for update in updates:
        highest_update_id = max(highest_update_id, update["update_id"])
        try:
            message = update.get("message") or {}
            text = (message.get("text") or "").strip()
            chat_id = message.get("chat", {}).get("id")

            if not text.startswith("/start ") or chat_id is None:
                continue

            link_code = text.removeprefix("/start ").strip()
            if not link_code:
                continue

            matches = supabase_client.select(
                "telegram_links",
                {"select": "user_id", "link_code": f"eq.{link_code}", "chat_id": "is.null"},
            )
            if not matches:
                telegram_api.send_message(
                    chat_id,
                    "Denne koblingslenken er ugyldig eller allerede brukt. "
                    "Prøv å trykke \u00abKoble til Telegram\u00bb p\u00e5 nytt fra nettsiden.",
                )
                continue

            user_id = matches[0]["user_id"]
            supabase_client.update(
                "telegram_links",
                {"user_id": f"eq.{user_id}"},
                {"chat_id": chat_id, "link_code": None, "linked_at": "now()"},
            )
            telegram_api.send_message(
                chat_id,
                "\u2705 Kontoen din er n\u00e5 koblet til! Du f\u00e5r beskjed her s\u00e5 snart en av "
                "rutene dine dukker opp.",
            )
            print(f"Koblet chat_id {chat_id} til bruker {user_id}.")
        except Exception as exc:
            # Ikke la én mislykket melding hindre resten av batchen i å bli
            # behandlet, eller hindre at offset lagres nedenfor (uten det
            # ville denne meldingen blitt forsøkt på nytt neste kjøring).
            print(f"Klarte ikke å behandle update {update.get('update_id')}: {exc}")

    supabase_client.set_bot_state(BOT_STATE_OFFSET_KEY, highest_update_id)


if __name__ == "__main__":
    main()
