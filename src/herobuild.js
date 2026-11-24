// Montagem dos heróis: corpo (de homem ou de mulher), rosto, roupa, chapéu e arma de cada um.
// O modelo olha pra +z. A cabeça é um grupo próprio: centro em (0, 0.13, 0), topo em y = 0.32, rosto em z = 0.18.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blade, clothTexture, faceTexture, headGeo, lathe, leaf, ribbed, ring, strand, taper } from './heroart.js';

const SPHERE = new THREE.SphereGeometry(1, 24, 16);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
const CONE = new THREE.ConeGeometry(1, 1, 16);
const CAP = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
// gota de fogo: base redonda e ponta fina
const FLAME = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = t < 0.38 ? Math.sin((t / 0.38) * Math.PI * 0.5) : Math.pow(1 - (t - 0.38) / 0.62, 1.4);
    pts.push(new THREE.Vector2(Math.max(0.001, r), -1 + t * 2));
  }
  return new THREE.LatheGeometry(pts, 16);
})();

const boxCache = new Map();
function rbox(w, h, d, round = 0.3) {
  const key = `${w}|${h}|${d}|${round}`;
  if (!boxCache.has(key)) boxCache.set(key, new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * round));
  return boxCache.get(key);
}

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }));
  return matCache.get(key);
}
function glowMat(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
}

// peça: geometria, material, posição, escala e rotação
function M(geo, m, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(p[0], p[1], p[2]);
  if (typeof s === 'number') o.scale.setScalar(s);
  else o.scale.set(s[0], s[1], s[2]);
  o.rotation.set(r[0], r[1], r[2]);
  o.castShadow = !(m.isMeshBasicMaterial);
  return o;
}
const box = (w, h, d, m, p, r, round) => M(rbox(w, h, d, round), m, p, 1, r);
const ball = (rx, ry, rz, m, p, r) => M(SPHERE, m, p, [rx, ry, rz], r);
const glow = (o) => {
  o.castShadow = false;
  return o;
};

// cor por herói (pela peça de cabeça, que é única): cabelo, calça, olho e detalhes do rosto
const STYLE = {
  visor: { hair: '#b4410f', pants: '#3b2a1e', iris: '#6b3f1d', face: { blush: '#e8806a', lip: '#b5473a', shadow: '#ff6b35', freckles: true } },
  helm: { pants: '#2a2d3a', iris: '#4a3a2a', face: { beard: '#3b2416', angry: true } },
  tufts: { hair: '#17302d', pants: '#2c3836', iris: '#e59a1a', face: { lip: '#9c4a4a', shadow: '#14b8a6' } },
  antennae: { hair: '#121212', pants: '#161616', iris: '#2a1a10', face: { lip: '#7c2d12', shadow: '#ca8a04' } },
  spikes: { creature: true },
  hair: { hair: '#1e3a8a', iris: '#2563eb', face: { lip: '#c2416b', shadow: '#60a5fa', blush: '#f9a8d4' } },
  flame: { iris: '#ec4899', glowEyes: true, face: { brow: '#5b1236', paint: '#ec4899', angry: true } },
  cap: { pants: '#b91c1c', iris: '#2a1a10', face: { smirk: true, brow: '#120a06' } },
  gator: { creature: true },
  firehair: { pants: '#3f6212', iris: '#65a30d', face: { paint: '#ff4d1a', angry: true, brow: '#7c2d12' } },
  cocar: { hair: '#c026d3', pants: '#7c4a21', iris: '#2a1a10', face: { lip: '#8b3a3a', paint: '#dc2626', blush: '#c2410c' } },
  braids: { hair: '#151312', iris: '#2a1a10', face: { lip: '#a3434b', blush: '#d97757' } },
  crest: { creature: true },
  panama: { pants: '#f8fafc', iris: '#2a1a10', face: { mustache: '#120a06', smirk: true, brow: '#120a06' } },
  boater: { creature: true, pants: '#f8fafc' },
};

// ---------------------------------------------------------------- corpo

export function buildHero(H, def, look) {
  const fem = !!look.fem;
  const wide = look.bulk || 1;
  const st = STYLE[look.hat] || {};
  const color = def.color;
  const skinC = look.skin || (look.oneLeg ? '#5b3a29' : '#e8b48a');
  const mats = {
    main: new THREE.MeshStandardMaterial({ color: look.suit || look.body || color, roughness: 0.65 }),
    dark: new THREE.MeshStandardMaterial({ color: st.pants || '#2a2d3a', roughness: 0.85 }),
    skin: new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.6 }),
    metal: mat('#5b6470', { metalness: 0.7, roughness: 0.35 }),
    wood: mat('#7c5a3a', { roughness: 0.85 }),
    accent: mat(color, { roughness: 0.5 }),
    hair: mat(st.hair || '#2a1a10', { roughness: 0.55 }),
  };
  H.mats = mats;
  H.flashMats = [mats.main, mats.dark, mats.skin];
  const ctx = { H, def, look, fem, wide, st, color, mats };

  H.hips = new THREE.Group();
  H.hips.position.y = 0.8;
  H.body.add(H.hips);
  H.legL = new THREE.Group();
  H.legR = new THREE.Group();
  H.shins = [];
  H.torso = new THREE.Group();
  H.hips.add(H.torso);
  H.head = new THREE.Group();
  H.head.position.y = 0.7;
  H.head.scale.setScalar(0.8);
  H.torso.add(H.head);
  H.hat = new THREE.Group();
  H.head.add(H.hat);
  H.eyes = [];
  H.glows = [];
  H.armR = new THREE.Group();
  H.armL = new THREE.Group();
  H.torso.add(H.armR, H.armL);

  const outfit = OUTFIT[look.hat] || OUTFIT.default;
  const o = outfit.body ? outfit.body(ctx) : {};
  ctx.o = o;
  H.flashMats = [mats.main, mats.dark, mats.skin];
  legs(ctx, o);
  torso(ctx, o);
  if (!st.creature) humanHead(ctx, o);
  arms(ctx, o);
  outfit.dress(ctx);
  wield(ctx);
  if (look.pipe) {
    // cachimbo de barro no canto da boca
    const pipe = new THREE.Group();
    pipe.add(M(strand([[0, 0, 0], [0.02, -0.02, 0.08], [0.04, -0.01, 0.15]], 0.012, 0.012, 6, 6), mats.wood));
    pipe.add(M(lathe('pipe', [[0.001, -0.03], [0.035, -0.03], [0.04, 0.02], [0.034, 0.05], [0.025, 0.05], [0.025, -0.01], [0.001, -0.01]], 14), mat('#a0522d'), [0.04, 0, 0.16]));
    pipe.position.set(0.05, 0.06, 0.15);
    H.head.add(pipe);
  }
  H.weaponBase = H.weapon ? H.weapon.rotation.x : 0;
  for (const g of H.glows) g.userData.base = g.scale.clone();
}

function legs(ctx, o) {
  const { H, look, fem, wide, mats } = ctx;
  if (look.robe) return;
  const legM = o.legMat || mats.dark;
  const shoe = o.shoeMat || mat('#3b2a1e', { roughness: 0.6 });
  const lk = o.legK || 1;
  const thighR = (fem ? [0.1, 0.064] : [0.1 * wide, 0.072 * wide]).map((v) => v * lk);
  const shinR = (fem ? [0.066, 0.042] : [0.074 * wide, 0.05 * wide]).map((v) => v * (o.shinK || lk));
  const make = (leg) => {
    leg.add(M(taper(thighR[0], thighR[1], 0.44, fem ? 0.06 : 0.04), legM, [0, 0.03, 0]));
    const shin = new THREE.Group();
    shin.position.y = -0.41;
    leg.add(shin);
    H.shins.push(shin);
    shin.add(ball(shinR[0] * 1.05, shinR[0] * 1.1, shinR[0] * 1.05, legM, [0, 0, 0]));
    shin.add(M(taper(shinR[0], shinR[1], 0.34, 0.1), o.shinMat || legM, [0, 0.02, 0]));
    if (look.backFeet) {
      // pés virados pra trás
      shin.add(box(0.11, 0.07, 0.24, mats.skin, [0, -0.35, -0.08]));
      for (const x of [-0.035, 0, 0.035]) shin.add(ball(0.022, 0.02, 0.03, mats.skin, [x, -0.36, -0.21]));
    } else if (o.bareFeet) {
      shin.add(box(0.1, 0.065, 0.22, mats.skin, [0, -0.355, 0.05]));
      for (const x of [-0.03, 0, 0.03]) shin.add(ball(0.018, 0.016, 0.02, mats.skin, [x, -0.36, 0.16]));
    } else if (o.talons) {
      // pé de bicho: três dedos com garra
      for (const a of [-0.45, 0, 0.45]) {
        shin.add(M(strand([[0, -0.33, 0], [Math.sin(a) * 0.08, -0.36, Math.cos(a) * 0.1], [Math.sin(a) * 0.13, -0.37, Math.cos(a) * 0.16]], 0.025, 0.008, 6, 6), o.talonMat || mats.skin));
      }
      shin.add(ball(0.05, 0.035, 0.05, o.talonMat || mats.skin, [0, -0.34, 0]));
    } else {
      // bota: cano até a canela e pé com bico arredondado
      if (o.bootCuff !== false) shin.add(M(taper(shinR[0] * 1.18, shinR[1] * 1.25, 0.2, 0), o.cuffMat || shoe, [0, -0.15, 0]));
      shin.add(box(fem ? 0.095 : 0.12 * wide, 0.075, fem ? 0.22 : 0.25, shoe, [0, -0.36, 0.045], [0, 0, 0], 0.45));
      shin.add(ball(fem ? 0.048 : 0.06 * wide, 0.04, 0.05, shoe, [0, -0.36, fem ? 0.13 : 0.15]));
      if (o.toeMat) shin.add(ball(fem ? 0.05 : 0.062 * wide, 0.042, 0.04, o.toeMat, [0, -0.358, fem ? 0.14 : 0.165]));
    }
  };
  if (look.oneLeg) {
    make(H.legL);
    H.hips.add(H.legL);
    H.oneLeg = true;
    return;
  }
  const lx = fem ? 0.095 : 0.105 * wide;
  H.legL.position.x = -lx;
  H.legR.position.x = lx;
  make(H.legL);
  make(H.legR);
  H.hips.add(H.legL, H.legR);
}

function torso(ctx, o) {
  const { H, fem, wide, mats } = ctx;
  const m = o.torsoMat || mats.main;
  if (o.torso !== false) {
    H.torso.add(M(o.torsoGeo || torsoGeo(fem), m, [0, 0, 0], [wide, 1, 0.64 * wide]));
    if (fem && o.bust !== false) {
      const bm = o.bustMat || (m.map ? mat('#' + m.color.getHexString()) : m);
      for (const s of [-1, 1]) H.torso.add(ball(0.072, 0.066, 0.06, bm, [s * 0.068, 0.41, 0.062], [0.2, 0, 0]));
    }
  }
  // pescoço
  if (o.neck !== false) H.torso.add(M(taper(fem ? 0.05 : 0.065 * wide, fem ? 0.058 : 0.075 * wide, 0.14, 0), mats.skin, [0, 0.76, 0.005]));
  if (o.belt !== false && !ctx.look.robe) {
    const br = (fem ? 0.214 : 0.197) * wide;
    H.torso.add(M(ring(1, 0.12), o.beltMat || mat('#3b2416', { roughness: 0.6 }), [0, 0.06, 0], [br, br * 0.64, 0.35], [Math.PI / 2, 0, 0]));
    H.torso.add(box(0.075, 0.06, 0.03, mat('#d4a62a', { metalness: 0.8, roughness: 0.3 }), [0, 0.06, 0.135 * wide]));
  }
  if (ctx.look.robe) {
    // vestido em sino até o chão
    H.robe = new THREE.Group();
    const skirt = M(lathe('robe', [[0.19, 0.06], [0.205, -0.04], [0.225, -0.25], [0.27, -0.5], [0.32, -0.72], [0.34, -0.8], [0.001, -0.8]]), o.robeMat || mats.main, [0, 0, 0], [wide, 1, 0.82 * wide]);
    H.robe.add(skirt);
    H.hips.add(H.robe);
  }
}

