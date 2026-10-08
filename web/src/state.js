// Estado persistente: soldados, recursos, progresión, guardado.
export const VERSION = 'v2.3 — El despertar';

export const CFG = {
  BASE_HP: 3,
  BASE_GAS: 170,            // segundos-de-gas aprox
  BASE_BLADE_PAIRS: 3,
  BASE_BLADE_EDGE: 6,       // cortes por par
  INJURY_DEATH: 0.65,
  INJURY_DAYS: [4, 9],
  XP_KILL: 30, XP_MISSION: 20,
  WALL_MAX: 100,
  WALL_ALERT_DAYS: [8, 12],
  WALL_IGNORE_DMG: 18,
  TRAIN_FOOD: 4, RECRUIT_FOOD: 8, FORGE_FOOD: 3,
  START_RES: { gas: 900, hojas: 24, comida: 30, merito: 0 },
};

export const TITAN_TYPES = {
  puro:    { name: 'Titán Puro',        hMin: 5,  hMax: 8,  hp: [3, 5], speed: 4.2,  atkCd: 2.4, grab: 0.30, dmg: 1, color: 0xb98a6a, xp: 30 },
  anormal: { name: 'Anormal',           hMin: 7,  hMax: 11, hp: [4, 6], speed: 9.5,  atkCd: 2.0, grab: 0.34, dmg: 1, color: 0x9a5a7a, xp: 55 },
  grande:  { name: 'Titán de 15 metros', hMin: 14, hMax: 15, hp: [8, 10], speed: 3.2, atkCd: 3.0, grab: 0.42, dmg: 2, color: 0x8a6a5a, xp: 90 },
  // ---- los Nueve: titanes especiales (eventos raros, recompensa enorme)
  hembra:    { name: 'TITÁN HEMBRA',    hMin: 14, hMax: 14, hp: [12, 12], speed: 7.8, atkCd: 1.6, grab: 0.45, dmg: 2, color: 0xd8c8a0, xp: 200, special: true,
               lore: 'Endurece su nuca por momentos: espera a que el cristal se apague.' },
  acorazado: { name: 'TITÁN ACORAZADO', hMin: 15, hMax: 15, hp: [10, 10], speed: 2.9, atkCd: 2.6, grab: 0.35, dmg: 2, color: 0xc8b890, xp: 220, special: true,
               lore: 'Placas de armadura cubren su nuca: rómpelas a cortes (o lanzas trueno).' },
  bestia:    { name: 'TITÁN BESTIA',    hMin: 17, hMax: 17, hp: [9, 9],   speed: 3.6, atkCd: 2.2, grab: 0.30, dmg: 2, color: 0x5a4a3a, xp: 240, special: true,
               lore: 'Lanza rocas desde lejos. Cierra la distancia en zigzag o estás muerto.' },
  mandibula: { name: 'TITÁN MANDÍBULA', hMin: 9,  hMax: 9,  hp: [10, 10], speed: 10.5, atkCd: 1.4, grab: 0.40, dmg: 2, color: 0x8a7a62, xp: 210, special: true,
               leap_range: 5, lore: 'El más veloz de los Nueve: corre y salta sin descanso. No dejes que te rodee.' },
};

export const SPECIAL_KINDS = ['hembra', 'acorazado', 'bestia', 'mandibula'];

// ---------------------------------------------------------------- armas
export const WEAPONS = {
  estandar: { name: 'Hojas estándar', dmg: 0, cdMul: 1.0, wear: 1,
              desc: 'Equilibradas. Las de siempre.', req: null },
  pesadas:  { name: 'Hojas pesadas',  dmg: 1, cdMul: 1.4, wear: 2,
              desc: '+1 daño, más lentas y gastan el doble de filo.', req: { tech: 'hojas_duras' } },
};
export const SPEARS = {
  name: 'Lanzas trueno', ammo: 4, costPairs: 2,
  desc: 'Pulsa Q para lanzar. Explotan: 4 de daño y destrozan armaduras. 4 por misión (cuestan 2 pares de hojas del almacén).',
  reqChapter: 3,
};

