# -*- coding: utf-8 -*-
"""Misiones: generación de mapas, capítulos, exploración, defensas y resultados."""
from __future__ import annotations

import random

from . import constants as C
from . import progression as prog
from . import ui
from .engine import Engine, MissionResult, MissionSpec
from .keyboard import make_input
from .models import GameState, Soldier, random_soldier


# ================================================================ mapas
def make_grid(w: int, h: int, trees: int = 0, bigtrees: int = 0, houses: int = 0,
              supplies: int = 0, rng: random.Random | None = None) -> list:
    rng = rng or random
    grid = [[C.TILE_FLOOR for _ in range(w)] for _ in range(h)]

    def scatter(tile: str, n: int) -> None:
        for _ in range(n):
            x, y = rng.randint(1, w - 2), rng.randint(1, h - 2)
            if grid[y][x] == C.TILE_FLOOR:
                grid[y][x] = tile

    scatter(C.TILE_TREE, trees)
    scatter(C.TILE_BIGTREE, bigtrees)
    scatter(C.TILE_HOUSE, houses)
    scatter(C.TILE_SUPPLY, supplies)
    return grid


def _clear_cell(grid: list, x: int, y: int) -> None:
    grid[y][x] = C.TILE_FLOOR


# ================================================================ constructores
def build_tutorial(rng: random.Random) -> MissionSpec:
    grid = make_grid(30, 12, trees=8, rng=rng)
    titans = [("puro", x, y, {"dummy": True}) for x, y in
              [(10, 3), (18, 4), (24, 8), (14, 9)]]
    for _, x, y, _e in titans:
        _clear_cell(grid, x, y)
    return MissionSpec(
        name="Capítulo 1 — El entrenamiento",
        mode="tutorial", grid=grid,
        player_spawn=(3, 6), ally_spawns=[(2, 5), (2, 7), (4, 5), (4, 7)],
        titans=titans, no_death=True,
        objective_text="Destruye las 4 dianas de madera (+). Acércate y ataca su parte trasera (·).",
    )


def build_defense(gs: GameState, rng: random.Random, story: bool = False) -> MissionSpec:
    w, h = 42, 16
    grid = make_grid(w, h, trees=6, houses=4, supplies=3, rng=rng)
    wall_y = h - 3
    gate_x = w // 2
    for x in range(w):
        grid[wall_y][x] = C.TILE_WALL
    grid[wall_y][gate_x] = C.TILE_GATE
    for cx in (gate_x - 8, gate_x + 8):
        grid[wall_y][cx] = C.TILE_CANNON
    # despejar la franja de combate junto a la muralla
    for x in range(w):
        for y in (wall_y - 1, wall_y - 2):
            if grid[y][x] not in (C.TILE_SUPPLY,):
                grid[y][x] = C.TILE_FLOOR

    scale = 1 + gs.day // 18
    if story:
        waves_def = [
            [("puro", 2)],
            [("puro", 2), ("anormal", 1)],
            [("puro", 2), ("grande", 1)],
        ]
        gate_hp = 12
    else:
        waves_def = [
            [("puro", 1 + scale)],
            [("puro", scale), ("anormal", 1)],
        ]
        if scale >= 2:
            waves_def.append([("puro", 1), ("grande", 1)])
        gate_hp = 10

    def spawn_row(counts) -> list:
        out = []
        for kind, n in counts:
            for _ in range(n):
                out.append((kind, rng.randint(3, w - 4), rng.randint(0, 2)))
        return out

    first = spawn_row(waves_def[0])
    waves = [spawn_row(c) for c in waves_def[1:]]
    return MissionSpec(
        name="Capítulo 2 — La caída de la puerta" if story else "¡Defensa de la muralla!",
        mode="defense", grid=grid,
        player_spawn=(gate_x, wall_y - 2),
        ally_spawns=[(gate_x - 3, wall_y - 1), (gate_x + 3, wall_y - 1),
                     (gate_x - 5, wall_y - 2), (gate_x + 5, wall_y - 2)],
        titans=[(k, x, y, {}) for k, x, y in first],
        waves=waves,
        gate_pos=(gate_x, wall_y), gate_hp=gate_hp,
        objective_text="Repele todas las oleadas. ¡Que NADIE toque la puerta! (cañones: E)",
    )


