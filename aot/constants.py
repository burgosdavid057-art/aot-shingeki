# -*- coding: utf-8 -*-
"""Configuración, balance y datos estáticos del juego."""

# ---------------------------------------------------------------- bucle
TICK_SECONDS = 0.08          # ~12 fps
GRAB_TIMEOUT_TICKS = 40      # ticks antes de ser devorado
GRAB_STRUGGLE_NEEDED = 8     # progreso de forcejeo necesario (modificado por fuerza)

# ---------------------------------------------------------------- jugador / soldados
BASE_HP = 3
BASE_GAS = 14
BASE_BLADE_PAIRS = 2
BASE_BLADE_EDGE = 4          # filo (usos) por par de hojas
DASH_RANGE = 4
DASH_COST = 2
HOOK_RANGE = 9
HOOK_COST = 3
WALK_COOLDOWN = 1            # ticks entre pasos a pie del jugador
INJURY_DEATH_CHANCE = 0.65   # al caer: prob. de muerte permanente (sin hospital)
INJURY_DAYS = (4, 9)         # días fuera si sobrevive herido

XP_PER_KILL = 30
XP_PER_ASSIST = 10
XP_PER_MISSION = 20

# ---------------------------------------------------------------- titanes
TITAN_TYPES = {
    "puro": {
        "name": "Titán Puro",
        "heights": (3, 7),
        "nape_hp": (3, 5),
        "move_cooldown": 5,      # ticks por paso
        "attack_cooldown": 14,
        "grab_chance": 0.25,
        "damage": 1,
        "color": "red",
        "xp": 30,
    },
    "anormal": {
        "name": "Anormal",
        "heights": (6, 12),
        "nape_hp": (4, 6),
        "move_cooldown": 3,
        "attack_cooldown": 12,
        "grab_chance": 0.30,
        "damage": 1,
        "color": "magenta",
        "xp": 55,
        "leap_range": 4,
        "leap_cooldown": 36,
    },
    "grande": {
        "name": "Titán de 15 metros",
        "heights": (14, 15),
        "nape_hp": (7, 9),
        "move_cooldown": 7,
        "attack_cooldown": 16,
        "grab_chance": 0.40,
        "damage": 2,
        "color": "bright_red",
        "xp": 90,
    },
}

# ---------------------------------------------------------------- nombres y traits
FIRST_NAMES = [
    "Klaus", "Greta", "Hannes", "Ilse", "Dieter", "Petra", "Gunther", "Frieda",
    "Marco", "Mina", "Thomas", "Hannah", "Franz", "Anka", "Moritz", "Lotte",
    "Erwin", "Nanaba", "Gelgar", "Rico", "Mitabi", "Lynne", "Henning", "Luke",
]
LAST_NAMES = [
    "Weber", "Richter", "Brandt", "Koch", "Bauer", "Wolff", "Krüger", "Lehmann",
    "Schäfer", "Vogel", "Stein", "Berg", "Fuchs", "Roth", "Engel", "Sturm",
]

TRAITS = {
    "prodigio": {"name": "Prodigio del ODM", "desc": "El gancho cuesta 1 de gas menos."},
    "veterano": {"name": "Veterano", "desc": "Inmune al pánico; +1 valentía."},
    "carnicero": {"name": "Carnicero", "desc": "+1 de daño en cortes a la nuca."},
    "escurridizo": {"name": "Escurridizo", "desc": "Esquiva manotazos con más facilidad."},
    "ahorrador": {"name": "Manos firmes", "desc": "Sus hojas pierden filo más despacio."},
    "temerario": {"name": "Temerario", "desc": "+daño, pero los titanes lo priorizan."},
}

# ---------------------------------------------------------------- economía
START_RESOURCES = {"gas": 60, "hojas": 8, "comida": 30, "merito": 0}
TRAIN_FOOD_COST = 4
RECRUIT_FOOD_COST = 8
FORGE_FOOD_COST = 3          # comida → 2 pares de hojas (la forja come)
REST_HEAL = True
DAILY_FOOD_UPKEEP = 0        # simplificado: la comida solo se gasta en acciones

WALL_MAX_HP = 100
WALL_ALERT_DAYS = (8, 12)    # rango de días entre ataques a la muralla
WALL_IGNORE_DAMAGE = 18      # daño a la muralla global si ignoras una alerta

EXPLORE_TIERS = {
    "cercana": {"name": "Cercana", "nodes": 3, "days": 1, "danger": 1, "loot": 1.0},
    "media":   {"name": "Media",   "nodes": 4, "days": 2, "danger": 2, "loot": 1.6},
    "lejana":  {"name": "Lejana",  "nodes": 5, "days": 3, "danger": 3, "loot": 2.4},
}

