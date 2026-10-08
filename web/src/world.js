// Construcción del escenario 3D: terreno, muralla, vegetación, luces.
import * as THREE from 'three';
import { anyHouse, instance } from './assets.js';

export const ARENA = 260;            // semi-lado del área jugable

const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

let _grassTex = null;
function grassTexture() {
  if (_grassTex) return _grassTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5e7e42';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? '#54743a' : v < 0.85 ? '#6a8a4c' : '#7a9a58';
    const x = Math.random() * 256, y = Math.random() * 256;
    g.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 3.5);
  }
  for (let i = 0; i < 70; i++) {    // parches de tierra
    g.fillStyle = 'rgba(122,100,62,0.16)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 9, 0, 7);
    g.fill();
  }
  _grassTex = new THREE.CanvasTexture(c);
  _grassTex.wrapS = _grassTex.wrapT = THREE.RepeatWrapping;
  _grassTex.repeat.set(56, 56);
  return _grassTex;
}

let _skyTex = null;
function skyTexture() {
  if (_skyTex) return _skyTex;
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4a86c8');
  grad.addColorStop(0.55, '#9fc0d8');
  grad.addColorStop(0.82, '#d8e2dd');
  grad.addColorStop(1, '#e8e2cf');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  _skyTex = new THREE.CanvasTexture(c);
  return _skyTex;
}

let _stoneTex = null;
function stoneTexture() {
  if (_stoneTex) return _stoneTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b0a896';
  g.fillRect(0, 0, 256, 256);
  // bloques de piedra
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const off = row % 2 ? 32 : 0;
      g.fillStyle = `hsl(40, ${8 + Math.random() * 8}%, ${62 + Math.random() * 10}%)`;
      g.fillRect(col * 64 + off + 2, row * 32 + 2, 60, 28);
    }
  }
  _stoneTex = new THREE.CanvasTexture(c);
  _stoneTex.wrapS = _stoneTex.wrapT = THREE.RepeatWrapping;
  return _stoneTex;
}

