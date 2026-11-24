import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAP, TEAMS } from './config.js';
import { F } from './sim.js';
import { buildHero } from './herobuild.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(1, 24, 16);
const OCTA = new THREE.OctahedronGeometry(1, 0);
const RING = new THREE.RingGeometry(0.82, 1, 48);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
// gota de fogo: base redonda e ponta fina, do mesmo tamanho do octaedro que ela substitui
const FLAME = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = -1 + t * 2;
    const r = t < 0.38 ? Math.sin((t / 0.38) * Math.PI * 0.5) : Math.pow(1 - (t - 0.38) / 0.62, 1.4);
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  return new THREE.LatheGeometry(pts, 16);
})();

// Peça de caixa vira um bloco de quinas redondas do tamanho exato da peça, pra quina
// não esticar quando a peça é comprida. Uma geometria por tamanho, compartilhada.
const roundCache = new Map();
function roundBox(w, h, d) {
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = roundCache.get(key);
  if (!g) {
    const r = Math.min(w, h, d) * 0.22;
    g = new RoundedBoxGeometry(w, h, d, 2, r);
    roundCache.set(key, g);
  }
  return g;
}

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }));
  return matCache.get(key);
}

function part(m, w, h, d, x, y, z, geo = BOX) {
  let mesh;
  if (geo === BOX) mesh = new THREE.Mesh(roundBox(w, h, d), m);
  else {
    mesh = new THREE.Mesh(geo, m);
    mesh.scale.set(w, h, d);
  }
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// bloco de quina viva, pras estruturas (torre de pedra continua quadrada)
function block(m, w, h, d, x, y, z, geo = BOX) {
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
// O corpo, a roupa e a arma de cada herói são montados em herobuild.js; aqui ficam a animação e os efeitos.

const bounceOut = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
};
const backOut = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

// mola amortecida: segue o alvo e passa um pouquinho do ponto antes de assentar
function spring(o, key, target, v, k, damp, dt) {
  const s = v[key] || 0;
  const a = (target - o[key]) * k * k - s * 2 * damp * k;
  const ns = s + a * dt;
  v[key] = ns;
  o[key] += ns * dt;
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

// coquinho na mão: os mesmos gestos (arremesso por baixo, rodopio e o sopro com a mão na boca)
STYLES.coco = STYLES.pearl;
STYLES.braid = STYLES.pearl;
STYLES.cane = STYLES.torch;

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
    // um pouco maior que o tamanho de colisão: com proporção de gente o herói fica fino e some na câmera de cima
    const scale = (look.scale || 1) * 1.4;
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
    buildHero(this, def, look);

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
    // voltando pra base: coluna de luz e um anel no chão que fecha até a hora de sumir
    this.recallFx = new THREE.Group();
    const beam = part(glowMat('#7dd3fc', 0.28), 0.75, 4.5, 0.75, 0, 2.25, 0, CYL);
    const rring = part(glowMat('#e0f2fe', 0.9), 1, 0.05, 1, 0, 0.06, 0, CYL);
    beam.castShadow = rring.castShadow = false;
    this.recallFx.add(beam, rring);
    this.recallFx.visible = false;
    this.recallRing = rring;
    this.recallBeam = beam;
    this.recallAge = 0;
    this.fx.add(this.recallFx);
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
      const f = part(glowMat(i % 2 ? '#ffb020' : '#ff3d00', 0.85), 0.2, 0.42, 0.2, Math.cos(a) * 0.45, 0.4 + (i % 3) * 0.45, Math.sin(a) * 0.45, FLAME);
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
    this.vel = { rx: {}, lx: {}, rz: {}, lz: {}, ty: {}, hx: {}, hat: {}, hatz: {} };
    this.bank = 0;
    this.runLean = 0;
    this.lastY = 0;
    this.pop = 1;
    this.phase = Math.random() * 6;
  }

  // separa a canela da coxa: devolve o grupo do joelho pra pendurar canela e pé
  knee(leg) {
    const shin = new THREE.Group();
    shin.position.y = -0.4;
    leg.add(shin);
    (this.shins ||= []).push(shin);
    return shin;
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

  // golpe (ou também a habilidade) interrompido antes de sair: larga a pose; o que já saiu termina o movimento
  interrupt(attackOnly = false) {
    if (this.attackT > 0 && 1 - this.attackT / this.attackDur < this.attackHit) this.attackT = 0;
    if (!attackOnly && this.anim && this.anim.t < this.anim.w) this.anim = null;
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

  // pulo de ida e volta por um buraco no chão: sai dele, fica `stay` segundos, afunda e sai de novo na volta
  startHole(stay) {
    this.hole = { t: 0, stay };
  }

  // tiro de canhão: `load` segundos escondido no cano e depois `dur` segundos de voo em arco, dando cambalhota
  startFly(load, dur) {
    this.flyS = { t: 0, load, dur };
    this.anim = null;
  }

  get flying() {
    return !!this.flyS && this.flyS.t >= this.flyS.load;
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
      // um pulinho de susto e cai de costas quicando no chão
      const t = Math.min(1, this.deadT / 0.6);
      this.body.rotation.x = -bounceOut(t) * Math.PI * 0.5;
      const hop = this.deadT < 0.3 ? Math.sin((this.deadT / 0.3) * Math.PI) * 0.35 : 0;
      this.body.position.y = hop + (this.deadT > 2 ? -(this.deadT - 2) * 0.8 : 0);
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
      this.pop = 0;
    }
    r.visible = true;
    const targetYaw = yawOf(u.facing);
    let dy = targetYaw - this.body.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const turn = dy * Math.min(1, dt * 16);
    this.body.rotation.y += turn;
    // inclina pra dentro da curva, como quem corre
    const bankT = dt > 0 ? Math.max(-0.22, Math.min(0.22, -(turn / dt) * 0.02 * Math.min(1, this.speed / 4))) : 0;
    this.bank += (bankT - this.bank) * Math.min(1, dt * 8);

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
      // saltitando: dobra o joelho pra tomar impulso e estica no ar
      const air = Math.abs(Math.sin(this.walk));
      bob = moving ? air * 0.35 : 0;
      const bend = moving ? (1 - air) * 0.9 : 0.15;
      this.legL.rotation.x += (-bend * 0.5 - this.legL.rotation.x) * k;
      this.shins[0].rotation.x += (bend - this.shins[0].rotation.x) * k;
    } else {
      this.legL.rotation.x += (stride - this.legL.rotation.x) * k;
      this.legR.rotation.x += (-stride - this.legR.rotation.x) * k;
      // a perna que vem pra frente dobra o joelho; parado, joelho levemente solto
      const c = Math.cos(this.walk);
      const kL = moving ? Math.max(0, -c) * 1.1 : 0.05;
      const kR = moving ? Math.max(0, c) * 1.1 : 0.05;
      this.shins[0].rotation.x += (kL - this.shins[0].rotation.x) * k;
      this.shins[1].rotation.x += (kR - this.shins[1].rotation.x) * k;
      bob = moving ? Math.abs(c) * 0.07 : 0;
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
      if (this.dashT <= 0 && this.dashArc) {
        this.squash = 0.9;
        if (S.land) this.play(S.land, 0);
      }
    } else this.lean *= Math.exp(-dt * 10);

    if (this.flyS) {
      const Fl = this.flyS;
      Fl.t += dt;
      const p = (Fl.t - Fl.load) / Fl.dur;
      if (p >= 1 || (Fl.t > 0.4 && !(f & F.fly))) {
        this.flyS = null;
        this.body.rotation.x = 0;
      } else if (p < 0) r.visible = false;
      else {
        lift = 2.6 * (1 - p) + Math.sin(p * Math.PI) * 7;
        this.body.rotation.x = p * Math.PI * 4;
        P.aRx = P.aLx = -2.6;
        snap = 30;
      }
    }

    const ak = Math.min(1, dt * snap);
    const aLx = S.twoHand ? P.aRx : P.aLx;
    // braços e tronco em mola: golpe rápido passa um pouco do ponto e volta, parado assenta macio
    const sdt = Math.min(dt, 1 / 30);
    const sk = snap * 0.9;
    const damp = snap > 20 ? 0.55 : 0.8;
    const V = this.vel;
    spring(this.armR.rotation, 'x', P.aRx, V.rx, sk, damp, sdt);
    spring(this.armL.rotation, 'x', aLx, V.lx, sk, damp, sdt);
    spring(this.armR.rotation, 'z', P.aRz + (S.twoHand ? -0.3 : 0), V.rz, sk, damp, sdt);
    spring(this.armL.rotation, 'z', P.aLz + (S.twoHand ? 0.45 : 0), V.lz, sk, damp, sdt);
    // tronco gira contra o passo das pernas
    spring(this.torso.rotation, 'y', P.twist - stride * 0.22, V.ty, sk, damp, sdt);
    this.hips.rotation.y = P.spin + stride * 0.12;
    this.hips.rotation.z = moving && !this.robe ? Math.sin(this.walk) * 0.05 : 0;
    const run = moving ? 0.1 * Math.min(1, this.speed / 6) : 0;
    this.runLean += (run - this.runLean) * Math.min(1, dt * 8);
    this.torso.rotation.x = this.lean + P.pitch + this.runLean;
    // cotovelo: solto andando e parado, esticado quando a pose pede precisão (golpe, habilidade)
    const posed = this.attackT > 0 || this.anim || this.dashT > 0 || f & F.cast || this.flyS;
    const elbowT = posed ? 0 : moving ? 0.35 + Math.max(0, -stride) * 0.3 : 0.22;
    const elbowL = posed ? 0 : moving ? 0.35 + Math.max(0, stride) * 0.3 : 0.22;
    this.fores[0].rotation.x += (-elbowT - this.fores[0].rotation.x) * ak;
    this.fores[1].rotation.x += (-(S.twoHand ? elbowT : elbowL) - this.fores[1].rotation.x) * ak;
    // respira parado
    const breath = moving ? 0 : Math.sin(time * 2.4 + this.phase) * 0.018;
    this.torso.scale.set(1 + breath * 0.6, 1 + breath, 1 + breath * 0.6);
    // cabeça segura o olhar pra frente e balança com o passo
    this.head.rotation.y = -this.torso.rotation.y * 0.45;
    const y = bob + lift + P.hop;
    const vy = dt > 0 ? (y - this.lastY) / dt : 0;
    this.lastY = y;
    spring(this.head.rotation, 'x', Math.max(-0.3, Math.min(0.3, vy * 0.03)) - this.runLean * 0.6, V.hx, 14, 0.45, sdt);
    // chapéu, cabelo e penacho atrasam um tiquinho
    spring(this.hat.rotation, 'x', Math.max(-0.35, Math.min(0.35, vy * 0.05 - this.lunge * 0.25)), V.hat, 12, 0.3, sdt);
    spring(this.hat.rotation, 'z', -this.bank * 0.8, V.hatz, 12, 0.3, sdt);
    // pisca de vez em quando
    this.blinkIn -= dt;
    if (this.blinkIn < 0) this.blinkIn = 2 + Math.random() * 3.5;
    const shut = this.blinkIn < 0.12 || !!(f & F.sleep);
    for (const e of this.eyes) e.scale.y = shut ? 0.12 : 1;
    this.body.position.y = y;
    if (this.hole) {
      const H = this.hole;
      const D = 0.26;
      H.t += dt;
      // sobe do buraco com um pulinho; perto da hora de voltar, afunda; depois da volta, sobe de novo
      const rise = (p) => -1.9 * (1 - p) * (1 - p) + Math.sin(p * Math.PI) * 0.45;
      if (H.t < D) this.body.position.y += rise(H.t / D);
      else if (H.t >= H.stay) this.body.position.y += rise(Math.min(1, (H.t - H.stay) / D));
      else if (H.t > H.stay - D) this.body.position.y -= 1.9 * ((H.t - (H.stay - D)) / D) ** 2;
      if (H.t >= H.stay + D) this.hole = null;
    }
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
    // renasceu: estoura de pequeno pro tamanho certo
    if (this.pop < 1) this.pop = Math.min(1, this.pop + dt / 0.4);
    const bs = this.baseScale * P.pulse * (1 + this.bigK * 0.4) * backOut(this.pop);
    this.body.scale.set(bs * (1 + this.squash * 0.1), bs * (1 - this.squash * 0.14), bs * (1 + this.squash * 0.1));

    if (this.hat.userData.flame) this.hat.userData.flame.scale.y = 0.45 + Math.sin(time * 14) * 0.08;

    this.stars.visible = !!(f & F.stun) || !!(f & F.air) || !!(f & F.sleep);
    if (this.boar) this.boar.position.y = moving ? Math.abs(Math.sin(this.walk * 1.3)) * 0.08 : 0;
    this.stars.rotation.y = time * 5;
    const recalling = !!(f & F.recall);
    this.recallAge = recalling ? this.recallAge + dt : 0;
    this.recallFx.visible = recalling;
    if (recalling) {
      const k = Math.min(1, this.recallAge / MAP.recall);
      const rs = 1.5 - k * 1.1;
      this.recallRing.scale.set(rs, 0.05, rs);
      this.recallBeam.scale.set(0.5 + k * 0.4 + Math.sin(time * 9) * 0.05, 4.5, 0.5 + k * 0.4 + Math.sin(time * 9) * 0.05);
      this.recallBeam.material.opacity = 0.18 + k * 0.4;
    }
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
    } else this.body.rotation.z = this.bank;
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
    for (const m of this.flashMats) {
      if (statue) m.emissive.setRGB(0.85, 0.6, 0.18);
      else m.emissive.setRGB(e, e, e);
    }
  }

  // meio transparente (escondido na moita, visto pelo próprio time). Na primeira vez copia os materiais deste
  // herói, porque muitos são compartilhados entre heróis e não podem ficar transparentes pra todos.
  setGhost(on) {
    if (on === !!this.ghost) return;
    this.ghost = on;
    if (!this.ghostMats) {
      this.ghostMats = [];
      const copies = new Map();
      this.body.traverse((o) => {
        if (!o.isMesh) return;
        let c = copies.get(o.material);
        if (!c) {
          c = o.material.clone();
          copies.set(o.material, c);
          this.ghostMats.push({ m: c, opacity: c.opacity, transparent: c.transparent, depthWrite: c.depthWrite });
        }
        o.material = c;
      });
      this.baseMats = this.flashMats;
      this.flashMats = this.flashMats.map((m) => copies.get(m) || m);
    }
    for (const g of this.ghostMats) {
      g.m.transparent = on || g.transparent;
      g.m.opacity = on ? g.opacity * 0.45 : g.opacity;
      g.m.depthWrite = on ? false : g.depthWrite;
      g.m.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of this.flashMats) m.dispose();
    if (this.ghostMats) for (const g of this.ghostMats) g.m.dispose();
    if (this.baseMats) for (const m of this.baseMats) m.dispose();
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
      A.add(block(stoneDark, 1.6, 0.6, 1.6, 0, 0.3, 0, CYL));
      A.add(block(stone, 1.1, 3.6, 1.1, 0, 2.3, 0, CYL));
      A.add(block(stoneDark, 1.45, 0.45, 1.45, 0, 4.2, 0, CYL));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        A.add(block(stone, 0.35, 0.5, 0.35, Math.cos(a) * 1.1, 4.6, Math.sin(a) * 1.1));
      }
      this.crystal = block(this.crystalMat, 0.5, 0.85, 0.5, 0, 5.35, 0, OCTA);
      A.add(this.crystal);
      this.light = new THREE.PointLight(color, 8, 9, 2);
      this.light.position.y = 5.3;
      A.add(this.light);
    } else if (kind === 'selo') {
      A.add(block(stoneDark, 2.1, 0.4, 2.1, 0, 0.2, 0, CYL));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        A.add(block(stone, 0.4, 1.6, 0.4, Math.cos(a) * 1.6, 1.0, Math.sin(a) * 1.6));
      }
      this.rune = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.09, 6, 32), this.crystalMat);
      this.rune.position.y = 2.2;
      A.add(this.rune);
      this.crystal = block(this.crystalMat, 0.5, 0.75, 0.5, 0, 2.2, 0, OCTA);
      A.add(this.crystal);
    } else {
      A.add(block(stoneDark, 3.6, 0.7, 3.6, 0, 0.35, 0, CYL));
      A.add(block(stone, 2.8, 0.8, 2.8, 0, 1.1, 0, CYL));
      this.crystal = block(this.crystalMat, 1.5, 2.6, 1.5, 0, 3.8, 0, OCTA);
      A.add(this.crystal);
      this.orbiters = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this.orbiters.add(block(this.crystalMat, 0.3, 0.5, 0.3, Math.cos(a) * 2.6, 3.4, Math.sin(a) * 2.6, OCTA));
      }
      A.add(this.orbiters);
      this.light = new THREE.PointLight(color, 20, 16, 2);
      this.light.position.y = 4;
      A.add(this.light);
    }
    for (let i = 0; i < 9; i++) {
      const s = 0.3 + Math.random() * 0.6;
      this.rubble.add(block(rubbleMat, s, s * 0.6, s, (Math.random() - 0.5) * 2.2, s * 0.3, (Math.random() - 0.5) * 2.2));
    }
    if (kind !== 'tower') this.rubble.add(block(stoneDark, kind === 'core' ? 3.6 : 2.1, 0.3, kind === 'core' ? 3.6 : 2.1, 0, 0.15, 0, CYL));
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

