# -*- coding: utf-8 -*-
"""Modelos persistentes: soldados, estado de la partida."""
from __future__ import annotations

import random
from dataclasses import dataclass, field, asdict

from . import constants as C


@dataclass
class Soldier:
    name: str
    strength: int = 3      # fuerza: daño y forcejeo
    agility: int = 3       # agilidad: esquiva y velocidad
    precision: int = 3     # precisión: prob. de crítico en la nuca
    courage: int = 3       # valentía: resistencia al pánico
    level: int = 1
    xp: int = 0
    kills: int = 0
    missions: int = 0
    trait: str | None = None
    alive: bool = True
    injured_days: int = 0  # >0 = hospital, no puede salir
    death_day: int | None = None
    is_player: bool = False

    # ------------------------------------------------------------ progresión
    def xp_to_next(self) -> int:
        return self.level * 100

    def gain_xp(self, amount: int) -> list[str]:
        """Devuelve mensajes de subida de nivel."""
        msgs = []
        self.xp += amount
        while self.xp >= self.xp_to_next():
            self.xp -= self.xp_to_next()
            self.level += 1
            stat = random.choice(["strength", "agility", "precision", "courage"])
            setattr(self, stat, getattr(self, stat) + 1)
            stat_es = {"strength": "fuerza", "agility": "agilidad",
                       "precision": "precisión", "courage": "valentía"}[stat]
            msgs.append(f"{self.name} sube a nivel {self.level} (+1 {stat_es})")
        return msgs

    @property
    def rank(self) -> str:
        if self.level >= 9:
            return "Capitán"
        if self.level >= 7:
            return "Líder de escuadrón"
        if self.level >= 5:
            return "Soldado de élite"
        if self.level >= 3:
            return "Soldado"
        return "Recluta"

    def has_trait(self, key: str) -> bool:
        return self.trait == key

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Soldier":
        return Soldier(**d)


def random_soldier(rng: random.Random | None = None, elite: bool = False) -> Soldier:
    rng = rng or random
    name = f"{rng.choice(C.FIRST_NAMES)} {rng.choice(C.LAST_NAMES)}"
    base = 4 if elite else 3
    s = Soldier(
        name=name,
        strength=base + rng.randint(-1, 2),
        agility=base + rng.randint(-1, 2),
        precision=base + rng.randint(-1, 2),
        courage=base + rng.randint(-1, 2),
    )
    if rng.random() < (0.55 if elite else 0.35):
        s.trait = rng.choice(list(C.TRAITS.keys()))
        if s.trait == "veterano":
            s.courage += 1
    return s


@dataclass
class FallenRecord:
    name: str
    kills: int
    level: int
    day: int
    cause: str


@dataclass
class GameState:
    player_name: str = "Soldado"
    day: int = 1
    resources: dict = field(default_factory=lambda: dict(C.START_RESOURCES))
    soldiers: list = field(default_factory=list)          # list[Soldier]
    fallen: list = field(default_factory=list)            # list[FallenRecord]
    techs: list = field(default_factory=list)             # ids investigados
    chapter: int = 1                                       # próximo capítulo a jugar
    wall_hp: int = C.WALL_MAX_HP
    next_wall_alert: int = 0                               # día del próximo ataque
    wall_alert_active: bool = False
    titans_killed: int = 0
    expeditions: int = 0
    victory: bool = False

    # ------------------------------------------------------------ helpers
    @property
    def player(self) -> Soldier | None:
        for s in self.soldiers:
            if s.is_player and s.alive:
                return s
        return None

    def active_roster(self) -> list[Soldier]:
        """Soldados vivos y no heridos (disponibles para misión)."""
        return [s for s in self.soldiers if s.alive and s.injured_days == 0]

    def living(self) -> list[Soldier]:
        return [s for s in self.soldiers if s.alive]

    def has_tech(self, key: str) -> bool:
        return key in self.techs

    def kill_soldier(self, soldier: Soldier, cause: str) -> None:
        soldier.alive = False
        soldier.death_day = self.day
        self.fallen.append(FallenRecord(
            name=soldier.name, kills=soldier.kills,
            level=soldier.level, day=self.day, cause=cause,
        ))

    def schedule_wall_alert(self, rng: random.Random | None = None) -> None:
        rng = rng or random
        self.next_wall_alert = self.day + rng.randint(*C.WALL_ALERT_DAYS)
        self.wall_alert_active = False

    def pass_days(self, n: int) -> list[str]:
        """Avanza el calendario. Devuelve avisos."""
        msgs = []
        for _ in range(n):
            self.day += 1
            for s in self.soldiers:
                if s.alive and s.injured_days > 0:
                    s.injured_days -= 1
                    if s.injured_days == 0:
                        msgs.append(f"{s.name} recibe el alta del hospital.")
            if not self.wall_alert_active and self.day >= self.next_wall_alert:
                self.wall_alert_active = True
                msgs.append("¡ALERTA! Titanes avistados acercándose a la muralla.")
        return msgs

    # ------------------------------------------------------------ save
    def to_dict(self) -> dict:
        return {
            "player_name": self.player_name,
            "day": self.day,
            "resources": self.resources,
            "soldiers": [s.to_dict() for s in self.soldiers],
            "fallen": [asdict(f) for f in self.fallen],
            "techs": self.techs,
            "chapter": self.chapter,
            "wall_hp": self.wall_hp,
            "next_wall_alert": self.next_wall_alert,
            "wall_alert_active": self.wall_alert_active,
            "titans_killed": self.titans_killed,
            "expeditions": self.expeditions,
            "victory": self.victory,
        }

    @staticmethod
    def from_dict(d: dict) -> "GameState":
        gs = GameState(
            player_name=d["player_name"],
            day=d["day"],
            resources=d["resources"],
            techs=d["techs"],
            chapter=d["chapter"],
            wall_hp=d["wall_hp"],
            next_wall_alert=d["next_wall_alert"],
            wall_alert_active=d["wall_alert_active"],
            titans_killed=d["titans_killed"],
            expeditions=d["expeditions"],
            victory=d.get("victory", False),
        )
        gs.soldiers = [Soldier.from_dict(s) for s in d["soldiers"]]
        gs.fallen = [FallenRecord(**f) for f in d["fallen"]]
        return gs


def new_game(player_name: str) -> GameState:
    gs = GameState(player_name=player_name)
    player = Soldier(
        name=player_name, strength=4, agility=4, precision=4, courage=4,
        is_player=True,
    )
    gs.soldiers.append(player)
    for _ in range(4):
        gs.soldiers.append(random_soldier())
    gs.schedule_wall_alert()
    return gs
