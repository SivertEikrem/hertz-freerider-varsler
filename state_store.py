"""
Enkel lagring/lasting av JSON-filene botten bruker.
"""

import json
import os

CONFIG_PATH = "config.json"
SEEN_PATH = "seen.json"

DEFAULT_CONFIG = {"watches": []}
DEFAULT_SEEN = {"notified_ids": [], "last_summary_date": None}


def _load(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(json.dumps(default))


def _save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_config():
    return _load(CONFIG_PATH, DEFAULT_CONFIG)


def load_seen():
    return _load(SEEN_PATH, DEFAULT_SEEN)


def save_seen(seen):
    _save(SEEN_PATH, seen)