function torsoGeo(fem) {
  return fem
    ? lathe('torso-f', [[0.001, -0.03], [0.17, -0.02], [0.212, 0.05], [0.2, 0.13], [0.152, 0.24], [0.152, 0.32], [0.175, 0.4], [0.188, 0.47], [0.18, 0.54], [0.145, 0.59], [0.085, 0.63], [0.05, 0.645], [0.001, 0.65]])
    : lathe('torso-m', [[0.001, -0.02], [0.168, -0.01], [0.192, 0.05], [0.182, 0.14], [0.172, 0.22], [0.195, 0.33], [0.232, 0.44], [0.24, 0.52], [0.21, 0.58], [0.13, 0.62], [0.06, 0.64], [0.001, 0.645]]);
}

function humanHead(ctx, o) {
  const { H, fem, mats, st } = ctx;
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture({ skin: '#' + mats.skin.color.getHexString(), fem, ...(st.face || {}) }), roughness: 0.6 });
  H.flashMats.push(faceMat);
  H.head.add(M(headGeo(fem), faceMat, [0, 0.13, 0], [0.165, 0.19, 0.18]));
  // nariz
  H.head.add(M(taper(fem ? 0.016 : 0.022, fem ? 0.026 : 0.034, fem ? 0.07 : 0.085, 0.05), mats.skin, [0, 0.165, 0.168], 1, [-0.32, 0, 0]));
  // orelhas
  if (o.ears !== false) for (const s of [-1, 1]) H.head.add(ball(0.022, 0.045, 0.035, mats.skin, [s * 0.158, 0.135, -0.005], [0, s * 0.4, 0]));
  eyes(ctx, 0.062, 0.172, 0.15, st.iris, fem);
}

// olhos 3D: branco amendoado, íris, pupila e brilho; o grupo achata pra piscar
function eyes(ctx, x, y, z, iris = '#3a2a1a', fem = false, size = 1) {
  const { H, st } = ctx;
  const white = mat('#f4f1ea', { roughness: 0.25 });
  const irisM = st.glowEyes ? glowMat(iris, 1) : mat(iris, { roughness: 0.2 });
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * x, y, z);
    e.rotation.y = s * 0.28;
    e.add(glow(ball(0.03 * size, (fem ? 0.019 : 0.016) * size, 0.014 * size, white, [0, 0, 0])));
    e.add(glow(ball(0.0145 * size, 0.0145 * size, 0.008 * size, irisM, [0, 0, 0.008 * size])));
    e.add(glow(ball(0.007 * size, 0.007 * size, 0.004 * size, mat('#0b0b0b'), [0, 0, 0.0145 * size])));
    e.add(glow(ball(0.0035 * size, 0.0035 * size, 0.002 * size, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), [0.005 * size, 0.005 * size, 0.017 * size])));
    H.head.add(e);
    H.eyes.push(e);
  }
}

function arms(ctx, o) {
  const { H, fem, wide, mats } = ctx;
  const ax = fem ? 0.2 : 0.25 * wide;
  H.armR.position.set(ax, fem ? 0.53 : 0.54, 0);
  H.armL.position.set(-ax, fem ? 0.53 : 0.54, 0);
  const upM = o.upperMat || mats.main;
  const foreM = o.foreMat || o.upperMat || mats.main;
  const up = fem ? [0.052, 0.04] : [0.066 * wide, 0.05 * wide];
  const lo = fem ? [0.042, 0.031] : [0.052 * wide, 0.04 * wide];
  H.fores = [H.armR, H.armL].map((arm, i) => {
    arm.add(ball(up[0] * 1.08, up[0] * 1.1, up[0] * 1.08, o.shoulderMat || upM, [0, -0.02, 0]));
    arm.add(M(taper(up[0], up[1], 0.29, 0.06), upM, [0, 0.02, 0]));
    const fore = new THREE.Group();
    fore.position.y = -0.27;
    arm.add(fore);
    fore.add(ball(lo[0] * 1.05, lo[0] * 1.1, lo[0] * 1.05, foreM, [0, 0, 0]));
    fore.add(M(taper(lo[0], lo[1], 0.22, 0.1), foreM, [0, 0.02, 0]));
    if (o.cuffMat) fore.add(M(taper(lo[1] * 1.35, lo[1] * 1.3, 0.07, 0), o.cuffMat, [0, -0.13, 0]));
    if (!o.ownHands) {
      // mão fechada, polegar por cima
      const hm = o.handMat || mats.skin;
      fore.add(box(fem ? 0.062 : 0.074 * wide, fem ? 0.085 : 0.095, fem ? 0.07 : 0.082, hm, [0, -0.245, 0.008], [0, 0, 0], 0.4));
      fore.add(ball(fem ? 0.018 : 0.022, fem ? 0.03 : 0.035, fem ? 0.018 : 0.022, hm, [(i ? -1 : 1) * (fem ? 0.024 : 0.03), -0.22, 0.04], [0.4, 0, 0]));
    }
    return fore;
  });
}

// ---------------------------------------------------------------- armas

function hold(fore, g) {
  g.position.set(0, -0.25, 0.01);
  if (g.userData.along) g.rotation.x = Math.PI / 2;
  fore.add(g);
  return g;
}

function wield(ctx) {
  const { H, look, color, mats } = ctx;
  const w = look.weapon;
  const [foreR, foreL] = H.fores;
  if (w === 'bow') H.bow = hold(foreL, weapon('bow', ctx));
  else if (w === 'stingers') {
    H.weapon = hold(foreR, weapon('stingers', ctx));
    hold(foreL, weapon('stingers', ctx));
  } else if (w === 'shield') H.weapon = hold(foreR, weapon('club', ctx));
  else if (w === 'hands') {
    for (const f of H.fores) {
      const fl = glow(M(FLAME, glowMat(color, 0.9), [0, -0.33, 0.04], [0.07, 0.12, 0.07]));
      const core = glow(M(FLAME, glowMat('#ffe0f0', 0.95), [0, -0.32, 0.04], [0.035, 0.07, 0.035]));
      f.add(fl, core);
      H.glows.push(fl);
    }
  } else if (w === 'coco') {
    const coco = new THREE.Group();
    coco.add(ball(0.095, 0.09, 0.095, mat('#6b4423', { roughness: 0.95 }), [0, 0, 0]));
    for (let i = 0; i < 3; i++) coco.add(ball(0.014, 0.014, 0.006, mat('#2b1a0e'), [Math.cos(i * 2.1) * 0.03, 0.075, 0.03 + Math.sin(i * 2.1) * 0.03]));
    coco.position.set(0, -0.32, 0.05);
    foreR.add(coco);
    const spark = glow(ball(0.035, 0.035, 0.035, glowMat(color, 0.85), [0.07, -0.28, 0.1]));
    foreR.add(spark);
    H.glows.push(spark);
  } else if (w === 'pearl') {
    const pearl = glow(ball(0.065, 0.065, 0.065, glowMat('#fff1f5', 0.95), [0, -0.32, 0.05]));
    const halo = glow(ball(0.095, 0.095, 0.095, glowMat(color, 0.25), [0, -0.32, 0.05]));
    foreR.add(pearl, halo);
    H.glows.push(pearl, halo);
  } else if (w && w !== 'none' && w !== 'claws' && w !== 'braid') {
    H.weapon = hold(foreR, weapon(w, ctx));
    if (H.weapon.userData.orb) H.glows.push(H.weapon.userData.orb);
    H.torchFlame = H.weapon.userData.flame || null;
  }
}

