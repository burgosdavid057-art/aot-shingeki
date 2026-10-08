# -*- coding: utf-8 -*-
"""IA de titanes (por tipo) e IA del escuadrón aliado."""
from __future__ import annotations

from . import constants as C
from . import progression as prog


def _step_toward(engine, ex, ey, tx, ty, for_titan: bool):
    """Mejor paso codicioso hacia (tx,ty) esquivando obstáculos."""
    dx = 0 if tx == ex else (1 if tx > ex else -1)
    dy = 0 if ty == ey else (1 if ty > ey else -1)
    candidates = [(dx, dy), (dx, 0), (0, dy),
                  (dx, -dy), (-dx, dy)]
    for cx, cy in candidates:
        if (cx, cy) == (0, 0):
            continue
        nx, ny = ex + cx, ey + cy
        if engine.cell_free(nx, ny, for_titan=for_titan):
            return nx, ny
    return ex, ey


def _step_away(engine, ex, ey, tx, ty, for_titan: bool):
    dx = 0 if tx == ex else (-1 if tx > ex else 1)
    dy = 0 if ty == ey else (-1 if ty > ey else 1)
    for cx, cy in [(dx, dy), (dx, 0), (0, dy)]:
        if (cx, cy) == (0, 0):
            continue
        nx, ny = ex + cx, ey + cy
        if engine.cell_free(nx, ny, for_titan=for_titan):
            return nx, ny
    return ex, ey


# ================================================================ titanes
def _pick_human_target(engine, titan):
    """Humano más cercano; los temerarios atraen más la atención."""
    best, score = None, 1e9
    for u in engine.living_units():
        d = engine.dist(titan.x, titan.y, u.x, u.y)
        if u.soldier.has_trait("temerario"):
            d -= 2
        if d < score:
            best, score = u, d
    return best


def titan_act(engine, titan) -> None:
    if titan.is_dummy or titan.stun_ticks > 0:
        return
    rng = engine.rng
    spec = titan.spec

    # ya tiene a alguien en la mano: se lo lleva a la boca, no camina
    if titan.grabbing is not None:
        return

    # ---------------- elegir objetivo
    target_pos = None
    target_unit = None
    mode = engine.spec.mode

    if mode in ("defense", "final") and titan.kind == "anormal" and engine.spec.gate_pos:
        target_pos = engine.spec.gate_pos           # los anormales van a la puerta
    elif titan.marked and titan.nape_hp <= titan.max_nape // 2:
        # el objetivo de cacería huye al estar herido
        p = engine.player_unit()
        if p is not None:
            tx, ty = p.x, p.y
            if titan.move_cd == 0:
                titan.move_cd = spec["move_cooldown"] * (2 if titan.tendon_cut else 1) // 2 or 1
                nx, ny = _step_away(engine, titan.x, titan.y, tx, ty, True)
                if (nx, ny) != (titan.x, titan.y):
                    titan.facing = (max(-1, min(1, nx - titan.x)),
                                    max(-1, min(1, ny - titan.y)))
                    titan.x, titan.y = nx, ny
            return
    elif titan.targets_cart and engine.cart:
        target_pos = (engine.cart["x"], engine.cart["y"])
    else:
        target_unit = _pick_human_target(engine, titan)
        if target_unit is not None:
            target_pos = (target_unit.x, target_unit.y)
        elif mode in ("defense", "final") and engine.spec.gate_pos:
            target_pos = engine.spec.gate_pos

    if target_pos is None:
        return
    tx, ty = target_pos
    d = engine.dist(titan.x, titan.y, tx, ty)

    # ---------------- atacar a humano adyacente
    if target_unit is not None and d <= 1 and titan.attack_cd == 0:
        titan.attack_cd = spec["attack_cooldown"]
        titan.facing = (max(-1, min(1, tx - titan.x)), max(-1, min(1, ty - titan.y)))
        dodge = target_unit.soldier.agility * 6
        if target_unit.soldier.has_trait("escurridizo"):
            dodge += 18
        if rng.randint(1, 100) <= dodge:
            engine.msg(f"¡{target_unit.name} esquiva el manotazo del {titan.letter}!")
            return
        if rng.random() < spec["grab_chance"] and not engine.spec.no_death:
            engine.start_grab(titan, target_unit)
        else:
            if titan.kind == "grande":
                # barrido: golpea a todos los adyacentes
                for v in list(engine.living_units()):
                    if engine.dist(titan.x, titan.y, v.x, v.y) <= 1:
                        engine.damage_unit(v, spec["damage"], titan)
                engine.msg(f"¡El {titan.letter} barre el suelo con su brazo!")
            else:
                engine.damage_unit(target_unit, spec["damage"], titan)
        return

    # ---------------- salto del anormal
    if (titan.kind == "anormal" and titan.leap_cd == 0
            and 2 < d <= spec.get("leap_range", 4) and not titan.tendon_cut):
        for ddx in (-1, 0, 1):
            for ddy in (-1, 0, 1):
                nx, ny = tx + ddx, ty + ddy
                if engine.cell_free(nx, ny, for_titan=True):
                    titan.x, titan.y = nx, ny
                    titan.leap_cd = spec["leap_cooldown"]
                    titan.facing = (max(-1, min(1, tx - nx)), max(-1, min(1, ty - ny)))
                    engine.msg(f"‼ ¡El Anormal {titan.letter} SALTA hacia su presa!")
                    return

    # ---------------- caminar
    if titan.move_cd == 0:
        cd = spec["move_cooldown"]
        if titan.tendon_cut:
            cd *= 2
        titan.move_cd = cd
        if titan.kind == "anormal" and rng.random() < 0.35:
            # zancada errática
            opts = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0)]
            rng.shuffle(opts)
            for a, b in opts:
                if engine.cell_free(titan.x + a, titan.y + b, for_titan=True):
                    titan.facing = (a, b)
                    titan.x += a
                    titan.y += b
                    return
        nx, ny = _step_toward(engine, titan.x, titan.y, tx, ty, True)
        if (nx, ny) != (titan.x, titan.y):
            titan.facing = (max(-1, min(1, nx - titan.x)), max(-1, min(1, ny - titan.y)))
            titan.x, titan.y = nx, ny


