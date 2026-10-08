# -*- coding: utf-8 -*-
"""Motor de acción en tiempo real: mapa, render, ODM, combate, agarres."""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field

from rich.console import Group
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

from . import constants as C
from . import progression as prog
from .models import GameState, Soldier
from .ui import console

TITAN_LETTERS = "ABDEFGHJKLMNPQRSTUVWXYZ"

DIRS = {"w": (0, -1), "s": (0, 1), "a": (-1, 0), "d": (1, 0)}
ARROWS = {(0, -1): "↑", (0, 1): "↓", (-1, 0): "←", (1, 0): "→"}


# ================================================================ entidades
@dataclass
class Unit:
    soldier: Soldier
    x: int
    y: int
    symbol: str
    gas: int
    blades: list = field(default_factory=list)   # filo restante por par
    hp: int = C.BASE_HP
    facing: tuple = (0, -1)
    walk_cd: int = 0
    attack_cd: int = 0
    hit_cd: int = 0
    act_cd: int = 0
    panic_ticks: int = 0
    grabbed_by: object = None
    struggle: int = 0
    grab_ticks: int = 0
    downed: bool = False
    eaten: bool = False
    kills: int = 0
    order_follow: bool = False
    pairs_broken: int = 0

    @property
    def is_player(self) -> bool:
        return self.soldier.is_player

    @property
    def name(self) -> str:
        return self.soldier.name

    def current_edge(self) -> int:
        return self.blades[0] if self.blades else 0

    def wear_blade(self, rng: random.Random) -> None:
        if not self.blades:
            return
        if self.soldier.has_trait("ahorrador") and rng.random() < 0.5:
            return
        self.blades[0] -= 1
        if self.blades[0] <= 0:
            self.blades.pop(0)
            self.pairs_broken += 1


@dataclass
class Titan:
    kind: str
    height: int
    nape_hp: int
    max_nape: int
    x: int
    y: int
    letter: str
    facing: tuple = (0, 1)
    move_cd: int = 0
    attack_cd: int = 0
    stun_ticks: int = 0
    tendon_cut: bool = False
    leap_cd: int = 0
    grabbing: Unit | None = None
    marked: bool = False          # objetivo de cacería
    targets_cart: bool = False
    is_dummy: bool = False

    @property
    def spec(self) -> dict:
        return C.TITAN_TYPES[self.kind]

    @property
    def name(self) -> str:
        if self.is_dummy:
            return "Diana de madera"
        n = f"{self.spec['name']} ({self.height} m)"
        return f"{n} [OBJETIVO]" if self.marked else n

    def back_cell(self) -> tuple:
        return (self.x - self.facing[0], self.y - self.facing[1])


# ================================================================ misión
@dataclass
class MissionSpec:
    name: str
    mode: str                      # tutorial / exterminate / defense / escort / hunt / final
    grid: list                     # list[list[str]]
    player_spawn: tuple = (2, 2)
    ally_spawns: list = field(default_factory=list)
    titans: list = field(default_factory=list)     # [(kind, x, y, extra_dict)]
    waves: list = field(default_factory=list)      # defensa: [[(kind,x,y)],...]
    gate_pos: tuple | None = None
    gate_hp: int = 0
    cart_start: tuple | None = None
    cart_hp: int = 0
    objective_text: str = ""
    no_death: bool = False
    seal_target: int = 0           # final: progreso de sellado necesario


@dataclass
class MissionResult:
    success: bool = False
    retreat: bool = False
    aborted_by_player_down: bool = False
    titans_killed: int = 0
    kills: dict = field(default_factory=dict)        # nombre -> kills
    downed: list = field(default_factory=list)       # [(Soldier, eaten:bool)]
    gas_left: dict = field(default_factory=dict)     # nombre -> gas restante
    pairs_left: dict = field(default_factory=dict)   # nombre -> pares intactos
    loot: dict = field(default_factory=dict)         # recurso -> cantidad
    gate_hp: int = 0
    summary: list = field(default_factory=list)