// ---------------------------------------------------------------- skins
// Las capas cambian el color; los PERSONAJES usan su modelo 3D (web/assets/).
export const SKINS = {
  verde:   { name: 'Cuerpo de Exploración', color: 0x2a5a3a, hint: 'inicial',
             model: 'skin_reiner', unlocked: () => true },
  azul:    { name: 'Policía Militar',       color: 0x2a3a7a, hint: 'abate 15 titanes',
             unlocked: (gs) => gs.titansKilled >= 15 },
  carmesi: { name: 'Capa de luto',          color: 0x7a1a1a, hint: '3 nombres en el memorial',
             unlocked: (gs) => gs.fallen.length >= 3 },
  blanca:  { name: 'Uniforme de gala',      color: 0xd8d4c8, hint: 'abate 40 titanes',
             unlocked: (gs) => gs.titansKilled >= 40 },
  negra:   { name: 'Ala de la Libertad',    color: 0x16161c, hint: 'derrota a un titán especial',
             unlocked: (gs) => (gs.specialKills || 0) >= 1 },
  mikasa:   { name: '✦ Mikasa Ackerman',   color: 0x7a1a1a, model: 'skin_mikasa', hint: 'abate 10 titanes',
              unlocked: (gs) => gs.titansKilled >= 10 },
  historia: { name: '✦ Historia Reiss',    color: 0xd8d4c8, model: 'skin_historia', hint: 'llega al capítulo 4',
              unlocked: (gs) => gs.chapter >= 4 },
  annie:    { name: '✦ Annie Leonhart',    color: 0xc8b890, model: 'skin_annie', hint: 'derrota al TITÁN HEMBRA',
              unlocked: (gs) => (gs.defeated9 || []).includes('hembra') },
  reiner:   { name: '✦ Reiner Braun',      color: 0x8a7a52, model: 'skin_reiner', hint: 'derrota al TITÁN ACORAZADO',
              unlocked: (gs) => (gs.defeated9 || []).includes('acorazado') },
  zeke:     { name: '✦ Zeke Yeager',       color: 0x5a4a3a, model: 'skin_zeke', hint: 'derrota al TITÁN BESTIA',
              unlocked: (gs) => (gs.defeated9 || []).includes('bestia') },
};

export const TRAITS = {
  prodigio:    { name: 'Prodigio del ODM', desc: 'El gancho gasta menos gas.' },
  veterano:    { name: 'Veterano',         desc: 'Inmune al pánico; +1 valentía.' },
  carnicero:   { name: 'Carnicero',        desc: '+1 de daño en la nuca.' },
  escurridizo: { name: 'Escurridizo',      desc: 'Esquiva manotazos con facilidad.' },
  ahorrador:   { name: 'Manos firmes',     desc: 'Sus hojas pierden filo más despacio.' },
  temerario:   { name: 'Temerario',        desc: '+daño, pero los titanes lo priorizan.' },
};

export const TECH_TREE = {
  tanque:      { name: 'Tanque ampliado',      branch: 'Equipo ODM', cost: 60,  desc: '+40 de gas máximo.', req: null },
  hojas_duras: { name: 'Hojas endurecidas',    branch: 'Equipo ODM', cost: 80,  desc: '+3 de filo por par.', req: 'tanque' },
  anclaje:     { name: 'Anclaje doble',        branch: 'Equipo ODM', cost: 110, desc: '+30 m de alcance de gancho.', req: 'hojas_duras' },
  flanqueo:    { name: 'Doctrina de flanqueo', branch: 'Táctica',    cost: 50,  desc: 'Tus aliados hacen +1 de daño.', req: null },
  rescate:     { name: 'Rescate veloz',        branch: 'Táctica',    cost: 75,  desc: 'Los aliados liberan a los agarrados casi al instante.', req: 'flanqueo' },
  nervios:     { name: 'Nervios de acero',     branch: 'Táctica',    cost: 100, desc: 'Forcejear es mucho más efectivo. +1 valentía a todos.', req: 'rescate' },
  economia:    { name: 'Economía de gas',      branch: 'Logística',  cost: 55,  desc: 'El ODM consume 25% menos gas.', req: null },
  forja:       { name: 'Forja eficiente',      branch: 'Logística',  cost: 70,  desc: '+1 par de hojas por soldado.', req: 'economia' },
  hospital:    { name: 'Hospital de campaña',  branch: 'Logística',  cost: 95,  desc: 'Un caído sobrevive el 50% de las veces (antes 35%).', req: 'forja' },
  reconquista: { name: 'Plan de Reconquista',  branch: 'Final',      cost: 160, desc: 'Desbloquea la operación final: Retomar el Muro María.', req: 'anclaje' },
};