// Por padrão a arma sai perpendicular ao antebraço (martelo, espada, cajado);
// `along` alinha com ele (pistola e adagas).
function weapon(kind, ctx) {
  const { color, mats } = ctx;
  const g = new THREE.Group();
  const steel = mat('#d9dee6', { metalness: 0.85, roughness: 0.22 });
  const brass = mat('#c9a14a', { metalness: 0.85, roughness: 0.3 });
  const leather = mat('#4a2c17', { roughness: 0.8 });
  if (kind === 'pistol') {
    // garrucha: coronha curva de madeira, cano comprido com aros de latão e boca larga
    g.add(M(strand([[0, 0.02, 0.02], [0, -0.06, -0.01], [0, -0.14, -0.05]], 0.042, 0.05, 8, 10), mats.wood));
    g.add(ball(0.05, 0.035, 0.06, mats.wood, [0, -0.15, -0.06]));
    g.add(box(0.06, 0.07, 0.14, mats.wood, [0, 0.04, 0.05]));
    g.add(M(CYL, mat('#3a3f47', { metalness: 0.8, roughness: 0.3 }), [0, 0.05, 0.3], [0.032, 0.42, 0.032], [Math.PI / 2, 0, 0]));
    for (const z of [0.16, 0.32, 0.47]) g.add(M(ring(1, 0.25), brass, [0, 0.05, z], [0.036, 0.036, 0.036]));
    g.add(M(lathe('muzzle', [[0.03, 0], [0.05, 0.02], [0.055, 0.06], [0.04, 0.06], [0.03, 0.02]], 16), brass, [0, 0.05, 0.5], 1, [Math.PI / 2, 0, 0]));
    g.add(glow(M(CYL, glowMat(color, 0.95), [0, 0.05, 0.565], [0.03, 0.01, 0.03], [Math.PI / 2, 0, 0])));
    g.add(M(strand([[0, -0.01, 0.06], [0, -0.05, 0.08], [0, -0.03, 0.12]], 0.008, 0.008, 6, 5), brass));
    g.userData.along = true;
  } else if (kind === 'hammer') {
    // marretão: cabo encourado, cabeça de ferro com aros e o raio brilhando no meio
    g.add(M(CYL, mats.wood, [0, 0, 0.45], [0.04, 1.3, 0.04], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 5; i++) g.add(M(ring(1, 0.3), leather, [0, 0, -0.1 + i * 0.07], [0.045, 0.045, 0.045]));
    g.add(ball(0.06, 0.06, 0.06, mats.metal, [0, 0, -0.22]));
    const head = new THREE.Group();
    head.position.set(0, 0, 1.08);
    head.add(M(CYL, mat('#3d434c', { metalness: 0.8, roughness: 0.35 }), [0, 0, 0], [0.22, 0.62, 0.22], [0, 0, Math.PI / 2]));
    for (const x of [-0.31, 0.31]) head.add(M(CYL, mats.metal, [x, 0, 0], [0.24, 0.06, 0.24], [0, 0, Math.PI / 2]));
    for (const x of [-0.17, 0.17]) head.add(M(ring(1, 0.12), mats.accent, [x, 0, 0], [0.225, 0.225, 0.225], [0, Math.PI / 2, 0]));
    head.add(glow(M(ring(1, 0.1), glowMat(color, 0.95), [0, 0, 0], [0.228, 0.228, 0.228], [0, Math.PI / 2, 0])));
    const bolt = new THREE.Shape([[-0.05, 0.12], [0.03, 0.02], [-0.01, 0.02], [0.05, -0.12], [-0.03, -0.01], [0.01, -0.01]].map(([x, y]) => new THREE.Vector2(x, y)));
    const boltGeo = new THREE.ExtrudeGeometry(bolt, { depth: 0.01, bevelEnabled: false });
    head.add(glow(M(boltGeo, glowMat('#e9d5ff', 1), [0, 0, 0.225])));
    head.add(glow(M(boltGeo, glowMat('#e9d5ff', 1), [0, 0, -0.235])));
    g.add(head);
  } else if (kind === 'bow') {
    // arco recurvo: braços curvos de madeira, empunhadura de couro, pontas brilhando.
    // Fica "de pé" quando o braço esquerdo aponta pra frente; as pontas da corda ficam em (0, 0.22, ±0.9)
    for (const s of [-1, 1]) {
      g.add(M(strand([[0, 0, 0], [0, -0.04, s * 0.3], [0, 0.03, s * 0.62], [0, 0.15, s * 0.82], [0, 0.22, s * 0.9]], 0.034, 0.014, 16, 8), mats.wood));
      g.add(glow(M(leaf(0.14, 0.04, 0.01), glowMat(color, 0.95), [0, 0.2, s * 0.88], 1, [s * -0.9, 0, 0])));
    }
    g.add(M(taper(0.04, 0.04, 0.16, 0), leather, [0, 0, 0.08], 1, [Math.PI / 2, 0, 0]));
    const sMat = mat('#f8fafc');
    const strings = [-1, 1].map(() => {
      const m = new THREE.Mesh(CYL, sMat);
      g.add(m);
      return m;
    });
    const arrow = new THREE.Group();
    arrow.add(M(CYL, mats.wood, [0, -0.47, 0], [0.014, 0.95, 0.014]));
    arrow.add(glow(M(CONE, glowMat(color, 1), [0, -0.98, 0], [0.03, 0.09, 0.03], [Math.PI, 0, 0])));
    for (let i = 0; i < 3; i++) arrow.add(M(leaf(0.12, 0.03, 0.004), mat('#f8fafc'), [0, -0.02, 0], 1, [0, (i * Math.PI * 2) / 3, Math.PI]));
    g.add(arrow);
    // puxa a corda: 0 = solta, 1 = toda esticada
    g.userData.setPull = (p) => {
      const ny = 0.22 + p * 0.5;
      const dy = p * 0.5;
      const len = Math.hypot(dy, 0.9);
      strings.forEach((m, i) => {
        const s = i ? 1 : -1;
        m.scale.set(0.007, len, 0.007);
        m.position.set(0, 0.22 + dy / 2, s * 0.45);
        m.rotation.set(Math.PI / 2 + s * Math.asin(dy / len), 0, 0);
      });
      arrow.visible = p > 0.04;
      arrow.position.set(0, ny, 0);
    };
    g.userData.setPull(0);
  } else if (kind === 'cane') {
    // bengala preta envernizada, castão dourado e ponteira
    g.add(M(CYL, mat('#141414', { roughness: 0.25, metalness: 0.3 }), [0, 0, 0.3], [0.022, 0.95, 0.022], [Math.PI / 2, 0, 0]));
    g.add(M(CYL, brass, [0, 0, 0.78], [0.026, 0.04, 0.026], [Math.PI / 2, 0, 0]));
    g.add(M(ring(1, 0.3), brass, [0, 0, -0.12], [0.03, 0.03, 0.03]));
    const knob = glow(ball(0.05, 0.05, 0.05, glowMat('#fbbf24', 0.95), [0, 0, -0.19]));
    g.add(knob);
    g.add(ball(0.052, 0.03, 0.052, brass, [0, -0.01, -0.19]));
    g.userData.orb = knob;
  } else if (kind === 'stingers') {
    // ferrão-punhal: lâmina amarela com fio preto, cabo listrado
    g.add(M(taper(0.026, 0.026, 0.14, 0), mat('#161616'), [0, 0, -0.05], 1, [-Math.PI / 2, 0, 0]));
    for (const z of [-0.02, 0.04]) g.add(M(ring(1, 0.3), mats.accent, [0, 0, z], [0.028, 0.028, 0.028]));
    g.add(box(0.12, 0.03, 0.03, mats.accent, [0, 0, 0.1]));
    g.add(M(blade(0.5, 0.06, 0.012), mat('#fde047', { metalness: 0.5, roughness: 0.3 }), [0, 0, 0.11], 1, [0, 0, Math.PI / 2]));
    g.add(glow(M(CONE, glowMat(color, 0.9), [0, 0, 0.66], [0.012, 0.08, 0.012], [Math.PI / 2, 0, 0])));
    g.userData.along = true;
  } else if (kind === 'club') {
    // clava de cacto com gomos e espinhos, cabo de madeira e a flor rosa na ponta
    g.add(M(CYL, mats.wood, [0, 0, 0.12], [0.04, 0.42, 0.04], [Math.PI / 2, 0, 0]));
    const top = M(ribbed(0.13, 0.62, 7, 0.18), mat('#4d7c0f', { roughness: 0.75 }), [0, 0, 0.3], 1, [Math.PI / 2, 0, 0]);
    g.add(top);
    const thorn = mat('#f5f5dc');
    for (let i = 0; i < 14; i++) {
      const a = (i / 7) * Math.PI * 2;
      const z = 0.4 + (i % 4) * 0.12;
      g.add(M(CONE, thorn, [Math.cos(a) * 0.13, Math.sin(a) * 0.13, z], [0.01, 0.06, 0.01], [0, 0, a - Math.PI / 2]));
    }
    flower(g, [0, 0, 0.93], 0.09, [Math.PI / 2, 0, 0]);
  } else if (kind === 'staff') {
    // cajado de madeira de rio, retorcido, com corais e a bola d'água no alto
    g.add(M(strand([[0, -0.5, 0.06], [0.02, 0, 0.05], [-0.02, 0.5, 0.07], [0.01, 1.05, 0.06]], 0.03, 0.022, 16, 8), mat('#8a6a4a', { roughness: 0.9 })));
    for (const s of [-1, 1]) g.add(M(strand([[0, 1.02, 0.06], [s * 0.1, 1.15, 0.06], [s * 0.12, 1.3, 0.06], [s * 0.06, 1.42, 0.06]], 0.02, 0.008, 10, 6), mat('#fb7185', { roughness: 0.5 })));
    const orb = glow(ball(0.11, 0.11, 0.11, glowMat(color, 0.75), [0, 1.27, 0.06]));
    g.add(orb, glow(ball(0.06, 0.06, 0.06, glowMat('#e0f2fe', 0.95), [0, 1.27, 0.06])));
    g.add(M(ring(1, 0.3), mat('#f8fafc', { roughness: 0.2 }), [0, 1.02, 0.06], [0.04, 0.04, 0.04], [Math.PI / 2, 0, 0]));
    g.userData.orb = orb;
  } else if (kind === 'sword') {
    // peixeira: cabo de madeira com aros, lâmina larga de um gume
    g.add(M(taper(0.03, 0.026, 0.24, 0), mats.wood, [0, 0, -0.1], 1, [-Math.PI / 2, 0, 0]));
    for (const z of [-0.08, 0.03]) g.add(M(ring(1, 0.3), brass, [0, 0, z], [0.033, 0.033, 0.033]));
    g.add(box(0.03, 0.08, 0.04, brass, [0, 0, 0.14]));
    g.add(M(blade(0.85, 0.11, 0.01), steel, [0, -0.02, 0.15], 1, [0, 0, -Math.PI / 2]));
  } else if (kind === 'torch') {
    // tocha de pau torto, cabeça enrolada em palha e chama dupla
    g.add(M(strand([[0, 0, -0.15], [0.02, 0, 0.2], [-0.01, 0, 0.5]], 0.03, 0.026, 10, 8), mats.wood));
    g.add(M(lathe('torchhead', [[0.03, 0], [0.065, 0.03], [0.07, 0.12], [0.05, 0.16], [0.001, 0.16]], 14), mat('#a16207', { roughness: 1 }), [0, 0, 0.5], 1, [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 3; i++) g.add(M(ring(1, 0.15), mat('#3f2a14'), [0, 0, 0.53 + i * 0.045], [0.068, 0.068, 0.068]));
    const outer = glow(M(SPHERE, glowMat(color, 0.8), [0, 0, 0.74], [0.08, 0.08, 0.13]));
    const inner = glow(M(SPHERE, glowMat('#ffe08a', 0.95), [0, 0, 0.73], [0.045, 0.045, 0.18]));
    g.add(outer, inner);
    g.userData.orb = outer;
    g.userData.flame = inner;
  }
  return g;
}

// flor de cinco pétalas com miolo
function flower(parent, p, size, r = [0, 0, 0], petal = '#f472b6', core = '#fde047') {
  const f = new THREE.Group();
  f.position.set(p[0], p[1], p[2]);
  f.rotation.set(r[0], r[1], r[2]);
  for (let i = 0; i < 6; i++) f.add(M(leaf(size, size * 0.55, size * 0.08), mat(petal, { roughness: 0.5 }), [0, 0, 0], 1, [-Math.PI / 2 + 0.35, (i / 6) * Math.PI * 2, 0]));
  f.add(ball(size * 0.3, size * 0.2, size * 0.3, mat(core), [0, size * 0.12, 0]));
  parent.add(f);
  return f;
}


// ---------------------------------------------------------------- roupas e chapéus
// cada herói: body(ctx) devolve opções do corpo; dress(ctx) veste e põe o chapéu

const OUTFIT = {};
OUTFIT.default = { dress() {} };

// ---- peças comuns de cabelo e roupa

// calota de cabelo: cobre topo e nuca, inclinada pra deixar a testa livre
function hairCap(ctx, m = ctx.mats.hair, tilt = 0.45, k = 1) {
  ctx.H.head.add(M(CAP, m, [0, 0.13, -0.008], [0.176 * k, 0.21 * k, 0.196 * k], [-tilt, 0, 0]));
}
// mecha: lista de pontos na cabeça descendo
function lock(ctx, pts, r0, r1, m = ctx.mats.hair, parent = ctx.H.head) {
  parent.add(M(strand(pts, r0, r1, 14, 8), m));
}
// tecido com padrão (material próprio por herói)
function cloth(base, accent, kind, rep = 1, opts = {}) {
  return new THREE.MeshStandardMaterial({ map: clothTexture(base, accent, kind, rep), roughness: 0.8, ...opts });
}
// saiote de tiras (palha, folha, couro) em volta do quadril
function skirtStrips(parent, n, r, y, len, mats, geoFn, tilt = 0.18) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * r, y, Math.cos(a) * r * 0.8);
    g.rotation.set(0, a, 0);
    const m = M(geoFn(i), mats[i % mats.length], [0, 0, 0], 1, [Math.PI + tilt, 0, 0]);
    g.add(m);
    parent.add(g);
  }
}

