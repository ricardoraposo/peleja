import { Sim } from './sim.js';
import { SnapReader, decode, encode } from './wire.js';

const STEP = 1 / 30;

// Partida contra bots: a simulação roda aqui mesmo no navegador.
export class LocalTransport {
  constructor({ difficulty = 'normal', teamSize = 5, sandbox = false } = {}) {
    this.sandbox = sandbox && import.meta.env?.DEV === true;
    sandbox = this.sandbox;
    this.speed = 1;
    this.local = true;
    this.interpDelay = 0;
    this.queue = [];
    this.handler = null;
    this.me = null;
    this.boardT = 0;
    this.acc = 0;
    this.paused = false;
    this.sim = new Sim({ difficulty, teamSize, sandbox, emit: (msg, opts) => this.route(msg, opts) });
  }

  route(msg, opts) {
    if (opts?.to && (!this.me || opts.to !== this.me.id)) return;
    if (opts?.team !== undefined && (!this.me || this.me.team !== opts.team)) return;
    this.queue.push(msg);
  }

  onMessage(fn) {
    this.handler = fn;
  }

  send(msg) {
    if (msg.t === 'join') {
      this.me = this.sim.addHuman(msg.name);
      if (this.sandbox && this.me) this.sim.startSandbox(this.me);
      this.queue.push({ e: 'welcome', id: this.me?.id || 0, local: true });
      this.queue.push({ e: 'roster', l: this.sim.roster() });
      return;
    }
    if (this.me) this.sim.handle(this.me, msg);
  }

  update(dt) {
    if (!this.paused) {
      this.acc = Math.min(this.acc + dt * this.speed, 0.25);
      while (this.acc >= STEP) {
        this.sim.step(STEP);
        this.acc -= STEP;
      }
    }
    const snap = this.sim.snapshot(this.me?.team);
    snap.lt = this.acc;
    this.queue.push(snap);
    if (this.me) this.queue.push(this.sim.meState(this.me));
    this.boardT -= dt;
    if (this.boardT <= 0) {
      this.boardT = 0.5;
      this.queue.push(this.sim.board());
    }
    const q = this.queue;
    this.queue = [];
    for (const m of q) this.handler?.(m);
  }

  close() {
    this.handler = null;
  }
}

// Partida online: o servidor manda, o navegador só desenha.
export class SocketTransport {
  constructor(url) {
    this.local = false;
    this.interpDelay = 0.1;
    this.handler = null;
    this.pending = [];
    this.open = false;
    this.closed = false;
    this.snaps = new SnapReader();
    // maior espera entre dois pacotes do servidor; o medidor de desempenho lê e zera
    this.gap = 0;
    this.lastAt = 0;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.addEventListener('open', () => {
      this.open = true;
      if (this.pending.length) this.ws.send(encode(this.pending));
      this.pending = [];
    });
    this.ws.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') return;
      const now = performance.now();
      if (this.lastAt) this.gap = Math.max(this.gap, now - this.lastAt);
      this.lastAt = now;
      let list;
      try {
        list = decode(new Uint8Array(ev.data), 'e');
      } catch {
        return;
      }
      for (const raw of list) {
        const m = this.snaps.read(raw);
        if (m) this.handler?.(m);
      }
    });
    this.ws.addEventListener('close', () => {
      this.closed = true;
      this.handler?.({ e: 'disconnect' });
    });
    this.ws.addEventListener('error', () => {
      if (!this.open) this.handler?.({ e: 'error' });
    });
  }

  onMessage(fn) {
    this.handler = fn;
  }

  send(msg) {
    if (this.closed) return;
    if (!this.open) {
      this.pending.push(msg);
      return;
    }
    this.ws.send(encode([msg]));
  }

  update() {}

  close() {
    this.handler = null;
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      return;
    }
  }
}

export function serverUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}
