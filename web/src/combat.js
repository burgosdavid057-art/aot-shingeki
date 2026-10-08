// Misión 3D: orquesta jugador, aliados, titanes, objetivos y HUD.
import * as THREE from 'three';
import * as S from './state.js';
import { buildWorld, ARENA } from './world.js';
import { Titan } from './titan.js';
import { Player } from './player.js';
import { Ally } from './allies.js';
import { updateFx, clearFx, steam, sparks } from './fx.js';
import { sfx } from './audio.js';

// ================================================================ specs
const r = (a, b) => a + Math.random() * (b - a);

export function tutorialSpec() {
  return {
    name: 'Capítulo 1 — El entrenamiento', mode: 'tutorial', biome: 'plains',
    playerSpawn: { x: 0, z: -40, yaw: Math.PI },
    titans: [
      { kind: 'puro', x: 0, z: 40, opts: { dummy: true, height: 8 } },
      { kind: 'puro', x: -50, z: 70, opts: { dummy: true, height: 7 } },
      { kind: 'puro', x: 55, z: 75, opts: { dummy: true, height: 9 } },
      { kind: 'puro', x: 10, z: 130, opts: { dummy: true, height: 8 } },
    ],
    waves: [], supplies: 2, noDeath: true,
    objectiveText: 'Destruye las 4 dianas. Apunta con la cámara, dispara el gancho con <b>CLIC DERECHO</b> y corta la <b>NUCA</b> (placa roja) con <b>CLIC IZQUIERDO</b>.',
  };
}

export function defenseSpec(gs, story = false) {
  const scale = 1 + Math.floor(gs.day / 18);
  const mkWave = (counts) => {
    const out = [];
    for (const [kind, n] of counts) for (let i = 0; i < n; i++)
      out.push({ kind, x: r(-180, 180), z: r(-250, -200) });
    return out;
  };
  let waves, gateHp;
  if (story) {
    waves = [mkWave([['puro', 2]]), mkWave([['puro', 2], ['anormal', 1]]), mkWave([['puro', 2], ['grande', 1]])];
    gateHp = 12;
  } else {
    waves = [mkWave([['puro', scale], ['anormal', 1]]), mkWave([['puro', scale], ['grande', 1]])];
    if (scale >= 2) waves.push(mkWave([['puro', 1], ['anormal', 1], ['grande', 1]]));
    gateHp = 10;
    // evento raro: uno de los Nueve se une al asalto
    if (Math.random() < 0.07 + gs.day * 0.003) {
      const kind = S.SPECIAL_KINDS[Math.floor(Math.random() * S.SPECIAL_KINDS.length)];
      waves[waves.length - 1].push({ kind, x: 0, z: -240 });
    }
  }
  const first = waves.shift();
  return {
    name: story ? 'Capítulo 2 — La caída de la puerta' : '¡Defensa de la muralla!',
    mode: 'defense', biome: 'town',
    playerSpawn: { x: 0, z: 150, yaw: Math.PI },
    wall: { z: 195, gateWidth: 26 }, gateHp,
    titans: first.map(w => ({ ...w, opts: {} })),
    waves, supplies: 4,
    objectiveText: 'Repele todas las oleadas. ¡Que NADIE toque la puerta!',
  };
}

export function escortSpec() {
  const titans = [];
  for (let i = 0; i < 4; i++) {
    titans.push({
      kind: i === 2 ? 'anormal' : 'puro',
      x: -120 + i * 90, z: (i % 2 ? 1 : -1) * r(80, 160),
      opts: { targetsCart: i % 2 === 0 },
    });
  }
  return {
    name: 'Capítulo 3 — Sangre fuera de los muros', mode: 'escort', biome: 'plains',
    playerSpawn: { x: -210, z: -16, yaw: Math.PI / 2 },
    cart: { x: -225, z: 0, hp: 8, destX: 235 },
    titans, waves: [], supplies: 4,
    objectiveText: 'Escolta la <b>carreta</b> hasta el bosque del este. Avanza sola si no hay titanes cerca.',
  };
}