// ---- Faísca: pistoleira do sertão. Chapéu de couro com óculos na aba, rabo de cavalo ruivo,
// capinha de poncho em zigue-zague, cartucheira atravessada e coldre
OUTFIT.visor = {
  body: ({ mats }) => ({ cuffMat: mat('#5a3418'), shoeMat: mat('#5a3418', { roughness: 0.6 }), toeMat: mat('#3b2213') }),
  dress(ctx) {
    const { H, mats, color } = ctx;
    hairCap(ctx);
    lock(ctx, [[0, 0.24, -0.14], [0, 0.18, -0.26], [0, 0.02, -0.3], [0.02, -0.18, -0.27], [0.04, -0.32, -0.2]], 0.065, 0.015);
    H.head.add(M(ring(1, 0.3), mats.accent, [0, 0.22, -0.2], [0.04, 0.04, 0.04], [0.5, 0, 0]));
    for (const s of [-1, 1]) lock(ctx, [[s * 0.13, 0.24, 0.1], [s * 0.165, 0.12, 0.1], [s * 0.15, 0.0, 0.08]], 0.03, 0.01);
    lock(ctx, [[-0.08, 0.3, 0.12], [0.0, 0.27, 0.17], [0.07, 0.22, 0.17]], 0.03, 0.012);
    // chapéu
    const hat = H.hat;
    hat.position.y = 0.01;
    hat.rotation.x = -0.12;
    const leather = mat('#6b3b1a', { roughness: 0.7 });
    hat.add(M(lathe('fa-crown', [[0.001, 0.43], [0.07, 0.43], [0.11, 0.415], [0.125, 0.37], [0.135, 0.3], [0.14, 0.27], [0.001, 0.27]]), leather, [0, 0, 0], [1, 1, 0.92]));
    hat.add(M(lathe('fa-brim', [[0.13, 0.285], [0.24, 0.275], [0.29, 0.29], [0.315, 0.325], [0.305, 0.33], [0.28, 0.305], [0.24, 0.29], [0.13, 0.3]], 40), leather, [0, 0, 0], [1, 1, 0.9]));
    hat.add(M(ring(1, 0.09), mats.accent, [0, 0.3, 0], [0.138, 0.127, 0.25], [Math.PI / 2, 0, 0]));
    // óculos de proteção na aba, lentes brilhando
    for (const s of [-1, 1]) {
      hat.add(M(ring(1, 0.25), mats.metal, [s * 0.05, 0.33, 0.12], [0.036, 0.036, 0.04], [-0.25, 0, 0]));
      hat.add(glow(M(CYL, glowMat(color, 0.95), [s * 0.05, 0.33, 0.12], [0.031, 0.01, 0.031], [Math.PI / 2 - 0.25, 0, 0])));
    }
    // capinha de poncho
    const poncho = cloth('#7c4a21', color, 'zigzag', 2);
    H.torso.add(M(lathe('fa-poncho', [[0.055, 0.66], [0.13, 0.63], [0.21, 0.57], [0.265, 0.5], [0.285, 0.44], [0.27, 0.43], [0.24, 0.48], [0.19, 0.54], [0.12, 0.6], [0.05, 0.64]], 32), poncho, [0, 0, 0], [1, 1, 0.78]));
    const fringe = mat('#5a3418');
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      H.torso.add(M(CYL, fringe, [Math.sin(a) * 0.278, 0.405, Math.cos(a) * 0.278 * 0.78], [0.007, 0.07, 0.007]));
    }
    // cartucheira atravessada com balas
    const strap = new THREE.Group();
    strap.position.set(0, 0.28, 0);
    strap.rotation.z = 0.72;
    strap.add(M(ring(1, 0.07), mat('#4a2c17'), [0, 0, 0], [0.2, 0.135, 0.5], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + i * 0.3;
      strap.add(M(CYL, mat('#d4a62a', { metalness: 0.8, roughness: 0.3 }), [Math.sin(a) * 0.205, 0.02, Math.cos(a) * 0.14], [0.011, 0.05, 0.011]));
    }
    H.torso.add(strap);
    // coldre na coxa direita
    H.legR.add(box(0.07, 0.17, 0.11, mat('#4a2c17'), [0.1, -0.1, 0.02], [0, 0, 0.1]));
  },
};

// ---- Trovão: guerreiro de armadura. Elmo com asinhas e crista roxa, barba trançada,
// ombreiras em camadas com rebite, peitoral e tabardo com raio
OUTFIT.helm = {
  body: ({ mats }) => ({ shoeMat: mat('#30343b', { metalness: 0.5, roughness: 0.4 }), toeMat: mats.metal, cuffMat: mats.metal, foreMat: mats.metal }),
  dress(ctx) {
    const { H, mats, color, wide } = ctx;
    const iron = mat('#59606b', { metalness: 0.8, roughness: 0.3 });
    const hat = H.hat;
    hat.add(M(CAP, iron, [0, 0.14, -0.01], [0.19, 0.21, 0.205], [-0.12, 0, 0]));
    hat.add(M(ring(1, 0.12), mats.metal, [0, 0.17, 0.0], [0.19, 0.205, 0.5], [Math.PI / 2 - 0.12, 0, 0]));
    hat.add(box(0.035, 0.13, 0.03, iron, [0, 0.165, 0.198]));
    for (const s of [-1, 1]) {
      hat.add(M(leaf(0.16, 0.06, 0.012), iron, [s * 0.16, 0.08, 0.06], 1, [0.2, 0, s * 0.15 + Math.PI]));
      // asinhas de metal do lado do elmo
      for (let i = 0; i < 3; i++) hat.add(M(leaf(0.16 - i * 0.03, 0.035, 0.01), mat('#cbd5e1', { metalness: 0.8, roughness: 0.25 }), [s * 0.19, 0.2 + i * 0.02, -0.03 - i * 0.03], 1, [-0.6 - i * 0.25, 0, -s * 1.1]));
    }
    for (let i = 0; i < 6; i++) hat.add(M(leaf(0.17 - Math.abs(i - 2) * 0.02, 0.05, 0.012), mats.accent, [0, 0.34 - i * 0.012, 0.13 - i * 0.06], 1, [-0.5 - i * 0.28, Math.PI / 2, 0]));
    hat.add(glow(M(ring(1, 0.06), glowMat(color, 0.9), [0, 0.2, 0], [0.193, 0.21, 0.4], [Math.PI / 2 - 0.12, 0, 0])));
    // barba cheia e duas tranças com anel
    const beard = mat('#3b2416', { roughness: 0.9 });
    H.head.add(ball(0.12, 0.1, 0.09, beard, [0, 0.02, 0.12]));
    for (const s of [-1, 1]) {
      lock(ctx, [[s * 0.04, -0.03, 0.17], [s * 0.05, -0.12, 0.17], [s * 0.045, -0.22, 0.15]], 0.03, 0.016, beard);
      H.head.add(M(ring(1, 0.3), mats.metal, [s * 0.05, -0.15, 0.17], [0.03, 0.03, 0.03], [Math.PI / 2, 0, 0]));
    }
    // ombreiras em três placas com borda roxa e rebites
    for (const arm of [H.armR, H.armL]) {
      const s = arm === H.armR ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        arm.add(M(CAP, iron, [s * 0.02, 0.05 - i * 0.06, 0], [0.15 - i * 0.015, 0.1, 0.14 - i * 0.012], [0, 0, -s * (0.25 + i * 0.12)]));
        arm.add(M(ring(1, 0.08), mats.accent, [s * 0.02, 0.05 - i * 0.06, 0], [0.15 - i * 0.015, 0.14 - i * 0.012, 0.5], [Math.PI / 2, 0, -s * (0.25 + i * 0.12)]));
      }
      for (const z of [-0.07, 0, 0.07]) arm.add(ball(0.012, 0.012, 0.012, mat('#e2e8f0', { metalness: 0.9, roughness: 0.2 }), [s * 0.09, 0.07, z]));
    }
    // peitoral
    H.torso.add(ball(0.215 * wide, 0.17, 0.11 * wide, iron, [0, 0.44, 0.045]));
    H.torso.add(glow(M(ring(1, 0.05), glowMat(color, 0.9), [0, 0.44, 0.1 * wide], [0.06, 0.06, 0.06])));
    H.torso.add(ball(0.05, 0.05, 0.03, mats.accent, [0, 0.44, 0.13 * wide]));
    // tabardo roxo com borda
    H.torso.add(box(0.2, 0.36, 0.025, mats.accent, [0, -0.13, 0.14 * wide], [-0.08, 0, 0]));
    H.torso.add(box(0.21, 0.03, 0.03, mat('#d4a62a', { metalness: 0.8, roughness: 0.3 }), [0, -0.3, 0.155 * wide], [-0.08, 0, 0]));
    H.torso.add(box(0.2, 0.3, 0.025, mats.accent, [0, -0.1, -0.14 * wide], [0.08, 0, 0]));
  },
};

// ---- Coruja: arqueira do capuz de penas. Orelhinhas de coruja, capa de penas nos ombros,
// corpete de couro, trança caindo no ombro e aljava cheia
OUTFIT.tufts = {
  body: ({ mats }) => ({ foreMat: mat('#5a3a22'), shoeMat: mat('#5a3a22'), cuffMat: mat('#5a3a22'), legMat: mat('#2c3836') }),
  dress(ctx) {
    const { H, mats, color } = ctx;
    const hood = mats.accent;
    const light = mat('#ccfbf1', { roughness: 0.6 });
    hairCap(ctx);
    lock(ctx, [[-0.1, 0.27, 0.13], [-0.02, 0.25, 0.18], [0.06, 0.2, 0.17]], 0.028, 0.01);
    lock(ctx, [[0.14, 0.15, 0.02], [0.18, 0.0, 0.07], [0.17, -0.18, 0.12], [0.14, -0.32, 0.14]], 0.04, 0.014);
    // capuz
    H.hat.add(M(CAP, hood, [0, 0.14, -0.02], [0.2, 0.235, 0.215], [-0.55, 0, 0]));
    H.hat.add(M(ring(1, 0.12), mat('#0f766e'), [0, 0.14, -0.02], [0.2, 0.215, 0.6], [Math.PI / 2 - 0.55, 0, 0]));
    // orelhas de pena
    for (const s of [-1, 1]) {
      H.hat.add(M(leaf(0.2, 0.07, 0.015), hood, [s * 0.11, 0.3, 0.0], 1, [-0.2, 0, -s * 0.45]));
      H.hat.add(M(leaf(0.14, 0.04, 0.015), light, [s * 0.11, 0.31, 0.012], 1, [-0.2, 0, -s * 0.45]));
    }
    // capa de penas sobre os ombros
    for (let row = 0; row < 2; row++) {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + row * 0.2;
        const r = 0.22 + row * 0.04;
        const g = new THREE.Group();
        g.position.set(Math.sin(a) * r, 0.6 - row * 0.06, Math.cos(a) * r * 0.75);
        g.rotation.y = a;
        g.add(M(leaf(0.16 + row * 0.03, 0.05, 0.01), row ? hood : (i % 2 ? light : hood), [0, 0, 0], 1, [Math.PI + 0.55 + row * 0.15, 0, 0]));
        H.torso.add(g);
      }
    }
    // corpete de couro com cordão
    const lth = mat('#5a3a22', { roughness: 0.7 });
    H.torso.add(M(lathe('co-bodice', [[0.205, 0.04], [0.18, 0.14], [0.158, 0.24], [0.16, 0.32], [0.175, 0.37], [0.15, 0.37], [0.14, 0.24], [0.16, 0.14], [0.19, 0.04]], 28), lth, [0, 0, 0], [1, 1, 0.66]));
    for (let i = 0; i < 4; i++) H.torso.add(box(0.05, 0.008, 0.01, mat('#f5f5dc'), [0, 0.1 + i * 0.065, 0.11], [0, 0, (i % 2 ? 1 : -1) * 0.5]));
    // aljava nas costas
    const q = new THREE.Group();
    q.position.set(0.08, 0.38, -0.17);
    q.rotation.set(0.25, 0, -0.35);
    q.add(M(lathe('co-quiver', [[0.001, -0.25], [0.06, -0.25], [0.065, 0.18], [0.07, 0.2], [0.06, 0.2], [0.058, -0.2], [0.001, -0.2]], 18), lth));
    q.add(M(ring(1, 0.2), mats.accent, [0, 0.1, 0], [0.066, 0.066, 0.066], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * 0.035 - 0.02;
      const z = Math.floor(i / 2) * 0.03 - 0.015;
      q.add(M(CYL, mats.wood, [x, 0.27, z], [0.008, 0.18, 0.008]));
      q.add(M(leaf(0.08, 0.03, 0.004), i % 2 ? light : hood, [x, 0.3, z], 1, [0, i, 0]));
    }
    H.torso.add(q);
    H.torso.add(M(ring(1, 0.05), lth, [0, 0.34, 0], [0.23, 0.14, 0.5], [Math.PI / 2, 0, 0.7]));
  },
};

