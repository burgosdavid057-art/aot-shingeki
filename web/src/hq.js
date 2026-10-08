// Menús: título, slots, cuartel, expediciones, capítulos, informes.
import * as S from './state.js';
import { Mission, applyMissionResult, tutorialSpec, defenseSpec, escortSpec,
         huntSpec, finalSpec1, finalSpec2, fieldSpec, specialSpec } from './combat.js';

const layer = () => document.getElementById('menu-layer');
const content = () => document.getElementById('menu-content');

function show(html) {
  layer().classList.remove('hidden');
  content().innerHTML = html;
  return content();
}
export function hideMenu() { layer().classList.add('hidden'); }

function resBar(gs) {
  const r = gs.resources;
  return `<div class="res-bar">
    <span class="day">Día <b>${gs.day}</b></span>
    <span class="gas">⛽ Gas <b>${r.gas}</b></span>
    <span class="blades">⚔ Hojas <b>${r.hojas}</b></span>
    <span class="food">🍞 Comida <b>${r.comida}</b></span>
    <span class="merit">★ Mérito <b>${r.merito}</b></span>
    <span class="wall">🧱 Muralla <b>${gs.wallHp}/100</b></span>
  </div>`;
}

function soldierCard(s, extra = '') {
  const trait = s.trait ? ` <span class="trait">(${S.TRAITS[s.trait].name})</span>` : '';
  const you = s.isPlayer ? ' <span class="you">« TÚ »</span>' : '';
  const hurt = s.injuredDays > 0 ? ` <span class="hurt">(herido, ${s.injuredDays}d)</span>` : '';
  const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  let hue = 0;
  for (const ch of s.name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  const bar = (cls, label, v) =>
    `<div class="sbar ${cls}">${label} ${v}<div class="track"><div class="fill" style="width:${Math.min(100, v * 10)}%;background:currentColor"></div></div></div>`;
  return `<div class="soldier-card">
    <div class="avatar" style="background:hsl(${hue},45%,${s.isPlayer ? 42 : 30}%)">${initials}</div>
    <div class="info">
      <span class="nm">${s.name}</span>${you}${trait}${hurt}
      <div class="meta">${S.rankOf(s)} niv.${s.level} · ☠ ${s.kills} titanes · ${s.missions} misiones ${extra}</div>
      <div class="stats-bars">
        ${bar('stat-f', 'FUE', s.strength)}${bar('stat-a', 'AGI', s.agility)}
        ${bar('stat-p', 'PRE', s.precision)}${bar('stat-v', 'VAL', s.courage)}
      </div>
    </div>
  </div>`;
}

// ================================================================ HQ principal
export class Hq {
  constructor(app) {
    this.app = app;       // {gs, slot, startMission(spec, squad, cb), hud}
  }

  get gs() { return this.app.gs; }

  save() { S.saveGame(this.gs, this.app.slot); }

  // ------------------------------------------------------------ pantalla principal
  cuartel(notices = []) {
    const gs = this.gs;
    // condiciones de fin
    if (gs.victory) return this.victory();
    if (gs.wallHp <= 0) return this.gameOver('La muralla ha caído. Los titanes entran al distrito y la campana suena por última vez.');
    if (!S.living(gs).length) return this.gameOver('No queda nadie de tu brigada. El Cuerpo de Exploración borra su número de los registros.');
    if (!S.player(gs)) return this.chooseAvatar();

    const cap = gs.chapter <= S.CHAPTERS.length ? S.CHAPTERS[gs.chapter - 1] : null;
    const alert = gs.wallAlertActive;
    let html = `<h2>CUARTEL DEL CUERPO DE EXPLORACIÓN</h2>${resBar(gs)}`;
    for (const n of notices) html += `<p class="warn-t">⚠ ${n}</p>`;
    if (alert) html += `<p class="bad-t" style="font-size:18px">‼ ¡¡TITANES EN LA MURALLA!! La guarnición pide refuerzos YA.</p>`;

    html += `<div id="actions" class="action-grid"></div>
      <p class="small-note">Los soldados muertos no vuelven. La muralla no se repara sola. Elige bien.</p>
      <p class="version-tag">${S.VERSION}</p>`;
    const el = show(html);
    const actions = el.querySelector('#actions');
    const btn = (ico, title, sub, cb, cls = 'btn') => {
      const b = document.createElement('button');
      b.className = cls;
      b.innerHTML = `<span class="ico">${ico}</span><span class="btn-body"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>`;
      b.onclick = cb;
      actions.appendChild(b);
      return b;
    };

    if (alert) {
      btn('🚨', '¡DEFENDER LA MURALLA!', 'Combate de oleadas. Si fallas, la muralla sufrirá.',
        () => this.wallDefense(), 'btn primary');
      btn('🏃', 'Ignorar la alerta', 'La guarnición la contendrá sola... a un costo terrible.',
        () => this.ignoreAlert(), 'btn danger wide');
    } else {
      if (cap) {
        const locked = cap.requiresTech && !S.hasTech(gs, cap.requiresTech);
        btn('🗡', `HISTORIA — Capítulo ${cap.id}: ${cap.title}`,
          locked ? '🔒 Requiere investigar «Plan de Reconquista»' : 'Misión principal',
          () => locked ? null : this.chapterIntro(cap), locked ? 'btn disabled wide' : 'btn primary');
      }
      btn('🐎', 'Salir de expedición', 'Gas, botín y mérito más allá de las murallas. Y titanes.',
        () => this.exploreMenu(), 'btn wide');
    }
    btn('🏋', 'Entrenar a un soldado', '+1 stat · 4 comida · 1 día', () => this.train());
    btn('🪖', 'Reclutar', '8 comida · 1 día', () => this.recruit());
    btn('⚒', 'Forja y refinería', '+2 hojas, +3 gas · 3 comida · 1 día', () => this.forge());
    btn('🛌', 'Descansar', 'cura heridos · +2 comida · 1 día', () => this.rest());
    btn('🧪', 'Árbol de progresión (I+D)', 'investiga mejoras con mérito', () => this.research());
    btn('⚔', 'Armería y vestuario', 'armas, lanzas trueno y skins desbloqueables', () => this.armory());
    btn('🪦', 'Tropa y memorial', 'tu gente, viva y caída', () => this.roster());
    btn('💾', 'Guardar y salir', 'al menú principal', () => { this.save(); this.app.toTitle(); });
  }

  passDays(n) {
    const msgs = S.passDays(this.gs, n);
    return msgs;
  }

  // ------------------------------------------------------------ acciones de cuartel
  train() {
    const gs = this.gs;
    if (gs.resources.comida < S.CFG.TRAIN_FOOD) return this.cuartel(['Entrenar cuesta 4 de comida y no te alcanza.']);
    const cands = S.activeRoster(gs);
    const el = show(`<h2>ENTRENAMIENTO</h2>${resBar(gs)}<div id="list"></div><button class="btn" id="back">← Volver</button>`);
    const list = el.querySelector('#list');
    for (const s of cands) {
      const wrap = document.createElement('div');
      wrap.innerHTML = soldierCard(s);
      const row = document.createElement('div');
      row.className = 'row';
      for (const [attr, nm] of [['strength', 'Fuerza'], ['agility', 'Agilidad'], ['precision', 'Precisión'], ['courage', 'Valentía']]) {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = `+1 ${nm}`;
        b.onclick = () => {
          gs.resources.comida -= S.CFG.TRAIN_FOOD;
          s[attr] += 1;
          S.gainXp(s, 15);
          const msgs = this.passDays(1);
          this.save();
          this.cuartel([`${s.name} entrena ${nm.toLowerCase()} hasta el agotamiento (+1).`, ...msgs]);
        };
        row.appendChild(b);
      }
      wrap.appendChild(row);
      list.appendChild(wrap);
    }
    el.querySelector('#back').onclick = () => this.cuartel();
  }

  recruit() {
    const gs = this.gs;
    if (gs.resources.comida < S.CFG.RECRUIT_FOOD) return this.cuartel(['Alistar a un recluta cuesta 8 de comida.']);
    if (S.living(gs).length >= 9) return this.cuartel(['El cuartel está lleno (máx. 9 soldados).']);
    const nuevo = S.randomSoldier(gs.day > 25);
    gs.resources.comida -= S.CFG.RECRUIT_FOOD;
    gs.soldiers.push(nuevo);
    const msgs = this.passDays(1);
    this.save();
    this.cuartel([`¡${nuevo.name} se une al Cuerpo de Exploración!`, ...msgs]);
  }

  forge() {
    const gs = this.gs;
    if (gs.resources.comida < S.CFG.FORGE_FOOD) return this.cuartel(['La forja necesita 3 de comida para los herreros.']);
    gs.resources.comida -= S.CFG.FORGE_FOOD;
    gs.resources.hojas += 2;
    gs.resources.gas += 30;
    const msgs = this.passDays(1);
    this.save();
    this.cuartel(['La forja trabaja toda la noche: +2 pares de hojas, +30 de gas refinado.', ...msgs]);
  }

  rest() {
    const gs = this.gs;
    gs.resources.comida += 2;
    const msgs = this.passDays(1);
    this.save();
    this.cuartel(['Día de descanso. Los soldados duermen, comen y afilan hojas.', ...msgs]);
  }

  research() {
    const gs = this.gs;
    let html = `<h2>ÁRBOL DE PROGRESIÓN — I+D</h2>${resBar(gs)}`;
    const branches = {};
    for (const [k, t] of Object.entries(S.TECH_TREE)) (branches[t.branch] ??= []).push(k);
    for (const [branch, keys] of Object.entries(branches)) {
      html += `<h3>${branch}</h3>`;
      for (const k of keys) {
        const t = S.TECH_TREE[k];
        const owned = gs.techs.includes(k);
        const locked = t.req && !gs.techs.includes(t.req);
        const cls = owned ? 'tech owned' : locked ? 'tech locked' : 'tech';
        const tail = owned ? '<span class="ok">✔ investigada</span>'
          : locked ? `🔒 requiere ${S.TECH_TREE[t.req].name}`
          : `<button class="btn" style="display:inline-block;width:auto;padding:4px 14px" data-tech="${k}">Investigar (★${t.cost})</button>`;
        html += `<div class="${cls}"><b>${t.name}</b> — ${t.desc} ${tail}</div>`;
      }
    }
    html += `<button class="btn" id="back" style="margin-top:14px">← Volver</button>`;
    const el = show(html);
    el.querySelectorAll('[data-tech]').forEach(b => {
      b.onclick = () => {
        const [ok, msg] = S.research(gs, b.dataset.tech);
        this.save();
        if (ok) this.research();
        else this.cuartel([msg]);
      };
    });
    el.querySelector('#back').onclick = () => this.cuartel();
  }

  armory() {
    const gs = this.gs;
    let html = `<h2>ARMERÍA Y VESTUARIO</h2>${resBar(gs)}<h3>Hojas de combate</h3><div id="weapons"></div>`;
    html += `<h3>Equipo especial</h3><div id="spears"></div>`;
    html += `<h3>Capas (se desbloquean jugando)</h3><div id="skins"></div>`;
    html += `<button class="btn" id="back" style="margin-top:14px">← Volver</button>`;
    const el = show(html);

    const wBox = el.querySelector('#weapons');
    for (const [key, w] of Object.entries(S.WEAPONS)) {
      const locked = w.req?.tech && !S.hasTech(gs, w.req.tech);
      const active = gs.weapon === key;
      const b = document.createElement('button');
      b.className = `btn ${active ? 'primary' : ''} ${locked ? 'disabled' : ''}`;
      b.innerHTML = `<b>${w.name}</b> ${active ? '— EQUIPADAS ✔' : ''}<small>${w.desc}${locked ? ` 🔒 requiere ${S.TECH_TREE[w.req.tech].name}` : ''}</small>`;
      b.onclick = () => { if (!locked) { gs.weapon = key; this.save(); this.armory(); } };
      wBox.appendChild(b);
    }

    const sBox = el.querySelector('#spears');
    const spearsLocked = gs.chapter < S.SPEARS.reqChapter;
    const sb = document.createElement('button');
    sb.className = `btn ${gs.spearsEquipped ? 'primary' : ''} ${spearsLocked ? 'disabled' : ''}`;
    sb.innerHTML = `<b>⚡ ${S.SPEARS.name}</b> ${gs.spearsEquipped ? '— EQUIPADAS ✔' : ''}<small>${S.SPEARS.desc}${spearsLocked ? ` 🔒 supera el capítulo ${S.SPEARS.reqChapter - 1}` : ''}</small>`;
    sb.onclick = () => { if (!spearsLocked) { gs.spearsEquipped = !gs.spearsEquipped; this.save(); this.armory(); } };
    sBox.appendChild(sb);

    const kBox = el.querySelector('#skins');
    for (const [key, sk] of Object.entries(S.SKINS)) {
      const unlocked = sk.unlocked(gs);
      const active = gs.skin === key;
      const b = document.createElement('button');
      b.className = `btn ${active ? 'primary' : ''} ${unlocked ? '' : 'disabled'}`;
      const swatch = `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#${sk.color.toString(16).padStart(6, '0')};margin-right:8px;vertical-align:middle"></span>`;
      b.innerHTML = `${swatch}<b>${sk.name}</b> ${active ? '— PUESTA ✔' : ''}<small>${unlocked ? 'desbloqueada' : `🔒 ${sk.hint}`}</small>`;
      b.onclick = () => { if (unlocked) { gs.skin = key; this.save(); this.armory(); } };
      kBox.appendChild(b);
    }
    el.querySelector('#back').onclick = () => this.cuartel();
  }

  roster() {
    const gs = this.gs;
    let html = `<h2>TU TROPA</h2>${resBar(gs)}`;
    for (const s of S.living(gs)) html += soldierCard(s);
    html += `<h3>═══ MEMORIAL DE LOS CAÍDOS ═══</h3>`;
    if (!gs.fallen.length) html += `<p class="small-note">El memorial está vacío. Que siga así mucho tiempo.</p>`;
    for (const f of gs.fallen)
      html += `<div class="memorial-entry">† <b>${f.name}</b> — nivel ${f.level}, ${f.kills} titanes — día ${f.day} — <i>${f.cause}</i></div>`;
    html += `<p class="small-note center">«Dedicad vuestros corazones.»</p>
      <button class="btn" id="back">← Volver</button>`;
    show(html).querySelector('#back').onclick = () => this.cuartel();
  }

  // ------------------------------------------------------------ selección de escuadrón
  selectSquad(then) {
    const gs = this.gs;
    const p = S.player(gs);
    if (!p || p.injuredDays > 0) return this.cuartel(['Tu personaje no está en condiciones de salir.']);
    const cands = S.activeRoster(gs).filter(s => !s.isPlayer);
    const chosen = new Set(cands.slice(0, 4).map(s => s.name));
    const render = () => {
      let html = `<h2>ELIGE TU ESCUADRÓN</h2>
        <p>Tú lideras. Hasta <b>4 acompañantes</b>. Recuerda: los muertos no vuelven.</p><div id="list"></div>
        <button class="btn primary" id="go">— PARTIR (${1 + chosen.size} soldados) —</button>
        <button class="btn" id="back">← Cancelar</button>`;
      const el = show(html);
      const list = el.querySelector('#list');
      list.innerHTML = soldierCard(p) + cands.map(s => {
        const sel = chosen.has(s.name);
        return `<div data-n="${s.name}" style="cursor:pointer;border-radius:6px;outline:${sel ? '2px solid #5ad8e8' : 'none'}">${soldierCard(s, sel ? '<b class="ok">✔ va contigo</b>' : '<span class="small-note">(click para incluir)</span>')}</div>`;
      }).join('');
      list.querySelectorAll('[data-n]').forEach(d => {
        d.onclick = () => {
          const n = d.dataset.n;
          if (chosen.has(n)) chosen.delete(n);
          else if (chosen.size < 4) chosen.add(n);
          render();
        };
      });
      el.querySelector('#go').onclick = () => then([p, ...cands.filter(s => chosen.has(s.name))]);
      el.querySelector('#back').onclick = () => this.cuartel();
    };
    render();
  }

  // ------------------------------------------------------------ informes
  report(result, then) {
    const ok = result.success;
    let html = `<h2>${ok ? '✔ MISIÓN CUMPLIDA' : result.retreat ? '⚠ RETIRADA' : '✖ MISIÓN FRACASADA'}</h2>`;
    html += `<p>Titanes abatidos: <b>${result.titansKilled}</b> · Mérito: <b class="merit">+${result.loot.merito || 0}</b></p>`;
    const loot = Object.entries(result.loot).filter(([k]) => k !== 'merito');
    if (loot.length) html += `<p>Botín: ${loot.map(([k, v]) => `${v} ${k}`).join(', ')}</p>`;
    for (const line of result.summary) html += `<p>· ${line}</p>`;
    html += `<button class="btn primary" id="ok">Continuar</button>`;
    show(html).querySelector('#ok').onclick = then;
  }

  // ------------------------------------------------------------ misiones
  runMissionFlow(spec, squad, after) {
    hideMenu();
    this.app.startMission(spec, squad, (result) => {
      applyMissionResult(this.gs, result, squad);
      this.save();
      this.report(result, () => after(result));
    });
  }

  wallDefense() {
    this.selectSquad((squad) => {
      this.runMissionFlow(defenseSpec(this.gs), squad, (result) => {
        const gs = this.gs;
        S.scheduleWallAlert(gs);
        const notices = [];
        if (!result.success) {
          const dmg = S.CFG.WALL_IGNORE_DMG + S.rint(0, 8);
          gs.wallHp = Math.max(0, gs.wallHp - dmg);
          notices.push(`La muralla sufre daños graves (−${dmg}). Estado: ${gs.wallHp}/100.`);
        } else {
          gs.resources.merito += 15;
        }
        this.save();
        this.cuartel(notices);
      });
    });
  }

  ignoreAlert() {
    const gs = this.gs;
    const dmg = S.CFG.WALL_IGNORE_DMG + S.rint(0, 6);
    gs.wallHp = Math.max(0, gs.wallHp - dmg);
    S.scheduleWallAlert(gs);
    this.save();
    this.cuartel([`La guarnición contiene el ataque sin ti... a un costo terrible. Muralla −${dmg} (${gs.wallHp}/100).`]);
  }

  // ------------------------------------------------------------ capítulos
  chapterIntro(cap) {
    const html = `<h2>CAPÍTULO ${cap.id} — ${cap.title}</h2>
      <p style="white-space:pre-line;font-style:italic">${cap.intro}</p>
      <button class="btn primary" id="go">Partir</button>
      <button class="btn" id="back">← Aún no</button>`;
    const el = show(html);
    el.querySelector('#go').onclick = () => this.selectSquad((squad) => this.runChapter(cap, squad));
    el.querySelector('#back').onclick = () => this.cuartel();
  }

  runChapter(cap, squad) {
    const specs = { tutorial: tutorialSpec, defense: () => defenseSpec(this.gs, true), escort: escortSpec, hunt: huntSpec, final: finalSpec1 };
    const spec = specs[cap.type]();
    this.runMissionFlow(spec, squad, (result) => {
      const gs = this.gs;
      if (cap.type === 'final' && result.success) {
        // fase 2
        const squad2 = squad.filter(s => s.alive && s.injuredDays === 0);
        if (!squad2.some(s => s.isPlayer)) {
          this.passDays(1);
          return this.cuartel(['No quedan fuerzas para la fase 2. La operación se cancela.']);
        }
        const el = show(`<h2>FASE 2 — El equipo de sellado entra por la brecha</h2>
          <p>No hay tiempo para llorar a nadie. La puerta debe quedar sellada HOY.</p>
          <button class="btn primary" id="go">Avanzar</button>`);
        el.querySelector('#go').onclick = () => {
          this.runMissionFlow(finalSpec2(), squad2, (r2) => {
            this.passDays(1);
            if (r2.success) gs.victory = true;
            this.save();
            this.cuartel();
          });
        };
        return;
      }
      const msgs = this.passDays(1);
      if (result.success) gs.chapter += 1;
      this.save();
      // el cazador despierta algo en la sangre: el PODER DEL TITÁN
      if (cap.type === 'hunt' && result.success && !gs.titanPower) {
        gs.titanPower = true;
        this.save();
        const el = show(`<h2>EL DESPERTAR</h2>
          <p style="font-style:italic">Al arrancar la nuca del Anormal, algo te quema en la sangre.
          Un recuerdo que no es tuyo. Un rayo. Dolor. Y un poder que ruge por salir.</p>
          <p><b class="warn-t">⚡ PODER DEL TITÁN DESBLOQUEADO</b></p>
          <p>En misión, tu barra de <b>FURIA</b> se llena matando titanes (+30) y recibiendo golpes (+15).
          Al llegar a 100, pulsa <kbd>F</kbd> para transformarte en el <b>TITÁN DE ATAQUE</b> durante 25 segundos:
          puños devastadores (clic izquierdo) que rompen hasta armaduras, inmune a agarres.</p>
          <p class="small-note">El poder protege tu cuerpo: el daño recibido solo acorta la transformación.</p>
          <button class="btn primary" id="ok">«...que tiemblen ellos ahora»</button>`);
        el.querySelector('#ok').onclick = () => this.cuartel(msgs);
        return;
      }
      this.cuartel(msgs);
    });
  }

  // ------------------------------------------------------------ expediciones
  exploreMenu() {
    const tiers = [
      { key: 'cercana', name: 'Cercana', nodes: 3, days: 1, danger: 1, loot: 1.0 },
      { key: 'media', name: 'Media', nodes: 4, days: 2, danger: 2, loot: 1.6 },
      { key: 'lejana', name: 'Lejana', nodes: 5, days: 3, danger: 3, loot: 2.4 },
    ];
    let html = `<h2>EXPEDICIÓN — ¿hasta dónde te aventuras?</h2>${resBar(this.gs)}<div id="t"></div>
      <button class="btn" id="back">← Volver</button>`;
    const el = show(html);
    const box = el.querySelector('#t');
    for (const t of tiers) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.innerHTML = `<b>${t.name}</b><small>${t.nodes} tramos · ${t.days} día(s) · riesgo ${'☠'.repeat(t.danger)} · botín ×${t.loot}</small>`;
      b.onclick = () => this.selectSquad((squad) => this.runExploration(t, squad, 1));
      box.appendChild(b);
    }
    el.querySelector('#back').onclick = () => this.cuartel();
  }

  runExploration(tier, squad, node) {
    const gs = this.gs;
    if (node === 1) gs.expeditions += 1;
    if (node > tier.nodes) return this.endExploration(tier, ['La columna regresa con el botín completo. Expedición ejemplar.']);

    const weights = { 1: [28, 25, 15, 10, 8, 12, 4], 2: [41, 20, 15, 8, 7, 5, 7], 3: [49, 15, 14, 6, 7, 3, 10] }[tier.danger];
    const events = ['titanes', 'suministros', 'ruinas', 'refugiados', 'clima', 'calma', 'especial'];
    let event = node === tier.nodes ? (Math.random() < 0.5 ? 'titanes' : 'ruinas') : weightedPick(events, weights);

    const proceed = (lines) => {
      let html = `<h2>EXPEDICIÓN ${tier.name.toUpperCase()} — Tramo ${node}/${tier.nodes}</h2>${resBar(gs)}`;
      for (const l of lines) html += `<p>${l}</p>`;
      html += `<button class="btn primary" id="go">Seguir adelante</button>
        <button class="btn" id="back">Regresar a la muralla (conservas el botín)</button>`;
      const el = show(html);
      el.querySelector('#go').onclick = () => this.runExploration(tier, squad, node + 1);
      el.querySelector('#back').onclick = () => this.endExploration(tier, ['Das media vuelta. El botín llega a casa.']);
    };

    if (event === 'titanes' || event === 'especial' || (event === 'ruinas' && Math.random() < 0.4)) {
      const esEspecial = event === 'especial';
      const intro = esEspecial
        ? 'El suelo tiembla con un ritmo que no es de titán normal. Los caballos enloquecen.<br><b>UNO DE LOS NUEVE ESTÁ AQUÍ.</b> Derrotarlo daría un mérito legendario... huir también es opción.'
        : event === 'ruinas' ? 'Ruinas de una aldea... y algo se mueve entre las casas. ¡EMBOSCADA!' : '¡Titanes en el horizonte! La columna desenvaina.';
      const el = show(`<h2>Tramo ${node}/${tier.nodes}</h2><p class="bad-t">${intro}</p>
        <button class="btn primary" id="go">${esEspecial ? '¡Plantarle cara!' : '¡A las armas!'}</button>
        ${esEspecial ? '<button class="btn" id="flee">Rodearlo en silencio (continuar sin pelear)</button>' : ''}`);
      if (esEspecial) el.querySelector('#flee').onclick = () => {
        if (node >= tier.nodes) return this.endExploration(tier, ['Rodeaste al coloso. Vivirás para contarlo... sin gloria.']);
        this.runExploration(tier, squad, node + 1);
      };
      el.querySelector('#go').onclick = () => {
        const alive = squad.filter(s => s.alive && s.injuredDays === 0);
        this.runMissionFlow(esEspecial ? specialSpec(tier.danger) : fieldSpec(tier.danger), alive, (result) => {
          const stillOk = result.success && S.player(gs) && S.player(gs).injuredDays === 0;
          if (!stillOk) return this.endExploration(tier, ['La expedición da media vuelta hacia la muralla.']);
          if (node >= tier.nodes) return this.endExploration(tier, ['Último tramo superado. La columna vuelve a casa.']);
          proceed(['Zona despejada. La columna respira... por ahora.']);
        });
      };
      return;
    }
    const lines = [];
    const mult = tier.loot;
    if (event === 'ruinas') {
      const g = Math.floor(S.rint(15, 40) * mult), h = Math.floor(S.rint(0, 2) * mult);
      gs.resources.gas += g; gs.resources.hojas += h;
      lines.push(`<span class="ok">Ruinas saqueables: +${g} gas, +${h} pares de hojas.</span>`);
    } else if (event === 'suministros') {
      const g = Math.floor(S.rint(10, 25) * mult), c = Math.floor(S.rint(3, 6) * mult);
      gs.resources.gas += g; gs.resources.comida += c;
      lines.push(`<span class="ok">Carreta militar abandonada: +${g} gas, +${c} comida.</span>`);
    } else if (event === 'refugiados') {
      const m = Math.floor(S.rint(8, 15) * mult);
      gs.resources.merito += m;
      lines.push(`<span class="ok">Escoltas refugiados a un fuerte cercano. +${m} mérito.</span>`);
      if (Math.random() < 0.35 && S.living(gs).length < 9) {
        const nuevo = S.randomSoldier();
        gs.soldiers.push(nuevo);
        lines.push(`<span class="ok">Uno de ellos sabe pelear: ¡${nuevo.name} se une!</span>`);
      }
    } else if (event === 'clima') {
      const p = Math.min(gs.resources.gas, S.rint(8, 20));
      gs.resources.gas -= p;
      lines.push(`<span class="warn-t">Tormenta repentina: fugas en los tanques (−${p} gas).</span>`);
    } else {
      lines.push('Campos en silencio. Nada en el horizonte. Se agradece.');
    }
    this.save();
    if (node >= tier.nodes) return this.endExploration(tier, lines);
    proceed(lines);
  }

  endExploration(tier, lines) {
    const msgs = this.passDays(tier.days);
    this.save();
    this.cuartel([...lines.map(stripTags), ...msgs]);
  }

  // ------------------------------------------------------------ fin de partida / avatar
  chooseAvatar() {
    const gs = this.gs;
    const vivos = S.living(gs);
    let html = `<h2>TU HISTORIA NO TERMINA AQUÍ</h2>
      <p style="font-style:italic">Tu personaje ha caído... pero el escuadrón sigue en pie. Otro soldado cargará con su legado.</p><div id="list"></div>`;
    const el = show(html);
    const list = el.querySelector('#list');
    for (const s of vivos) {
      const d = document.createElement('div');
      d.innerHTML = soldierCard(s);
      d.style.cursor = 'pointer';
      d.onclick = () => {
        s.isPlayer = true;
        gs.playerName = s.name;
        this.save();
        this.cuartel([`${s.name} jura sobre las tumbas continuar la lucha.`]);
      };
      list.appendChild(d);
    }
  }

  gameOver(reason) {
    const gs = this.gs;
    let html = `<h2 class="bad-t">G A M E&nbsp;&nbsp;O V E R</h2><p><b>${reason}</b></p>
      <p>Sobreviviste ${gs.day} días · ${gs.titansKilled} titanes abatidos · ${gs.fallen.length} caídos</p>`;
    for (const f of gs.fallen)
      html += `<div class="memorial-entry">† <b>${f.name}</b> — ${f.kills} titanes — día ${f.day} — <i>${f.cause}</i></div>`;
    html += `<button class="btn primary" id="ok">Volver al menú principal</button>`;
    show(html).querySelector('#ok').onclick = () => this.app.toTitle();
  }

  victory() {
    const gs = this.gs;
    let html = `<h2 class="ok">¡¡ EL MURO MARÍA HA SIDO RECUPERADO !!</h2>
      <p>La puerta está sellada. Por primera vez en la historia, la humanidad le ha arrebatado territorio a los titanes.</p>
      <p>Días de campaña: <b>${gs.day}</b> · Titanes abatidos: <b>${gs.titansKilled}</b> · Expediciones: <b>${gs.expeditions}</b> · Caídos: <b>${gs.fallen.length}</b></p>
      <h3>Sus nombres no serán olvidados:</h3>`;
    for (const f of gs.fallen)
      html += `<div class="memorial-entry">† <b>${f.name}</b> — ${f.kills} titanes — <i>${f.cause}</i></div>`;
    html += `<p class="center" style="font-size:20px;color:#ffd84a">«Dedicad vuestros corazones.»</p>
      <button class="btn primary" id="ok">Volver al menú principal</button>`;
    show(html).querySelector('#ok').onclick = () => this.app.toTitle();
  }
}