export function huntSpec() {
  return {
    name: 'Capítulo 4 — El bosque de árboles gigantes', mode: 'hunt', biome: 'forest',
    playerSpawn: { x: -220, z: 0, yaw: Math.PI / 2 },
    titans: [
      { kind: 'anormal', x: 170, z: 30, opts: { marked: true, height: 11 } },
      { kind: 'puro', x: 20, z: -90, opts: {} },
      { kind: 'puro', x: 60, z: 110, opts: {} },
      { kind: 'puro', x: 120, z: -40, opts: {} },
    ],
    waves: [], supplies: 5,
    objectiveText: 'Caza al <b>Anormal marcado</b> (anillo dorado). Huirá cuando lo hieras: no lo dejes escapar.',
  };
}

export function finalSpec1() {
  return {
    name: 'FINAL (Fase 1) — Limpiar la brecha', mode: 'exterminate', biome: 'town',
    playerSpawn: { x: 0, z: -200, yaw: 0 },
    titans: [
      { kind: 'puro', x: -90, z: -40, opts: {} }, { kind: 'puro', x: 80, z: -30, opts: {} },
      { kind: 'puro', x: 0, z: 60, opts: {} }, { kind: 'anormal', x: 140, z: 100, opts: {} },
      { kind: 'grande', x: 0, z: 150, opts: { height: 15 } },
    ],
    waves: [], supplies: 5,
    objectiveText: 'Extermina a TODOS los titanes de la zona de la brecha.',
  };
}

export function finalSpec2() {
  const mk = (kind, x, z) => ({ kind, x, z });
  return {
    name: 'FINAL (Fase 2) — Sellar la puerta', mode: 'final', biome: 'town',
    playerSpawn: { x: 0, z: 150, yaw: Math.PI },
    wall: { z: 195, gateWidth: 26 }, gateHp: 14, colossal: true,
    titans: [{ kind: 'puro', x: -60, z: -210, opts: {} }, { kind: 'puro', x: 60, z: -210, opts: {} }],
    waves: [
      [mk('puro', -120, -230), mk('puro', 100, -240), mk('anormal', 0, -250)],
      [mk('grande', 0, -240), mk('puro', -80, -230), mk('puro', 80, -230)],
    ],
    supplies: 4, sealTarget: 45,
    objectiveText: 'El equipo sella la puerta mientras NO haya titanes cerca de ella. ¡Mantenlos lejos!',
  };
}

export function fieldSpec(danger, name = '¡Emboscada de titanes!') {
  const titans = [];
  const n = 1 + danger + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++)
    titans.push({ kind: 'puro', x: r(20, 220), z: r(-180, 180), opts: {} });
  if (danger >= 2) titans.push({ kind: 'anormal', x: r(60, 220), z: r(-150, 150), opts: {} });
  if (danger >= 3 && Math.random() < 0.7) titans.push({ kind: 'grande', x: 200, z: 0, opts: {} });
  return {
    name, mode: 'exterminate', biome: danger >= 3 ? 'forest' : 'plains',
    playerSpawn: { x: -210, z: 0, yaw: Math.PI / 2 },
    titans, waves: [], supplies: 2 + danger,
    objectiveText: 'Extermina a todos los titanes de la zona.',
  };
}

/** Evento especial: uno de los Nueve aparece con escolta. */
export function specialSpec(danger) {
  const kind = S.SPECIAL_KINDS[Math.floor(Math.random() * S.SPECIAL_KINDS.length)];
  const T = S.TITAN_TYPES[kind];
  const titans = [{ kind, x: 160, z: 0, opts: {} }];
  for (let i = 0; i < danger; i++)
    titans.push({ kind: 'puro', x: r(80, 200), z: r(-120, 120), opts: {} });
  return {
    name: `‼ EVENTO — ${T.name} avistado`, mode: 'exterminate',
    biome: kind === 'bestia' ? 'forest' : 'plains',
    playerSpawn: { x: -210, z: 0, yaw: Math.PI / 2 },
    titans, waves: [], supplies: 3 + danger,
    objectiveText: `Derrota al <b>${T.name}</b>. ${T.lore}`,
  };
}

