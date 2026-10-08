// Modelos 3D (.glb) con carga perezosa por misión: solo se descarga lo que
// la misión necesita, una sola vez (caché en memoria). Fallback procedural.
import * as THREE from 'three';
import { GLTFLoader } from '../lib/loaders/GLTFLoader.js';
import { clone as skeletonClone } from '../lib/utils/SkeletonUtils.js';

export const assets = {};      // clave -> THREE.Group (plantilla) | null si falló

// Catálogo completo (web/assets/). house3 (75MB) queda fuera por peso.
const CATALOG = {
  house:    'assets/house.glb',
  house2:   'assets/house2.glb',
  house4:   'assets/house4.glb',
  gatehouse: 'assets/gatehouse.glb',
  city1:    'assets/city1.glb',
  blades:   'assets/blades.glb',
  skin_mikasa:   'assets/skin_mikasa.glb',
  skin_annie:    'assets/skin_annie.glb',
  skin_historia: 'assets/skin_historia.glb',
  skin_reiner:   'assets/skin_reiner.glb',
  skin_zeke:     'assets/skin_zeke.glb',
  titan_hembra:    'assets/titan_hembra.glb',
  titan_bestia:    'assets/titan_bestia.glb',
  titan_anormal:   'assets/titan_anormal.glb',
  titan_grande:    'assets/titan_grande.glb',
  titan_mandibula: 'assets/titan_mandibula.glb',
  titan_colosal:   'assets/titan_colosal.glb',
};

// Modelo 3D que usa cada tipo de titán (los puros quedan procedurales).
export const TITAN_MODELS = {
  hembra: 'titan_hembra', bestia: 'titan_bestia', anormal: 'titan_anormal',
  grande: 'titan_grande', mandibula: 'titan_mandibula',
};

// Ajustes por modelo: orientación (si camina de espaldas, corrige aquí) y giro.
const TUNE = {
  // clave: { rotY: Math.PI }
};

const _loader = new GLTFLoader();
const _pending = {};

async function _loadOne(key) {
  if (key in assets) return;
  if (_pending[key]) return _pending[key];
  const url = CATALOG[key];
  if (!url) { assets[key] = null; return; }
  _pending[key] = (async () => {
    try {
      const gltf = await _loader.loadAsync(url);
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;          // los riggeados se recortan mal
        // materiales rotos que se ven negros: aclararlos
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          if (m.color && !m.map) {
            const hsl = {};
            m.color.getHSL(hsl);
            if (hsl.l < 0.06) m.color.setHSL(hsl.h, hsl.s, 0.45);
          }
        }
      });
      assets[key] = gltf.scene;
      console.log(`[assets] cargado: ${url}`);
    } catch (e) {
      assets[key] = null;
      console.warn(`[assets] no se pudo cargar ${url} (se usa el modelo propio)`, e?.message || e);
    }
  })();
  return _pending[key];
}

/** Carga (una vez) las claves pedidas. onProgress(cargados, total). */
export async function loadAssets(keys, onProgress = null) {
  const todo = [...new Set(keys)].filter(k => !(k in assets) && CATALOG[k]);
  let done = 0;
  await Promise.all(todo.map(k => _loadOne(k).then(() => {
    done += 1;
    onProgress?.(done, todo.length);
  })));
}

/** Claves que necesita una misión concreta. */
export function assetKeysForSpec(spec, gs, skins) {
  const keys = [];
  const skin = skins[gs.skin];
  if (skin?.model) keys.push(skin.model);
  // los compañeros usan los modelos de los héroes
  keys.push('skin_mikasa', 'skin_annie', 'skin_historia', 'skin_reiner', 'skin_zeke');
  const kinds = new Set(spec.titans.map(t => t.kind));
  for (const wave of spec.waves || []) for (const w of wave) kinds.add(w.kind);
  for (const k of kinds) if (TITAN_MODELS[k]) keys.push(TITAN_MODELS[k]);
  keys.push('house', 'house2', 'house4');
  if (spec.wall) keys.push('gatehouse', 'city1');
  if (spec.colossal) keys.push('titan_colosal');
  if (gs.titanPower) keys.push('titan_grande');    // tu forma de titán
  return keys;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _tmpBox = new THREE.Box3();

/** Bounding box real: geometría (pose de bind) × matriz de mundo.
 *  Box3.setFromObject falla con modelos riggeados cuyo nodo raíz trae
 *  escalas FBX tipo 0.01: medimos malla a malla. */
function measureBox(obj, out) {
  obj.updateWorldMatrix(true, true);
  out.makeEmpty();
  obj.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _tmpBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    out.union(_tmpBox);
  });
  return out;
}

/** Clona un asset escalado a la altura dada y apoyado en el suelo (y=0).
 *  Usa SkeletonUtils.clone (imprescindible para modelos riggeados). */
export function instance(key, targetHeight) {
  const tpl = assets[key];
  if (!tpl) return null;
  let c;
  try { c = skeletonClone(tpl); } catch { c = tpl.clone(true); }
  if (TUNE[key]?.rotY) c.rotation.y = TUNE[key].rotY;
  measureBox(c, _box);
  _box.getSize(_size);
  if (!isFinite(_size.y) || _size.y < 1e-6) return null;    // caja inválida → procedural
  const s = targetHeight / _size.y;
  if (!isFinite(s) || s <= 0) return null;
  c.scale.setScalar(s);
  measureBox(c, _box);
  // verificación de cordura: si tras escalar no mide lo esperado, descartar
  const measured = _box.max.y - _box.min.y;
  if (!isFinite(measured) || measured < targetHeight * 0.3 || measured > targetHeight * 3) return null;
  c.position.y -= _box.min.y;
  // centrar en XZ
  const cx = (_box.min.x + _box.max.x) / 2, cz = (_box.min.z + _box.max.z) / 2;
  c.position.x -= cx;
  c.position.z -= cz;
  const wrapper = new THREE.Group();
  wrapper.add(c);
  return wrapper;
}

export function anyHouse(targetHeight) {
  const keys = ['house', 'house2', 'house4'].filter(k => assets[k]);
  if (!keys.length) return null;
  return instance(keys[Math.floor(Math.random() * keys.length)], targetHeight);
}
