# -*- coding: utf-8 -*-
"""Smoke tests del motor: corre el juego sin teclado ni render.

Ejecutar:  python -m tests.test_smoke   (desde la raíz del proyecto)
"""
import random
import sys

from aot import constants as C
from aot import progression as prog
from aot.engine import Engine, MissionSpec
from aot.keyboard import ScriptedInput
from aot.missions import (build_defense, build_field_combat, build_tutorial,
                          make_grid, run_mission)
from aot.models import GameState, Soldier, new_game
from aot.save import load_game, save_game

PASS = 0
FAIL = 0


def check(name: str, cond: bool, extra: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [OK]   {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} {extra}")


def fresh_state() -> GameState:
    gs = new_game("Tester")
    gs.resources["gas"] = 500
    gs.resources["hojas"] = 50
    return gs


def simple_spec(titans=None, mode="exterminate", **kw) -> MissionSpec:
    grid = make_grid(20, 10, rng=random.Random(1))
    return MissionSpec(name="test", mode=mode, grid=grid,
                       player_spawn=(2, 5), ally_spawns=[(1, 4), (1, 6)],
                       titans=titans or [], **kw)


def make_engine(gs, spec, script, squad=None, seed=7, max_ticks=400):
    squad = squad or [gs.player]
    inp = ScriptedInput(script)
    eng = Engine(gs, spec, squad, inp, rng=random.Random(seed),
                 render=False, max_ticks=max_ticks)
    return eng


def test_dash_consumes_gas():
    gs = fresh_state()
    spec = simple_spec()
    eng = make_engine(gs, spec, {1: [("key", "d")], 2: [("key", "SPACE")]})
    p = eng.player_unit()
    gas0 = p.gas
    x0 = p.x
    import aot.titan_ai as ai
    for _ in range(5):
        eng.step(ai)
    check("dash mueve al jugador", p.x > x0 + 1, f"x0={x0} x={p.x}")
    check("dash consume gas", p.gas == gas0 - prog.dash_cost(gs),
          f"gas0={gas0} gas={p.gas}")


def test_no_gas_no_dash():
    gs = fresh_state()
    spec = simple_spec()
    eng = make_engine(gs, spec, {1: [("key", "d")], 2: [("key", "SPACE")]})
    p = eng.player_unit()
    p.gas = 0
    import aot.titan_ai as ai
    for _ in range(5):
        eng.step(ai)
    check("sin gas no hay impulso", p.x <= 4, f"x={p.x}")


def test_backstab_kills_dummy():
    gs = fresh_state()
    spec = simple_spec(titans=[("puro", 6, 5, {"dummy": True})], mode="tutorial",
                       no_death=True)
    # acercarse y atacar repetidamente
    script = {i: [("key", "d")] for i in range(1, 10)}
    for i in range(10, 40):
        script[i] = [("mouse_left",)]
    eng = make_engine(gs, spec, script)
    res = eng.run()
    check("la diana muere por clicks", res.titans_killed == 1)
    check("misión tutorial completada", res.success)


def test_backstab_real_titan():
    gs = fresh_state()
    spec = simple_spec(titans=[("puro", 10, 5, {})])
    eng = make_engine(gs, spec, {}, seed=3)
    p = eng.player_unit()
    t = eng.titans[0]
    gas0 = p.gas
    eng.player_hook(p)
    check("el gancho te coloca en la nuca", (p.x, p.y) == t.back_cell(),
          f"pos={(p.x, p.y)} nuca={t.back_cell()}")
    check("el gancho gastó gas", p.gas == gas0 - prog.hook_cost(gs, p.soldier))
    hp0 = t.nape_hp
    eng.player_attack(p)
    check("el corte por la espalda daña la nuca",
          t not in eng.titans or t.nape_hp < hp0)
    for _ in range(20):
        if t not in eng.titans:
            break
        p.attack_cd = 0
        p.x, p.y = t.back_cell()        # se mantiene pegado a la nuca
        eng.player_attack(p)
    check("cortes de nuca repetidos matan al titán", t not in eng.titans,
          f"hp={t.nape_hp}")


def test_blades_wear_and_break():
    gs = fresh_state()
    spec = simple_spec(titans=[("grande", 3, 5, {"height": 15})])
    eng = make_engine(gs, spec, {})
    p = eng.player_unit()
    p.blades = [1]
    eng.rng = random.Random(1)
    # ataque frontal directo (titán mira al sur por defecto; jugador al oeste)
    eng.player_attack(p)
    check("la hoja se rompe al gastarse", len(p.blades) == 0, f"blades={p.blades}")
    check("se registró el par roto", p.pairs_broken == 1)


def test_grab_and_eaten():
    gs = fresh_state()
    spec = simple_spec(titans=[("puro", 3, 5, {})])
    eng = make_engine(gs, spec, {}, max_ticks=200)
    p = eng.player_unit()
    t = eng.titans[0]
    eng.start_grab(t, p)
    check("agarre registrado", p.grabbed_by is t and t.grabbing is p)
    import aot.titan_ai as ai
    for _ in range(C.GRAB_TIMEOUT_TICKS + 5):
        if eng.over:
            break
        eng.update_grabs()
    check("sin forcejeo te devoran", p.eaten and p.downed)
    check("misión termina al caer el jugador", eng.over and not eng.result.success)


def test_struggle_escape():
    gs = fresh_state()
    gs.player.strength = 10
    spec = simple_spec(titans=[("puro", 3, 5, {})])
    eng = make_engine(gs, spec, {})
    p = eng.player_unit()
    t = eng.titans[0]
    eng.start_grab(t, p)
    for _ in range(4):
        eng.do_struggle(p)
    check("forcejear con fuerza libera", p.grabbed_by is None)


def test_titan_ai_chases():
    gs = fresh_state()
    spec = simple_spec(titans=[("puro", 15, 5, {})])
    eng = make_engine(gs, spec, {}, max_ticks=60)
    t = eng.titans[0]
    d0 = eng.dist(t.x, t.y, 2, 5)
    import aot.titan_ai as ai
    for _ in range(40):
        eng.step(ai)
        if eng.over or t not in eng.titans:
            break
    d1 = eng.dist(t.x, t.y, eng.player_unit().x, eng.player_unit().y) if t in eng.titans else 0
    check("el titán persigue al jugador", d1 < d0, f"d0={d0} d1={d1}")


def test_ally_fights_and_permadeath_roll():
    gs = fresh_state()
    squad = [gs.player] + [s for s in gs.soldiers if not s.is_player][:2]
    spec = simple_spec(titans=[("puro", 12, 5, {}), ("puro", 14, 4, {})])
    # el jugador no hace nada: los aliados deben pelear solos
    res = run_mission(gs, spec, squad, render=False,
                      inp=ScriptedInput({}), rng=random.Random(11), max_ticks=2500)
    total_kills = sum(res.kills.values())
    check("la IA aliada participa (kills o caídos)",
          total_kills > 0 or len(res.downed) > 0,
          f"kills={res.kills} downed={[(s.name, e) for s, e in res.downed]}")
    # consecuencias aplicadas
    for soldier, eaten in res.downed:
        if eaten:
            check(f"devorado => muerto ({soldier.name})", not soldier.alive)
        else:
            check(f"caído => muerto o herido ({soldier.name})",
                  (not soldier.alive) or soldier.injured_days > 0)


def test_defense_gate():
    gs = fresh_state()
    spec = build_defense(gs, random.Random(5))
    check("defensa tiene puerta", spec.gate_pos is not None and spec.gate_hp > 0)
    check("defensa tiene oleadas", len(spec.waves) >= 1)
    eng = make_engine(gs, spec, {}, max_ticks=80)
    import aot.titan_ai as ai
    for _ in range(80):
        if eng.over:
            break
        eng.step(ai)
    check("la defensa corre sin crashear", True)


def test_resources_accounting():
    gs = fresh_state()
    gas0, hojas0 = gs.resources["gas"], gs.resources["hojas"]
    spec = simple_spec(titans=[("puro", 18, 8, {})])
    res = run_mission(gs, spec, [gs.player], render=False,
                      inp=ScriptedInput({}), rng=random.Random(2), max_ticks=50)
    # se retiró por max_ticks: el gas no usado vuelve
    check("el gas no gastado se devuelve",
          gs.resources["gas"] >= gas0 - prog.max_gas(gs), f"{gas0}->{gs.resources['gas']}")
    check("hojas devueltas", gs.resources["hojas"] >= hojas0 - prog.blade_pairs(gs))
    check("mérito otorgado", gs.resources["merito"] > 0)


def test_progression_effects():
    gs = fresh_state()
    g0, d0 = prog.max_gas(gs), prog.dash_range(gs)
    gs.resources["merito"] = 1000
    ok, _ = prog.research(gs, "tanque")
    check("investigar tanque", ok)
    check("tanque aumenta gas", prog.max_gas(gs) == g0 + 6)
    ok, msg = prog.research(gs, "anclaje")
    check("prerrequisito bloquea", not ok, msg)
    prog.research(gs, "hojas_duras")
    ok, _ = prog.research(gs, "anclaje")
    check("cadena de prerrequisitos", ok)
    check("anclaje aumenta alcance", prog.dash_range(gs) == d0 + 2)


def test_save_load_roundtrip():
    gs = fresh_state()
    gs.day = 17
    gs.resources["merito"] = 123
    gs.techs.append("tanque")
    gs.kill_soldier(gs.soldiers[1], "prueba")
    gs.soldiers[2].injured_days = 3
    save_game(gs, 3)
    gs2 = load_game(3)
    check("save/load: día", gs2.day == 17)
    check("save/load: mérito", gs2.resources["merito"] == 123)
    check("save/load: techs", gs2.has_tech("tanque"))
    check("save/load: memorial", len(gs2.fallen) == 1 and gs2.fallen[0].name == gs.soldiers[1].name)
    check("save/load: herido", gs2.soldiers[2].injured_days == 3)
    check("save/load: jugador", gs2.player is not None and gs2.player.name == "Tester")


def test_tutorial_no_death():
    gs = fresh_state()
    spec = build_tutorial(random.Random(4))
    squad = [s for s in gs.soldiers][:5]
    res = run_mission(gs, spec, squad, render=False,
                      inp=ScriptedInput({}), rng=random.Random(4), max_ticks=2500)
    check("tutorial: nadie muere jamás", all(s.alive for s in squad))
    check("tutorial: las dianas caen (IA aliada)", res.titans_killed > 0,
          f"kills={res.titans_killed}")


def test_field_combat_scaling():
    rng = random.Random(9)
    s1 = build_field_combat(1, rng)
    s3 = build_field_combat(3, rng)
    check("más peligro = más titanes", len(s3.titans) > len(s1.titans),
          f"{len(s1.titans)} vs {len(s3.titans)}")


def main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        print(f"\n== {t.__name__} ==")
        t()
    print(f"\n{'=' * 40}\nRESULTADO: {PASS} OK, {FAIL} FAIL")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