// ================================================================ misión
export class Mission {
  constructor(app, spec, squad) {
    this.app = app;                 // {scene, camera, renderer, gs, hud, onMissionEnd}
    this.spec = spec;
    this.gs = app.gs;
    this.over = false;
    this.paused = false;
    this.endTimer = -1;
    this.time = 0;
    this.waveIdx = 0;
    this.sealProgress = 0;
    this.shake = 0;
    this.timeScale = 1;          // hit-stop / slow-mo cinematográfico
    this.fallbackLook = false;   // true si el navegador no permite pointer lock

    this.result = {
      success: false, retreat: false, titansKilled: 0,
      kills: {}, downed: [], loot: {}, gasLeft: 0, pairsLeft: 0, summary: [],
    };

    // mundo
    const w = buildWorld(app.scene, spec);
    this.solids = w.solids;
    this.supplies = w.supplies;
    this.gate = w.gate;
    this.gateHp = spec.gateHp || 0;
    this.cart = w.cart;
    this.anchors = w.anchors;

    // escuadrón
    const playerSoldier = squad.find(s => s.isPlayer) || squad[0];
    const allySoldiers = squad.filter(s => s !== playerSoldier);
    this.player = new Player(app.scene, app.camera, this.gs, playerSoldier, spec.playerSpawn);
    this.allies = allySoldiers.map((s, i) => new Ally(app.scene, this.gs, s, spec.playerSpawn, i));

    // reparto de equipo del almacén
    const n = 1 + this.allies.length;
    const gasEach = Math.min(S.maxGas(this.gs), Math.floor(this.gs.resources.gas / n));
    const pairsEach = Math.min(S.bladePairs(this.gs), Math.floor(this.gs.resources.hojas / n));
    const edge = S.bladeEdge(this.gs);
    this.gs.resources.gas -= gasEach * n;
    this.gs.resources.hojas -= pairsEach * n;
    this.allocated = { gasEach, pairsEach };
    this.player.gas = gasEach;
    this.player.maxGasShown = Math.max(1, gasEach);
    this.player.blades = Array.from({ length: pairsEach }, () => edge);
    for (const a of this.allies) { a.gas = gasEach; a.bladeUses = pairsEach * edge; }
    // lanzas trueno equipadas (cuestan pares de hojas del almacén)
    if (this.gs.spearsEquipped && this.gs.chapter >= S.SPEARS.reqChapter
        && this.gs.resources.hojas >= S.SPEARS.costPairs) {
      this.gs.resources.hojas -= S.SPEARS.costPairs;
      this.player.spears = S.SPEARS.ammo;
    }

    // titanes iniciales
    this.titans = spec.titans.map(t =>
      new Titan(app.scene, t.kind, new THREE.Vector3(t.x, 0, t.z), t.opts || {}));

    this.order = 'free';
    this.messages = [];

    this.ctx = {
      scene: app.scene,
      player: this.player,
      allies: this.allies,
      titans: this.titans,
      cart: this.cart,
      gate: this.gate ? { x: this.gate.x, z: this.gate.z } : null,
      solids: this.solids,
      mode: spec.mode,
      noDeath: !!spec.noDeath,
      get order() { return self.order; },
      msg: (t, urgent) => this.msg(t, urgent),
      onKill: (t, who) => this._onKill(t, who),
      onGateHit: (d, t) => this._onGateHit(d, t),
      onCartHit: (d, t) => this._onCartHit(d, t),
      onAllyDown: (a, eaten) => this._onAllyDown(a, eaten),
      onPlayerDown: (eaten) => this._onPlayerDown(eaten),
      onPlayerHurt: () => { this.shake = 0.45; this.app.hud.vignette(); },
      onQuake: (mag) => { this.shake = Math.max(this.shake, 0.25 + mag * 0.4); },
      onNapeHit: () => { this.timeScale = Math.min(this.timeScale, 0.35); },
    };
    const self = this;

    this._setupInput();
    this.msg('¡Misión iniciada!');
    if (gasEach <= S.maxGas(this.gs) * 0.4)
      this.msg(`⚠ Reservas bajas: partes con solo ${gasEach} de gas y ${pairsEach} pares.`, true);
  }