// ---- Vespa: caçadora-vespa. Cabelo chanel preto, antenas, macacão listrado,
// abdômen de vespa com ferrão atrás e quatro asas de vidro
OUTFIT.antennae = {
  body: ({ color, mats }) => {
    const stripes = cloth(color, '#141414', 'stripes', 1);
    return { torsoMat: stripes, bustMat: mat(color, { roughness: 0.7 }), upperMat: mat('#161616'), handMat: mat('#161616', { roughness: 0.4 }), shoeMat: mats.accent, cuffMat: mats.accent, beltMat: mat('#161616') };
  },
  dress(ctx) {
    const { H, mats, color } = ctx;
    hairCap(ctx, mats.hair, 0.5, 1.03);
    for (const s of [-1, 1]) lock(ctx, [[s * 0.12, 0.25, 0.08], [s * 0.175, 0.13, 0.08], [s * 0.17, 0.02, 0.1], [s * 0.13, -0.03, 0.13]], 0.05, 0.02);
    lock(ctx, [[-0.12, 0.29, 0.12], [-0.03, 0.29, 0.18], [0.1, 0.25, 0.16]], 0.035, 0.015);
    for (const s of [-1, 1]) {
      lock(ctx, [[s * 0.05, 0.28, 0.1], [s * 0.08, 0.42, 0.14], [s * 0.15, 0.55, 0.1], [s * 0.22, 0.6, 0.02]], 0.012, 0.006, mat('#161616'), H.hat);
      H.hat.add(glow(ball(0.028, 0.028, 0.028, glowMat(color, 0.95), [s * 0.22, 0.6, 0.02])));
    }
    // abdômen listrado com ferrão
    const abd = new THREE.Group();
    abd.position.set(0, 0.04, -0.13);
    abd.rotation.x = -2.1;
    abd.add(M(lathe('ve-abd', [[0.001, 0], [0.06, 0.02], [0.12, 0.1], [0.14, 0.2], [0.12, 0.31], [0.07, 0.39], [0.001, 0.42]]), cloth(color, '#141414', 'stripes', 1)));
    abd.add(M(CONE, mat('#161616', { roughness: 0.3 }), [0, 0.46, 0], [0.025, 0.1, 0.025]));
    H.hips.add(abd);
    // asas
    const wingM = new THREE.MeshStandardMaterial({ color: '#fef9c3', transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const vein = glowMat('#a16207', 0.5);
    H.wings = [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.06, 0.52, -0.14);
      for (const [len, wid, ry, dy] of [[0.55, 0.14, 0.35, 0.03], [0.4, 0.1, 0.75, -0.06]]) {
        const w = M(leaf(len, wid, 0.004), wingM, [0, dy, 0], 1, [0, s * ry, -s * Math.PI / 2]);
        w.castShadow = false;
        g.add(w);
        g.add(glow(M(CYL, vein, [s * len * 0.45 * Math.cos(ry), dy, -len * 0.45 * Math.sin(ry)], [0.004, len * 0.9, 0.004], [0, s * ry, -s * Math.PI / 2])));
      }
      H.torso.add(g);
      return g;
    });
  },
};

// ---- Mandacaru: gigante de cacto. Cabeça e corpo de gomos cheios de espinho, braços de candelabro
// saindo das costas, flor rosa no alto e escudo de palma espinhenta
OUTFIT.spikes = {
  body: ({ mats, wide }) => {
    const green = mat('#4d7c0f', { roughness: 0.75 });
    mats.skin = green;
    return { torsoGeo: ribbed(0.25, 0.7, 10, 0.1), torsoMat: green, bust: false, neck: false, upperMat: green, foreMat: green, handMat: green, legMat: green, shoeMat: mat('#6b4423', { roughness: 1 }), bootCuff: false, beltMat: mat('#c9a66b', { roughness: 1 }) };
  },
  dress(ctx) {
    const { H, mats, color } = ctx;
    const green = mats.skin;
    const thorn = mat('#f5f0c8', { roughness: 0.5 });
    const dark = mat('#3f6212', { roughness: 0.8 });
    H.head.add(M(ribbed(0.2, 0.42, 9, 0.12), green, [0, -0.06, 0]));
    // olhos fundos com brilho
    for (const s of [-1, 1]) H.head.add(ball(0.045, 0.035, 0.03, mat('#1a2e05'), [s * 0.07, 0.17, 0.165]));
    const eyeG = glowMat('#d9f99d', 1);
    for (const s of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(s * 0.07, 0.17, 0.185);
      e.add(glow(ball(0.022, 0.018, 0.01, eyeG, [0, 0, 0])));
      H.head.add(e);
      H.eyes.push(e);
    }
    H.head.add(box(0.12, 0.02, 0.02, mat('#1a2e05'), [0, 0.06, 0.19], [0, 0, 0], 0.5));
    // espinhos em fileiras nas cristas dos gomos
    const spines = (parent, r, y0, y1, n, ribs, zk = 1) => {
      for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * Math.PI * 2;
        for (let j = 0; j < n; j++) {
          const y = y0 + ((y1 - y0) * (j + 0.5)) / n;
          parent.add(M(CONE, thorn, [Math.cos(a) * r, y, Math.sin(a) * r * zk], [0.008, 0.06, 0.008], [0, 0, 0]).rotateOnAxis(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), -Math.PI / 2));
        }
      }
    };
    spines(H.head, 0.205, 0.0, 0.3, 2, 9);
    spines(H.torso, 0.25 * ctx.wide, 0.1, 0.6, 3, 10, 0.64);
    // flor no alto da cabeça e botões
    flower(H.hat, [0.04, 0.37, 0], 0.11, [0, 0, -0.15], '#f472b6', '#fde047');
    H.hat.add(ball(0.04, 0.05, 0.04, mat('#ec4899'), [-0.1, 0.33, -0.05]));
    // braços de candelabro nas costas
    for (const s of [-1, 1]) {
      const b = new THREE.Group();
      b.position.set(s * 0.15, 0.4, -0.12);
      b.add(M(ribbed(0.07, 0.2, 7, 0.15), green, [0, 0, 0], 1, [0, 0, -s * Math.PI / 2]));
      b.add(M(ribbed(0.07, 0.45, 7, 0.15), green, [s * 0.18, -0.03, 0]));
      spines(b, 0.072, 0.0, 0.4, 2, 7);
      b.children.slice(-14).forEach((c) => (c.position.x += s * 0.18));
      H.torso.add(b);
    }
    // escudo: palma espinhenta com flor na borda
    const sh = new THREE.Group();
    sh.position.set(-0.03, -0.05, 0.12);
    sh.add(ball(0.34, 0.42, 0.06, green, [0, 0, 0.08]));
    sh.add(M(ring(1, 0.06), dark, [0, 0, 0.08], [0.34, 0.42, 0.6]));
    for (let i = 0; i < 18; i++) {
      const a = i * 2.4;
      const r = 0.08 + ((i * 7) % 9) * 0.028;
      const x = Math.cos(a) * r * 0.85;
      const y = Math.sin(a) * r;
      sh.add(ball(0.014, 0.014, 0.008, mat('#facc15'), [x, y, 0.14]));
      sh.add(M(CONE, thorn, [x, y, 0.17], [0.007, 0.06, 0.007], [Math.PI / 2, 0, 0]));
    }
    flower(sh, [0.18, 0.36, 0.08], 0.08, [0.3, 0, -0.6]);
    H.fores[1].add(sh);
    H.shieldG = sh;
  },
};

// ---- Iara: mãe-d'água. Cabelão azul-noite até a cintura, tiara de pérolas, top de escamas,
// saia de cauda de peixe que abre em barbatana, braceletes de ouro
OUTFIT.hair = {
  body: ({ mats, color }) => {
    const scales = cloth('#1d4ed8', '#93c5fd', 'scales', 2, { metalness: 0.3, roughness: 0.4 });
    return { torsoMat: mats.skin, bustMat: scales, upperMat: mats.skin, foreMat: mats.skin, robeMat: cloth('#0e7490', '#67e8f9', 'scales', 3, { metalness: 0.3, roughness: 0.35 }), scales };
  },
  dress(ctx) {
    const { H, mats, color, o } = ctx;
    const gold = mat('#d4a62a', { metalness: 0.85, roughness: 0.3 });
    hairCap(ctx, mats.hair, 0.38, 1.04);
    // mechas longas caindo nas costas, com ondas
    for (let i = 0; i < 9; i++) {
      const x = -0.14 + i * 0.035;
      const w = i % 2 ? 0.02 : -0.02;
      lock(ctx, [[x * 0.8, 0.26, -0.12], [x, 0.12, -0.21], [x + w, -0.15, -0.23], [x - w, -0.45, -0.22], [x + w, -0.75, -0.18]], 0.035, 0.012);
    }
    for (const s of [-1, 1]) lock(ctx, [[s * 0.14, 0.24, 0.06], [s * 0.18, 0.05, 0.08], [s * 0.17, -0.2, 0.15], [s * 0.14, -0.42, 0.2]], 0.04, 0.012);
    lock(ctx, [[-0.12, 0.3, 0.11], [-0.03, 0.31, 0.17], [0.09, 0.27, 0.16]], 0.035, 0.012);
    // tiara de pérolas e concha
    for (let i = 0; i < 9; i++) {
      const a = -1.1 + i * 0.275;
      H.hat.add(glow(ball(0.018, 0.018, 0.018, glowMat('#f0f9ff', 0.95), [Math.sin(a) * 0.17, 0.31 - Math.abs(a) * 0.04, Math.cos(a) * 0.15])));
    }
    H.hat.add(M(lathe('shell', [[0.001, 0], [0.05, 0.005], [0.07, 0.02], [0.06, 0.035], [0.001, 0.04]], 12), mat('#fda4af', { roughness: 0.35 }), [0.14, 0.27, 0.05], 1, [1.2, 0, -0.6]));
    // top de escamas
    H.torso.add(M(lathe('ia-top', [[0.162, 0.34], [0.178, 0.4], [0.186, 0.47], [0.18, 0.5], [0.17, 0.5], [0.17, 0.4], [0.155, 0.34]], 28), o.scales, [0, 0, 0], [1, 1, 0.66]));
    H.torso.add(M(ring(1, 0.06), gold, [0, 0.5, 0], [0.18, 0.12, 0.5], [Math.PI / 2, 0, 0]));
    // colar de pérolas
    for (let i = 0; i < 11; i++) {
      const a = -1.2 + i * 0.24;
      H.torso.add(ball(0.013, 0.013, 0.013, mat('#f8fafc', { roughness: 0.15 }), [Math.sin(a) * 0.09, 0.6 - Math.cos(a * 0.8) * 0.04, Math.cos(a) * 0.07 + 0.02]));
    }
    // faixa na cintura e barbatana na barra da saia
    H.robe.add(M(ring(1, 0.12), gold, [0, 0.03, 0], [0.205, 0.17, 0.4], [Math.PI / 2, 0, 0]));
    const finM = new THREE.MeshStandardMaterial({ color: '#67e8f9', transparent: true, opacity: 0.75, roughness: 0.2, side: THREE.DoubleSide });
    for (const s of [-1, 1]) for (const k of [0, 1]) H.robe.add(M(leaf(0.3 - k * 0.07, 0.12, 0.01), finM, [s * 0.22, -0.74, -0.06 - k * 0.06], 1, [Math.PI / 2 + 0.3, 0, s * (1.6 + k * 0.4)]));
    H.robe.add(glow(M(ring(1, 0.04), glowMat(color, 0.6), [0, -0.78, 0], [0.34, 0.28, 0.4], [Math.PI / 2, 0, 0])));
    // braceletes
    for (const f of H.fores) f.add(M(ring(1, 0.18), gold, [0, -0.15, 0], [0.042, 0.042, 0.05], [Math.PI / 2, 0, 0]));
    for (const a of [H.armR, H.armL]) a.add(M(ring(1, 0.18), gold, [0, -0.12, 0], [0.056, 0.056, 0.06], [Math.PI / 2, 0, 0]));
  },
};

