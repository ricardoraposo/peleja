import * as THREE from 'three';
import { TEAMS } from './config.js';
import { F } from './sim.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(1, 12, 8);
const OCTA = new THREE.OctahedronGeometry(1, 0);
const RING = new THREE.RingGeometry(0.82, 1, 40);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...opts }));
  return matCache.get(key);
}

function part(m, w, h, d, x, y, z, geo = BOX) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function glowMat(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
}

function groundRing(color, r, opacity = 0.8) {
  const m = new THREE.Mesh(RING, glowMat(color, opacity));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.05;
  m.scale.setScalar(r);
  return m;
}

// ângulo da simulação (direção cos/sin em x/z) → rotação y de um modelo que olha pra +z
export const yawOf = (f) => Math.PI / 2 - f;

// ---------- heróis ----------

// Armas. Por padrão a arma sai perpendicular ao braço (aponta pra frente com o braço
// abaixado e pra cima com o braço estendido): bom pra martelo, espada e clava.
// `along` alinha a arma com o braço (aponta pra onde a mão aponta): pistola e adagas.
function weapon(kind, M, color) {
  const g = new THREE.Group();
  const glow = glowMat(color, 0.9);
  const steel = mat('#d5dbe6', { metalness: 0.5, roughness: 0.35 });
  if (kind === 'pistol') {
    // garrucha: coronha de madeira, cano curto e boca larga
    g.add(part(M.wood, 0.1, 0.22, 0.13, 0, -0.08, 0));
    g.add(part(M.metal, 0.12, 0.13, 0.5, 0, 0.05, 0.26));
    g.add(part(mat('#b08d57', { metalness: 0.5 }), 0.17, 0.17, 0.1, 0, 0.05, 0.52));
    g.add(part(glow, 0.09, 0.09, 0.04, 0, 0.05, 0.58));
    g.userData.along = true;
  } else if (kind === 'hammer') {
    g.add(part(M.wood, 0.1, 0.1, 1.25, 0, 0, 0.4));
    g.add(part(M.metal, 0.62, 0.42, 0.42, 0, 0, 1.05));
    g.add(part(glow, 0.66, 0.1, 0.46, 0, 0, 1.05));
    g.add(part(M.main, 0.14, 0.14, 0.12, 0, 0, -0.22));
  } else if (kind === 'bow') {
    // arco longo: fica "de pé" quando o braço esquerdo aponta pra frente
    g.add(part(M.wood, 0.14, 0.12, 0.34, 0, 0, 0));
    for (const s of [-1, 1]) {
      const limb = part(M.wood, 0.12, 0.09, 0.5, 0, 0.05, s * 0.4);
      limb.rotation.x = s * 0.25;
      const tip = part(glow, 0.11, 0.08, 0.36, 0, 0.16, s * 0.76);
      tip.rotation.x = s * 0.55;
      g.add(limb, tip);
    }
    const sMat = mat('#f8fafc');
    const strings = [-1, 1].map(() => {
      const m = new THREE.Mesh(BOX, sMat);
      g.add(m);
      return m;
    });
    const arrow = new THREE.Group();
    arrow.add(part(M.wood, 0.045, 0.95, 0.045, 0, -0.47, 0));
    arrow.add(part(glow, 0.06, 0.12, 0.06, 0, -0.98, 0, OCTA));
    arrow.add(part(M.main, 0.02, 0.14, 0.12, 0, -0.04, 0));
    g.add(arrow);
    // puxa a corda: 0 = solta, 1 = toda esticada
    g.userData.setPull = (p) => {
      const ny = 0.22 + p * 0.5;
      const dy = p * 0.5;
      const len = Math.hypot(dy, 0.9);
      strings.forEach((m, i) => {
        const s = i ? 1 : -1;
        m.scale.set(0.025, 0.025, len);
        m.position.set(0, 0.22 + dy / 2, s * 0.45);
        m.rotation.x = s * Math.asin(dy / len);
      });
      arrow.visible = p > 0.04;
      arrow.position.set(0, ny, 0);
    };
    g.userData.setPull(0);
  } else if (kind === 'stingers') {
    g.add(part(M.dark, 0.1, 0.1, 0.16, 0, 0, 0.02));
    g.add(part(steel, 0.1, 0.04, 0.56, 0, 0, 0.36));
    g.add(part(glow, 0.05, 0.05, 0.14, 0, 0, 0.72, OCTA));
    g.userData.along = true;
  } else if (kind === 'club') {
    // clava de cacto
    g.add(part(M.wood, 0.09, 0.09, 0.4, 0, 0, 0.1));
    g.add(part(M.main, 0.24, 0.24, 0.6, 0, 0, 0.6));
    const thorn = mat('#ecfccb');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(part(thorn, 0.05, 0.05, 0.05, Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.42 + (i % 3) * 0.17));
    }
    g.add(part(mat('#f472b6'), 0.14, 0.14, 0.1, 0, 0, 0.93));
  } else if (kind === 'staff') {
    // cajado d'água: comprido, acompanha o braço
    g.add(part(M.wood, 0.07, 1.7, 0.07, 0, 0.3, 0.06));
    const orb = part(glowMat(color, 0.85), 0.15, 0.15, 0.15, 0, 1.3, 0.06, SPHERE);
    g.add(orb);
    g.add(part(M.main, 0.3, 0.07, 0.07, 0, 1.08, 0.06));
    g.add(part(M.main, 0.07, 0.24, 0.07, -0.15, 1.2, 0.06));
    g.add(part(M.main, 0.07, 0.24, 0.07, 0.15, 1.2, 0.06));
    g.userData.orb = orb;
  } else if (kind === 'sword') {
    // peixeira: lâmina larga de um gume
    g.add(part(M.wood, 0.08, 0.1, 0.24, 0, 0, 0));
    g.add(part(M.dark, 0.2, 0.08, 0.06, 0, 0, 0.14));
    g.add(part(steel, 0.05, 0.2, 0.9, 0, 0.02, 0.62));
    const tip = part(steel, 0.05, 0.14, 0.2, 0, -0.01, 1.14);
    tip.rotation.x = 0.35;
    g.add(tip);
  } else if (kind === 'torch') {
    g.add(part(M.wood, 0.08, 0.08, 0.8, 0, 0, 0.25));
    g.add(part(mat('#3f2a14'), 0.13, 0.13, 0.16, 0, 0, 0.62));
    const outer = part(glowMat(color, 0.85), 0.2, 0.2, 0.32, 0, 0, 0.8, OCTA);
    const inner = part(glowMat('#ffe08a', 0.95), 0.1, 0.1, 0.18, 0, 0, 0.78, OCTA);
    outer.castShadow = inner.castShadow = false;
    g.add(outer, inner);
    g.userData.orb = outer;
    g.userData.flame = inner;
  }
  return g;
}

