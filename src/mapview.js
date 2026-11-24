import * as THREE from 'three';
import { MAP, TEAMS } from './config.js';
import { BUSHES, OBSTACLES } from './geo.js';
import { Bush } from './bushes.js';

function canvasTexture(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  return tex;
}

function noise(ctx, w, h, amount, alpha, size = 2) {
  for (let i = 0; i < amount; i++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

function stoneTiles(base, line) {
  return (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const rows = 4;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? w / 6 : 0;
      for (let c = -1; c < 3; c++) {
        const x = c * (w / 3) + off;
        const shade = Math.random() * 0.12;
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(x + 2, r * rh + 2, w / 3 - 4, rh - 4);
      }
      ctx.fillStyle = line;
      ctx.fillRect(0, r * rh, w, 3);
      for (let c = 0; c < 4; c++) ctx.fillRect(c * (w / 3) + off, r * rh, 3, rh);
    }
    noise(ctx, w, h, 3000, 0.08);
  };
}

const grassTex = () =>
  canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#5f8f3e';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(130,180,80,0.35)' : 'rgba(40,80,30,0.3)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 5);
      }
    },
    [24, 6],
  );

function box(m, w, h, d, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(m, rt, rb, h, x, y, z, seg = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildMapView(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const L = MAP.laneHalf;
  const W = MAP.laneWidth;

  // rio
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 300),
    new THREE.MeshStandardMaterial({ color: '#2b7a8c', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -3.2;
  water.receiveShadow = true;
  g.add(water);
  const riverbed = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshStandardMaterial({ color: '#1d4f5c' }));
  riverbed.rotation.x = -Math.PI / 2;
  riverbed.position.y = -6;
  g.add(riverbed);

  // margens com grama e árvores
  const grass = new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 });
  const dirt = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 1, flatShading: true });
  for (const side of [-1, 1]) {
    const bank = box(grass, 340, 1, 60, 0, -1.2, side * 52, false);
    g.add(bank);
    const slope = box(dirt, 340, 3.2, 3, 0, -2.4, side * 22.4, false);
    g.add(slope);
  }
  const trunk = new THREE.MeshStandardMaterial({ color: '#6b4a2f', flatShading: true });
  const leafA = new THREE.MeshStandardMaterial({ color: '#2f7d32', flatShading: true });
  const leafB = new THREE.MeshStandardMaterial({ color: '#4c9a2a', flatShading: true });
  const palm = new THREE.MeshStandardMaterial({ color: '#3f8f3a', flatShading: true });
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1;
    const x = -150 + Math.random() * 300;
    const z = side * (25 + Math.random() * 18);
    if (Math.abs(x) > 60 && Math.abs(z) < 30 && Math.abs(Math.abs(x) - MAP.baseX) < 22) continue;
    const s = 0.8 + Math.random() * 0.8;
    if (Math.random() < 0.4) {
      const t = cyl(trunk, 0.18 * s, 0.28 * s, 5 * s, x, -0.7 + 2.5 * s, z, 6);
      t.rotation.z = (Math.random() - 0.5) * 0.3;
      g.add(t);
      for (let k = 0; k < 5; k++) {
        const fr = box(palm, 3.2 * s, 0.12, 0.7 * s, x, -0.7 + 5 * s, z);
        fr.rotation.y = (k / 5) * Math.PI * 2;
        fr.rotation.z = -0.35;
        fr.translateX(1.4 * s);
        g.add(fr);
      }
    } else {
      g.add(cyl(trunk, 0.25 * s, 0.35 * s, 2 * s, x, -0.7 + s, z, 6));
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.8 * s, 3.6 * s, 7), Math.random() > 0.5 ? leafA : leafB);
      c.position.set(x, -0.7 + 3.4 * s, z);
      c.castShadow = true;
      g.add(c);
    }
  }

  // a ponte
  const deckTex = canvasTexture(512, 256, stoneTiles('#c9b79a', 'rgba(70,55,40,0.35)'), [L / 4, 2.4]);
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.95 });
  const deck = box(deckMat, L * 2 + 4, 1.2, W * 2 + 1.6, 0, -0.6, 0, false);
  g.add(deck);
  const sideMat = new THREE.MeshStandardMaterial({ color: '#9c8a70', roughness: 1, flatShading: true });
  const wallMat = new THREE.MeshStandardMaterial({ color: '#b5a387', roughness: 0.9, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: '#d8c8a8', roughness: 0.9, flatShading: true });
  for (const side of [-1, 1]) {
    g.add(box(wallMat, L * 2 + 4, 0.9, 0.5, 0, 0.45, side * (W + 0.55)));
    g.add(box(capMat, L * 2 + 4, 0.15, 0.7, 0, 0.95, side * (W + 0.55)));
  }
  for (let x = -L + 6; x <= L - 6; x += 12) {
    const pier = box(sideMat, 2.6, 6, W * 2 + 1, x, -3.6, 0, false);
    g.add(pier);
    for (const side of [-1, 1]) {
      const post = box(capMat, 0.7, 1.6, 0.7, x, 0.8, side * (W + 0.55));
      g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe3a3', toneMapped: false }));
      lamp.position.set(x, 1.8, side * (W + 0.55));
      g.add(lamp);
    }
  }
  // faixa central e metade de cada time
  for (let t = 0; t < 2; t++) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(L - 2, W * 2),
      new THREE.MeshBasicMaterial({ color: TEAMS[t].color, transparent: true, opacity: 0.05, depthWrite: false }),
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set((t === 0 ? -1 : 1) * (L / 2 + 1), 0.01, 0);
    g.add(tint);
  }
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.35, W * 2), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.35, depthWrite: false }));
  mid.rotation.x = -Math.PI / 2;
  mid.position.y = 0.02;
  g.add(mid);

  // bases
  const plazaTex = canvasTexture(512, 512, stoneTiles('#bfae92', 'rgba(60,45,30,0.3)'), [6, 6]);
  const plazaMat = new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.95 });
  for (let t = 0; t < 2; t++) {
    const sx = t === 0 ? -1 : 1;
    const cx = sx * MAP.baseX;
    const plaza = cyl(plazaMat, MAP.baseR + 0.6, MAP.baseR + 1.5, 6, cx, -3, 0, 48);
    plaza.castShadow = false;
    g.add(plaza);
    const N = 44;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = cx + Math.cos(a) * (MAP.baseR + 0.5);
      const z = Math.sin(a) * (MAP.baseR + 0.5);
      if (Math.abs(z) < W + 1 && Math.sign(x - cx) === -sx) continue;
      const seg = box(wallMat, 2.6, 0.9, 0.5, x, 0.45, z);
      seg.rotation.y = -a + Math.PI / 2;
      g.add(seg);
    }
    // fonte
    const fx = sx * MAP.fountainX;
    const team = TEAMS[t].color;
    g.add(cyl(capMat, 4.4, 4.8, 0.4, fx, 0.2, 0, 32));
    const pool = cyl(new THREE.MeshStandardMaterial({ color: '#5ec8e0', roughness: 0.2, emissive: '#1b6f85', emissiveIntensity: 0.4 }), 3.6, 3.6, 0.1, fx, 0.42, 0, 32);
    g.add(pool);
    g.add(cyl(capMat, 0.7, 0.9, 2.2, fx, 1.1, 0, 12));
    const jet = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: 0.7, toneMapped: false }));
    jet.position.set(fx, 2.5, 0);
    g.add(jet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 48), new THREE.MeshBasicMaterial({ color: team, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(fx, 0.03, 0);
    g.add(ring);
    const light = new THREE.PointLight(team, 25, 18, 2);
    light.position.set(fx, 4, 0);
    g.add(light);
    // bandeiras
    for (const z of [-W - 0.5, W + 0.5]) {
      const bx = sx * (MAP.laneHalf - 2);
      g.add(box(capMat, 0.25, 4.5, 0.25, bx, 2.25, z));
      const flag = box(new THREE.MeshStandardMaterial({ color: team, side: THREE.DoubleSide, flatShading: true }), 1.6, 1.1, 0.06, bx - sx * 0.85, 3.8, z);
      g.add(flag);
    }
  }

  // pedras no caminho
  const rockMat = new THREE.MeshStandardMaterial({ color: '#8d8478', roughness: 1, flatShading: true });
  const mossMat = new THREE.MeshStandardMaterial({ color: '#5a7d3a', roughness: 1, flatShading: true });
  for (const o of OBSTACLES) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(o.r * 1.05, 0), rockMat);
    rock.position.set(o.x, o.r * 0.7, o.z);
    rock.scale.y = 1.2;
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
    const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(o.r * 0.7, 0), mossMat);
    moss.position.set(o.x, o.r * 1.45, o.z);
    moss.scale.y = 0.4;
    g.add(moss);
  }
  // moitas de capim nas bordas da ponte
  const bushes = BUSHES.map((b, i) => {
    const bush = new Bush(b.x, b.z, MAP.bush.rx, MAP.bush.rz, i + 1);
    g.add(bush.group);
    return bush;
  });
  return { water, bushes };
}