// canhão da base: carreta de madeira, cano de ferro com a boca na cor do time e um anel no chão marcando onde entrar
const iron = mat('#3f3f46', { metalness: 0.5, roughness: 0.45 });
const ironDark = mat('#18181b');
const wood = mat('#7c4a21');

export class CannonModel {
  constructor(team) {
    const color = TEAMS[team].color;
    this.root = new THREE.Group();
    this.ring = groundRing(color, MAP.cannon.r, 0.6);
    this.root.add(this.ring);
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    this.pivot.add(block(wood, 2.0, 0.35, 1.3, -0.1, 0.75, 0));
    for (const z of [-0.85, 0.85]) {
      const wheel = block(wood, 0.75, 0.2, 0.75, 0, 0.75, z, CYL);
      wheel.rotation.x = Math.PI / 2;
      const hub = block(iron, 0.2, 0.26, 0.2, 0, 0.75, z, CYL);
      hub.rotation.x = Math.PI / 2;
      this.pivot.add(wheel, hub);
    }
    // o cano aponta pra +x; `tilt` levanta a boca e `barrel` escorrega pra trás no coice
    this.tilt = new THREE.Group();
    this.tilt.position.set(0, 1.25, 0);
    this.pivot.add(this.tilt);
    this.barrel = new THREE.Group();
    this.tilt.add(this.barrel);
    const tube = (m, r, len, x) => {
      const t = block(m, r, len, r, x, 0, 0, CYL);
      t.rotation.z = -Math.PI / 2;
      return t;
    };
    this.glowMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true });
    this.barrel.add(tube(iron, 0.62, 3.0, 0.9), tube(this.glowMat, 0.72, 0.3, 2.3), tube(iron, 0.7, 0.3, 0.2), tube(ironDark, 0.48, 0.06, 2.44));
    this.barrel.add(block(iron, 0.64, 0.64, 0.64, -0.6, 0, 0, SPHERE));
    this.fuse = block(new THREE.MeshBasicMaterial({ color: '#ffd166', toneMapped: false }), 0.14, 0.14, 0.14, -0.9, 0.62, 0, SPHERE);
    this.fuse.visible = false;
    this.barrel.add(this.fuse);
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(2.5, 0, 0);
    this.barrel.add(this.mouth);
    this.pivot.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    this.yaw = team === 0 ? 0 : Math.PI;
    this.pivot.rotation.y = -this.yaw;
    this.pitch = 0;
    this.loadT = 0;
    this.kickT = 0;
  }

  // alguém entrou no cano: mira no ponto de queda e acende o pavio por `t` segundos
  charge(t, dx, dz) {
    this.yaw = Math.atan2(dz, dx);
    this.loadT = t;
  }

  kick() {
    this.loadT = 0;
    this.kickT = 0.45;
  }

  update(dt, time, active, hover) {
    let dy = -this.yaw - this.pivot.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.pivot.rotation.y += dy * Math.min(1, dt * 14);
    // sem torre pra mirar, o cano fica caído e o anel apaga
    this.pitch += ((active ? 0.62 : -0.12) - this.pitch) * Math.min(1, dt * 6);
    this.tilt.rotation.z = this.pitch;
    this.loadT = Math.max(0, this.loadT - dt);
    this.kickT = Math.max(0, this.kickT - dt);
    const loading = this.loadT > 0;
    this.fuse.visible = loading;
    const k = this.kickT / 0.45;
    this.barrel.position.x = -0.9 * k * k + (loading ? Math.sin(time * 70) * 0.03 : 0);
    this.barrel.scale.setScalar(loading ? 1 + Math.sin(time * 40) * 0.025 : 1);
    this.glowMat.emissiveIntensity = !active ? 0.1 : loading || k > 0 ? 3 : hover ? 2 : 0.9 + Math.sin(time * 3) * 0.2;
    this.ring.visible = active;
    this.ring.material.opacity = hover ? 1 : 0.45 + Math.sin(time * 3) * 0.15;
    this.ring.scale.setScalar(MAP.cannon.r * (hover ? 1.08 + Math.sin(time * 8) * 0.04 : 1));
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