function hat(kind, M, color) {
  const g = new THREE.Group();
  if (kind === 'visor') {
    // chapéu de couro de aba larga com óculos
    g.add(part(mat('#7c4a21'), 0.74, 0.05, 0.74, 0, 0.3, 0));
    g.add(part(mat('#7c4a21'), 0.42, 0.2, 0.42, 0, 0.4, 0));
    g.add(part(M.main, 0.44, 0.06, 0.44, 0, 0.34, 0));
    g.add(part(glowMat(color, 0.95), 0.4, 0.09, 0.05, 0, 0.14, 0.2));
  } else if (kind === 'helm') {
    g.add(part(M.metal, 0.52, 0.26, 0.52, 0, 0.28, 0));
    g.add(part(M.main, 0.1, 0.3, 0.4, 0, 0.48, 0));
    g.add(part(M.metal, 0.12, 0.2, 0.06, 0, 0.1, 0.22));
  } else if (kind === 'tufts') {
    // capuz com tufos de coruja
    g.add(part(M.main, 0.5, 0.2, 0.5, 0, 0.3, -0.02));
    g.add(part(M.main, 0.5, 0.4, 0.1, 0, 0.1, -0.24));
    g.add(part(M.main, 0.1, 0.26, 0.1, -0.2, 0.48, 0));
    g.add(part(M.main, 0.1, 0.26, 0.1, 0.2, 0.48, 0));
    g.add(part(mat('#fef3c7'), 0.12, 0.12, 0.04, -0.1, 0.12, 0.2));
    g.add(part(mat('#fef3c7'), 0.12, 0.12, 0.04, 0.1, 0.12, 0.2));
  } else if (kind === 'antennae') {
    g.add(part(M.dark, 0.48, 0.12, 0.48, 0, 0.28, 0));
    g.add(part(M.dark, 0.05, 0.4, 0.05, -0.12, 0.5, 0.1));
    g.add(part(M.dark, 0.05, 0.4, 0.05, 0.12, 0.5, 0.1));
    g.add(part(M.main, 0.1, 0.1, 0.1, -0.12, 0.72, 0.12));
    g.add(part(M.main, 0.1, 0.1, 0.1, 0.12, 0.72, 0.12));
  } else if (kind === 'spikes') {
    for (let i = 0; i < 5; i++) g.add(part(M.main, 0.08, 0.3, 0.08, -0.2 + i * 0.1, 0.42 + (i % 2) * 0.08, 0));
    g.add(part(mat('#f472b6'), 0.16, 0.12, 0.16, 0.12, 0.36, 0.1));
  } else if (kind === 'hair') {
    g.add(part(M.main, 0.5, 0.16, 0.5, 0, 0.3, 0));
    g.add(part(M.main, 0.5, 0.9, 0.12, 0, -0.14, -0.24));
    g.add(part(glowMat('#e0f2fe', 0.9), 0.3, 0.06, 0.06, 0, 0.3, 0.22));
  } else if (kind === 'flame') {
    const f = part(glowMat(color, 0.85), 0.3, 0.45, 0.3, 0, 0.45, 0, OCTA);
    g.add(f);
    g.userData.flame = f;
  } else if (kind === 'gator') {
    const teeth = mat('#f8fafc');
    g.add(part(M.skin, 0.32, 0.12, 0.44, 0, 0.1, 0.36));
    g.add(part(M.skin, 0.22, 0.06, 0.1, 0, 0.18, 0.54));
    for (const x of [-0.08, 0.08]) g.add(part(M.dark, 0.04, 0.03, 0.04, x, 0.17, 0.57));
    for (let i = 0; i < 4; i++) for (const x of [-0.13, 0.13]) g.add(part(teeth, 0.04, 0.07, 0.04, x, 0.02, 0.22 + i * 0.1));
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.04, 0.16);
    jaw.add(part(M.skin, 0.28, 0.07, 0.42, 0, -0.03, 0.2));
    for (let i = 0; i < 4; i++) for (const x of [-0.11, 0.11]) jaw.add(part(teeth, 0.035, 0.06, 0.035, x, 0.02, 0.08 + i * 0.1));
    g.add(jaw);
    g.userData.jaw = jaw;
    const eyes = [];
    for (const x of [-0.11, 0.11]) {
      g.add(part(M.skin, 0.12, 0.1, 0.12, x, 0.33, 0.1));
      g.add(part(mat('#fde047'), 0.09, 0.06, 0.04, x, 0.35, 0.16));
      const glow = part(glowMat('#ef4444', 0.95), 0.1, 0.07, 0.05, x, 0.35, 0.165);
      glow.castShadow = false;
      glow.visible = false;
      g.add(glow);
      eyes.push(glow);
    }
    g.userData.eyes = eyes;
    const hair = mat('#facc15');
    g.add(part(hair, 0.44, 0.22, 0.24, 0, 0.32, -0.12));
    g.add(part(hair, 0.4, 0.5, 0.1, 0, 0.06, -0.24));
    g.add(part(hair, 0.12, 0.34, 0.1, -0.2, 0.02, -0.16));
    g.add(part(hair, 0.12, 0.34, 0.1, 0.2, 0.02, -0.16));
    g.add(part(mat('#7e22ce'), 0.46, 0.06, 0.06, 0, 0.36, 0.0));
  } else if (kind === 'firehair') {
    const flames = [];
    const spots = [[0, 0.42, -0.02, 0.3, 0.55], [-0.15, 0.36, -0.05, 0.2, 0.42], [0.15, 0.36, -0.05, 0.2, 0.42], [0, 0.3, -0.2, 0.26, 0.5], [-0.12, 0.22, -0.2, 0.16, 0.38], [0.12, 0.22, -0.2, 0.16, 0.38], [0, 0.48, 0.1, 0.16, 0.3]];
    spots.forEach(([x, y, z, w, h], i) => {
      const f = part(glowMat(i % 2 ? '#ffb020' : color, 0.9), w, h, w, x, y, z, OCTA);
      f.castShadow = false;
      f.userData.h = h;
      f.userData.ph = i * 1.7;
      g.add(f);
      flames.push(f);
    });
    const core = part(glowMat('#ffe08a', 0.95), 0.14, 0.3, 0.14, 0, 0.36, -0.06, OCTA);
    core.castShadow = false;
    g.add(core);
    g.userData.flames = flames;
  } else if (kind === 'boater') {
    // chapéu de aba reta com fita branca: o boto nunca tira, é o que esconde o furo no alto da cabeça.
    // Vai na cor do herói porque, de cima, o chapéu é quase tudo o que se vê dele.
    const pink = mat(color);
    g.add(part(pink, 0.82, 0.05, 0.82, 0, 0.31, 0));
    g.add(part(pink, 0.44, 0.2, 0.44, 0, 0.43, 0));
    g.add(part(mat('#f8fafc'), 0.47, 0.08, 0.47, 0, 0.37, 0));
  } else if (kind === 'cap') {
    g.add(part(mat('#dc2626'), 0.46, 0.18, 0.46, 0, 0.3, 0));
    const tip = part(mat('#dc2626'), 0.22, 0.32, 0.22, 0, 0.5, -0.08);
    tip.rotation.x = -0.5;
    g.add(tip);
  }
  return g;
}

// ---------- animações ----------
// Cada quadro monta uma "pose" (ângulos-alvo das juntas) e o modelo persegue esses alvos.
// Braço: rotação x negativa levanta pra frente (-1.57 = estendido, -3.1 = pra cima).
const POSE = { aRx: 0, aRz: 0, aLx: 0, aLz: 0, twist: 0, pitch: 0, spin: 0, hop: 0, pulse: 1, wR: 0, pull: 0, glow: 0, jaw: 0 };
const ZERO = { ...POSE };
// do preparo (a) até o golpe (b), acelerando
const sw = (a, b, pre) => a + (b - a) * pre * pre;
const arcOf = (t) => Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);

