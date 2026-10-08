// Titanes: malla humanoide procedural, animación y IA por tipo.
import * as THREE from 'three';
import { TITAN_TYPES, rint } from './state.js';
import { steam, blood, burst, sparks } from './fx.js';
import { collideSolids, clampArena } from './world.js';
import { sfx } from './audio.js';
import { instance, TITAN_MODELS } from './assets.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function lambert(color) { return new THREE.MeshLambertMaterial({ color }); }

export class Titan {
  constructor(scene, kind, pos, opts = {}) {
    this.scene = scene;
    this.kind = kind;
    this.spec = TITAN_TYPES[kind];
    this.dummy = !!opts.dummy;
    this.marked = !!opts.marked;
    this.targetsCart = !!opts.targetsCart;
    this.height = opts.height || rint(this.spec.hMin, this.spec.hMax);
    this.maxHp = this.dummy ? 2 : rint(this.spec.hp[0], this.spec.hp[1]);
    this.hp = this.maxHp;
    this.dead = false;          // listo para eliminar de la lista
    this.dying = 0;             // >0: animación de muerte en curso
    this.yaw = Math.random() * Math.PI * 2;
    this.attackTimer = 0;       // >0: animación de ataque
    this.attackCd = 1 + Math.random() * 2;
    this.gateCd = 0;
    this.lungeTimer = 0;
    this.lungeCd = 3;
    this.grabTarget = null;     // PlayerController o Ally agarrado
    this.napeFlash = 0;
    this.walkPhase = Math.random() * 10;
    this.roared = false;
    this._stepPrev = 0;

    // --- mecánicas de los Nueve
    this.armor = this.kind === 'acorazado' ? 7 : 0;       // placas sobre la nuca
    this.hardenT = 0;                                      // hembra: ciclo de endurecimiento
    this.hardened = false;
    this.rockCd = 3;                                       // bestia: lanzamiento de rocas
    this.rocks = [];

    this._build();
    this.group.position.copy(pos);
    this.group.position.y = 0;
  }

  _build() {
    const h = this.height;
    const skin = this.dummy ? 0x9a7a4a : this.spec.color;
    const g = new THREE.Group();

    // ---- modelo GLB personalizado si está cargado
    const modelKey = !this.dummy && TITAN_MODELS[this.kind];
    const custom = modelKey ? instance(modelKey, h) : null;
    if (custom) {
      this.customModel = custom.children[0];
      g.add(custom);
      this.legs = [];
      this.arms = [];
      this.torso = null;
      this.head = null;
      // NUCA: hitbox/marcador flotante en la parte trasera del cuello
      this.napeMat = new THREE.MeshBasicMaterial({ color: 0xd83c3c });
      const nape = new THREE.Mesh(new THREE.BoxGeometry(h * 0.11, h * 0.13, 0.3), this.napeMat);
      nape.position.set(0, h * 0.80, -h * 0.10);
      g.add(nape);
      this.nape = nape;
      if (this.marked) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.26, h * 0.02, 8, 28),
          new THREE.MeshBasicMaterial({ color: 0xffd84a }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = h * 0.55;
        g.add(ring);
        this.markRing = ring;
      }
      this.group = g;
      this.scene.add(g);
      return;
    }