export const CHAPTERS = [
  { id: 1, title: 'El entrenamiento', type: 'tutorial',
    intro: 'Año 847. Campo de entrenamiento del Cuerpo de Exploración.\nEl instructor señala las dianas con forma de titán: «¡Demuestren que esas hojas sirven para algo! Destruyan todas las dianas.»\nAquí nadie muere... todavía. Aprende a moverte, a usar el gancho y a cortar la nuca.' },
  { id: 2, title: 'La caída de la puerta', type: 'defense',
    intro: 'Las campanas repican como nunca. Titanes avanzan hacia la puerta sur del distrito.\nSi la puerta cae, caerá el distrito entero.\n«¡Soldados, a la muralla! ¡Que no toquen la puerta!»' },
  { id: 3, title: 'Sangre fuera de los muros', type: 'escort',
    intro: 'Tu primera expedición real. Las carretas de suministros deben cruzar la llanura.\n«Protejan la carreta. Cada caja perdida son familias que no comen.»\nEscóltala hasta el bosque del este.' },
  { id: 4, title: 'El bosque de árboles gigantes', type: 'hunt',
    intro: 'Un Anormal ha destrozado dos escuadrones enteros. Corre, salta... y siempre escapa.\n«Encuéntrenlo. Mátenlo. No vuelvan sin su nuca.»\nCuidado: no está solo, y huirá cuando lo hieras.' },
  { id: 5, title: 'Operación: Retomar el Muro María', type: 'final', requiresTech: 'reconquista',
    intro: 'Todo conduce a esto: limpiar la zona de la brecha y sellar la puerta antes del anochecer.\n«Esta operación se pagará con sangre. Que la historia recuerde la nuestra como la generación que recuperó lo que era suyo.»' },
];

const FIRST = ['Klaus','Greta','Hannes','Ilse','Dieter','Petra','Gunther','Frieda','Marco','Mina','Thomas','Hannah','Franz','Anka','Moritz','Lotte','Nanaba','Gelgar','Rico','Lynne'];
const LAST  = ['Weber','Richter','Brandt','Koch','Bauer','Wolff','Krüger','Lehmann','Schäfer','Vogel','Stein','Berg','Fuchs','Roth','Engel','Sturm'];

export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function randomSoldier(elite = false) {
  const base = elite ? 4 : 3;
  const s = {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    strength: base + rint(-1, 2), agility: base + rint(-1, 2),
    precision: base + rint(-1, 2), courage: base + rint(-1, 2),
    level: 1, xp: 0, kills: 0, missions: 0, trait: null,
    alive: true, injuredDays: 0, isPlayer: false,
  };
  if (Math.random() < (elite ? 0.55 : 0.35)) {
    s.trait = pick(Object.keys(TRAITS));
    if (s.trait === 'veterano') s.courage += 1;
  }
  return s;
}

export function rankOf(s) {
  if (s.level >= 9) return 'Capitán';
  if (s.level >= 7) return 'Líder de escuadrón';
  if (s.level >= 5) return 'Soldado de élite';
  if (s.level >= 3) return 'Soldado';
  return 'Recluta';
}

export function gainXp(s, amount) {
  const msgs = [];
  s.xp += amount;
  while (s.xp >= s.level * 100) {
    s.xp -= s.level * 100;
    s.level += 1;
    const stat = pick(['strength', 'agility', 'precision', 'courage']);
    s[stat] += 1;
    const es = { strength: 'fuerza', agility: 'agilidad', precision: 'precisión', courage: 'valentía' }[stat];
    msgs.push(`${s.name} sube a nivel ${s.level} (+1 ${es})`);
  }
  return msgs;
}

// ---------------------------------------------------------------- GameState
export function newGame(playerName) {
  const gs = {
    playerName, day: 1,
    resources: { ...CFG.START_RES },
    soldiers: [], fallen: [], techs: [],
    chapter: 1, wallHp: CFG.WALL_MAX,
    nextWallAlert: 1 + rint(...CFG.WALL_ALERT_DAYS),
    wallAlertActive: false,
    titansKilled: 0, expeditions: 0, victory: false,
    weapon: 'estandar', spearsEquipped: false, skin: 'verde', specialKills: 0,
    defeated9: [], titanPower: false,
  };
  const p = { ...randomSoldier(), name: playerName, strength: 4, agility: 4, precision: 4, courage: 4, trait: null, isPlayer: true };
  gs.soldiers.push(p);
  for (let i = 0; i < 4; i++) gs.soldiers.push(randomSoldier());
  return gs;
}

