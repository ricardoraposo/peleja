import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Sim } from '../src/sim.js';
import { decode, encode, pack } from '../src/wire.js';

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

// ---------- salas ----------
// Cada sala tem um código de 4 letras. Ela começa no saguão (as pessoas entram, escolhem o time e o dono
// ajusta a partida); quando o dono manda começar, a sala cria a simulação e todo mundo vai pra escolha de herói.
// Acabou a partida, a sala volta pro saguão com as mesmas pessoas.

const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_ROOMS = 60;
const BACK_TO_LOBBY = 12;
const DIFFS = ['facil', 'normal', 'dificil'];
let nextClientId = 1;

const cleanName = (name) => String(name || 'Jogador').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Jogador';
const clampSize = (v) => Math.max(1, Math.min(5, Math.round(Number(v)) || TEAM));

class Room {
  constructor(code, size, diff) {
    this.code = code;
    this.size = clampSize(size);
    this.diff = DIFFS.includes(diff) ? diff : DIFFICULTY;
    this.members = new Set();
    this.host = null;
    this.state = 'lobby';
    this.sim = null;
    this.acc = 0;
    this.snapAcc = 0;
    this.boardAcc = 0;
    this.backT = 0;
  }

  count(team) {
    let n = 0;
    for (const m of this.members) if (m.team === team) n++;
    return n;
  }

  // manda o estado da sala pra todo mundo (cada um recebe também quem ele é)
  announce() {
    const members = [...this.members].map((m) => [m.id, m.name, m.team]);
    for (const m of this.members) m.queue.push({ e: 'room', code: this.code, you: m.id, host: this.host?.id || 0, state: this.state, size: this.size, diff: this.diff, members });
  }

  add(c, name) {
    c.name = cleanName(name);
    if (this.state === 'lobby') {
      const n = [this.count(0), this.count(1)];
      if (n[0] >= this.size && n[1] >= this.size) return false;
      c.team = n[0] <= n[1] ? 0 : 1;
    } else {
      // partida rolando: entra no lugar de um bot
      const hero = this.sim.addHuman(c.name);
      if (!hero) return false;
      c.hero = hero;
      c.team = hero.team;
    }
    c.room = this;
    this.members.add(c);
    if (!this.host) this.host = c;
    this.announce();
    if (c.hero) this.welcome(c);
    console.log(`[${this.code}] entrou: ${c.name} (${this.members.size} na sala)`);
    return true;
  }

  remove(c) {
    if (!this.members.delete(c)) return;
    if (c.hero && this.sim) this.sim.removeHuman(c.hero.id);
    c.hero = null;
    c.room = null;
    console.log(`[${this.code}] saiu: ${c.name}`);
    if (this.members.size === 0) {
      rooms.delete(this.code);
      return;
    }
    if (this.host === c) this.host = this.members.values().next().value;
    this.announce();
  }

  welcome(c) {
    c.queue.push({ e: 'welcome', id: c.hero.id });
    c.queue.push({ e: 'roster', l: this.sim.roster() });
    c.queue.push({ e: 'phase', ph: this.sim.phase, m: this.sim.matchNo });
    c.queue.push(this.sim.board());
    c.queue.push(this.sim.snapshot());
  }

  route(msg, opts) {
    if (msg.e === 'end') {
      msg = { ...msg, next: BACK_TO_LOBBY };
      this.backT = BACK_TO_LOBBY;
    }
    // o que vai pra sala toda é montado em binário uma vez só e o mesmo pedaço entra no pacote de cada um
    const out = opts?.to ? msg : pack(msg);
    for (const m of this.members) {
      if (!m.hero) continue;
      if (opts?.to && m.hero.id !== opts.to) continue;
      m.queue.push(out);
    }
  }

  start() {
    if (this.state !== 'lobby') return;
    this.sim = new Sim({ difficulty: this.diff, teamSize: this.size, readyDelay: 3, emit: (msg, opts) => this.route(msg, opts) });
    this.state = 'match';
    this.acc = this.snapAcc = this.boardAcc = this.backT = 0;
    for (const m of this.members) {
      m.hero = this.sim.addHuman(m.name, m.team);
      if (m.hero) m.team = m.hero.team;
    }
    this.announce();
    for (const m of this.members) if (m.hero) this.welcome(m);
    console.log(`[${this.code}] partida começou com ${this.members.size} jogador(es)`);
  }

