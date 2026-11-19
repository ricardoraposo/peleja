// Confere o formato binário da rede: roda uma partida de bots com um jogador no meio, passa tudo que o
// servidor mandaria pelo codec e compara com o que o JSON entregava. Também mede tamanho e tempo.
//   node scripts/wiretest.js [minutos de jogo]
import { isDeepStrictEqual } from 'node:util';
import { Sim } from '../src/sim.js';
import { decode, encode, fallbacks, pack } from '../src/wire.js';

const MINUTES = Number(process.argv[2]) || 12;
const DT = 1 / 30;
const stats = {};
const wrong = [];
const all = [];

function check(msg, dir = 'e') {
  const viaJson = JSON.parse(JSON.stringify(msg));
  const bytes = pack(msg);
  const back = decode(bytes, dir);
  const name = msg.e || msg.t;
  const s = (stats[name] ||= { n: 0, bin: 0, json: 0 });
  s.n++;
  s.bin += bytes.length;
  s.json += Buffer.byteLength(JSON.stringify(msg));
  if (back.length !== 1 || !isDeepStrictEqual(back[0], viaJson)) {
    if (wrong.length < 8) wrong.push(`${name}: ${JSON.stringify(viaJson)} virou ${JSON.stringify(back[0])}`);
    else wrong.push(name);
  }
  all.push(msg);
}

const sim = new Sim({ difficulty: 'normal', emit: (msg) => check(msg) });
const me = sim.addHuman('Zé da Peleja');
check({ e: 'welcome', id: me.id });
check({ e: 'roster', l: sim.roster() });
check({ e: 'room', code: 'ABCD', you: 3, host: 1, state: 'lobby', size: 5, diff: 'normal', members: [[1, 'Ana', 0], [3, 'João Não-ASCII ç', 1]] });
for (const e of ['full', 'noroom', 'busy']) check({ e });
check(sim.snapshot());
check(sim.meState(me));
sim.startGame();
let steps = 0;
while (sim.phase === 'playing' && sim.gameTime < 60 * MINUTES) {
  sim.step(DT);
  steps++;
  if (steps % 3 === 0) {
    check(sim.snapshot());
    check(sim.meState(me));
  }
  if (steps % 30 === 0) check(sim.board());
}

// comandos do navegador, inclusive os tortos que o servidor precisa aguentar
const commands = [
  { t: 'mv', x: 12.3, z: -4.5 },
  { t: 'am', x: 12.345678901, z: -0.000123 },
  { t: 'at', id: 4321 },
  { t: 'st' },
  { t: 'c', s: 'q', x: 1.5, z: 2, id: 0 },
  { t: 'c', s: 'r', x: 1.5, z: 2 },
  { t: 'up', s: 'w' },
  { t: 'buy', i: 'espada' },
  { t: 'sell', n: -5 },
  { t: 'pick', h: 'toString' },
  { t: 'rr' },
  { t: 'spell', s: 'd', v: '__proto__' },
  { t: 'go' },
  { t: 'create', size: 3, diff: 'dificil', name: 'Zé' },
  { t: 'join', room: 'abcd', name: 'x'.repeat(300) },
  { t: 'team' },
  { t: 'cfg', size: 2 },
  { t: 'cfg', diff: 'facil' },
  { t: 'start' },
  { t: 'c', s: '__proto__', x: 'a', z: null },
  { t: 'at', id: 'x' },
  { t: 'dbg', gold: 5000 },
  { t: 'mv', x: 1, z: 2, extra: true },
];
const before = { ...fallbacks };
for (const c of commands) check(c, 't');

// pacote com várias mensagens, misturando pronta e crua
const mix = [pack(sim.snapshot()), sim.meState(me), { e: 'ann', t: 'Olá', s: '', k: 'info', tm: -1 }, pack({ e: 'hit', v: 1, a: 2, d: 30, k: 0, au: 1, cr: 0 })];
const got = decode(encode(mix));
if (got.length !== 4 || got[0].e !== 'snap' || got[1].e !== 'me' || got[2].t !== 'Olá' || got[3].d !== 30) wrong.push('pacote com várias mensagens voltou errado');

// lixo não pode travar nem devolver mensagem do sentido errado
let garbage = 0;
for (let i = 0; i < 20000; i++) {
  const junk = new Uint8Array(1 + Math.floor(Math.random() * 60));
  for (let j = 0; j < junk.length; j++) junk[j] = Math.floor(Math.random() * 256);
  try {
    for (const m of decode(junk, 't')) if (m && typeof m === 'object' && 'e' in m && !('t' in m)) wrong.push('lixo virou evento no servidor');
  } catch {
    garbage++;
  }
}
try {
  decode(pack(sim.snapshot()), 't');
  wrong.push('o servidor aceitou um retrato vindo do navegador');
} catch {
  /* é pra recusar */
}

// tempo: o mesmo conjunto de mensagens, ida e volta, nos dois formatos
const sample = all.filter((m) => m.e).slice(-20000);
const time = (fn) => {
  for (let i = 0; i < 2; i++) fn();
  const t = performance.now();
  for (let i = 0; i < 5; i++) fn();
  return (performance.now() - t) / 5;
};
const packed = sample.map((m) => pack(m));
const strings = sample.map((m) => JSON.stringify(m));
const tEncBin = time(() => sample.forEach((m) => pack(m)));
const tEncJson = time(() => sample.forEach((m) => JSON.stringify(m)));
const tDecBin = time(() => packed.forEach((b) => decode(b)));
const tDecJson = time(() => strings.forEach((s) => JSON.parse(s)));

const rows = Object.entries(stats).sort((a, b) => b[1].json - a[1].json);
const tot = rows.reduce((a, [, s]) => ({ bin: a.bin + s.bin, json: a.json + s.json }), { bin: 0, json: 0 });
console.log(`${steps} passos de simulação (${(sim.gameTime / 60).toFixed(1)} min de jogo)\n`);
console.log('mensagem   quantas   JSON médio   binário médio   fica em');
for (const [name, s] of rows.slice(0, 14)) {
  console.log(`${name.padEnd(9)} ${String(s.n).padStart(8)} ${(s.json / s.n).toFixed(0).padStart(10)} B ${(s.bin / s.n).toFixed(0).padStart(13)} B ${((100 * s.bin) / s.json).toFixed(0).padStart(8)}%`);
}
console.log(`\ntotal: ${(tot.json / 1024).toFixed(0)} KB em JSON, ${(tot.bin / 1024).toFixed(0)} KB em binário (${((100 * tot.bin) / tot.json).toFixed(0)}%)`);
console.log(`montar ${sample.length} mensagens: binário ${tEncBin.toFixed(1)} ms · JSON ${tEncJson.toFixed(1)} ms`);
console.log(`ler    ${sample.length} mensagens: binário ${tDecBin.toFixed(1)} ms · JSON ${tDecJson.toFixed(1)} ms`);
const game = Object.entries(before);
console.log(`eventos do jogo que caíram no JSON: ${game.length ? game.map(([k, v]) => `${k} ×${v}`).join(', ') : 'nenhum'}`);
console.log(`lixo aleatório: ${garbage} de 20000 pacotes recusados, nenhum travou`);
console.log(wrong.length ? `\nERROS (${wrong.length}):\n- ${wrong.slice(0, 8).join('\n- ')}` : '\nTudo chegou igual ao que o JSON entregava.');
process.exit(wrong.length ? 1 : 0);