// ---- Boitatá: feiticeiro da cobra de fogo. Capuz em forma de cabeça de serpente, chama rosa no alto,
// manto escuro de escamas com barrado de ouro e a cauda de fogo arrastando
OUTFIT.flame = {
  body: ({ color }) => {
    const robe = cloth('#2e1065', color, 'scales', 3);
    return { torsoMat: robe, upperMat: robe, robeMat: robe, cuffMat: mat('#d4a62a', { metalness: 0.8, roughness: 0.3 }) };
  },
  dress(ctx) {
    const { H, mats, color, o } = ctx;
    const gold = mat('#d4a62a', { metalness: 0.85, roughness: 0.3 });
    const hoodM = cloth('#4c1d95', color, 'scales', 2);
    // capuz de serpente: calota, focinho por cima da testa, olhos e presas
    H.hat.add(M(CAP, hoodM, [0, 0.13, -0.02], [0.2, 0.24, 0.22], [-0.5, 0, 0]));
    H.hat.add(ball(0.13, 0.06, 0.14, hoodM, [0, 0.31, 0.1]));
    for (const s of [-1, 1]) {
      H.hat.add(glow(ball(0.025, 0.018, 0.02, glowMat(color, 1), [s * 0.08, 0.34, 0.17])));
      H.hat.add(M(CONE, mat('#f8fafc'), [s * 0.05, 0.255, 0.215], [0.012, 0.05, 0.012], [Math.PI, 0, 0]));
    }
    const f = glow(M(FLAME, glowMat(color, 0.85), [0, 0.5, -0.04], [0.16, 0.45, 0.16]));
    H.hat.add(f, glow(M(FLAME, glowMat('#ffd0ea', 0.95), [0, 0.45, -0.03], [0.08, 0.25, 0.08])));
    H.hat.userData.flame = f;
    // manto com gola alta e barrado
    H.torso.add(M(lathe('bo-collar', [[0.1, 0.6], [0.2, 0.58], [0.25, 0.52], [0.24, 0.5], [0.19, 0.55], [0.1, 0.62], [0.09, 0.78], [0.08, 0.78]], 28), hoodM, [0, 0, 0], [1, 1, 0.8]));
    H.torso.add(M(ring(1, 0.06), gold, [0, 0.515, 0], [0.245, 0.196, 0.4], [Math.PI / 2, 0, 0]));
    H.torso.add(box(0.06, 0.55, 0.02, gold, [0, 0.25, 0.155]));
    H.robe.add(M(ring(1, 0.05), gold, [0, -0.78, 0], [0.34, 0.28, 0.5], [Math.PI / 2, 0, 0]));
    H.robe.add(M(ring(1, 0.1), gold, [0, 0.02, 0], [0.205, 0.168, 0.4], [Math.PI / 2, 0, 0]));
    // cauda de fogo: serpente que sai de baixo do manto
    const tail = new THREE.Group();
    tail.position.set(0, -0.72, -0.2);
    tail.add(glow(M(strand([[0, 0, 0], [0.1, -0.02, -0.25], [-0.08, -0.04, -0.5], [0.05, -0.05, -0.72]], 0.1, 0.01, 18, 10), glowMat(color, 0.7))));
    tail.add(glow(M(strand([[0, 0.01, 0], [0.1, -0.01, -0.25], [-0.08, -0.03, -0.5]], 0.05, 0.01, 14, 8), glowMat('#ffd0ea', 0.85))));
    H.robe.add(tail);
    H.tail = tail;
  },
};

// ---- Saci: moleque de uma perna só. Gorro vermelho caído, bermuda vermelha, peito nu,
// colar de dente, cachimbo e peixeira
OUTFIT.cap = {
  body: ({ mats }) => ({ torsoMat: mats.skin, upperMat: mats.skin, legMat: mats.skin, bareFeet: true, belt: false }),
  dress(ctx) {
    const { H, mats } = ctx;
    const red = mat('#dc2626', { roughness: 0.75 });
    H.head.add(M(CAP, mat('#120a06', { roughness: 0.9 }), [0, 0.13, -0.01], [0.17, 0.2, 0.19], [-0.55, 0, 0]));
    // gorro: cone mole que cai pra trás, com barra dobrada e pompom
    H.hat.add(M(strand([[0, 0.24, 0.0], [0, 0.38, -0.04], [0, 0.48, -0.14], [0.03, 0.48, -0.28], [0.06, 0.4, -0.36]], 0.175, 0.03, 18, 20), red));
    H.hat.add(M(ring(1, 0.22), mat('#b91c1c'), [0, 0.26, -0.005], [0.17, 0.18, 0.18], [Math.PI / 2 + 0.12, 0, 0]));
    H.hat.add(ball(0.04, 0.04, 0.04, mat('#fef2f2'), [0.065, 0.38, -0.38]));
    // bermuda
    H.hips.add(M(lathe('sa-shorts', [[0.2, 0.08], [0.215, -0.02], [0.2, -0.18], [0.14, -0.2], [0.001, -0.2]], 24), red, [0, 0, 0], [1, 1, 0.66]));
    H.hips.add(M(ring(1, 0.12), mat('#f8fafc'), [0, 0.06, 0], [0.205, 0.135, 0.4], [Math.PI / 2, 0, 0]));
    // colar de cordão com dente
    H.torso.add(M(ring(1, 0.04), mat('#3f2a14'), [0, 0.6, 0.03], [0.11, 0.09, 0.3], [Math.PI / 2 - 0.5, 0, 0]));
    H.torso.add(M(CONE, mat('#f5f5dc'), [0, 0.5, 0.12], [0.015, 0.05, 0.015], [Math.PI, 0, 0]));
    for (const f of H.fores) f.add(M(ring(1, 0.2), red, [0, -0.17, 0], [0.04, 0.04, 0.05], [Math.PI / 2, 0, 0]));
  },
};

// ---- Cuca: bruxa-jacaré. Cabeça de jacaré com bocarra e olho amarelo de pupila fina, cabeleira loira,
// chapéu de bruxa, vestido roxo rasgado, colar de ossos, rabo com cristas e mãos de garra
OUTFIT.gator = {
  body: ({ mats }) => {
    mats.skin.map = clothTexture('#4d8a3f', '#2f5a28', 'scales', 3);
    mats.skin.color.set('#ffffff');
    const dress = cloth('#6b21a8', '#a855f7', 'weave', 2);
    return { torsoMat: dress, bustMat: mat('#6b21a8', { roughness: 0.8 }), upperMat: mats.skin, foreMat: mats.skin, legMat: mats.skin, talons: true, ownHands: true, ears: false, beltMat: mat('#3b0764') };
  },
  dress(ctx) {
    const { H, mats, color, fem } = ctx;
    const skin = mats.skin;
    const belly = mat('#c8d89a', { roughness: 0.8 });
    const teeth = mat('#f8fafc', { roughness: 0.3 });
    const hat = H.hat;
    // crânio e focinho
    H.head.add(ball(0.17, 0.15, 0.18, skin, [0, 0.13, -0.01]));
    hat.add(box(0.22, 0.09, 0.3, skin, [0, 0.12, 0.27], [0.06, 0, 0], 0.4));
    hat.add(box(0.16, 0.05, 0.12, skin, [0, 0.16, 0.38], [0.06, 0, 0], 0.45));
    for (const s of [-1, 1]) hat.add(ball(0.02, 0.015, 0.02, mat('#1a2e10'), [s * 0.04, 0.185, 0.43]));
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) hat.add(M(CONE, teeth, [s * 0.1, 0.07, 0.15 + i * 0.065], [0.012, 0.035, 0.012], [Math.PI, 0, 0]));
    // queixo que abre
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.07, 0.1);
    jaw.add(box(0.19, 0.05, 0.32, belly, [0, -0.025, 0.16], [0, 0, 0], 0.4));
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) jaw.add(M(CONE, teeth, [s * 0.08, 0.01, 0.06 + i * 0.06], [0.01, 0.03, 0.01]));
    jaw.add(box(0.15, 0.01, 0.24, mat('#9f1239'), [0, 0.0, 0.14], [0, 0, 0], 0.4));
    hat.add(jaw);
    hat.userData.jaw = jaw;
    // olhos em calombos, amarelos com pupila de fenda
    const eyesG = [];
    for (const s of [-1, 1]) {
      hat.add(ball(0.055, 0.045, 0.055, skin, [s * 0.09, 0.24, 0.1]));
      const e = new THREE.Group();
      e.position.set(s * 0.1, 0.26, 0.14);
      e.add(glow(ball(0.03, 0.026, 0.02, mat('#facc15', { roughness: 0.2 }), [0, 0, 0])));
      e.add(glow(ball(0.006, 0.022, 0.006, mat('#111'), [0, 0, 0.018])));
      hat.add(e);
      H.eyes.push(e);
      const fury = glow(ball(0.034, 0.03, 0.022, glowMat('#ef4444', 0.95), [s * 0.1, 0.26, 0.142]));
      fury.visible = false;
      hat.add(fury);
      eyesG.push(fury);
    }
    hat.userData.eyes = eyesG;
    // cabeleira loira armada
    const blond = mat('#facc15', { roughness: 0.55 });
    hat.add(ball(0.2, 0.17, 0.17, blond, [0, 0.22, -0.1]));
    for (let i = 0; i < 9; i++) {
      const a = -1.6 + i * 0.4;
      lock(ctx, [[Math.sin(a) * 0.15, 0.25, -0.05 - Math.cos(a) * 0.12], [Math.sin(a) * 0.22, 0.1, -0.08 - Math.cos(a) * 0.17], [Math.sin(a) * 0.26, -0.1, -0.06 - Math.cos(a) * 0.2], [Math.sin(a) * 0.24, -0.25, -0.02 - Math.cos(a) * 0.2]], 0.05, 0.015, blond, hat);
    }
    // chapéu de bruxa torto
    const wh = new THREE.Group();
    wh.position.set(0.02, 0.33, -0.06);
    wh.rotation.set(-0.25, 0, 0.18);
    const hatM = mat('#581c87', { roughness: 0.8 });
    wh.add(M(lathe('cu-brim', [[0.08, 0], [0.24, -0.01], [0.27, 0.01], [0.24, 0.015], [0.08, 0.02]], 32), hatM));
    wh.add(M(strand([[0, 0, 0], [0, 0.14, 0], [0.02, 0.26, -0.04], [0.08, 0.32, -0.1]], 0.13, 0.01, 16, 16), hatM));
    wh.add(M(ring(1, 0.12), mats.accent, [0, 0.03, 0], [0.13, 0.13, 0.4], [Math.PI / 2, 0, 0]));
    wh.add(box(0.05, 0.05, 0.02, mat('#d4a62a', { metalness: 0.8 }), [0, 0.035, 0.125]));
    hat.add(wh);
    // vestido: saia rasgada em pontas
    skirtStrips(H.hips, 14, 0.2, 0.04, 0.35, [mat('#6b21a8'), mat('#581c87')], (i) => leaf(0.32 + (i % 3) * 0.05, 0.08, 0.01, 0.3), 0.22);
    // colar de ossos
    for (let i = 0; i < 9; i++) {
      const a = -1.1 + i * 0.275;
      H.torso.add(M(CYL, mat('#f5f5f4'), [Math.sin(a) * 0.13, 0.55 - Math.cos(a * 0.9) * 0.05, Math.cos(a) * 0.1 + 0.02], [0.012, 0.045, 0.012], [0.3, 0, a * 0.4]));
    }
    // rabo com cristas
    H.tailG = new THREE.Group();
    H.tailG.position.set(0, -0.08, -0.15);
    H.tailG.add(M(strand([[0, 0, 0], [0, -0.12, -0.3], [0, -0.38, -0.55], [0, -0.62, -0.78], [0, -0.7, -1.0]], 0.15, 0.02, 20, 12), skin));
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      H.tailG.add(M(CONE, mat('#2f5a28'), [0, 0.1 - t * 0.74, -0.08 - t * 0.85], [0.03 * (1 - t * 0.6), 0.07 * (1 - t * 0.5), 0.03], [-0.5, 0, 0]));
    }
    H.hips.add(H.tailG);
    // mãos de garra com brilho de fúria
    H.furyBits = [];
    const claw = mat('#f1f5f9', { roughness: 0.3 });
    for (const f of H.fores) {
      f.add(box(0.09, 0.08, 0.1, skin, [0, -0.25, 0.01], [0, 0, 0], 0.4));
      for (const x of [-0.03, 0, 0.03]) f.add(M(strand([[x, -0.27, 0.04], [x * 1.3, -0.34, 0.07], [x * 1.4, -0.38, 0.12]], 0.013, 0.003, 8, 6), claw));
      const fl = glow(M(FLAME, glowMat('#ef4444', 0.85), [0, -0.33, 0.06], [0.07, 0.1, 0.07]));
      fl.visible = false;
      f.add(fl);
      H.furyBits.push(fl);
    }
  },
};

