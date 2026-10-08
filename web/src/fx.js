// Efectos de partículas: vapor de titán, sangre, chispas del gancho.
import * as THREE from 'three';

const bursts = [];

export function burst(scene, pos, { count = 40, color = 0xffffff, size = 0.8,
                                    speed = 8, up = 6, life = 1.2, gravity = -4 } = {}) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * speed;
    velocities.push(new THREE.Vector3(Math.cos(a) * r, Math.random() * up + 1, Math.sin(a) * r));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, m);
  scene.add(points);
  bursts.push({ points, velocities, life, age: 0, gravity });
}

export function steam(scene, pos, big = false) {
  burst(scene, pos, { count: big ? 90 : 45, color: 0xf0f0f0, size: big ? 2.4 : 1.4,
                      speed: big ? 7 : 4, up: big ? 10 : 6, life: big ? 2.2 : 1.4, gravity: 2.5 });
}

export function blood(scene, pos) {
  burst(scene, pos, { count: 30, color: 0xa01818, size: 0.7, speed: 9, up: 5, life: 0.8, gravity: -14 });
}

export function sparks(scene, pos) {
  burst(scene, pos, { count: 14, color: 0xffe88a, size: 0.4, speed: 6, up: 3, life: 0.45, gravity: -8 });
}

export function updateFx(scene, dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    if (b.age >= b.life) {
      scene.remove(b.points);
      b.points.geometry.dispose();
      b.points.material.dispose();
      bursts.splice(i, 1);
      continue;
    }
    const pos = b.points.geometry.attributes.position;
    for (let j = 0; j < b.velocities.length; j++) {
      const v = b.velocities[j];
      v.y += b.gravity * dt;
      pos.setXYZ(j, pos.getX(j) + v.x * dt, Math.max(0.05, pos.getY(j) + v.y * dt), pos.getZ(j) + v.z * dt);
    }
    pos.needsUpdate = true;
    b.points.material.opacity = 0.95 * (1 - b.age / b.life);
  }
}

export function clearFx(scene) {
  for (const b of bursts) {
    scene.remove(b.points);
    b.points.geometry.dispose();
    b.points.material.dispose();
  }
  bursts.length = 0;
}