    const legH = h * 0.48, torsoH = h * 0.34, headR = h * 0.085;
    const legW = h * 0.085;
    // tono de piel único por titán
    let skinVar = skin;
    if (!this.dummy && !this.spec.special) {
      const col = new THREE.Color(skin);
      col.offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.14);
      skinVar = col.getHex();
    }
    const skinMat = lambert(skinVar);
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), skinMat);
      leg.geometry.translate(0, -legH / 2, 0);             // pivote en la cadera
      leg.position.set(side * h * 0.085, legH, 0);
      leg.castShadow = true;
      g.add(leg);
      this.legs.push(leg);
    }
    const torso = new THREE.Mesh(new THREE.BoxGeometry(h * 0.30, torsoH, h * 0.16), skinMat);
    torso.position.y = legH + torsoH / 2;
    torso.castShadow = true;
    g.add(torso);
    this.torso = torso;
    if (!this.dummy) {
      // musculatura marcada (pectorales y abdomen, tono más claro)
      const muscle = new THREE.Color(skinVar).offsetHSL(0, 0.02, 0.07).getHex();
      const pecs = new THREE.Mesh(new THREE.BoxGeometry(h * 0.26, torsoH * 0.32, h * 0.03), lambert(muscle));
      pecs.position.set(0, torsoH * 0.26, h * 0.075);
      torso.add(pecs);
      const abs = new THREE.Mesh(new THREE.BoxGeometry(h * 0.18, torsoH * 0.42, h * 0.025), lambert(muscle));
      abs.position.set(0, -torsoH * 0.18, h * 0.075);
      torso.add(abs);
    }

    this.arms = [];
    const armH = h * 0.36, armW = h * 0.06;
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armW), skinMat);
      arm.geometry.translate(0, -armH / 2, 0);             // pivote en el hombro
      arm.position.set(side * h * 0.18, legH + torsoH * 0.92, 0);
      arm.castShadow = true;
      g.add(arm);
      this.arms.push(arm);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(headR * 2.1, headR * 2.3, headR * 2), skinMat);
    head.position.y = legH + torsoH + headR * 1.1;
    head.castShadow = true;
    g.add(head);
    this.head = head;
    // cara (de frente, z+): ojos, boca con dientes y pelo
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.45, headR * 0.3, 0.1),
        new THREE.MeshBasicMaterial({ color: this.dummy ? 0x222222 : 0xffe84a }));
      eye.position.set(side * headR * 0.55, headR * 0.3, headR + 0.06);
      head.add(eye);
    }
    if (!this.dummy) {
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.2, headR * 0.45, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x3a1814 }));
      mouth.position.set(0, -headR * 0.55, headR + 0.05);
      head.add(mouth);
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.05, headR * 0.14, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xe8e2d0 }));
      teeth.position.set(0, -headR * 0.5, headR + 0.06);
      head.add(teeth);
      if (Math.random() < 0.6 && !this.spec.special) {
        const hair = new THREE.Mesh(new THREE.BoxGeometry(headR * 2.2, headR * 0.7, headR * 2.1),
          lambert([0x2a2018, 0x4a3a26, 0x5a4a30][Math.floor(Math.random() * 3)]));
        hair.position.y = headR * 1.05;
        head.add(hair);
      }
    }
    // NUCA: marcador brillante en la parte trasera del cuello
    this.napeMat = new THREE.MeshBasicMaterial({ color: 0xd83c3c });
    const nape = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.3, headR * 1.5, 0.25), this.napeMat);
    nape.position.set(0, legH + torsoH + headR * 0.45, -headR * 1.05);
    g.add(nape);
    this.nape = nape;

    if (this.marked) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.26, h * 0.02, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0xffd84a }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h * 0.55;
      g.add(ring);
      this.markRing = ring;
    }

    // --- variantes visuales de los Nueve
    if (this.kind === 'acorazado') {
      const plateMat = lambert(0xe8e2d0);
      this.plates = [];
      const specs = [
        [h * 0.34, torsoH * 0.6, h * 0.05, 0, legH + torsoH * 0.55, h * 0.085],   // pecho
        [headR * 1.7, headR * 1.9, 0.3, 0, legH + torsoH + headR * 0.45, -headR * 1.18], // nuca blindada
        [h * 0.12, h * 0.1, h * 0.12, -h * 0.18, legH + torsoH * 0.95, 0],
        [h * 0.12, h * 0.1, h * 0.12, h * 0.18, legH + torsoH * 0.95, 0],          // hombreras
      ];
      for (const [w, ht, d, x, y, z] of specs) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), plateMat);
        p.position.set(x, y, z);
        g.add(p);
        this.plates.push(p);
      }
    } else if (this.kind === 'hembra') {
      const hairF = new THREE.Mesh(new THREE.BoxGeometry(headR * 2.2, headR * 1.0, headR * 2.1), lambert(0xe8d878));
      hairF.position.set(0, head.position.y + headR * 0.85, 0);
      g.add(hairF);
    } else if (this.kind === 'bestia') {
      const fur = new THREE.Mesh(new THREE.BoxGeometry(h * 0.34, torsoH * 1.05, h * 0.2), lambert(0x3a2e22));
      fur.position.set(0, legH + torsoH / 2, 0);
      g.add(fur);
      const beard = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.6, headR * 1.2, headR * 0.6), lambert(0x3a2e22));
      beard.position.set(0, head.position.y - headR * 0.8, headR * 0.7);
      g.add(beard);
    }
    this.group = g;
    this.scene.add(g);
  }

  get pos() { return this.group.position; }

  forward() {
    return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).clone();
  }

  napePos(out = new THREE.Vector3()) {
    this.nape.getWorldPosition(out);
    return out;
  }

  handPos(out = new THREE.Vector3()) {
    if (!this.arms.length) {
      // modelo GLB: punto delante del pecho
      const f = this.forward();
      out.copy(this.pos);
      out.y += this.height * 0.5;
      out.addScaledVector(f, this.height * 0.28);
      return out;
    }
    // punta del brazo derecho
    out.set(0, -this.height * 0.36, 0);
    return this.arms[1].localToWorld(out);
  }

  reach() { return this.height * 0.42 + 2.5; }

  isBehind(p) {
    _v2.copy(p).sub(this.pos);
    _v2.y = 0;
    if (_v2.lengthSq() < 0.01) return false;
    _v2.normalize();
    const f = this.forward();
    return f.dot(_v2) < -0.15;
  }

  damage(dmg, ctx, attackerName = null, pierceArmor = false) {
    if (this.dying || this.dead || dmg <= 0) return false;
    // hembra: nuca cristalizada = inmune
    if (this.hardened) {
      sfx.slashHit();
      ctx.msg('¡La nuca está ENDURECIDA! Las hojas rebotan. Espera a que el cristal se apague.', true);
      return false;
    }
    // acorazado: hay que romper las placas primero
    if (this.armor > 0) {
      this.armor -= pierceArmor ? 5 : 1;
      this.napeFlash = 0.25;
      sparks(ctx.scene, this.napePos());
      if (this.armor <= 0) {
        steam(ctx.scene, this.napePos(), true);
        if (this.plates) for (const p of this.plates) p.visible = false;
        sfx.bigThud();
        ctx.msg('‼ ¡LA ARMADURA SE HACE PEDAZOS! Su nuca queda expuesta. ¡AHORA!', true);
      } else {
        ctx.msg(`Las hojas chocan contra la armadura (${this.armor} placas restantes).`);
      }
      return false;
    }
    this.hp -= dmg;
    this.napeFlash = 0.25;
    const np = this.napePos();
    blood(ctx.scene, np);
    if (this.grabTarget) {
      this.release(ctx);
      ctx.msg(`¡${attackerName || 'Alguien'} corta el brazo y libera al atrapado!`, true);
    }
    if (this.hp <= 0) {
      this.dying = 2.2;
      steam(ctx.scene, this.pos.clone().setY(this.height * 0.5), true);
      return true;        // kill
    }
    return false;
  }

  release(ctx) {
    if (!this.grabTarget) return;
    const t = this.grabTarget;
    this.grabTarget = null;
    if (t.onReleased) t.onReleased();
  }

  // ------------------------------------------------------------ IA
  update(dt, ctx) {
    const g = this.group;
    if (this.dead) return;
    this._updateRocks(dt, ctx);     // las rocas en vuelo siguen aunque la bestia caiga

    // muerte: caer de bruces y evaporarse
    if (this.dying > 0) {
      this.dying -= dt;
      const prevRot = g.rotation.x;
      g.rotation.x = Math.min(Math.PI / 2, g.rotation.x + dt * 2.2);
      g.position.y -= dt * this.height * 0.10;
      // impacto contra el suelo: polvo + retumbar
      if (prevRot < Math.PI / 2 && g.rotation.x >= Math.PI / 2) {
        sfx.bigThud();
        burst(ctx.scene, this.pos.clone().setY(0.5),
          { count: 60, color: 0x9a8a6a, size: 1.8, speed: 14, up: 5, life: 1.2, gravity: -6 });
        ctx.onQuake?.(this.height / 15);
      }
      if (Math.random() < 0.35) steam(ctx.scene, this.pos.clone().setY(Math.max(1, this.height * 0.3)), false);
      if (this.dying <= 0) this.dead = true;
      return;
    }

    if (this.napeFlash > 0) {
      this.napeFlash -= dt;
      this.napeMat.color.setHex(this.napeFlash > 0 ? 0xffffff
        : this.hardened ? 0x7ad8e8 : this.armor > 0 ? 0x9a9488 : 0xd83c3c);
    }
    if (this.markRing) this.markRing.rotation.z += dt * 2;
    if (this.dummy) return;

    // hembra: ciclo de endurecimiento de nuca (7 s expuesta / 2.5 s cristal)
    if (this.kind === 'hembra') {
      this.hardenT += dt;
      const cycle = this.hardenT % 9.5;
      const wasHard = this.hardened;
      this.hardened = cycle > 7;
      if (this.hardened !== wasHard) {
        this.napeMat.color.setHex(this.hardened ? 0x7ad8e8 : 0xd83c3c);
        if (this.hardened) sfx.slashHit();
        else ctx.msg('La nuca de la HEMBRA queda expuesta. ¡Es tu ventana!', true);
      }
    }
    if (this.armor > 0) this.napeMat.color.setHex(0x9a9488);

    this.attackCd = Math.max(0, this.attackCd - dt);
    this.gateCd = Math.max(0, this.gateCd - dt);
    this.lungeCd = Math.max(0, this.lungeCd - dt);

    // sosteniendo a una víctima: llevársela a la boca
    if (this.grabTarget) {
      const hp = this.handPos();
      this.grabTarget.heldAt(hp, dt, this, ctx);
      if (this.arms.length) this.arms[1].rotation.x = -2.2;
      return;
    }

    // ---------------- elegir objetivo
    let targetPos = null, targetEnt = null, fleeing = false;
    if (this.marked && this.hp <= this.maxHp / 2) {
      fleeing = true;
      targetPos = ctx.player.pos;
    } else if (ctx.mode === 'defense' && this.kind === 'anormal' && ctx.gate) {
      targetPos = _v2.set(ctx.gate.x, 0, ctx.gate.z);
    } else if (this.targetsCart && ctx.cart && ctx.cart.hp > 0) {
      targetPos = _v2.set(ctx.cart.x, 0, ctx.cart.z);
      targetEnt = ctx.cart;
    } else {
      let best = null, bd = 1e9;
      const candidates = [ctx.player, ...ctx.allies.filter(a => a.alive)];
      for (const c of candidates) {
        if (c.downed) continue;
        let d = this.pos.distanceTo(c.pos);
        if (c.soldier?.trait === 'temerario') d -= 15;
        if (d < bd) { bd = d; best = c; }
      }
      if (best) { targetEnt = best; targetPos = best.pos; }
      else if (ctx.gate) targetPos = _v2.set(ctx.gate.x, 0, ctx.gate.z);
    }
    if (!targetPos) return;

    // ---------------- orientación
    const dx = targetPos.x - this.pos.x, dz = targetPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    // rugido al fijar presa por primera vez
    if (!this.roared && targetEnt && dist < 75) {
      this.roared = true;
      sfx.roar();
      ctx.msg(`‼ El ${this.spec.name} (${this.height} m) te ha visto.`, this.kind !== 'puro');
    }
    let desiredYaw = Math.atan2(dx, dz);
    if (fleeing) desiredYaw += Math.PI;
    let dy = desiredYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * (this.kind === 'anormal' ? 4 : 2));
    g.rotation.y = this.yaw;

    // ---------------- animación de ataque en curso
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      const t = 1 - this.attackTimer / 0.55;
      const sweep = Math.sin(Math.min(1, t) * Math.PI);
      if (this.arms.length) this.arms[1].rotation.x = -2.6 * sweep;
      else if (this.customModel) this.customModel.rotation.x = -0.35 * sweep;   // embestida
      if (!this._hitDone && t > 0.5) {
        this._hitDone = true;
        this._resolveHit(ctx, targetEnt, dist);
      }
      return;
    }
    if (this.arms.length) this.arms[1].rotation.x *= 0.8;
    else if (this.customModel) this.customModel.rotation.x *= 0.8;

    // ---------------- atacar puerta
    if (ctx.mode === 'defense' && ctx.gate && !fleeing) {
      const gd = Math.hypot(ctx.gate.x - this.pos.x, ctx.gate.z - this.pos.z);
      if (gd < this.reach() + 6 && this.gateCd <= 0) {
        this.gateCd = this.spec.atkCd + 0.5;
        this.attackTimer = 0.55;
        this._hitDone = false;
        this._gateHit = true;
        return;
      }
    }
    this._gateHit = false;

    // ---------------- atacar entidad
    if (targetEnt && dist < this.reach() && this.attackCd <= 0 && !fleeing) {
      this.attackCd = this.spec.atkCd;
      this.attackTimer = 0.55;
      this._hitDone = false;
      this._victim = targetEnt;
      return;
    }

    // ---------------- salto (anormal y mandíbula)
    const leaper = this.kind === 'anormal' || this.kind === 'mandibula';
    if (leaper && !fleeing && this.lungeCd <= 0 && dist > 14 && dist < 50) {
      this.lungeTimer = 0.7;
      this.lungeCd = this.kind === 'mandibula' ? 2.5 + Math.random() * 1.5 : 5 + Math.random() * 3;
    }

    // ---------------- bestia: combate a distancia con rocas
    if (this.kind === 'bestia' && targetEnt && !fleeing) {
      this.rockCd -= dt;
      if (dist > 25 && dist < 110 && this.rockCd <= 0) {
        this.rockCd = 4 + Math.random() * 1.5;
        this._throwRock(ctx, targetEnt);
      }
      if (dist > 30 && dist < 80) {
        // mantiene la distancia: no avanza, lanza
        this.walkPhase += dt * 2;
        return;
      }
    }

    // ---------------- caminar
    let speed = this.spec.speed * (1 + this.height / 30);
    if (this.tendonCut) speed *= 0.45;
    if (this.lungeTimer > 0) {
      this.lungeTimer -= dt;
      speed *= 4.2;
      g.position.y = Math.sin((0.7 - this.lungeTimer) / 0.7 * Math.PI) * this.height * 0.35;
    } else {
      g.position.y = 0;
    }
    if ((this.kind === 'anormal' || this.kind === 'mandibula') && Math.random() < 0.012) {
      this.yaw += (Math.random() - 0.5) * 1.8;     // zigzag errático
    }
    const step = speed * dt;
    this.pos.x += Math.sin(this.yaw) * step;
    this.pos.z += Math.cos(this.yaw) * step;
    collideSolids(this.pos, this.height * 0.12, ctx.solids);
    clampArena(this.pos);

    // animación de andar: zancada + bamboleo de torso y cabeza
    this.walkPhase += dt * speed * 0.55;
    const sw = Math.sin(this.walkPhase) * 0.5;
    if (this.legs.length) {
      this.legs[0].rotation.x = sw;
      this.legs[1].rotation.x = -sw;
      this.arms[0].rotation.x = -sw * 0.6;
      if (this.attackTimer <= 0) this.arms[1].rotation.x = sw * 0.6;
      this.torso.rotation.z = Math.sin(this.walkPhase) * 0.07;
      this.torso.rotation.y = Math.sin(this.walkPhase * 0.5) * 0.06;
      this.head.rotation.z = Math.sin(this.walkPhase + 1) * 0.1;
      this.head.rotation.x = Math.sin(this.walkPhase * 0.7) * 0.08;
    } else if (this.customModel) {
      // modelo GLB: bamboleo lateral + cabeceo de zancada
      this.customModel.rotation.z = Math.sin(this.walkPhase) * 0.055;
      if (this.attackTimer <= 0)
        this.customModel.rotation.x = Math.sin(this.walkPhase * 2) * 0.03;
    }
    g.position.y += Math.abs(Math.sin(this.walkPhase)) * this.height * 0.012;
    // pasos que retumban (los grandes, cerca del jugador)
    const stepNow = Math.sign(Math.sin(this.walkPhase));
    if (stepNow !== this._stepPrev) {
      this._stepPrev = stepNow;
      const dPlayer = this.pos.distanceTo(ctx.player.pos);
      if (this.height >= 12 && dPlayer < 90) {
        sfx.thud();
        ctx.onQuake?.(0.25 * (1 - dPlayer / 90));
      }
    }
  }

  // ------------------------------------------------------------ rocas (bestia)
  _throwRock(ctx, target) {
    const from = this.pos.clone();
    from.y = this.height * 0.8;
    const to = target.pos.clone();
    // predicción simple del movimiento de la víctima
    if (target.vel) to.addScaledVector(target.vel, 1.0);
    to.y += 1;
    const flight = 1.1;
    const vel = to.sub(from).divideScalar(flight);
    vel.y += 0.5 * 22 * flight;             // compensar gravedad
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0),
      new THREE.MeshLambertMaterial({ color: 0x6a6258 }));
    mesh.position.copy(from);
    mesh.castShadow = true;
    ctx.scene.add(mesh);
    this.rocks.push({ mesh, vel, age: 0 });
    sfx.roar();
    ctx.msg('‼ ¡LA BESTIA LANZA UNA ROCA! ¡Muévete!', true);
  }

  _updateRocks(dt, ctx) {
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.age += dt;
      r.vel.y -= 22 * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      r.mesh.rotation.x += dt * 6;
      r.mesh.rotation.z += dt * 4;
      let boom = r.mesh.position.y <= 0.5 || r.age > 4;
      // impacto directo contra humanos
      for (const c of [ctx.player, ...ctx.allies]) {
        if (!c.downed && r.mesh.position.distanceTo(c.pos) < 2.6) boom = true;
      }
      if (boom) {
        const at = r.mesh.position.clone();
        at.y = Math.max(0.5, at.y);
        burst(ctx.scene, at, { count: 50, color: 0x8a8074, size: 1.4, speed: 12, up: 7, life: 0.9, gravity: -10 });
        sfx.bigThud();
        ctx.onQuake?.(0.4);
        for (const c of [ctx.player, ...ctx.allies]) {
          if (!c.downed && at.distanceTo(c.pos) < 6) c.takeDamage(2, this, ctx);
        }
        ctx.scene.remove(r.mesh);
        this.rocks.splice(i, 1);
      }
    }
  }

  _resolveHit(ctx, targetEnt, dist) {
    if (this._gateHit && ctx.gate) {
      const gd = Math.hypot(ctx.gate.x - this.pos.x, ctx.gate.z - this.pos.z);
      if (gd < this.reach() + 7) {
        const dmg = this.kind === 'grande' ? 2 : 1;
        ctx.onGateHit(dmg, this);
      }
      return;
    }
    const v = this._victim;
    if (v && ctx.cart && v === ctx.cart) {
      const cd = Math.hypot(ctx.cart.x - this.pos.x, ctx.cart.z - this.pos.z);
      if (cd < this.reach() + 4) ctx.onCartHit(this.spec.dmg, this);
      return;
    }
    if (!v || v.downed) return;
    const d = this.pos.distanceTo(v.pos);
    if (d > this.reach() + 2) return;

    // esquiva
    const ag = v.soldier ? v.soldier.agility : 4;
    let dodge = ag * 0.055;
    if (v.soldier?.trait === 'escurridizo') dodge += 0.18;
    if (Math.random() < dodge) {
      ctx.msg(`¡${v.name} esquiva el manotazo!`);
      return;
    }
    if (!ctx.noDeath && Math.random() < this.spec.grab && !this.grabTarget && !v.titanForm) {
      this.grabTarget = v;
      v.onGrabbed(this, ctx);
      return;
    }
    if (this.kind === 'grande') {
      // barrido: golpea a todos los cercanos
      for (const c of [ctx.player, ...ctx.allies]) {
        if (!c.downed && this.pos.distanceTo(c.pos) < this.reach() + 3) {
          c.takeDamage(this.spec.dmg, this, ctx);
        }
      }
      ctx.msg(`¡El ${this.spec.name} barre el suelo con su brazo!`, true);
    } else {
      v.takeDamage(this.spec.dmg, this, ctx);
    }
  }
}
