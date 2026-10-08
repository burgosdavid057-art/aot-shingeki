// Escena ambiental para los menús: atardecer, muralla y titanes vagando.
import * as THREE from 'three';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });

function silhouetteTitan(h) {
  const g = new THREE.Group();
  const skin = 0x4a3a36;
  const legH = h * 0.48, torsoH = h * 0.34, headR = h * 0.085;
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(h * 0.085, legH, h * 0.085), lambert(skin));
    leg.geometry.translate(0, -legH / 2, 0);
    leg.position.set(side * h * 0.085, legH, 0);
    g.add(leg);
    legs.push(leg);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(h * 0.3, torsoH, h * 0.16), lambert(skin));
  torso.position.y = legH + torsoH / 2;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(headR * 2, headR * 2.2, headR * 2), lambert(skin));
  head.position.y = legH + torsoH + headR;
  g.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(h * 0.06, h * 0.36, h * 0.06), lambert(skin));
    arm.geometry.translate(0, -h * 0.18, 0);
    arm.position.set(side * h * 0.18, legH + torsoH * 0.9, 0);
    g.add(arm);
  }
  g.userData.legs = legs;
  return g;
}

export function createMenuBg() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1e2e);
  scene.fog = new THREE.Fog(0x2a1e2e, 60, 320);

  scene.add(new THREE.HemisphereLight(0x8a6a8a, 0x2a2218, 0.5));
  const sun = new THREE.DirectionalLight(0xff8a4a, 1.1);     // atardecer
  sun.position.set(-80, 25, -120);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), lambert(0x33402a));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // muralla al fondo
  const wall = new THREE.Mesh(new THREE.BoxGeometry(700, 50, 16), lambert(0x6a6258));
  wall.position.set(0, 25, -170);
  scene.add(wall);

  // sol poniente
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xff9a52, fog: false }));
  sunDisc.position.set(-140, 38, -300);
  scene.add(sunDisc);

  // titanes vagando
  const titans = [];
  for (let i = 0; i < 7; i++) {
    const h = 8 + Math.random() * 9;
    const t = silhouetteTitan(h);
    t.position.set(-160 + Math.random() * 320, 0, -140 + Math.random() * 180);
    t.userData.yaw = Math.random() * Math.PI * 2;
    t.userData.speed = 1.2 + Math.random() * 1.6;
    t.userData.phase = Math.random() * 10;
    scene.add(t);
    titans.push(t);
  }

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 800);
  let angle = 0;

  function update(dt) {
    angle += dt * 0.035;
    camera.position.set(Math.sin(angle) * 70, 16 + Math.sin(angle * 0.7) * 5, 60 + Math.cos(angle) * 30);
    camera.lookAt(0, 14, -60);
    for (const t of titans) {
      const u = t.userData;
      u.phase += dt * u.speed * 1.4;
      u.yaw += (Math.random() - 0.5) * dt * 0.4;
      t.rotation.y = u.yaw;
      t.position.x += Math.sin(u.yaw) * u.speed * dt;
      t.position.z += Math.cos(u.yaw) * u.speed * dt;
      if (Math.abs(t.position.x) > 200) u.yaw += Math.PI;
      if (t.position.z > 90 || t.position.z < -160) u.yaw += Math.PI;
      const sw = Math.sin(u.phase) * 0.4;
      u.legs[0].rotation.x = sw;
      u.legs[1].rotation.x = -sw;
      t.position.y = Math.abs(Math.sin(u.phase)) * 0.15;
    }
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, update, resize };
}