// ---- Curupira: menino da mata. Cabelo de fogo, pés virados pra trás, tanga e faixa de folhas,
// colar de sementes e pintura de guerra
OUTFIT.firehair = {
  body: ({ mats }) => ({ torsoMat: mats.skin, upperMat: mats.skin, legMat: mats.skin, belt: false }),
  dress(ctx) {
    const { H, mats, color } = ctx;
    const leafA = mat('#4d7c0f', { roughness: 0.7 });
    const leafB = mat('#65a30d', { roughness: 0.7 });
    const flames = [];
    const spots = [[0, 0.36, -0.02, 0.13, 0.3], [-0.1, 0.32, -0.04, 0.1, 0.24], [0.1, 0.32, -0.04, 0.1, 0.24], [0, 0.3, -0.16, 0.12, 0.3], [-0.1, 0.24, -0.15, 0.09, 0.24], [0.1, 0.24, -0.15, 0.09, 0.24], [0, 0.36, 0.08, 0.08, 0.18], [-0.14, 0.2, -0.04, 0.07, 0.18], [0.14, 0.2, -0.04, 0.07, 0.18]];
    hairCap(ctx, glowMat(color, 0.95), 0.4, 1.02);
    spots.forEach(([x, y, z, w, h], i) => {
      const f = glow(M(FLAME, glowMat(i % 3 === 1 ? '#ffb020' : color, 0.9), [x, y, z], [w, h, w], [-0.25, 0, x * 2]));
      f.userData.h = h;
      f.userData.ph = i * 1.7;
      H.hat.add(f);
      flames.push(f);
    });
    H.hat.add(glow(M(FLAME, glowMat('#ffe08a', 0.95), [0, 0.32, -0.06], [0.07, 0.2, 0.07])));
    H.hat.userData.flames = flames;
    // tanga de folhas
    skirtStrips(H.hips, 12, 0.2, 0.06, 0.3, [leafA, leafB], (i) => leaf(0.26 + (i % 2) * 0.06, 0.08, 0.012), 0.2);
    H.hips.add(M(ring(1, 0.1), mat('#7c4a21'), [0, 0.06, 0], [0.2, 0.135, 0.5], [Math.PI / 2, 0, 0]));
    // faixa de folhas no peito
    const sash = new THREE.Group();
    sash.position.set(0, 0.3, 0);
    sash.rotation.z = -0.75;
    sash.add(M(ring(1, 0.06), mat('#7c4a21'), [0, 0, 0], [0.2, 0.13, 0.5], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36;
      sash.add(M(leaf(0.1, 0.04, 0.008), i % 2 ? leafA : leafB, [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.135], 1, [0, a, Math.PI / 2]));
    }
    H.torso.add(sash);
    // colar de sementes vermelhas
    for (let i = 0; i < 9; i++) {
      const a = -1.0 + i * 0.25;
      H.torso.add(ball(0.014, 0.014, 0.014, mat('#b91c1c', { roughness: 0.3 }), [Math.sin(a) * 0.1, 0.6 - Math.cos(a) * 0.04, Math.cos(a) * 0.08 + 0.02]));
    }
    for (const a of [H.armR, H.armL]) for (let i = 0; i < 4; i++) a.add(M(leaf(0.08, 0.03, 0.006), i % 2 ? leafA : leafB, [Math.sin(i * 1.6) * 0.07, -0.12, Math.cos(i * 1.6) * 0.07], 1, [Math.PI, i * 1.6, 0]));
  },
};

// ---- Caipora: menina do mato, montada no porco-do-mato. Juba magenta desgrenhada, cocar de penas em leque,
// top de palha trançada, saiote de palha, pintura de urucum e o queixada do lado
OUTFIT.cocar = {
  body: ({ mats }) => ({ torsoMat: mats.skin, bustMat: mat('#a16207'), upperMat: mats.skin, legMat: mats.skin, bareFeet: true, belt: false }),
  dress(ctx) {
    const { H, mats, color } = ctx;
    hairCap(ctx, mats.hair, 0.4, 1.06);
    for (let i = 0; i < 12; i++) {
      const a = (i < 6 ? -1 : 1) * (1.0 + (i % 6) * 0.38);
      const r = 0.17;
      lock(ctx, [[Math.sin(a) * r * 0.8, 0.26, Math.cos(a) * r * 0.8 - 0.04], [Math.sin(a) * r * 1.3, 0.14, Math.cos(a) * r * 1.2 - 0.06], [Math.sin(a) * r * 1.5, -0.05, Math.cos(a) * r * 1.3 - 0.06], [Math.sin(a + 0.2) * r * 1.4, -0.2 - (i % 3) * 0.05, Math.cos(a) * r * 1.2 - 0.05]], 0.045, 0.012);
    }
    lock(ctx, [[-0.12, 0.3, 0.1], [-0.02, 0.3, 0.17], [0.11, 0.25, 0.15]], 0.04, 0.014);
    // cocar: faixa trançada e penas em leque pra trás
    const band = cloth('#fde68a', '#b45309', 'zigzag', 1);
    H.hat.add(M(ring(1, 0.18), band, [0, 0.24, 0], [0.18, 0.2, 0.25], [Math.PI / 2 - 0.25, 0, 0]));
    const cols = ['#f8fafc', '#84cc16', color, '#f8fafc', '#facc15'];
    // penas em leque atrás da cabeça, abrindo pros lados como um sol
    for (let i = 0; i < 13; i++) {
      const a = (i / 12 - 0.5) * 3.0;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * 0.12, 0.26, -0.1);
      g.rotation.set(-0.35, 0, -a);
      const len = 0.38 - Math.abs(i - 6) * 0.015;
      g.add(M(leaf(len, 0.07, 0.008), mat(cols[i % cols.length], { roughness: 0.6 })));
      g.add(M(leaf(len * 0.3, 0.05, 0.01), mat(i % 2 ? color : '#1c1917'), [0, len * 0.72, 0.006]));
      H.hat.add(g);
    }
    // top de palha
    H.torso.add(M(lathe('ca-top', [[0.15, 0.33], [0.17, 0.4], [0.182, 0.46], [0.175, 0.49], [0.165, 0.49], [0.165, 0.4], [0.14, 0.33]], 28), band, [0, 0, 0], [1, 1, 0.68]));
    // saiote de palha
    skirtStrips(H.hips, 22, 0.2, 0.06, 0.3, [mat('#d6b36a', { roughness: 1 }), mat('#c49a4a', { roughness: 1 })], (i) => leaf(0.28 + (i % 3) * 0.03, 0.035, 0.006, 0.5), 0.15);
    H.hips.add(M(ring(1, 0.14), band, [0, 0.07, 0], [0.21, 0.14, 0.4], [Math.PI / 2, 0, 0]));
    // colar de sementes
    for (let i = 0; i < 11; i++) {
      const a = -1.1 + i * 0.22;
      H.torso.add(ball(0.012, 0.016, 0.012, mat(i % 3 ? '#7f1d1d' : '#fde68a', { roughness: 0.3 }), [Math.sin(a) * 0.1, 0.6 - Math.cos(a) * 0.05, Math.cos(a) * 0.08 + 0.02]));
    }
    for (const a of [H.armR, H.armL]) a.add(M(ring(1, 0.22), band, [0, -0.08, 0], [0.06, 0.06, 0.07], [Math.PI / 2, 0, 0]));
    // queixada: corpo peludo, focinho, presas, orelhas e crina eriçada
    const fur = mat('#3d2b1f', { roughness: 1 });
    const boar = new THREE.Group();
    boar.add(ball(0.2, 0.17, 0.3, fur, [0, 0.3, 0]));
    boar.add(ball(0.14, 0.13, 0.14, fur, [0, 0.32, 0.3]));
    boar.add(M(taper(0.09, 0.06, 0.14, 0), fur, [0, 0.3, 0.38], 1, [-Math.PI / 2 + 0.25, 0, 0]));
    boar.add(M(CYL, mat('#c98b7a', { roughness: 0.6 }), [0, 0.27, 0.53], [0.06, 0.02, 0.05], [Math.PI / 2 - 0.25, 0, 0]));
    for (const s of [-1, 1]) {
      boar.add(ball(0.01, 0.012, 0.006, mat('#2b1a12'), [s * 0.022, 0.275, 0.545]));
      boar.add(M(strand([[s * 0.05, 0.26, 0.47], [s * 0.08, 0.27, 0.5], [s * 0.09, 0.31, 0.51]], 0.012, 0.004, 6, 6), mat('#f8fafc')));
      boar.add(M(leaf(0.07, 0.04, 0.01), fur, [s * 0.08, 0.42, 0.28], 1, [0, 0, -s * 0.5]));
      boar.add(ball(0.016, 0.016, 0.012, mat('#111', { roughness: 0.2 }), [s * 0.085, 0.36, 0.4]));
      boar.add(ball(0.006, 0.006, 0.004, mat('#fff'), [s * 0.088, 0.365, 0.411]));
    }
    for (let i = 0; i < 12; i++) boar.add(M(CONE, mat('#1c120b'), [0, 0.46 - Math.abs(i - 5) * 0.004, 0.25 - i * 0.04], [0.025, 0.08, 0.012], [-0.4, 0, 0]));
    boar.add(M(ring(1, 0.12), mat('#e7e5e4'), [0, 0.38, 0.17], [0.15, 0.13, 0.4], [0, 0, 0]));
    for (const [x, z] of [[-0.1, 0.16], [0.1, 0.16], [-0.1, -0.16], [0.1, -0.16]]) {
      boar.add(M(taper(0.04, 0.025, 0.2), fur, [x, 0.2, z]));
      boar.add(ball(0.03, 0.02, 0.035, mat('#1c120b'), [x, 0.015, z + 0.01]));
    }
    boar.add(M(strand([[0, 0.34, -0.29], [0, 0.32, -0.36], [0.02, 0.28, -0.38]], 0.02, 0.006, 6, 6), fur));
    boar.position.set(-0.75, 0, -0.25);
    H.body.add(boar);
    H.boar = boar;
  },
};

