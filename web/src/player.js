// Jugador: tercera persona, cuerpo articulado animado y equipo ODM.
import * as THREE from 'three';
import { gasFactor, hookRange, WEAPONS, SKINS } from './state.js';
import { blood, sparks, burst, steam } from './fx.js';
import { collideSolids, clampArena } from './world.js';
import { sfx, stepSound } from './audio.js';
import { instance } from './assets.js';

const GRAVITY = 32;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();

const _capeTexCache = {};
/** Capa con el emblema de las Alas de la Libertad. */
function capeTexture(color) {
  if (_capeTexCache[color]) return _capeTexCache[color];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 170;
  const g = c.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 128, 170);
  // escudo
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(34, 40); g.lineTo(94, 40); g.lineTo(94, 95);
  g.quadraticCurveTo(94, 120, 64, 134);
  g.quadraticCurveTo(34, 120, 34, 95);
  g.closePath();
  g.stroke();
  // ala blanca
  g.fillStyle = 'rgba(245,245,240,.95)';
  g.beginPath();
  g.moveTo(64, 58);
  g.quadraticCurveTo(96, 52, 90, 76);
  g.quadraticCurveTo(80, 72, 64, 84);
  g.closePath();
  g.fill();
  // ala azul
  g.fillStyle = 'rgba(70,110,200,.95)';
  g.beginPath();
  g.moveTo(64, 70);
  g.quadraticCurveTo(34, 64, 40, 92);
  g.quadraticCurveTo(52, 86, 64, 98);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  _capeTexCache[color] = tex;
  return tex;
}

export class Player {
  constructor(scene, camera, gs, soldier, spawn) {
    this.scene = scene;
    this.camera = camera;
    this.gs = gs;
    this.soldier = soldier;
    this.name = soldier.name;

    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0.12;
    this.onGround = true;

    this.hp = 3;
    this.gas = 0;
    this.blades = [];
    this.kills = 0;
    this.pairsBroken = 0;

    this.downed = false;
    this.eaten = false;
    this.invuln = 0;
    this.attackCd = 0;
    this.hooked = null;        // titán enganchado
    this.hookPoint = null;     // anclaje estático (árbol, tejado, muralla)
    this.hookGrace = 0;        // ventana perfecta tras soltar el gancho
    this.weapon = WEAPONS[gs.weapon] || WEAPONS.estandar;
    this.spears = 0;           // lanzas trueno (se asignan en la misión)
    this.spearProjectiles = [];
    this.rage = 0;             // furia: se llena con kills y golpes recibidos
    this.titanForm = 0;        // >0: segundos restantes transformado
    this.titanMesh = null;
    this.punchCd = 0;
    this.grabbedBy = null;
    this.grabTimer = 0;
    this.struggle = 0;
    this.struggleNeed = 14;
    this.shake = 0;
    this.fovKick = 0;
    this.runPhase = 0;
    this.attackAnim = 0;
    this.spinDir = 1;
    this.trails = [];
    this._jetT = 0;

    this._buildMesh();
    this._buildRope();
  }

  // ------------------------------------------------------------ cuerpo articulado
  _buildMesh() {
    // modelo de personaje según la skin equipada (Mikasa, Annie, etc.)
    const skinDef = SKINS[this.gs.skin] || SKINS.verde;
    const custom = skinDef.model ? instance(skinDef.model, 1.85) : null;
    if (custom) {
      this.mesh = custom;
      this.body = custom.children[0];
      this.legs = [];
      this.arms = [];
      this.bladeMeshes = [];
      this.cape = { rotation: { x: 0 } };       // stub: el GLB trae su propia capa
      this.scene.add(custom);
      return;
    }
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const g = new THREE.Group();

    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.92, 0.19), mat(0xe8e2d4));
      leg.geometry.translate(0, -0.46, 0);
      leg.position.set(side * 0.13, 0.95, 0);
      leg.castShadow = true;
      g.add(leg);
      this.legs.push(leg);
    }
    this.body = new THREE.Group();
    this.body.position.y = 0.95;
    g.add(this.body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), mat(0xb89868));
    torso.position.y = 0.33;
    torso.castShadow = true;
    this.body.add(torso);
    // correas del ODM
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.32), mat(0x6a4a2a));
    strap.position.y = 0.18;
    this.body.add(strap);
    // tanques de gas a los lados
    for (const side of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), mat(0x8a8a92));
      tank.rotation.x = Math.PI / 2.4;
      tank.position.set(side * 0.3, 0.12, -0.14);
      this.body.add(tank);
    }
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mat(0xe8c8a8));
    this.head.position.y = 0.78;
    this.head.castShadow = true;
    this.body.add(this.head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, 1.4), mat(0x4a3a26));
    hair.position.y = 0.84;
    this.body.add(hair);

    const capeColor = (SKINS[this.gs.skin] || SKINS.verde).color;
    this.cape = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.15, 1, 4),
      new THREE.MeshLambertMaterial({ map: capeTexture(capeColor), side: THREE.DoubleSide }));
    this.cape.geometry.translate(0, -0.55, 0);
    this.cape.position.set(0, 0.6, -0.18);
    this.body.add(this.cape);

    this.arms = [];
    this.bladeMeshes = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.33, 0.56, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 0.15), mat(0xb89868));
      upper.geometry.translate(0, -0.33, 0);
      upper.castShadow = true;
      arm.add(upper);
      // hoja de acero ultraduro (con empuñadura)
      const blade = new THREE.Group();
      const steel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xe0eef8 }));
      steel.position.y = -0.35;
      blade.add(steel);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.09),
        new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
      grip.position.y = 0.32;
      blade.add(grip);
      blade.position.set(0, -0.62, 0.18);
      blade.rotation.x = 1.2;
      blade.userData.baseRotX = blade.rotation.x;
      arm.add(blade);
      this.body.add(arm);
      this.arms.push(arm);
      this.bladeMeshes.push(blade);
    }
    this.mesh = g;
    this.scene.add(g);
  }

  _buildRope() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1a1a1a }));
    this.rope.visible = false;
    this.rope.frustumCulled = false;
    this.scene.add(this.rope);
  }

  currentEdge() { return this.blades.length ? this.blades[0] : 0; }

  wearBlade(n = 1) {
    if (!this.blades.length) return;
    if (this.soldier.trait === 'ahorrador' && Math.random() < 0.5) n = Math.max(0, n - 1);
    this.blades[0] -= n;
    if (this.blades[0] <= 0) {
      this.blades.shift();
      this.pairsBroken += 1;
    }
  }

  // ------------------------------------------------------------ gancho ODM
  findHookTarget(titans) {
    const camDir = this.camera.getWorldDirection(_dir);
    let best = null, bestScore = -1;
    const range = hookRange(this.gs);
    for (const t of titans) {
      if (t.dead || t.dying > 0) continue;
      _v.copy(t.napePos()).sub(this.camera.position);
      const d = _v.length();
      if (d > range) continue;
      _v.normalize();
      const align = _v.dot(camDir);
      if (align < 0.45) continue;
      const score = align - d / range * 0.3;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  /** Anclaje estático (árbol/tejado/muralla) más alineado con la cámara. */
  findAnchor(anchors) {
    if (!anchors || !anchors.length) return null;
    const camDir = this.camera.getWorldDirection(_dir);
    let best = null, bestScore = -1;
    const range = hookRange(this.gs);
    for (const a of anchors) {
      _v.copy(a).sub(this.camera.position);
      const d = _v.length();
      if (d > range || d < 4) continue;
      _v.normalize();
      const align = _v.dot(camDir);
      if (align < 0.6) continue;
      const score = align - d / range * 0.25;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  startHook(titans, msg, anchors = null) {
    if (this.hooked || this.hookPoint) return;
    if (this.gas <= 0) { msg('¡Sin gas! El gancho no dispara.', true); return; }
    const t = this.findHookTarget(titans);
    if (t) {
      this.hooked = t;
      sfx.hook();
      sparks(this.scene, t.napePos());
      return;
    }
    const a = this.findAnchor(anchors);
    if (a) {
      this.hookPoint = a.clone();
      this._hookT = 0;
      sfx.hook();
      sparks(this.scene, a);
      return;
    }
    msg('Apunta a un titán, un árbol alto o un tejado.');
  }

  releaseHook(grace = true) {
    if (this.hooked && grace) this.hookGrace = 0.5;
    this.hooked = null;
    this.hookPoint = null;
  }

  dash(moveDir) {
    const cost = 4 * gasFactor(this.gs);
    if (this.gas < cost) return false;
    this.gas -= cost;
    const dir = moveDir.lengthSq() > 0.01 ? moveDir : this.camera.getWorldDirection(_dir).setY(0).normalize();
    this.vel.x = dir.x * 28;
    this.vel.z = dir.z * 28;
    this.vel.y = Math.max(this.vel.y, 5);
    this.fovKick = Math.min(this.fovKick + 14, 22);
    sfx.dash();
    return true;
  }

  // ------------------------------------------------------------ ataque
  attack(titans, ctx) {
    if (this.titanForm > 0) return this.punch(titans, ctx);
    if (this.attackCd > 0 || this.downed) return;
    this.attackCd = 0.32 * this.weapon.cdMul;
    this.attackAnim = 0.28;
    this.spinDir = -this.spinDir;
    this._spawnTrail();
    if (!this.blades.length) {
      ctx.msg('¡No te quedan hojas! Solo te queda huir.', true);
      return;
    }
    sfx.slash();
    let connected = false;
    for (const t of titans) {
      if (t.dead || t.dying > 0) continue;
      const np = t.napePos();
      _v2.copy(this.pos);
      _v2.y += 1.4;
      const dNape = _v2.distanceTo(np);
      const window_ = (this.hooked === t || this.hookGrace > 0) ? 6.5 : 4.8;
      if (dNape < window_) {
        this.wearBlade(this.weapon.wear);
        let dmg = 1 + Math.floor(this.soldier.strength / 3) + this.weapon.dmg;
        if (this.soldier.trait === 'carnicero' || this.soldier.trait === 'temerario') dmg += 1;
        if (Math.random() < this.soldier.precision * 0.06) {
          dmg += 2;
          ctx.msg('¡CORTE PROFUNDO!', true);
        }
        const killed = t.damage(dmg, ctx, this.name);
        if (killed) {
          this.kills += 1;
          sfx.kill();
          ctx.onKill(t, this);
        } else {
          sfx.slashHit();
          ctx.msg(`Tajo a la nuca: ${Math.max(0, t.hp)}/${t.maxHp}`);
          ctx.onNapeHit?.();
        }
        this.vel.y = Math.max(this.vel.y, 7);
        connected = true;
        break;
      }
      const dBody = this.pos.distanceTo(_v.copy(t.pos).setY(this.pos.y));
      if (dBody < t.height * 0.28 + 2.6) {
        this.wearBlade();
        sfx.slashHit();
        blood(this.scene, this.pos.clone().add(_v2.set(0, 1.5, 0)));
        ctx.msg('Cortas carne... la NUCA brilla en rojo DETRÁS del cuello.');
        connected = true;
        break;
      }
    }
    if (!connected) ctx.msg('Cortas el aire.');
  }

  // ------------------------------------------------------------ poder del titán
  addRage(n) {
    if (!this.gs.titanPower || this.titanForm > 0) return;
    this.rage = Math.min(100, this.rage + n);
  }

  transform(ctx) {
    if (!this.gs.titanPower) {
      ctx.msg('Aún no conoces ese poder... (completa el capítulo 4)');
      return;
    }
    if (this.titanForm > 0 || this.downed || this.grabbedBy) return;
    if (this.rage < 100) {
      ctx.msg(`La furia no basta todavía (${Math.floor(this.rage)}/100). Mata titanes o recibe golpes.`);
      return;
    }
    this.rage = 0;
    this.titanForm = 25;
    this.releaseHook(false);
    // cuerpo de titán: el modelo del Titán de Ataque, o uno propio
    this.titanMesh = instance('titan_grande', 15) || this._buildFallbackTitan();
    this.titanMesh.position.copy(this.pos);
    this.scene.add(this.titanMesh);
    this.mesh.visible = false;
    this.rope.visible = false;
    burst(this.scene, this.pos.clone().setY(6), { count: 120, color: 0xffe8c8, size: 2.6, speed: 16, up: 18, life: 1.6, gravity: 1 });
    sfx.roar();
    ctx.onQuake?.(1.2);
    ctx.msg('‼‼ ¡¡TE TRANSFORMAS!! El rayo cae y la carne hierve. ERES EL TITÁN DE ATAQUE.', true);
  }

  _buildFallbackTitan() {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: 0x8a6a52 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(4.4, 5.2, 2.4), m);
    torso.position.y = 9.4;
    g.add(torso);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.3, 7, 1.3), m);
      leg.position.set(side * 1.2, 3.5, 0);
      g.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.4, 0.95), m);
      arm.position.set(side * 2.7, 9.2, 0);
      g.add(arm);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 1.8), m);
    head.position.y = 13.2;
    g.add(head);
    return g;
  }

  revert(ctx) {
    this.titanForm = 0;
    if (this.titanMesh) {
      steam(this.scene, this.pos.clone().setY(7), true);
      this.scene.remove(this.titanMesh);
      this.titanMesh = null;
    }
    this.mesh.visible = true;
    this.invuln = 2;
    this.vel.set(0, 6, 0);
    ctx.msg('El vapor te escupe del cuello del titán. Estás agotado... pero vivo.', true);
  }

  punch(titans, ctx) {
    if (this.punchCd > 0) return;
    this.punchCd = 0.6;
    this._punchAnim = 0.3;
    sfx.bigThud();
    ctx.onQuake?.(0.5);
    const f = this.camera.getWorldDirection(_dir).setY(0).normalize();
    let hits = 0;
    for (const t of titans) {
      if (t.dead || t.dying > 0) continue;
      _v.copy(t.pos).sub(this.pos).setY(0);
      const d = _v.length();
      if (d > 14) continue;
      if (d > 2 && _v.normalize().dot(f) < 0.25) continue;   // arco frontal
      hits += 1;
      const killed = t.damage(3, ctx, this.name, true);      // los puños rompen armadura
      if (killed) {
        this.kills += 1;
        sfx.kill();
        ctx.onKill(t, this);
      }
    }
    if (hits === 0) ctx.msg('Tu puño destroza el aire.');
  }

  // ------------------------------------------------------------ lanzas trueno
  throwSpear(ctx) {
    if (this.downed || this.grabbedBy) return;
    if (this.spears <= 0) {
      ctx.msg('Sin lanzas trueno. (Se equipan en la Armería, 4 por misión)');
      return;
    }
    this.spears -= 1;
    sfx.hook();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.5, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd84a }));
    mesh.position.copy(this.pos);
    mesh.position.y += 1.5;
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);
    this.spearProjectiles.push({ mesh, vel: dir.multiplyScalar(55).add(this.vel), age: 0 });
    ctx.msg(`¡LANZA TRUENO! (${this.spears} restantes)`);
  }

  _updateSpears(dt, titans, ctx) {
    for (let i = this.spearProjectiles.length - 1; i >= 0; i--) {
      const s = this.spearProjectiles[i];
      s.age += dt;
      s.vel.y -= 9 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      let hit = null;
      for (const t of titans) {
        if (t.dead || t.dying > 0) continue;
        _v.copy(t.pos);
        _v.y = s.mesh.position.y;
        if (s.mesh.position.distanceTo(_v) < t.height * 0.22 + 1.5
            && s.mesh.position.y < t.height * 1.05) { hit = t; break; }
      }
      if (hit || s.mesh.position.y <= 0.2 || s.age > 3) {
        const at = s.mesh.position.clone();
        burst(this.scene, at, { count: 55, color: 0xffc84a, size: 1.1, speed: 16, up: 9, life: 0.7, gravity: -10 });
        sfx.bigThud();
        ctx.onQuake?.(0.5);
        if (hit) {
          const nearNape = at.distanceTo(hit.napePos()) < 7;
          const dmg = nearNape ? 4 : 1;
          const killed = hit.damage(dmg, ctx, this.name, true);    // perfora armadura
          if (killed) {
            this.kills += 1;
            sfx.kill();
            ctx.onKill(hit, this);
          }
        }
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.spearProjectiles.splice(i, 1);
      }
    }
  }

  _spawnTrail() {
    const geo = new THREE.RingGeometry(0.7, 1.9, 14, 1, 0, 2.4);
    const m = new THREE.MeshBasicMaterial({
      color: 0xeef6ff, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const trail = new THREE.Mesh(geo, m);
    trail.position.copy(this.pos);
    trail.position.y += 1.4;
    trail.quaternion.copy(this.camera.quaternion);
    trail.rotateZ(Math.random() * Math.PI);
    this.scene.add(trail);
    this.trails.push({ mesh: trail, age: 0 });
  }

  takeDamage(dmg, titan, ctx) {
    if (this.titanForm > 0) {
      // en forma de titán el daño solo acorta la transformación
      this.titanForm = Math.max(0.5, this.titanForm - 2.5);
      ctx.onQuake?.(0.3);
      return;
    }
    if (this.invuln > 0 || this.downed || ctx.noDeath) return;
    this.hp -= dmg;
    this.invuln = 1.1;
    sfx.hurt();
    this.addRage(15);
    ctx.onPlayerHurt();
    _v.copy(this.pos).sub(titan.pos).setY(0).normalize();
    this.vel.addScaledVector(_v, 18);
    this.vel.y = 8;
    this.releaseHook(false);
    if (this.hp <= 0) {
      this.downed = true;
      ctx.msg(`✖ ${this.name} cae gravemente herido...`, true);
      ctx.onPlayerDown(false);
    } else {
      ctx.msg(`¡El ${titan.spec.name} te golpea! (${this.hp} HP)`, true);
    }
  }

  onGrabbed(titan, ctx) {
    this.grabbedBy = titan;
    this.grabTimer = 0;
    this.struggle = 0;
    this.releaseHook(false);
    sfx.grab();
    ctx.msg('‼ ¡TE ATRAPÓ! ¡Machaca WASD!', true);
  }

  onReleased() {
    this.grabbedBy = null;
    this.vel.set(0, 6, 0);
  }

  heldAt(handPos, dt, titan, ctx) {
    this.pos.copy(handPos);
    this.vel.set(0, 0, 0);
    this.grabTimer += dt;
    if (this.grabTimer > 3.6) {
      titan.grabTarget = null;
      this.grabbedBy = null;
      this.downed = true;
      this.eaten = true;
      blood(this.scene, this.pos);
      ctx.msg(`✖✖ ${this.name} es DEVORADO.`, true);
      ctx.onPlayerDown(true);
    }
  }

  mash(bonus) {
    if (!this.grabbedBy) return;
    this.struggle += 1 + Math.floor(this.soldier.strength / 2) * 0.5 + bonus * 0.5;
    if (this.struggle >= this.struggleNeed) {
      const t = this.grabbedBy;
      t.grabTarget = null;
      this.grabbedBy = null;
      this.vel.set(0, 9, 0);
      this.pos.y = Math.max(this.pos.y, 2);
      sfx.dash();
    }
  }

  // ------------------------------------------------------------ update
  update(dt, input, titans, ctx) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hookGrace = Math.max(0, this.hookGrace - dt);
    this.punchCd = Math.max(0, this.punchCd - dt);

    // -------- FORMA DE TITÁN --------
    if (this.titanForm > 0) {
      this.titanForm -= dt;
      if (this.titanForm <= 0) {
        this.revert(ctx);
      } else {
        this._updateTitanForm(dt, input, ctx);
        return;
      }
    }

    if (this.grabbedBy) {
      this._animate(dt, 0);
      this._updateCamera(dt);
      return;
    }
    if (this.downed) {
      this.mesh.rotation.z = Math.PI / 2;
      this._updateCamera(dt);
      return;
    }

    // cámara con el mouse
    this.yaw -= input.mouseDX * 0.0023;
    this.pitch = Math.max(-0.55, Math.min(1.1, this.pitch + input.mouseDY * 0.0023));

    const move = _moveVec(input, this.yaw);

    if (this.hooked || this.hookPoint) {
      let anchor = null;
      if (this.hooked) {
        if (this.hooked.dead || this.hooked.dying > 0) this.releaseHook();
        else anchor = this.hooked.napePos();
      } else {
        anchor = this.hookPoint;
      }
      if (anchor) {
        const toTitan = !!this.hooked;
        _v.copy(anchor).sub(this.pos);
        const d = _v.length();
        _v.normalize();
        this.vel.addScaledVector(_v, 70 * dt);
        this.vel.multiplyScalar(1 - 0.55 * dt);
        const maxSpd = toTitan ? 40 : 44;
        if (this.vel.length() > maxSpd) this.vel.setLength(maxSpd);
        this.gas -= dt * (toTitan ? 3.2 : 2.2) * gasFactor(this.gs);
        this._jetT -= dt;
        if (this._jetT <= 0) { this._jetT = 0.38; sfx.gasJet(); }
        this._hookT = (this._hookT || 0) + dt;
        if (d < (toTitan ? 3.6 : 5.0) || (!toTitan && this._hookT > 2.5)) {
          this.releaseHook(toTitan);
          if (toTitan) {
            this.vel.multiplyScalar(0.4);
            this.vel.y = 6;
          } else {
            // honda: conserva el impulso y sale disparado hacia arriba
            this.vel.multiplyScalar(0.85);
            this.vel.y = Math.max(this.vel.y, 9);
          }
        }
        if (this.gas <= 0) {
          this.gas = 0;
          this.releaseHook(false);
          ctx.msg('⚠ ¡TANQUES VACÍOS! Estás a pie.', true);
        }
      }
      this.vel.y -= GRAVITY * 0.22 * dt;
    } else {
      const speed = 11 + this.soldier.agility * 0.7;
      const accel = this.onGround ? 75 : 18;
      this.vel.x += move.x * accel * dt;
      this.vel.z += move.z * accel * dt;
      const hv = Math.hypot(this.vel.x, this.vel.z);
      if (hv > speed && this.onGround) {
        this.vel.x *= speed / hv;
        this.vel.z *= speed / hv;
      }
      if (this.onGround) {
        const damp = move.lengthSq() < 0.01 ? 1 : 0.15;
        this.vel.x *= 1 - Math.min(1, 8 * dt) * damp;
        this.vel.z *= 1 - Math.min(1, 8 * dt) * damp;
        if (input.jump) this.vel.y = 13;
        if (hv > 2) stepSound(dt, hv);
      }
      this.vel.y -= GRAVITY * dt;
    }

    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      if (!this.onGround && this.vel.lengthSq() > 100) sfx.thud();
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    collideSolids(this.pos, 0.6, ctx.solids);
    clampArena(this.pos);

    this._animate(dt, Math.hypot(this.vel.x, this.vel.z));
    this._updateCamera(dt);
    this._updateRope();
    this._updateTrails(dt);
    this._updateSpears(dt, titans, ctx);
  }

  // ------------------------------------------------------------ animación corporal
  _animate(dt, hv) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.z = 0;

    const flying = !this.onGround;
    const total = Math.hypot(hv, this.vel.y);

    // orientación del cuerpo
    if (this.hooked || this.hookPoint || (flying && total > 8)) {
      this.mesh.rotation.y = Math.atan2(this.vel.x, this.vel.z);
    } else if (hv > 0.8) {
      const targetYaw = Math.atan2(this.vel.x, this.vel.z);
      let d = targetYaw - this.mesh.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.mesh.rotation.y += d * Math.min(1, dt * 12);
    }

    if (this.grabbedBy) {
      if (!this.legs.length) return;            // modelo GLB sin articulaciones
      // patalear
      const t = performance.now() * 0.02;
      this.legs[0].rotation.x = Math.sin(t) * 1.2;
      this.legs[1].rotation.x = -Math.sin(t) * 1.2;
      this.arms[0].rotation.x = Math.cos(t) * 1.4;
      this.arms[1].rotation.x = -Math.cos(t) * 1.4;
      return;
    }

    // modelo GLB personalizado: sin articulaciones, solo inclinación y giro de ataque
    if (!this.legs.length) {
      const lean = flying ? 0.5 : hv > 0.8 ? 0.14 : 0;
      this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 7);
      if (this.attackAnim > 0) {
        this.attackAnim -= dt;
        const t = 1 - Math.max(0, this.attackAnim) / 0.28;
        this.body.rotation.y = this.spinDir * Math.sin(t * Math.PI) * (flying ? 2.4 : 0.7);
      } else {
        this.body.rotation.y *= 1 - Math.min(1, dt * 10);
      }
      if (hv > 0.8 && !flying) this.mesh.position.y += Math.abs(Math.sin(this.runPhase += dt * (4 + hv * 0.9))) * 0.06;
      return;
    }

    if (flying) {
      // pose de vuelo: cuerpo inclinado, piernas atrás
      const pitch = Math.max(-1.2, Math.min(0.4, -this.vel.y * 0.04 + 0.55));
      this.body.rotation.x += (pitch * 0.55 - this.body.rotation.x) * Math.min(1, dt * 8);
      for (const leg of this.legs) leg.rotation.x += (1.0 - leg.rotation.x) * Math.min(1, dt * 8);
      if (this.attackAnim <= 0) {
        this.arms[0].rotation.x += (-0.8 - this.arms[0].rotation.x) * Math.min(1, dt * 8);
        this.arms[1].rotation.x += (-0.8 - this.arms[1].rotation.x) * Math.min(1, dt * 8);
      }
      this.cape.rotation.x = 1.2 + Math.sin(performance.now() * 0.01) * 0.15;
    } else if (hv > 0.8) {
      // carrera
      this.runPhase += dt * (4 + hv * 0.9);
      const sw = Math.sin(this.runPhase);
      this.legs[0].rotation.x = sw * 0.95;
      this.legs[1].rotation.x = -sw * 0.95;
      if (this.attackAnim <= 0) {
        this.arms[0].rotation.x = -sw * 0.7;
        this.arms[1].rotation.x = sw * 0.7;
      }
      this.body.rotation.x += (0.16 - this.body.rotation.x) * Math.min(1, dt * 6);
      this.mesh.position.y += Math.abs(Math.sin(this.runPhase)) * 0.07;
      this.cape.rotation.x = 0.3 + hv * 0.035 + Math.sin(this.runPhase * 2) * 0.08;
    } else {
      // reposo: respiración
      const b = Math.sin(performance.now() * 0.0022) * 0.03;
      this.body.rotation.x += (b - this.body.rotation.x) * Math.min(1, dt * 4);
      for (const leg of this.legs) leg.rotation.x *= 1 - Math.min(1, dt * 8);
      if (this.attackAnim <= 0)
        for (const arm of this.arms) arm.rotation.x *= 1 - Math.min(1, dt * 8);
      this.cape.rotation.x += (0.12 - this.cape.rotation.x) * Math.min(1, dt * 4);
    }

    // golpe de espadas: barrido amplio + giro del torso
    if (this.attackAnim > 0) {
      this.attackAnim -= dt;
      const t = 1 - Math.max(0, this.attackAnim) / 0.28;
      const sweep = Math.sin(t * Math.PI);
      this.arms[0].rotation.x = -2.4 * sweep;
      this.arms[1].rotation.x = -2.4 * sweep;
      this.arms[0].rotation.z = 1.1 * sweep * this.spinDir;
      this.arms[1].rotation.z = -1.1 * sweep * this.spinDir;
      this.body.rotation.y = this.spinDir * sweep * (flying ? 2.4 : 0.7);
    } else {
      this.body.rotation.y *= 1 - Math.min(1, dt * 10);
      this.arms[0].rotation.z *= 1 - Math.min(1, dt * 10);
      this.arms[1].rotation.z *= 1 - Math.min(1, dt * 10);
    }

    const hasBlade = this.blades.length > 0;
    for (const b of this.bladeMeshes) b.visible = hasBlade;
  }

  _updateTitanForm(dt, input, ctx) {
    // cámara
    this.yaw -= input.mouseDX * 0.0023;
    this.pitch = Math.max(-0.5, Math.min(1.0, this.pitch + input.mouseDY * 0.0023));
    // pisadas de 15 metros
    const move = _moveVec(input, this.yaw);
    const speed = 19;
    this.vel.x += move.x * 60 * dt;
    this.vel.z += move.z * 60 * dt;
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > speed) { this.vel.x *= speed / hv; this.vel.z *= speed / hv; }
    if (this.onGround) {
      const damp = move.lengthSq() < 0.01 ? 1 : 0.12;
      this.vel.x *= 1 - Math.min(1, 7 * dt) * damp;
      this.vel.z *= 1 - Math.min(1, 7 * dt) * damp;
      if (input.jump) this.vel.y = 17;
    }
    this.vel.y -= GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) {
      if (!this.onGround) { sfx.bigThud(); ctx.onQuake?.(0.4); }
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    } else this.onGround = false;
    collideSolids(this.pos, 2.6, ctx.solids);
    clampArena(this.pos);

    // cuerpo del titán
    const tm = this.titanMesh;
    if (tm) {
      tm.position.copy(this.pos);
      if (hv > 0.8) tm.rotation.y = Math.atan2(this.vel.x, this.vel.z);
      this._titanPhase = (this._titanPhase || 0) + dt * hv * 0.35;
      tm.position.y += Math.abs(Math.sin(this._titanPhase)) * 0.35;
      // pasos retumbantes
      const stepNow = Math.sign(Math.sin(this._titanPhase));
      if (stepNow !== this._titanStepPrev && hv > 2) {
        this._titanStepPrev = stepNow;
        sfx.thud();
        ctx.onQuake?.(0.18);
      }
      if (this._punchAnim > 0) {
        this._punchAnim -= dt;
        tm.rotation.x = -0.3 * Math.sin((1 - this._punchAnim / 0.3) * Math.PI);
      } else tm.rotation.x *= 0.8;
    }
    this._updateCamera(dt);
    this._updateRope();
  }

  _updateCamera(dt) {
    const titan = this.titanForm > 0;
    const dist = titan ? 30 : 8.5, height = titan ? 16 : 3.0;
    const cx = this.pos.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch);
    const cz = this.pos.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch);
    const cy = this.pos.y + height + Math.sin(this.pitch) * dist;
    _v.set(cx, Math.max(cy, 1.0), cz);
    this.camera.position.lerp(_v, Math.min(1, dt * 16));
    _dir.copy(this.pos);
    _dir.y += titan ? 11 : 2.0;
    this.camera.lookAt(_dir);

    // FOV dinámico: sensación de velocidad
    const speed = this.vel.length();
    const targetFov = 70 + (this.hooked ? Math.min(18, speed * 0.4) : 0) + this.fovKick;
    this.fovKick *= 1 - Math.min(1, dt * 5);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * 0.5;
    }
  }

  _updateRope() {
    const target = (this.hooked && !this.hooked.dead) ? this.hooked.napePos() : this.hookPoint;
    if (target) {
      this.rope.visible = true;
      const pts = this.rope.geometry.attributes.position;
      pts.setXYZ(0, this.pos.x, this.pos.y + 1.3, this.pos.z);
      pts.setXYZ(1, target.x, target.y, target.z);
      pts.needsUpdate = true;
    } else {
      this.rope.visible = false;
    }
  }

  _updateTrails(dt) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.age += dt;
      tr.mesh.material.opacity = 0.85 * (1 - tr.age / 0.18);
      tr.mesh.scale.setScalar(1 + tr.age * 5);
      if (tr.age > 0.18) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this.trails.splice(i, 1);
      }
    }
  }

  dispose() {
    this.scene.remove(this.mesh, this.rope);
    if (this.titanMesh) this.scene.remove(this.titanMesh);
    for (const tr of this.trails) this.scene.remove(tr.mesh);
  }
}

function _moveVec(input, yaw) {
  _dir.set(0, 0, 0);
  if (input.keys['w']) { _dir.x += Math.sin(yaw); _dir.z += Math.cos(yaw); }
  if (input.keys['s']) { _dir.x -= Math.sin(yaw); _dir.z -= Math.cos(yaw); }
  if (input.keys['a']) { _dir.x += Math.cos(yaw); _dir.z -= Math.sin(yaw); }
  if (input.keys['d']) { _dir.x -= Math.cos(yaw); _dir.z += Math.sin(yaw); }
  if (_dir.lengthSq() > 1) _dir.normalize();
  return _dir;
}
