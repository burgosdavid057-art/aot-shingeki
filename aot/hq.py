# -*- coding: utf-8 -*-
"""Cuartel general: bucle de gestión diaria entre misiones."""
from __future__ import annotations

import random

from . import constants as C
from . import missions
from . import progression as prog
from . import ui
from .models import GameState, random_soldier
from .save import save_game


def _check_player_avatar(gs: GameState) -> bool:
    """Si tu personaje murió, eliges continuar como otro soldado. False = fin."""
    if gs.player is not None:
        return True
    vivos = gs.living()
    if not vivos:
        return False
    ui.clear()
    ui.header("TU HISTORIA NO TERMINA AQUÍ", "bold yellow")
    ui.info("Tu personaje ha caído... pero el escuadrón sigue en pie.\n"
            "Otro soldado tomará el relevo y cargará con su legado.\n", style="italic")
    i = ui.menu("¿Quién continuará la historia?", [ui.soldier_line(s) for s in vivos])
    nuevo = vivos[i]
    nuevo.is_player = True
    gs.player_name = nuevo.name
    ui.good(f"{nuevo.name} jura sobre las tumbas continuar la lucha.")
    ui.pause()
    return True


def _game_over(gs: GameState, reason: str) -> None:
    ui.clear()
    ui.header("G A M E   O V E R", "bold red")
    ui.info(reason + "\n", style="bold")
    ui.info(f"Sobreviviste {gs.day} días. Titanes abatidos: {gs.titans_killed}. "
            f"Caídos: {len(gs.fallen)}.")
    _show_memorial(gs, pause_after=False)
    ui.pause()


def _victory(gs: GameState) -> None:
    ui.clear()
    ui.header("¡¡ EL MURO MARÍA HA SIDO RECUPERADO !!", "bold green")
    ui.info(
        "\nLa puerta está sellada. Por primera vez en la historia, la humanidad\n"
        "le ha arrebatado territorio a los titanes.\n\n"
        f"Días de campaña: {gs.day}\n"
        f"Titanes abatidos: {gs.titans_killed}\n"
        f"Expediciones: {gs.expeditions}\n"
        f"Soldados caídos: {len(gs.fallen)}\n",
        style="bold",
    )
    ui.info("Sus nombres no serán olvidados:", style="italic")
    _show_memorial(gs, pause_after=False)
    ui.good("\n¡VICTORIA! Gracias por jugar.")
    ui.pause()


def _show_memorial(gs: GameState, pause_after: bool = True) -> None:
    if not gs.fallen:
        ui.info("[dim]El memorial está vacío. Que siga así mucho tiempo.[/]")
    else:
        ui.info("\n[bold white]═══ MEMORIAL DE LOS CAÍDOS ═══[/]")
        for f in gs.fallen:
            ui.info(f"  [dim]†[/] [bold]{f.name}[/] — nivel {f.level}, {f.kills} titanes — "
                    f"día {f.day} — [italic]{f.cause}[/]")
        ui.info("[italic dim]  «Dedicad vuestros corazones.»[/]")
    if pause_after:
        ui.pause()


def _show_roster(gs: GameState) -> None:
    ui.info("\n[bold underline]Tu tropa:[/]")
    for s in gs.living():
        ui.info("  " + ui.soldier_line(s))
    _show_memorial(gs)


def _train(gs: GameState) -> None:
    if gs.resources["comida"] < C.TRAIN_FOOD_COST:
        ui.bad(f"Entrenar cuesta {C.TRAIN_FOOD_COST} de comida y no te alcanza.")
        ui.pause()
        return
    candidatos = gs.active_roster()
    i = ui.menu("¿A quién entrenas hoy? (cuesta "
                f"{C.TRAIN_FOOD_COST} comida)", [ui.soldier_line(s) for s in candidatos],
                allow_back=True)
    if i == -1:
        return
    s = candidatos[i]
    stats = [("strength", "fuerza"), ("agility", "agilidad"),
             ("precision", "precisión"), ("courage", "valentía")]
    j = ui.menu("¿Qué entrena?", [n for _, n in stats])
    gs.resources["comida"] -= C.TRAIN_FOOD_COST
    attr = stats[j][0]
    setattr(s, attr, getattr(s, attr) + 1)
    s.gain_xp(15)
    ui.good(f"{s.name} entrena {stats[j][1]} hasta el agotamiento (+1).")
    for m in gs.pass_days(1):
        ui.warn(m)
    ui.pause()


def _recruit(gs: GameState, rng: random.Random) -> None:
    if gs.resources["comida"] < C.RECRUIT_FOOD_COST:
        ui.bad(f"Alistar y equipar a un recluta cuesta {C.RECRUIT_FOOD_COST} de comida.")
        ui.pause()
        return
    if len(gs.living()) >= 9:
        ui.warn("El cuartel está lleno (máx. 9 soldados).")
        ui.pause()
        return
    nuevo = random_soldier(rng, elite=gs.day > 25)
    gs.resources["comida"] -= C.RECRUIT_FOOD_COST
    gs.soldiers.append(nuevo)
    ui.good(f"¡{nuevo.name} se une al Cuerpo de Exploración!")
    ui.info("  " + ui.soldier_line(nuevo))
    for m in gs.pass_days(1):
        ui.warn(m)
    ui.pause()


def _rest(gs: GameState) -> None:
    curados = [s.name for s in gs.living() if s.injured_days > 0]
    gs.resources["comida"] += 2      # la cocina del cuartel produce algo
    msgs = gs.pass_days(1)
    ui.good("Día de descanso. Los soldados duermen, comen y afilan hojas (+2 comida).")
    if curados:
        ui.info("Los heridos se recuperan poco a poco: " + ", ".join(curados))
    for m in msgs:
        ui.warn(m)
    ui.pause()