export const player = (gs) => gs.soldiers.find(s => s.isPlayer && s.alive) || null;
export const living = (gs) => gs.soldiers.filter(s => s.alive);
export const activeRoster = (gs) => gs.soldiers.filter(s => s.alive && s.injuredDays === 0);
export const hasTech = (gs, k) => gs.techs.includes(k);

export function killSoldier(gs, s, cause) {
  s.alive = false;
  gs.fallen.push({ name: s.name, kills: s.kills, level: s.level, day: gs.day, cause });
}

export function passDays(gs, n) {
  const msgs = [];
  for (let i = 0; i < n; i++) {
    gs.day += 1;
    for (const s of gs.soldiers) {
      if (s.alive && s.injuredDays > 0) {
        s.injuredDays -= 1;
        if (s.injuredDays === 0) msgs.push(`${s.name} recibe el alta del hospital.`);
      }
    }
    if (!gs.wallAlertActive && gs.day >= gs.nextWallAlert) {
      gs.wallAlertActive = true;
      msgs.push('¡ALERTA! Titanes avistados acercándose a la muralla.');
    }
  }
  return msgs;
}

export function scheduleWallAlert(gs) {
  gs.nextWallAlert = gs.day + rint(...CFG.WALL_ALERT_DAYS);
  gs.wallAlertActive = false;
}

// ---------------------------------------------------------------- efectos de tecnología
export const maxGas     = (gs) => CFG.BASE_GAS + (hasTech(gs, 'tanque') ? 70 : 0);
export const bladePairs = (gs) => CFG.BASE_BLADE_PAIRS + (hasTech(gs, 'forja') ? 1 : 0);
export const bladeEdge  = (gs) => CFG.BASE_BLADE_EDGE + (hasTech(gs, 'hojas_duras') ? 3 : 0);
export const hookRange  = (gs) => 70 + (hasTech(gs, 'anclaje') ? 30 : 0);
export const gasFactor  = (gs) => hasTech(gs, 'economia') ? 0.75 : 1.0;
export const injuryDeath = (gs) => hasTech(gs, 'hospital') ? 0.50 : CFG.INJURY_DEATH;
export const allyDmgBonus = (gs) => hasTech(gs, 'flanqueo') ? 1 : 0;
export const struggleBonus = (gs) => hasTech(gs, 'nervios') ? 2 : 0;

export function availableTechs(gs) {
  return Object.keys(TECH_TREE).filter(k =>
    !gs.techs.includes(k) && (!TECH_TREE[k].req || gs.techs.includes(TECH_TREE[k].req)));
}

export function research(gs, key) {
  const t = TECH_TREE[key];
  if (gs.techs.includes(key)) return [false, 'Ya está investigada.'];
  if (t.req && !gs.techs.includes(t.req)) return [false, `Requiere: ${TECH_TREE[t.req].name}.`];
  if (gs.resources.merito < t.cost) return [false, `Mérito insuficiente (${gs.resources.merito}/${t.cost}).`];
  gs.resources.merito -= t.cost;
  gs.techs.push(key);
  if (key === 'nervios') for (const s of gs.soldiers) if (s.alive) s.courage += 1;
  return [true, `Investigado: ${t.name}.`];
}

// ---------------------------------------------------------------- guardado (localStorage)
const SLOT_KEY = (n) => `aot3d_slot_${n}`;
export const SLOTS = 3;

export function saveGame(gs, slot) {
  localStorage.setItem(SLOT_KEY(slot), JSON.stringify(gs));
}

export function loadGame(slot) {
  const raw = localStorage.getItem(SLOT_KEY(slot));
  if (!raw) return null;
  try {
    const gs = JSON.parse(raw);
    // compatibilidad con partidas anteriores
    gs.weapon ??= 'estandar';
    gs.spearsEquipped ??= false;
    gs.skin ??= 'verde';
    gs.specialKills ??= 0;
    gs.defeated9 ??= [];
    gs.titanPower ??= false;
    return gs;
  } catch { return null; }
}

export function slotSummary(slot) {
  const gs = loadGame(slot);
  if (!gs) return null;
  const vivos = gs.soldiers.filter(s => s.alive).length;
  const estado = gs.victory ? 'VICTORIA' : `capítulo ${gs.chapter}`;
  return `${gs.playerName} — día ${gs.day}, ${estado}, ${vivos} soldados, ${gs.titansKilled} titanes`;
}

export function deleteSlot(slot) { localStorage.removeItem(SLOT_KEY(slot)); }