// Estilo por arma: postura parada, ataque básico, pose de arrancada e as quatro habilidades.
// attack(P, pre, post, combo): pre vai de 0 a 1 até o golpe sair, post de 0 a 1 depois dele.
// cast: [preparo mínimo, duração da soltura, fn(P, pw, pr, e, arc)] — pw = preparo 0..1, pr = soltura 0..1.
const STYLES = {
  // garrucha: braço estendido mirando, tiro seco com coice
  pistol: {
    idle(P) {
      P.aRx = -1.4;
    },
    attack(P, pre, post) {
      const kick = arcOf(post);
      P.aRx = -1.5 - kick * 0.75;
      P.pitch = -kick * 0.2;
      P.twist = -0.15 + kick * 0.2;
    },
    dash(P) {
      P.aRx = -1.4;
      P.aLx = 1.0;
    },
    q: [0.1, 0.3, (P, pw, pr, e, arc) => {
      // Rajada: firma a arma com as duas mãos e solta
      P.aRx = -1.5 - arc * 0.5;
      P.aLx = -1.35;
      P.aLz = -0.35;
      P.pitch = 0.12 * pw - arc * 0.25;
    }],
    e: [0.1, 0.3, (P, pw, pr, e) => {
      // Bombinha: arremesso por cima com a mão livre
      P.aLx = -3.2 * pw + e * 2.4;
      P.twist = -0.5 * pw + e * 0.9;
      P.pitch = e * 0.2;
    }],
    r: [0.25, 0.4, (P, pw, pr, e, arc) => {
      // Chuva de Faíscas: mira pro alto, tiro com coice forte
      P.aRx = -2.5 * pw - arc * 0.5;
      P.aLx = -2.2 * pw;
      P.aLz = -0.3;
      P.pitch = -0.3 * pw - arc * 0.25;
      P.hop = -0.08 * pw;
    }],
  },
  // arco longo: braço esquerdo segura o arco, o direito puxa e solta a corda
  bow: {
    idle(P) {
      P.aLx = -0.55;
    },
    attack(P, pre, post) {
      P.aLx = -1.55;
      P.twist = 0.45;
      P.pull = post > 0 ? 0 : 0.35 + pre * 0.65;
      P.aRx = post > 0 ? -1.0 : -1.5 + pre * 0.45;
      P.aRz = post > 0 ? 0.9 : 0.25 + pre * 0.5;
    },
    dash(P) {
      P.aLx = -0.9;
      P.aRx = 0.9;
    },
    q: [0.22, 0.25, (P, pw, pr) => {
      // Agulha: puxada longa e funda, flecha reta
      P.aLx = -1.55;
      P.twist = 0.6;
      P.pitch = 0.12 * pw;
      P.pull = pr > 0 ? 0 : pw;
      P.aRx = pr > 0 ? -0.9 : -1.5 + pw * 0.5;
      P.aRz = pr > 0 ? 1.0 : 0.3 + pw * 0.6;
    }],
    w: [0.12, 0.3, (P, pw, pr, e) => {
      // Rede: joga a rede com a mão direita, arco abaixado
      P.aLx = -0.4;
      P.aRx = -3.0 * pw + e * 2.3;
      P.aRz = 0.5 * (1 - e);
      P.twist = 0.6 * pw - e * 1.0;
    }],
    e: [0, 0.3, (P, pw, pr, e, arc) => {
      // Revoada: encolhe e abre os braços como asas
      P.pulse = 0.35 + 0.65 * e + 0.2 * arc;
      P.aRz = 1.3 * (1 - e);
      P.aLz = -1.3 * (1 - e);
    }],
    r: [0.9, 0.35, (P, pw, pr, e, arc) => {
      // Tiro Certeiro: ajoelha, estica tudo e segura a mira
      P.aLx = -1.55;
      P.twist = 0.75;
      P.hop = -0.22 * (pr > 0 ? 1 - e : Math.min(1, pw * 4));
      P.pitch = 0.18;
      P.pull = pr > 0 ? 0 : Math.min(1, pw * 3);
      P.aRx = pr > 0 ? -0.8 : -1.5 + Math.min(1, pw * 3) * 0.55;
      P.aRz = pr > 0 ? 1.1 + arc * 0.2 : 0.3 + Math.min(1, pw * 3) * 0.6;
    }],
  },
  // martelo de trovão: sempre nas duas mãos, golpes pesados por cima
  hammer: {
    twoHand: true,
    idle(P) {
      P.aRx = -0.75;
    },
    attack(P, pre, post, combo) {
      if (combo === 1) {
        // varrida de lado
        P.aRx = -1.45;
        P.wR = 1.2;
        P.twist = sw(-1.2, 1.1, pre);
      } else {
        // por cima da cabeça
        P.aRx = sw(-3.0, 0.15, pre);
        P.pitch = sw(-0.3, 0.55, pre);
        P.hop = arcOf(pre) * 0.12;
      }
    },
    dash(P) {
      P.aRx = -3.0;
      P.pitch = -0.2;
    },
    land: 'slam',
    slam: [0, 0.3, (P, pw, pr, e) => {
      P.aRx = -3.0 + e * 3.2;
      P.pitch = e * 0.7;
    }],
    q: [0.18, 0.3, (P, pw, pr, e) => {
      // Martelada: varrida larga em leque
      P.aRx = -1.45;
      P.wR = 1.25;
      P.twist = -1.3 * pw + e * 2.5;
      P.pitch = 0.2;
    }],
    w: [0, 0.5, (P, pw, pr, e, arc) => {
      // Couraça: martelo de pé na frente do peito
      P.aRx = -1.25;
      P.wR = -0.3;
      P.hop = -0.1 * arc;
      P.pulse = 1 + 0.1 * arc;
    }],
    r: [0.15, 0.75, (P, pw, pr) => {
      // Trovoada: ergue o martelo, segura, e desce quando o raio cai
      const down = Math.max(0, (pr - 0.6) / 0.4);
      P.aRx = -3.1 * pw + down * down * 3.3;
      P.pitch = -0.3 * pw + down * down * 0.95;
      P.hop = 0.25 * pw * (1 - down);
      P.glow = pw;
    }],
  },
  // duas adagas-ferrão: estocadas rápidas alternadas
  stingers: {
    idle(P, moving) {
      if (!moving) {
        P.aRx = -0.45;
        P.aLx = -0.45;
      }
    },
    attack(P, pre, post, combo) {
      const right = combo % 2 === 0;
      const stab = sw(-0.5, -1.65, pre);
      const other = -0.5 + pre * 0.9;
      P.aRx = right ? stab : other;
      P.aLx = right ? other : stab;
      P.twist = (right ? 1 : -1) * sw(0.6, -0.55, pre);
      P.pitch = pre * 0.25;
    },
    dash(P) {
      P.aRx = -1.6;
      P.aLx = -1.6;
      P.pitch = 0.3;
    },
    q: [0, 0.3, (P, pw, pr, e, arc) => {
      // Ferroada: mergulho com as duas adagas na frente
      P.aRx = -1.65;
      P.aLx = -1.65;
      P.pitch = 0.45 * arc;
    }],
    w: [0, 0.5, (P, pw, pr, e, arc) => {
      // Adrenalina: abre os braços e treme de energia
      P.aRx = -0.8;
      P.aLx = -0.8;
      P.aRz = 1.1 * arc;
      P.aLz = -1.1 * arc;
      P.hop = 0.25 * arc;
      P.pulse = 1 + 0.1 * arc;
      P.glow = arc;
    }],
    e: [0.08, 0.4, (P, pw, pr, e, arc) => {
      // Enxame: gira com as adagas abertas
      P.spin = e * Math.PI * 2;
      P.aRx = -1.2;
      P.aLx = -1.2;
      P.aRz = 1.3 * arc;
      P.aLz = -1.3 * arc;
    }],
    r: [0, 0.4, (P, pw, pr, e) => {
      // Ferrão Mortal: salta e crava as duas de cima pra baixo
      P.aRx = -3.0 + e * 2.0;
      P.aLx = -3.0 + e * 2.0;
      P.hop = 0.55 * arcOf(pr * 0.8);
      P.pitch = e * 0.6;
    }],
  },
  // escudo grande no braço esquerdo e clava de cacto no direito
  shield: {
    idle(P) {
      P.aLx = -0.55;
    },
    attack(P, pre, post, combo) {
      if (combo === 2) {
        // pancada de escudo
        P.aLx = sw(-0.3, -1.45, pre);
        P.twist = sw(0.7, -0.6, pre);
        P.pitch = pre * 0.25;
      } else {
        // clavada curta
        P.aLx = -0.7;
        P.aRx = sw(-2.7, 0.1, pre);
        P.twist = sw(0.45, -0.5, pre);
        P.pitch = pre * 0.2;
      }
    },
    dash(P) {
      // investida atrás do escudo
      P.aLx = -1.35;
      P.aRx = 0.7;
      P.pitch = 0.35;
      P.twist = -0.35;
    },
    q: [0.18, 0.3, (P, pw, pr, e) => {
      // Espinhos: recolhe o escudo e empurra pra frente, soltando os espinhos
      P.aLx = -0.3 * pw - e * 1.3;
      P.twist = 0.6 * pw - e * 1.2;
      P.pitch = e * 0.25;
    }],
    w: [0, 0.6, (P, pw, pr, e, arc) => {
      // Casca Grossa: se encolhe atrás do escudo
      P.aLx = -1.2;
      P.aRx = -0.9;
      P.aRz = -0.4;
      P.hop = -0.18 * arc;
      P.pitch = 0.3 * arc;
      P.pulse = 1 + 0.08 * arc;
    }],
    e: [0.1, 0.35, (P, pw, pr, e) => {
      // Raízes: crava a clava no chão
      P.aRx = -3.0 * pw + e * 3.2;
      P.aLx = -0.9;
      P.pitch = -0.2 * pw + e * 0.75;
      P.hop = 0.2 * pw * (1 - e) - 0.12 * e;
    }],
    r: [0.18, 0.2, (P, pw) => {
      // Florada: abaixa e põe o escudo na frente antes de investir
      P.aLx = -1.35 * pw;
      P.pitch = 0.3 * pw;
      P.hop = -0.15 * pw;
      P.twist = -0.35 * pw;
    }],
  },
  // cajado d'água: gestos largos, a mão livre acompanha
  staff: {
    idle(P) {
      P.aRx = -0.4;
    },
    attack(P, pre, post) {
      // estala a ponta do cajado pra frente
      P.aRx = sw(-0.7, -1.5, pre) + arcOf(post) * 0.25;
      P.aLx = -0.7;
      P.aLz = -0.4;
      P.twist = sw(0.3, -0.25, pre);
      P.glow = 1 - post;
    },
    dash(P) {
      P.aRx = -1.5;
      P.aLx = 0.8;
    },
    q: [0.18, 0.35, (P, pw, pr, e) => {
      // Onda: varre o cajado de um lado ao outro, rente ao chão
      P.aRx = -1.35;
      P.twist = -1.1 * pw + e * 2.1;
      P.pitch = 0.25;
      P.aLz = -0.8;
      P.glow = 1;
    }],
    w: [0.12, 0.45, (P, pw, pr, e, arc) => {
      // Água Viva: ergue o cajado, a água desce como bênção
      P.aRx = -2.9 * pw;
      P.aLx = -2.5 * pw;
      P.aLz = -0.5;
      P.hop = 0.18 * arc;
      P.glow = 1;
    }],
    e: [0, 0.5, (P, pw, pr, e, arc) => {
      // Bolha: abre os braços e a bolha cresce
      P.aRx = -1.3;
      P.aLx = -1.3;
      P.aRz = 1.2 * arc;
      P.aLz = -1.2 * arc;
      P.pulse = 1 + 0.12 * arc;
      P.glow = arc;
    }],
    r: [0.28, 0.45, (P, pw, pr, e, arc) => {
      // Maré Alta: puxa a água pra trás da cabeça e empurra com tudo
      P.aRx = -3.0 * pw + e * 1.5;
      P.aLx = -3.0 * pw + e * 1.5;
      P.pitch = -0.35 * pw + e * 0.8;
      P.hop = 0.15 * pw * (1 - e);
      P.glow = 1;
    }],
  },
  // mago de fogo: sem arma, conjura com as mãos em chamas
  hands: {
    idle(P, moving, time) {
      P.aRx = -0.55;
      P.aLx = -0.55;
      P.aRz = 0.3;
      P.aLz = -0.3;
      P.hop = 0.05 + Math.sin(time * 3) * 0.05;
      P.glow = 0.35;
    },
    attack(P, pre, post, combo) {
      // empurra uma palma de cada vez
      const right = combo % 2 === 0;
      const push = sw(-0.3, -1.6, pre);
      P.aRx = right ? push : -0.5;
      P.aLx = right ? -0.5 : push;
      P.twist = (right ? 1 : -1) * sw(0.45, -0.4, pre);
      P.glow = 1;
    },
    dash(P) {
      // Serpentear: deita o corpo e desliza
      P.pitch = 0.75;
      P.aRx = 1.1;
      P.aLx = 1.1;
      P.glow = 1;
    },
    q: [0.12, 0.3, (P, pw, pr, e) => {
      // Labareda: junta as mãos atrás e empurra a bola de fogo
      P.aRx = -0.3 * pw - e * 1.3;
      P.aLx = -0.3 * pw - e * 1.3;
      P.aRz = 0.5 * pw * (1 - e);
      P.aLz = -0.5 * pw * (1 - e);
      P.pitch = -0.15 * pw + e * 0.45;
      P.glow = 1;
    }],
    w: [0.12, 0.5, (P, pw, pr, e) => {
      // Fogo-fátuo: aponta pro céu e depois pro chão
      P.aRx = -3.0 * pw + e * 1.9;
      P.aLx = -0.4;
      P.twist = 0.2;
      P.glow = 1;
    }],
    r: [0.2, 0.7, (P, pw, pr, e, arc) => {
      // Incêndio: ergue os dois braços, flutua e segura
      P.aRx = -2.8 * pw;
      P.aLx = -2.8 * pw;
      P.aRz = 0.75;
      P.aLz = -0.75;
      P.hop = 0.4 * arc;
      P.pulse = 1 + 0.1 * arc;
      P.pitch = -0.2 * arc;
      P.glow = 1;
    }],
  },
  // peixeira: cortes largos de um lado pro outro e giros
  sword: {
    idle(P) {
      P.aRx = -0.35;
    },
    attack(P, pre, post, combo) {
      if (combo === 2) {
        // de baixo pra cima
        P.aRx = sw(0.35, -2.7, pre);
        P.twist = sw(0.4, -0.3, pre);
        P.hop = arcOf(pre) * 0.15;
      } else {
        // corte horizontal, alternando o lado
        const s = combo === 0 ? 1 : -1;
        P.aRx = -1.45;
        P.wR = 1.25;
        P.aRz = 0.35;
        P.twist = s * sw(-1.25, 1.15, pre);
        P.pitch = 0.15;
      }
    },
    dash(P) {
      P.aRx = 1.0;
      P.wR = -0.6;
      P.aLx = -1.2;
    },
    q: [0.08, 0.4, (P, pw, pr, e) => {
      // Redemoinho: giro completo com a lâmina estendida
      P.spin = e * Math.PI * 2;
      P.aRx = -1.5;
      P.wR = 1.3;
      P.aRz = 0.5;
      P.aLz = -0.9;
    }],
    e: [0, 0.5, (P, pw, pr, e, arc) => {
      // Gorro Encantado: mão no gorro e um pulinho
      P.aLx = -2.9;
      P.aLz = 0.35;
      P.hop = 0.35 * arc;
      P.pulse = 1 + 0.1 * arc;
    }],
    r: [0.08, 0.7, (P, pw, pr, e, arc) => {
      // Ventania: dois giros com os braços abertos
      P.spin = e * Math.PI * 4;
      P.aRx = -1.5;
      P.wR = 1.3;
      P.aRz = 0.6;
      P.aLx = -1.4;
      P.aLz = -1.1;
      P.hop = 0.2 * arc;
    }],
  },
};