# ================================================================ aliados
def _ally_attack(engine, u, titan) -> None:
    """Ataque de un aliado (decide nuca/frontal solo)."""
    rng = engine.rng
    if not u.blades:
        return
    u.attack_cd = 5
    behind = (u.x, u.y) == titan.back_cell()
    u.wear_blade(rng)
    if behind or titan.is_dummy:
        dmg = 1 + u.soldier.strength // 3 + prog.ally_damage_bonus(engine.gs)
        if u.soldier.has_trait("carnicero"):
            dmg += 1
        if rng.randint(1, 100) <= u.soldier.precision * 5:
            dmg += 2
        engine.damage_titan(titan, dmg, u)
    else:
        dmg = 1 if rng.random() < 0.2 else 0
        engine.damage_titan(titan, dmg, u)
        if titan in engine.titans and rng.random() < 0.3:
            engine.damage_unit(u, titan.spec["damage"], titan)


def ally_act(engine, u) -> None:
    if u.act_cd > 0:
        return
    rng = engine.rng
    u.act_cd = max(2, 4 - u.soldier.agility // 3)

    # agarrado: forcejea solo
    if u.grabbed_by is not None:
        engine.do_struggle(u)
        return

    # pánico: huye del titán más cercano
    if u.panic_ticks > 0:
        t = engine.nearest_titan(u.x, u.y)
        if t is not None:
            u.x, u.y = _step_away(engine, u.x, u.y, t.x, t.y, False)
        return

    player = engine.player_unit()

    # prioridad absoluta: rescatar a un compañero agarrado
    grabber = None
    for t in engine.titans:
        if t.grabbing is not None:
            grabber = t
            break

    # elegir objetivo
    target = grabber
    if target is None:
        if u.order_follow and player is not None:
            t = engine.nearest_titan(u.x, u.y)
            if t is not None and engine.dist(player.x, player.y, t.x, t.y) <= 5:
                target = t
        else:
            target = engine.nearest_titan(u.x, u.y)
            if target is not None and target.is_dummy and engine.spec.mode != "tutorial":
                target = None

    # sin objetivo (o en modo seguir): pegarse al jugador
    if target is None:
        if player is not None and engine.dist(u.x, u.y, player.x, player.y) > 3:
            u.x, u.y = _step_toward(engine, u.x, u.y, player.x, player.y, False)
        return

    # retirada si está al límite (salvo rescates)
    low = (u.hp <= 1 or (u.gas <= 0 and not u.blades))
    if low and target is not grabber:
        u.x, u.y = _step_away(engine, u.x, u.y, target.x, target.y, False)
        return

    d = engine.dist(u.x, u.y, target.x, target.y)
    bx, by = target.back_cell()

    if d <= 1:
        if (u.x, u.y) == (bx, by) or target.is_dummy:
            if u.attack_cd == 0:
                _ally_attack(engine, u, target)
        else:
            # intentar rodear hacia la nuca; si no, atacar de frente a veces
            if engine.cell_free(bx, by) and rng.random() < 0.7:
                u.x, u.y = _step_toward(engine, u.x, u.y, bx, by, False)
            elif u.attack_cd == 0 and rng.random() < 0.5:
                _ally_attack(engine, u, target)
        return

    # acercarse — con gancho ODM si hay distancia y gas (rescates: siempre que puedan)
    hook_cost = prog.hook_cost(engine.gs, u.soldier)
    rush = target is grabber and engine.gs.has_tech("rescate")
    if u.gas >= hook_cost and (rush or (d >= 4 and rng.random() < 0.18)):
        if engine.cell_free(bx, by):
            u.gas -= hook_cost
            u.x, u.y = bx, by
            engine.msg(f"{u.name} se lanza con el equipo ODM.")
            return
    dest = (bx, by) if engine.cell_free(bx, by) else (target.x, target.y)
    u.x, u.y = _step_toward(engine, u.x, u.y, dest[0], dest[1], False)
