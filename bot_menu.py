"""
Meny- og veiviser-logikk for Telegram-boten.

Håndterer Telegram-oppdateringer (meldinger/knappetrykk) én om gangen,
og oppdaterer state.json / config.json underveis.

Veiviseren for å legge til en rute går gjennom disse stegene:
  1. Velg om FRA skal være en bestemt stasjon eller en hel by
  2. Velg forbokstav, deretter stasjon/by fra en (paginert) liste
  3. Gjenta steg 1-2 for TIL
  4. Bekreft, og ruten lagres i config.json
"""

import freerider_api
import telegram_api

NORWEGIAN_LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ")
PAGE_SIZE = 10


def _main_menu_keyboard():
    return telegram_api.inline_keyboard(
        [
            [("📋 Vis ruter", "s")],
            [("➕ Legg til rute", "a")],
            [("➖ Fjern rute", "r")],
        ]
    )


def _send_main_menu(text="Hva vil du gjøre?"):
    telegram_api.send_message(text, reply_markup=_main_menu_keyboard())


def describe_watch(watch):
    """Lager en lesbar beskrivelse av en overvåket rute."""
    from_label = watch.get("from") or f"alle stasjoner i {watch.get('from_city')}"
    to_label = watch.get("to") or f"alle stasjoner i {watch.get('to_city')}"
    return f"{from_label} \u2192 {to_label}"


def _show_watches(config):
    watches = config.get("watches", [])
    if not watches:
        telegram_api.send_message(
            "Du overvåker ingen ruter akkurat nå.", reply_markup=_main_menu_keyboard()
        )
        return
    lines = ["Dine overvåkede ruter:\n"]
    for i, watch in enumerate(watches, start=1):
        lines.append(f"{i}. {describe_watch(watch)}")
    telegram_api.send_message("\n".join(lines), reply_markup=_main_menu_keyboard())


def _show_remove_menu(config):
    watches = config.get("watches", [])
    if not watches:
        telegram_api.send_message(
            "Du har ingen ruter å fjerne.", reply_markup=_main_menu_keyboard()
        )
        return
    rows = [[(f"❌ {describe_watch(w)}", f"rm:{i}")] for i, w in enumerate(watches)]
    rows.append([("⬅️ Tilbake", "m")])
    telegram_api.send_message(
        "Velg rute du vil fjerne:", reply_markup=telegram_api.inline_keyboard(rows)
    )


def _mode_keyboard(callback_prefix):
    return telegram_api.inline_keyboard(
        [
            [("🏠 Bestemt stasjon", f"{callback_prefix}:st")],
            [("🏙️ Hvilken som helst stasjon i en by", f"{callback_prefix}:ci")],
            [("❌ Avbryt", "ca")],
        ]
    )


def _letters_present(items):
    letters = set()
    for item in items:
        if item:
            letters.add(item[0].upper())
    return letters


def _letter_keyboard(callback_prefix, letters_with_items):
    rows, row = [], []
    for letter in NORWEGIAN_LETTERS:
        if letter not in letters_with_items:
            continue
        row.append((letter, f"{callback_prefix}:{letter}"))
        if len(row) == 6:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([("❌ Avbryt", "ca")])
    return telegram_api.inline_keyboard(rows)


def _get_items_for_mode(mode):
    """Returnerer sortert liste med navn - stasjoner eller byer."""
    if mode == "st":
        return [s["name"] for s in freerider_api.fetch_norwegian_stations()]
    return freerider_api.fetch_norwegian_cities()


def _list_keyboard(prefix, letter, items, page):
    """prefix er 'f' (fra) eller 't' (til)."""
    filtered = [
        (i, name) for i, name in enumerate(items) if name.upper().startswith(letter)
    ]
    start = page * PAGE_SIZE
    page_items = filtered[start : start + PAGE_SIZE]

    rows = [[(name, f"{prefix}i:{i}")] for i, name in page_items]

    nav_row = []
    if page > 0:
        nav_row.append(("◀ Forrige", f"{prefix}p:{letter}:{page - 1}"))
    if start + PAGE_SIZE < len(filtered):
        nav_row.append(("Neste ▶", f"{prefix}p:{letter}:{page + 1}"))
    if nav_row:
        rows.append(nav_row)

    rows.append([("❌ Avbryt", "ca")])
    return telegram_api.inline_keyboard(rows)


def _start_wizard(state):
    state["wizard"] = {
        "step": "from_mode",
        "from_mode": None,
        "from_value": None,
        "to_mode": None,
        "to_value": None,
    }


def _build_watch(wizard):
    watch = {}
    if wizard["from_mode"] == "st":
        watch["from"] = wizard["from_value"]
    else:
        watch["from_city"] = wizard["from_value"]
    if wizard["to_mode"] == "st":
        watch["to"] = wizard["to_value"]
    else:
        watch["to_city"] = wizard["to_value"]
    return watch