STYLES.claws = {
  idle(P) {
    P.aRx = -0.5;
    P.aLx = -0.5;
    P.aRz = 0.25;
    P.aLz = -0.25;
    P.pitch = 0.12;
  },
  attack(P, pre, post, combo) {
    if (combo === 2) {
      P.pitch = sw(-0.25, 0.55, pre);
      P.aRx = -0.3;
      P.aLx = -0.3;
      P.aRz = 0.6;
      P.aLz = -0.6;
      P.jaw = post > 0 ? 0 : pre;
      return;
    }
    const right = combo === 0;
    const slash = sw(-2.7, -0.3, pre);
    P.aRx = right ? slash : -0.7;
    P.aLx = right ? -0.7 : slash;
    P.twist = (right ? 1 : -1) * sw(0.55, -0.5, pre);
    P.pitch = 0.15 + pre * 0.2;
    P.jaw = post > 0 ? 0.4 * (1 - post) : pre * 0.4;
  },
  dash(P) {
    P.pitch = 0.75;
    P.aRx = -1.7;
    P.aLx = -1.7;
    P.jaw = 1;
  },
  q: [0.08, 0.45, (P, pw, pr, e, arc) => {
    P.spin = e * Math.PI * 2;
    P.aRx = -1.5;
    P.aLx = -1.5;
    P.aRz = 1.2;
    P.aLz = -1.2;
    P.jaw = arc;
    P.hop = 0.1 * arc;
  }],
  w: [0, 0.45, (P, pw, pr, e, arc) => {
    P.aRx = -2.5 + arc;
    P.aLx = -2.5 + arc;
    P.jaw = arc;
    P.pitch = -0.25 * arc;
    P.pulse = 1 + 0.08 * arc;
    P.glow = 1;
  }],
  r: [0.2, 0.8, (P, pw, pr, e, arc) => {
    P.aRx = -2.9 * pw;
    P.aLx = -2.9 * pw;
    P.aRz = 0.9;
    P.aLz = -0.9;
    P.pitch = -0.45 * pw * (1 - e * 0.5);
    P.jaw = pw;
    P.hop = 0.3 * arc;
    P.pulse = 1 + 0.2 * arc;
  }],
};

STYLES.torch = {
  idle(P) {
    P.aRx = -0.9;
    P.glow = 0.3;
  },
  attack(P, pre, post) {
    P.aRx = sw(-2.6, -1.2, pre) + arcOf(post) * 0.2;
    P.twist = sw(0.4, -0.3, pre);
    P.aLx = -0.6;
    P.glow = 1 - post * 0.5;
  },
  dash(P) {
    P.aRx = -1.2;
    P.pitch = 0.4;
  },
  q: [0.15, 0.3, (P, pw, pr, e) => {
    P.aRx = -3.1 * pw + e * 2.2;
    P.twist = 0.6 * pw - e * 1.1;
    P.pitch = e * 0.25;
    P.glow = 1;
  }],
  w: [0.15, 0.4, (P, pw, pr, e) => {
    P.aRx = -1.3;
    P.twist = -1.2 * pw + e * 2.4;
    P.pitch = 0.3;
    P.hop = -0.1;
    P.glow = 1;
  }],
  e: [0, 0.3, (P, pw, pr, e, arc) => {
    P.pulse = 0.4 + 0.6 * e + 0.2 * arc;
    P.aRz = 1.1 * (1 - e);
    P.aLz = -1.1 * (1 - e);
  }],
  r: [0.3, 0.6, (P, pw, pr, e, arc) => {
    P.aRx = -3.0 * pw + e * 2.4;
    P.aLx = -2.8 * pw + e * 1.5;
    P.aLz = -0.6;
    P.hop = 0.35 * pw * (1 - e);
    P.pitch = -0.3 * pw + e * 0.6;
    P.glow = 1;
    P.pulse = 1 + 0.1 * arc;
  }],
};

// pérola na mão direita: galã de festa, tudo com um gesto só
STYLES.pearl = {
  idle(P, moving, time) {
    P.aRx = -0.9;
    P.aRz = 0.25;
    P.aLx = 0.25;
    P.aLz = -0.2;
    P.hop = Math.sin(time * 2.4) * 0.03;
    P.glow = 0.3;
  },
  attack(P, pre) {
    // peteleco de água com a mão da pérola
    P.aRx = sw(-0.5, -1.7, pre);
    P.twist = sw(0.4, -0.35, pre);
    P.glow = 1;
  },
  dash(P) {
    // Mergulho: corpo deitado, braços pra trás
    P.pitch = 0.95;
    P.aRx = 1.3;
    P.aLx = 1.3;
    P.glow = 1;
  },
  q: [0.15, 0.35, (P, pw, pr, e) => {
    // Pérola do Rio: arremesso por baixo, braço acompanha até o fim
    P.aRx = 0.9 * pw - e * 2.6;
    P.twist = 0.5 * pw - e * 0.9;
    P.pitch = 0.1 * pw + e * 0.25;
    P.glow = 1;
  }],
  w: [0, 0.5, (P, pw, pr, e, arc) => {
    // Cardume: rodopia com os braços abertos
    P.spin = e * Math.PI * 2;
    P.aRx = -1.5;
    P.aLx = -1.5;
    P.aRz = 0.9;
    P.aLz = -0.9;
    P.hop = 0.18 * arc;
    P.glow = 1;
  }],
  e: [0.15, 0.4, (P, pw, pr, e, arc) => {
    // Galanteio: mão na boca e solta o beijo
    P.aLx = -2.5 * pw + e * 1.1;
    P.aLz = 0.55 * pw * (1 - e);
    P.aRx = -0.4;
    P.twist = -0.3 * pw + e * 0.5;
    P.pitch = -0.1 * pw + arc * 0.2;
    P.glow = 1;
  }],
};

// poses genéricas (feitiços de todo mundo e o que um estilo não definir)
const GENERIC = {
  flex: [0, 0.5, (P, pw, pr, e, arc) => {
    P.aRx = -2.9;
    P.aLx = -2.9;
    P.aRz = 0.7 * arc;
    P.aLz = -0.7 * arc;
    P.hop = 0.32 * arc;
    P.pulse = 1 + 0.12 * arc;
  }],
  pop: [0, 0.32, (P, pw, pr, e, arc) => {
    P.pulse = 0.3 + 0.7 * e + 0.25 * arc;
    P.aRz = 0.9 * (1 - e);
    P.aLz = -0.9 * (1 - e);
  }],
  throw: [0.08, 0.26, (P, pw, pr, e, arc) => {
    P.aRx = -3.3 * pw + e * 2.2;
    P.twist = 0.55 * pw - e * 1.1;
    P.pitch = arc * 0.28;
  }],
};
const GENERIC_OF = { blink: 'pop', self: 'flex', ally: 'flex' };