def _forge(gs: GameState) -> None:
    if gs.resources["comida"] < C.FORGE_FOOD_COST:
        ui.bad(f"La forja necesita {C.FORGE_FOOD_COST} de comida para los herreros.")
        ui.pause()
        return
    gs.resources["comida"] -= C.FORGE_FOOD_COST
    gs.resources["hojas"] += 2
    gs.resources["gas"] += 3
    ui.good("La forja trabaja toda la noche: +2 pares de hojas, +3 de gas refinado.")
    for m in gs.pass_days(1):
        ui.warn(m)
    ui.pause()


def _research_menu(gs: GameState) -> None:
    while True:
        ui.clear()
        ui.header("ÁRBOL DE PROGRESIÓN — I+D del Cuerpo de Exploración", "bold magenta")
        ui.info(f"Mérito disponible: [magenta]{gs.resources['merito']}[/]\n")
        branches: dict[str, list[str]] = {}
        for key, t in C.TECH_TREE.items():
            branches.setdefault(t["branch"], []).append(key)
        for branch, keys in branches.items():
            ui.info(f"[bold underline]{branch}[/]")
            for key in keys:
                t = C.TECH_TREE[key]
                if key in gs.techs:
                    estado = "[green]✔ investigada[/]"
                elif t["requires"] and t["requires"] not in gs.techs:
                    estado = f"[dim]🔒 requiere {C.TECH_TREE[t['requires']]['name']}[/]"
                else:
                    estado = f"[magenta]★ {t['cost']}[/]"
                ui.info(f"  {t['name']} — {t['desc']} {estado}")
        disponibles = [k for k in prog.available_techs(gs)
                       if gs.resources["merito"] >= C.TECH_TREE[k]["cost"]]
        if not disponibles:
            ui.info("\n[dim]Nada investigable ahora mismo (falta mérito o prerrequisitos).[/]")
            ui.pause()
            return
        i = ui.menu("¿Qué investigamos?",
                    [f"{C.TECH_TREE[k]['name']} (★{C.TECH_TREE[k]['cost']})" for k in disponibles],
                    allow_back=True)
        if i == -1:
            return
        ok, msg = prog.research(gs, disponibles[i])
        (ui.good if ok else ui.bad)(msg)
        ui.pause()


def game_loop(gs: GameState, slot: int) -> None:
    """Bucle principal de la partida. Sale al menú principal al terminar."""
    rng = random.Random()
    while True:
        # ---------- condiciones de fin
        if gs.victory:
            _victory(gs)
            return
        if gs.wall_hp <= 0:
            _game_over(gs, "La muralla ha caído. Los titanes entran al distrito\n"
                           "y la campana de la torre suena por última vez.")
            return
        if not gs.living():
            _game_over(gs, "No queda nadie de tu brigada. El Cuerpo de Exploración\n"
                           "borra su número de los registros.")
            return
        if not _check_player_avatar(gs):
            _game_over(gs, "No queda nadie de tu brigada.")
            return

        # ---------- pantalla del cuartel
        ui.clear()
        ui.header("CUARTEL DEL CUERPO DE EXPLORACIÓN", "bold green")
        ui.resources_bar(gs.resources, gs.wall_hp, gs.day)
        if gs.wall_alert_active:
            ui.warn("¡¡TITANES EN LA MURALLA!! La guarnición pide refuerzos YA.")
        cap = C.CHAPTERS[gs.chapter - 1] if gs.chapter <= len(C.CHAPTERS) else None

        opciones = []
        acciones = []
        if gs.wall_alert_active:
            opciones.append("[bold red]¡DEFENDER LA MURALLA![/]")
            acciones.append("defensa")
            opciones.append("[dim]Ignorar la alerta (la muralla sufrirá)[/]")
            acciones.append("ignorar")
        else:
            if cap:
                opciones.append(f"[bold red]HISTORIA — Capítulo {cap['id']}: {cap['title']}[/]")
                acciones.append("capitulo")
            opciones.append("Salir de expedición (gas, botín, mérito)")
            acciones.append("explorar")
        opciones += [
            "Entrenar a un soldado (1 día)",
            "Reclutar (1 día)",
            "Forja y refinería (1 día)",
            "Descansar (1 día)",
            "Árbol de progresión (I+D)",
            "Ver tropa y memorial",
            "Guardar partida",
            "Salir al menú principal",
        ]
        acciones += ["entrenar", "reclutar", "forja", "descansar",
                     "arbol", "tropa", "guardar", "salir"]

        i = ui.menu(f"¿Qué ordenas, {gs.player_name}?", opciones)
        accion = acciones[i]

        if accion == "defensa":
            missions.run_wall_defense(gs, rng)
            save_game(gs, slot)
        elif accion == "ignorar":
            ui.warn(missions.ignore_wall_alert(gs, rng))
            ui.pause()
            save_game(gs, slot)
        elif accion == "capitulo":
            missions.run_chapter(gs, rng)
            save_game(gs, slot)
        elif accion == "explorar":
            missions.run_exploration(gs, rng)
            save_game(gs, slot)
        elif accion == "entrenar":
            _train(gs)
        elif accion == "reclutar":
            _recruit(gs, rng)
        elif accion == "forja":
            _forge(gs)
        elif accion == "descansar":
            _rest(gs)
        elif accion == "arbol":
            _research_menu(gs)
        elif accion == "tropa":
            _show_roster(gs)
        elif accion == "guardar":
            path = save_game(gs, slot)
            ui.good(f"Partida guardada en el slot {slot}.")
            ui.pause()
        elif accion == "salir":
            save_game(gs, slot)
            ui.good("Partida guardada automáticamente. ¡Hasta pronto, soldado!")
            return
