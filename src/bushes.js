// Moitas de capim alto nas bordas da ponte. Só visual: quem está escondido é regra da simulação.
// Cada moita é um InstancedMesh de folhas de capim (uma chamada de desenho só) mais tufos e flores,
// com balanço de vento no shader. `setInside(true)` deixa a moita translúcida pra quem está dentro dela.
import * as THREE from 'three';

// folha de capim: fita curva que afina até a ponta, base em y = 0, altura 1
function bladeGeo() {
  const seg = 6;
  const pos = [];
  const idx = [];
  const uv = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = 0.07 * (1 - t) ** 0.8 + 0.004;
    const bend = t * t * 0.35;
    pos.push(-w, t, bend, w, t, bend);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const BLADE = bladeGeo();
const TUFT = new THREE.IcosahedronGeometry(1, 2);

// vento: a ponta da folha balança, a base fica presa; fase muda com a posição de cada folha
function windy(material, uniforms) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uRustle = uniforms.uRustle;
    sh.vertexShader = 'uniform float uTime;\nuniform float uRustle;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sway = sin(uTime * 1.8 + wp.x * 0.7 + wp.z * 0.9) * 0.08 + sin(uTime * 3.1 + wp.x * 1.3) * 0.03;
      sway += sin(uTime * 22.0 + wp.x * 5.0) * 0.06 * uRustle;
      transformed.x += sway * position.y * position.y;
      transformed.z += sway * 0.6 * position.y * position.y;`,
    );
  };
  material.customProgramCacheKey = () => 'bush-wind';
  return material;
}

const greens = ['#3f7a2a', '#4d8a30', '#5c9a35', '#356b24', '#6aa83e', '#7fb24a'];

export class Bush {
  constructor(x, z, rx, rz, seed = 1) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.uniforms = { uTime: { value: 0 }, uRustle: { value: 0 } };
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);

    // chão mais escuro marcando a área da moita
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#2f4f1f', roughness: 1, transparent: true, opacity: 0.85 }));
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(rx * 1.05, rz * 1.05, 1);
    ground.position.y = 0.03;
    ground.receiveShadow = true;
    this.group.add(ground);

    // folhas de capim
    const n = Math.round(rx * rz * 42);
    this.bladeMat = windy(new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 1 }), this.uniforms);
    const blades = new THREE.InstancedMesh(BLADE, this.bladeMat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      // mais denso no meio, folhas mais altas no centro
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      const px = Math.cos(a) * r * rx;
      const pz = Math.sin(a) * r * rz;
      const h = (1.3 + rnd() * 0.8) * (1 - r * 0.35);
      e.set((rnd() - 0.5) * 0.4, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.4);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(px, 0, pz), q, new THREE.Vector3(1.2 + rnd() * 0.8, h, 1));
      blades.setMatrixAt(i, m);
      c.set(greens[(rnd() * greens.length) | 0]);
      // algumas pontas secas, amareladas
      if (rnd() < 0.12) c.lerp(new THREE.Color('#c9b458'), 0.6);
      blades.setColorAt(i, c);
    }
    blades.castShadow = true;
    blades.receiveShadow = true;
    this.group.add(blades);

    // tufos redondos na base, pra dar volume
    this.tuftMat = new THREE.MeshStandardMaterial({ color: '#3d7027', roughness: 0.9, transparent: true, opacity: 1 });
    const tufts = Math.round(rx * rz * 2.2);
    for (let i = 0; i < tufts; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.85;
      const t = new THREE.Mesh(TUFT, this.tuftMat);
      const k = 0.35 + rnd() * 0.3;
      t.scale.set(k * 1.3, k * 0.8, k * 1.3);
      t.position.set(Math.cos(a) * r * rx, k * 0.4, Math.sin(a) * r * rz);
      t.castShadow = true;
      this.group.add(t);
    }

    // florzinhas amarelas e brancas no meio do capim
    this.flowerMats = [new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.5, transparent: true }), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5, transparent: true })];
    for (let i = 0; i < Math.round(rx * rz * 1.5); i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.9;
      const f = new THREE.Mesh(TUFT, this.flowerMats[i % 2]);
      f.scale.setScalar(0.07);
      f.position.set(Math.cos(a) * r * rx, 0.9 + rnd() * 0.6, Math.sin(a) * r * rz);
      this.group.add(f);
    }
    this.alpha = 1;
    this.target = 1;
  }

  // quem está dentro (você ou um aliado visível pra você) enxerga através da moita
  setInside(on) {
    this.target = on ? 0.42 : 1;
  }

  // alguém andando dentro: o capim chacoalha
  rustle(k) {
    this.uniforms.uRustle.value = k;
  }

  update(dt, time) {
    this.uniforms.uTime.value = time;
    this.alpha += (this.target - this.alpha) * Math.min(1, dt * 8);
    for (const mt of [this.bladeMat, this.tuftMat, ...this.flowerMats]) {
      mt.opacity = this.alpha;
      mt.depthWrite = this.alpha > 0.99;
    }
  }
}