// ---- Fulozinha: guardiã da mata. Cabelão preto com duas tranças grossas até a cintura,
// coroa de flores, vestido de folhas sobrepostas e colar de folhas
OUTFIT.braids = {
  body: ({ mats }) => ({ upperMat: mats.skin, foreMat: mats.skin, torsoMat: mat('#3f6212', { roughness: 0.75 }) }),
  dress(ctx) {
    const { H, mats, color } = ctx;
    const leafA = mat('#4d7c0f', { roughness: 0.7 });
    const leafB = mat('#65a30d', { roughness: 0.7 });
    const leafC = mat('#365314', { roughness: 0.7 });
    hairCap(ctx, mats.hair, 0.38, 1.05);
    for (let i = 0; i < 7; i++) {
      const x = -0.12 + i * 0.04;
      lock(ctx, [[x * 0.8, 0.26, -0.12], [x, 0.1, -0.22], [x * 1.1, -0.2, -0.24], [x, -0.5, -0.2]], 0.04, 0.015);
    }
    lock(ctx, [[-0.13, 0.29, 0.1], [-0.04, 0.3, 0.17], [0.08, 0.27, 0.17]], 0.035, 0.012);
    // tranças: gomos trançados descendo pela frente do ombro, flor na ponta
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = s * (0.17 + t * 0.05) + (i % 2 ? 0.012 : -0.012);
        H.head.add(ball(0.045 - t * 0.012, 0.055, 0.045 - t * 0.012, mats.hair, [x, 0.12 - i * 0.075, 0.04 + t * 0.12], [0, 0, (i % 2 ? 1 : -1) * 0.5]));
      }
      flower(H.head, [s * 0.22, -0.55, 0.16], 0.06, [0.6, 0, 0], color, '#fde047');
    }
    // coroa de flores (é o que se vê dela de cima)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      flower(H.hat, [Math.sin(a) * 0.17, 0.3 - Math.cos(a) * 0.02, Math.cos(a) * 0.17 - 0.01], 0.055, [Math.cos(a) * -0.6, 0, Math.sin(a) * 0.6], i % 2 ? '#f9a8d4' : color, '#fde047');
      H.hat.add(M(leaf(0.08, 0.035, 0.006), leafB, [Math.sin(a + 0.35) * 0.18, 0.28, Math.cos(a + 0.35) * 0.18], 1, [Math.cos(a + 0.35) * 1.2, 0, -Math.sin(a + 0.35) * 1.2]));
    }
    // vestido de folhas: três carreiras na saia e uma gola
    for (let row = 0; row < 4; row++) {
      const n = 14 + row * 2;
      const y = -0.05 - row * 0.2;
      const r = 0.22 + row * 0.035;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + row * 0.3;
        const g = new THREE.Group();
        g.position.set(Math.sin(a) * r, y, Math.cos(a) * r * 0.82);
        g.rotation.y = a;
        g.add(M(leaf(0.26, 0.1, 0.01), [leafA, leafB, leafC][(i + row) % 3], [0, 0, 0.005], 1, [Math.PI + 0.25, 0, 0]));
        H.robe.add(g);
      }
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * 0.15, 0.6, Math.cos(a) * 0.1);
      g.rotation.y = a;
      g.add(M(leaf(0.12, 0.05, 0.008), i % 2 ? leafA : leafB, [0, 0, 0], 1, [Math.PI + 1.0, 0, 0]));
      H.torso.add(g);
    }
    for (const f of H.fores) f.add(M(ring(1, 0.2), mat('#7c4a21'), [0, -0.16, 0], [0.04, 0.04, 0.05], [Math.PI / 2, 0, 0]));
  },
};

// ---- Uirapuru: o pássaro cantador. Cabeça de pássaro com bico e máscara, penacho amarelo e vermelho,
// peito alaranjado, asas de penas nas costas e leque de cauda
OUTFIT.crest = {
  body: ({ mats }) => {
    const red = mat('#dc2626', { roughness: 0.7 });
    return { torsoMat: red, upperMat: red, foreMat: red, handMat: mats.skin, legMat: red, shinMat: mats.skin, shinK: 0.5, talons: true, neck: false };
  },
  dress(ctx) {
    const { H, mats, color } = ctx;
    const red = mat('#dc2626', { roughness: 0.7 });
    const dark = mat('#7f1d1d', { roughness: 0.7 });
    const orange = mat('#fb923c', { roughness: 0.7 });
    const yellow = mats.skin;
    H.head.add(ball(0.18, 0.18, 0.18, red, [0, 0.12, 0]));
    H.head.add(ball(0.13, 0.08, 0.1, orange, [0, 0.02, 0.1]));
    // máscara escura e olhos
    H.head.add(ball(0.12, 0.05, 0.1, mat('#1c1917'), [0, 0.16, 0.1]));
    eyes(ctx, 0.085, 0.165, 0.14, '#1c1917', false, 1.4);
    // bico
    H.head.add(M(CONE, yellow, [0, 0.11, 0.24], [0.045, 0.14, 0.035], [Math.PI / 2, 0, 0]));
    H.head.add(M(CONE, mat('#d97706'), [0, 0.085, 0.215], [0.035, 0.09, 0.025], [Math.PI / 2 + 0.15, 0, 0]));
    // penacho
    for (let i = 0; i < 6; i++) H.hat.add(M(leaf(0.26 - i * 0.025, 0.06, 0.01), mat(i % 2 ? '#fbbf24' : color, { roughness: 0.6 }), [0, 0.27, 0.1 - i * 0.06], 1, [-0.35 - i * 0.28, Math.PI / 2, 0]));
    // peito alaranjado em penas
    H.torso.add(ball(0.16, 0.22, 0.1, orange, [0, 0.36, 0.06]));
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) H.torso.add(M(leaf(0.08, 0.05, 0.006), r % 2 ? orange : mat('#fdba74'), [-0.075 + i * 0.05, 0.48 - r * 0.1, 0.15], 1, [Math.PI + 0.3, 0, 0]));
    // asas nas costas: penas em leque
    H.wings = [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.position.set(s * 0.08, 0.5, -0.16);
      for (let i = 0; i < 7; i++) {
        const len = 0.24 + i * 0.05;
        g.add(M(leaf(len, 0.06, 0.008), i > 4 ? dark : i % 2 ? red : mat('#ef4444'), [s * i * 0.04, -i * 0.015, 0], 1, [0, 0, -s * (0.5 + i * 0.16)]));
      }
      H.torso.add(g);
      return g;
    });
    // cauda em leque
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) * 0.22;
      H.hips.add(M(leaf(0.4 - Math.abs(i - 3) * 0.04, 0.07, 0.01), i % 2 ? dark : red, [Math.sin(a) * 0.05, 0.02, -0.15], 1, [-Math.PI / 2 - 0.9, 0, a]));
    }
    // penas nos punhos
    for (const f of H.fores) for (let i = 0; i < 3; i++) f.add(M(leaf(0.12, 0.04, 0.006), i % 2 ? dark : red, [0, -0.1, -0.03], 1, [Math.PI + 0.4, (i - 1) * 0.5, 0]));
  },
};

// ---- Zé Pilintra: malandro de terno branco. Panamá com fita vermelha, bigode fino,
// paletó de lapela com lenço e gravata vermelhos, sapato bicolor e bengala
OUTFIT.panama = {
  body: ({ mats }) => {
    mats.main.map = clothTexture('#f8fafc', '#cbd5e1', 'weave', 3);
    mats.dark.map = mats.main.map;
    return { shoeMat: mat('#f8fafc', { roughness: 0.4 }), toeMat: mat('#141414', { roughness: 0.3 }), bootCuff: false, beltMat: mat('#141414'), cuffMat: mat('#f8fafc') };
  },
  dress(ctx) {
    const { H, mats } = ctx;
    const white = mats.main;
    const red = mat('#dc2626', { roughness: 0.5 });
    H.head.add(M(CAP, mat('#120a06', { roughness: 0.4, metalness: 0.2 }), [0, 0.13, -0.01], [0.17, 0.2, 0.19], [-0.6, 0, 0]));
    // panamá
    const hat = H.hat;
    hat.rotation.set(-0.08, 0, 0.12);
    const straw = mat('#f8fafc', { roughness: 0.75 });
    hat.add(M(lathe('ze-brim', [[0.13, 0.28], [0.27, 0.275], [0.3, 0.29], [0.28, 0.295], [0.13, 0.295]], 40), straw));
    hat.add(M(lathe('ze-crown', [[0.001, 0.42], [0.08, 0.42], [0.11, 0.4], [0.105, 0.36], [0.125, 0.29], [0.001, 0.29]], 32), straw));
    hat.add(M(CYL, red, [0, 0.32, 0], [0.122, 0.045, 0.122]));
    // camisa preta, gravata e lapelas
    H.torso.add(ball(0.09, 0.14, 0.04, mat('#141414'), [0, 0.5, 0.115]));
    H.torso.add(M(leaf(0.25, 0.05, 0.01), red, [0, 0.58, 0.155], 1, [Math.PI - 0.12, 0, 0]));
    H.torso.add(box(0.04, 0.035, 0.03, red, [0, 0.58, 0.15]));
    for (const s of [-1, 1]) H.torso.add(M(leaf(0.3, 0.07, 0.012), white, [s * 0.07, 0.6, 0.14], 1, [Math.PI - 0.15, 0, s * 0.35]));
    H.torso.add(M(leaf(0.06, 0.04, 0.01), red, [0.13, 0.46, 0.14], 1, [0, 0, -0.3]));
    for (let i = 0; i < 2; i++) H.torso.add(ball(0.013, 0.013, 0.008, mat('#141414'), [0.035, 0.25 - i * 0.09, 0.145]));
    // aba do paletó
    H.hips.add(M(lathe('ze-coat', [[0.2, 0.1], [0.215, 0.0], [0.23, -0.18], [0.22, -0.18], [0.2, 0.0], [0.19, 0.1]], 28), white, [0, 0, 0], [1, 1, 0.7]));
  },
};

// ---- Boto: o boto-cor-de-rosa de terno. Cabeça de boto com focinho comprido e sorriso,
// chapéu de palhinha rosa que esconde o furo, gravata-borboleta, faixa e a nadadeira rasgando o paletó
OUTFIT.boater = {
  body: ({ mats }) => {
    mats.main.map = clothTexture('#f8fafc', '#cbd5e1', 'weave', 3);
    mats.dark.map = mats.main.map;
    return { shoeMat: mat('#f8fafc', { roughness: 0.4 }), toeMat: mats.accent, bootCuff: false, beltMat: mats.accent, cuffMat: mat('#f8fafc'), ears: false };
  },
  dress(ctx) {
    const { H, mats, color } = ctx;
    const pink = mats.skin;
    const light = mat('#ffe4ec', { roughness: 0.5 });
    H.head.add(ball(0.18, 0.19, 0.19, pink, [0, 0.13, 0]));
    H.head.add(ball(0.12, 0.08, 0.11, light, [0, 0.04, 0.08]));
    // focinho comprido
    H.head.add(M(taper(0.07, 0.04, 0.24, 0.05), pink, [0, 0.1, 0.12], 1, [-Math.PI / 2 + 0.1, 0, 0]));
    H.head.add(M(taper(0.055, 0.03, 0.2, 0.05), light, [0, 0.07, 0.13], 1, [-Math.PI / 2 + 0.2, 0, 0]));
    H.head.add(box(0.07, 0.008, 0.16, mat('#9f1239'), [0, 0.078, 0.25], [-0.12, 0, 0], 0.4));
    eyes(ctx, 0.12, 0.15, 0.12, '#1c1917', false, 0.9);
    // chapéu de palhinha
    const hat = H.hat;
    hat.position.y = -0.03;
    hat.add(M(lathe('bo-brim', [[0.13, 0.31], [0.3, 0.305], [0.31, 0.32], [0.13, 0.325]], 40), mats.accent));
    hat.add(M(CYL, mats.accent, [0, 0.4, 0], [0.155, 0.17, 0.155]));
    hat.add(M(CYL, mat('#f8fafc'), [0, 0.355, 0], [0.158, 0.05, 0.158]));
    hat.add(M(CYL, mat('#ec4899'), [0, 0.485, 0], [0.156, 0.005, 0.156]));
    // camisa, gravata-borboleta, faixa
    H.torso.add(ball(0.08, 0.13, 0.04, light, [0, 0.5, 0.12]));
    for (const s of [-1, 1]) H.torso.add(M(CONE, mats.accent, [s * 0.035, 0.59, 0.15], [0.03, 0.06, 0.018], [0, 0, s * Math.PI / 2]));
    H.torso.add(ball(0.016, 0.016, 0.016, mats.accent, [0, 0.59, 0.155]));
    for (const s of [-1, 1]) H.torso.add(M(leaf(0.3, 0.07, 0.012), mats.main, [s * 0.07, 0.6, 0.14], 1, [Math.PI - 0.15, 0, s * 0.35]));
    H.torso.add(M(ring(1, 0.3), mats.accent, [0, 0.09, 0], [0.19, 0.125, 0.25], [Math.PI / 2, 0, 0]));
    // nadadeira nas costas
    H.torso.add(M(leaf(0.3, 0.14, 0.03, 0.3), pink, [0, 0.36, -0.13], 1, [-0.9, Math.PI / 2, 0]));
  },
};
