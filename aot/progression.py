# -*- coding: utf-8 -*-
"""Árbol de tecnología y cálculo de efectos sobre el equipo."""
from __future__ import annotations

from . import constants as C
from .models import GameState, Soldier


# ---------------------------------------------------------------- efectos
def max_gas(gs: GameState) -> int:
    gas = C.BASE_GAS
    if gs.has_tech("tanque"):
        gas += 6
    return gas


def blade_pairs(gs: GameState) -> int:
    pairs = C.BASE_BLADE_PAIRS
    if gs.has_tech("forja"):
        pairs += 1
    return pairs


def blade_edge(gs: GameState) -> int:
    edge = C.BASE_BLADE_EDGE
    if gs.has_tech("hojas_duras"):
        edge += 2
    return edge


def dash_range(gs: GameState) -> int:
    r = C.DASH_RANGE
    if gs.has_tech("anclaje"):
        r += 2
    return r


def hook_range(gs: GameState) -> int:
    r = C.HOOK_RANGE
    if gs.has_tech("anclaje"):
        r += 2
    return r


def dash_cost(gs: GameState) -> int:
    cost = C.DASH_COST
    if gs.has_tech("economia"):
        cost = max(1, cost - 1)
    return cost


def hook_cost(gs: GameState, soldier: Soldier) -> int:
    cost = C.HOOK_COST
    if soldier.has_trait("prodigio"):
        cost -= 1
    return max(1, cost)


def injury_death_chance(gs: GameState) -> float:
    return 0.50 if gs.has_tech("hospital") else C.INJURY_DEATH_CHANCE


def ally_damage_bonus(gs: GameState) -> int:
    return 1 if gs.has_tech("flanqueo") else 0


def struggle_bonus(gs: GameState) -> int:
    return 2 if gs.has_tech("nervios") else 0


# ---------------------------------------------------------------- árbol
def available_techs(gs: GameState) -> list[str]:
    """Tecnologías investigables ahora mismo (prerrequisito cumplido)."""
    out = []
    for key, t in C.TECH_TREE.items():
        if key in gs.techs:
            continue
        if t["requires"] and t["requires"] not in gs.techs:
            continue
        out.append(key)
    return out


def research(gs: GameState, key: str) -> tuple[bool, str]:
    tech = C.TECH_TREE[key]
    if key in gs.techs:
        return False, "Ya está investigada."
    if tech["requires"] and tech["requires"] not in gs.techs:
        req = C.TECH_TREE[tech["requires"]]["name"]
        return False, f"Requiere: {req}."
    if gs.resources["merito"] < tech["cost"]:
        return False, f"Mérito insuficiente ({gs.resources['merito']}/{tech['cost']})."
    gs.resources["merito"] -= tech["cost"]
    gs.techs.append(key)
    if key == "nervios":
        for s in gs.soldiers:
            if s.alive:
                s.courage += 1
    return True, f"Investigado: {tech['name']}."
