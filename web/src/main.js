// Punto de entrada: renderer, bucle principal y máquina de estados.
import * as THREE from 'three';
import { Hud } from './hud.js';
import { Hq, titleScreen, pauseScreen, hideMenu } from './hq.js';
import { Mission } from './combat.js';
import { ensureAudio, sfx } from './audio.js';
import { loadAssets, assetKeysForSpec } from './assets.js';
import { SKINS } from './state.js';
import { createMenuBg } from './menubg.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 30, -60);

const menubg = createMenuBg();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  menubg.resize();
});

const hud = new Hud();

const app = {
  scene, camera, renderer, hud,
  gs: null, slot: null,
  mission: null,
  hq: null,
  _onMissionDone: null,

  beginGame(gs, slot) {
    this.gs = gs;
    this.slot = slot;
    this.hq = new Hq(this);
    this.hq.cuartel();
  },

  toTitle() {
    this.gs = null;
    this.mission = null;
    titleScreen(this);
  },

  async startMission(spec, squad, onDone) {
    hideMenu();
    this._onMissionDone = onDone;
    // carga perezosa de los modelos 3D que necesita ESTA misión (con caché)
    const loadEl = document.getElementById('loading-overlay');
    const loadTxt = document.getElementById('loading-text');
    try {
      loadEl.classList.add('active');
      loadTxt.textContent = 'Preparando el equipo de maniobras...';
      await loadAssets(assetKeysForSpec(spec, this.gs, SKINS), (done, total) => {
        loadTxt.textContent = `Cargando modelos... ${done}/${total}`;
      });
    } finally {
      loadEl.classList.remove('active');
    }
    hud.show();
    this.mission = new Mission(this, spec, squad);
  },

  onMissionEnd(result) {
    this.mission = null;
    hud.hide();
    const cb = this._onMissionDone;
    this._onMissionDone = null;
    if (cb) cb(result);
  },
};

hud.onPause = () => pauseScreen(app);
window.__app = app;        // depuración

// el audio del navegador necesita un gesto del usuario para activarse
window.addEventListener('pointerdown', ensureAudio, { once: false });
document.addEventListener('click', (e) => {
  if (e.target.closest?.('.btn')) sfx.ui();
});

// ---------------- bucle principal
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (app.mission) {
    app.mission.update(dt);
    renderer.render(scene, camera);
  } else {
    // fondo ambiental de los menús: titanes vagando al atardecer
    menubg.update(dt);
    renderer.render(menubg.scene, menubg.camera);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

titleScreen(app);
