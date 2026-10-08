# -*- coding: utf-8 -*-
"""Ataque a los Titanes — juego de acción para terminal.

Ejecutar:  python main.py
Requiere:  Windows + pip install rich
"""
import sys

from aot import hq, save, ui
from aot.models import new_game


def pick_slot(for_load: bool) -> int | None:
    opts = []
    for slot in range(1, save.SLOTS + 1):
        desc = save.slot_summary(slot)
        if desc:
            opts.append(f"Slot {slot}: {desc}")
        else:
            opts.append(f"Slot {slot}: [dim]— vacío —[/]")
    i = ui.menu("Elige un slot", opts, allow_back=True)
    if i == -1:
        return None
    slot = i + 1
    if for_load and save.slot_summary(slot) is None:
        ui.warn("Ese slot está vacío.")
        return None
    return slot


def main() -> None:
    while True:
        ui.clear()
        ui.console.print(ui.TITLE_ART, style="bold red", highlight=False)
        ui.info("[italic dim]   Si no luchas, no puedes ganar.[/]\n")
        i = ui.menu("", ["Nueva partida", "Cargar partida", "Cómo se juega", "Salir"])

        if i == 0:
            slot = pick_slot(for_load=False)
            if slot is None:
                continue
            if save.slot_summary(slot) is not None:
                j = ui.menu("Ese slot tiene una partida. ¿Sobrescribir?", ["No, volver", "Sí, empezar de cero"])
                if j == 0:
                    continue
            nombre = ui.ask_text("Nombre de tu soldado:", default="Aren")
            gs = new_game(nombre)
            save.save_game(gs, slot)
            ui.clear()
            ui.header("AÑO 847 — DISTRITO SUR", "bold red")
            ui.info(
                "\nHace dos años los titanes derribaron la puerta del Muro María.\n"
                "Viste a tu gente convertirse en comida. Hoy vistes el uniforme\n"
                "del Cuerpo de Exploración y unas hojas de acero en las manos.\n\n"
                f"Te llaman {nombre}. Tu escuadrón te espera en el cuartel.\n",
                style="italic",
            )
            ui.pause()
            hq.game_loop(gs, slot)

        elif i == 1:
            slot = pick_slot(for_load=True)
            if slot is None:
                ui.pause()
                continue
            gs = save.load_game(slot)
            if gs is None:
                ui.bad("No se pudo cargar la partida.")
                ui.pause()
                continue
            hq.game_loop(gs, slot)

        elif i == 2:
            ui.clear()
            ui.header("CÓMO SE JUEGA", "bold white")
            ui.info("""
[bold underline]En las misiones (tiempo real):[/]
  [cyan]W A S D[/]      moverte a pie
  [cyan]ESPACIO[/]      impulso ODM en la dirección que miras (gasta gas)
  [cyan]G[/]            gancho al titán más cercano: aterrizas junto a su NUCA (gasta gas)
  [cyan]CLIC IZQ / J[/] atacar con las hojas (gasta filo)
  [cyan]CLIC DER / K[/] cortar tendones: derriba y ralentiza al titán
  [cyan]E[/]            usar: recoger suministros (*), disparar cañones (Ω)
  [cyan]T[/]            orden al escuadrón: «¡A mí!» / «¡Ataquen libres!»
  [cyan]R[/]            cambiar el par de hojas
  [cyan]ESC[/]          pausa / retirarse

[bold underline]La regla de oro:[/] a los titanes solo los mata un corte en la [bold yellow]NUCA[/]
(la celda con [yellow]·[/] a su espalda). De frente solo conseguirás que te coman.
El gancho ([cyan]G[/]) te deja justo ahí. Si un titán te atrapa, [bold]machaca WASD[/].

[bold underline]Cada decisión pesa:[/]
  · El gas y las hojas salen de tu almacén: lo que gastas, no vuelve.
  · Un soldado muerto está muerto PARA SIEMPRE. Su nombre irá al memorial.
  · La muralla acumula daño entre partidas: si llega a 0, fin del juego.
  · Más lejos de la muralla = más botín, más titanes, más tumbas.
""")
            ui.pause()
        else:
            ui.info("\n[italic]«Dedicad vuestros corazones.»[/]\n")
            sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n¡Hasta pronto, soldado!")
