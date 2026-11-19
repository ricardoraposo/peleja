import * as THREE from 'three';
import { ELEMENTS } from './fxstyle.js';

const MAX_PARTICLES = 900;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

const SPHERE = new THREE.SphereGeometry(1, 12, 8);
const RING = new THREE.RingGeometry(0.9, 1, 56);
const THIN = new THREE.RingGeometry(0.982, 1, 96);
const ARC = new THREE.RingGeometry(0.72, 1, 20, 1, -1.0, 2.0);
const TARGET = new THREE.RingGeometry(0.86, 1, 40);
const DISC = new THREE.CircleGeometry(1, 48);
const PLANE = new THREE.PlaneGeometry(1, 1);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0); // base no chão, ponta pra cima
const CONE_X = new THREE.ConeGeometry(1, 1, 7).rotateZ(-Math.PI / 2); // ponta pra +x
const WALL = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true, -0.9, 1.8).rotateY(Math.PI / 2).translate(0, 0.5, 0); // parede curva, bojo pra +x
const UP = new THREE.Vector3(0, 1, 0);
const hot = (el) => el === 'fire' || el === 'ember';

// materiais compartilhados pelos projéteis (nunca são descartados nem animados)
const MATS = new Map();
function shared(color, opacity = 1, additive = false) {
  const key = color + '|' + opacity + '|' + additive;
  let m = MATS.get(key);
  if (!m) {
    m = basic(color, opacity, additive);
    MATS.set(key, m);
  }
  return m;
}