# ---------------------------------------------------------------- capítulos de historia
CHAPTERS = [
    {
        "id": 1,
        "title": "El entrenamiento",
        "intro": (
            "Año 847. Campo de entrenamiento del Cuerpo de Exploración.\n"
            "El instructor señala las dianas de madera con forma de titán:\n"
            "«¡Demuestren que esas hojas sirven para algo! Destruyan todas las dianas.»\n"
            "Aquí nadie muere... todavía. Aprende a moverte, a usar el gas y a cortar."
        ),
        "type": "tutorial",
    },
    {
        "id": 2,
        "title": "La caída de la puerta",
        "intro": (
            "Las campanas repican como nunca. Titanes avanzan hacia la puerta sur\n"
            "del distrito. Si la puerta cae, caerá el distrito entero.\n"
            "«¡Soldados, a la muralla! ¡Que no toquen la puerta!»\n"
            "Defiende la puerta durante todas las oleadas. Usa los cañones (E sobre la muralla)."
        ),
        "type": "defense_story",
    },
    {
        "id": 3,
        "title": "Sangre fuera de los muros",
        "intro": (
            "Tu primera expedición real. Las carretas de suministros deben cruzar\n"
            "la llanura hasta el bosque. El Cuerpo de Exploración abre el camino.\n"
            "«Protejan las carretas. Cada caja perdida son familias que no comen.»\n"
            "Escolta la carreta hasta el borde este del mapa. Que no la destruyan."
        ),
        "type": "escort",
    },
    {
        "id": 4,
        "title": "El bosque de árboles gigantes",
        "intro": (
            "Un Anormal ha destrozado dos escuadrones enteros. Se mueve raro,\n"
            "salta, corre... y siempre escapa. Se refugia en el bosque de árboles gigantes.\n"
            "«Encuéntrenlo. Mátenlo. No vuelvan sin su nuca.»\n"
            "Caza al Anormal marcado. Cuidado: no está solo."
        ),
        "type": "hunt",
    },
    {
        "id": 5,
        "title": "Operación: Retomar el Muro María",
        "intro": (
            "Todo conduce a esto. El plan de reconquista está listo: limpiar la zona\n"
            "de la brecha y sellar la puerta antes del anochecer.\n"
            "«Esta operación se pagará con sangre. Que la historia recuerde la nuestra\n"
            "como la generación que recuperó lo que era suyo.»\n"
            "Fase 1: extermina a los titanes de la brecha. Fase 2: defiende al equipo\n"
            "de sellado hasta que termine."
        ),
        "type": "final",
        "requires_tech": "reconquista",
    },
]

# ---------------------------------------------------------------- árbol de tecnología
TECH_TREE = {
    # --- Equipo ODM
    "tanque": {
        "name": "Tanque ampliado", "branch": "Equipo ODM", "cost": 60,
        "desc": "+6 de gas máximo por soldado.", "requires": None,
    },
    "hojas_duras": {
        "name": "Hojas endurecidas", "branch": "Equipo ODM", "cost": 80,
        "desc": "+2 de filo por par de hojas.", "requires": "tanque",
    },
    "anclaje": {
        "name": "Anclaje doble", "branch": "Equipo ODM", "cost": 110,
        "desc": "+2 de alcance de impulso y gancho.", "requires": "hojas_duras",
    },
    # --- Táctica
    "flanqueo": {
        "name": "Doctrina de flanqueo", "branch": "Táctica", "cost": 50,
        "desc": "Tus aliados buscan la nuca con más astucia (+daño aliado).", "requires": None,
    },
    "rescate": {
        "name": "Rescate veloz", "branch": "Táctica", "cost": 75,
        "desc": "Los aliados liberan a los agarrados casi de inmediato.", "requires": "flanqueo",
    },
    "nervios": {
        "name": "Nervios de acero", "branch": "Táctica", "cost": 100,
        "desc": "Forcejear es mucho más efectivo. +1 valentía a toda la tropa.", "requires": "rescate",
    },
    # --- Logística
    "economia": {
        "name": "Economía de gas", "branch": "Logística", "cost": 55,
        "desc": "El impulso ODM cuesta 1 de gas menos.", "requires": None,
    },
    "forja": {
        "name": "Forja eficiente", "branch": "Logística", "cost": 70,
        "desc": "Cada soldado lleva un par de hojas extra.", "requires": "economia",
    },
    "hospital": {
        "name": "Hospital de campaña", "branch": "Logística", "cost": 95,
        "desc": "Un caído sobrevive herido el 50% de las veces (antes 35%).",
        "requires": "forja",
    },
    # --- Final
    "reconquista": {
        "name": "Plan de Reconquista", "branch": "Final", "cost": 160,
        "desc": "Desbloquea la operación final: Retomar el Muro María.",
        "requires": "anclaje",
    },
}

# ---------------------------------------------------------------- mapa / render
TILE_FLOOR = "."
TILE_TREE = "♣"
TILE_BIGTREE = "T"
TILE_HOUSE = "⌂"
TILE_WALL = "█"
TILE_GATE = "▓"
TILE_SUPPLY = "*"
TILE_CANNON = "Ω"
TILE_DUMMY = "+"
TILE_CART = "C"

VIEW_W = 64
VIEW_H = 17
