// Formato binário da rede, usado igual pelo servidor e pelo navegador.
// Cada pacote é uma fila de mensagens: um byte com o tipo e depois os campos na ordem da tabela, sem nomes.
// Inteiros vão em tamanho variável (1 byte até 127), posições em décimos, ângulos em centésimos.
// Nada se perde: se um valor não cabe no tipo declarado (ou a mensagem não está na tabela), ela vai
// inteira como JSON dentro do pacote (tipo 0) e chega igual do outro lado.
//
// Tipos de campo: u inteiro ≥ 0 · i inteiro · d1 uma casa · d2 duas casas · n número qualquer · s texto
// Com * é lista, com ? o campo pode faltar, e [ ... ] é lista de linhas com essas colunas.

const EVENTS = {
  snap: { t: 'd2', ph: 's', pt: 'd1', gt: 'd1', k: 'u*', wv: 'd1', u: ['u', 'u', 'u', 'd1', 'd1', 'd2', 'u', 'u', 'u', 'u', 'i', 'u', 'd1'], pk: 'u*' },
  me: { id: 'u', g: 'i', it: 's*', rk: 'u*', pt: 'i', sp: 'n*', ic: 'd1*', cd: 'd1*', cm: 'd1*', xp: 'u', xn: 'n', lv: 'u', s: 'n*', sh: 'u', rd: 'u', ch: 'u', fu: 'u?', st: 's?', rr: 'u?' },
  hit: { v: 'u', a: 'u', d: 'i', k: 'u', au: 'u', cr: 'u' },
  swing: { id: 'u', v: 'u', r: 'u', w: 'u' },
  pj: { id: 'u', o: 'u', x: 'd1', z: 'd1', dx: 'd2', dz: 'd2', h: 'u', s: 'n', r: 'n', w: 'd2', c: 's', k: 's', sl: 's', wd: 'n' },
  pjx: { id: 'u', x: 'd1?', z: 'd1?' },
  heal: { v: 'u', d: 'i' },
  cast: { id: 'u', s: 's', x: 'd1', z: 'd1', ct: 'n' },
  boom: { x: 'd1', z: 'd1', r: 'n', c: 's', al: 'u?', o: 'u' },
  aoe: { x: 'd1', z: 'd1', r: 'n', t: 'n', c: 's', tm: 'u', o: 'u' },
  cone: { id: 'u', x: 'd1', z: 'd1', a: 'd2', r: 'n', w: 'n', c: 's' },
  zone: { id: 'u', x: 'd1', z: 'd1', r: 'n', t: 'n', c: 's', tm: 'u', o: 'u', l: 'd1*?' },
  zonex: { id: 'u' },
  blink: { id: 'u', a: 'd1*', b: 'd1*', c: 's', fl: 'u' },
  dash: { id: 'u', d: 'd2', a: 'u', c: 's' },
  buff: { id: 'u', s: 's', c: 's' },
  cancel: { id: 'u' },
  gold: { d: 'i', x: 'd1', z: 'd1' },
  xp: { v: 'i', x: 'd1', z: 'd1' },
  rank: { s: 's', r: 'u' },
  lvl: { id: 'u', l: 'u' },
  kill: { k: 'u', kk: 'i', v: 'u', as: 'u*' },
  struct: { id: 'u', d: 'u' },
  pack: { i: 'u', u: 'u', id: 'u?' },
  laser: { tm: 'u', v: 'u' },
  cannon: { id: 'u', x: 'd1', z: 'd1', a: 'n' },
  shot: { id: 'u', x: 'd1', z: 'd1', l: 'd2', d: 'd2' },
  land: { id: 'u', x: 'd1', z: 'd1', r: 'n' },
  spawn: { id: 'u' },
  bought: { i: 's' },
  use: { id: 'u', i: 's' },
  ann: { t: 's', s: 's', k: 's', tm: 'i' },
  phase: { ph: 's', m: 'u' },
  welcome: { id: 'u' },
  roster: { l: ['u', 'u', 's', 'u', 'i', 's*'] },
  board: { l: ['u', 'u', 'u', 'u', 'u', 'u', 's*', 'u', 'u', 'u'] },
  end: { w: 'i', next: 'n', t: 'u', k: 'u*' },
  room: { code: 's', you: 'u', host: 'u', state: 's', size: 'u', diff: 's', bots: 'u*', members: ['u', 's', 'u'] },
  full: {},
  noroom: {},
  busy: {},
  // retrato só com o que mudou desde o anterior (ver SnapDelta lá embaixo)
  emp: { id: 'u', s: 's' },
  bite: { id: 'u', v: 'u', n: 'u', emp: 'u' },
  mark: { id: 'u', x: 'd1', z: 'd1', b: 'd1*', t: 'n', c: 's' },
  sd: { t: 'd2', pt: 'd1', gt: 'd1', wv: 'd1', ph: 's?', k: 'u*?', pk: 'u*?', x: 'u*', c: 'i*', n: ['u', 'u', 'u', 'd1', 'd1', 'd2', 'u', 'u', 'u', 'u', 'i', 'u', 'd1'] },
};