  // ------------------------------------------------------------ input
  _setupInput() {
    this.input = { keys: {}, mouseDX: 0, mouseDY: 0, jump: false };
    const canvas = this.app.renderer.domElement;
    const capture = document.getElementById('capture-overlay');

    const locked = () => document.pointerLockElement === canvas || this.fallbackLook;

    this._tryLock = () => {
      if (this.fallbackLook) return;
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => this._enableFallback());
      } catch { this._enableFallback(); }
    };
    this._enableFallback = () => {
      if (this.fallbackLook) return;
      this.fallbackLook = true;
      capture.classList.remove('active');
      document.body.classList.add('soft-lock');
      this.msg('Modo cámara directa: mueve el mouse para mirar, ESC para pausar.', false);
    };
    this._showCapture = () => {
      if (!this.over && !this.paused && !locked()) capture.classList.add('active');
    };

    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (this.fallbackLook && !this.paused && !this.over) {
          this.paused = true;
          this.app.hud.showPause();
        }
        return;
      }
      this.input.keys[k] = true;
      if (this.player.grabbedBy && 'wasd'.includes(k)) this.player.mash(S.struggleBonus(this.gs));
      if (k === ' ') { this.input.jump = true; e.preventDefault(); }
      if (k === 'shift') this.player.dash(_lastMove(this.input, this.player.yaw));
      if (k === 't') {
        this.order = this.order === 'free' ? 'follow' : 'free';
        this.msg(this.order === 'follow' ? 'Orden: «¡A mí!»' : 'Orden: «¡Ataquen libres!»');
      }
      if (k === 'e') {
        if (this.player.hooked || this.player.hookPoint) this.player.releaseHook();
        else this.player.startHook(this.titans, (t, u) => this.msg(t, u), this.anchors);
      }
      if (k === 'q') this.player.throwSpear(this.ctx);
      if (k === 'f') this.player.transform(this.ctx);
    };
    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      this.input.keys[k] = false;
      if (k === ' ') this.input.jump = false;
    };
    this._onMouseMove = (e) => {
      if (this.paused || this.over) return;
      if (document.pointerLockElement === canvas || this.fallbackLook) {
        this.input.mouseDX += e.movementX;
        this.input.mouseDY += e.movementY;
      }
    };
    this._onMouseDown = (e) => {
      if (this.paused || this.over) return;
      if (!locked()) { this._tryLock(); return; }
      if (e.button === 0) {
        if (this.player.grabbedBy) this.player.mash(S.struggleBonus(this.gs) + 1);
        else this.player.attack(this.titans, this.ctx);
      } else if (e.button === 2) {
        this.player.startHook(this.titans, (t, u) => this.msg(t, u), this.anchors);
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 2) this.player.releaseHook();
    };
    this._onCtx = (e) => e.preventDefault();
    this._onLockChange = () => {
      const isLocked = document.pointerLockElement === canvas;
      capture.classList.toggle('active', !isLocked && !this.fallbackLook && !this.paused && !this.over);
      if (!isLocked && !this.fallbackLook && !this.over && !this._suppressPause && this._wasLocked) {
        this.paused = true;
        capture.classList.remove('active');
        this.app.hud.showPause();
      }
      this._wasLocked = isLocked;
    };
    this._onLockError = () => this._enableFallback();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('contextmenu', this._onCtx);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', this._onLockError);
    this._wasLocked = false;
    // sin gesto de usuario el lock será rechazado: mostramos el overlay de captura
    this._showCapture();
    // si tras unos segundos no hay lock ni interacción, activar modo directo
    this._fallbackTimer = setTimeout(() => {
      if (!document.pointerLockElement && !this.fallbackLook) this._showCapture();
    }, 800);
  }

  resume() {
    this.paused = false;
    if (!this.fallbackLook) this._showCapture();
  }

  /** Solo para pruebas: invoca un titán cerca del jugador. */
  spawnDebug(kind, dist = 40) {
    const p = this.player.pos;
    const t = new Titan(this.app.scene, kind, new THREE.Vector3(p.x + dist, 0, p.z), {});
    this.titans.push(t);
    return t;
  }

  retreat() {
    this.paused = false;
    this.end(false, 'Te retiras. Vivir también es importante.', true);
  }

  _teardownInput() {
    clearTimeout(this._fallbackTimer);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('contextmenu', this._onCtx);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('pointerlockerror', this._onLockError);
    document.getElementById('capture-overlay').classList.remove('active');
    document.body.classList.remove('soft-lock');
    this._suppressPause = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ------------------------------------------------------------ eventos
  msg(text, urgent = false) {
    this.messages.push({ text, urgent, t: this.time });
    if (this.messages.length > 7) this.messages.shift();
    this.app.hud.renderMessages(this.messages, this.time);
  }

  _onKill(titan, who) {
    this.result.titansKilled += 1;
    this.result.kills[who.name] = (this.result.kills[who.name] || 0) + 1;
    if (titan.dummy) this.msg(`Diana destrozada por ${who.name}. ¡Buen corte!`);
    else this.msg(`☠ ¡${who.name} derriba al ${titan.spec.name} (${titan.height} m)!`, true);
    if (titan.spec.special) {
      this.gs.specialKills = (this.gs.specialKills || 0) + 1;
      this.gs.defeated9 = this.gs.defeated9 || [];
      if (!this.gs.defeated9.includes(titan.kind)) this.gs.defeated9.push(titan.kind);
      this.result.bonusMerito = (this.result.bonusMerito || 0) + titan.spec.xp;
      this.result.summary.push(`★★ ¡${titan.spec.name} DERROTADO! La leyenda crece (+${titan.spec.xp} mérito).`);
      this.msg(`★★★ ¡¡EL ${titan.spec.name} HA CAÍDO!! ★★★`, true);
    }
    // momento cinematográfico: cámara lenta si lo mató el jugador
    if (who === this.player) {
      this.timeScale = 0.12;
      this.app.hud.killFlash();
      this.player.addRage(30);
    } else {
      this.player.addRage(8);
    }
  }

  _onGateHit(dmg, titan) {
    this.gateHp -= dmg;
    this.shake = 0.5;
    steam(this.app.scene, new THREE.Vector3(this.gate.x, 8, this.gate.z));
    this.msg(`¡GOLPEAN LA PUERTA! (${Math.max(0, this.gateHp)} HP)`, true);
    if (this.gateHp <= 0 && !this.over)
      this.end(false, 'La puerta ha caído. El distrito está perdido.');
  }

  _onCartHit(dmg, titan) {
    if (!this.cart) return;
    this.cart.hp -= dmg;
    this.msg(`¡Destrozan la carreta! (${Math.max(0, this.cart.hp)} HP)`, true);
    if (this.cart.hp <= 0 && !this.over) {
      this.cart.mesh.visible = false;
      this.end(false, 'La carreta quedó hecha astillas. Misión fracasada.');
    }
  }

  _onAllyDown(ally, eaten) {
    this.result.downed.push([ally.soldier, eaten]);
    for (const a of this.allies) if (a !== ally) a.onAllyDeathNearby(ally.pos, this.ctx);
  }

  _onPlayerDown(eaten) {
    this.result.downed.push([this.player.soldier, eaten]);
    if (!this.over)
      this.end(false, eaten ? 'Las fauces se cierran. Todo se vuelve negro.'
                            : 'Has caído. El escuadrón se retira arrastrando tu cuerpo.');
  }

  // ------------------------------------------------------------ update
  update(rawDt) {
    if (this.paused || this.over && this.endTimer < 0) return;
    // recuperación del slow-mo
    this.timeScale += (1 - this.timeScale) * Math.min(1, rawDt * 2.4);
    if (this.timeScale > 0.98) this.timeScale = 1;
    const dt = rawDt * this.timeScale;
    this.time += dt;

    if (!this.over) {
      this.player.update(dt, this.input, this.titans, this.ctx);
      this.input.mouseDX = 0;
      this.input.mouseDY = 0;
      for (const a of this.allies) a.update(dt, this.ctx);
      for (const t of this.titans) t.update(dt, this.ctx);
      // limpiar muertos
      for (let i = this.titans.length - 1; i >= 0; i--) {
        if (this.titans[i].dead) {
          this.app.scene.remove(this.titans[i].group);
          this.titans.splice(i, 1);
        }
      }
      this._updateSupplies(dt);
      this._updateCart(dt);
      this._updateWaves();
      this._updateSeal(dt);
      this._checkObjectives();
      this._updateHud();
    }

    // screen shake
    if (this.shake > 0) {
      this.shake -= rawDt;
      this.app.camera.position.x += (Math.random() - 0.5) * this.shake * 1.6;
      this.app.camera.position.y += (Math.random() - 0.5) * this.shake * 1.6;
    }
    updateFx(this.app.scene, dt);

    if (this.over && this.endTimer >= 0) {
      this.endTimer -= rawDt;
      if (this.endTimer <= 0) {
        this.endTimer = -1;
        this._finish();
      }
    }
  }

  _updateSupplies(dt) {
    for (const s of this.supplies) {
      if (s.taken) continue;
      s.ring.rotation.z += dt * 2;
      s.mesh.rotation.y += dt * 1.5;
      if (this.player.pos.distanceTo(s.mesh.position) < 3.5) {
        s.taken = true;
        s.mesh.visible = false;
        s.ring.visible = false;
        const roll = Math.random();
        if (roll < 0.45) {
          this.player.gas = Math.min(this.player.gas + S.maxGas(this.gs) * 0.35, S.maxGas(this.gs) * 1.2);
          this.result.loot.gas = (this.result.loot.gas || 0) + 8;
          this.msg('Recargas gas de un depósito abandonado.');
        } else if (roll < 0.75) {
          this.player.blades.push(S.bladeEdge(this.gs));
          this.result.loot.hojas = (this.result.loot.hojas || 0) + 1;
          this.msg('Recoges un par de hojas de repuesto.');
        } else {
          const amt = 2 + Math.floor(Math.random() * 4);
          this.result.loot.comida = (this.result.loot.comida || 0) + amt;
          this.msg(`Encuentras provisiones (+${amt} comida).`);
        }
        sparks(this.app.scene, s.mesh.position);
        sfx.pickup();
      }
    }
  }

  _updateCart(dt) {
    if (!this.cart || this.cart.hp <= 0) return;
    const danger = this.titans.some(t => !t.dummy &&
      Math.hypot(t.pos.x - this.cart.x, t.pos.z - this.cart.z) < 30);
    if (!danger) {
      this.cart.x += this.cart.speed * dt;
      this.cart.mesh.position.x = this.cart.x;
      this.cart.mesh.rotation.y = Math.PI / 2;
    }
    if (this.cart.x >= this.spec.cart.destX && !this.over)
      this.end(true, '¡La carreta cruza a salvo! Las familias comerán este invierno.');
  }

  _updateWaves() {
    if (!this.spec.waves.length || this.waveIdx >= this.spec.waves.length) return;
    if (this.titans.length === 0) {
      const wave = this.spec.waves[this.waveIdx++];
      sfx.alarm();
      this.msg(`— OLEADA ${this.waveIdx + 1} — ¡${wave.length} titanes a la vista!`, true);
      for (const w of wave)
        this.titans.push(new Titan(this.app.scene, w.kind, new THREE.Vector3(w.x, 0, w.z), w.opts || {}));
      // reabastecimiento parcial
      this.player.gas = Math.min(this.player.gas + S.maxGas(this.gs) * 0.3, S.maxGas(this.gs));
      for (const a of this.allies) a.gas = Math.min(a.gas + 30, S.maxGas(this.gs));
      this.msg('Reabastecimiento rápido: gas extra para todos.');
    }
  }

  _updateSeal(dt) {
    if (!this.spec.sealTarget || this.over) return;
    const danger = this.titans.some(t =>
      Math.hypot(t.pos.x - this.gate.x, t.pos.z - this.gate.z) < 55);
    if (!danger) {
      this.sealProgress += dt;
      if (this.sealProgress >= this.spec.sealTarget)
        this.end(true, '¡LA PUERTA ESTÁ SELLADA! El Muro María vuelve a ser nuestro.');
    }
  }

  _checkObjectives() {
    if (this.over) return;
    const mode = this.spec.mode;
    const remaining = this.titans.length + (this.spec.waves.length - this.waveIdx > 0 ? 1 : 0);
    if (mode === 'hunt' && !this.titans.some(t => t.marked))
      return this.end(true, 'El Anormal ha caído. Los escuadrones serán vengados.');
    if ((mode === 'tutorial' || mode === 'exterminate') && remaining === 0)
      return this.end(true, mode === 'tutorial'
        ? 'Entrenamiento completado. El instructor asiente en silencio.'
        : 'Zona despejada. Ni un titán en pie.');
    if (mode === 'defense' && this.waveIdx >= this.spec.waves.length && this.titans.length === 0)
      return this.end(true, '¡Todas las oleadas repelidas! La puerta resiste.');
  }

  end(success, text, retreat = false) {
    if (this.over) return;
    this.over = true;
    this.result.success = success;
    this.result.retreat = retreat;
    this.result.summary.push(text);
    this.msg(text, !success);
    this.endTimer = 2.0;
  }

  _finish() {
    // devolver equipo no gastado
    const edge = S.bladeEdge(this.gs);
    let gasBack = 0, pairsBack = 0;
    if (!this.player.downed) {
      gasBack += Math.floor(this.player.gas);
      pairsBack += this.player.blades.length;
    }
    for (const a of this.allies) {
      if (!a.downed) {
        gasBack += Math.floor(a.gas);
        pairsBack += Math.floor(a.bladeUses / edge);
      }
    }
    this.gs.resources.gas += gasBack;
    this.gs.resources.hojas += pairsBack;
    this.result.gasLeft = gasBack;
    this.result.pairsLeft = pairsBack;
    this.dispose();
    this.app.onMissionEnd(this.result);
  }

  _updateHud() {
    const hud = this.app.hud;
    hud.setHp(this.player.hp);
    hud.setGas(this.player.gas / Math.max(1, S.maxGas(this.gs)));
    hud.setBlades(this.player.blades.length, this.player.currentEdge());
    hud.setSquad([this.player, ...this.allies]);
    hud.setSpears(this.player.spears);
    hud.setRage(this.gs.titanPower, this.player.rage / 100, this.player.titanForm);
    // marcador en pantalla por prioridad: enganchado > nuca > anclaje > atacante de la puerta
    let markPos = null, markText = '', markMode = 'nape';
    if (this.player.hooked && !this.player.hooked.dead) {
      markPos = this.player.hooked.napePos(_mark);
      markText = '¡CORTA!';
      markMode = 'hooked';
    } else {
      const t = this.player.findHookTarget(this.titans);
      if (t) {
        markPos = t.napePos(_mark);
        markText = 'NUCA · clic der';
      } else {
        const a = this.player.findAnchor(this.anchors);
        if (a) {
          markPos = _mark.copy(a);
          markText = 'IMPULSO · clic der';
          markMode = 'anchor';
        } else if (this.gate) {
          const atk = this.titans.find(tt => !tt.dummy
            && Math.hypot(tt.pos.x - this.gate.x, tt.pos.z - this.gate.z) < 35);
          if (atk) {
            markPos = atk.napePos(_mark);
            markText = '‼ ¡LA PUERTA!';
            markMode = 'alert';
          }
        }
      }
    }
    hud.setCrosshair(!!markPos && markMode !== 'alert');
    hud.setMarker(markPos, this.app.camera, markText, markMode);
    hud.setGrab(this.player.grabbedBy ? this.player.struggle / this.player.struggleNeed : -1);

    let extra = `Titanes: <b>${this.titans.filter(t => !t.dummy || this.spec.mode === 'tutorial').length}</b>`;
    if (this.gate && this.gateHp) extra += ` · Puerta: <b>${Math.max(0, this.gateHp)} HP</b>`;
    if (this.spec.waves.length)
      extra += ` · Oleada <b>${Math.min(this.waveIdx + 1, this.spec.waves.length + 1)}/${this.spec.waves.length + 1}</b>`;
    if (this.cart) extra += ` · Carreta: <b>${Math.max(0, this.cart.hp)} HP</b>`;
    if (this.spec.sealTarget) extra += ` · Sellado: <b>${Math.floor(this.sealProgress / this.spec.sealTarget * 100)}%</b>`;
    hud.setObjective(`${this.spec.objectiveText}<br>${extra}`);

    const boss = this.titans.find(t => t.marked) ||
                 this.titans.find(t => t.kind === 'grande' && !t.dummy);
    hud.setBoss(boss ? { name: boss.spec.name, pct: Math.max(0, boss.hp / boss.maxHp) } : null);
  }

  dispose() {
    this._teardownInput();
    this.player.dispose();
    for (const a of this.allies) a.dispose();
    clearFx(this.app.scene);
    // limpiar escena completa (se reconstruye por misión)
    const scene = this.app.scene;
    for (let i = scene.children.length - 1; i >= 0; i--) scene.remove(scene.children[i]);
  }
}

