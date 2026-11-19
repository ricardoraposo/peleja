// Estressa o servidor online: sobe um servidor próprio, lota a sala com jogadores falsos
// que escolhem herói, andam, lançam habilidades e compram, e mede o que o servidor entrega.
//   node scripts/stress.js [segundos de partida] [jogadores] [ações por segundo de cada um]
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { HERO_ORDER, ITEM_ORDER, SPELL_ORDER } from '../src/config.js';

const SECS = Number(process.argv[2]) || 40;
const N = Number(process.argv[3]) || 10;
const APS = Number(process.argv[4]) || 6;
const PORT = 7800 + Math.floor(Math.random() * 150);
const URL = `ws://localhost:${PORT}/ws`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);

const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverErr = '';
let serverDead = false;
server.stderr.on('data', (d) => (serverErr += d));
server.on('exit', () => (serverDead = true));
await new Promise((r) => server.stdout.once('data', r));

const cpuTicks = () => {
  const f = readFileSync(`/proc/${server.pid}/stat`, 'utf8').split(') ')[1].split(' ');
  return Number(f[11]) + Number(f[12]);
};
const rssMb = () => Number(readFileSync(`/proc/${server.pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]) / 1024;

class Fake {
  constructor(i) {
    this.i = i;
    this.name = `Teste${i + 1}`;
    this.bytes = 0;
    this.frames = 0;
    this.gaps = [];
    this.snapBytes = [];
    this.lastSnap = 0;
    this.events = {};
    this.phase = '';
    this.units = [];
    this.me = null;
    this.id = 0;
    this.closed = false;
    this.full = false;
    this.rtt = [];
    this.probe = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on('open', () => {
        this.send({ t: 'join', name: this.name });
        resolve();
      });
      this.ws.on('error', reject);
      this.ws.on('close', () => (this.closed = true));
      this.ws.on('message', (data) => {
        this.bytes += data.length;
        this.frames++;
        let list;
        try {
          list = JSON.parse(data.toString());
        } catch {
          this.events.lixo = (this.events.lixo || 0) + 1;
          return;
        }
        for (const m of Array.isArray(list) ? list : [list]) this.on(m, data.length);
      });
    });
  }

  on(m) {
    this.events[m.e] = (this.events[m.e] || 0) + 1;
    if (m.e === 'welcome') this.id = m.id;
    else if (m.e === 'full') this.full = true;
    else if (m.e === 'phase') this.phase = m.ph;
    else if (m.e === 'me') {
      // tempo de resposta: mandei comprar um item e espero o ouro cair
      if (this.probe && m.g < this.probe.gold) {
        this.rtt.push(performance.now() - this.probe.t);
        this.probe = null;
      }
      this.me = m;
    } else if (m.e === 'snap') {
      const now = performance.now();
      if (this.lastSnap && this.phase === 'playing') this.gaps.push(now - this.lastSnap);
      this.lastSnap = now;
      this.phase = m.ph;
      this.units = m.u;
      this.snapBytes.push(JSON.stringify(m).length);
    }
  }

  send(m) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  draft() {
    this.send({ t: 'pick', h: rnd(HERO_ORDER) });
    this.send({ t: 'spell', s: 'd', v: rnd(SPELL_ORDER) });
    this.send({ t: 'spell', s: 'f', v: rnd(SPELL_ORDER) });
    this.send({ t: 'go' });
  }

  act() {
    const mine = this.units.find((u) => u[0] === this.id);
    if (!mine) return;
    const foes = this.units.filter((u) => u[2] !== mine[2] && u[8] & 1);
    const near = foes.filter((u) => Math.hypot(u[3] - mine[3], u[4] - mine[4]) < 14);
    const t = near.length ? rnd(near) : null;
    const r = Math.random();
    if (r < 0.1) for (const s of ['q', 'w', 'e', 'r']) this.send({ t: 'up', s });
    else if (r < 0.2 && this.me?.sh && !this.probe) {
      this.probe = { t: performance.now(), gold: this.me.g };
      this.send({ t: 'buy', i: rnd(ITEM_ORDER) });
      setTimeout(() => (this.probe = null), 1500);
    } else if (t && r < 0.6) this.send({ t: 'c', s: rnd(['q', 'w', 'e', 'r', 'd', 'f']), x: t[3], z: t[4], id: t[0] });
    else if (t && r < 0.8) this.send({ t: 'at', id: t[0] });
    else this.send({ t: 'am', x: mine[2] === 0 ? 60 : -60, z: (Math.random() - 0.5) * 8 });
  }
}

const out = [];
const say = (k, v) => out.push([k, v]);
const problems = [];

try {
  // ---------- sala cheia jogando ----------
  const fakes = Array.from({ length: N }, (_, i) => new Fake(i));
  for (const f of fakes) await f.connect();
  await sleep(500);
  say('entraram', `${fakes.filter((f) => f.id).length} de ${N}`);
  for (const f of fakes) f.draft();
  const t0 = performance.now();
  while (fakes[0].phase !== 'playing' && performance.now() - t0 < 40000) await sleep(100);
  say('escolha → partida', `${((performance.now() - t0) / 1000).toFixed(1)} s depois de todos darem pronto`);
  if (fakes[0].phase !== 'playing') problems.push('a partida não começou depois de todo mundo dar pronto');

  for (const f of fakes) {
    f.bytes = 0;
    f.frames = 0;
    f.gaps = [];
    f.snapBytes = [];
  }
  const cpu0 = cpuTicks();
  const start = performance.now();
  const timers = fakes.map((f) => setInterval(() => f.act(), 1000 / APS));
  let maxUnits = 0;
  while (performance.now() - start < SECS * 1000 && !serverDead) {
    await sleep(500);
    maxUnits = Math.max(maxUnits, fakes[0].units.length);
  }
  timers.forEach(clearInterval);
  const dur = (performance.now() - start) / 1000;
  const cpu = ((cpuTicks() - cpu0) / 100 / dur) * 100;
  const gaps = fakes.flatMap((f) => f.gaps);
  const sizes = fakes.flatMap((f) => f.snapBytes);
  const rtt = fakes.flatMap((f) => f.rtt);
  say('duração medida', `${dur.toFixed(0)} s, ${N} jogadores, ${APS} ações/s cada`);
  say('unidades no mapa (pico)', maxUnits);
  say('CPU do servidor', `${cpu.toFixed(0)}% de um núcleo`);
  say('memória do servidor', `${rssMb().toFixed(0)} MB`);
  say('banda por jogador', `${(fakes.reduce((a, f) => a + f.bytes, 0) / N / dur / 1024).toFixed(1)} KB/s (${(fakes[0].frames / dur).toFixed(0)} pacotes/s)`);
  say('tamanho do retrato do mundo', `médio ${(sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024).toFixed(1)} KB · maior ${(Math.max(...sizes) / 1024).toFixed(1)} KB`);
  say('intervalo entre retratos', `mediana ${pct(gaps, 0.5).toFixed(0)} ms · p99 ${pct(gaps, 0.99).toFixed(0)} ms · pior ${Math.max(...gaps).toFixed(0)} ms (alternam 33 e 67)`);
  say('resposta a um comando (compra)', rtt.length ? `mediana ${pct(rtt, 0.5).toFixed(0)} ms · p95 ${pct(rtt, 0.95).toFixed(0)} ms (${rtt.length} amostras)` : 'sem amostras');
  const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
  say('retratos por segundo', `${(1000 / mean).toFixed(1)} (o servidor promete 20)`);
  if (1000 / mean < 18) problems.push(`servidor entrega ${(1000 / mean).toFixed(1)} retratos por segundo em vez de 20`);
  if (pct(gaps, 0.99) > 120) problems.push(`retratos atrasando: p99 de ${pct(gaps, 0.99).toFixed(0)} ms`);
  if (cpu > 70) problems.push(`servidor usando ${cpu.toFixed(0)}% de CPU`);

  // ---------- casos de borda ----------
  if (N >= 10) {
    const extra = new Fake(99);
    await extra.connect();
    await sleep(400);
    say('11º jogador', extra.full ? 'recusado com aviso de sala cheia' : extra.id ? 'ENTROU (não devia)' : 'sem resposta');
    if (!extra.full) problems.push('11º jogador não recebeu aviso de sala cheia');
    extra.ws.close();
  }

  const spam = fakes[0];
  const before = spam.frames;
  for (let i = 0; i < 3000; i++) spam.send({ t: 'mv', x: Math.random() * 100 - 50, z: 0 });
  spam.ws.send('isso não é json');
  spam.ws.send(JSON.stringify({ t: 'c', s: '__proto__', x: 'a', z: null }));
  spam.ws.send(JSON.stringify({ t: 'buy', i: 'constructor' }));
  spam.ws.send(JSON.stringify({ t: 'pick', h: 'toString' }));
  spam.ws.send(JSON.stringify({ t: 'spell', s: 'd', v: '__proto__' }));
  spam.ws.send(JSON.stringify({ t: 'sell', n: -5 }));
  spam.ws.send(JSON.stringify({ t: 'at', id: 'x' }));
  spam.ws.send(JSON.stringify([1, 2, 3]));
  spam.ws.send(JSON.stringify(null));
  await sleep(1500);
  say('enxurrada + mensagens quebradas', serverDead ? 'SERVIDOR CAIU' : `servidor de pé, ${spam.frames - before} pacotes recebidos em 1,5 s`);
  if (serverDead) problems.push('servidor caiu com mensagens quebradas');
  try {
    spam.ws.send('x'.repeat(40000));
  } catch {
    /* o servidor pode fechar na hora */
  }
  await sleep(500);
  say('mensagem gigante (40 KB)', spam.closed ? 'conexão derrubada, servidor de pé' : 'ignorada');

  // metade sai no meio da partida, depois todo mundo sai e um volta
  for (const f of fakes.slice(0, Math.ceil(N / 2))) f.ws.close();
  await sleep(1000);
  const stay = fakes[fakes.length - 1];
  const rosterOk = stay.phase === 'playing' && !stay.closed;
  say('metade saiu no meio', rosterOk ? 'partida segue, bots assumem' : 'quem ficou perdeu a partida');
  if (!rosterOk) problems.push('saída de jogadores derrubou quem ficou');
  for (const f of fakes) f.ws.close();
  await sleep(800);
  const back = new Fake(50);
  await back.connect();
  await sleep(1500);
  say('todos saem e um volta', back.id ? `entra numa partida nova, fase "${back.phase}"` : 'não conseguiu entrar');
  if (!back.id || back.phase !== 'draft') problems.push(`voltar pra sala vazia caiu na fase "${back.phase}"`);
  back.ws.close();
  await sleep(300);
} catch (e) {
  problems.push(`o teste quebrou: ${e.message}`);
}

if (serverErr.trim()) problems.push(`erro no servidor: ${serverErr.trim().split('\n').slice(0, 4).join(' | ')}`);
server.kill();
const w = Math.max(...out.map(([k]) => k.length));
for (const [k, v] of out) console.log(`${k.padEnd(w)}  ${v}`);
console.log(problems.length ? `\nPROBLEMAS:\n- ${problems.join('\n- ')}` : '\nNenhum problema encontrado.');
process.exit(problems.length ? 1 : 0);
