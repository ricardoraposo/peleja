import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Sim } from '../src/sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 7788;
const TEAM = Number(process.env.TEAM) || 5;
const DIFFICULTY = process.env.DIFFICULTY || 'normal';
const TICK = 1 / 30;
const SNAP = 1 / 20;
const MAX_MSGS_PER_SEC = 60;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const clients = new Map();

function route(msg, opts) {
  for (const c of clients.values()) {
    if (!c.hero) continue;
    if (opts?.to && c.hero.id !== opts.to) continue;
    c.queue.push(msg);
  }
}

const sim = new Sim({ difficulty: DIFFICULTY, teamSize: TEAM, persistent: true, emit: route });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    if (url.pathname === '/' || url.pathname === '') file = path.join(ROOT, 'index.html');
    const body = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('não encontrado');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  const c = { ws, hero: null, queue: [], budget: MAX_MSGS_PER_SEC, budgetT: Date.now() };
  clients.set(ws, c);
  ws.on('message', (data) => {
    const now = Date.now();
    if (now - c.budgetT > 1000) {
      c.budget = MAX_MSGS_PER_SEC;
      c.budgetT = now;
    }
    if (--c.budget < 0) return;
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      if (c.hero) return;
      c.hero = sim.addHuman(msg.name);
      if (!c.hero) {
        ws.send(JSON.stringify([{ e: 'full' }]));
        ws.close();
        return;
      }
      c.queue.push({ e: 'welcome', id: c.hero.id });
      c.queue.push({ e: 'roster', l: sim.roster() });
      c.queue.push({ e: 'phase', ph: sim.phase, m: sim.matchNo });
      c.queue.push(sim.board());
      c.queue.push(sim.snapshot());
      console.log(`entrou: ${c.hero.name} (${sim.humans().length} online)`);
      return;
    }
    if (c.hero) sim.handle(c.hero, msg);
  });
  ws.on('close', () => {
    clients.delete(ws);
    if (c.hero) {
      console.log(`saiu: ${c.hero.name}`);
      sim.removeHuman(c.hero.id);
    }
  });
  ws.on('error', () => ws.close());
});

function flush() {
  for (const c of clients.values()) {
    if (c.queue.length === 0) continue;
    if (c.ws.readyState === 1 && c.ws.bufferedAmount < 1024 * 1024) c.ws.send(JSON.stringify(c.queue));
    c.queue = [];
  }
}

let last = performance.now();
let snapAcc = 0;
let boardAcc = 0;
let acc = 0;
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (sim.humans().length === 0) return;
  acc += dt;
  while (acc >= TICK) {
    sim.step(TICK);
    acc -= TICK;
  }
  snapAcc += dt;
  boardAcc += dt;
  if (snapAcc >= SNAP) {
    snapAcc = 0;
    const snap = sim.snapshot();
    for (const c of clients.values()) {
      if (!c.hero) continue;
      c.queue.push(snap);
      c.queue.push(sim.meState(c.hero));
    }
  }
  if (boardAcc >= 1) {
    boardAcc = 0;
    route(sim.board());
  }
  flush();
}, 1000 * TICK);

server.listen(PORT, () => {
  console.log(`Peleja online em http://localhost:${PORT}`);
  console.log(`${TEAM} x ${TEAM}, bots completam as vagas (dificuldade ${DIFFICULTY}).`);
});