export class HeroModel {
  constructor(def, team, isMe) {
    this.def = def;
    const look = def.look;
    this.style = STYLES[look.weapon] || STYLES.hands;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const scale = (look.scale || 1) * 1.25;
    this.body.scale.setScalar(scale);
    this.baseScale = scale;
    this.kx = 0;
    this.kz = 0;
    this.lunge = 0;
    this.squash = 0;
    this.anim = null;
    this.attackDur = 0.2;
    this.attackHit = 0.6;
    this.combo = 0;
    this.lean = 0;
    const color = new THREE.Color(look.body || def.color);
    this.mats = {
      main: new THREE.MeshStandardMaterial({ color: look.suit || color, roughness: 0.65, flatShading: true }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2d3a', roughness: 0.85, flatShading: true }),
      skin: new THREE.MeshStandardMaterial({ color: look.skin || (look.oneLeg ? '#5b3a29' : '#e8b48a'), roughness: 0.8, flatShading: true }),
      metal: mat('#3a4049', { metalness: 0.4, roughness: 0.5 }),
      wood: mat('#7c5a3a'),
    };
    if (look.hat === 'spikes') this.mats.skin = this.mats.main;
    const M = this.mats;
    const wide = look.bulk || 1;

    this.hips = new THREE.Group();
    this.hips.position.y = 0.8;
    this.body.add(this.hips);
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    if (look.robe) {
      // túnica comprida no lugar das pernas
      this.robe = new THREE.Group();
      this.robe.add(part(M.main, 0.5, 0.5, 0.36, 0, -0.25, 0));
      this.robe.add(part(M.dark, 0.6, 0.34, 0.44, 0, -0.62, 0));
      this.hips.add(this.robe);
    } else if (look.oneLeg) {
      this.legL.add(part(M.dark, 0.24, 0.8, 0.26, 0, -0.4, 0));
      this.legL.add(part(M.skin, 0.24, 0.12, 0.34, 0, -0.76, 0.04));
      this.hips.add(this.legL);
      this.oneLeg = true;
    } else {
      this.legL.position.x = -0.14 * wide;
      this.legR.position.x = 0.14 * wide;
      for (const l of [this.legL, this.legR]) {
        l.add(part(look.backFeet ? M.skin : M.dark, 0.2 * wide, 0.8, 0.24, 0, -0.4, 0));
        if (look.backFeet) {
          l.add(part(M.skin, 0.22, 0.12, 0.4, 0, -0.75, -0.12));
          for (const x of [-0.06, 0, 0.06]) l.add(part(M.skin, 0.05, 0.06, 0.06, x, -0.77, -0.34));
        } else l.add(part(look.skin ? M.skin : M.main, 0.22 * wide, 0.12, 0.32, 0, -0.75, 0.04));
      }
      this.hips.add(this.legL, this.legR);
    }
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    this.torso.add(part(M.main, 0.56 * wide, 0.6, 0.34 * wide, 0, 0.3, 0));
    this.torso.add(part(M.dark, 0.58 * wide, 0.1, 0.36 * wide, 0, 0.05, 0));
    if (look.hat === 'spikes') {
      for (let i = 0; i < 6; i++) this.torso.add(part(mat('#d9f99d'), 0.06, 0.06, 0.18, (i % 3) * 0.2 - 0.2, 0.2 + Math.floor(i / 3) * 0.25, 0.2 * wide));
    }
    this.head = new THREE.Group();
    this.head.position.y = 0.74;
    this.torso.add(this.head);
    this.head.add(part(M.skin, 0.36, 0.36, 0.36, 0, 0.12, 0));
    this.head.add(part(M.dark, 0.08, 0.06, 0.02, -0.08, 0.15, 0.19));
    this.head.add(part(M.dark, 0.08, 0.06, 0.02, 0.08, 0.15, 0.19));
    this.hat = hat(look.hat, M, def.color);
    this.head.add(this.hat);
    if (look.snout) {
      // bico comprido de boto, com a ponta mais clara
      this.head.add(part(M.skin, 0.16, 0.12, 0.3, 0, 0.04, 0.3));
      this.head.add(part(mat('#ffd6e0'), 0.12, 0.08, 0.1, 0, 0.03, 0.48));
    }
    if (look.pipe) {
      this.head.add(part(M.wood, 0.05, 0.05, 0.26, 0.08, 0.04, 0.3));
      this.head.add(part(M.wood, 0.1, 0.12, 0.1, 0.08, 0.09, 0.42));
    }

    this.armR = new THREE.Group();
    this.armL = new THREE.Group();
    const ax = 0.36 * wide;
    this.armR.position.set(ax, 0.52, 0);
    this.armL.position.set(-ax, 0.52, 0);
    this.armR.add(part(M.main, 0.15, 0.5, 0.15, 0, -0.22, 0));
    this.armL.add(part(M.main, 0.15, 0.5, 0.15, 0, -0.22, 0));
    this.torso.add(this.armR, this.armL);

    // arma na mão certa
    const w = look.weapon;
    const hold = (arm, g) => {
      g.position.set(0, -0.45, 0.05);
      if (g.userData.along) g.rotation.x = Math.PI / 2;
      arm.add(g);
      return g;
    };
    this.weapon = null;
    this.glows = [];
    if (w === 'bow') {
      this.bow = hold(this.armL, weapon('bow', M, def.color));
    } else if (w === 'stingers') {
      this.weapon = hold(this.armR, weapon('stingers', M, def.color));
      hold(this.armL, weapon('stingers', M, def.color));
    } else if (w === 'shield') {
      this.weapon = hold(this.armR, weapon('club', M, def.color));
      // escudo: fica de pé na frente do corpo mesmo quando o braço se mexe
      this.shieldG = new THREE.Group();
      this.shieldG.position.set(-0.04, -0.3, 0.06);
      this.shieldG.add(part(M.main, 0.68, 0.9, 0.1, 0, 0, 0.2));
      this.shieldG.add(part(M.dark, 0.76, 0.1, 0.12, 0, 0.42, 0.2));
      this.shieldG.add(part(M.dark, 0.76, 0.1, 0.12, 0, -0.42, 0.2));
      const thorn = mat('#ecfccb');
      for (const [x, y] of [[-0.2, 0.2], [0.2, 0.2], [0, 0], [-0.2, -0.2], [0.2, -0.2]]) this.shieldG.add(part(thorn, 0.08, 0.08, 0.16, x, y, 0.3));
      this.armL.add(this.shieldG);
    } else if (w === 'hands') {
      // chamas nas duas mãos
      for (const arm of [this.armR, this.armL]) {
        const fl = part(glowMat(def.color, 0.9), 0.09, 0.14, 0.09, 0, -0.56, 0.04, OCTA);
        fl.castShadow = false;
        arm.add(fl);
        this.glows.push(fl);
      }
    } else if (w === 'claws') {
      this.furyBits = [];
      const claw = mat('#f1f5f9');
      for (const arm of [this.armR, this.armL]) {
        arm.add(part(M.skin, 0.2, 0.14, 0.2, 0, -0.5, 0.02));
        for (const x of [-0.06, 0, 0.06]) {
          const c = part(claw, 0.04, 0.16, 0.04, x, -0.6, 0.09);
          c.rotation.x = 0.5;
          arm.add(c);
        }
        const fl = part(glowMat('#ef4444', 0.85), 0.14, 0.2, 0.14, 0, -0.6, 0.06, OCTA);
        fl.castShadow = false;
        fl.visible = false;
        arm.add(fl);
        this.furyBits.push(fl);
      }
    } else if (w === 'pearl') {
      // mãos da cor da pele saindo do paletó e a pérola brilhando na direita
      for (const arm of [this.armR, this.armL]) arm.add(part(M.skin, 0.13, 0.12, 0.13, 0, -0.5, 0));
      const pearl = part(glowMat('#fff1f5', 0.95), 0.13, 0.13, 0.13, 0, -0.64, 0.05, SPHERE);
      pearl.castShadow = false;
      this.armR.add(pearl);
      this.glows.push(pearl);
    } else if (w && w !== 'none') {
      this.weapon = hold(this.armR, weapon(w, M, def.color));
      if (this.weapon.userData.orb) this.glows.push(this.weapon.userData.orb);
      this.torchFlame = this.weapon.userData.flame || null;
    }
    this.weaponBase = this.weapon ? this.weapon.rotation.x : 0;
    for (const g of this.glows) g.userData.base = g.scale.clone();

    // detalhes de corpo que mudam a silhueta
    const extra = look.extra;
    if (extra === 'poncho') {
      this.torso.add(part(mat('#8b5a2b'), 0.78, 0.2, 0.52, 0, 0.5, 0));
      this.torso.add(part(mat('#8b5a2b'), 0.5, 0.36, 0.06, 0, 0.3, 0.19));
      const belt = part(M.metal, 0.07, 0.62, 0.38, 0, 0.3, 0);
      belt.rotation.z = 0.75;
      this.torso.add(belt);
    } else if (extra === 'quiver') {
      this.torso.add(part(M.dark, 0.6, 0.75, 0.06, 0, 0.2, -0.2));
      const q = new THREE.Group();
      q.add(part(M.wood, 0.16, 0.55, 0.16, 0, 0, 0));
      for (const x of [-0.04, 0.04]) q.add(part(mat('#fef3c7'), 0.05, 0.18, 0.05, x, 0.34, 0));
      q.position.set(0.14, 0.42, -0.28);
      q.rotation.z = -0.4;
      this.torso.add(q);
    } else if (extra === 'pauldrons') {
      for (const arm of [this.armR, this.armL]) arm.add(part(M.metal, 0.3, 0.2, 0.3, 0, 0.06, 0));
      this.torso.add(part(M.metal, 0.4, 0.3, 0.06, 0, 0.36, 0.19));
    } else if (extra === 'wings') {
      this.wings = [-1, 1].map((s) => {
        const g = new THREE.Group();
        const wing = part(glowMat('#fef9c3', 0.45), 0.6, 0.04, 0.26, s * 0.3, 0, -0.06);
        wing.castShadow = false;
        g.add(wing);
        g.position.set(s * 0.08, 0.5, -0.2);
        this.torso.add(g);
        return g;
      });
      this.torso.add(part(M.dark, 0.58, 0.1, 0.36, 0, 0.25, 0));
      this.torso.add(part(M.dark, 0.58, 0.1, 0.36, 0, 0.45, 0));
    } else if (extra === 'scales') {
      this.torso.add(part(glowMat('#e0f2fe', 0.8), 0.3, 0.08, 0.04, 0, 0.5, 0.18));
      if (this.robe) this.robe.add(part(glowMat(def.color, 0.5), 0.7, 0.08, 0.5, 0, -0.78, 0));
    } else if (extra === 'tail') {
      this.tailG = new THREE.Group();
      this.tailG.position.set(0, -0.1, -0.2);
      let z = 0;
      const segs = [[0.34, 0.26], [0.28, 0.22], [0.22, 0.17], [0.16, 0.12], [0.1, 0.08]];
      segs.forEach(([w, h], i) => {
        const len = 0.3;
        this.tailG.add(part(M.main, w, h, len, 0, -i * 0.07, z - len / 2));
        this.tailG.add(part(M.dark, 0.05, 0.08, 0.08, 0, h / 2 - i * 0.07 + 0.03, z - len / 2));
        z -= len - 0.02;
      });
      this.hips.add(this.tailG);
      this.torso.add(part(mat('#7e22ce'), 0.62 * wide, 0.36, 0.38 * wide, 0, 0.12, 0));
      this.torso.add(part(mat('#581c87'), 0.66 * wide, 0.06, 0.4 * wide, 0, 0.32, 0));
      const bone = mat('#f5f5f4');
      for (let i = 0; i < 5; i++) this.torso.add(part(bone, 0.06, 0.1, 0.05, -0.16 + i * 0.08, 0.5 - Math.abs(i - 2) * 0.03, 0.2 * wide));
    } else if (extra === 'leaves') {
      const leaf = mat('#4d7c0f');
      const leaf2 = mat('#65a30d');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const l = part(i % 2 ? leaf : leaf2, 0.18, 0.34, 0.05, Math.sin(a) * 0.26, -0.12, Math.cos(a) * 0.2);
        l.rotation.y = a;
        l.rotation.x = 0.25;
        this.hips.add(l);
      }
      const band = part(leaf2, 0.07, 0.75, 0.38, 0, 0.32, 0);
      band.rotation.z = -0.7;
      this.torso.add(band);
      for (const arm of [this.armR, this.armL]) arm.add(part(leaf, 0.18, 0.08, 0.18, 0, -0.3, 0));
      this.torso.add(part(mat('#b91c1c'), 0.06, 0.2, 0.06, 0.12, 0.6, 0.18));
    } else if (extra === 'fin') {
      // nadadeira nas costas rasgando o paletó, gravata-borboleta e faixa na cintura
      const pink = mat(def.color);
      const fin = part(M.skin, 0.09, 0.42, 0.36, 0, 0.44, -0.28);
      fin.rotation.x = -0.6;
      this.torso.add(fin);
      this.torso.add(part(pink, 0.22, 0.09, 0.05, 0, 0.53, 0.18));
      this.torso.add(part(pink, 0.6, 0.09, 0.37, 0, 0.07, 0));
    } else if (extra === 'embers') {
      if (this.robe) {
        const tail = part(glowMat(def.color, 0.7), 0.3, 0.2, 0.5, 0, -0.7, -0.35, OCTA);
        tail.castShadow = false;
        this.robe.add(tail);
        this.tail = tail;
      }
      this.torso.add(part(mat('#fbbf24'), 0.6, 0.08, 0.38, 0, 0.5, 0));
    }

    const teamColor = isMe ? '#f4c430' : TEAMS[team].color;
    this.ring = groundRing(teamColor, isMe ? 1.0 : 0.9, isMe ? 0.95 : 0.7);
    this.root.add(this.ring);

    this.fx = new THREE.Group();
    this.root.add(this.fx);
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = part(glowMat('#fde047', 1), 0.12, 0.12, 0.12, Math.cos((i * Math.PI * 2) / 3) * 0.45, 0, Math.sin((i * Math.PI * 2) / 3) * 0.45, OCTA);
      s.castShadow = false;
      this.stars.add(s);
    }
    this.stars.position.y = 2.6;
    this.fx.add(this.stars);
    // encantado: coraçõezinhos rodando sobre a cabeça
    this.hearts = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = part(glowMat('#ff5d8f', 1), 0.13, 0.13, 0.13, Math.cos((i * Math.PI * 2) / 3) * 0.42, 0, Math.sin((i * Math.PI * 2) / 3) * 0.42, SPHERE);
      s.castShadow = false;
      this.hearts.add(s);
    }
    this.hearts.position.y = 2.6;
    this.fx.add(this.hearts);
    // projéteis esperando um alvo (Cardume): ficam rodando em volta do herói
    this.orbit = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = part(glowMat(def.color, 0.95), 0.3, 0.14, 0.14, Math.cos((i * Math.PI * 2) / 3) * 1.1, 0, Math.sin((i * Math.PI * 2) / 3) * 1.1, SPHERE);
      s.rotation.y = -(i * Math.PI * 2) / 3 + Math.PI / 2;
      s.castShadow = false;
      this.orbit.add(s);
    }
    this.orbit.position.y = 1.2;
    this.fx.add(this.orbit);
    this.rootRing = groundRing('#84cc16', 1.05, 0.9);
    this.fx.add(this.rootRing);
    this.slowRing = groundRing('#7dd3fc', 0.75, 0.6);
    this.fx.add(this.slowRing);
    this.shield = new THREE.Mesh(SPHERE, glowMat('#e0f2fe', 0.22));
    this.shield.scale.set(1.15, 1.45, 1.15);
    this.shield.position.y = 1.2;
    this.fx.add(this.shield);
    this.tornado = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.0, 3.2, 20, 1, true), glowMat(def.color, 0.18));
    this.tornado.position.y = 1.6;
    this.fx.add(this.tornado);
    this.buffGlow = groundRing(def.color, 1.3, 0.5);
    this.fx.add(this.buffGlow);
    this.fearMark = new THREE.Group();
    const fearMat = glowMat('#c084fc', 0.95);
    const drop = part(fearMat, 0.16, 0.3, 0.16, 0, 0, 0, OCTA);
    const dot = part(fearMat, 0.1, 0.1, 0.1, 0, -0.3, 0, OCTA);
    drop.castShadow = dot.castShadow = false;
    this.fearMark.add(drop, dot);
    this.fearMark.position.y = 2.8;
    this.fx.add(this.fearMark);
    this.burnFlames = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const f = part(glowMat(i % 2 ? '#ffb020' : '#ff3d00', 0.85), 0.2, 0.42, 0.2, Math.cos(a) * 0.45, 0.4 + (i % 3) * 0.45, Math.sin(a) * 0.45, OCTA);
      f.castShadow = false;
      f.userData.ph = i * 1.3;
      this.burnFlames.add(f);
    }
    this.fx.add(this.burnFlames);
    this.bigAura = new THREE.Group();
    this.bigAura.add(groundRing('#a855f7', 3.8, 0.6));
    const inner = groundRing('#4ade80', 2.6, 0.45);
    this.bigAura.add(inner);
    const swirl = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.0, 1.4, 24, 1, true), glowMat('#a855f7', 0.12));
    swirl.position.y = 0.7;
    this.bigAura.add(swirl);
    this.bigSwirl = swirl;
    this.fx.add(this.bigAura);
    this.bigK = 0;

    this.walk = 0;
    this.attackT = 0;
    this.flash = 0;
    this.deadT = -1;
    this.dashArc = 0;
    this.dashT = 0;
    this.lastX = null;
    this.lastZ = null;
    this.speed = 0;
    this.glowK = 0;
    this.pullK = 0;
  }

  // levou um golpe: pisca, encolhe e é empurrado na direção do golpe
  hit(dx = 0, dz = 0, amt = 0) {
    this.flash = 0.12;
    if (amt > 0) {
      this.kx = dx * amt;
      this.kz = dz * amt;
      this.squash = 1;
    }
  }

  // começou um ataque básico: o golpe sai depois de `windup` segundos e a animação
  // chega no ponto de impacto exatamente aí; o resto é a continuação do movimento
  swing(windup = 0.14) {
    const w = Math.max(0.06, windup);
    this.attackDur = w + 0.16;
    this.attackHit = w / this.attackDur;
    this.attackT = this.attackDur;
    this.combo = (this.combo + 1) % 3;
  }

  // pose de habilidade: prepara durante `windup` segundos e solta em seguida
  play(name, windup = 0) {
    const spec = this.style[name] || GENERIC[name];
    if (!spec) return;
    this.anim = { fn: spec[2], t: 0, w: Math.max(spec[0], windup), r: spec[1] };
    this.attackT = 0;
  }

  // o herói usou uma habilidade (slot q/w/e/r/d/f): cada arma tem as suas poses
  cast(slot, ab, windup = 0) {
    if (this.style[slot] && slot !== 'd' && slot !== 'f') this.play(slot, windup);
    else if (ab.kind !== 'dash') this.play(GENERIC_OF[ab.kind] || 'throw', windup);
  }

  // acertou um golpe: o corpo vai pra frente (ou coiceia, se negativo)
  strike(amt = 1) {
    this.lunge = amt;
  }

  startDash(dur, arc) {
    this.dashT = dur;
    this.dashMax = dur;
    this.dashArc = arc ? 1 : 0;
    this.anim = null;
  }

  update(dt, u, time) {
    const r = this.root;
    if (this.lastX !== null && dt > 0) {
      const sp = Math.hypot(u.x - this.lastX, u.z - this.lastZ) / dt;
      this.speed += (Math.min(sp, 12) - this.speed) * Math.min(1, dt * 10);
    }
    this.lastX = u.x;
    this.lastZ = u.z;
    r.position.set(u.x, 0, u.z);

    if (!u.alive) {
      if (this.deadT < 0) {
        this.deadT = 0;
        this.fx.visible = false;
        this.anim = null;
        this.attackT = 0;
      }
      this.deadT += dt;
      const t = Math.min(1, this.deadT / 0.5);
      this.body.rotation.x = -t * Math.PI * 0.5;
      this.body.position.y = this.deadT > 2 ? -(this.deadT - 2) * 0.8 : 0;
      r.visible = this.deadT < 3.5;
      this.ring.visible = false;
      return;
    }
    if (this.deadT >= 0) {
      this.deadT = -1;
      this.body.rotation.set(0, 0, 0);
      this.body.position.set(0, 0, 0);
      this.fx.visible = true;
      this.ring.visible = true;
    }
    r.visible = true;
    const targetYaw = yawOf(u.facing);
    let dy = targetYaw - this.body.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.body.rotation.y += dy * Math.min(1, dt * 16);

    const f = u.flags;
    const moving = this.speed > 0.8;
    this.walk += dt * this.speed * 2.2;
    const stride = moving ? Math.sin(this.walk) * 0.7 : 0;
    const k = Math.min(1, dt * 16);
    let bob = 0;
    if (this.robe) {
      // túnica: balança em vez de andar
      this.robe.rotation.x += ((moving ? 0.25 : 0) - this.robe.rotation.x) * k;
      this.robe.rotation.z = moving ? Math.sin(this.walk) * 0.08 : 0;
      bob = moving ? Math.abs(Math.sin(this.walk)) * 0.04 : 0;
    } else if (this.oneLeg) {
      bob = moving ? Math.abs(Math.sin(this.walk)) * 0.35 : 0;
    } else {
      this.legL.rotation.x += (stride - this.legL.rotation.x) * k;
      this.legR.rotation.x += (-stride - this.legR.rotation.x) * k;
      bob = moving ? Math.abs(Math.cos(this.walk)) * 0.05 : 0;
    }

    // monta a pose do quadro: parado → ataque básico → habilidade → arrancada
    const P = Object.assign(POSE, ZERO);
    const S = this.style;
    P.aRx = moving ? -stride * 0.6 : 0;
    P.aLx = moving ? stride * 0.6 : 0;
    S.idle(P, moving, time);
    let snap = 18;
    this.attackT = Math.max(0, this.attackT - dt);
    if (this.attackT > 0) {
      const p = 1 - this.attackT / this.attackDur;
      const h = this.attackHit;
      S.attack(P, Math.min(1, p / h), Math.max(0, (p - h) / (1 - h)), this.combo);
      snap = 40;
    }
    if (f & F.cast && !this.anim) {
      P.aRx = -2.8;
      P.aLx = -2.8;
    }
    const A = this.anim;
    if (A) {
      A.t += dt;
      const pw = A.w > 0 ? Math.min(1, A.t / A.w) : 1;
      const pr = Math.max(0, Math.min(1, (A.t - A.w) / A.r));
      A.fn(P, pw, pr, 1 - (1 - pr) * (1 - pr) * (1 - pr), Math.sin(pr * Math.PI));
      snap = 36;
      if (A.t >= A.w + A.r) this.anim = null;
    }
    let lift = 0;
    if (f & F.air) lift = 1.2 + Math.sin(time * 9) * 0.1;
    if (this.dashT > 0) {
      this.dashT -= dt;
      if (this.dashArc) lift = Math.sin((1 - this.dashT / this.dashMax) * Math.PI) * 2.4;
      this.lean = 0.35;
      S.dash(P);
      snap = 30;
      // aterrissou: algumas armas terminam o salto com um golpe
      if (this.dashT <= 0 && this.dashArc && S.land) this.play(S.land, 0);
    } else this.lean *= Math.exp(-dt * 10);

    const ak = Math.min(1, dt * snap);
    const aLx = S.twoHand ? P.aRx : P.aLx;
    this.armR.rotation.x += (P.aRx - this.armR.rotation.x) * ak;
    this.armL.rotation.x += (aLx - this.armL.rotation.x) * ak;
    this.armR.rotation.z += (P.aRz + (S.twoHand ? -0.3 : 0) - this.armR.rotation.z) * ak;
    this.armL.rotation.z += (P.aLz + (S.twoHand ? 0.45 : 0) - this.armL.rotation.z) * ak;
    this.torso.rotation.y += (P.twist - this.torso.rotation.y) * ak;
    this.hips.rotation.y = P.spin;
    this.torso.rotation.x = this.lean + P.pitch;
    this.body.position.y = bob + lift + P.hop;
    if (this.weapon) this.weapon.rotation.x += (this.weaponBase + P.wR - this.weapon.rotation.x) * ak;
    if (this.shieldG) this.shieldG.rotation.x = -this.armL.rotation.x * 0.85;
    if (this.bow) {
      // a corda volta num estalo quando a flecha sai
      this.pullK = P.pull >= this.pullK ? this.pullK + (P.pull - this.pullK) * ak : P.pull;
      this.bow.userData.setPull(this.pullK);
    }
    this.glowK += (P.glow - this.glowK) * Math.min(1, dt * 14);
    for (const g of this.glows) g.scale.copy(g.userData.base).multiplyScalar(1 + this.glowK * 0.5 + Math.sin(time * 16) * 0.07);
    if (this.wings) {
      const beat = Math.sin(time * (moving || this.anim ? 60 : 22)) * 0.5;
      this.wings[0].rotation.z = 0.3 + beat;
      this.wings[1].rotation.z = -0.3 - beat;
    }
    if (this.tail) this.tail.rotation.y = Math.sin(time * 6) * 0.5;
    if (this.tailG) {
      this.tailG.rotation.y = Math.sin(time * (moving ? 9 : 3)) * (moving ? 0.35 : 0.18) - P.twist * 0.4;
      this.tailG.rotation.x = -0.15;
    }
    const jaw = this.hat.userData.jaw;
    if (jaw) jaw.rotation.x += (P.jaw * 0.75 - jaw.rotation.x) * Math.min(1, dt * 30);
    if (this.hat.userData.flames) {
      for (const fl of this.hat.userData.flames) fl.scale.y = fl.userData.h * (0.8 + Math.sin(time * 15 + fl.userData.ph) * 0.2 + this.glowK * 0.3);
    }
    if (this.torchFlame) this.torchFlame.scale.z = 0.18 * (0.8 + Math.sin(time * 18) * 0.25);

    const decay = Math.exp(-dt * 13);
    this.kx *= decay;
    this.kz *= decay;
    this.lunge *= Math.exp(-dt * 11);
    this.squash *= Math.exp(-dt * 16);
    this.body.position.x = this.kx + Math.cos(u.facing) * this.lunge * 0.55;
    this.body.position.z = this.kz + Math.sin(u.facing) * this.lunge * 0.55;
    this.bigK += ((u.flags & F.big ? 1 : 0) - this.bigK) * Math.min(1, dt * 4);
    const bs = this.baseScale * P.pulse * (1 + this.bigK * 0.4);
    this.body.scale.set(bs * (1 + this.squash * 0.1), bs * (1 - this.squash * 0.14), bs * (1 + this.squash * 0.1));

    if (this.hat.userData.flame) this.hat.userData.flame.scale.y = 0.45 + Math.sin(time * 14) * 0.08;

    this.stars.visible = !!(f & F.stun) || !!(f & F.air);
    this.stars.rotation.y = time * 5;
    this.hearts.visible = !!(f & F.charm);
    this.hearts.rotation.y = -time * 3;
    this.hearts.position.y = 2.6 + Math.sin(time * 5) * 0.08;
    this.orbit.visible = !!(f & F.orbs);
    this.orbit.rotation.y = time * 6;
    this.rootRing.visible = !!(f & F.root);
    this.slowRing.visible = !!(f & F.slow) && !(f & F.root);
    this.shield.visible = u.shield > 0;
    this.tornado.visible = !!(f & F.aura) && !(f & F.big);
    this.bigAura.visible = this.bigK > 0.05;
    if (this.bigAura.visible) {
      this.bigAura.scale.setScalar(0.4 + this.bigK * 0.6);
      this.bigAura.rotation.y = time * 1.5;
      this.bigSwirl.material.opacity = 0.08 + Math.sin(time * 5) * 0.05;
    }
    const fear = !!(f & F.fear);
    this.fearMark.visible = fear;
    if (fear) {
      this.fearMark.position.y = 2.8 + Math.sin(time * 10) * 0.1;
      this.body.rotation.z = Math.sin(time * 40) * 0.06;
    } else this.body.rotation.z = 0;
    this.burnFlames.visible = !!(f & F.burn);
    if (this.burnFlames.visible) {
      this.burnFlames.rotation.y = time * 2;
      for (const fl of this.burnFlames.children) fl.scale.y = 0.42 * (0.6 + Math.abs(Math.sin(time * 12 + fl.userData.ph)) * 0.6);
    }
    const fury = !!(f & F.fury) || this.bigK > 0.5;
    if (this.furyBits) for (const b of this.furyBits) {
      b.visible = fury;
      if (fury) b.scale.y = 0.2 * (0.8 + Math.sin(time * 16) * 0.25);
    }
    if (this.hat.userData.eyes) for (const e of this.hat.userData.eyes) e.visible = fury;
    this.tornado.rotation.y = -time * 8;
    this.buffGlow.visible = !!(f & F.buff) && !(f & F.aura);
    this.buffGlow.material.opacity = 0.3 + Math.sin(time * 6) * 0.2;

    if (this.flash > 0) this.flash -= dt;
    // virou estátua (Carranca): o corpo todo fica dourado e parado
    const e = this.flash > 0 ? 0.7 : 0;
    const statue = !!(f & F.stasis);
    for (const key of ['main', 'dark', 'skin']) {
      if (statue) this.mats[key].emissive.setRGB(0.85, 0.6, 0.18);
      else this.mats[key].emissive.setRGB(e, e, e);
    }
  }

  dispose() {
    for (const key of ['main', 'dark', 'skin']) this.mats[key].dispose();
  }
}

