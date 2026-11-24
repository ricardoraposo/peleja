// Análise de balanceamento: muitas partidas só de bots, em paralelo, e um relatório por herói, papel, ritmo e uso das habilidades.
// node scripts/balance.js [partidas] [tamanho do time] [processos]   ex.: node scripts/balance.js 200 5
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { HEROES, HERO_ORDER } from '../src/config.js';
import { Sim } from '../src/sim.js';

const DT = 1 / 30;
const LIMIT = 60 * 40;

// uma partida com tudo registrado: resultado, dano (em heróis e estruturas), cura, tempo morto, quedas e lançamentos
function play(size) {
  const dmgOrig = Sim.prototype.damage;
  const castOrig = Sim.prototype.cast;
  const sd = {};
  const casts = {};
  Sim.prototype.damage = function (t, src, amount, type, opts = {}) {
    const before = t.isStructure ? t.hp : 0;
    const r = dmgOrig.call(this, t, src, amount, type, opts);
    if (t.isStructure && src?.isHero) sd[src.id] = (sd[src.id] || 0) + Math.max(0, before - Math.max(0, t.hp));
    return r;
  };
  Sim.prototype.cast = function (h, slot, ...a) {
    const ok = castOrig.call(this, h, slot, ...a);
    if (ok && h.isHero) casts[h.heroId + ':' + slot] = (casts[h.heroId + ':' + slot] || 0) + 1;
    return ok;
  };
  const falls = [];
  const sim = new Sim({ teamSize: size, emit: (msg) => { if (msg.e === 'struct' && msg.d) falls.push([sim.gameTime / 60, msg.id]); } });
  sim.startGame();
  const keyOf = new Map();
  for (const t of [0, 1]) for (const s of sim.structs[t]) keyOf.set(s.id, s.key);
  const dead = {};
  const snap = {};
  let next = 5;
  while (sim.phase === 'playing' && sim.gameTime < LIMIT) {
    sim.step(DT);
    for (const h of sim.heroes) if (!h.alive) dead[h.id] = (dead[h.id] || 0) + DT;
    if (sim.gameTime >= next * 60) {
      snap[next] = sim.heroes.map((h) => [h.level, h.goldEarned, h.items.length]);
      next += 5;
    }
  }
  Sim.prototype.damage = dmgOrig;
  Sim.prototype.cast = castOrig;
  return {
    w: sim.winner,
    min: sim.gameTime / 60,
    k: sim.kills,
    snap,
    casts,
    falls: falls.map(([t, id]) => [t, keyOf.get(id)]),
    h: sim.heroes.map((h) => ({ id: h.heroId, t: h.team, k: h.kills, d: h.deaths, a: h.assists, g: h.goldEarned, dmg: h.dmgDealt, tak: h.dmgTaken, heal: h.healDone, s: sd[h.id] || 0, dead: dead[h.id] || 0 })),
  };
}

