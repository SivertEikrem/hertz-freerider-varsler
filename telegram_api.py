"""
Hjelpefunksjon for å sende varsler via Telegram Bot API.
"""

import os

import requests

API_BASE = "https://api.telegram.org/bot{token}/{method}"


def send_message(text):
    """Sender en tekstmelding til brukeren via Telegram-boten."""
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chat_id = os.environ["TELEGRAM_CHAT_ID"]
    url = API_BASE.format(token=token, method="sendMessage")
    resp = requests.post(url, json={"chat_id": chat_id, "text": text}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API-feil: {data}")
    return data["result"]