export function buildWorld(scene, spec) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xd8e2dd, 110, 460);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 240;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  // ---- suelo con textura de pasto generada
  const groundGeo = new THREE.PlaneGeometry(ARENA * 4, ARENA * 4, 64, 64);
  groundGeo.rotateX(-Math.PI / 2);
  // ligeras ondulaciones (no en la zona central jugable)
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.hypot(x, z);
    if (d > ARENA * 1.1) pos.setY(i, Math.sin(x * 0.01) * Math.cos(z * 0.013) * 6);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo,
    new THREE.MeshLambertMaterial({ map: grassTexture(), color: 0xa8c890 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- nubes (planos blancos a gran altura)
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Mesh(
      new THREE.PlaneGeometry(60 + Math.random() * 120, 25 + Math.random() * 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 + Math.random() * 0.25, depthWrite: false }));
    cloud.rotation.x = -Math.PI / 2;
    cloud.position.set((Math.random() - 0.5) * ARENA * 4, 120 + Math.random() * 60, (Math.random() - 0.5) * ARENA * 4);
    scene.add(cloud);
  }

  const solids = [];                  // obstáculos con colisión {x, z, r}
  const supplies = [];                // cajas de suministro recogibles
  const anchors = [];                 // puntos de anclaje del gancho (copas, tejados, muralla)

  // ---- helpers
  const CROWNS = [0x3a6a32, 0x4a7a3a, 0x55833f, 0x5f8a46];
  function tree(x, z, big = false) {
    const g = new THREE.Group();
    const h = big ? 26 + Math.random() * 14 : 8 + Math.random() * 5;
    const trunkR = big ? 1.6 : 0.45;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.8, trunkR, h, 7), mat(0x6a4a32));
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(big ? 9 + Math.random() * 4 : 3.2 + Math.random() * 1.8, 0),
      mat(CROWNS[Math.floor(Math.random() * CROWNS.length)]));
    crown.position.y = h + (big ? 4 : 1.4);
    crown.castShadow = true;
    g.add(crown);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);
    solids.push({ x, z, r: trunkR + 0.6 });
    anchors.push(new THREE.Vector3(x, h + (big ? 3 : 1.5), z));  // TODA copa es enganchable
  }

  function house(x, z) {
    // modelo personalizado de web/assets/ si existe
    const custom = anyHouse(7 + Math.random() * 4);
    if (custom) {
      custom.position.set(x, 0, z);
      custom.rotation.y = Math.random() * Math.PI * 2;
      scene.add(custom);
      solids.push({ x, z, r: 6.5 });
      anchors.push(new THREE.Vector3(x, 10, z));
      return;
    }
    const g = new THREE.Group();
    const w = 8 + Math.random() * 5, d = 7 + Math.random() * 4, h = 5 + Math.random() * 2;
    const WALLS = [0xd8c8a8, 0xc8b89a, 0xcab48e, 0xbfae96];
    const ROOFS = [0x8a4a3a, 0x7a3e34, 0x9a5a40, 0x6a4a3a];
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      mat(WALLS[Math.floor(Math.random() * WALLS.length)]));
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // vigas de madera estilo medieval
    for (const sx of [-w / 2 + 0.4, w / 2 - 0.4]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), mat(0x5a4030));
      beam.position.set(sx, h / 2, d / 2 + 0.05);
      g.add(beam);
    }
    // puerta y ventanas
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), mat(0x4a3424));
    door.position.set(0, 1.3, d / 2 + 0.1);
    g.add(door);
    for (const sx of [-w * 0.28, w * 0.28]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.15), mat(0x2a3038));
      win.position.set(sx, h * 0.62, d / 2 + 0.1);
      g.add(win);
    }
    const roofH = 3.2;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, Math.max(w, d) * 0.72, roofH, 4),
      mat(ROOFS[Math.floor(Math.random() * ROOFS.length)]));
    roof.position.y = h + roofH / 2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);
    solids.push({ x, z, r: Math.max(w, d) * 0.62 });
    anchors.push(new THREE.Vector3(x, h + roofH + 1, z));       // tejado enganchable
  }

  function supplyBox(x, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xe8c84a, emissive: 0x7a5a10 }));
    m.position.set(x, 0.8, z);
    m.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe88a }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.25, z);
    scene.add(m, ring);
    supplies.push({ x, z, mesh: m, ring, taken: false });
  }

  // ---- muralla (modos defensa / final)
  let gate = null;
  if (spec.wall) {
    const wallZ = spec.wall.z;
    const wallH = 50, wallT = 14;
    const stone = stoneTexture();
    stone.repeat.set(30, 5);
    const wallMat = new THREE.MeshLambertMaterial({ map: stone, color: 0xc8c0b0 });
    for (const side of [-1, 1]) {
      const len = ARENA * 2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, wallT), wallMat);
      seg.position.set(side * (len / 2 + spec.wall.gateWidth / 2), wallH / 2, wallZ);
      seg.castShadow = true; seg.receiveShadow = true;
      scene.add(seg);
    }
    // COLISIÓN de la muralla: nadie la atraviesa (la puerta cerrada tampoco)
    for (let cx = -ARENA; cx <= ARENA; cx += 10) {
      if (Math.abs(cx) < spec.wall.gateWidth / 2 + 4) continue;
      solids.push({ x: cx, z: wallZ, r: 8.5 });
    }
    solids.push({ x: 0, z: wallZ, r: spec.wall.gateWidth / 2 + 2 });
    // puerta
    const gateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(spec.wall.gateWidth, 22, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a3a2a }));
    gateMesh.position.set(0, 11, wallZ);
    gateMesh.castShadow = true;
    scene.add(gateMesh);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(spec.wall.gateWidth + 8, wallH - 22, wallT), wallMat);
    arch.position.set(0, 22 + (wallH - 22) / 2, wallZ);
    arch.castShadow = true;
    scene.add(arch);
    gate = { x: 0, z: wallZ, mesh: gateMesh, width: spec.wall.gateWidth };
    solids.push({ x: -ARENA - spec.wall.gateWidth / 2, z: wallZ, r: 0 }); // marcadores
    for (let ax = -ARENA; ax <= ARENA; ax += 40)
      anchors.push(new THREE.Vector3(ax, wallH + 1, wallZ));    // lo alto de la muralla

    // torhaus (caseta de la puerta) si el modelo está cargado
    const gh = instance('gatehouse', wallH * 1.15);
    if (gh) {
      gh.position.set(0, 0, wallZ);
      scene.add(gh);
    }
    // panorama del distrito tras la muralla
    const city = instance('city1', 42);
    if (city) {
      city.position.set(0, 0, wallZ + 95 * Math.sign(wallZ || 1));
      scene.add(city);
    }
    // el COLOSAL asoma sobre la muralla (solo escenografía de la misión final)
    if (spec.colossal) {
      const col = instance('titan_colosal', 65);
      if (col) {
        col.position.set(55, 0, wallZ + 30);
        col.rotation.y = Math.PI;
        scene.add(col);
      }
    }
  }

  // ---- decoración según bioma
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clearOk = (x, z) => {
    if (Math.hypot(x - (spec.playerSpawn?.x || 0), z - (spec.playerSpawn?.z || 0)) < 18) return false;
    if (gate && Math.abs(z - gate.z) < 22) return false;
    if (spec.cart && Math.abs(z - spec.cart.z) < 14) return false;
    return true;
  };
  const nTrees = spec.biome === 'forest' ? 70 : 26;
  const nBig = spec.biome === 'forest' ? 34 : 4;
  const nHouses = spec.biome === 'town' ? 22 : (spec.wall ? 8 : 3);
  for (let i = 0; i < nTrees; i++) {
    const x = rnd(-ARENA, ARENA), z = rnd(-ARENA, ARENA);
    if (clearOk(x, z)) tree(x, z, false);
  }
  for (let i = 0; i < nBig; i++) {
    const x = rnd(-ARENA, ARENA), z = rnd(-ARENA, ARENA);
    if (clearOk(x, z)) tree(x, z, true);
  }
  for (let i = 0; i < nHouses; i++) {
    const x = rnd(-ARENA * 0.9, ARENA * 0.9);
    const z = spec.wall ? rnd(spec.wall.z + 26, ARENA) * (spec.wall.z < 0 ? 1 : -1) : rnd(-ARENA * 0.9, ARENA * 0.9);
    if (clearOk(x, z)) house(x, z);
  }
  for (let i = 0; i < (spec.supplies ?? 4); i++) {
    const x = rnd(-ARENA * 0.85, ARENA * 0.85), z = rnd(-ARENA * 0.85, ARENA * 0.85);
    if (clearOk(x, z)) supplyBox(x, z);
  }

  // ---- carreta (escolta)
  let cart = null;
  if (spec.cart) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 3), mat(0x9a6a3a));
    body.position.y = 1.8;
    body.castShadow = true;
    g.add(body);
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 5.2, 10, 1, false, 0, Math.PI),
      mat(0xe8e0c8));
    cover.rotation.z = Math.PI / 2;
    cover.position.y = 3.1;
    g.add(cover);
    for (const [dx, dz] of [[-1.8, 1.4], [1.8, 1.4], [-1.8, -1.4], [1.8, -1.4]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 10), mat(0x4a3222));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(dx, 0.9, dz);
      g.add(wheel);
    }
    g.position.set(spec.cart.x, 0, spec.cart.z);
    scene.add(g);
    cart = { mesh: g, x: spec.cart.x, z: spec.cart.z, hp: spec.cart.hp, maxHp: spec.cart.hp, speed: 3.2 };
  }

  return { solids, supplies, gate, cart, anchors };
}

// colisión simple círculo-obstáculos sobre el plano XZ
export function collideSolids(pos, radius, solids) {
  for (const s of solids) {
    if (!s.r) continue;
    const dx = pos.x - s.x, dz = pos.z - s.z;
    const d = Math.hypot(dx, dz);
    const min = radius + s.r;
    if (d < min && d > 0.001) {
      pos.x = s.x + (dx / d) * min;
      pos.z = s.z + (dz / d) * min;
    }
  }
}

export function clampArena(pos, wallZ = null) {
  pos.x = Math.max(-ARENA, Math.min(ARENA, pos.x));
  pos.z = Math.max(-ARENA, Math.min(ARENA, pos.z));
}