// ---------- tropas ----------

const minionMats = [0, 1].map((t) => ({
  main: mat(t === 0 ? '#3b82f6' : '#e11d48'),
  light: mat(t === 0 ? '#93c5fd' : '#fda4af'),
  dark: mat('#334155'),
  metal: mat('#64748b', { metalness: 0.3 }),
  glow: glowMat(t === 0 ? '#bfdbfe' : '#fecdd3', 0.95),
}));

export class MinionModel {
  constructor(kind, team) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const M = minionMats[team];
    const b = this.body;
    if (kind === 'melee') {
      b.add(part(M.dark, 0.22, 0.4, 0.22, -0.13, 0.2, 0), part(M.dark, 0.22, 0.4, 0.22, 0.13, 0.2, 0));
      b.add(part(M.main, 0.55, 0.5, 0.4, 0, 0.62, 0));
      b.add(part(M.light, 0.36, 0.32, 0.34, 0, 1.03, 0));
      b.add(part(M.metal, 0.08, 0.5, 0.42, -0.36, 0.62, 0.08));
      this.arm = new THREE.Group();
      this.arm.position.set(0.35, 0.8, 0);
      this.arm.add(part(M.metal, 0.07, 0.07, 0.6, 0, 0, 0.3));
      b.add(this.arm);
      this.body.scale.setScalar(1.05);
    } else if (kind === 'ranged') {
      b.add(part(M.main, 0.5, 0.75, 0.42, 0, 0.4, 0));
      b.add(part(M.light, 0.34, 0.32, 0.32, 0, 0.94, 0));
      b.add(part(M.main, 0.42, 0.14, 0.42, 0, 1.15, 0));
      this.arm = new THREE.Group();
      this.arm.position.set(0.32, 0.75, 0.05);
      this.arm.add(part(M.dark, 0.06, 0.9, 0.06, 0, 0.15, 0));
      this.arm.add(part(M.glow, 0.16, 0.16, 0.16, 0, 0.65, 0, SPHERE));
      b.add(this.arm);
    } else if (kind === 'siege') {
      b.add(part(M.dark, 1.1, 0.5, 1.3, 0, 0.55, 0));
      b.add(part(M.main, 1.0, 0.25, 1.2, 0, 0.92, 0));
      for (const [x, z] of [[-0.6, 0.4], [0.6, 0.4], [-0.6, -0.4], [0.6, -0.4]]) {
        const w = part(M.metal, 0.36, 0.12, 0.36, x, 0.3, z, CYL);
        w.rotation.z = Math.PI / 2;
        b.add(w);
      }
      this.arm = new THREE.Group();
      this.arm.position.set(0, 1.1, 0);
      const barrel = part(M.metal, 0.22, 0.22, 0.9, 0, 0.15, 0.35, CYL);
      barrel.rotation.x = Math.PI / 2 - 0.3;
      this.arm.add(barrel);
      b.add(this.arm);
    } else {
      b.add(part(M.dark, 0.4, 0.8, 0.4, -0.3, 0.4, 0), part(M.dark, 0.4, 0.8, 0.4, 0.3, 0.4, 0));
      b.add(part(M.main, 1.2, 1.0, 0.8, 0, 1.25, 0));
      b.add(part(M.light, 0.5, 0.45, 0.5, 0, 1.95, 0.1));
      b.add(part(M.glow, 0.36, 0.1, 0.05, 0, 2.0, 0.36));
      this.arm = new THREE.Group();
      this.arm.position.set(0.75, 1.5, 0);
      this.arm.add(part(M.metal, 0.35, 1.0, 0.35, 0, -0.4, 0.1));
      b.add(this.arm);
    }
    b.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.walk = Math.random() * 6;
    this.baseScale = this.body.scale.x;
    this.kx = 0;
    this.kz = 0;
    this.squash = 0;
    this.attackT = 0;
    this.prevAttack = false;
    this.deadT = -1;
    this.lastX = null;
    this.lastZ = null;
  }

  update(dt, u) {
    const r = this.root;
    let moving = false;
    if (this.lastX !== null) moving = Math.hypot(u.x - this.lastX, u.z - this.lastZ) > 0.01;
    this.lastX = u.x;
    this.lastZ = u.z;
    r.position.set(u.x, 0, u.z);
    if (!u.alive) {
      if (this.deadT < 0) this.deadT = 0;
      this.deadT += dt;
      this.body.rotation.x = -Math.min(1, this.deadT / 0.3) * 1.4;
      this.body.position.y = -Math.max(0, this.deadT - 0.5) * 1.5;
      return this.deadT < 1.2;
    }
    let dy = yawOf(u.facing) - this.body.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.body.rotation.y += dy * Math.min(1, dt * 12);
    if (moving) this.walk += dt * 10;
    this.body.position.y = moving && this.kind !== 'siege' ? Math.abs(Math.sin(this.walk)) * 0.1 : 0;
    const attacking = !!(u.flags & F.attack);
    if (attacking && !this.prevAttack) this.attackT = 0.3;
    this.prevAttack = attacking;
    this.attackT = Math.max(0, this.attackT - dt);
    if (this.arm) this.arm.rotation.x = this.attackT > 0 ? -Math.sin((this.attackT / 0.3) * Math.PI) * 1.2 : 0;
    const decay = Math.exp(-dt * 13);
    this.kx *= decay;
    this.kz *= decay;
    this.squash *= Math.exp(-dt * 16);
    this.body.position.x = this.kx;
    this.body.position.z = this.kz;
    this.body.scale.set(this.baseScale * (1 + this.squash * 0.14), this.baseScale * (1 - this.squash * 0.2), this.baseScale * (1 + this.squash * 0.14));
    return true;
  }

  hit(dx = 0, dz = 0, amt = 0) {
    if (amt <= 0) return;
    this.kx = dx * amt;
    this.kz = dz * amt;
    this.squash = 1;
  }
}

