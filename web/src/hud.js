// HUD de misión (DOM sobre el canvas).
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const _proj = new THREE.Vector3();

export class Hud {
  constructor() {
    this.root = $('hud');
    this.onPause = null;        // lo asigna main.js
  }

  show() { this.root.classList.add('active'); }
  hide() {
    this.root.classList.remove('active');
    $('msg-log').innerHTML = '';
    this.setGrab(-1);
  }

  setHp(hp) {
    $('hp-hearts').textContent = '♥'.repeat(Math.max(0, hp)) + '·'.repeat(Math.max(0, 3 - hp));
  }

  setGas(frac) {
    $('gas-fill').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    $('gas-label').textContent = `GAS ${Math.round(Math.max(0, frac) * 100)}%`;
  }

  setBlades(pairs, edge) {
    $('blade-label').textContent = pairs > 0 ? `HOJAS ×${pairs} (filo ${edge})` : '¡SIN HOJAS!';
    $('blade-label').style.color = pairs > 0 ? '#fff' : '#ff6a5a';
  }

  setSpears(n) {
    const el = $('spear-label');
    el.style.display = n > 0 ? 'inline' : 'none';
    if (n > 0) el.textContent = ` ⚡×${n} (Q)`;
  }

  setRage(unlocked, frac, titanForm) {
    const row = $('rage-row');
    row.style.display = unlocked ? 'flex' : 'none';
    if (!unlocked) return;
    const fill = $('rage-fill');
    const label = $('rage-label');
    if (titanForm > 0) {
      fill.style.width = `${(titanForm / 25) * 100}%`;
      label.textContent = `TITÁN ${Math.ceil(titanForm)}s`;
      row.classList.add('full');
    } else {
      fill.style.width = `${Math.min(1, frac) * 100}%`;
      label.textContent = frac >= 1 ? '¡FURIA LISTA! pulsa F' : `FURIA ${Math.floor(frac * 100)}%`;
      row.classList.toggle('full', frac >= 1);
    }
  }

  setObjective(html) { $('objective').innerHTML = html; }

  setCrosshair(inRange) {
    $('crosshair').classList.toggle('in-range', inRange);
  }

  setSquad(units) {
    $('squad-list').innerHTML = units.map(u => {
      if (u.downed) return `<div class="dead">${u.name.split(' ')[0]}</div>`;
      const hearts = '♥'.repeat(u.hp);
      const gas = Math.round(u.gas);
      return `<div>${u.name.split(' ')[0]} <span style="color:#e8645a">${hearts}</span> <span style="color:#e8c84a">g${gas}</span></div>`;
    }).join('');
  }

  setBoss(info) {
    const bar = $('boss-bar');
    if (!info) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    $('boss-name').textContent = info.name;
    $('boss-fill').style.width = `${info.pct * 100}%`;
  }

  setGrab(frac) {
    $('grab-overlay').classList.toggle('active', frac >= 0);
    if (frac >= 0) $('grab-fill').style.width = `${Math.min(100, frac * 100)}%`;
  }

  /** Marcador proyectado a pantalla: nuca (amarillo), anclaje (verde) o alerta (rojo). */
  setMarker(worldPos, camera, text, mode = 'nape') {
    const el = $('nape-marker');
    if (!worldPos) { el.style.display = 'none'; return; }
    _proj.copy(worldPos);
    _proj.project(camera);
    if (_proj.z > 1) { el.style.display = 'none'; return; }     // detrás de la cámara
    el.style.display = 'block';
    el.style.left = `${(_proj.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-_proj.y * 0.5 + 0.5) * window.innerHeight}px`;
    el.className = '';
    if (mode !== 'nape') el.classList.add(mode);
    el.querySelector('span').textContent = text;
  }

  killFlash() {
    const f = $('kill-flash');
    f.style.transition = 'none';
    f.style.opacity = '0.75';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity .5s';
      f.style.opacity = '0';
    });
  }

  renderMessages(messages, now) {
    $('msg-log').innerHTML = messages
      .filter(m => now - m.t < 7)
      .map(m => `<div class="${m.urgent ? 'urgent' : ''}">${m.text}</div>`)
      .join('');
  }

  vignette() {
    const v = $('damage-vignette');
    v.style.opacity = '1';
    setTimeout(() => { v.style.opacity = '0'; }, 350);
  }

  showPause() {
    if (this.onPause) this.onPause();
  }
}