// ================================================================ título y slots
export function titleScreen(app) {
  const html = `
    <h1>ATAQUE A LOS<br>TITANES<span class="sub-logo">⟨ ALAS DE LA LIBERTAD ⟩</span></h1>
    <p class="subtitle">«Si no luchas, no puedes ganar.»</p>
    <div style="max-width:460px;margin:0 auto">
      <button class="btn primary" id="new"><span class="ico">🗡</span><span class="btn-body"><b>Nueva partida</b><small>año 847 — el Cuerpo de Exploración te espera</small></span></button>
      <button class="btn" id="load"><span class="ico">📜</span><span class="btn-body"><b>Cargar partida</b></span></button>
      <button class="btn" id="how"><span class="ico">❓</span><span class="btn-body"><b>Cómo se juega</b></span></button>
    </div>
    <p class="small-note center">Pantalla completa con F11 · El mouse se captura en misión · ESC pausa</p>
    <p class="version-tag">${S.VERSION}</p>`;
  const el = show(html);
  el.querySelector('#new').onclick = () => slotScreen(app, false);
  el.querySelector('#load').onclick = () => slotScreen(app, true);
  el.querySelector('#how').onclick = () => howScreen(app);
}

function howScreen(app) {
  const html = `<h2>CÓMO SE JUEGA</h2>
    <h3>En misión (acción 3D en tiempo real)</h3>
    <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> moverte · <kbd>ESPACIO</kbd> saltar · <kbd>SHIFT</kbd> impulso ODM (gasta gas)</p>
    <p><b>CLICK DERECHO</b> (o <kbd>E</kbd>): disparar el <b>gancho ODM</b> al titán que apuntas — vuelas hacia su nuca. Suéltalo para soltar el cable.</p>
    <p><b>CLICK IZQUIERDO</b>: atacar con las hojas. Solo el corte en la <b>NUCA</b> (la placa roja tras el cuello) mata a un titán.</p>
    <p><kbd>T</kbd> orden al escuadrón («¡A mí!» / «¡Ataquen libres!») · <kbd>ESC</kbd> pausa/retirada</p>
    <p><kbd>F</kbd> <b>transformarte en TITÁN</b> cuando la FURIA llegue a 100 (se desbloquea superando el capítulo 4)</p>
    <p>Si un titán te atrapa: <b>machaca WASD</b> o que un aliado corte el brazo. Si te quedas sin gas, estás a pie: lento y casi indefenso.</p>
    <h3>Cada decisión pesa</h3>
    <p>· El gas y las hojas salen de tu almacén: lo que gastas no vuelve.<br>
       · Un soldado muerto está muerto <b>para siempre</b>: su nombre va al memorial.<br>
       · La muralla acumula daño entre misiones: a 0, fin del juego.<br>
       · Más lejos de la muralla = más botín, más titanes, más tumbas.</p>
    <button class="btn" id="back">← Volver</button>`;
  show(html).querySelector('#back').onclick = () => titleScreen(app);
}