function report(L, size) {
  const done = L.filter((m) => m.w >= 0);
  const q = (a, p) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  };
  const pct = (x) => Math.round(100 * x) + '%';
  const margin = (p, n) => '±' + Math.round(196 * Math.sqrt((p * (1 - p)) / n));
  const blue = done.filter((m) => m.w === 0).length / done.length;
  const mins = L.map((m) => m.min);
  console.log(`\n===== ${size}x${size}`);
  console.log(`partidas ${L.length} · azul venceu ${pct(blue)} (${margin(blue, done.length)}) · terminaram por tempo ${pct(1 - done.length / L.length)}`);
  console.log(`duração: mediana ${q(mins, 0.5).toFixed(1)} · média ${(mins.reduce((a, b) => a + b, 0) / mins.length).toFixed(1)} · 90% até ${q(mins, 0.9).toFixed(1)} min · acima de 25 min ${pct(mins.filter((m) => m > 25).length / L.length)}`);
  for (const t of [5, 10, 15, 20]) {
    const a = L.filter((m) => m.snap[t]).flatMap((m) => m.snap[t]);
    if (a.length) console.log(`  aos ${t} min: nível ${(a.reduce((s, r) => s + r[0], 0) / a.length).toFixed(1)}, ouro ${Math.round(a.reduce((s, r) => s + r[1], 0) / a.length)}, itens ${(a.reduce((s, r) => s + r[2], 0) / a.length).toFixed(1)}`);
  }
  const keys = ['t1', 't2', 'selo', 't3a', 'core'];
  console.log('  primeira queda (mediana, min): ' + keys.map((k) => {
    const f = L.map((m) => m.falls.find((x) => x[1] === k)).filter(Boolean).map((x) => x[0]);
    return `${k} ${f.length ? q(f, 0.5).toFixed(1) : '-'}`;
  }).join(' · '));
  const dead = L.flatMap((m) => m.h.map((h) => h.dead / (m.min * 60)));
  console.log(`  tempo morto: ${pct(dead.reduce((a, b) => a + b, 0) / dead.length)} da partida por herói`);

  const S = {};
  const R = {};
  const C = {};
  for (const m of L) {
    for (const [k, v] of Object.entries(m.casts)) C[k] = (C[k] || 0) + v;
    for (const h of m.h) {
      const s = (S[h.id] ||= { n: 0, w: 0, k: 0, d: 0, a: 0, dmg: 0, tak: 0, heal: 0, g: 0, min: 0, st: 0 });
      s.min += m.min;
      s.st += h.s;
    }
  }
  for (const m of done) {
    for (const h of m.h) {
      const s = S[h.id];
      s.n++;
      s.w += m.w === h.t;
      s.k += h.k;
      s.d += h.d;
      s.a += h.a;
      s.dmg += h.dmg;
      s.tak += h.tak;
      s.heal += h.heal;
      s.g += h.g;
      const r = (R[HEROES[h.id].role] ||= { n: 0, w: 0 });
      r.n++;
      r.w += m.w === h.t;
    }
  }
  const ids = Object.keys(S).filter((id) => S[id].n);
  const stAvg = ids.reduce((a, id) => a + S[id].st / S[id].min, 0) / ids.length;
  console.log('\nherói      papel      jogos vitória      abt/mrt/ass       dano/min sofrido/min cura/min ouro/min torre/min (% da média)');
  for (const id of ids.sort((a, b) => S[b].w / S[b].n - S[a].w / S[a].n)) {
    const s = S[id];
    const p = s.w / s.n;
    console.log([
      id.padEnd(10), HEROES[id].role.padEnd(10), String(s.n).padEnd(5), `${pct(p)} ${margin(p, s.n)}`.padEnd(12),
      `${(s.k / s.n).toFixed(1)}/${(s.d / s.n).toFixed(1)}/${(s.a / s.n).toFixed(1)}`.padEnd(17),
      String(Math.round(s.dmg / s.min)).padEnd(8), String(Math.round(s.tak / s.min)).padEnd(11),
      String(Math.round(s.heal / s.min)).padEnd(8), String(Math.round(s.g / s.min)).padEnd(8),
      `${Math.round(s.st / s.min)} (${pct(s.st / s.min / stAvg)})`,
    ].join(' '));
  }
  console.log('por papel: ' + Object.entries(R).map(([k, r]) => `${k} ${pct(r.w / r.n)}`).join(' · '));
  console.log('\nuso das habilidades (lançamentos por minuto / máximo pela recarga):');
  for (const id of HERO_ORDER) {
    if (!S[id]) continue;
    console.log('  ' + id.padEnd(10) + ['q', 'w', 'e', 'r'].map((s) => `${s} ${((C[id + ':' + s] || 0) / S[id].min).toFixed(1)}/${(60 / HEROES[id].abilities[s].cd).toFixed(1)}`).join('  '));
  }
}

if (process.argv[2] === '--worker') {
  const n = Number(process.argv[3]);
  const size = Number(process.argv[4]);
  for (let i = 0; i < n; i++) process.send(play(size));
  process.disconnect();
} else {
  const N = Number(process.argv[2]) || 40;
  const size = Number(process.argv[3]) || 5;
  const P = Math.max(1, Math.min(N, Number(process.argv[4]) || availableParallelism() - 1));
  const L = [];
  let left = P;
  console.log(`${N} partidas ${size}x${size} em ${P} processos...`);
  for (let i = 0; i < P; i++) {
    const n = Math.floor(N / P) + (i < N % P ? 1 : 0);
    const w = fork(new URL(import.meta.url).pathname, ['--worker', String(n), String(size)]);
    w.on('message', (m) => {
      L.push(m);
      if (L.length % 10 === 0) console.log(`  ${L.length}/${N}`);
    });
    w.on('exit', () => {
      if (--left === 0) report(L, size);
    });
  }
}