const COMMANDS = {
  mv: { x: 'n', z: 'n' },
  am: { x: 'n', z: 'n', h: 'u?' },
  at: { id: 'u' },
  st: {},
  rc: {},
  cn: { x: 'n', z: 'n' },
  c: { s: 's', x: 'n', z: 'n', id: 'u?' },
  up: { s: 's' },
  buy: { i: 's' },
  sell: { n: 'i' },
  use: { n: 'u' },
  pick: { h: 's' },
  rr: {},
  spell: { s: 's', v: 's' },
  go: {},
  create: { size: 'n?', diff: 's?', name: 's?' },
  join: { room: 's?', name: 's?' },
  team: {},
  cfg: { size: 'n?', diff: 's?' },
  start: {},
  bot: { tm: 'u', d: 'i' },
};

// quantas mensagens saíram/chegaram pelo caminho do JSON, por tipo (serve pra achar buraco na tabela)
export const fallbacks = {};

// ---------- escrita ----------

let buf = new Uint8Array(64 * 1024);
let dv = new DataView(buf.buffer);
let pos = 0;
let bad = false;
const utf8 = new TextEncoder();
const text = new TextDecoder();
const LIMIT = 2 ** 30;

function room(n) {
  if (pos + n <= buf.length) return;
  const next = new Uint8Array(Math.max(buf.length * 2, pos + n));
  next.set(buf.subarray(0, pos));
  buf = next;
  dv = new DataView(buf.buffer);
}

// sem checagem de espaço nem de tipo: quem chama garante
function rawU(v) {
  while (v > 127) {
    buf[pos++] = (v & 127) | 128;
    v >>>= 7;
  }
  buf[pos++] = v;
}

function wU(v) {
  if (v >>> 0 !== v) {
    bad = true;
    return;
  }
  room(5);
  rawU(v);
}

function wI(v) {
  if ((v | 0) !== v || v >= LIMIT || v < -LIMIT) {
    bad = true;
    return;
  }
  room(5);
  rawU(((v << 1) ^ (v >> 31)) >>> 0);
}

const fixed = (scale) => (v) => {
  const n = Math.round(v * scale);
  if (n / scale !== v) bad = true;
  else wI(n);
};
const wD1 = fixed(10);
const wD2 = fixed(100);

// número qualquer, sem perder nada: inteiro, décimos ou centésimos quando dá exato, senão os 8 bytes
function wN(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    bad = true;
    return;
  }
  room(9);
  for (let tag = 0, scale = 1; tag < 3; tag++, scale *= 10) {
    const n = Math.round(v * scale);
    if (n / scale === v && n < LIMIT && n >= -LIMIT) {
      buf[pos++] = tag;
      rawU(((n << 1) ^ (n >> 31)) >>> 0);
      return;
    }
  }
  buf[pos++] = 3;
  dv.setFloat64(pos, v, true);
  pos += 8;
}

function wS(v) {
  if (typeof v !== 'string') {
    bad = true;
    return;
  }
  const n = v.length;
  room(n * 3 + 5);
  // texto curto só com ASCII (quase todos): um byte de tamanho e os caracteres direto
  if (n < 128) {
    const start = pos;
    buf[pos++] = n;
    let i = 0;
    for (; i < n; i++) {
      const ch = v.charCodeAt(i);
      if (ch > 127) break;
      buf[pos++] = ch;
    }
    if (i === n) return;
    pos = start;
  }
  const bytes = utf8.encode(v);
  rawU(bytes.length);
  buf.set(bytes, pos);
  pos += bytes.length;
}

