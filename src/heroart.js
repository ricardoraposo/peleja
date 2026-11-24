// Formas orgânicas dos heróis, geradas em código: membros que afinam, mechas e caudas curvas,
// folhas e penas com volume, troncos de homem e de mulher e o rosto pintado numa textura.
import * as THREE from 'three';

const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

// Membro: topo em y = 0 descendo até -len, pontas redondas e a barriga do músculo um pouco acima do meio.
export function taper(rt, rb, len, bulge = 0.08) {
  return memo(`taper|${rt}|${rb}|${len}|${bulge}`, () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * rb), -len + rb - Math.cos(a) * rb));
    }
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const b = Math.sin(Math.pow(t, 0.8) * Math.PI) * (rt + rb) * bulge;
      pts.push(new THREE.Vector2(rb + (rt - rb) * t + b, -len + rb + (len - rb - rt) * t));
    }
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * rt), -rt + Math.sin(a) * rt));
    }
    return new THREE.LatheGeometry(pts, 16);
  });
}

// Perfil girado (lista de [raio, y]); base pra tronco, saia, copa de chapéu, vaso de fruta...
export function lathe(key, prof, seg = 28) {
  return memo(`lathe|${key}`, () => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), seg));
}

// Tubo que afina seguindo uma curva (mecha de cabelo, trança, cauda, antena, chifre).
export function strand(points, r0, r1, seg = 16, radial = 8) {
  const key = `strand|${points.map((p) => p.join(',')).join(';')}|${r0}|${r1}|${seg}|${radial}`;
  return memo(key, () => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const frames = curve.computeFrenetFrames(seg, false);
    const pos = [];
    const idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const p = curve.getPointAt(t);
      const r = Math.max(0.002, r0 + (r1 - r0) * t);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const c = Math.cos(a) * r;
        const s = Math.sin(a) * r;
        pos.push(p.x + N.x * c + B.x * s, p.y + N.y * c + B.y * s, p.z + N.z * c + B.z * s);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    // tampa a ponta grossa
    const p0 = curve.getPointAt(0);
    const c0 = pos.length / 3;
    pos.push(p0.x, p0.y, p0.z);
    for (let j = 0; j < radial; j++) idx.push(c0, j + 1, j);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

// Folha/pena/lâmina com volume: contorno em gota (comprimento em +y), espessura pequena e bisel.
export function leaf(len, wid, thick = 0.02, tipBias = 0.45, key = '') {
  return memo(`leaf|${len}|${wid}|${thick}|${tipBias}|${key}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(wid * 0.9, len * tipBias * 0.4, wid * 0.7, len * (tipBias + 0.2), 0, len);
    s.bezierCurveTo(-wid * 0.7, len * (tipBias + 0.2), -wid * 0.9, len * tipBias * 0.4, 0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.6, bevelSize: Math.min(wid, len) * 0.12, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -thick / 2);
    return g;
  });
}

// Lâmina de faca: costas retas, fio curvo e ponta
export function blade(len, wid, thick = 0.025) {
  return memo(`blade|${len}|${wid}|${thick}`, () => {
    const s = new THREE.Shape();
    s.moveTo(0, -wid * 0.4);
    s.lineTo(len * 0.75, -wid * 0.4);
    s.quadraticCurveTo(len, -wid * 0.35, len, wid * 0.5);
    s.quadraticCurveTo(len * 0.6, wid * 0.65, 0, wid * 0.6);
    s.lineTo(0, -wid * 0.4);
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.5, bevelSize: thick * 0.6, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -thick / 2);
    // comprimento ao longo de +z, como as outras armas
    g.rotateY(-Math.PI / 2);
    return g;
  });
}

// Anel (cinto, faixa de chapéu, pulseira)
export function ring(r, tube, key = '') {
  return memo(`ring|${r}|${tube}|${key}`, () => new THREE.TorusGeometry(r, tube, 10, 32));
}

// Rosto pintado numa textura que cobre a frente da cabeça (esfera: frente = u 0.25).
// Os olhos são 3D (pra piscar); aqui vão sobrancelha, cílios, sombra do olho, nariz, boca, bochecha e marcas.
const faceCache = new Map();
export function faceTexture(o) {
  const key = JSON.stringify(o);
  if (faceCache.has(key)) return faceCache.get(key);
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = o.skin;
  x.fillRect(0, 0, W, H);
  const cx = W * 0.25;
  const eyeY = H * 0.43;
  const sx = W / 512;
  const sh = (col, a) => {
    const k = new THREE.Color(col);
    return `rgba(${(k.r * 255) | 0},${(k.g * 255) | 0},${(k.b * 255) | 0},${a})`;
  };
  // sombra das órbitas e do queixo: dá volume sem luz extra
  const shade = new THREE.Color(o.skin).multiplyScalar(0.72).getStyle();
  x.globalAlpha = 0.35;
  for (const s of [-1, 1]) {
    const g = x.createRadialGradient(cx + s * 30 * sx, eyeY, 2, cx + s * 30 * sx, eyeY, 20 * sx);
    g.addColorStop(0, shade);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx + s * 30 * sx - 24, eyeY - 24, 48, 48);
  }
  x.globalAlpha = 1;
  // marcas e pinturas (antes de tudo, ficam por baixo)
  if (o.paint) {
    x.fillStyle = o.paint;
    for (const s of [-1, 1]) {
      x.save();
      x.translate(cx + s * 40 * sx, eyeY + 22);
      for (let i = 0; i < 3; i++) x.fillRect(-10 * sx, i * 7, 20 * sx, 3);
      x.restore();
    }
  }
  if (o.freckles) {
    x.fillStyle = sh('#7c3a1a', 0.45);
    for (let i = 0; i < 26; i++) {
      const s = i % 2 ? 1 : -1;
      x.beginPath();
      x.arc(cx + s * (14 + ((i * 37) % 30)), eyeY + 18 + ((i * 53) % 16), 1.3, 0, Math.PI * 2);
      x.fill();
    }
  }
  // bochecha
  if (o.blush) {
    for (const s of [-1, 1]) {
      const g = x.createRadialGradient(cx + s * 40 * sx, eyeY + 30, 1, cx + s * 40 * sx, eyeY + 30, 16 * sx);
      g.addColorStop(0, sh(o.blush, 0.55));
      g.addColorStop(1, sh(o.blush, 0));
      x.fillStyle = g;
      x.fillRect(cx + s * 40 * sx - 20, eyeY + 10, 40, 40);
    }
  }
  // sobrancelhas: finas e arqueadas nelas, grossas e retas neles
  x.strokeStyle = o.brow || '#2a1a10';
  x.lineCap = 'round';
  for (const s of [-1, 1]) {
    x.lineWidth = o.fem ? 3.2 : 6;
    x.beginPath();
    const bx = cx + s * 30 * sx;
    const by = eyeY - (o.fem ? 19 : 16);
    x.moveTo(bx - s * 12 * sx, by + (o.fem ? 4 : o.angry ? -2 : 2));
    x.quadraticCurveTo(bx + s * 2, by - (o.fem ? 6 : 2), bx + s * 14 * sx, by + (o.angry ? 6 : 3));
    x.stroke();
  }
  // cílios e delineado
  if (o.fem) {
    x.strokeStyle = '#1a0f0a';
    x.lineWidth = 2.4;
    for (const s of [-1, 1]) {
      const ex = cx + s * 30 * sx;
      x.beginPath();
      x.moveTo(ex - 11 * sx, eyeY - 2);
      x.quadraticCurveTo(ex, eyeY - 11, ex + s * 14 * sx, eyeY - 6);
      x.stroke();
      x.beginPath();
      x.moveTo(ex + s * 12 * sx, eyeY - 6);
      x.lineTo(ex + s * 17 * sx, eyeY - 10);
      x.stroke();
    }
    if (o.shadow) {
      for (const s of [-1, 1]) {
        const g = x.createRadialGradient(cx + s * 30 * sx, eyeY - 9, 1, cx + s * 30 * sx, eyeY - 9, 14 * sx);
        g.addColorStop(0, sh(o.shadow, 0.6));
        g.addColorStop(1, sh(o.shadow, 0));
        x.fillStyle = g;
        x.fillRect(cx + s * 30 * sx - 16, eyeY - 24, 32, 22);
      }
    }
  }
  // nariz: só a sombra das narinas, o volume é 3D
  x.fillStyle = sh('#000', 0.22);
  for (const s of [-1, 1]) {
    x.beginPath();
    x.ellipse(cx + s * 4, eyeY + 30, 2.6, 1.6, 0, 0, Math.PI * 2);
    x.fill();
  }
  // boca
  const my = eyeY + 46;
  if (o.fem) {
    x.fillStyle = o.lip || '#b0434b';
    x.beginPath();
    x.moveTo(cx - 13, my);
    x.quadraticCurveTo(cx - 6, my - 6, cx, my - 3);
    x.quadraticCurveTo(cx + 6, my - 6, cx + 13, my);
    x.quadraticCurveTo(cx, my + 9, cx - 13, my);
    x.fill();
    x.fillStyle = sh('#fff', 0.35);
    x.beginPath();
    x.ellipse(cx + 2, my + 3, 4, 1.4, 0, 0, Math.PI * 2);
    x.fill();
  } else {
    x.strokeStyle = o.lip || sh('#3a1a10', 0.75);
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(cx - 12, my);
    x.quadraticCurveTo(cx, my + (o.smirk ? 2 : 3), cx + 12, my - (o.smirk ? 4 : 0));
    x.stroke();
  }
  // barba/bigode
  if (o.beard) {
    x.fillStyle = o.beard;
    x.globalAlpha = o.stubble ? 0.35 : 1;
    x.beginPath();
    x.moveTo(cx - 34, eyeY + 20);
    x.quadraticCurveTo(cx - 30, my + 40, cx, my + 44);
    x.quadraticCurveTo(cx + 30, my + 40, cx + 34, eyeY + 20);
    x.quadraticCurveTo(cx + 20, my + 12, cx + 14, my - 4);
    x.quadraticCurveTo(cx, my - 10, cx - 14, my - 4);
    x.quadraticCurveTo(cx - 20, my + 12, cx - 34, eyeY + 20);
    x.fill();
    x.globalAlpha = 1;
  }
  if (o.mustache) {
    x.fillStyle = o.mustache;
    x.beginPath();
    x.moveTo(cx, my - 7);
    x.quadraticCurveTo(cx + 18, my - 12, cx + 20, my + 2);
    x.quadraticCurveTo(cx + 10, my - 4, cx, my - 2);
    x.quadraticCurveTo(cx - 10, my - 4, cx - 20, my + 2);
    x.quadraticCurveTo(cx - 18, my - 12, cx, my - 7);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

// Textura de pano com listras ou padrão (pra poncho, saia, faixa): cor base + desenho na cor de destaque
const clothCache = new Map();
export function clothTexture(base, accent, kind = 'stripes', rep = 1) {
  const key = `${base}|${accent}|${kind}|${rep}`;
  if (clothCache.has(key)) return clothCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = accent;
  if (kind === 'stripes') {
    for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 6, 128, 6);
    x.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 15, 128, 2);
  } else if (kind === 'zigzag') {
    x.lineWidth = 5;
    x.strokeStyle = accent;
    for (const y of [24, 88]) {
      x.beginPath();
      for (let i = 0; i <= 8; i++) x.lineTo(i * 16, y + (i % 2 ? -10 : 10));
      x.stroke();
    }
    for (let i = 0; i < 8; i++) x.fillRect(i * 16 + 6, 54, 4, 4);
  } else if (kind === 'scales') {
    x.strokeStyle = accent;
    x.lineWidth = 2;
    for (let r = 0; r < 9; r++) {
      for (let i = 0; i < 9; i++) {
        x.beginPath();
        x.arc(i * 16 + (r % 2) * 8, r * 16, 9, 0.1 * Math.PI, 0.9 * Math.PI);
        x.stroke();
      }
    }
  } else if (kind === 'weave') {
    x.globalAlpha = 0.35;
    for (let i = 0; i < 128; i += 4) {
      x.fillRect(i, 0, 1, 128);
      x.fillRect(0, i, 128, 1);
    }
  }
  // granulado leve, pra não parecer plástico
  const d = x.getImageData(0, 0, 128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  clothCache.set(key, t);
  return t;
}

// Cabeça: esfera esculpida. Nuca mais cheia, maçãs do rosto, e o queixo afina:
// nelas fino e delicado, neles mandíbula larga e queixo pra frente.
export function headGeo(fem) {
  return memo(`head|${fem}`, () => {
    const g = new THREE.SphereGeometry(1, 40, 30);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      if (y < 0) {
        const t = -y;
        x *= 1 - (fem ? 0.42 : 0.2) * t * t;
        z *= 1 - (fem ? 0.18 : 0.06) * t * t;
        if (z > 0) z += (fem ? 0.03 : 0.08) * t * t;
        y *= fem ? 1.1 : 1.02;
      }
      if (z < 0 && y > -0.3) z *= 1.1;
      // têmporas um pouco achatadas
      if (y > 0.1) x *= 1 - 0.05 * y;
      p.setXYZ(i, x * 0.96, y, z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Coluna de cacto com gomos (raio varia com o ângulo), topo arredondado. Base em y = 0.
export function ribbed(r, h, ribs = 8, depth = 0.12) {
  return memo(`ribbed|${r}|${h}|${ribs}|${depth}`, () => {
    const g = new THREE.CylinderGeometry(1, 1, 1, ribs * 6, 8, false);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      let y = p.getY(i) + 0.5;
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const len = Math.hypot(x, z);
      let k = (1 - depth + depth * Math.abs(Math.cos((a * ribs) / 2))) * r;
      // topo em cúpula
      const top = y > 0.85 ? Math.sqrt(Math.max(0, 1 - ((y - 0.85) / 0.15) ** 2)) : 1;
      k *= top;
      if (y >= 1 && len < 0.01) k = 0;
      p.setXYZ(i, len > 0.001 ? (x / len) * k * Math.min(1, len) : 0, y * h, len > 0.001 ? (z / len) * k * Math.min(1, len) : 0);
    }
    g.computeVertexNormals();
    return g;
  });
}
