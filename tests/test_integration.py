# -*- coding: utf-8 -*-
"""Integración headless: expedición completa, capítulos y render del frame.

Ejecutar:  python -m tests.test_integration
"""
import random
import sys

from aot import missions, ui
from aot.engine import Engine
from aot.keyboard import ScriptedInput
from aot.models import new_game

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [OK]   {name}")
    else:
        FAIL += 1
        print(f"  [FAIL] {name} {extra}")


def silence_ui():
    ui.pause = lambda *a, **k: None
    ui.clear = lambda: None
    missions.select_squad = lambda gs: [s for s in gs.active_roster()][:5]


def test_full_exploration():
    gs = new_game("Integra")
    gs.resources["gas"] = 300
    gs.resources["hojas"] = 30
    rng = random.Random(42)
    day0 = gs.day
    missions.run_exploration(gs, rng, render=False, inp=ScriptedInput({}),
                             max_ticks=1500, tier_key="media", auto_continue=True)
    check("la expedición avanza el calendario", gs.day > day0, f"día {gs.day}")
    check("expedición contabilizada", gs.expeditions == 1)
    check("el estado sigue consistente", gs.resources["gas"] >= 0 and gs.resources["hojas"] >= 0)


def test_chapter_tutorial():
    gs = new_game("Integra2")
    gs.resources["gas"] = 300
    gs.resources["hojas"] = 30
    rng = random.Random(7)
    ok = missions.run_chapter(gs, rng, render=False, inp=ScriptedInput({}), max_ticks=4000)
    check("capítulo 1 (tutorial) se supera con la IA aliada", ok, f"chapter={gs.chapter}")
    check("avanza al capítulo 2", gs.chapter == 2)
    check("tutorial sin bajas", len(gs.fallen) == 0)


def test_chapter_defense_runs():
    gs = new_game("Integra3")
    gs.chapter = 2
    gs.resources["gas"] = 300
    gs.resources["hojas"] = 30
    rng = random.Random(13)
    missions.run_chapter(gs, rng, render=False, inp=ScriptedInput({}), max_ticks=4000)
    check("capítulo 2 (defensa) corre hasta el final sin crashear", True)
    check("el estado queda consistente tras la defensa",
          gs.day >= 2 and gs.resources["gas"] >= 0)


def test_final_requires_tech():
    gs = new_game("Integra4")
    gs.chapter = 5
    ok = missions.run_chapter(gs, random.Random(1), render=False,
                              inp=ScriptedInput({}), max_ticks=10)
    check("el capítulo final exige el Plan de Reconquista", not ok)


def test_render_frame_builds():
    gs = new_game("Render")
    rng = random.Random(3)
    spec = missions.build_defense(gs, rng, story=True)
    squad = gs.active_roster()[:5]
    eng = Engine(gs, spec, squad, ScriptedInput({}), rng=rng, render=False, max_ticks=10)
    frame = eng.build_frame()
    check("build_frame de defensa no crashea", frame is not None)
    spec2 = missions.build_hunt(rng)
    eng2 = Engine(gs, spec2, squad, ScriptedInput({}), rng=rng, render=False, max_ticks=10)
    check("build_frame de cacería no crashea", eng2.build_frame() is not None)
    spec3 = missions.build_escort(rng)
    eng3 = Engine(gs, spec3, squad, ScriptedInput({}), rng=rng, render=False, max_ticks=10)
    import aot.titan_ai as ai
    for _ in range(120):
        if eng3.over:
            break
        eng3.step(ai)
        eng3.build_frame()
    check("escolta: 120 ticks con render por tick", True)
    spec4 = missions.build_final_phase2(rng)
    eng4 = Engine(gs, spec4, squad, ScriptedInput({}), rng=rng, render=False, max_ticks=10)
    for _ in range(120):
        if eng4.over:
            break
        eng4.step(ai)
        eng4.build_frame()
    check("fase final (sellado): 120 ticks con render por tick", True)


def main():
    silence_ui()
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        print(f"\n== {t.__name__} ==")
        t()
    print(f"\n{'=' * 40}\nRESULTADO: {PASS} OK, {FAIL} FAIL")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