def _handle_callback(data, state, config):
    wizard = state.get("wizard")

    if data == "m":
        state["wizard"] = None
        _send_main_menu()
        return

    if data == "s":
        _show_watches(config)
        return

    if data == "r":
        _show_remove_menu(config)
        return

    if data.startswith("rm:"):
        idx = int(data.split(":")[1])
        watches = config.get("watches", [])
        if 0 <= idx < len(watches):
            removed = watches.pop(idx)
            telegram_api.send_message(f"Fjernet ruten: {describe_watch(removed)}")
        _send_main_menu()
        return

    if data == "a":
        _start_wizard(state)
        telegram_api.send_message(
            "Skal FRA-siden være en bestemt stasjon, eller hvilken som helst "
            "stasjon i en by?",
            reply_markup=_mode_keyboard("fm"),
        )
        return

    if data == "ca":
        state["wizard"] = None
        _send_main_menu("Avbrutt.")
        return

    # Alt herfra krever en aktiv veiviser
    if wizard is None:
        telegram_api.send_message(
            "Denne sesjonen er ikke lenger aktiv. Trykk /meny for å starte på nytt."
        )
        return

    if data.startswith("fm:"):
        mode = data.split(":")[1]
        wizard["from_mode"] = mode
        items = _get_items_for_mode(mode)
        label = "stasjon" if mode == "st" else "by"
        telegram_api.send_message(
            f"Velg forbokstav for {label} (FRA):",
            reply_markup=_letter_keyboard("fl", _letters_present(items)),
        )
        return

    if data.startswith("fl:"):
        letter = data.split(":")[1]
        items = _get_items_for_mode(wizard["from_mode"])
        telegram_api.send_message(
            "Velg FRA:", reply_markup=_list_keyboard("f", letter, items, 0)
        )
        return

    if data.startswith("fp:"):
        _, letter, page = data.split(":")
        items = _get_items_for_mode(wizard["from_mode"])
        telegram_api.send_message(
            "Velg FRA:", reply_markup=_list_keyboard("f", letter, items, int(page))
        )
        return

    if data.startswith("fi:"):
        idx = int(data.split(":")[1])
        items = _get_items_for_mode(wizard["from_mode"])
        wizard["from_value"] = items[idx]
        telegram_api.send_message(
            f"FRA satt til: {items[idx]}\n\n"
            "Skal TIL-siden være en bestemt stasjon, eller hvilken som helst "
            "stasjon i en by?",
            reply_markup=_mode_keyboard("tm"),
        )
        return

    if data.startswith("tm:"):
        mode = data.split(":")[1]
        wizard["to_mode"] = mode
        items = _get_items_for_mode(mode)
        label = "stasjon" if mode == "st" else "by"
        telegram_api.send_message(
            f"Velg forbokstav for {label} (TIL):",
            reply_markup=_letter_keyboard("tl", _letters_present(items)),
        )
        return

    if data.startswith("tl:"):
        letter = data.split(":")[1]
        items = _get_items_for_mode(wizard["to_mode"])
        telegram_api.send_message(
            "Velg TIL:", reply_markup=_list_keyboard("t", letter, items, 0)
        )
        return

    if data.startswith("tp:"):
        _, letter, page = data.split(":")
        items = _get_items_for_mode(wizard["to_mode"])
        telegram_api.send_message(
            "Velg TIL:", reply_markup=_list_keyboard("t", letter, items, int(page))
        )
        return

    if data.startswith("ti:"):
        idx = int(data.split(":")[1])
        items = _get_items_for_mode(wizard["to_mode"])
        wizard["to_value"] = items[idx]

        watch = _build_watch(wizard)
        telegram_api.send_message(
            f"Bekreft ny rute:\n\n{describe_watch(watch)}",
            reply_markup=telegram_api.inline_keyboard(
                [[("✅ Bekreft", "cf")], [("❌ Avbryt", "ca")]]
            ),
        )
        return

    if data == "cf":
        watch = _build_watch(wizard)
        config.setdefault("watches", []).append(watch)
        state["wizard"] = None
        telegram_api.send_message(f"Lagt til: {describe_watch(watch)}")
        _send_main_menu()
        return


def _handle_message(text, state, config):
    text = (text or "").strip().lower()
    if text in ("/start", "/meny", "/menu"):
        state["wizard"] = None
        _send_main_menu("Hei! Hva vil du gjøre?")
    else:
        _send_main_menu("Jeg forstod ikke det. Bruk knappene under:")


def process_updates(state, config):
    """
    Henter og behandler alle ventende Telegram-oppdateringer siden sist,
    og oppdaterer state/config underveis. Returnerer True hvis noe ble behandlet.
    """
    offset = state.get("last_update_id", 0) + 1
    updates = telegram_api.get_updates(offset=offset)

    if not updates:
        return False

    for update in updates:
        state["last_update_id"] = update["update_id"]

        if "callback_query" in update:
            cq = update["callback_query"]
            telegram_api.answer_callback_query(cq["id"])
            _handle_callback(cq["data"], state, config)
        elif "message" in update:
            msg = update["message"]
            _handle_message(msg.get("text", ""), state, config)

    return True