const listOf = (w) => (v) => {
  if (!Array.isArray(v)) {
    bad = true;
    return;
  }
  wU(v.length);
  for (let i = 0; i < v.length && !bad; i++) w(v[i]);
};

const rowsOf = (cols) => (v) => {
  if (!Array.isArray(v)) {
    bad = true;
    return;
  }
  wU(v.length);
  for (let i = 0; i < v.length && !bad; i++) {
    const row = v[i];
    if (!Array.isArray(row) || row.length !== cols.length) {
      bad = true;
      return;
    }
    for (let c = 0; c < cols.length; c++) cols[c](row[c]);
  }
};

// ---------- leitura ----------

let src = buf;
let sdv = dv;
let at = 0;
let end = 0;

function rU() {
  let b = src[at++];
  if (b < 128) return b;
  let v = b & 127;
  let shift = 7;
  do {
    b = src[at++];
    v += (b & 127) * 2 ** shift;
    shift += 7;
  } while (b > 127 && shift < 36);
  if (at > end) throw new RangeError('pacote cortado');
  return v;
}

function rI() {
  const u = rU();
  return (u >>> 1) ^ -(u & 1);
}

const rD1 = () => rI() / 10;
const rD2 = () => rI() / 100;

function rN() {
  const tag = src[at++];
  if (tag === 0) return rI();
  if (tag === 1) return rI() / 10;
  if (tag === 2) return rI() / 100;
  const v = sdv.getFloat64(at, true);
  at += 8;
  return v;
}

function rS() {
  const n = rU();
  if (n > end - at) throw new RangeError('pacote cortado');
  const stop = at + n;
  if (n < 24) {
    let s = '';
    let i = at;
    for (; i < stop; i++) {
      const ch = src[i];
      if (ch > 127) break;
      s += String.fromCharCode(ch);
    }
    if (i === stop) {
      at = stop;
      return s;
    }
  }
  const s = text.decode(src.subarray(at, stop));
  at = stop;
  return s;
}

// cada item ocupa pelo menos um byte, então uma lista nunca pode ser maior do que o que sobrou do pacote
function count() {
  const n = rU();
  if (n > end - at) throw new RangeError('pacote cortado');
  return n;
}

const readList = (r) => () => {
  const n = count();
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = r();
  return out;
};

const readRows = (cols) => () => {
  const n = count();
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array(cols.length);
    for (let c = 0; c < cols.length; c++) row[c] = cols[c]();
    out[i] = row;
  }
  return out;
};

// ---------- tabela ----------

const W = { u: wU, i: wI, d1: wD1, d2: wD2, n: wN, s: wS };
const R = { u: rU, i: rI, d1: rD1, d2: rD2, n: rN, s: rS };

function codec(type) {
  if (Array.isArray(type)) {
    const cols = type.map(codec);
    return { w: rowsOf(cols.map((c) => c.w)), r: readRows(cols.map((c) => c.r)), opt: false };
  }
  const opt = type.endsWith('?');
  const base = opt ? type.slice(0, -1) : type;
  if (base.endsWith('*')) {
    const item = base.slice(0, -1);
    return { w: listOf(W[item]), r: readList(R[item]), opt };
  }
  return { w: W[base], r: R[base], opt };
}

// o número de cada tipo é a posição nas tabelas: mexer na ordem muda o protocolo (cliente e servidor sobem juntos)
const specs = [null];
const byEvent = new Map();
const byCommand = new Map();
for (const [key, table, index] of [['e', EVENTS, byEvent], ['t', COMMANDS, byCommand]]) {
  for (const [name, fields] of Object.entries(table)) {
    const spec = { id: specs.length, key, name, fields: Object.entries(fields).map(([k, type]) => ({ k, ...codec(type) })) };
    specs.push(spec);
    index.set(name, spec);
  }
}

function writeJson(msg) {
  const json = JSON.stringify(msg);
  if (json === undefined) return;
  const name = String(msg?.e ?? msg?.t ?? '?');
  fallbacks[name] = (fallbacks[name] || 0) + 1;
  const bytes = utf8.encode(json);
  room(bytes.length + 6);
  buf[pos++] = 0;
  rawU(bytes.length);
  buf.set(bytes, pos);
  pos += bytes.length;
}

