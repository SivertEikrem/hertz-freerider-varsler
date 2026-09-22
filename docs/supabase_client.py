"""
Enkel klient mot Supabase sitt REST-API (PostgREST), med service_role-nøkkel.

Bevisst IKKE den offisielle supabase-py-pakken: den drar med seg en god
del avhengigheter vi ikke trenger for noen få enkle spørringer. Rått
REST-kall med `requests` holder full oversikt og null magi, i tråd med
resten av dette prosjektet.

service_role-nøkkelen har full tilgang og omgår Row Level Security -
den skal ALDRI havne i frontend-koden, kun i GitHub Actions-secrets.
"""

import os

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

REST_BASE = f"{SUPABASE_URL}/rest/v1"

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


def select(table, params=None):
    """Henter rader. params er PostgREST-spørringsparametre,
    f.eks. {"select": "*", "chat_id": "not.is.null"}."""
    resp = requests.get(f"{REST_BASE}/{table}", headers=HEADERS, params=params or {}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def insert(table, rows):
    resp = requests.post(f"{REST_BASE}/{table}", headers=HEADERS, json=rows, timeout=15)
    resp.raise_for_status()
    return resp.json() if resp.text else None


def upsert(table, rows, on_conflict):
    headers = {**HEADERS, "Prefer": f"resolution=merge-duplicates,return=representation"}
    resp = requests.post(
        f"{REST_BASE}/{table}?on_conflict={on_conflict}",
        headers=headers,
        json=rows,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json() if resp.text else None


def update(table, params, patch):
    resp = requests.patch(f"{REST_BASE}/{table}", headers=HEADERS, params=params, json=patch, timeout=15)
    resp.raise_for_status()
    return resp.json() if resp.text else None


def get_bot_state(key, default=None):
    rows = select("bot_state", {"select": "value", "key": f"eq.{key}"})
    if not rows:
        return default
    return rows[0]["value"]


def set_bot_state(key, value):
    upsert("bot_state", [{"key": key, "value": str(value)}], on_conflict="key")
