# -*- coding: utf-8 -*-
"""Guardado y carga de partidas (JSON, 3 slots)."""
from __future__ import annotations

import json
import os

from .models import GameState

SAVE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "saves")
SLOTS = 3


def _slot_path(slot: int) -> str:
    return os.path.join(SAVE_DIR, f"slot_{slot}.json")


def save_game(gs: GameState, slot: int) -> str:
    os.makedirs(SAVE_DIR, exist_ok=True)
    path = _slot_path(slot)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(gs.to_dict(), f, ensure_ascii=False, indent=2)
    return path


def load_game(slot: int) -> GameState | None:
    path = _slot_path(slot)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return GameState.from_dict(json.load(f))


def slot_summary(slot: int) -> str | None:
    """Descripción corta del slot, o None si está vacío."""
    path = _slot_path(slot)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        vivos = sum(1 for s in d["soldiers"] if s["alive"])
        estado = "VICTORIA" if d.get("victory") else f"capítulo {d['chapter']}"
        return (f"{d['player_name']} — día {d['day']}, {estado}, "
                f"{vivos} soldados, {d['titans_killed']} titanes abatidos")
    except Exception:
        return "(archivo dañado)"