function write(msg) {
  if (msg instanceof Uint8Array) {
    room(msg.length);
    buf.set(msg, pos);
    pos += msg.length;
    return;
  }
  const spec = msg && typeof msg === 'object' ? (typeof msg.e === 'string' ? byEvent.get(msg.e) : byCommand.get(msg.t)) : null;
  if (!spec) {
    writeJson(msg);
    return;
  }
  const start = pos;
  bad = false;
  room(1);
  buf[pos++] = spec.id;
  let known = 1;
  for (const f of spec.fields) {
    const v = msg[f.k];
    if (f.opt) {
      room(1);
      if (v === undefined) {
        buf[pos++] = 0;
        continue;
      }
      buf[pos++] = 1;
    }
    known++;
    f.w(v);
    if (bad) break;
  }
  if (!bad) {
    // campo que a tabela não conhece: não dá pra mandar pela tabela sem perder
    let keys = 0;
    for (const k in msg) if (msg[k] !== undefined) keys++;
    if (keys === known) return;
  }
  pos = start;
  writeJson(msg);
}

// Uma mensagem já pronta, pra montar uma vez e mandar pra várias pessoas (o retrato do mundo, os eventos da sala).
export function pack(msg) {
  pos = 0;
  write(msg);
  return buf.slice(0, pos);
}

// Um pacote com a fila toda. A fila aceita mensagens normais e pedaços que já passaram pelo pack().
export function encode(list) {
  pos = 0;
  for (let i = 0; i < list.length; i++) write(list[i]);
  return buf.slice(0, pos);
}

// Devolve as mensagens do pacote. Pacote quebrado lança erro: quem chama decide o que fazer.
// Com `only` ('e' ou 't') recusa mensagem do outro sentido: o servidor só lê comandos, o navegador só eventos.
export function decode(bytes, only) {
  src = bytes;
  sdv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  at = 0;
  end = bytes.length;
  const out = [];
  while (at < end) {
    const id = src[at++];
    if (id === 0) {
      const n = count();
      const msg = JSON.parse(text.decode(src.subarray(at, at + n)));
      at += n;
      const name = String(msg?.e ?? msg?.t ?? '?');
      fallbacks[name] = (fallbacks[name] || 0) + 1;
      out.push(msg);
      continue;
    }
    const spec = specs[id];
    if (!spec || (only && spec.key !== only)) throw new RangeError('tipo de mensagem desconhecido');
    const msg = { [spec.key]: spec.name };
    for (const f of spec.fields) {
      if (f.opt && src[at++] !== 1) continue;
      msg[f.k] = f.r();
    }
    if (at > end) throw new RangeError('pacote cortado');
    out.push(msg);
  }
  return out;
}

// ---------- retrato só com o que mudou ----------
// A conexão entrega tudo em ordem e sem perder, então o servidor pode mandar só a diferença pro retrato anterior:
//   x  posições (na lista anterior) das unidades que sumiram
//   c  mudanças das que ficaram, tudo inteiro: [pulo até a próxima que mudou, quais colunas, diferença de cada uma] ...
//   n  linhas completas das unidades novas, que entram no fim da lista
// O estado da partida, o placar e os pacotes de vida só vão quando mudam. Quem acabou de entrar (ou perdeu
// um pacote) recebe um retrato inteiro, e dali pra frente as diferenças valem de novo.

const COLS = EVENTS.snap.u;
const SCALE = COLS.map((t) => (t === 'd1' ? 10 : t === 'd2' ? 100 : 1));
// ordem dos bits de "quais colunas": as que mais mudam primeiro, pra caber em um byte
const BITS = [3, 4, 5, 6, 8, 9, 7, 12, 11, 10, 1, 2];

// as colunas de uma unidade (menos o id) como inteiros na escala de cada uma; null se algum valor não é exato
function toInts(row) {
  if (!Array.isArray(row) || row.length !== COLS.length || row[0] >>> 0 !== row[0]) return null;
  const out = new Array(COLS.length - 1);
  for (let c = 1; c < COLS.length; c++) {
    const n = Math.round(row[c] * SCALE[c]);
    if (n / SCALE[c] !== row[c] || n >= LIMIT || n < -LIMIT) return null;
    out[c - 1] = n;
  }
  return out;
}