def build_escort(rng: random.Random) -> MissionSpec:
    w, h = 56, 14
    grid = make_grid(w, h, trees=18, bigtrees=4, supplies=4, rng=rng)
    for y in range(5, 9):           # camino de la carreta despejado
        for x in range(w):
            if grid[y][x] in (C.TILE_BIGTREE, C.TILE_HOUSE):
                grid[y][x] = C.TILE_FLOOR
    titans = []
    for i, x in enumerate((16, 26, 36, 46)):
        kind = "anormal" if i == 2 else "puro"
        titans.append((kind, x, rng.choice((1, 2, 11, 12)),
                       {"targets_cart": i % 2 == 0}))
    return MissionSpec(
        name="Capítulo 3 — Sangre fuera de los muros",
        mode="escort", grid=grid,
        player_spawn=(4, 6), ally_spawns=[(3, 5), (3, 8), (5, 5), (5, 8)],
        titans=titans,
        cart_start=(2, 7), cart_hp=8,
        objective_text="Escolta la carreta (C) hasta el borde este. No dejes que la destrocen.",
    )


def build_hunt(rng: random.Random) -> MissionSpec:
    w, h = 50, 18
    grid = make_grid(w, h, trees=20, bigtrees=22, supplies=4, rng=rng)
    titans = [
        ("anormal", w - 8, h // 2, {"marked": True, "height": 10}),
        ("puro", 20, 4, {}),
        ("puro", 26, 13, {}),
        ("puro", 36, 8, {}),
    ]
    for _, x, y, _e in titans:
        _clear_cell(grid, x, y)
    return MissionSpec(
        name="Capítulo 4 — El bosque de árboles gigantes",
        mode="hunt", grid=grid,
        player_spawn=(3, h // 2), ally_spawns=[(2, h // 2 - 1), (2, h // 2 + 1),
                                               (4, h // 2 - 1), (4, h // 2 + 1)],
        titans=titans,
        objective_text="Caza al Anormal marcado (fondo amarillo). Huirá cuando lo hieras: no lo dejes escapar.",
    )


def build_final_phase1(rng: random.Random) -> MissionSpec:
    w, h = 46, 16
    grid = make_grid(w, h, trees=6, houses=8, supplies=4, rng=rng)
    titans = [
        ("puro", 12, 4, {}), ("puro", 30, 4, {}), ("puro", 22, 10, {}),
        ("anormal", 36, 8, {}), ("grande", 23, 3, {"height": 15}),
    ]
    for _, x, y, _e in titans:
        _clear_cell(grid, x, y)
    return MissionSpec(
        name="FINAL (Fase 1) — Limpiar la brecha",
        mode="exterminate", grid=grid,
        player_spawn=(4, h - 3), ally_spawns=[(3, h - 4), (3, h - 2), (5, h - 4), (5, h - 2)],
        titans=titans,
        objective_text="Extermina a TODOS los titanes de la zona de la brecha.",
    )


def build_final_phase2(rng: random.Random) -> MissionSpec:
    w, h = 42, 16
    grid = make_grid(w, h, trees=4, houses=3, supplies=4, rng=rng)
    wall_y = h - 3
    gate_x = w // 2
    for x in range(w):
        grid[wall_y][x] = C.TILE_WALL
    grid[wall_y][gate_x] = C.TILE_GATE
    for cx in (gate_x - 8, gate_x + 8):
        grid[wall_y][cx] = C.TILE_CANNON
    waves = [
        [("puro", rng.randint(4, w - 5), rng.randint(0, 2)) for _ in range(2)]
        + [("anormal", rng.randint(4, w - 5), 0)],
        [("grande", gate_x, 0), ("puro", gate_x - 10, 1), ("puro", gate_x + 10, 1)],
    ]
    return MissionSpec(
        name="FINAL (Fase 2) — Sellar la puerta",
        mode="final", grid=grid,
        player_spawn=(gate_x, wall_y - 2),
        ally_spawns=[(gate_x - 3, wall_y - 1), (gate_x + 3, wall_y - 1),
                     (gate_x - 5, wall_y - 2), (gate_x + 5, wall_y - 2)],
        titans=[("puro", gate_x - 6, 1, {}), ("puro", gate_x + 6, 1, {})],
        waves=waves,
        gate_pos=(gate_x, wall_y), gate_hp=14,
        seal_target=80,
        objective_text="El equipo sella la puerta mientras NO haya titanes cerca de ella. ¡Mantenlos lejos!",
    )


def build_field_combat(danger: int, rng: random.Random, name: str = "¡Emboscada de titanes!") -> MissionSpec:
    w, h = 44, 14
    grid = make_grid(w, h, trees=12, bigtrees=4, supplies=2 + danger, rng=rng)
    titans = []
    n_puros = 1 + danger + rng.randint(0, 1)
    for _ in range(n_puros):
        titans.append(("puro", rng.randint(w // 2, w - 3), rng.randint(1, h - 2), {}))
    if danger >= 2:
        titans.append(("anormal", rng.randint(w // 2, w - 3), rng.randint(1, h - 2), {}))
    if danger >= 3 and rng.random() < 0.7:
        titans.append(("grande", w - 5, h // 2, {}))
    for _, x, y, _e in titans:
        _clear_cell(grid, x, y)
    return MissionSpec(
        name=name, mode="exterminate", grid=grid,
        player_spawn=(3, h // 2),
        ally_spawns=[(2, h // 2 - 1), (2, h // 2 + 1), (4, h // 2 - 1), (4, h // 2 + 1)],
        titans=titans,
        objective_text="Extermina a todos los titanes de la zona.",
    )


# ================================================================ ejecución y consecuencias
def select_squad(gs: GameState) -> list[Soldier] | None:
    """El jugador siempre va; elige hasta 4 acompañantes. None = cancelar."""
    player = gs.player
    if player is None or player.injured_days > 0:
        ui.bad("Tu personaje no está en condiciones de salir.")
        return None
    candidates = [s for s in gs.active_roster() if not s.is_player]
    squad = [player]
    if not candidates:
        ui.warn("Saldrás SOLO. Nadie más está disponible.")
        ui.pause()
        return squad
    ui.info("\n[bold]Elige tu escuadrón (máx. 4 acompañantes).[/]")
    remaining = candidates[:]
    while len(squad) - 1 < 4 and remaining:
        opts = [ui.soldier_line(s) for s in remaining] + ["[bold green]— Partir con este escuadrón —[/]"]
        i = ui.menu(f"Acompañantes: {len(squad) - 1}/4", opts, allow_back=True)
        if i == -1:
            return None
        if i == len(remaining):
            break
        squad.append(remaining.pop(i))
    return squad


def allocate_loadout(gs: GameState, engine: Engine) -> dict:
    """Reparte gas y hojas del almacén entre el escuadrón. Devuelve lo asignado."""
    n = len(engine.units)
    gas_cap = prog.max_gas(gs)
    pairs_cap = prog.blade_pairs(gs)
    edge = prog.blade_edge(gs)

    gas_stock = gs.resources["gas"]
    pair_stock = gs.resources["hojas"]
    gas_each = min(gas_cap, gas_stock // n if n else 0)
    pairs_each = min(pairs_cap, pair_stock // n if n else 0)
    for u in engine.units:
        u.gas = gas_each
        u.blades = [edge] * pairs_each
    total_gas = gas_each * n
    total_pairs = pairs_each * n
    gs.resources["gas"] -= total_gas
    gs.resources["hojas"] -= total_pairs
    return {"gas": total_gas, "pairs": total_pairs, "gas_each": gas_each,
            "pairs_each": pairs_each}


def run_mission(gs: GameState, spec: MissionSpec, squad: list[Soldier],
                render: bool = True, inp=None, rng=None,
                max_ticks: int = 0) -> MissionResult:
    """Ejecuta la misión y aplica TODAS las consecuencias al estado."""
    rng = rng or random.Random()
    if inp is None:
        inp = make_input()
    engine = Engine(gs, spec, squad, inp, rng=rng, render=render, max_ticks=max_ticks)
    alloc = allocate_loadout(gs, engine)
    if render and alloc["gas_each"] <= 3:
        ui.warn(f"Reservas bajas: cada soldado parte con solo {alloc['gas_each']} de gas "
                f"y {alloc['pairs_each']} pares de hojas.")
        ui.pause()
    try:
        result = engine.run()
    finally:
        if render:
            inp.close()

    # ---- devolver equipo no gastado
    gs.resources["gas"] += sum(result.gas_left.values())
    gs.resources["hojas"] += sum(result.pairs_left.values())

    # ---- botín y mérito
    for k, v in result.loot.items():
        gs.resources[k] = gs.resources.get(k, 0) + v
    merito = result.titans_killed * 12 + (25 if result.success else 5)
    if spec.no_death:
        merito = max(10, merito // 2)
    gs.resources["merito"] += merito
    result.loot["merito"] = merito
    gs.titans_killed += result.titans_killed

    # ---- XP y kills
    levelups = []
    for s in squad:
        k = result.kills.get(s.name, 0)
        s.kills += k
        s.missions += 1
        xp = k * C.XP_PER_KILL + (C.XP_PER_MISSION if result.success else 8)
        levelups += s.gain_xp(xp)
    result.summary += levelups

    # ---- caídos: devorados mueren seguro; el resto tira por su vida
    for soldier, eaten in result.downed:
        if eaten:
            gs.kill_soldier(soldier, "devorado por un titán")
            result.summary.append(f"✖ {soldier.name} — DEVORADO. Se une al memorial.")
        else:
            if rng.random() < prog.injury_death_chance(gs):
                gs.kill_soldier(soldier, "heridas mortales en combate")
                result.summary.append(f"✖ {soldier.name} muere de sus heridas. Se une al memorial.")
            else:
                soldier.injured_days = rng.randint(*C.INJURY_DAYS)
                result.summary.append(
                    f"⚕ {soldier.name} sobrevive de milagro: {soldier.injured_days} días en el hospital.")
    return result


def show_mission_report(gs: GameState, result: MissionResult) -> None:
    ui.clear()
    ui.header("INFORME DE MISIÓN", "bold white")
    if result.success:
        ui.good("MISIÓN CUMPLIDA")
    elif result.retreat:
        ui.warn("RETIRADA — la misión quedó incompleta")
    else:
        ui.bad("MISIÓN FRACASADA")
    ui.info(f"Titanes abatidos: [bold]{result.titans_killed}[/]   "
            f"Mérito ganado: [magenta]+{result.loot.get('merito', 0)}[/]")
    loot_items = [f"{v} {k}" for k, v in result.loot.items() if k != "merito" and v]
    if loot_items:
        ui.info("Botín recuperado: " + ", ".join(loot_items))
    for line in result.summary:
        ui.info("  " + line)
    if not gs.living():
        ui.bad("\nNo queda NADIE. La humanidad pierde otra brigada...")
    ui.pause()


# ================================================================ exploración
EXPLORE_EVENTS = ["titanes", "suministros", "ruinas", "refugiados", "clima", "calma"]


def _event_weights(danger: int) -> list[int]:
    return {
        1: [30, 25, 15, 10, 8, 12],
        2: [45, 20, 15, 8, 7, 5],
        3: [55, 15, 14, 6, 7, 3],
    }[danger]


def run_exploration(gs: GameState, rng: random.Random | None = None,
                    render: bool = True, inp=None, max_ticks: int = 0,
                    tier_key: str | None = None, auto_continue: bool = False) -> None:
    rng = rng or random.Random()
    if tier_key is None:
        keys = list(C.EXPLORE_TIERS.keys())
        opts = [f"{C.EXPLORE_TIERS[k]['name']} — {C.EXPLORE_TIERS[k]['nodes']} tramos, "
                f"{C.EXPLORE_TIERS[k]['days']} día(s), riesgo {'☠' * C.EXPLORE_TIERS[k]['danger']}"
                for k in keys]
        i = ui.menu("¿Hasta dónde te aventuras?", opts, allow_back=True)
        if i == -1:
            return
        tier_key = keys[i]
    tier = C.EXPLORE_TIERS[tier_key]

    squad = select_squad(gs)
    if squad is None:
        return

    gs.expeditions += 1
    danger = tier["danger"]
    loot_mult = tier["loot"]
    if render:
        ui.clear()
        ui.header(f"EXPEDICIÓN {tier['name'].upper()} — las puertas se abren", "bold green")
        ui.info("El portón se eleva. Más allá de la muralla solo hay hierba alta,\n"
                "ruinas... y ellos. La columna avanza al galope.\n")

    for node in range(1, tier["nodes"] + 1):
        weights = _event_weights(danger)
        event = rng.choices(EXPLORE_EVENTS, weights=weights)[0]
        if node == tier["nodes"]:
            event = rng.choice(["titanes", "ruinas"])     # el tramo final siempre arde
        if render:
            ui.info(f"\n[bold underline]— Tramo {node}/{tier['nodes']} —[/]")

        if event == "titanes" or (event == "ruinas" and rng.random() < 0.4):
            if event == "ruinas" and render:
                ui.warn("Ruinas de una aldea... y algo se mueve entre las casas. ¡EMBOSCADA!")
            spec = build_field_combat(danger, rng)
            result = run_mission(gs, spec, [s for s in squad if s.alive and s.injured_days == 0],
                                 render=render, inp=inp, rng=rng, max_ticks=max_ticks)
            if render:
                show_mission_report(gs, result)
            squad = [s for s in squad if s.alive and s.injured_days == 0]
            if not result.success or gs.player is None or gs.player.injured_days > 0:
                if render:
                    ui.warn("La expedición da media vuelta hacia la muralla.")
                    ui.pause()
                break
        elif event == "ruinas":
            gas = int(rng.randint(3, 7) * loot_mult)
            hojas = int(rng.randint(0, 2) * loot_mult)
            gs.resources["gas"] += gas
            gs.resources["hojas"] += hojas
            if render:
                ui.good(f"Ruinas saqueables: +{gas} gas, +{hojas} pares de hojas.")
        elif event == "suministros":
            gas = int(rng.randint(2, 5) * loot_mult)
            comida = int(rng.randint(3, 6) * loot_mult)
            gs.resources["gas"] += gas
            gs.resources["comida"] += comida
            if render:
                ui.good(f"Carreta militar abandonada: +{gas} gas, +{comida} comida.")
        elif event == "refugiados":
            merito = int(rng.randint(8, 15) * loot_mult)
            gs.resources["merito"] += merito
            if render:
                ui.good(f"Escoltas a un grupo de refugiados a un fuerte cercano. +{merito} mérito.")
            if rng.random() < 0.35 and len(gs.living()) < 9:
                nuevo = random_soldier(rng)
                gs.soldiers.append(nuevo)
                if render:
                    ui.good(f"Uno de ellos sabe pelear y se alista: ¡{nuevo.name} se une!")
        elif event == "clima":
            perdido = min(gs.resources["gas"], rng.randint(2, 5))
            gs.resources["gas"] -= perdido
            if render:
                ui.warn(f"Tormenta repentina: fugas en los tanques (−{perdido} gas).")
        else:
            if render:
                ui.info("Campos en silencio. Nada en el horizonte. Se agradece.")

        if node < tier["nodes"] and render and not auto_continue:
            i = ui.menu("¿Seguir adelante?",
                        ["Continuar la expedición", "Regresar a la muralla (conservas el botín)"])
            if i == 1:
                break

    msgs = gs.pass_days(tier["days"])
    if render:
        for m in msgs:
            ui.warn(m)
        ui.good(f"\nLa expedición regresa. Mérito total acumulado: {gs.resources['merito']}.")
        ui.pause()


# ================================================================ defensa de muralla (alerta)
def run_wall_defense(gs: GameState, rng: random.Random | None = None,
                     render: bool = True, inp=None, max_ticks: int = 0) -> None:
    rng = rng or random.Random()
    squad = select_squad(gs)
    if squad is None:
        return
    spec = build_defense(gs, rng)
    result = run_mission(gs, spec, squad, render=render, inp=inp, rng=rng, max_ticks=max_ticks)
    gs.wall_alert_active = False
    gs.schedule_wall_alert(rng)
    if not result.success:
        dmg = C.WALL_IGNORE_DAMAGE + rng.randint(0, 8)
        gs.wall_hp = max(0, gs.wall_hp - dmg)
        result.summary.append(f"La muralla sufre daños graves (−{dmg}). Estado: {gs.wall_hp}/100.")
    else:
        gs.resources["merito"] += 15
    if render:
        show_mission_report(gs, result)


def ignore_wall_alert(gs: GameState, rng: random.Random | None = None) -> str:
    rng = rng or random.Random()
    dmg = C.WALL_IGNORE_DAMAGE + rng.randint(0, 6)
    gs.wall_hp = max(0, gs.wall_hp - dmg)
    gs.wall_alert_active = False
    gs.schedule_wall_alert(rng)
    return (f"La guarnición local contiene el ataque sin ti... a un costo terrible. "
            f"Muralla −{dmg} ({gs.wall_hp}/100).")


# ================================================================ capítulos
def run_chapter(gs: GameState, rng: random.Random | None = None,
                render: bool = True, inp=None, max_ticks: int = 0) -> bool:
    """Juega el capítulo actual. Devuelve True si se superó."""
    rng = rng or random.Random()
    chapter = C.CHAPTERS[gs.chapter - 1]
    if chapter.get("requires_tech") and not gs.has_tech(chapter["requires_tech"]):
        ui.warn(f"Necesitas investigar «{C.TECH_TREE[chapter['requires_tech']]['name']}» "
                "para desbloquear la operación final.")
        ui.pause()
        return False

    if render:
        ui.clear()
        ui.header(f"CAPÍTULO {chapter['id']} — {chapter['title']}", "bold red")
        ui.info(chapter["intro"] + "\n", style="italic")
        ui.pause("Pulsa ENTER cuando estés listo...")

    squad = select_squad(gs)
    if squad is None:
        return False

    ctype = chapter["type"]
    if ctype == "tutorial":
        spec = build_tutorial(rng)
    elif ctype == "defense_story":
        spec = build_defense(gs, rng, story=True)
    elif ctype == "escort":
        spec = build_escort(rng)
    elif ctype == "hunt":
        spec = build_hunt(rng)
    elif ctype == "final":
        spec = build_final_phase1(rng)
    else:
        spec = build_field_combat(2, rng, name=chapter["title"])

    result = run_mission(gs, spec, squad, render=render, inp=inp, rng=rng, max_ticks=max_ticks)
    if render:
        show_mission_report(gs, result)

    # fase 2 de la operación final
    if ctype == "final" and result.success and gs.player is not None:
        squad2 = [s for s in squad if s.alive and s.injured_days == 0]
        if not squad2 or gs.player not in squad2:
            ui.bad("No quedan fuerzas para la fase 2. La operación se cancela.")
            ui.pause()
            return False
        if render:
            ui.header("FASE 2 — El equipo de sellado entra por la brecha", "bold yellow")
            ui.pause()
        spec2 = build_final_phase2(rng)
        result2 = run_mission(gs, spec2, squad2, render=render, inp=inp, rng=rng,
                              max_ticks=max_ticks)
        if render:
            show_mission_report(gs, result2)
        result = result2

    msgs = gs.pass_days(1)
    if render:
        for m in msgs:
            ui.warn(m)
    if result.success:
        if ctype == "final":
            gs.victory = True
        else:
            gs.chapter += 1
        return True
    return False
