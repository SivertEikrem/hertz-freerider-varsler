"""
Hjelpefunksjoner for å sende varsler og lese meldinger via Telegram Bot API.
"""

import os

import requests

API_BASE = "https://api.telegram.org/bot{token}/{method}"


def _token():
    return os.environ["TELEGRAM_BOT_TOKEN"]


def send_message(chat_id, text):
    """Sender en tekstmelding til en gitt Telegram-chat."""
    url = API_BASE.format(token=_token(), method="sendMessage")
    resp = requests.post(url, json={"chat_id": chat_id, "text": text}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API-feil: {data}")
    return data["result"]


def get_updates(offset=None):
    """Henter nye meldinger til boten siden `offset` (Telegram sin update_id-paginering)."""
    url = API_BASE.format(token=_token(), method="getUpdates")
    params = {"timeout": 0}
    if offset is not None:
        params["offset"] = offset
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API-feil: {data}")
    return data["result"]