// ---------- estruturas ----------

const stone = mat('#a8a29e');
const stoneDark = mat('#78716c');
const rubbleMat = mat('#57534e');

export class StructModel {
  constructor(kind, team) {
    this.kind = kind;
    this.team = team;
    this.root = new THREE.Group();
    const color = TEAMS[team].color;
    this.crystalMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.3, flatShading: true });
    this.alive = new THREE.Group();
    this.root.add(this.alive);
    this.rubble = new THREE.Group();
    this.rubble.visible = false;
    this.root.add(this.rubble);
    const A = this.alive;
    if (kind === 'tower') {
      A.add(part(stoneDark, 1.6, 0.6, 1.6, 0, 0.3, 0, CYL));
      A.add(part(stone, 1.1, 3.6, 1.1, 0, 2.3, 0, CYL));
      A.add(part(stoneDark, 1.45, 0.45, 1.45, 0, 4.2, 0, CYL));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        A.add(part(stone, 0.35, 0.5, 0.35, Math.cos(a) * 1.1, 4.6, Math.sin(a) * 1.1));
      }
      this.crystal = part(this.crystalMat, 0.5, 0.85, 0.5, 0, 5.35, 0, OCTA);
      A.add(this.crystal);
      this.light = new THREE.PointLight(color, 8, 9, 2);
      this.light.position.y = 5.3;
      A.add(this.light);
    } else if (kind === 'selo') {
      A.add(part(stoneDark, 2.1, 0.4, 2.1, 0, 0.2, 0, CYL));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        A.add(part(stone, 0.4, 1.6, 0.4, Math.cos(a) * 1.6, 1.0, Math.sin(a) * 1.6));
      }
      this.rune = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 6, 32), this.crystalMat);
      this.rune.position.y = 2.2;
      A.add(this.rune);
      this.crystal = part(this.crystalMat, 0.5, 0.75, 0.5, 0, 2.2, 0, OCTA);
      A.add(this.crystal);
    } else {
      A.add(part(stoneDark, 3.6, 0.7, 3.6, 0, 0.35, 0, CYL));
      A.add(part(stone, 2.8, 0.8, 2.8, 0, 1.1, 0, CYL));
      this.crystal = part(this.crystalMat, 1.5, 2.6, 1.5, 0, 3.8, 0, OCTA);
      A.add(this.crystal);
      this.orbiters = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this.orbiters.add(part(this.crystalMat, 0.3, 0.5, 0.3, Math.cos(a) * 2.6, 3.4, Math.sin(a) * 2.6, OCTA));
      }
      A.add(this.orbiters);
      this.light = new THREE.PointLight(color, 20, 16, 2);
      this.light.position.y = 4;
      A.add(this.light);
    }
    for (let i = 0; i < 9; i++) {
      const s = 0.3 + Math.random() * 0.6;
      this.rubble.add(part(rubbleMat, s, s * 0.6, s, (Math.random() - 0.5) * 2.2, s * 0.3, (Math.random() - 0.5) * 2.2));
    }
    if (kind !== 'tower') this.rubble.add(part(stoneDark, kind === 'core' ? 3.6 : 2.1, 0.3, kind === 'core' ? 3.6 : 2.1, 0, 0.15, 0, CYL));
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.flash = 0;
    this.dead = false;
  }

  hit() {
    this.flash = 0.08;
  }

  update(dt, u, time) {
    this.root.position.set(u.x, 0, u.z);
    const dead = !u.alive;
    if (dead !== this.dead) {
      this.dead = dead;
      this.alive.visible = !dead || this.kind === 'selo';
      this.rubble.visible = dead && this.kind !== 'selo';
      if (this.kind === 'selo') {
        this.crystal.visible = !dead;
        this.rune.visible = !dead;
      }
    }
    if (this.crystal) {
      this.crystal.rotation.y = time * 0.8;
      this.crystal.position.y += Math.sin(time * 2) * 0.002;
    }
    if (this.rune) this.rune.rotation.set(Math.PI / 2 + Math.sin(time) * 0.2, time * 0.5, 0);
    if (this.orbiters) this.orbiters.rotation.y = -time * 0.4;
    this.flash = Math.max(0, this.flash - dt);
    const invuln = !!(u.flags & F.invuln);
    this.crystalMat.emissiveIntensity = this.flash > 0 ? 3 : invuln ? 0.7 : 1.4 + Math.sin(time * 3) * 0.2;
  }
}

// fruta de cura: um caju
export function packModel() {
  const g = new THREE.Group();
  const fruit = part(mat('#f97316', { emissive: '#7c2d12', emissiveIntensity: 0.4 }), 0.42, 0.55, 0.42, 0, 0, 0, SPHERE);
  const nut = part(mat('#a16207'), 0.2, 0.26, 0.2, 0, -0.5, 0.05, SPHERE);
  const leaf = part(mat('#4d7c0f'), 0.08, 0.2, 0.26, 0, 0.6, 0);
  const spin = new THREE.Group();
  spin.add(fruit, nut, leaf);
  spin.position.y = 1.1;
  g.add(spin);
  g.add(groundRing('#4ade80', 0.9, 0.6));
  g.userData.spin = spin;
  return g;
}
