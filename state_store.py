"""
Enkel lagring/lasting av JSON-filene botten bruker for å huske
tilstand mellom kjøringer.
"""

import json
import os

CONFIG_PATH = "config.json"
STATE_PATH = "state.json"
SEEN_PATH = "seen.json"

DEFAULT_CONFIG = {"watches": []}
DEFAULT_STATE = {"last_update_id": 0, "wizard": None}
DEFAULT_SEEN = {"notified_ids": []}


def _load(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(json.dumps(default))  # dyp kopi av default


def _save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_config():
    return _load(CONFIG_PATH, DEFAULT_CONFIG)


def save_config(config):
    _save(CONFIG_PATH, config)


def load_state():
    return _load(STATE_PATH, DEFAULT_STATE)


def save_state(state):
    _save(STATE_PATH, state)


def load_seen():
    return _load(SEEN_PATH, DEFAULT_SEEN)


def save_seen(seen):
    _save(SEEN_PATH, seen)
