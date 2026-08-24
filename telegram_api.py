"""
Hjelpefunksjoner for å snakke med Telegram Bot API.
"""

import os

import requests

API_BASE = "https://api.telegram.org/bot{token}/{method}"


def _token():
    return os.environ["TELEGRAM_BOT_TOKEN"]


def _chat_id():
    return os.environ["TELEGRAM_CHAT_ID"]


def _call(method, **params):
    url = API_BASE.format(token=_token(), method=method)
    resp = requests.post(url, json=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API-feil ({method}): {data}")
    return data["result"]


def get_updates(offset=None, timeout=0):
    """Henter nye oppdateringer (meldinger/knappetrykk) siden 'offset'."""
    params = {"timeout": timeout}
    if offset is not None:
        params["offset"] = offset
    return _call("getUpdates", **params)


def send_message(text, reply_markup=None):
    """Sender en tekstmelding, evt. med knapper (reply_markup)."""
    params = {"chat_id": _chat_id(), "text": text}
    if reply_markup is not None:
        params["reply_markup"] = reply_markup
    return _call("sendMessage", **params)


def answer_callback_query(callback_query_id, text=None):
    """Bekrefter mottak av et knappetrykk (fjerner 'laster'-indikatoren)."""
    params = {"callback_query_id": callback_query_id}
    if text:
        params["text"] = text
    return _call("answerCallbackQuery", **params)


def inline_keyboard(rows):
    """rows: liste av lister med (tekst, callback_data)-tupler."""
    return {
        "inline_keyboard": [
            [{"text": text, "callback_data": data} for text, data in row]
            for row in rows
        ]
    }
