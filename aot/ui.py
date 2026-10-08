# -*- coding: utf-8 -*-
"""Helpers de interfaz con rich para los menús (fuera de las misiones)."""
from __future__ import annotations

import sys

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

# Consolas/pipes de Windows en cp1252 no soportan los símbolos del juego.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

console = Console()

TITLE_ART = r"""
   _  _____ _   ___  _   _ ___    _     _    ___  ___
  /_\|_   _/_\ / _ \| | | | __|  /_\   | |  / _ \/ __|
 / _ \ | |/ _ \ (_) | |_| | _|  / _ \  | |_| (_) \__ \
/_/ \_\|_/_/ \_\__\_\\___/|___|/_/ \_\ |____\___/|___/
 _____ ___ _____ _   _  _ ___ ___
|_   _|_ _|_   _/_\ | \| | __/ __|
  | |  | |  | |/ _ \| .` | _|\__ \
  |_| |___| |_/_/ \_\_|\_|___|___/
"""


def clear() -> None:
    console.clear()


def header(text: str, style: str = "bold red") -> None:
    console.print(Panel(Text(text, justify="center", style=style), border_style="red"))


def info(text: str, style: str = "white") -> None:
    console.print(text, style=style)


def warn(text: str) -> None:
    console.print(f"[bold yellow]⚠ {text}[/]")


def good(text: str) -> None:
    console.print(f"[bold green]✔ {text}[/]")


def bad(text: str) -> None:
    console.print(f"[bold red]✖ {text}[/]")


def pause(msg: str = "Pulsa ENTER para continuar...") -> None:
    console.input(f"[dim]{msg}[/]")


def menu(title: str, options: list[str], allow_back: bool = False) -> int:
    """Menú numerado. Devuelve índice elegido, o -1 si 'volver'."""
    console.print()
    if title:
        console.print(f"[bold underline]{title}[/]")
    for i, opt in enumerate(options, 1):
        console.print(f"  [bold cyan]{i}.[/] {opt}")
    if allow_back:
        console.print("  [bold cyan]0.[/] Volver")
    while True:
        raw = console.input("[bold]> [/]").strip().lstrip("﻿")
        if raw.isdigit():
            n = int(raw)
            if allow_back and n == 0:
                return -1
            if 1 <= n <= len(options):
                return n - 1
        console.print("[dim]Opción inválida.[/]")


def ask_text(prompt: str, default: str = "") -> str:
    raw = console.input(f"[bold]{prompt}[/] ").strip()
    return raw or default


def resources_bar(res: dict, wall_hp: int, day: int) -> None:
    t = Table.grid(padding=(0, 2))
    t.add_row(
        f"[bold]Día {day}[/]",
        f"[yellow]⛽ Gas: {res['gas']}[/]",
        f"[bright_white]⚔ Hojas: {res['hojas']} pares[/]",
        f"[green]🍞 Comida: {res['comida']}[/]",
        f"[magenta]★ Mérito: {res['merito']}[/]",
        f"[red]🧱 Muralla: {wall_hp}/100[/]",
    )
    console.print(Panel(t, border_style="dim"))


def soldier_line(s) -> str:
    from . import constants as C
    trait = f" [italic dim]({C.TRAITS[s.trait]['name']})[/]" if s.trait else ""
    tag = " [bold cyan]« TÚ »[/]" if s.is_player else ""
    status = ""
    if s.injured_days > 0:
        status = f" [yellow](herido, {s.injured_days}d)[/]"
    return (
        f"[bold]{s.name}[/]{tag} — {s.rank} niv.{s.level}  "
        f"[red]F{s.strength}[/] [green]A{s.agility}[/] "
        f"[cyan]P{s.precision}[/] [magenta]V{s.courage}[/]  "
        f"☠ {s.kills} kills{trait}{status}"
    )