function slotScreen(app, forLoad) {
  let html = `<h2>${forLoad ? 'CARGAR PARTIDA' : 'NUEVA PARTIDA'}</h2><div id="slots"></div>
    <button class="btn" id="back">← Volver</button>`;
  const el = show(html);
  const box = el.querySelector('#slots');
  for (let i = 1; i <= S.SLOTS; i++) {
    const desc = S.slotSummary(i);
    const b = document.createElement('button');
    b.className = 'btn';
    b.innerHTML = `<b>Slot ${i}</b><small>${desc || '— vacío —'}</small>`;
    b.onclick = () => {
      if (forLoad) {
        const gs = S.loadGame(i);
        if (!gs) return;
        app.beginGame(gs, i);
      } else {
        nameScreen(app, i, !!desc);
      }
    };
    box.appendChild(b);
  }
  el.querySelector('#back').onclick = () => titleScreen(app);
}

function nameScreen(app, slot, overwrite) {
  const html = `<h2>TU SOLDADO</h2>
    ${overwrite ? '<p class="warn-t">⚠ Este slot tiene una partida: se sobrescribirá.</p>' : ''}
    <p>Hace dos años los titanes derribaron la puerta del Muro María. Viste a tu gente convertirse en comida.
    Hoy vistes el uniforme del Cuerpo de Exploración y unas hojas de acero en las manos.</p>
    <input class="input-name" id="nm" maxlength="18" placeholder="Nombre de tu soldado" value="Aren">
    <button class="btn primary" id="go">Comenzar — Año 847</button>
    <button class="btn" id="back">← Volver</button>`;
  const el = show(html);
  el.querySelector('#go').onclick = () => {
    const name = el.querySelector('#nm').value.trim() || 'Aren';
    const gs = S.newGame(name);
    S.saveGame(gs, slot);
    app.beginGame(gs, slot);
  };
  el.querySelector('#back').onclick = () => slotScreen(app, false);
}

export function pauseScreen(app) {
  const html = `<h2>PAUSA</h2>
    <button class="btn primary" id="cont">Continuar la misión</button>
    <button class="btn danger" id="ret">Retirarse (abandonar la misión)</button>`;
  const el = show(html);
  el.querySelector('#cont').onclick = () => { hideMenu(); app.mission?.resume(); };
  el.querySelector('#ret').onclick = () => { hideMenu(); app.mission?.retreat(); };
}

function weightedPick(items, weights) {
  let total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }
