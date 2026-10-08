// Escuadrón aliado: soldados con IA que vuelan con ODM y cazan nucas.
import * as THREE from 'three';
import { allyDmgBonus, hasTech, SKINS } from './state.js';
import { blood } from './fx.js';
import { clampArena } from './world.js';
import { instance, assets } from './assets.js';

const _v = new THREE.Vector3();
const _goal = new THREE.Vector3();

const CAPE_COLORS = [0x3a6a8a, 0x6a3a8a, 0x8a6a3a, 0x3a8a5a];
const HERO_MODELS = ['skin_mikasa', 'skin_annie', 'skin_historia', 'skin_reiner', 'skin_zeke'];

export class Ally {
  constructor(scene, gs, soldier, spawn, idx) {
    this.scene = scene;
    this.gs = gs;
    this.soldier = soldier;
    this.name = soldier.name;
    this.idx = idx;

    this.pos = new THREE.Vector3(spawn.x + (idx - 1.5) * 3, 0, spawn.z - 4 - idx * 2);
    this.hp = 3;
    this.gas = 0;
    this.bladeUses = 0;        // cortes restantes (abstracción de pares)
    this.kills = 0;
    this.alive = true;
    this.downed = false;
    this.eaten = false;
    this.grabbedBy = null;
    this.grabTimer = 0;
    this.panic = 0;
    this.attackCd = 1 + Math.random() * 2;
    this.bob = Math.random() * 10;
    this.orbitSign = idx % 2 === 0 ? 1 : -1;

    this._build();
  }

  _build() {
    // tus compañeros usan los modelos de los héroes (Mikasa, Annie, etc.)
    const playerModel = (SKINS[this.gs.skin] || {}).model;
    const pool = HERO_MODELS.filter(k => assets[k] && k !== playerModel);
    if (pool.length) {
      const custom = instance(pool[this.idx % pool.length], 1.8);
      if (custom) {
        this.mesh = custom;
        this.mesh.position.copy(this.pos);
        this.scene.add(custom);
        return;
      }
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.85, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0xb8a888 }));
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.1),
      new THREE.MeshLambertMaterial({ color: CAPE_COLORS[this.idx % CAPE_COLORS.length], side: THREE.DoubleSide }));
    cape.position.set(0, 1.05, -0.3);
    g.add(cape);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 7),
      new THREE.MeshLambertMaterial({ color: 0xe0c0a0 }));
    head.position.y = 1.8;
    g.add(head);
    this.mesh = g;
    this.mesh.position.copy(this.pos);
    this.scene.add(g);
  }

  takeDamage(dmg, titan, ctx) {
    if (this.downed || ctx.noDeath) return;
    this.hp -= dmg;
    blood(this.scene, this.pos.clone().setY(this.pos.y + 1.2));
    if (this.hp <= 0) this._down(ctx, false);
    else ctx.msg(`¡${titan.spec.name} golpea a ${this.name}! (${this.hp} HP)`);
  }

  onGrabbed(titan, ctx) {
    this.grabbedBy = titan;
    this.grabTimer = 0;
    ctx.msg(`‼ ¡Un titán atrapa a ${this.name}! ¡Sálvalo!`, true);
  }

  onReleased() {
    this.grabbedBy = null;
  }

  heldAt(handPos, dt, titan, ctx) {
    this.pos.copy(handPos);
    this.grabTimer += dt;
    // forcejeo propio
    if (Math.random() < this.soldier.strength * 0.004) {
      titan.grabTarget = null;
      this.grabbedBy = null;
      ctx.msg(`¡${this.name} se zafa con pura fuerza!`);
      return;
    }
    const limit = ctx.noDeath ? 999 : 3.6;
    if (this.grabTimer > limit) {
      titan.grabTarget = null;
      this.grabbedBy = null;
      this.eaten = true;
      this._down(ctx, true);
    }
  }

  _down(ctx, eaten) {
    this.downed = true;
    this.alive = false;          // a efectos de la misión
    this.mesh.visible = false;
    if (eaten) ctx.msg(`✖✖ ${this.name} es DEVORADO.`, true);
    else ctx.msg(`✖ ${this.name} cae herido y es evacuado.`, true);
    ctx.onAllyDown(this, eaten);
  }

  update(dt, ctx) {
    if (this.downed) return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.panic = Math.max(0, this.panic - dt);
    this.bob += dt * 6;
    if (this.grabbedBy) {
      this.mesh.position.copy(this.pos);
      return;
    }

    const titans = ctx.titans.filter(t => !t.dead && t.dying <= 0 && !t.dummy || (t.dummy && ctx.mode === 'tutorial' && !t.dead && t.dying <= 0));

    // ---------------- elegir objetivo
    let target = null;
    const grabber = ctx.titans.find(t => t.grabTarget && !t.dead && t.dying <= 0);
    if (grabber) target = grabber;
    else if (this.panic > 0) target = null;
    else {
      let bd = 1e9;
      for (const t of titans) {
        // la presa del jugador es del jugador: no le roban el kill
        if (t === ctx.player.hooked) continue;
        // no se alejan a limpiar el mapa solos
        if (ctx.player.pos.distanceTo(t.pos) > (ctx.order === 'follow' ? 45 : 80)) continue;
        const d = this.pos.distanceTo(t.pos);
        if (d < bd) { bd = d; target = t; }
      }
    }

    const lowGas = this.gas <= 0;
    const noBlades = this.bladeUses <= 0;
    const shouldRetreat = (this.hp <= 1 || (lowGas && noBlades) || this.panic > 0) && target !== grabber;

    // ---------------- decidir destino
    if (shouldRetreat && target) {
      _goal.copy(this.pos).sub(target.pos).setY(0).normalize().multiplyScalar(30).add(this.pos);
      _goal.y = 0;
    } else if (!target) {
      // seguir al jugador
      _v.copy(ctx.player.pos);
      _goal.set(_v.x + this.orbitSign * 5, Math.max(0, _v.y), _v.z - 5);
    } else {
      // punto de ataque: junto a la nuca
      const np = target.napePos(_v);
      _goal.copy(np);
      _goal.x += this.orbitSign * 1.5;
    }

    // ---------------- mover (vuelo ODM o a pie)
    const dGoal = this.pos.distanceTo(_goal);
    let speed;
    if (!lowGas) {
      speed = 17 + this.soldier.agility * 1.2;
      this.gas -= dt * (dGoal > 6 ? 1.0 : 0.25);
      if (this.gas <= 0) { this.gas = 0; ctx.msg(`⚠ ${this.name} se queda sin gas.`); }
    } else {
      speed = 6;
      _goal.y = 0;               // sin gas no se vuela
    }
    if (dGoal > 0.5) {
      _v.copy(_goal).sub(this.pos).normalize();
      this.pos.addScaledVector(_v, Math.min(speed * dt, dGoal));
    }
    if (lowGas) this.pos.y = Math.max(0, this.pos.y - 12 * dt);
    clampArena(this.pos);

    // ---------------- atacar (más lento y débil que el jugador: ellos apoyan)
    if (target && !shouldRetreat && this.attackCd <= 0 && !noBlades) {
      const np = target.napePos(_v);
      if (this.pos.distanceTo(np) < 4.5) {
        this.attackCd = 3.6 + Math.random() * 0.8;
        this.bladeUses -= (this.soldier.trait === 'ahorrador' && Math.random() < 0.5) ? 0 : 1;
        let dmg = 1 + Math.floor(this.soldier.strength / 5) + allyDmgBonus(this.gs);
        if (this.soldier.trait === 'carnicero') dmg += 1;
        if (Math.random() < this.soldier.precision * 0.03) dmg += 1;
        const killed = target.damage(dmg, ctx, this.name);
        if (killed) {
          this.kills += 1;
          ctx.onKill(target, this);
        }
        // riesgo del enganche
        let risk = 0.07 - this.soldier.agility * 0.006;
        if (target.kind === 'grande') risk += 0.05;
        if (Math.random() < Math.max(0.01, risk)) this.takeDamage(1, target, ctx);
      }
    }

    // rescate veloz: si hay un agarrado y tenemos la tecnología, ataque inmediato al llegar
    if (grabber && hasTech(this.gs, 'rescate') && this.attackCd > 0.6
        && this.pos.distanceTo(grabber.napePos(_v)) < 5) {
      this.attackCd = 0.5;
    }

    // ---------------- visual
    this.mesh.position.copy(this.pos);
    this.mesh.position.y += lowGas ? 0 : Math.sin(this.bob) * 0.3;
    if (target) this.mesh.lookAt(target.pos.x, this.mesh.position.y, target.pos.z);
  }

  onAllyDeathNearby(deadPos, ctx) {
    if (this.downed || this.soldier.trait === 'veterano') return;
    if (this.pos.distanceTo(deadPos) > 70) return;
    if (Math.random() * 100 > this.soldier.courage * 10 + 25) {
      this.panic = 4;
      ctx.msg(`¡${this.name} entra en pánico!`, true);
    }
  }

  dispose() { this.scene.remove(this.mesh); }
}