# ================================================================ motor
class Engine:
    def __init__(self, gs: GameState, spec: MissionSpec, squad: list[Soldier],
                 inp, rng: random.Random | None = None, render: bool = True,
                 max_ticks: int = 0) -> None:
        self.gs = gs
        self.spec = spec
        self.inp = inp
        self.rng = rng or random.Random()
        self.render_enabled = render
        self.max_ticks = max_ticks          # 0 = sin límite (tests usan límite)
        self.tick = 0
        self.messages: list[str] = []
        self.result = MissionResult()
        self.over = False
        self.paused = False

        self.grid = [row[:] for row in spec.grid]
        self.h = len(self.grid)
        self.w = len(self.grid[0])

        # --- escuadrón
        self.units: list[Unit] = []
        gas_cap = prog.max_gas(gs)
        pairs = prog.blade_pairs(gs)
        edge = prog.blade_edge(gs)
        spawns = [spec.player_spawn] + list(spec.ally_spawns)
        for i, s in enumerate(squad):
            pos = spawns[i] if i < len(spawns) else spawns[-1]
            sym = "@" if s.is_player else str(i)
            self.units.append(Unit(
                soldier=s, x=pos[0], y=pos[1], symbol=sym,
                gas=gas_cap, blades=[edge] * pairs,
            ))

        # --- titanes iniciales
        self.titans: list[Titan] = []
        self._letter_idx = 0
        for t in spec.titans:
            kind, x, y = t[0], t[1], t[2]
            extra = t[3] if len(t) > 3 else {}
            self.spawn_titan(kind, x, y, **extra)

        # --- estado de modo
        self.gate_hp = spec.gate_hp
        self.wave_idx = 0
        self.cart = None
        if spec.cart_start:
            self.cart = {"x": spec.cart_start[0], "y": spec.cart_start[1],
                         "hp": spec.cart_hp, "cd": 0}
        self.seal_progress = 0

        self.msg("¡Misión iniciada! " + spec.objective_text)

    # ------------------------------------------------------------ utilidades
    def msg(self, text: str) -> None:
        self.messages.append(text)
        if len(self.messages) > 60:
            self.messages = self.messages[-60:]

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.w and 0 <= y < self.h

    def tile(self, x: int, y: int) -> str:
        return self.grid[y][x]

    def passable(self, x: int, y: int, for_titan: bool = False) -> bool:
        if not self.in_bounds(x, y):
            return False
        t = self.grid[y][x]
        if t in (C.TILE_WALL, C.TILE_GATE, C.TILE_BIGTREE, C.TILE_HOUSE):
            return False
        if t == C.TILE_CANNON:
            return not for_titan
        if self.cart and (x, y) == (self.cart["x"], self.cart["y"]):
            return False
        return True

    def unit_at(self, x: int, y: int) -> Unit | None:
        for u in self.units:
            if not u.downed and (u.x, u.y) == (x, y):
                return u
        return None

    def titan_at(self, x: int, y: int) -> Titan | None:
        for t in self.titans:
            if (t.x, t.y) == (x, y):
                return t
        return None

    def cell_free(self, x: int, y: int, for_titan: bool = False) -> bool:
        return (self.passable(x, y, for_titan)
                and self.unit_at(x, y) is None
                and self.titan_at(x, y) is None)

    @staticmethod
    def dist(ax, ay, bx, by) -> int:
        return max(abs(ax - bx), abs(ay - by))

    def living_units(self) -> list[Unit]:
        return [u for u in self.units if not u.downed]

    def player_unit(self) -> Unit | None:
        for u in self.units:
            if u.is_player and not u.downed:
                return u
        return None

    def nearest_titan(self, x: int, y: int, max_d: int = 999) -> Titan | None:
        best, bd = None, max_d + 1
        for t in self.titans:
            d = self.dist(x, y, t.x, t.y)
            if d < bd:
                best, bd = t, d
        return best

    def adjacent_titans(self, u: Unit) -> list[Titan]:
        return [t for t in self.titans if self.dist(u.x, u.y, t.x, t.y) <= 1]

    # ------------------------------------------------------------ spawns
    def spawn_titan(self, kind: str, x: int, y: int, marked: bool = False,
                    targets_cart: bool = False, dummy: bool = False,
                    height: int | None = None) -> Titan:
        spec = C.TITAN_TYPES.get(kind, C.TITAN_TYPES["puro"])
        h = height or self.rng.randint(*spec["heights"])
        hp = self.rng.randint(*spec["nape_hp"])
        if dummy:
            hp = 2
        letter = TITAN_LETTERS[self._letter_idx % len(TITAN_LETTERS)]
        self._letter_idx += 1
        t = Titan(kind=kind, height=h, nape_hp=hp, max_nape=hp, x=x, y=y,
                  letter=letter, marked=marked, targets_cart=targets_cart,
                  is_dummy=dummy)
        self.titans.append(t)
        return t

    # ------------------------------------------------------------ daño
    def damage_titan(self, titan: Titan, dmg: int, attacker: Unit | None) -> None:
        titan.nape_hp -= dmg
        if titan.grabbing is not None and dmg > 0:
            victim = titan.grabbing
            self.release_grab(titan)
            self.msg(f"¡{attacker.name if attacker else 'Alguien'} libera a {victim.name}!")
        if titan.nape_hp <= 0:
            self.kill_titan(titan, attacker)

    def kill_titan(self, titan: Titan, attacker: Unit | None) -> None:
        if titan in self.titans:
            self.titans.remove(titan)
        if titan.grabbing is not None:
            self.release_grab(titan)
        self.result.titans_killed += 1
        if attacker is not None:
            attacker.kills += 1
            self.result.kills[attacker.name] = self.result.kills.get(attacker.name, 0) + 1
        if titan.is_dummy:
            self.msg(f"Diana {titan.letter} destrozada. ¡Buen corte!")
        else:
            who = attacker.name if attacker else "El cañón"
            self.msg(f"☠ ¡{who} derriba al {titan.name}! Vapor por todas partes.")

    def damage_unit(self, u: Unit, dmg: int, source: Titan) -> None:
        if u.hit_cd > 0 or self.spec.no_death:
            return
        u.hp -= dmg
        u.hit_cd = 8
        # retroceso
        kx, ky = u.x + (u.x - source.x), u.y + (u.y - source.y)
        if self.cell_free(kx, ky):
            u.x, u.y = kx, ky
        if u.hp <= 0:
            self.down_unit(u, eaten=False)
        else:
            self.msg(f"¡{source.name} golpea a {u.name}! ({u.hp} HP)")

    def down_unit(self, u: Unit, eaten: bool) -> None:
        if u.downed:
            return
        u.downed = True
        u.eaten = eaten
        if u.grabbed_by is not None:
            grabber = u.grabbed_by
            grabber.grabbing = None
            u.grabbed_by = None
        self.result.downed.append((u.soldier, eaten))
        if eaten:
            self.msg(f"✖✖ {u.name} es DEVORADO. No queda nada que enterrar.")
        else:
            self.msg(f"✖ {u.name} cae gravemente herido y es evacuado.")
        # pánico en aliados cercanos
        for other in self.living_units():
            if other.is_player or other is u:
                continue
            if self.dist(other.x, other.y, u.x, u.y) <= 6:
                if other.soldier.has_trait("veterano"):
                    continue
                roll = self.rng.randint(1, 100)
                if roll > other.soldier.courage * 10 + 25:
                    other.panic_ticks = 25
                    self.msg(f"¡{other.name} entra en pánico!")
        if u.is_player:
            self.result.aborted_by_player_down = True
            self.finish(False, "Has caído. El escuadrón se retira arrastrando tu cuerpo.")

    # ------------------------------------------------------------ agarres
    def start_grab(self, titan: Titan, u: Unit) -> None:
        if titan.grabbing is not None or u.grabbed_by is not None:
            return
        u.grabbed_by = titan
        u.struggle = 0
        u.grab_ticks = 0
        titan.grabbing = u
        if u.is_player:
            self.msg(f"‼ ¡El {titan.name} TE ATRAPA! ¡Machaca WASD para forcejear!")
        else:
            self.msg(f"‼ ¡El {titan.name} atrapa a {u.name}! ¡Sálvalo!")

    def release_grab(self, titan: Titan) -> None:
        u = titan.grabbing
        if u is None:
            return
        titan.grabbing = None
        u.grabbed_by = None
        u.struggle = 0
        u.grab_ticks = 0
        # caer a una celda libre junto al titán
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if self.cell_free(u.x + dx, u.y + dy):
                    u.x += dx
                    u.y += dy
                    return

    def update_grabs(self) -> None:
        for t in list(self.titans):
            u = t.grabbing
            if u is None:
                continue
            u.grab_ticks += 1
            u.x, u.y = t.x, t.y    # va en la mano del titán
            if u.grab_ticks >= C.GRAB_TIMEOUT_TICKS:
                t.grabbing = None
                u.grabbed_by = None
                self.down_unit(u, eaten=True)

    def struggle_needed(self) -> int:
        return 12

    def do_struggle(self, u: Unit) -> None:
        if u.grabbed_by is None:
            return
        gain = 1 + u.soldier.strength // 2 + prog.struggle_bonus(self.gs)
        u.struggle += gain
        if u.struggle >= self.struggle_needed():
            self.release_grab(u.grabbed_by)
            self.msg(f"¡{u.name} se zafa del agarre con pura fuerza!")

    # ------------------------------------------------------------ acciones del jugador
    def player_move(self, u: Unit, dx: int, dy: int) -> None:
        u.facing = (dx, dy)
        if u.walk_cd > 0:
            return
        nx, ny = u.x + dx, u.y + dy
        if self.cell_free(nx, ny):
            u.x, u.y = nx, ny
            u.walk_cd = C.WALK_COOLDOWN
        else:
            self.try_pickup(u, nx, ny)

    def player_dash(self, u: Unit) -> None:
        cost = prog.dash_cost(self.gs)
        if u.gas < cost:
            self.msg("¡Clic vacío! No queda gas para el impulso.")
            return
        dx, dy = u.facing
        moved = 0
        for _ in range(prog.dash_range(self.gs)):
            nx, ny = u.x + dx, u.y + dy
            if not self.cell_free(nx, ny):
                break
            u.x, u.y = nx, ny
            moved += 1
        if moved == 0:
            self.msg("No hay espacio para impulsarte ahí.")
            return
        u.gas -= cost
        if u.gas <= 3:
            self.msg(f"⚠ Gas crítico: {u.gas}")

    def player_hook(self, u: Unit) -> None:
        cost = prog.hook_cost(self.gs, u.soldier)
        if u.gas < cost:
            self.msg("Sin gas suficiente para el gancho.")
            return
        target = self.nearest_titan(u.x, u.y, prog.hook_range(self.gs))
        if target is None:
            self.msg("Ningún titán al alcance del gancho.")
            return
        # aterrizar en su celda trasera (la nuca) o en cualquier adyacente libre
        bx, by = target.back_cell()
        landing = None
        if self.cell_free(bx, by):
            landing = (bx, by)
        else:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if (dx, dy) != (0, 0) and self.cell_free(target.x + dx, target.y + dy):
                        landing = (target.x + dx, target.y + dy)
                        break
                if landing:
                    break
        if landing is None:
            self.msg("No hay dónde aterrizar junto a ese titán.")
            return
        u.gas -= cost
        u.x, u.y = landing
        u.facing = (max(-1, min(1, target.x - u.x)), max(-1, min(1, target.y - u.y)))
        if (u.x, u.y) == (bx, by):
            self.msg(f"¡Gancho perfecto! Estás sobre la nuca del {target.letter}.")
        else:
            self.msg(f"Gancho lanzado: aterrizas junto al titán {target.letter}.")

    def player_attack(self, u: Unit) -> None:
        if u.attack_cd > 0:
            return
        u.attack_cd = 3
        targets = self.adjacent_titans(u)
        if not targets:
            self.msg("Cortas el aire. Nada al alcance de las hojas.")
            return
        if not u.blades:
            self.msg("¡No te quedan hojas! Solo te queda correr.")
            return
        # prioridad: titán cuya nuca esté bajo tus pies
        target = None
        for t in targets:
            if (u.x, u.y) == t.back_cell():
                target = t
                break
        behind = target is not None
        if target is None:
            target = min(targets, key=lambda t: self.dist(u.x, u.y, t.x, t.y))
        u.wear_blade(self.rng)
        if behind or target.is_dummy:
            dmg = 1 + u.soldier.strength // 3
            if u.soldier.has_trait("carnicero") or u.soldier.has_trait("temerario"):
                dmg += 1
            if self.rng.randint(1, 100) <= u.soldier.precision * 6:
                dmg += 2
                self.msg("¡CORTE PROFUNDO!")
            self.damage_titan(target, dmg, u)
            if target in self.titans:
                self.msg(f"Tajo a la nuca del {target.letter}: {target.nape_hp}/{target.max_nape}")
        else:
            # ataque frontal: casi inútil y peligroso
            dmg = 1 if self.rng.random() < 0.25 else 0
            self.damage_titan(target, dmg, u)
            if target in self.titans:
                target.facing = (max(-1, min(1, u.x - target.x)),
                                 max(-1, min(1, u.y - target.y)))
                self.msg(f"Golpeas la carne del {target.letter}... la nuca está DETRÁS.")
                dodge = u.soldier.agility * 7 + (20 if u.soldier.has_trait("escurridizo") else 0)
                if self.rng.randint(1, 100) > dodge + 30:
                    self.damage_unit(u, target.spec["damage"], target)

    def player_tendon(self, u: Unit) -> None:
        if u.attack_cd > 0:
            return
        u.attack_cd = 4
        targets = [t for t in self.adjacent_titans(u) if not t.is_dummy]
        if not targets:
            self.msg("Nada que tajear por aquí.")
            return
        if not u.blades:
            self.msg("Sin hojas no hay tendones que cortar.")
            return
        target = targets[0]
        u.wear_blade(self.rng)
        if not target.tendon_cut:
            target.tendon_cut = True
            target.stun_ticks = 10
            self.msg(f"¡Tendones cortados! El {target.letter} se desploma y quedará lento.")
        else:
            target.stun_ticks = 8
            self.msg(f"El {target.letter} vuelve a desplomarse.")

    def try_pickup(self, u: Unit, x: int | None = None, y: int | None = None) -> None:
        x = u.x if x is None else x
        y = u.y if y is None else y
        if not self.in_bounds(x, y):
            return
        if self.tile(x, y) == C.TILE_SUPPLY:
            self.grid[y][x] = C.TILE_FLOOR
            roll = self.rng.random()
            if roll < 0.45:
                u.gas = min(u.gas + 5, prog.max_gas(self.gs) + 6)
                self.result.loot["gas"] = self.result.loot.get("gas", 0) + 3
                self.msg(f"{u.name} recarga gas de un depósito abandonado (+5).")
            elif roll < 0.75:
                u.blades.append(prog.blade_edge(self.gs))
                self.result.loot["hojas"] = self.result.loot.get("hojas", 0) + 1
                self.msg(f"{u.name} recoge un par de hojas de repuesto.")
            else:
                amt = self.rng.randint(2, 5)
                self.result.loot["comida"] = self.result.loot.get("comida", 0) + amt
                self.msg(f"{u.name} encuentra provisiones (+{amt} comida).")

    def player_interact(self, u: Unit) -> None:
        # 1) suministro bajo los pies o adyacente
        for dx in (0, -1, 1):
            for dy in (0, -1, 1):
                x, y = u.x + dx, u.y + dy
                if self.in_bounds(x, y) and self.tile(x, y) == C.TILE_SUPPLY:
                    self.try_pickup(u, x, y)
                    return
        # 2) cañón adyacente
        for dx in (0, -1, 1):
            for dy in (0, -1, 1):
                x, y = u.x + dx, u.y + dy
                if self.in_bounds(x, y) and self.tile(x, y) == C.TILE_CANNON:
                    self.fire_cannon(u, x, y)
                    return
        self.msg("No hay nada que usar aquí.")

    def fire_cannon(self, u: Unit, cx: int, cy: int) -> None:
        if u.attack_cd > 0:
            return
        u.attack_cd = 12
        # alcanza titanes en la misma columna (±1), hacia el norte
        best = None
        for t in self.titans:
            if abs(t.x - cx) <= 1 and t.y < cy and cy - t.y <= 11:
                if best is None or t.y > best.y:
                    best = t
        if best is None:
            self.msg("¡BUM! El cañonazo no alcanza a ningún titán.")
            return
        best.stun_ticks = max(best.stun_ticks, 14)
        self.msg(f"¡BUM! El cañón impacta al {best.letter} y lo derriba.")
        self.damage_titan(best, 2, u)

    # ------------------------------------------------------------ input
    def handle_input(self) -> None:
        events = self.inp.poll()
        u = self.player_unit()
        for ev in events:
            kind = ev[0]
            if kind == "key" and ev[1] == "ESC":
                self.pause_menu()
                continue
            if u is None:
                continue
            if u.grabbed_by is not None:
                if kind == "key" and ev[1] in DIRS:
                    self.do_struggle(u)
                continue
            if kind == "key":
                k = ev[1]
                if k in DIRS:
                    self.player_move(u, *DIRS[k])
                elif k == "SPACE":
                    self.player_dash(u)
                elif k == "g":
                    self.player_hook(u)
                elif k == "j":
                    self.player_attack(u)
                elif k == "k":
                    self.player_tendon(u)
                elif k == "e":
                    self.player_interact(u)
                elif k == "r":
                    if len(u.blades) > 1:
                        u.blades.append(u.blades.pop(0))
                        self.msg("Cambias al siguiente par de hojas.")
                elif k == "t":
                    follow = not all(a.order_follow for a in self.units if not a.is_player)
                    for a in self.units:
                        if not a.is_player:
                            a.order_follow = follow
                    self.msg("Orden: «¡A mí!»" if follow else "Orden: «¡Ataquen libres!»")
            elif kind == "mouse_left":
                self.player_attack(u)
            elif kind == "mouse_right":
                self.player_tendon(u)

    # ------------------------------------------------------------ pausa
    def pause_menu(self) -> None:
        if not self.render_enabled:
            self.finish(False, "Misión abandonada.", retreat=True)
            return
        self.paused = True

    # ------------------------------------------------------------ modo: defensa
    def update_defense(self) -> None:
        if self.spec.mode not in ("defense", "final"):
            return
        # titanes adyacentes a la puerta la dañan
        if self.spec.gate_pos:
            gx, gy = self.spec.gate_pos
            for t in self.titans:
                if t.stun_ticks > 0 or t.is_dummy:
                    continue
                if self.dist(t.x, t.y, gx, gy) <= 1 and t.attack_cd == 0:
                    t.attack_cd = t.spec["attack_cooldown"]
                    dmg = 2 if t.kind == "grande" else 1
                    self.gate_hp -= dmg
                    self.msg(f"¡El {t.letter} GOLPEA LA PUERTA! ({max(0, self.gate_hp)} HP)")
                    if self.gate_hp <= 0:
                        self.finish(False, "La puerta ha caído. El distrito está perdido.")
                        return
        # oleadas
        if not self.titans and self.wave_idx < len(self.spec.waves):
            wave = self.spec.waves[self.wave_idx]
            self.wave_idx += 1
            self.msg(f"— OLEADA {self.wave_idx + (0 if self.spec.mode == 'defense' else 1)} — "
                     f"¡{len(wave)} titanes a la vista!")
            for kind, x, y in wave:
                extra = {"targets_cart": False}
                self.spawn_titan(kind, x, y, **extra)
            # reabastecimiento parcial entre oleadas
            for un in self.living_units():
                un.gas = min(un.gas + 4, prog.max_gas(self.gs))
            self.msg("Reabastecimiento rápido: +4 de gas para todos.")

    # ------------------------------------------------------------ modo: escolta
    def update_cart(self) -> None:
        if not self.cart:
            return
        cart = self.cart
        # titanes adyacentes atacan la carreta
        for t in self.titans:
            if t.stun_ticks > 0:
                continue
            if self.dist(t.x, t.y, cart["x"], cart["y"]) <= 1 and t.attack_cd == 0:
                t.attack_cd = t.spec["attack_cooldown"]
                cart["hp"] -= 1
                self.msg(f"¡El {t.letter} destroza la carreta! ({max(0, cart['hp'])} HP)")
                if cart["hp"] <= 0:
                    self.finish(False, "La carreta quedó hecha astillas. Misión fracasada.")
                    return
        # avanza si no hay titanes pegados
        cart["cd"] -= 1
        if cart["cd"] <= 0:
            danger = any(self.dist(t.x, t.y, cart["x"], cart["y"]) <= 2 for t in self.titans)
            if not danger:
                nx = cart["x"] + 1
                if self.in_bounds(nx, cart["y"]) and self.cell_free(nx, cart["y"]):
                    cart["x"] = nx
            cart["cd"] = 7
        if cart["x"] >= self.w - 2:
            self.finish(True, "¡La carreta cruza a salvo! Las familias comerán este invierno.")

    # ------------------------------------------------------------ modo: final (sellado)
    def update_seal(self) -> None:
        if self.spec.mode != "final" or self.spec.seal_target == 0:
            return
        if self.wave_idx < len(self.spec.waves) or self.titans:
            pass
        gx, gy = self.spec.gate_pos
        danger = any(self.dist(t.x, t.y, gx, gy) <= 3 for t in self.titans)
        if not danger and self.tick % 2 == 0:
            self.seal_progress += 1
            if self.seal_progress >= self.spec.seal_target:
                self.finish(True, "¡LA PUERTA ESTÁ SELLADA! El Muro María vuelve a ser nuestro.")

    # ------------------------------------------------------------ objetivos
    def check_objectives(self) -> None:
        if self.over:
            return
        mode = self.spec.mode
        if mode in ("tutorial", "exterminate", "hunt"):
            if mode == "hunt":
                if not any(t.marked for t in self.titans):
                    self.finish(True, "El Anormal ha caído. Los escuadrones serán vengados.")
                    return
            if not self.titans and not self.spec.waves[self.wave_idx:]:
                texto = ("Entrenamiento completado. El instructor asiente en silencio."
                         if mode == "tutorial" else
                         "Zona despejada. Ni un titán en pie.")
                self.finish(True, texto)
                return
        if mode == "defense":
            if self.wave_idx >= len(self.spec.waves) and not self.titans:
                self.finish(True, "¡Todas las oleadas repelidas! La puerta resiste.")
                return
        if mode == "final" and self.spec.seal_target == 0:
            if self.wave_idx >= len(self.spec.waves) and not self.titans:
                self.finish(True, "Zona de brecha despejada.")
                return
        # derrota: nadie en pie
        if not self.living_units():
            self.finish(False, "No queda nadie en pie. La misión es un desastre.")

    def finish(self, success: bool, text: str, retreat: bool = False) -> None:
        if self.over:
            return
        self.over = True
        self.result.success = success
        self.result.retreat = retreat
        self.result.gate_hp = self.gate_hp
        self.result.summary.append(text)
        self.msg(text)
        # devolver gas/hojas restantes
        for u in self.units:
            if not u.downed:
                self.result.gas_left[u.name] = u.gas
                self.result.pairs_left[u.name] = len(u.blades)

    # ------------------------------------------------------------ render
    def build_frame(self):
        p = self.player_unit()
        px = p.x if p else self.w // 2
        py = p.y if p else self.h // 2
        vw, vh = min(C.VIEW_W, self.w), min(C.VIEW_H, self.h)
        cx = max(0, min(px - vw // 2, self.w - vw))
        cy = max(0, min(py - vh // 2, self.h - vh))

        # --- overlay de entidades
        overlay: dict[tuple, tuple] = {}
        if self.cart:
            overlay[(self.cart["x"], self.cart["y"])] = (C.TILE_CART, "bold yellow")
        for t in self.titans:
            if t.is_dummy:
                overlay[(t.x, t.y)] = (C.TILE_DUMMY, "bold yellow")
                continue
            style = f"bold {t.spec['color']}"
            if t.marked:
                style = "bold black on yellow"
            elif t.stun_ticks > 0:
                style = "dim " + t.spec["color"]
            overlay[(t.x, t.y)] = (t.letter, style)
            bx, by = t.back_cell()
            if (bx, by) not in overlay and self.in_bounds(bx, by):
                overlay[(bx, by)] = ("·", "yellow")     # marca de la nuca
        for u in self.living_units():
            if u.grabbed_by is not None:
                overlay[(u.x, u.y)] = ("&", "bold black on red")
            else:
                style = "bold bright_cyan" if u.is_player else "bold cyan"
                if u.panic_ticks > 0:
                    style = "bold yellow"
                overlay[(u.x, u.y)] = (u.symbol, style)

        tile_styles = {
            C.TILE_FLOOR: "grey30", C.TILE_TREE: "green", C.TILE_BIGTREE: "bold green",
            C.TILE_HOUSE: "tan", C.TILE_WALL: "white", C.TILE_GATE: "bold red",
            C.TILE_SUPPLY: "bold bright_yellow", C.TILE_CANNON: "bold bright_white",
        }
        rows = []
        for y in range(cy, cy + vh):
            line = Text()
            for x in range(cx, cx + vw):
                if (x, y) in overlay:
                    ch, st = overlay[(x, y)]
                else:
                    ch = self.grid[y][x]
                    st = tile_styles.get(ch, "white")
                line.append(ch, style=st)
            rows.append(line)
        mapa = Panel(Group(*rows), title=f"[bold red]{self.spec.name}[/]",
                     subtitle=self._hud_objective(), border_style="red", padding=0)

        # --- HUD inferior
        hud = Text()
        if p:
            hearts = "♥" * p.hp + "·" * max(0, C.BASE_HP - p.hp)
            gas_max = prog.max_gas(self.gs)
            filled = int(round((p.gas / max(1, gas_max)) * 10))
            gasbar = "█" * filled + "░" * (10 - filled)
            edge = p.current_edge()
            hud.append(f" HP {hearts}  ", style="bold red")
            hud.append(f"GAS [{gasbar}] {p.gas}  ", style="bold yellow")
            hud.append(f"HOJAS {len(p.blades)} pares (filo {edge})  ", style="bold white")
            near = self.adjacent_titans(p)
            if any((p.x, p.y) == t.back_cell() for t in near):
                hud.append("¡NUCA EXPUESTA! ", style="bold black on yellow")
            if p.grabbed_by is not None:
                hud.append(f"¡FORCEJEA! {p.struggle}/{self.struggle_needed()} ",
                           style="bold white on red")
        squad = Text()
        for u in self.units:
            if u.is_player:
                continue
            if u.downed:
                squad.append(f" {u.symbol}:{u.name.split()[0]} ✖ ", style="dim red")
            else:
                squad.append(f" {u.symbol}:{u.name.split()[0]} {'♥' * u.hp} g{u.gas} ",
                             style="cyan" if u.panic_ticks == 0 else "yellow")
        titanes = Text()
        for t in self.titans[:6]:
            arrow = ARROWS.get(t.facing, "?")
            st = t.spec["color"] if not t.is_dummy else "yellow"
            titanes.append(f" {t.letter}:{t.height}m {arrow} {t.nape_hp}♦ ", style=st)
        msgs = Group(*[Text(m, style="italic") for m in self.messages[-3:]])
        hud_panel = Panel(Group(hud, squad, titanes, msgs), border_style="dim", padding=0)

        controls = Text(
            " WASD mover · ESPACIO impulso · G gancho · CLIC-IZQ/J atacar · "
            "CLIC-DER/K tendones · E usar · T orden · R hojas · ESC pausa",
            style="dim",
        )
        return Group(mapa, hud_panel, controls)

    def _hud_objective(self) -> str:
        extra = ""
        if self.spec.mode in ("defense", "final") and self.spec.gate_pos:
            extra += f" | PUERTA {max(0, self.gate_hp)} HP"
            total_waves = len(self.spec.waves) + (1 if self.spec.mode == 'defense' else 0)
            extra += f" | Oleada {min(self.wave_idx + 1, max(1, total_waves))}/{max(1, total_waves)}"
        if self.cart:
            extra += f" | CARRETA {max(0, self.cart['hp'])} HP"
        if self.spec.seal_target:
            extra += f" | SELLADO {self.seal_progress}/{self.spec.seal_target}"
        return f"[bold]Titanes: {len([t for t in self.titans if not t.is_dummy])}{extra}[/]"

    def _render_pause(self):
        return Panel(
            Text("\n  PAUSA\n\n  [C] Continuar la misión\n  [Q] Retirarse (abandonar misión)\n",
                 style="bold"),
            border_style="yellow", title="ESC",
        )

    # ------------------------------------------------------------ bucle principal
    def run(self) -> MissionResult:
        from . import titan_ai
        if self.render_enabled:
            self.inp.flush()
            with Live(self.build_frame(), console=console, screen=True,
                      refresh_per_second=20) as live:
                while not self.over:
                    start = time.perf_counter()
                    if self.paused:
                        live.update(self._render_pause())
                        for ev in self.inp.poll():
                            if ev[0] == "key" and ev[1] == "c":
                                self.paused = False
                                self.inp.flush()
                            elif ev[0] == "key" and ev[1] == "q":
                                self.paused = False
                                self.finish(False, "Te retiras. Vivir también es importante.",
                                            retreat=True)
                        time.sleep(0.05)
                        continue
                    self.step(titan_ai)
                    live.update(self.build_frame())
                    elapsed = time.perf_counter() - start
                    time.sleep(max(0.0, C.TICK_SECONDS - elapsed))
                # frame final visible un instante
                live.update(self.build_frame())
                time.sleep(1.4)
            self.inp.flush()
        else:
            while not self.over:
                self.step(titan_ai)
                if self.max_ticks and self.tick >= self.max_ticks:
                    self.finish(False, "(límite de ticks alcanzado)", retreat=True)
        return self.result

    def step(self, titan_ai) -> None:
        self.tick += 1
        self.handle_input()
        if self.over:
            return
        # cooldowns
        for u in self.living_units():
            u.walk_cd = max(0, u.walk_cd - 1)
            u.attack_cd = max(0, u.attack_cd - 1)
            u.hit_cd = max(0, u.hit_cd - 1)
            u.act_cd = max(0, u.act_cd - 1)
            u.panic_ticks = max(0, u.panic_ticks - 1)
        for t in self.titans:
            t.move_cd = max(0, t.move_cd - 1)
            t.attack_cd = max(0, t.attack_cd - 1)
            t.stun_ticks = max(0, t.stun_ticks - 1)
            t.leap_cd = max(0, t.leap_cd - 1)
        # IA
        for u in list(self.living_units()):
            if not u.is_player:
                titan_ai.ally_act(self, u)
            if self.over:
                return
        for t in list(self.titans):
            titan_ai.titan_act(self, t)
            if self.over:
                return
        self.update_grabs()
        if self.over:
            return
        self.update_defense()
        if self.over:
            return
        self.update_cart()
        if self.over:
            return
        self.update_seal()
        if self.over:
            return
        self.check_objectives()