function capture(snap) {
  if (!snap || !Array.isArray(snap.u) || !Array.isArray(snap.k) || !Array.isArray(snap.pk) || typeof snap.ph !== 'string') return null;
  let keys = 0;
  for (const k in snap) if (snap[k] !== undefined) keys++;
  if (keys !== 9) return null;
  const ids = new Array(snap.u.length);
  const rows = new Array(snap.u.length);
  for (let i = 0; i < ids.length; i++) {
    const r = toInts(snap.u[i]);
    if (!r) return null;
    ids[i] = snap.u[i][0];
    rows[i] = r;
  }
  return { ids, rows, ph: snap.ph, k: snap.k.slice(), pk: snap.pk.slice() };
}

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Lado do servidor, um por sala.
export class SnapDelta {
  constructor() {
    this.prev = null;
  }

  reset() {
    this.prev = null;
  }

  // Devolve a mensagem de diferença pro retrato passado na chamada anterior, ou null quando não dá
  // (primeiro retrato, ou algum valor fora do formato): aí vai o retrato inteiro pra todo mundo.
  next(snap) {
    const prev = this.prev;
    const cur = (this.prev = capture(snap));
    if (!cur || !prev) return null;
    const x = [];
    const c = [];
    const n = [];
    let j = 0;
    let kept = 0;
    let last = 0;
    for (let i = 0; i < prev.ids.length; i++) {
      if (j >= cur.ids.length || cur.ids[j] !== prev.ids[i]) {
        x.push(i);
        continue;
      }
      const a = prev.rows[i];
      const b = cur.rows[j];
      let mask = 0;
      for (let bit = 0; bit < BITS.length; bit++) if (a[BITS[bit] - 1] !== b[BITS[bit] - 1]) mask |= 1 << bit;
      if (mask) {
        c.push(kept - last, mask);
        for (let bit = 0; bit < BITS.length; bit++) if (mask & (1 << bit)) c.push(b[BITS[bit] - 1] - a[BITS[bit] - 1]);
        last = kept;
      }
      kept++;
      j++;
    }
    for (; j < cur.ids.length; j++) n.push(snap.u[j]);
    const msg = { e: 'sd', t: snap.t, pt: snap.pt, gt: snap.gt, wv: snap.wv, x, c, n };
    if (cur.ph !== prev.ph) msg.ph = cur.ph;
    if (!sameList(cur.k, prev.k)) msg.k = cur.k;
    if (!sameList(cur.pk, prev.pk)) msg.pk = cur.pk;
    return msg;
  }
}

// Lado de quem recebe: guarda o último retrato e remonta o inteiro a partir da diferença.
export class SnapReader {
  constructor() {
    this.base = null;
  }

  // Passe toda mensagem recebida por aqui. Volta a mesma mensagem, ou o retrato remontado no lugar da
  // diferença, ou null se a diferença chegou sem o retrato em que ela se apoia.
  read(m) {
    if (m.e === 'snap') {
      this.base = capture(m);
      return m;
    }
    if (m.e !== 'sd') return m;
    const p = this.base;
    this.base = null;
    if (!p) return null;
    const ids = [];
    const rows = [];
    let gone = 0;
    for (let i = 0; i < p.ids.length; i++) {
      if (m.x[gone] === i) {
        gone++;
        continue;
      }
      ids.push(p.ids[i]);
      rows.push(p.rows[i]);
    }
    const c = m.c;
    for (let at = 0, idx = 0; at < c.length; ) {
      idx += c[at++];
      const mask = c[at++];
      if (!rows[idx]) return null;
      const row = rows[idx].slice();
      for (let bit = 0; bit < BITS.length; bit++) if (mask & (1 << bit)) row[BITS[bit] - 1] += c[at++];
      rows[idx] = row;
    }
    for (const r of m.n) {
      const v = toInts(r);
      if (!v) return null;
      ids.push(r[0]);
      rows.push(v);
    }
    const base = (this.base = { ids, rows, ph: m.ph ?? p.ph, k: m.k ?? p.k, pk: m.pk ?? p.pk });
    const u = new Array(ids.length);
    for (let i = 0; i < u.length; i++) {
      const r = rows[i];
      const row = new Array(COLS.length);
      row[0] = ids[i];
      for (let col = 1; col < COLS.length; col++) row[col] = r[col - 1] / SCALE[col];
      u[i] = row;
    }
    return { e: 'snap', t: m.t, ph: base.ph, pt: m.pt, gt: m.gt, k: base.k.slice(), wv: m.wv, u, pk: base.pk.slice() };
  }
}