function flat(mesh, y = 0.06) {
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function basic(color, opacity, additive = false) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_PARTICLES);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inst.frustumCulled = false;
    this.inst.setColorAt(0, new THREE.Color('#ffffff'));
    this.inst.count = 0;
    scene.add(this.inst);
    this.projs = new Map();
    this.temps = [];
    this.zones = new Map();
    this.trails = [];
    this.buildIndicators();
  }

  spawn(x, y, z, vx, vy, vz, color, life, size, gravity = 10) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ x, y, z, vx, vy, vz, color: new THREE.Color(color), life, max: life, size, gravity });
  }

  burst(x, y, z, color, n = 12, speed = 5, size = 0.14, life = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * sp, Math.random() * speed * 0.8, Math.sin(a) * sp, i % 3 === 0 ? '#ffffff' : color, life * (0.6 + Math.random() * 0.6), size);
    }
  }

  temp(mesh, life, update) {
    this.scene.add(mesh);
    this.temps.push({ mesh, life, max: life, update });
  }

  // ---------- projéteis (a simulação manda, aqui só desenha) ----------
  // Cada forma é um grupo apontando pra +x; o grupo gira pra seguir a direção do voo.
  // Geometrias e materiais são compartilhados: criar ou destruir um projétil não aloca nada pesado.

  buildProj(shape, color, sc, width) {
    const g = new THREE.Group();
    const add = (geo, mat, sx, sy, sz, x = 0, y = 0, z = 0, parent = g) => {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    switch (shape) {
      case 'arrow':
      case 'arrowBig': {
        const k = shape === 'arrowBig' ? 1.9 : sc;
        add(BOX, shared('#d6c08a'), 1.3 * k, 0.05 * k, 0.05 * k);
        add(CONE_X, shared('#f1f5f9'), 0.34 * k, 0.1 * k, 0.1 * k, 0.8 * k);
        add(BOX, shared(color), 0.32 * k, 0.24 * k, 0.025 * k, -0.6 * k);
        add(BOX, shared(color), 0.32 * k, 0.025 * k, 0.24 * k, -0.6 * k);
        add(BOX, shared(color, 0.45, true), 1.5 * k, 0.035 * k, 0.035 * k, -1.3 * k);
        if (shape === 'arrowBig') add(SPHERE, shared(color, 0.3), 1.3, 0.22, 0.22, 0.2);
        break;
      }
      case 'net': {
        const spin = new THREE.Group();
        spin.rotation.y = Math.PI / 2;
        add(RING, shared(color, 0.95), 0.75, 0.75, 1, 0, 0, 0, spin);
        for (let i = 0; i < 3; i++) add(BOX, shared('#f1f5f9', 0.9), 1.4, 0.035, 0.035, 0, 0, 0, spin).rotation.z = (i * Math.PI) / 3;
        g.add(spin);
        g.userData.spin = spin;
        g.userData.spinAxis = 'z';
        break;
      }
      case 'tracer':
        add(BOX, shared(color, 0.55), 1.7 * sc, 0.09 * sc, 0.09 * sc, -0.7 * sc);
        add(BOX, shared('#ffb35c'), 0.9 * sc, 0.1 * sc, 0.1 * sc);
        add(SPHERE, shared('#fff1b8'), 0.12 * sc, 0.12 * sc, 0.12 * sc, 0.5 * sc);
        break;
      case 'comet':
        add(SPHERE, shared('#ffe08a'), 0.4, 0.4, 0.4);
        g.userData.pulse = add(SPHERE, shared(color, 0.55), 0.7, 0.7, 0.7);
        add(CONE_X, shared('#ff8a3d', 0.45), -2.6, 0.55, 0.55, -1.5);
        break;
      case 'torch': {
        const spin = new THREE.Group();
        add(BOX, shared('#7c5a3a'), 1.0, 0.1, 0.1, 0, 0, 0, spin);
        add(SPHERE, shared('#ffe08a'), 0.2, 0.2, 0.2, 0.55, 0, 0, spin);
        add(SPHERE, shared('#ff7a1a', 0.75, true), 0.36, 0.36, 0.36, 0.55, 0, 0, spin);
        add(SPHERE, shared(color, 0.35, true), 0.55, 0.55, 0.55, 0.55, 0, 0, spin);
        g.add(spin);
        g.userData.spin = spin;
        g.userData.spinAxis = 'z';
        add(CONE_X, shared('#ff3d00', 0.4, true), -1.6, 0.5, 0.5, -0.8);
        break;
      }
      case 'ember':
        add(SPHERE, shared('#ffe08a'), 0.14, 0.14, 0.14);
        g.userData.pulse = add(SPHERE, shared('#ff3d00', 0.75, true), 0.26, 0.26, 0.26);
        add(CONE_X, shared('#ff7a1a', 0.55, true), -0.9, 0.22, 0.22, -0.5);
        break;
      case 'fireball':
        add(SPHERE, shared('#ffd166'), 0.24 * sc, 0.24 * sc, 0.24 * sc);
        g.userData.pulse = add(SPHERE, shared('#ff7a1a', 0.7), 0.4 * sc, 0.4 * sc, 0.4 * sc);
        add(SPHERE, shared(color, 0.35), 0.54 * sc, 0.54 * sc, 0.54 * sc);
        add(CONE_X, shared('#ff5a1a', 0.5), -1.4 * sc, 0.36 * sc, 0.36 * sc, -0.85 * sc);
        break;
      case 'orb':
        add(SPHERE, shared(color, 0.82), 0.3 * sc, 0.3 * sc, 0.3 * sc);
        add(SPHERE, shared('#ffffff', 0.9), 0.09 * sc, 0.09 * sc, 0.09 * sc, 0.1 * sc, 0.14 * sc, 0.08 * sc);
        g.userData.pulse = add(SPHERE, shared('#bae6fd', 0.3, true), 0.46 * sc, 0.46 * sc, 0.46 * sc);
        break;
      case 'wave': {
        // parede de água curva, da largura real da habilidade
        const half = Math.max(0.6, width * 0.5);
        const sz = half / 0.78;
        const sx = Math.min(1.6, half * 0.55);
        const h = Math.min(2.4, 1.0 + half * 0.35);
        add(WALL, shared(color, 0.7), sx, h, sz, -sx, -1.1);
        add(WALL, shared('#e0f2fe', 0.9), sx * 1.03, h * 0.16, sz * 1.03, -sx, -1.1 + h * 0.86);
        add(WALL, shared('#1d4ed8', 0.35), sx * 0.8, h * 0.6, sz * 0.9, -sx * 1.15, -1.1);
        g.userData.half = half;
        break;
      }
      case 'thorns': {
        const spin = new THREE.Group();
        add(CONE_X, shared('#d9f99d'), 0.9, 0.13, 0.13, 0.2, 0, 0, spin);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          add(CONE_X, shared(i ? color : '#4d7c0f'), 0.7, 0.11, 0.11, -0.1, Math.cos(a) * 0.26, Math.sin(a) * 0.26, spin);
        }
        g.add(spin);
        g.userData.spin = spin;
        g.userData.spinAxis = 'x';
        break;
      }
      case 'coco': {
        // coquinho girando com um brilho de vaga-lume em volta
        const k = Math.max(0.6, sc);
        const spin = new THREE.Group();
        add(SPHERE, shared('#8b5a2b'), 0.3 * k, 0.3 * k, 0.34 * k, 0, 0, 0, spin);
        add(SPHERE, shared('#3b2412'), 0.06 * k, 0.06 * k, 0.06 * k, 0.2 * k, 0.08 * k, 0.1 * k, spin);
        add(SPHERE, shared('#3b2412'), 0.06 * k, 0.06 * k, 0.06 * k, 0.2 * k, 0.08 * k, -0.1 * k, spin);
        g.add(spin);
        g.userData.spin = spin;
        g.userData.spinAxis = 'z';
        const halo = new THREE.Group();
        add(RING, shared(color, 0.9), 0.5 * k, 0.5 * k, 1, 0, 0, 0, halo);
        halo.rotation.x = Math.PI / 2;
        g.add(halo);
        break;
      }
      case 'smoke': {
        // baforada de fumaça: bolotas claras que pulsam
        const k = Math.max(1, width);
        add(SPHERE, shared('#ede9fe', 0.75), 0.34 * k, 0.3 * k, 0.34 * k);
        add(SPHERE, shared('#ddd6fe', 0.6), 0.26 * k, 0.24 * k, 0.26 * k, -0.3 * k, 0.1 * k, 0.12 * k);
        add(SPHERE, shared('#ddd6fe', 0.6), 0.22 * k, 0.2 * k, 0.22 * k, -0.25 * k, -0.08 * k, -0.18 * k);
        g.userData.pulse = add(SPHERE, shared(color, 0.3, true), 0.5 * k, 0.5 * k, 0.5 * k);
        break;
      }
      case 'pearl': {
        // pérola grande com brilho e um anel d'água em volta
        const k = Math.max(0.9, width * 0.8);
        add(SPHERE, shared('#fff1f5'), 0.3 * k, 0.3 * k, 0.3 * k);
        add(SPHERE, shared('#ffffff', 0.95), 0.09 * k, 0.09 * k, 0.09 * k, 0.1 * k, 0.16 * k, 0.1 * k);
        g.userData.pulse = add(SPHERE, shared(color, 0.4, true), 0.5 * k, 0.5 * k, 0.5 * k);
        const spin = new THREE.Group();
        add(RING, shared('#7dd3fc', 0.8), 0.62 * k, 0.62 * k, 1, 0, 0, 0, spin);
        spin.rotation.x = Math.PI / 2;
        g.add(spin);
        g.userData.spin = spin;
        g.userData.spinAxis = 'z';
        break;
      }
      case 'fish':
        // peixinho: corpo, rabo e um risco d'água atrás
        add(SPHERE, shared(color), 0.34, 0.15, 0.13);
        add(CONE_X, shared(color), 0.22, 0.17, 0.05, -0.38);
        add(SPHERE, shared('#ffffff'), 0.04, 0.04, 0.04, 0.2, 0.05, 0.08);
        add(BOX, shared('#bae6fd', 0.45, true), 0.8, 0.04, 0.04, -0.85);
        break;
      case 'kiss': {
        // coração: duas bolas e uma ponta, sempre de frente pra câmera de cima
        const k = Math.max(1, width);
        const heart = new THREE.Group();
        add(SPHERE, shared(color), 0.2 * k, 0.2 * k, 0.12 * k, 0, 0.1 * k, -0.15 * k, heart);
        add(SPHERE, shared(color), 0.2 * k, 0.2 * k, 0.12 * k, 0, 0.1 * k, 0.15 * k, heart);
        const tip = add(BOX, shared(color), 0.12 * k, 0.26 * k, 0.26 * k, 0, -0.08 * k, 0, heart);
        tip.rotation.x = Math.PI / 4;
        heart.rotation.z = -0.9;
        g.add(heart);
        g.userData.pulse = add(SPHERE, shared('#ffc2d1', 0.3, true), 0.5 * k, 0.5 * k, 0.5 * k);
        break;
      }
      default: {
        // esfera de energia: tropas, torres e habilidades sem forma própria
        add(SPHERE, shared(color, 0.95, true), sc, sc, sc);
        add(SPHERE, shared('#ffffff', 0.9), sc * 0.5, sc * 0.5, sc * 0.5);
      }
    }
    return g;
  }

  addProj(m, shape = 'bolt', el = 'neutral') {
    const size = m.k === 's' ? Math.max(0.35, (m.wd || m.w) * 0.42) : m.k === 't' ? 0.5 : m.w;
    const sc = shape === 'bolt' || shape === 'orbEl' ? size : m.k === 's' ? 1.25 : 1;
    const mesh = this.buildProj(shape, m.c, sc, m.wd || 1);
    const y = m.k === 't' ? 5.2 : m.k === 's' ? 1.2 : 1.3;
    mesh.position.set(m.x, y, m.z);
    if (m.dx || m.dz) mesh.rotation.y = -Math.atan2(m.dz, m.dx);
    this.scene.add(mesh);
    this.projs.set(m.id, { ...m, mesh, y, traveled: 0, size, shape, el, tt: 0, age: 0 });
  }

  endProj(m) {
    const p = this.projs.get(m.id);
    if (!p) return;
    this.projs.delete(m.id);
    this.scene.remove(p.mesh);
    const pos = p.mesh.position;
    const x = m.x ?? pos.x;
    const z = m.z ?? pos.z;
    const dir = -p.mesh.rotation.y;
    switch (p.shape) {
      case 'arrow':
      case 'arrowBig':
        this.puff(x, pos.y, z, 'arrow', p.shape === 'arrowBig' ? 16 : 6, 4, 0.09, 0.3, dir + Math.PI);
        break;
      case 'net':
        this.ripple(x, z, 1.4, p.c, 0.35);
        this.puff(x, 0.8, z, 'arrow', 10, 3, 0.1, 0.4);
        break;
      case 'tracer':
        this.puff(x, pos.y, z, 'spark', 8, 7, 0.08, 0.25, dir + Math.PI);
        break;
      case 'comet':
        this.puff(x, pos.y, z, 'spark', 22, 8, 0.14, 0.5);
        break;
      case 'fireball':
        this.puff(x, pos.y, z, 'fire', 10, 3, 0.16, 0.45);
        break;
      case 'torch':
        this.puff(x, pos.y, z, 'ember', 18, 5, 0.18, 0.55);
        break;
      case 'ember':
        this.puff(x, pos.y, z, 'ember', 7, 3, 0.12, 0.4);
        break;
      case 'orb':
        this.puff(x, pos.y, z, 'water', 8, 3.5, 0.1, 0.4);
        this.ripple(x, z, 0.9, p.c, 0.3);
        break;
      case 'wave':
        for (let i = 0; i < 14; i++) {
          const o = (Math.random() - 0.5) * 2 * (p.mesh.userData.half || 1);
          this.spawn(x - Math.sin(dir) * o, 0.3, z + Math.cos(dir) * o, 0, 3 + Math.random() * 4, 0, i % 2 ? '#e0f2fe' : p.c, 0.5, 0.14, 12);
        }
        break;
      case 'thorns':
        this.puff(x, pos.y, z, 'thorn', 12, 5, 0.11, 0.4);
        break;
      case 'pearl':
        this.puff(x, pos.y, z, 'rose', 8, 3, 0.12, 0.35);
        break;
      case 'coco':
        this.burst(x, pos.y, z, '#6b4423', 6, 4, 0.12, 0.35);
        this.puff(x, pos.y, z, 'firefly', 8, 4, 0.1, 0.4);
        break;
      case 'smoke':
        this.burst(x, pos.y, z, '#ede9fe', 14, 2.5, 0.22, 0.7);
        break;
      case 'fish':
        this.puff(x, pos.y, z, 'water', 7, 4, 0.1, 0.35);
        this.ripple(x, z, 0.8, p.c, 0.3);
        break;
      case 'kiss':
        this.puff(x, pos.y, z, 'rose', 16, 4, 0.15, 0.6);
        this.ripple(x, z, 1.3, p.c, 0.4);
        break;
      default:
        if (p.k === 's') this.puff(x, 1.1, z, p.el, 14, 6, 0.16, 0.45);
        else this.burst(pos.x, pos.y, pos.z, p.c, 5, 3, 0.1, 0.25);
    }
  }

  // rastro de cada forma: poucas partículas, num ritmo fixo
  projTrail(p) {
    const pos = p.mesh.position;
    const r = () => Math.random() - 0.5;
    switch (p.shape) {
      case 'arrow':
        this.spawn(pos.x, pos.y, pos.z, 0, 0, 0, '#ffffff', 0.16, 0.05, 0);
        break;
      case 'arrowBig':
        this.spawn(pos.x + r() * 0.2, pos.y + r() * 0.2, pos.z + r() * 0.2, 0, 0.4, 0, Math.random() < 0.5 ? p.c : '#ffffff', 0.4, 0.11, 0);
        break;
      case 'tracer':
        if (Math.random() < 0.5) this.spawn(pos.x, pos.y, pos.z, r() * 2, 1 + Math.random() * 2, r() * 2, '#ffe08a', 0.2, 0.06, 12);
        break;
      case 'comet':
      case 'fireball': {
        const cols = ELEMENTS[p.shape === 'comet' ? 'spark' : 'fire'].cols;
        for (let i = 0; i < 2; i++) this.spawn(pos.x + r() * 0.3, pos.y + r() * 0.3, pos.z + r() * 0.3, r(), 1 + Math.random() * 1.5, r(), cols[(Math.random() * cols.length) | 0], 0.3 + Math.random() * 0.25, p.shape === 'comet' ? 0.2 : 0.15, -3);
        break;
      }
      case 'torch':
      case 'ember': {
        const cols = ELEMENTS.ember.cols;
        const n = p.shape === 'torch' ? 3 : 1;
        for (let i = 0; i < n; i++) this.spawn(pos.x + r() * 0.3, pos.y + r() * 0.3, pos.z + r() * 0.3, r(), 1 + Math.random() * 2, r(), cols[(Math.random() * cols.length) | 0], 0.35 + Math.random() * 0.3, p.shape === 'torch' ? 0.18 : 0.11, -4);
        break;
      }
      case 'orb':
        if (Math.random() < 0.6) this.spawn(pos.x + r() * 0.2, pos.y - 0.1, pos.z + r() * 0.2, 0, 0, 0, '#bae6fd', 0.3, 0.08, 8);
        break;
      case 'pearl':
        this.spawn(pos.x + r() * 0.3, pos.y + r() * 0.3, pos.z + r() * 0.3, 0, 0.3, 0, Math.random() < 0.5 ? '#ffc2d1' : '#bae6fd', 0.35, 0.1, 4);
        break;
      case 'coco':
        if (Math.random() < 0.7) this.spawn(pos.x + r() * 0.3, pos.y + r() * 0.3, pos.z + r() * 0.3, 0, 0.5, 0, Math.random() < 0.5 ? '#e879f9' : '#d9f99d', 0.35, 0.07, -1);
        break;
      case 'smoke':
        this.spawn(pos.x + r() * 0.4, pos.y + r() * 0.3, pos.z + r() * 0.4, 0, 0.6, 0, '#ede9fe', 0.5, 0.16, -1);
        break;
      case 'fish':
        if (Math.random() < 0.6) this.spawn(pos.x, pos.y - 0.05, pos.z, 0, 0, 0, '#bae6fd', 0.25, 0.07, 8);
        break;
      case 'kiss':
        this.spawn(pos.x + r() * 0.3, pos.y + r() * 0.3, pos.z + r() * 0.3, 0, 0.8, 0, Math.random() < 0.6 ? '#ff5d8f' : '#ffffff', 0.4, 0.09, -2);
        break;
      case 'wave': {
        const dir = -p.mesh.rotation.y;
        const half = p.mesh.userData.half || 1;
        for (let i = 0; i < (half > 1.5 ? 3 : 1); i++) {
          const o = r() * 2 * half;
          this.spawn(pos.x - Math.sin(dir) * o, 0.2 + Math.random() * 1.2, pos.z + Math.cos(dir) * o, 0, 2 + Math.random() * 2, 0, Math.random() < 0.5 ? '#e0f2fe' : p.c, 0.35, 0.12, 10);
        }
        break;
      }
      case 'thorns':
        if (Math.random() < 0.6) this.spawn(pos.x, pos.y, pos.z, r() * 2, 1, r() * 2, '#a3e635', 0.3, 0.07, 9);
        break;
      case 'orbEl': {
        const E = ELEMENTS[p.el] || ELEMENTS.neutral;
        this.spawn(pos.x + r() * p.size, pos.y + r() * 0.3, pos.z + r() * p.size, 0, 0.5, 0, E.cols[(Math.random() * E.cols.length) | 0], 0.35, p.size * 0.45, -1);
        break;
      }
      default:
        break;
    }
  }

  updateProjs(dt, posOf) {
    for (const p of this.projs.values()) {
      const pos = p.mesh.position;
      const ud = p.mesh.userData;
      p.age += dt;
      if (p.h) {
        const t = posOf(p.h);
        if (!t) continue;
        const ty = 1.1;
        const dx = t.x - pos.x;
        const dz = t.z - pos.z;
        const dy = ty - pos.y;
        const d = Math.hypot(dx, dy, dz);
        const step = p.s * dt;
        if (d > 0.05) p.mesh.rotation.y = -Math.atan2(dz, dx);
        if (d > step) {
          pos.x += (dx / d) * step;
          pos.y += (dy / d) * step;
          pos.z += (dz / d) * step;
        } else pos.set(t.x, ty, t.z);
      } else {
        const step = Math.min(p.s * dt, Math.max(0, p.r - p.traveled));
        pos.x += p.dx * step;
        pos.z += p.dz * step;
        p.traveled += step;
      }
      if (ud.spin) ud.spin.rotation[ud.spinAxis] += dt * 14;
      if (ud.pulse) ud.pulse.scale.multiplyScalar(1 + Math.sin(p.age * 30) * 0.04);
      p.tt -= dt;
      if (p.tt <= 0) {
        p.tt = 0.03;
        this.projTrail(p);
      }
    }
  }

  // ---------- peças comuns dos efeitos ----------

  // nuvem de partículas com a paleta e o peso do elemento; dir (radianos) concentra num sentido
  puff(x, y, z, el, n = 10, speed = 4, size = 0.13, life = 0.5, dir = null) {
    const E = ELEMENTS[el] || ELEMENTS.neutral;
    for (let i = 0; i < n; i++) {
      const a = dir === null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * 1.5;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * sp, E.up * (0.4 + Math.random()), Math.sin(a) * sp, E.cols[i % E.cols.length], life * (0.6 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), E.g);
    }
  }

  // anel no chão que abre e some
  ripple(x, z, r, color, life = 0.4, additive = true) {
    const ring = flat(new THREE.Mesh(RING, basic(color, 0.9, additive)), 0.09);
    ring.position.set(x, 0.09, z);
    this.temp(ring, life, (k) => {
      ring.scale.setScalar(r * (0.25 + (1 - k) * 0.75));
      ring.material.opacity = k * 0.9;
    });
  }

  // raio em zigue-zague caindo no ponto
  lightning(x, z, color = '#e9d5ff', top = 5.5) {
    const g = new THREE.Group();
    const mat = basic('#ffffff', 1);
    const glow = basic(color, 0.55);
    let px = x + (Math.random() - 0.5) * 1.5;
    let pz = z + (Math.random() - 0.5) * 1.5;
    let py = top;
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const last = i === n;
      const nx = last ? x : x + (Math.random() - 0.5) * 1.4;
      const nz = last ? z : z + (Math.random() - 0.5) * 1.4;
      const ny = top * (1 - i / n);
      _p.set(nx - px, ny - py, nz - pz);
      const len = _p.length();
      for (const [m, w] of [[glow, 0.16], [mat, 0.05]]) {
        const seg = new THREE.Mesh(BOX, m);
        seg.scale.set(w, len, w);
        seg.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
        seg.quaternion.setFromUnitVectors(UP, _p.normalize());
        _p.multiplyScalar(len);
        g.add(seg);
      }
      px = nx;
      py = ny;
      pz = nz;
    }
    this.temp(g, 0.22, (k) => {
      mat.opacity = k > 0.5 ? 1 : k * 2;
      glow.opacity = k * 0.55;
      if (k <= 0) {
        mat.dispose();
        glow.dispose();
      }
    });
  }

  // traço fino no chão entre dois pontos (teleporte, corte)
  streak(ax, az, bx, bz, color, width = 0.25, life = 0.25, y = 0.12) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) return;
    const mesh = new THREE.Mesh(PLANE, basic(color, 0.8, true));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.atan2(bz - az, bx - ax);
    mesh.position.set((ax + bx) / 2, y, (az + bz) / 2);
    mesh.scale.set(len, width, 1);
    this.temp(mesh, life, (k) => {
      mesh.material.opacity = k * 0.8;
      mesh.scale.y = width * k;
    });
  }

  // clarão na boca do cano
  muzzle(x, y, z, dx, dz, color) {
    const fx = x + dx * 0.5;
    const fz = z + dz * 0.5;
    const flare = new THREE.Mesh(CONE_X, basic('#ffd166', 0.95));
    flare.rotation.y = -Math.atan2(dz, dx);
    flare.position.set(fx, y, fz);
    this.temp(flare, 0.07, (k) => {
      flare.scale.set(-(0.35 + (1 - k) * 0.35), 0.2 * k + 0.06, 0.2 * k + 0.06);
      flare.material.opacity = k;
    });
    const dir = Math.atan2(dz, dx);
    for (let i = 0; i < 5; i++) {
      const a = dir + (Math.random() - 0.5) * 0.9;
      const sp = 5 + Math.random() * 7;
      this.spawn(fx, y, fz, Math.cos(a) * sp, 0.5 + Math.random() * 2.5, Math.sin(a) * sp, i % 2 ? '#ffe08a' : color, 0.14 + Math.random() * 0.12, 0.07, 12);
    }
    this.spawn(fx, y + 0.1, fz, dx * 0.6, 1.2, dz * 0.6, '#9ca3af', 0.45, 0.16, -1);
  }

  // rastro que segue um herói por um tempo (investidas)
  trail(id, dur, el, color) {
    this.trails.push({ id, t: dur + 0.08, el, color, tt: 0 });
  }

  // brilho de reforço: anel subindo e partículas do elemento
  buffFx(x, z, color, el) {
    const ring = flat(new THREE.Mesh(RING, basic(color, 0.9, true)), 0.1);
    ring.position.set(x, 0.1, z);
    this.temp(ring, 0.55, (k) => {
      ring.position.y = 0.1 + (1 - k) * 2.1;
      ring.scale.setScalar(1.05 + (1 - k) * 0.25);
      ring.material.opacity = k;
    });
    const E = ELEMENTS[el] || ELEMENTS.neutral;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.spawn(x + Math.cos(a) * 0.9, 0.2, z + Math.sin(a) * 0.9, 0, 3 + Math.random() * 2, 0, E.cols[i % E.cols.length], 0.55, 0.11, 1);
    }
  }

  // cura: gotas claras subindo
  healFx(x, z, water = false) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 0.7;
      this.spawn(x + Math.cos(a) * d, 0.4 + Math.random() * 0.8, z + Math.sin(a) * d, 0, 1.6 + Math.random() * 1.4, 0, water ? (i % 2 ? '#bae6fd' : '#7dd3fc') : i % 2 ? '#bbf7d0' : '#5ee67a', 0.7, 0.1, -1.5);
    }
  }

  // ---------- áreas, explosões, zonas ----------

  telegraph(x, z, r, t, color, enemy, el = 'neutral') {
    const ring = flat(new THREE.Mesh(RING, basic(enemy ? '#ff4d6d' : color, 0.9)));
    ring.scale.setScalar(r);
    ring.position.set(x, 0.07, z);
    const fill = flat(new THREE.Mesh(DISC, basic(color, 0.28)));
    fill.position.set(x, 0.06, z);
    fill.scale.setScalar(0.01);
    const E = ELEMENTS[el] || ELEMENTS.neutral;
    this.temp(ring, t, () => {});
    this.temp(fill, t, (k) => {
      fill.scale.setScalar(Math.max(0.01, r * (1 - k)));
      // o elemento vai se juntando dentro da área enquanto ela carrega
      if (el !== 'neutral' && Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        const up = el === 'thunder' ? 9 : 2.5;
        this.spawn(x + Math.cos(a) * d, el === 'thunder' ? 0.2 : 0.15, z + Math.sin(a) * d, 0, up, 0, E.cols[(Math.random() * E.cols.length) | 0], el === 'thunder' ? 0.18 : 0.4, 0.1, hot(el) ? -3 : 0);
      }
    });
  }

  boom(x, z, r, color, ally = false, el = 'neutral') {
    const ring = flat(new THREE.Mesh(RING, basic(color, 0.9, true)), 0.1);
    ring.position.set(x, 0.1, z);
    this.temp(ring, 0.4, (k) => {
      ring.scale.setScalar(r * (0.4 + (1 - k) * 0.6));
      ring.material.opacity = k * 0.9;
    });
    const wash = Math.min(0.35, 0.9 / r);
    const disc = flat(new THREE.Mesh(DISC, basic(color, wash, true)), 0.08);
    disc.position.set(x, 0.08, z);
    disc.scale.setScalar(r);
    this.temp(disc, 0.3, (k) => (disc.material.opacity = k * wash));
    const E = ELEMENTS[el] || ELEMENTS.neutral;
    const pick = () => E.cols[(Math.random() * E.cols.length) | 0];
    const inside = (fn, n) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        fn(x + Math.cos(a) * d, z + Math.sin(a) * d, a, d);
      }
    };
    const n = Math.min(40, Math.round(8 + r * 6));
    if (ally) {
      // cura ou escudo em área: tudo sobe devagar
      inside((px, pz) => this.spawn(px, 0.3, pz, 0, 2.5 + Math.random() * 2.5, 0, el === 'neutral' ? color : pick(), 0.6 + Math.random() * 0.4, 0.13, -1), n);
      if (el === 'water') {
        this.ripple(x, z, r, '#7dd3fc', 0.6, false);
        this.ripple(x, z, r * 0.6, color, 0.45, false);
      }
      return;
    }
    switch (el) {
      case 'fire':
      case 'ember':
      case 'spark': {
        // bola de fogo que incha, chamas ou fumaça subindo e chão queimado
        const ball = new THREE.Mesh(SPHERE, basic(hot(el) ? '#ff7a1a' : '#ffb35c', 0.8, true));
        ball.position.set(x, 0.6, z);
        this.temp(ball, 0.26, (k) => {
          ball.scale.setScalar(r * (0.25 + (1 - k) * 0.6));
          ball.material.opacity = k * 0.8;
        });
        inside((px, pz, a) => this.spawn(px, 0.3, pz, Math.cos(a) * 1.5, 1 + Math.random() * 3, Math.sin(a) * 1.5, pick(), 0.5 + Math.random() * 0.5, 0.2, hot(el) ? -5 : 9), n);
        if (el === 'ember' && r >= 3.5) this.firePillars(x, z, r);
        if (el === 'spark') inside((px, pz) => this.spawn(px, 0.8, pz, 0, 1.5 + Math.random(), 0, Math.random() < 0.5 ? '#6b7280' : '#9ca3af', 0.9, 0.3, -1.2), Math.min(10, Math.round(r * 3)));
        const scorch = flat(new THREE.Mesh(DISC, basic('#170c08', 0.5)), 0.045);
        scorch.position.set(x, 0.045, z);
        scorch.scale.setScalar(r * 0.85);
        this.temp(scorch, 1.8, (k) => (scorch.material.opacity = Math.min(0.5, k * 0.9)));
        break;
      }
      case 'water':
        // coluna de respingos na borda e ondas no chão
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const d = r * (0.5 + Math.random() * 0.5);
          this.spawn(x + Math.cos(a) * d, 0.2, z + Math.sin(a) * d, Math.cos(a) * 2, 5 + Math.random() * 5, Math.sin(a) * 2, pick(), 0.6 + Math.random() * 0.3, 0.14, 15);
        }
        this.ripple(x, z, r * 1.15, '#7dd3fc', 0.55, false);
        this.ripple(x, z, r * 0.7, color, 0.4, false);
        break;
      case 'thunder': {
        // raios caindo dentro da área e clarão
        this.lightning(x, z, color);
        const bolts = Math.max(1, Math.min(4, Math.round(r - 1)));
        inside((px, pz) => this.lightning(px, pz, color), bolts);
        const flash = flat(new THREE.Mesh(DISC, basic('#e9d5ff', 0.4)), 0.11);
        flash.position.set(x, 0.11, z);
        flash.scale.setScalar(r);
        this.temp(flash, 0.12, (k) => (flash.material.opacity = k * 0.4));
        inside((px, pz, a) => this.spawn(px, 0.3, pz, Math.cos(a) * 5, Math.random() * 4, Math.sin(a) * 5, pick(), 0.25 + Math.random() * 0.2, 0.1, 0), n);
        break;
      }
      case 'thorn': {
        // espinhos brotando do chão em volta e poeira
        const spikes = new THREE.Group();
        const mat = basic(color, 1);
        const count = Math.max(5, Math.min(14, Math.round(r * 3.2)));
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
          const d = r * (i % 3 === 0 ? 0.45 : 0.82);
          const s = new THREE.Mesh(CONE, mat);
          s.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
          s.rotation.z = -Math.cos(a) * 0.35;
          s.rotation.x = Math.sin(a) * 0.35;
          s.userData.h = 0.8 + Math.random() * 0.7;
          spikes.add(s);
        }
        spikes.position.set(x, 0, z);
        this.temp(spikes, 0.75, (k) => {
          const grow = Math.min(1, (1 - k) * 6);
          for (const s of spikes.children) s.scale.set(0.16, s.userData.h * grow, 0.16);
          mat.opacity = Math.min(1, k * 3);
          if (k <= 0) mat.dispose();
        });
        inside((px, pz, a) => this.spawn(px, 0.2, pz, Math.cos(a) * 2.5, 1 + Math.random() * 2.5, Math.sin(a) * 2.5, Math.random() < 0.6 ? '#b8a37a' : '#d6c08a', 0.6, 0.2, 5), Math.min(18, n));
        break;
      }
      case 'swamp': {
        const fury = color === '#ef4444';
        for (let i = 0; i < 3; i++) {
          const arc = flat(new THREE.Mesh(ARC, basic(i === 1 ? '#ffffff' : i ? '#a855f7' : color, 0.85, true)), 0.4 + i * 0.35);
          arc.position.set(x, 0.4 + i * 0.35, z);
          arc.rotation.z = Math.random() * 6;
          this.temp(arc, 0.42, (k) => {
            arc.rotation.z += 0.5;
            arc.scale.setScalar(r * (0.5 + (1 - k) * 0.5) * (1 - i * 0.12));
            arc.material.opacity = k * 0.85;
          });
        }
        inside((px, pz, a) => {
          const sp = 3 + Math.random() * 4;
          this.spawn(px, 0.3, pz, -Math.sin(a) * sp, 2 + Math.random() * 3, Math.cos(a) * sp, Math.random() < 0.3 ? '#365314' : pick(), 0.5 + Math.random() * 0.3, 0.16, 8);
        }, n);
        this.ripple(x, z, r, fury ? '#ef4444' : '#4ade80', 0.45);
        if (fury) {
          this.ripple(x, z, r * 1.2, '#fca5a5', 0.3);
          inside((px, pz) => this.spawn(px, 0.4, pz, 0, 3 + Math.random() * 3, 0, Math.random() < 0.5 ? '#ef4444' : '#fde047', 0.5, 0.14, -2), 16);
        }
        break;
      }
      case 'sting':
        // enxame: pontinhos rodando em volta do centro
        inside((px, pz, a, d) => {
          const sp = 4 + Math.random() * 5;
          this.spawn(px, 0.5 + Math.random() * 1.4, pz, -Math.sin(a) * sp, (Math.random() - 0.5) * 2, Math.cos(a) * sp, pick(), 0.35 + Math.random() * 0.3, 0.11, 0);
        }, Math.min(46, Math.round(r * 12)));
        break;
      case 'wind': {
        // redemoinho: arcos girando e vento em volta
        for (let i = 0; i < 2; i++) {
          const arc = flat(new THREE.Mesh(ARC, basic(i ? color : '#ffffff', 0.8, true)), 0.5 + i * 0.6);
          arc.position.set(x, 0.5 + i * 0.6, z);
          arc.rotation.z = Math.random() * 6;
          this.temp(arc, 0.38, (k) => {
            arc.rotation.z += 0.45;
            arc.scale.setScalar(r * (0.55 + (1 - k) * 0.45) * (i ? 0.75 : 1));
            arc.material.opacity = k * 0.8;
          });
        }
        inside((px, pz, a) => {
          const sp = 5 + Math.random() * 4;
          this.spawn(px, 0.3 + Math.random() * 1.2, pz, -Math.sin(a) * sp, 1.5, Math.cos(a) * sp, pick(), 0.4, 0.11, -1);
        }, n);
        break;
      }
      default:
        inside((px, pz, a) => this.spawn(px, 0.3, pz, Math.cos(a) * 2, 2 + Math.random() * 5, Math.sin(a) * 2, Math.random() < 0.25 ? '#ffffff' : el === 'neutral' ? color : pick(), 0.5 + Math.random() * 0.4, 0.15, 9), n);
    }
  }

  cone(x, z, a, r, deg, color, el = 'neutral') {
    const rad = (deg * Math.PI) / 180;
    const geo = new THREE.CircleGeometry(r, 24, -rad / 2, rad);
    const mesh = new THREE.Mesh(geo, basic(color, 0.5, true));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -a;
    mesh.position.set(x, 0.1, z);
    this.temp(mesh, 0.3, (k) => {
      mesh.material.opacity = k * 0.5;
      if (k <= 0) geo.dispose();
    });
    const E = ELEMENTS[el] || ELEMENTS.neutral;
    for (let i = 0; i < 16; i++) {
      const aa = a + (Math.random() - 0.5) * rad;
      const d = Math.random() * r;
      this.spawn(x + Math.cos(aa) * d, 0.6, z + Math.sin(aa) * d, Math.cos(aa) * 4, 2, Math.sin(aa) * 4, el === 'neutral' ? color : E.cols[i % E.cols.length], 0.4, 0.14, E.g);
    }
    if (el === 'thunder') {
      // a pancada racha o chão: raios na ponta do leque e onda de choque
      for (let i = -1; i <= 1; i++) this.lightning(x + Math.cos(a + i * rad * 0.35) * r * 0.8, z + Math.sin(a + i * rad * 0.35) * r * 0.8, color, 4.5);
      this.ripple(x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5, r * 0.7, '#ffffff', 0.3);
    } else if (el === 'wind' || el === 'sting') {
      const arc = flat(new THREE.Mesh(ARC, basic('#ffffff', 0.9, true)), 1);
      arc.position.set(x, 1, z);
      arc.rotation.z = -a;
      this.temp(arc, 0.2, (k) => {
        arc.scale.setScalar(r * (0.6 + (1 - k) * 0.4));
        arc.material.opacity = k * 0.9;
      });
    }
  }

  addZone(m, el = 'neutral') {
    const g = new THREE.Group();
    if (m.l) return this.addLineZone(m, el);
    if (hot(el)) {
      // chão queimado por baixo do fogo
      const scorch = flat(new THREE.Mesh(DISC, basic('#170c08', 0.5)), 0.05);
      scorch.scale.setScalar(m.r * 0.95);
      g.add(scorch);
    }
    const disc = flat(new THREE.Mesh(DISC, basic(hot(el) ? '#ff7a1a' : m.c, 0.3, true)), 0.07);
    disc.scale.setScalar(m.r);
    const ring = flat(new THREE.Mesh(RING, basic(m.c, 0.8, true)), 0.08);
    ring.scale.setScalar(m.r);
    g.add(disc, ring);
    g.position.set(m.x, 0, m.z);
    this.scene.add(g);
    this.zones.set(m.id, { g, disc, x: m.x, z: m.z, r: m.r, c: m.c, t: m.t, el });
  }

  endZone(id) {
    const z = this.zones.get(id);
    if (!z) return;
    this.zones.delete(id);
    this.scene.remove(z.g);
    z.g.traverse((o) => o.material?.dispose?.());
  }

  blink(a, b, color, el = 'neutral') {
    this.streak(a[0], a[1], b[0], b[1], color, 0.5, 0.28, 0.6);
    if (el === 'neutral') {
      this.burst(a[0], 1, a[1], color, 16, 4, 0.14, 0.5);
      this.burst(b[0], 1, b[1], color, 16, 4, 0.14, 0.5);
    } else if (el === 'arrow') {
      // revoada: penas caindo devagar nos dois pontos
      for (const p of [a, b]) {
        for (let i = 0; i < 12; i++) {
          const an = Math.random() * Math.PI * 2;
          this.spawn(p[0] + Math.cos(an) * 0.5, 1 + Math.random() * 1.2, p[1] + Math.sin(an) * 0.5, Math.cos(an) * 2, 1.5 + Math.random(), Math.sin(an) * 2, i % 3 ? color : '#ffffff', 0.8 + Math.random() * 0.4, 0.13, 2.2);
        }
      }
    } else if (el === 'ember') {
      this.footprints(a, b);
      this.puff(a[0], 0.8, a[1], 'ember', 16, 4, 0.16, 0.6);
      for (let i = 0; i < 10; i++) {
        const an = Math.random() * Math.PI * 2;
        this.spawn(b[0] + Math.cos(an) * 0.5, 0.3, b[1] + Math.sin(an) * 0.5, Math.cos(an) * 1.5, 1.5, Math.sin(an) * 1.5, i % 2 ? '#4d7c0f' : '#65a30d', 0.8, 0.14, 4);
      }
    } else {
      this.puff(a[0], 1, a[1], el, 14, 4, 0.14, 0.5);
      this.puff(b[0], 1, b[1], el, 14, 4, 0.14, 0.5);
    }
    this.ripple(b[0], b[1], 1.1, color, 0.3);
  }

  // Salto: some num ponto e estoura em luz no outro, sem rastro ligando os dois
  flash(a, b, color) {
    // origem: a luz se fecha e sobe, como se o herói fosse sugado
    const inRing = flat(new THREE.Mesh(RING, basic(color, 0.9, true)), 0.1);
    inRing.position.set(a[0], 0.1, a[1]);
    this.temp(inRing, 0.22, (k) => {
      inRing.scale.setScalar(0.2 + k * 1.5);
      inRing.material.opacity = k * 0.9;
    });
    const ghost = new THREE.Mesh(BOX, basic('#ffffff', 0.8, true));
    ghost.position.set(a[0], 1.1, a[1]);
    this.temp(ghost, 0.2, (k) => {
      ghost.scale.set(0.9 * k, 2.2 + (1 - k) * 2.5, 0.9 * k);
      ghost.position.y = 1.1 + (1 - k) * 1.6;
      ghost.material.opacity = k * 0.8;
    });
    for (let i = 0; i < 10; i++) {
      const an = Math.random() * Math.PI * 2;
      this.spawn(a[0] + Math.cos(an) * 0.6, 0.3 + Math.random() * 1.6, a[1] + Math.sin(an) * 0.6, -Math.cos(an) * 1.5, 5 + Math.random() * 3, -Math.sin(an) * 1.5, i % 2 ? color : '#ffffff', 0.35, 0.11, 0);
    }
    // destino: clarão branco, coluna de luz, dois anéis e faíscas pra todo lado
    const core = new THREE.Mesh(SPHERE, basic('#ffffff', 1, true));
    core.position.set(b[0], 1.1, b[1]);
    this.temp(core, 0.2, (k) => {
      core.scale.setScalar(0.5 + (1 - k) * 2.6);
      core.material.opacity = k * k;
    });
    const halo = new THREE.Mesh(SPHERE, basic(color, 0.7, true));
    halo.position.set(b[0], 1.1, b[1]);
    this.temp(halo, 0.34, (k) => {
      halo.scale.setScalar(0.8 + (1 - k) * 3.4);
      halo.material.opacity = k * 0.55;
    });
    const pillar = new THREE.Mesh(BOX, basic('#fffbe6', 0.9, true));
    pillar.position.set(b[0], 4, b[1]);
    this.temp(pillar, 0.3, (k) => {
      pillar.scale.set(0.15 + k * 0.75, 8, 0.15 + k * 0.75);
      pillar.material.opacity = k * 0.85;
    });
    this.ripple(b[0], b[1], 2.6, '#ffffff', 0.28);
    this.ripple(b[0], b[1], 3.6, color, 0.45);
    this.burst(b[0], 1.1, b[1], '#ffffff', 14, 9, 0.12, 0.3);
    this.burst(b[0], 1.1, b[1], color, 18, 6, 0.16, 0.5);
  }

  footprints(a, b) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.5) return;
    const ux = dx / len;
    const uz = dz / len;
    const steps = Math.max(2, Math.floor(len / 0.8));
    for (let i = 1; i <= steps; i++) {
      const k = i / (steps + 1);
      const side = i % 2 ? 1 : -1;
      const px = a[0] + dx * k - uz * side * 0.22;
      const pz = a[1] + dz * k + ux * side * 0.22;
      const foot = new THREE.Group();
      const sole = flat(new THREE.Mesh(DISC, basic('#1c1007', 0.75)), 0.065);
      sole.scale.set(0.16, 0.26, 1);
      const toes = flat(new THREE.Mesh(DISC, basic('#ff7a1a', 0.85, true)), 0.07);
      toes.scale.set(0.12, 0.08, 1);
      toes.position.set(0, 0.07, 0.24);
      foot.add(sole, toes);
      foot.position.set(px, 0, pz);
      foot.rotation.y = Math.atan2(-ux, -uz);
      this.scene.add(foot);
      this.temps.push({
        mesh: foot,
        life: 2.2,
        max: 2.2,
        update: (kk) => {
          sole.material.opacity = Math.min(0.75, kk * 1.5);
          toes.material.opacity = Math.min(0.85, kk * 1.5);
          if (kk <= 0) {
            toes.material.dispose();
            sole.material.dispose();
          }
        },
      });
    }
  }

  firePillars(x, z, r) {
    const n = Math.round(r * 2.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const d = r * (0.55 + Math.random() * 0.4);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const h = 2 + Math.random() * 2.5;
      const pillar = new THREE.Mesh(CONE, basic(i % 2 ? '#ffb020' : '#ff3d00', 0.85, true));
      pillar.position.set(px, 0, pz);
      const delay = Math.random() * 0.15;
      this.temp(pillar, 0.75 + delay, (k) => {
        const t = 1 - k;
        const grow = Math.min(1, t * 6);
        pillar.scale.set(0.35 * (1 - t * 0.5), h * grow * (k > 0.3 ? 1 : k / 0.3), 0.35 * (1 - t * 0.5));
        pillar.material.opacity = Math.min(0.85, k * 2);
      });
    }
    const flash = flat(new THREE.Mesh(DISC, basic('#ffd166', 0.5, true)), 0.12);
    flash.position.set(x, 0.12, z);
    flash.scale.setScalar(r);
    this.temp(flash, 0.2, (k) => (flash.material.opacity = k * 0.5));
    this.ripple(x, z, r * 1.25, '#ff3d00', 0.5);
  }

  addLineZone(m, el) {
    const [ax, az, bx, bz] = m.l;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const ang = Math.atan2(bz - az, bx - ax);
    const g = new THREE.Group();
    const scorch = new THREE.Mesh(PLANE, basic('#170c08', 0.55));
    scorch.rotation.x = -Math.PI / 2;
    scorch.rotation.z = -ang;
    scorch.scale.set(len + m.r, m.r * 2, 1);
    scorch.position.set((ax + bx) / 2, 0.05, (az + bz) / 2);
    const disc = new THREE.Mesh(PLANE, basic('#ff7a1a', 0.3, true));
    disc.rotation.x = -Math.PI / 2;
    disc.rotation.z = -ang;
    disc.scale.set(len + m.r * 0.6, m.r * 1.5, 1);
    disc.position.set((ax + bx) / 2, 0.07, (az + bz) / 2);
    g.add(scorch, disc);
    const tongues = [];
    const n = Math.round(len / 0.7);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const t = new THREE.Mesh(CONE, basic(i % 2 ? '#ffb020' : '#ff3d00', 0.8, true));
      const h = 1.1 + Math.random() * 0.9;
      t.position.set(ax + (bx - ax) * k, 0, az + (bz - az) * k);
      t.scale.set(0.3, h, 0.3);
      t.userData.h = h;
      t.userData.ph = Math.random() * 6;
      g.add(t);
      tongues.push(t);
    }
    this.scene.add(g);
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    this.zones.set(m.id, { g, disc, x: (ax + bx) / 2, z: (az + bz) / 2, r: m.r, c: m.c, t: m.t, el, line: m.l, tongues, nx, nz });
    for (let i = 0; i <= n; i++) this.puff(ax + (bx - ax) * (i / n), 0.4, az + (bz - az) * (i / n), 'ember', 3, 3, 0.16, 0.5);
  }

  jaws(x, y, z, dir, scale = 1, fury = false, life = 0.32) {
    const make = (top) => {
      const g = new THREE.Group();
      const skin = basic(fury ? '#b91c1c' : '#166534', 0.95);
      const bar = new THREE.Mesh(BOX, skin);
      bar.scale.set(1.3, 0.16, 0.5);
      g.add(bar);
      const tooth = basic('#ffffff', 1);
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(CONE, tooth);
        t.scale.set(0.08, 0.26, 0.08);
        t.position.set(-0.55 + i * 0.22, top ? -0.06 : 0.06, 0.16);
        if (top) t.rotation.x = Math.PI;
        g.add(t);
      }
      return g;
    };
    const root = new THREE.Group();
    const up = make(true);
    const lo = make(false);
    root.add(up, lo);
    root.position.set(x, y, z);
    root.rotation.y = -dir + Math.PI / 2;
    root.scale.setScalar(scale);
    this.temp(root, life, (k) => {
      const t = 1 - k;
      const open = t < 0.35 ? 0.6 * (t / 0.35) : Math.max(0, 0.6 - (t - 0.35) * 6);
      up.position.y = 0.15 + open;
      lo.position.y = -0.15 - open;
      root.traverse((o) => o.material && (o.material.opacity = Math.min(1, k * 3)));
      if (k <= 0) root.traverse((o) => o.material?.dispose?.());
    });
  }

  bite(x, z, dir, n, fury) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        this.jaws(x, 1.2, z, dir, fury ? 1.6 : 1.3, fury, 0.35);
        this.burst(x, 1.1, z, fury ? '#ef4444' : '#4ade80', 10, 5, 0.12, 0.35);
        this.ripple(x, z, 1.4, fury ? '#ef4444' : '#86efac', 0.25);
      }, i * 120);
    }
  }

  furyBurst(x, z) {
    const ring = flat(new THREE.Mesh(RING, basic('#ef4444', 0.95, true)), 0.1);
    ring.position.set(x, 0.1, z);
    this.temp(ring, 0.4, (k) => {
      ring.scale.setScalar(0.5 + (1 - k) * 2.2);
      ring.material.opacity = k;
    });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.spawn(x + Math.cos(a) * 0.6, 1.2, z + Math.sin(a) * 0.6, Math.cos(a) * 4, 2 + Math.random() * 3, Math.sin(a) * 4, i % 2 ? '#ef4444' : '#fde047', 0.4, 0.14, 4);
    }
  }

  transform(x, z) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 9, 20, 1, true), basic('#a855f7', 0.55, true));
    pillar.position.set(x, 4.5, z);
    this.temp(pillar, 0.9, (k) => {
      pillar.scale.set(0.4 + (1 - k) * 1.2, 1, 0.4 + (1 - k) * 1.2);
      pillar.rotation.y += 0.2;
      pillar.material.opacity = k * 0.55;
      if (k <= 0) pillar.geometry.dispose();
    });
    for (let i = 0; i < 3; i++) setTimeout(() => this.ripple(x, z, 4 + i, i % 2 ? '#4ade80' : '#a855f7', 0.55), i * 110);
    for (let i = 0; i < 3; i++) this.lightning(x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 4, '#c084fc', 7);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 2.5;
      this.spawn(x + Math.cos(a) * d, 0.3, z + Math.sin(a) * d, Math.cos(a) * 2, 4 + Math.random() * 5, Math.sin(a) * 2, ['#a855f7', '#4ade80', '#365314', '#d9f99d'][i % 4], 0.9 + Math.random() * 0.5, 0.22, 2);
    }
  }

  levelUp(x, z) {
    const ring = flat(new THREE.Mesh(RING, basic('#f4c430', 0.9, true)), 0.1);
    ring.position.set(x, 0.1, z);
    this.temp(ring, 0.8, (k) => {
      ring.position.y = 0.1 + (1 - k) * 2.5;
      ring.scale.setScalar(1.2 + (1 - k) * 0.6);
      ring.material.opacity = k;
    });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.spawn(x + Math.cos(a) * 1.1, 0.3, z + Math.sin(a) * 1.1, 0, 4 + Math.random() * 2, 0, '#fde68a', 0.7, 0.12, 2);
    }
  }

  laser(from, to, color) {
    const len = from.distanceTo(to);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 6, 1, true), basic(color, 0.9, true));
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    this.temp(mesh, 0.2, (k) => {
      mesh.material.opacity = k * 0.9;
      if (k <= 0) mesh.geometry.dispose();
    });
  }

  // golpe acertou: clarão, partículas do elemento no sentido do golpe e o rastro da arma
  impact(x, y, z, dx, dz, color, power = 1, melee = false, style = null) {
    const el = style?.el || 'neutral';
    const dir = Math.atan2(dz, dx);
    const flash = new THREE.Mesh(SPHERE, basic(hot(el) ? '#ffd166' : el === 'water' ? '#e0f2fe' : '#ffffff', 0.95, true));
    flash.position.set(x, y, z);
    this.temp(flash, 0.11, (k) => {
      flash.scale.setScalar((0.2 + (1 - k) * 0.45) * power);
      flash.material.opacity = k;
    });
    const n = Math.round(4 + power * 5);
    if (el === 'neutral') {
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * 1.5;
        const sp = (4 + Math.random() * 6) * power;
        this.spawn(x, y, z, Math.cos(a) * sp, 1.5 + Math.random() * 4, Math.sin(a) * sp, i % 2 ? '#ffffff' : color, 0.22 + Math.random() * 0.2, 0.09 + Math.random() * 0.08, 14);
      }
    } else this.puff(x, y, z, el, n + (el === 'spark' ? 4 : 0), hot(el) ? 3 : 7 * power, 0.1, hot(el) ? 0.45 : 0.3, dir);
    if (!melee) {
      if (el === 'water') this.ripple(x, z, 0.9, color, 0.3);
      return;
    }
    const arcAt = (scale, grow, col, life, back = 1.5) => {
      const arc = new THREE.Mesh(ARC, basic(col, 0.9, true));
      arc.rotation.x = -Math.PI / 2;
      arc.rotation.z = -dir;
      arc.position.set(x - dx * back, y, z - dz * back);
      this.temp(arc, life, (k) => {
        arc.scale.setScalar(scale + (1 - k) * grow);
        arc.material.opacity = k * 0.9;
      });
    };
    switch (style?.slash) {
      case 'wide':
        // espada: corte largo e um rastro de vento atrás
        arcAt(1.9, 0.9, '#ffffff', 0.17, 2);
        arcAt(1.6, 0.7, color, 0.22, 1.8);
        for (let i = 0; i < 5; i++) {
          const a = dir + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          this.spawn(x, y, z, Math.cos(a) * 6, 0.5, Math.sin(a) * 6, '#ffffff', 0.2, 0.08, -1);
        }
        break;
      case 'double':
        // dois ferrões: um X fino em cima do alvo
        for (const s of [-1, 1]) {
          const cut = new THREE.Mesh(PLANE, basic(s < 0 ? '#fff7b0' : color, 0.95, true));
          cut.rotation.x = -Math.PI / 2;
          cut.rotation.z = -dir + s * 0.7;
          cut.position.set(x, y + s * 0.12, z);
          this.temp(cut, 0.15, (k) => {
            cut.scale.set(0.6 + (1 - k) * 1.8, 0.09 * k + 0.02, 1);
            cut.material.opacity = k;
          });
        }
        break;
      case 'bite':
        this.jaws(x, y, z, dir, 1, false, 0.7);
        break;
      case 'smash':
        // martelo: onda de choque no chão e um raio no alvo
        this.ripple(x, z, 1.9, color, 0.3);
        this.ripple(x, z, 1.2, '#ffffff', 0.2);
        this.lightning(x, z, color, 3.5);
        break;
      case 'bash':
        // escudo e clava: pancada surda, poeira e anel curto
        this.ripple(x, z, 1.5, '#d6c08a', 0.28, false);
        arcAt(1.1, 0.4, color, 0.14, 1.1);
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          this.spawn(x, 0.2, z, Math.cos(a) * 3, 1 + Math.random() * 1.5, Math.sin(a) * 3, '#b8a37a', 0.5, 0.2, 4);
        }
        break;
      default:
        arcAt(1.3, 0.7, color, 0.16);
    }
  }

  clickMarker(x, z, attack) {
    const ring = flat(new THREE.Mesh(RING, basic(attack ? '#ff4d6d' : '#7dffb0', 0.95)), 0.09);
    ring.position.set(x, 0.09, z);
    this.temp(ring, 0.35, (k) => {
      ring.scale.setScalar(0.25 + k * 0.6);
      ring.material.opacity = k;
    });
  }

  // ---------- indicadores de mira do jogador ----------

  buildIndicators() {
    const col = '#9be7ff';
    this.ind = new THREE.Group();
    this.ind.visible = false;
    this.indRange = flat(new THREE.Mesh(THIN, basic(col, 0.7)), 0.11);
    this.indCircle = flat(new THREE.Mesh(DISC, basic(col, 0.22)), 0.1);
    this.indCircleEdge = flat(new THREE.Mesh(RING, basic(col, 0.8)), 0.11);
    const rectGeo = PLANE.clone();
    rectGeo.translate(0, 0.5, 0);
    this.indRect = new THREE.Mesh(rectGeo, basic(col, 0.35));
    this.indRect.rotation.x = -Math.PI / 2;
    this.indRect.position.y = 0.1;
    this.indCone = null;
    this.ind.add(this.indRange, this.indCircle, this.indCircleEdge, this.indRect);
    this.scene.add(this.ind);

    this.towerRing = flat(new THREE.Mesh(THIN, basic('#ff4d6d', 0.75)), 0.05);
    this.towerRing.visible = false;
    this.scene.add(this.towerRing);
    this.hoverRing = flat(new THREE.Mesh(RING, basic('#ffffff', 0.9)), 0.12);
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);
    this.targetRing = flat(new THREE.Mesh(TARGET, basic('#ff2d55', 0.9)), 0.1);
    this.targetRing.visible = false;
    this.scene.add(this.targetRing);
  }

  // anel fixo embaixo de quem você mandou atacar
  showTarget(u, time) {
    this.targetRing.visible = !!u;
    if (!u) return;
    const r = u.kind === 'hero' ? 1.05 : u.kind === 'core' ? 3.6 : u.kind === 'tower' || u.kind === 'selo' ? 2.2 : 0.7;
    this.targetRing.position.set(u.x, 0.1, u.z);
    this.targetRing.scale.setScalar(r * (1 + Math.sin(time * 7) * 0.05));
  }

  showHover(u, enemy) {
    this.hoverRing.visible = !!u;
    if (!u) return;
    const r = u.kind === 'hero' ? 1.25 : u.kind === 'core' ? 3.8 : u.kind === 'tower' || u.kind === 'selo' ? 2.4 : 0.85;
    this.hoverRing.position.set(u.x, 0.12, u.z);
    this.hoverRing.scale.setScalar(r);
    this.hoverRing.material.color.set(enemy ? '#ff4d6d' : '#7cc4ff');
  }

  showTowerRange(x, z, r, visible) {
    this.towerRing.visible = visible;
    if (!visible) return;
    this.towerRing.position.set(x, 0.05, z);
    this.towerRing.scale.setScalar(r);
  }

  hideIndicator() {
    this.ind.visible = false;
  }

  showIndicator(hero, ab, mx, mz) {
    this.ind.visible = true;
    const hx = hero.x;
    const hz = hero.z;
    let dx = mx - hx;
    let dz = mz - hz;
    let d = Math.hypot(dx, dz);
    if (d < 0.01) {
      dx = 1;
      dz = 0;
      d = 0;
    } else {
      dx /= d;
      dz /= d;
    }
    const range = ab.range || ab.radius || 0;
    this.indRange.visible = range > 0;
    this.indRange.position.set(hx, 0.11, hz);
    this.indRange.scale.setScalar(Math.max(0.5, ab.kind === 'nova' ? ab.radius : range));
    this.indCircle.visible = false;
    this.indCircleEdge.visible = false;
    this.indRect.visible = false;
    if (this.indCone) this.indCone.visible = false;
    const circleAt = (x, z, r) => {
      this.indCircle.visible = this.indCircleEdge.visible = true;
      this.indCircle.position.set(x, 0.1, z);
      this.indCircleEdge.position.set(x, 0.11, z);
      this.indCircle.scale.setScalar(r);
      this.indCircleEdge.scale.setScalar(r);
    };
    switch (ab.kind) {
      case 'proj':
        this.indRect.visible = true;
        this.indRect.position.set(hx, 0.1, hz);
        this.indRect.scale.set(ab.width, ab.range, 1);
        this.indRect.rotation.z = -Math.atan2(dz, dx) - Math.PI / 2;
        break;
      case 'aoe':
      case 'zone':
      case 'ally': {
        const k = ab.range > 0 ? Math.min(ab.range, d) : 0;
        if (ab.line) {
          const cx = hx + dx * k;
          const cz = hz + dz * k;
          const half = ab.line / 2;
          this.indRect.visible = true;
          this.indRect.position.set(cx + dz * half, 0.1, cz - dx * half);
          this.indRect.scale.set(ab.radius * 2, ab.line, 1);
          this.indRect.rotation.z = -Math.atan2(dx, -dz) - Math.PI / 2;
          break;
        }
        circleAt(hx + dx * k, hz + dz * k, ab.radius);
        break;
      }
      case 'nova':
        circleAt(hx, hz, ab.radius);
        break;
      case 'cone': {
        if (!this.indCone || this.indConeKey !== ab.angle + ':' + ab.range) {
          if (this.indCone) this.ind.remove(this.indCone);
          const half = (ab.angle * Math.PI) / 360;
          this.indCone = new THREE.Mesh(new THREE.CircleGeometry(ab.range, 24, -half, half * 2), basic('#9be7ff', 0.25));
          this.indCone.rotation.x = -Math.PI / 2;
          this.indConeKey = ab.angle + ':' + ab.range;
          this.ind.add(this.indCone);
        }
        this.indCone.visible = true;
        this.indCone.position.set(hx, 0.1, hz);
        this.indCone.rotation.z = -Math.atan2(dz, dx);
        break;
      }
      case 'dash':
      case 'blink': {
        const k = Math.min(ab.range, Math.max(d, ab.kind === 'dash' ? 1.5 : 0));
        this.indRect.visible = true;
        this.indRect.position.set(hx, 0.1, hz);
        this.indRect.scale.set(0.5, k, 1);
        this.indRect.rotation.z = -Math.atan2(dz, dx) - Math.PI / 2;
        circleAt(hx + dx * k, hz + dz * k, ab.end ? ab.end.radius : 0.8);
        break;
      }
      default:
        break;
    }
  }

  update(dt, time, posOf) {
    this.updateProjs(dt, posOf);
    for (let i = this.temps.length - 1; i >= 0; i--) {
      const t = this.temps[i];
      t.life -= dt;
      const k = Math.max(0, t.life / t.max);
      t.update?.(k);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.material?.dispose?.();
        this.temps.splice(i, 1);
      }
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.t -= dt;
      t.tt -= dt;
      const u = posOf(t.id);
      if (t.t <= 0 || !u) {
        this.trails.splice(i, 1);
        continue;
      }
      if (t.tt > 0) continue;
      t.tt = 0.03;
      this.puff(u.x, 0.5 + Math.random() * 0.9, u.z, t.el, 2, 1.5, 0.14, 0.4);
      if (t.el === 'swamp') {
        const dot = flat(new THREE.Mesh(DISC, basic(Math.random() < 0.5 ? '#365314' : '#14532d', 0.55)), 0.06);
        dot.position.set(u.x + (Math.random() - 0.5) * 0.6, 0.06, u.z + (Math.random() - 0.5) * 0.6);
        dot.scale.setScalar(0.35 + Math.random() * 0.35);
        this.temp(dot, 1.2, (k) => (dot.material.opacity = k * 0.55));
        this.spawn(u.x, 0.2, u.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, Math.random() < 0.5 ? '#4ade80' : '#a855f7', 0.5, 0.12, 7);
      } else if (t.el === 'fire') {
        // a serpente de fogo deixa um risco aceso no chão
        const dot = flat(new THREE.Mesh(DISC, basic('#ff7a1a', 0.6, true)), 0.07);
        dot.position.set(u.x, 0.07, u.z);
        dot.scale.setScalar(0.55);
        this.temp(dot, 0.6, (k) => (dot.material.opacity = k * 0.6));
      } else if (t.el === 'thorn') this.spawn(u.x, 0.2, u.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, Math.random() < 0.5 ? '#f9a8d4' : '#bef264', 0.6, 0.12, 6);
    }
    for (const z of this.zones.values()) {
      z.disc.material.opacity = 0.22 + Math.sin(time * 12 + z.x) * 0.08;
      const E = ELEMENTS[z.el] || ELEMENTS.neutral;
      const fire = hot(z.el);
      if (z.line) {
        const [ax, az, bx, bz] = z.line;
        for (const t of z.tongues) t.scale.y = t.userData.h * (0.7 + Math.abs(Math.sin(time * 9 + t.userData.ph)) * 0.6);
        for (let i = 0; i < 4; i++) {
          const k = Math.random();
          const o = (Math.random() - 0.5) * z.r;
          const px = ax + (bx - ax) * k + z.nx * o;
          const pz = az + (bz - az) * k + z.nz * o;
          this.spawn(px, 0.2, pz, 0, 2.5 + Math.random() * 3.5, 0, E.cols[(Math.random() * E.cols.length) | 0], 0.7, 0.2, -3);
        }
        continue;
      }
      for (let i = 0; i < (fire ? 3 : 2); i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * z.r;
        const col = z.el === 'neutral' ? (Math.random() > 0.4 ? z.c : '#ffd166') : E.cols[(Math.random() * E.cols.length) | 0];
        this.spawn(z.x + Math.cos(a) * d, 0.2, z.z + Math.sin(a) * d, 0, 2 + Math.random() * (fire ? 3.5 : 2), 0, col, fire ? 0.75 : 0.6, fire ? 0.22 : 0.16, fire ? -3 : -2);
      }
    }
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05 && p.gravity > 0) {
        p.y = 0.05;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
    }
    for (const p of this.particles) {
      if (n >= MAX_PARTICLES) break;
      const k = p.life / p.max;
      const s = p.size * (0.35 + k * 0.65);
      _p.set(p.x, p.y, p.z);
      _s.set(s, s, s);
      _m.compose(_p, _q, _s);
      this.inst.setMatrixAt(n, _m);
      _c.copy(p.color);
      this.inst.setColorAt(n, _c);
      n++;
    }
    this.inst.count = n;
    this.inst.instanceMatrix.needsUpdate = true;
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;
  }
}