// ================================================================ consecuencias
export function applyMissionResult(gs, result, squad) {
  // botín y mérito
  for (const [k, v] of Object.entries(result.loot))
    gs.resources[k] = (gs.resources[k] || 0) + v;
  let merito = result.titansKilled * 12 + (result.success ? 25 : 5) + (result.bonusMerito || 0);
  gs.resources.merito += merito;
  result.loot.merito = merito;
  gs.titansKilled += result.titansKilled;

  // XP
  for (const s of squad) {
    const k = result.kills[s.name] || 0;
    s.kills += k;
    s.missions += 1;
    const xp = k * S.CFG.XP_KILL + (result.success ? S.CFG.XP_MISSION : 8);
    result.summary.push(...S.gainXp(s, xp));
  }

  // caídos: devorados mueren seguro; el resto tira por su vida
  for (const [soldier, eaten] of result.downed) {
    if (eaten) {
      S.killSoldier(gs, soldier, 'devorado por un titán');
      result.summary.push(`✖ ${soldier.name} — DEVORADO. Se une al memorial.`);
    } else if (Math.random() < S.injuryDeath(gs)) {
      S.killSoldier(gs, soldier, 'heridas mortales en combate');
      result.summary.push(`✖ ${soldier.name} muere de sus heridas. Se une al memorial.`);
    } else {
      soldier.injuredDays = S.rint(...S.CFG.INJURY_DAYS);
      result.summary.push(`⚕ ${soldier.name} sobrevive de milagro: ${soldier.injuredDays} días en el hospital.`);
    }
  }
}

const _mark = new THREE.Vector3();
const _mv = new THREE.Vector3();
function _lastMove(input, yaw) {
  _mv.set(0, 0, 0);
  if (input.keys['w']) { _mv.x += Math.sin(yaw); _mv.z += Math.cos(yaw); }
  if (input.keys['s']) { _mv.x -= Math.sin(yaw); _mv.z -= Math.cos(yaw); }
  if (input.keys['a']) { _mv.x += Math.cos(yaw); _mv.z -= Math.sin(yaw); }
  if (input.keys['d']) { _mv.x -= Math.cos(yaw); _mv.z += Math.sin(yaw); }
  return _mv;
}