  toLobby() {
    this.sim = null;
    this.state = 'lobby';
    for (const m of this.members) m.hero = null;
    this.announce();
  }

  handle(c, msg) {
    if (this.state === 'match') {
      if (c.hero) this.sim.handle(c.hero, msg);
      return;
    }
    switch (msg.t) {
      case 'team': {
        const to = 1 - c.team;
        if (this.count(to) < this.size) {
          c.team = to;
          this.announce();
        }
        break;
      }
      case 'cfg': {
        if (c !== this.host) break;
        const size = clampSize(msg.size ?? this.size);
        if (size >= this.count(0) && size >= this.count(1)) this.size = size;
        if (DIFFS.includes(msg.diff)) this.diff = msg.diff;
        this.announce();
        break;
      }
      case 'start':
        if (c === this.host) this.start();
        break;
      default:
        break;
    }
  }

  tick(dt) {
    if (!this.sim) return;
    this.acc += dt;
    while (this.acc >= TICK) {
      this.sim.step(TICK);
      this.acc -= TICK;
    }
    this.snapAcc += dt;
    this.boardAcc += dt;
    if (this.snapAcc >= SNAP) {
      // guarda a sobra: zerar aqui arredondava pra um retrato a cada dois passos (15 por segundo em vez de 20)
      this.snapAcc = Math.min(this.snapAcc - SNAP, SNAP);
      const snap = pack(this.sim.snapshot());
      for (const m of this.members) {
        if (!m.hero) continue;
        m.queue.push(snap);
        m.queue.push(this.sim.meState(m.hero));
      }
    }
    if (this.boardAcc >= 1) {
      this.boardAcc = 0;
      this.route(this.sim.board());
    }
    if (this.backT > 0) {
      this.backT -= dt;
      if (this.backT <= 0) this.toLobby();
    }
  }
}

function newCode() {
  for (let n = 0; n < 200; n++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(code)) return code;
  }
  return null;
}

const clients = new Map();

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
  const c = { ws, id: nextClientId++, name: 'Jogador', room: null, team: 0, hero: null, queue: [], budget: MAX_MSGS_PER_SEC, budgetT: Date.now() };
  clients.set(ws, c);
  const refuse = (e) => {
    ws.send(encode([{ e }]));
    ws.close();
  };
  const handle = (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (c.room) {
      c.room.handle(c, msg);
      return;
    }
    if (msg.t === 'create') {
      const code = rooms.size < MAX_ROOMS ? newCode() : null;
      if (!code) {
        refuse('busy');
        return;
      }
      const room = new Room(code, msg.size, msg.diff);
      rooms.set(code, room);
      room.add(c, msg.name);
    } else if (msg.t === 'join') {
      const room = rooms.get(String(msg.room || '').toUpperCase().trim());
      if (!room) refuse('noroom');
      else if (!room.add(c, msg.name)) refuse('full');
    }
  };
  ws.on('message', (data, isBinary) => {
    const now = Date.now();
    if (now - c.budgetT > 1000) {
      c.budget = MAX_MSGS_PER_SEC;
      c.budgetT = now;
    }
    if (--c.budget < 0 || !isBinary) return;
    let list;
    try {
      list = decode(data, 't');
    } catch {
      return;
    }
    // um pacote pode trazer vários comandos: cada um gasta do mesmo limite por segundo
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && --c.budget < 0) return;
      if (ws.readyState !== 1) return;
      handle(list[i]);
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
    c.room?.remove(c);
  });
  ws.on('error', () => ws.close());
});

function flush() {
  for (const c of clients.values()) {
    if (c.queue.length === 0) continue;
    if (c.ws.readyState === 1 && c.ws.bufferedAmount < 1024 * 1024) c.ws.send(encode(c.queue));
    c.queue = [];
  }
}

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  for (const room of rooms.values()) room.tick(dt);
  flush();
}, 1000 * TICK);

server.listen(PORT, () => {
  console.log(`Peleja online em http://localhost:${PORT}`);
  console.log(`Salas com código de 4 letras; bots completam as vagas (padrão ${TEAM} x ${TEAM}, dificuldade ${DIFFICULTY}).`);
});
