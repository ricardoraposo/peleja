import { BotBrain } from './bot.js';
import {
  BOT_NAMES,
  DIFFICULTY,
  HERO_ORDER,
  HEROES,
  ITEMS,
  MAP,
  MATCH,
  MINIONS,
  SLOTS,
  CRIT_MULT,
  itemPrice,
  itemStatsFor,
  RANK_MAX,
  RANK_SLOTS,
  canRankUp,
  effectiveLevel,
  skillPoints,
  SPELLS,
  SPELL_POOL,
  DEFAULT_SPELLS,
  TOWER,
  abilityOf,
  respawnTime,
  xpToNext,
} from './config.js';
import { OBSTACLES, PACKS, baseX, clampWalk, fountainX, inBase, pushDir, pushOut, segDist2, structLayout } from './geo.js';

export const KIND = { hero: 0, melee: 1, ranged: 2, siege: 3, super: 4, tower: 5, selo: 6, core: 7 };
export const KIND_NAMES = Object.keys(KIND);
export const F = { alive: 1, stun: 2, root: 4, slow: 8, air: 16, dash: 32, attack: 64, invuln: 128, move: 256, cast: 512, buff: 1024, aura: 2048, stasis: 4096, fear: 8192, big: 16384, fury: 32768, burn: 65536, charm: 131072, orbs: 262144, sleep: 524288 };
export const DMG_TYPE = { phys: 0, magic: 1, true: 2 };

const STRUCTURE = new Set(['tower', 'selo', 'core']);
const MINION = new Set(['melee', 'ranged', 'siege', 'super']);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const edgeDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;

class Unit {
  constructor(id, kind, team, x, z, r) {
    this.id = id;
    this.kind = kind;
    this.team = team;
    this.x = x;
    this.z = z;
    this.r = r;
    this.facing = team === 0 ? 0 : Math.PI;
    this.alive = true;
    this.hp = 1;
    this.stats = { maxHp: 1, atk: 0, pow: 0, armor: 0, mres: 0, as: 1, ms: 0, range: 0, haste: 0, crit: 0, regen: 0 };
    this.atkCd = 0;
    this.windup = 0;
    this.target = null;
    this.order = { type: 'idle' };
    this.stunT = 0;
    this.stasisT = 0;
    this.rootT = 0;
    this.fearT = 0;
    this.fearX = 0;
    this.fearZ = 0;
    this.burn = null;
    this.shredP = 0;
    this.shredT = 0;
    this.airT = 0;
    this.charmT = 0;
    this.sleepT = 0;
    this.drowsy = null;
    this.charmBy = null;
    this.slows = [];
    this.shields = [];
    this.buffs = [];
    this.disp = null;
    this.dash = null;
    this.castT = 0;
    this.pending = null;
    this.vx = 0;
    this.vz = 0;
    this.attackAnim = 0;
  }

  get isStructure() {
    return STRUCTURE.has(this.kind);
  }

  get isMinion() {
    return MINION.has(this.kind);
  }

  get isHero() {
    return this.kind === 'hero';
  }

  get maxHp() {
    return this.stats.maxHp;
  }

  get cc() {
    return this.stunT > 0 || this.airT > 0 || !!this.disp || this.stasisT > 0 || this.fearT > 0 || this.charmT > 0 || this.sleepT > 0;
  }

  shieldTotal() {
    let s = 0;
    for (const sh of this.shields) s += sh.amt;
    return s;
  }
}

export class Sim {
  constructor({ difficulty = 'normal', teamSize = MATCH.teamSize, teams = null, persistent = false, emit = () => {}, draftTime = MATCH.draftTime, sandbox = false, readyDelay = persistent ? 3 : 0 } = {}) {
    // treino: sem sorteio, sem tropas automáticas e com comandos de teste (só no modo local)
    this.sandbox = sandbox;
    this.dbg = { waves: false, towers: true, noCd: false };
    if (sandbox) teamSize = 1;
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.teamSize = Math.max(1, Math.min(5, teamSize));
    // `teams` = quantos heróis em cada lado, quando os times não são do mesmo tamanho (sala online sem todos os bots)
    const counts = [0, 1].map((t) => (teams && !sandbox ? Math.max(1, Math.min(5, Math.round(Number(teams[t])) || 1)) : this.teamSize));
    this.persistent = persistent;
    // todo mundo pronto: quanto falta pra começar (online dá uns segundos; contra bots é na hora)
    this.readyDelay = readyDelay;
    this.emit = emit;
    this.draftTime = draftTime;
    this.units = [];
    this.byId = new Map();
    this.brains = new Map();
    this.projectiles = [];
    this.delayed = [];
    this.zones = [];
    this.nextId = 1;
    this.projSeq = 1;
    this.zoneSeq = 1;
    this.time = 0;
    this.gameTime = 0;
    this.matchNo = 0;
    this.botNames = shuffle([...BOT_NAMES]);
    this.heroes = [];
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < counts[team]; i++) {
        const h = new Unit(this.nextId++, 'hero', team, fountainX(team), 0, 0.65);
        h.isBot = true;
        h.name = this.nextBotName();
        h.heroId = HERO_ORDER[0];
        h.spells = { ...DEFAULT_SPELLS };
        this.heroes.push(h);
      }
    }
    this.newMatch();
  }

  // ---------- jogadores ----------

  nextBotName() {
    const used = new Set((this.heroes || []).map((h) => h.name));
    return this.botNames.find((n) => !used.has(n)) || `Bot ${used.size + 1}`;
  }

  humans() {
    return this.heroes.filter((h) => !h.isBot);
  }

  roster() {
    return this.heroes.map((h) => [h.id, h.team, h.name, h.isBot ? 1 : 0, HERO_ORDER.indexOf(h.heroId), [h.spells.d, h.spells.f]]);
  }

  // `team` (0 ou 1) pede um lado; sem ele entra no time com menos gente
  addHuman(name, team = -1) {
    const clean = String(name || 'Jogador').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Jogador';
    if (this.humans().length === 0 && this.phase !== 'draft') this.newMatch();
    const count = [0, 1].map((t) => this.heroes.filter((h) => h.team === t && !h.isBot).length);
    let order = team === 0 || team === 1 ? [team, 1 - team] : count[0] === count[1] ? shuffle([0, 1]) : count[0] < count[1] ? [0, 1] : [1, 0];
    let slot = null;
    for (const t of order) {
      slot = this.heroes.find((h) => h.team === t && h.isBot);
      if (slot) break;
    }
    if (!slot) return null;
    slot.isBot = false;
    slot.name = clean;
    slot.ready = false;
    slot.spells = { ...DEFAULT_SPELLS };
    this.brains.delete(slot.id);
    this.emit({ e: 'roster', l: this.roster() });
    return slot;
  }

  removeHuman(id) {
    const h = this.byId.get(id) || this.heroes.find((x) => x.id === id);
    if (!h || h.isBot) return;
    h.isBot = true;
    h.name = this.nextBotName();
    h.ready = false;
    // os bots só sabem usar os feitiços padrão
    h.spells = { ...DEFAULT_SPELLS };
    this.brains.set(h.id, new BotBrain(h, this, this.diff));
    this.emit({ e: 'roster', l: this.roster() });
    if (this.phase === 'draft' && this.humans().length > 0 && this.humans().every((x) => x.ready)) this.phaseT = Math.min(this.phaseT, 3);
  }

  // ---------- treino ----------

  startSandbox(me) {
    const foe = this.heroes.find((h) => h !== me);
    me.home = [me.team === 0 ? -8 : 8, 0];
    this.brains.delete(foe.id);
    foe.dummy = true;
    foe.name = 'Boneco';
    foe.home = [me.team === 0 ? 2 : -2, 0];
    this.startGame();
    me.gold = 20000;
    this.emit({ e: 'roster', l: this.roster() });
  }

  addSandboxHero(team, x, z, heroId, bot) {
    if (this.heroes.length >= 12) return null;
    const h = new Unit(this.nextId++, 'hero', team, x, z, 0.65);
    h.isBot = true;
    h.dummy = !bot;
    h.name = bot ? this.nextBotName() : 'Boneco';
    h.heroId = HEROES[heroId] ? heroId : HERO_ORDER[Math.floor(Math.random() * HERO_ORDER.length)];
    h.spells = { ...DEFAULT_SPELLS };
    h.home = [clampWalk(x, z)[0], clampWalk(x, z)[1]];
    this.heroes.push(h);
    this.resetHero(h);
    this.addUnit(h);
    if (bot) this.brains.set(h.id, new BotBrain(h, this, this.diff));
    this.emit({ e: 'roster', l: this.roster() });
    return h;
  }

  spawnGroup(team, x, z) {
    ['melee', 'melee', 'melee', 'ranged', 'ranged', 'ranged'].forEach((type, i) => {
      const col = (i % 3) - 1;
      const [px, pz] = clampWalk(x - pushDir(team) * Math.floor(i / 3) * 1.4, z + col * 1.5);
      const m = new Unit(this.nextId++, type, team, px, pz, MINIONS[type].r);
      m.stats = this.minionStats(type);
      m.hp = m.stats.maxHp;
      m.laneZ = col * 1.6;
      m.retargetT = 0;
      m.helpTarget = null;
      m.helpT = 0;
      this.addUnit(m);
    });
  }

  debug(h, m) {
    const x = Number(m.x);
    const z = Number(m.z);
    const at = Number.isFinite(x) && Number.isFinite(z) ? clampWalk(x, z) : [h.x + pushDir(h.team) * 6, h.z];
    const full = (u) => {
      this.calcStats(u);
      u.hp = u.stats.maxHp;
      u.stunT = u.rootT = u.airT = u.charmT = u.sleepT = 0;
      u.drowsy = null;
      u.slows = [];
    };
    switch (m.c) {
      case 'hero': {
        const t = this.byId.get(m.id) || h;
        if (!t.isHero || !HEROES[m.v]) break;
        const keep = { level: t.level, gold: t.gold, x: t.x, z: t.z, items: t.items, fresh: t.fresh };
        t.heroId = m.v;
        this.resetHero(t);
        Object.assign(t, keep);
        full(t);
        this.emit({ e: 'roster', l: this.roster() });
        break;
      }
      case 'lvl': {
        const lv = Math.max(1, Math.min(MATCH.maxLevel, Math.round(Number(m.v)) || 1));
        for (const t of m.all ? this.heroes : [h]) {
          t.level = lv;
          t.xp = 0;
          if (skillPoints(lv, t.ranks) < 0) t.ranks = { q: 0, w: 0, e: 0, r: 0 };
          full(t);
          this.emit({ e: 'lvl', id: t.id, l: lv });
        }
        break;
      }
      case 'ranks':
        h.ranks = { q: 0, w: 0, e: 0, r: 0 };
        if (m.v) this.autoRank(h);
        break;
      case 'gold':
        h.gold += 5000;
        break;
      case 'items':
        h.items = [];
        full(h);
        break;
      case 'cd':
        for (const s of Object.keys(h.cds)) h.cds[s] = 0;
        break;
      case 'nocd':
        this.dbg.noCd = !!m.v;
        break;
      case 'god':
        h.god = !!m.v;
        break;
      case 'heal':
        if (!h.alive) this.respawn(h);
        full(h);
        break;
      case 'tp':
        if (!h.alive) break;
        h.x = at[0];
        h.z = at[1];
        h.order = { type: 'idle' };
        h.dash = null;
        break;
      case 'dummy':
        this.addSandboxHero(m.ally ? h.team : 1 - h.team, at[0], at[1], m.v, false);
        break;
      case 'bot':
        this.addSandboxHero(m.ally ? h.team : 1 - h.team, at[0], at[1], m.v, true);
        break;
      case 'minions':
        this.spawnGroup(m.ally ? h.team : 1 - h.team, at[0], at[1]);
        break;
      case 'wave':
        this.spawnWave();
        break;
      case 'waves':
        this.dbg.waves = !!m.v;
        this.waveT = 1;
        break;
      case 'towers':
        this.dbg.towers = !!m.v;
        break;
      case 'clear':
        this.heroes = this.heroes.filter((u) => u === h);
        this.units = this.units.filter((u) => u === h || u.isStructure);
        this.byId = new Map(this.units.map((u) => [u.id, u]));
        this.brains.clear();
        for (const p of this.projectiles) this.emit({ e: 'pjx', id: p.id });
        this.projectiles = [];
        this.emit({ e: 'roster', l: this.roster() });
        break;
      default:
        break;
    }
  }

  // ---------- partida ----------

  newMatch() {
    this.matchNo++;
    this.phase = 'draft';
    this.phaseT = this.draftTime;
    this.gameTime = 0;
    this.winner = -1;
    this.kills = [0, 0];
    this.firstBlood = false;
    this.waveN = 0;
    this.waveT = MATCH.firstWave;
    for (const p of this.projectiles) this.emit({ e: 'pjx', id: p.id });
    this.projectiles = [];
    this.delayed = [];
    for (const z of this.zones) this.emit({ e: 'zonex', id: z.id });
    this.zones = [];
    this.units = [];
    this.byId.clear();
    this.structs = [[], []];
    for (let team = 0; team < 2; team++) {
      const map = {};
      for (const d of structLayout(team)) {
        const s = new Unit(this.nextId++, d.kind, team, d.x, d.z, d.r);
        s.key = d.key;
        s.stats = { maxHp: d.hp, atk: 0, pow: 0, armor: TOWER.armor, mres: TOWER.mres, as: TOWER.attackSpeed, ms: 0, range: TOWER.range, haste: 0, crit: 0, regen: 0 };
        s.hp = d.hp;
        s.reqKeys = d.req;
        s.ramp = 0;
        map[d.key] = s;
        this.structs[team].push(s);
        this.addUnit(s);
      }
      for (const s of this.structs[team]) s.req = s.reqKeys.map((k) => map[k]);
      this.structs[team].core = map.core;
      this.structs[team].selo = map.selo;
    }
    this.packs = PACKS.map((p, i) => ({ i, x: p.x, z: p.z, up: true, t: 0 }));
    for (let team = 0; team < 2; team++) {
      const picks = shuffle([...HERO_ORDER]);
      const mine = this.heroes.filter((h) => h.team === team);
      mine.forEach((h, i) => {
        h.heroId = picks[i % picks.length];
        h.ready = false;
        this.resetHero(h);
      });
    }
    for (const h of this.heroes) {
      this.addUnit(h);
      if (h.isBot) this.brains.set(h.id, new BotBrain(h, this, this.diff));
    }
    this.emit({ e: 'roster', l: this.roster() });
    this.emit({ e: 'phase', ph: this.phase, m: this.matchNo });
  }

  resetHero(h) {
    h.def = HEROES[h.heroId];
    h.ranged = h.def.ranged;
    h.level = MATCH.startLevel;
    h.ranks = { q: 0, w: 0, e: 0, r: 0 };
    h.xp = 0;
    h.gold = MATCH.startGold;
    h.goldEarned = MATCH.startGold;
    h.items = [];
    h.itemCd = {};
    h.cds = { q: 0, w: 0, e: 0, r: 0, d: 0, f: 0 };
    h.cdMax = { q: 1, w: 1, e: 1, r: 1, d: 1, f: 1 };
    h.kills = h.deaths = h.assists = h.cs = h.streak = 0;
    h.dmgDealt = h.dmgTaken = h.healDone = 0;
    h.multi = 0;
    h.multiT = -99;
    h.damagers = new Map();
    h.respawnT = 0;
    h.combatT = -99;
    h.empower = null;
    h.recast = null;
    h.fury = 0;
    h.stats.maxHp = 0;
    this.respawn(h, true);
  }

  spawnPoint(h) {
    const mine = this.heroes.filter((x) => x.team === h.team);
    const i = mine.indexOf(h);
    const a = (i / Math.max(1, mine.length)) * Math.PI * 2;
    return [fountainX(h.team) + Math.cos(a) * 2.2, Math.sin(a) * 2.2];
  }

  respawn(h, silent = false) {
    const [x, z] = h.home || this.spawnPoint(h);
    h.x = x;
    h.z = z;
    h.alive = true;
    h.facing = h.team === 0 ? 0 : Math.PI;
    h.stunT = h.rootT = h.airT = h.castT = h.fearT = h.charmT = h.sleepT = 0;
    h.drowsy = null;
    h.goBack = null;
    h.orb = null;
    h.bolts = null;
    h.charge = null;
    this.endStasis(h);
    this.clearHeroState(h);
    h.slows = [];
    h.shields = [];
    h.buffs = [];
    h.disp = null;
    h.dash = null;
    h.pending = null;
    h.windup = 0;
    h.atkCd = 0;
    h.target = null;
    h.order = { type: 'idle' };
    h.damagers = new Map();
    this.calcStats(h);
    h.hp = h.stats.maxHp;
    this.brains.get(h.id)?.reset();
    if (!silent) this.emit({ e: 'spawn', id: h.id });
  }

  startGame() {
    this.phase = 'playing';
    this.phaseT = 0;
    this.gameTime = 0;
    for (const h of this.heroes) this.respawn(h, true);
    this.emit({ e: 'phase', ph: this.phase, m: this.matchNo });
    this.ann('A peleja começou!', 'Tropas em ' + MATCH.firstWave + ' segundos', 'start');
  }

  endMatch(winner) {
    if (this.phase !== 'playing') return;
    if (this.sandbox) {
      this.ann('Núcleo destruído', 'No treino a partida não acaba. Use Reiniciar pra montar tudo de novo.', 'info');
      return;
    }
    this.phase = 'ended';
    this.winner = winner;
    this.phaseT = MATCH.endDelay;
    for (const p of this.projectiles) this.emit({ e: 'pjx', id: p.id });
    this.projectiles = [];
    this.emit(this.board());
    this.emit({ e: 'end', w: winner, next: this.persistent ? MATCH.endDelay : 0, t: Math.round(this.gameTime), k: this.kills });
  }

  // Escolha de herói. Não repete dentro do time: o de um aliado humano fica travado;
  // o que está com um bot pode ser tomado, e o bot fica com o herói que você largou.
  pick(h, heroId) {
    if (this.phase !== 'draft' || h.ready || !HEROES[heroId] || h.heroId === heroId) return;
    const holder = this.heroes.find((x) => x !== h && x.team === h.team && x.heroId === heroId);
    if (holder && !holder.isBot) return;
    if (holder) {
      holder.heroId = h.heroId;
      this.resetHero(holder);
    }
    h.heroId = heroId;
    this.resetHero(h);
    this.emit({ e: 'roster', l: this.roster() });
  }

  // Troca o feitiço do D ou do F. Não dá pra repetir: escolher o que está na outra tecla inverte os dois.
  setSpell(h, slot, id) {
    if ((this.phase !== 'draft' && !this.sandbox) || (slot !== 'd' && slot !== 'f') || !SPELL_POOL[id] || h.spells[slot] === id) return;
    const other = slot === 'd' ? 'f' : 'd';
    if (h.spells[other] === id) {
      h.spells[other] = h.spells[slot];
      [h.cds[other], h.cds[slot]] = [h.cds[slot], h.cds[other]];
      [h.cdMax[other], h.cdMax[slot]] = [h.cdMax[slot], h.cdMax[other]];
    }
    h.spells[slot] = id;
    this.emit({ e: 'roster', l: this.roster() });
  }

  pickRandom(h) {
    const free = HERO_ORDER.filter((id) => id !== h.heroId && !this.heroes.some((x) => x !== h && x.team === h.team && !x.isBot && x.heroId === id));
    if (free.length) this.pick(h, free[Math.floor(Math.random() * free.length)]);
  }

  ready(h) {
    if (this.phase !== 'draft') return;
    h.ready = true;
    if (this.humans().every((x) => x.ready)) this.phaseT = Math.min(this.phaseT, this.readyDelay);
  }

  ann(text, sub = '', kind = 'info', team = -1) {
    this.emit({ e: 'ann', t: text, s: sub, k: kind, tm: team });
  }

  // ---------- unidades ----------

  addUnit(u) {
    this.units.push(u);
    this.byId.set(u.id, u);
  }

  clearHeroState(h) {
    h.fury = 0;
    h.empower = null;
    h.recast = null;
    h.burn = null;
    h.shredT = 0;
    h.shredP = 0;
  }

  addFury(h, n) {
    const fu = h.def?.fury;
    if (!fu || !h.alive || n <= 0) return;
    h.fury = Math.min(fu.max, (h.fury || 0) + n);
  }

  spendFury(h, slot) {
    const fu = h.def?.fury;
    if (!fu || (h.fury || 0) < fu.cost) return false;
    h.fury -= fu.cost;
    this.emit({ e: 'emp', id: h.id, s: slot });
    return true;
  }

  calcStats(h) {
    const d = h.def.stats;
    const L = h.level - 1;
    const s = {
      maxHp: d.hp + d.hpL * L,
      atk: d.atk + d.atkL * L,
      pow: 0,
      armor: d.armor + d.armorL * L,
      mres: d.mres + d.mresL * L,
      as: d.as * (1 + d.asL * L),
      ms: d.ms,
      range: d.range,
      haste: 0,
      crit: 0,
      regen: d.regen + d.regenL * L,
    };
    let asBonus = 0;
    for (const id of h.items) {
      const it = itemStatsFor(h.heroId, id);
      if (it.hp) s.maxHp += it.hp;
      if (it.atk) s.atk += it.atk;
      if (it.pow) s.pow += it.pow;
      if (it.armor) s.armor += it.armor;
      if (it.mres) s.mres += it.mres;
      if (it.as) asBonus += it.as;
      if (it.ms) s.ms += it.ms;
      if (it.haste) s.haste += it.haste;
      if (it.crit) s.crit += it.crit;
    }
    s.crit = Math.min(1, s.crit);
    let msBonus = 0;
    for (const b of h.buffs) {
      if (b.ms) msBonus += b.ms;
      if (b.as) asBonus += b.as;
      if (b.armor) s.armor += b.armor;
      if (b.mres) s.mres += b.mres;
      if (b.atk) s.atk += b.atk;
      if (b.pow) s.pow += b.pow;
      if (typeof b.hp === 'number') s.maxHp += b.hp;
      if (b.range) s.range += b.range;
    }
    if (h.empower) s.range += h.empower.range || 0;
    s.as = Math.min(2.5, s.as * (1 + asBonus));
    let slow = 0;
    for (const sl of h.slows) slow = Math.max(slow, sl.p);
    s.ms = Math.max(1.5, s.ms * (1 + msBonus) * (1 - slow));
    const prev = h.stats.maxHp;
    h.stats = s;
    if (h.alive && prev > 0 && s.maxHp > prev) h.hp += s.maxHp - prev;
    if (h.hp > s.maxHp) h.hp = s.maxHp;
  }

  minionStats(type) {
    const d = MINIONS[type];
    const min = this.gameTime / 60;
    return {
      maxHp: d.hp * (1 + MINIONS.growHp * min),
      atk: d.atk * (1 + MINIONS.growAtk * min),
      pow: 0,
      armor: d.armor,
      mres: d.mres,
      as: d.as,
      ms: d.ms,
      range: d.range,
      haste: 0,
      crit: 0,
      regen: 0,
    };
  }

  spawnWave() {
    this.waveN++;
    for (let team = 0; team < 2; team++) {
      const enemySeloDown = !this.structs[1 - team].selo.alive;
      const types = ['melee', 'melee', 'melee', 'ranged', 'ranged', 'ranged'];
      if (this.waveN % 3 === 0) types.splice(3, 0, 'siege');
      if (enemySeloDown) types.unshift('super');
      const dir = pushDir(team);
      const x0 = baseX(team) + dir * 9;
      types.forEach((type, i) => {
        const d = MINIONS[type];
        const row = Math.floor(i / 3);
        const col = i % 3;
        const m = new Unit(this.nextId++, type, team, x0 - dir * row * 1.4, (col - 1) * 1.5, d.r);
        m.stats = this.minionStats(type);
        m.hp = m.stats.maxHp;
        m.laneZ = (col - 1) * 1.6;
        m.retargetT = 0;
        m.helpTarget = null;
        m.helpT = 0;
        this.addUnit(m);
      });
    }
    if (this.waveN === 1) this.ann('As tropas chegaram!', '', 'wave');
  }

  // ---------- ordens (jogadores e bots usam as mesmas) ----------

  canAct(h) {
    return this.phase === 'playing' && h.alive;
  }

  orderMove(h, x, z) {
    if (!this.canAct(h) || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const [cx, cz] = clampWalk(x, z, h.r);
    if (h.order.type !== 'move') h.windup = 0;
    h.order = { type: 'move', x: cx, z: cz };
    h.target = null;
  }

  orderAttack(h, t) {
    if (!this.canAct(h) || !this.attackable(h, t)) return;
    if (h.target !== t) h.windup = 0;
    h.order = { type: 'attack', target: t };
    h.target = t;
  }

  orderAmove(h, x, z, heroesOnly = false) {
    if (!this.canAct(h) || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const [cx, cz] = clampWalk(x, z, h.r);
    h.order = { type: 'amove', x: cx, z: cz, heroes: !!heroesOnly };
    h.target = null;
    h.windup = 0;
  }

  orderStop(h) {
    if (!this.canAct(h)) return;
    h.order = { type: 'idle' };
    h.target = null;
    h.windup = 0;
  }

  attackable(by, t) {
    return !!t && t.alive && t.team !== by.team && !t.invuln && this.byId.get(t.id) === t;
  }

  abilityTargetable(by, t, ab) {
    if (!t || !t.alive || t.team === by.team || t.isStructure || this.byId.get(t.id) !== t) return false;
    if (ab.heroesOnly && !t.isHero) return false;
    return true;
  }

  cast(h, slot, x, z, targetId) {
    if (!this.canAct(h) || !SLOTS.includes(slot)) return false;
    const ab = abilityOf(h.heroId, slot, h.spells);
    if (!ab || h.cds[slot] > 0) return false;
    if (RANK_MAX[slot] && !(h.ranks?.[slot] > 0)) return false;
    if (h.cc || h.castT > 0 || h.dash) return false;
    if ((ab.kind === 'dash' || ab.kind === 'blink') && h.rootT > 0) return false;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      x = h.x + Math.cos(h.facing);
      z = h.z + Math.sin(h.facing);
    }
    if (ab.kind === 'target') {
      let t = this.byId.get(targetId);
      if (!this.abilityTargetable(h, t, ab)) {
        t = null;
        let best = 3;
        for (const u of this.units) {
          if (!this.abilityTargetable(h, u, ab)) continue;
          const d = Math.hypot(u.x - x, u.z - z) - (u.isHero ? 0.6 : 0);
          if (d < best) {
            best = d;
            t = u;
          }
        }
      }
      if (!t) return false;
      if (edgeDist(h, t) > ab.range) {
        h.order = { type: 'cast', slot, target: t, prev: h.order };
        return true;
      }
      this.beginCast(h, slot, ab, t.x, t.z, t);
      return true;
    }
    this.beginCast(h, slot, ab, x, z, null);
    return true;
  }

  cooldownOf(h, slot, ab) {
    if (slot === 'd' || slot === 'f') return ab.cd;
    // cada nível da habilidade além do primeiro encurta a recarga (4%; no R, 10%)
    const rank = Math.max(1, h.ranks?.[slot] || 1);
    return ab.cd * (100 / (100 + h.stats.haste)) * (1 - (slot === 'r' ? 0.1 : 0.04) * (rank - 1));
  }

  beginCast(h, slot, ab, x, z, t) {
    if (h.recast && h.recast.slot === slot) {
      h.cds[slot] = Math.max(0, h.recast.cd);
      h.recast = null;
      h.recasting = true;
    } else {
      const cd = this.cooldownOf(h, slot, ab);
      h.cds[slot] = cd;
      h.cdMax[slot] = cd;
      if (ab.charges) {
        // habilidade de várias cargas: entre uma e outra só um intervalo curto; a recarga cheia vem no fim
        if (h.charge?.slot !== slot) h.charge = { slot, left: ab.charges.n, t: ab.charges.t, cd };
        h.charge.left--;
        if (h.charge.left > 0) h.cds[slot] = h.cdMax[slot] = ab.charges.gap;
        else h.charge = null;
      }
    }
    h.windup = 0;
    if (Math.hypot(x - h.x, z - h.z) > 0.05) h.facing = Math.atan2(z - h.z, x - h.x);
    if (h.order.type === 'cast') h.order = h.order.prev && h.order.prev.type !== 'cast' ? h.order.prev : { type: 'idle' };
    this.emit({ e: 'cast', id: h.id, s: slot, x: r1(x), z: r1(z), ct: ab.cast || 0 });
    if (ab.cast > 0) {
      h.castT = ab.cast;
      h.pending = { slot, ab, x, z, t };
    } else this.execute(h, slot, ab, x, z, t);
  }

  // acabou o prazo das cargas (ou o herói caiu): começa a recarga cheia
  endCharges(h) {
    const c = h.charge;
    h.charge = null;
    if (!c) return;
    h.cds[c.slot] = c.cd;
    h.cdMax[c.slot] = c.cd;
  }

  // Projéteis teleguiados de habilidade: um por inimigo próximo, heróis primeiro.
  // Se sobrar projétil, ele repete num alvo já escolhido com dano reduzido (bolts.repeat).
queueBolts(h, ab, slot, color) {
    (h.bolts ||= []).push({ ab, slot, color, left: ab.bolts.n, wait: ab.bolts.wait || 0, gapT: 0, hit: new Set() });
    this.tickBolts(h, 0);
  }

  // solta um projétil por vez; sem ninguém ao alcance, espera um pouco (wait) antes de perder os que restam
  tickBolts(h, dt) {
    for (const q of h.bolts) {
      if (q.gapT > 0) {
        q.gapT -= dt;
        continue;
      }
      if (this.fireBolt(h, q)) {
        q.left--;
        q.gapT = q.ab.bolts.gap ?? 0.18;
      } else if ((q.wait -= dt) <= 0) q.left = 0;
    }
    h.bolts = h.bolts.filter((q) => q.left > 0);
    if (!h.bolts.length) h.bolts = null;
  }

  // cada projétil procura primeiro quem ainda não levou (herói antes de tropa); repetir no mesmo alvo fere menos
  fireBolt(h, q) {
    const b = q.ab.bolts;
    let best = null;
    let bestS = Infinity;
    for (const u of this.units) {
      if (!this.abilityTargetable(h, u, q.ab)) continue;
      const d = edgeDist(h, u);
      if (d > b.range) continue;
      const score = d - (u.isHero ? 100 : 0) + (q.hit.has(u.id) ? 1000 : 0);
      if (score < bestS) {
        bestS = score;
        best = u;
      }
    }
    if (!best) return false;
    const again = q.hit.has(best.id);
    q.hit.add(best.id);
    this.spawnProj({
      owner: h,
      team: h.team,
      x: h.x,
      z: h.z,
      homing: best,
      skill: true,
      speed: b.speed,
      dmg: this.val(h, b.dmg, q.ab) * (again ? (b.repeat ?? 1) : 1),
      type: b.dmg.type || 'magic',
      color: q.color,
      slot: q.slot,
      kind: 's',
      size: 0.3,
      width: 0.7,
    });
    return true;
  }

  // último feitiço que um herói inimigo lançou, se ainda estiver dentro do prazo de quem copia
  stolenFor(h, ab) {
    const st = this.lastSpell?.[1 - h.team];
    return st && SPELL_POOL[st.id] && this.time - st.t <= ab.steal.window ? st : null;
  }

  // lança de graça o feitiço copiado; os que precisam de alvo pegam o herói inimigo mais perto do mouse
  castStolen(h, ab, slot, x, z) {
    const st = this.stolenFor(h, ab);
    if (!st) return;
    const sp = SPELL_POOL[st.id];
    let tg = null;
    if (sp.kind === 'target') {
      let best = Infinity;
      for (const u of this.units) {
        if (!this.abilityTargetable(h, u, sp) || edgeDist(h, u) > sp.range) continue;
        const d = Math.hypot(u.x - x, u.z - z);
        if (d < best) {
          best = d;
          tg = u;
        }
      }
      if (!tg) return;
    }
    this.lastSpell[1 - h.team] = null;
    this.execute(h, slot, { ...sp, cast: 0 }, tg ? tg.x : x, tg ? tg.z : z, tg);
  }

  // dano de um projétil que fica mais forte quanto mais longe voa (grow)
  projDmg(p, u) {
    if (!p.grow) return p.dmg;
    const far = (p.grown || 0) + Math.hypot(u.x - p.x0, u.z - p.z0);
    return p.dmg * (1 + Math.min(p.grow.max, p.grow.per * far));
  }

  // encantado: anda devagar até quem encantou, sem poder fazer mais nada
  charmWalk(u) {
    const src = u.charmBy;
    if (!src || !src.alive || this.byId.get(src.id) !== src) {
      u.charmT = 0;
      return;
    }
    u.windup = 0;
    const dx = src.x - u.x;
    const dz = src.z - u.z;
    const d = Math.hypot(dx, dz);
    if (d < u.r + src.r + 0.2 || u.rootT > 0) return;
    const sp = (u.isHero ? u.stats.ms : u.stats.ms * (u.slowMult ?? 1)) * 0.45;
    u.vx = (dx / d) * sp;
    u.vz = (dz / d) * sp;
    u.facing = Math.atan2(dz, dx);
  }

  slotOf(h, ab) {
    return h.def ? RANK_SLOTS.find((s) => h.def.abilities[s] === ab) || null : null;
  }

  val(u, v, ab = null) {
    if (!v) return 0;
    const s = u.stats;
    const slot = ab && u.isHero ? this.slotOf(u, ab) : null;
    const lvl = slot ? effectiveLevel(u.level || 1, slot, u.ranks?.[slot] || 1) : u.level || 1;
    return (v.b || 0) + (v.l || 0) * (lvl - 1) + (v.ad || 0) * s.atk + (v.ap || 0) * s.pow + (v.hp || 0) * s.maxHp;
  }

  execute(h, slot, ab, x, z, t) {
    let dx = x - h.x;
    let dz = z - h.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.05) {
      dx = Math.cos(h.facing);
      dz = Math.sin(h.facing);
      d = 0;
    } else {
      dx /= d;
      dz /= d;
    }
    const color = ab.color || h.def?.color || '#ffffff';
    // feitiço (D ou F) lançado por um herói: fica anotado pra quem sabe copiar (ver steal)
    if ((slot === 'd' || slot === 'f') && h.isHero && SPELL_POOL[h.spells?.[slot]] === ab) (this.lastSpell ||= [null, null])[h.team] = { id: h.spells[slot], t: this.time };
    let px = h.x + dx * 0.6;
    let pz = h.z + dz * 0.6;
    let grown = 0;
    let second = false;
    let leg = 0;
    if (ab.kind === 'proj' && ab.hover) {
      // segundo lançamento: o projétil que estava parado no ar sai de onde está pra onde o mouse aponta
      const o = h.recasting ? h.orb : null;
      h.recasting = false;
      h.orb = null;
      if (o && this.projectiles.includes(o)) {
        this.projectiles = this.projectiles.filter((q) => q !== o);
        this.emit({ e: 'pjx', id: o.id, x: r1(o.x), z: r1(o.z) });
        second = true;
        grown = o.traveled;
        px = o.x;
        pz = o.z;
        // o destino é onde o mouse aponta, limitado ao alcance medido de onde o herói está agora
        const hd = Math.hypot(x - h.x, z - h.z);
        const k = hd > ab.hover.reach ? ab.hover.reach / hd : 1;
        const tx = h.x + (x - h.x) * k;
        const tz = h.z + (z - h.z) * k;
        const ld = Math.hypot(tx - px, tz - pz);
        if (ld > 0.05) {
          dx = (tx - px) / ld;
          dz = (tz - pz) / ld;
        }
        leg = Math.max(1, ld);
      }
    }
    switch (ab.kind) {
      case 'proj':
        this.spawnProj({
          owner: h,
          team: h.team,
          x: px,
          z: pz,
          dx,
          dz,
          speed: second ? ab.hover.speed || ab.speed : ab.speed,
          range: second ? leg : ab.range,
          hover: second ? 0 : ab.hover?.t || 0,
          grow: ab.grow || null,
          grown,
          trap: ab.trap || null,
          width: ab.width,
          dmg: this.val(h, ab.dmg, ab),
          type: ab.dmg?.type || 'magic',
          fx: ab.fx,
          pierce: !!ab.pierce,
          heroesOnly: !!ab.heroesOnly,
          explode: ab.explode || 0,
          back: ab.back || null,
          backDmg: ab.back ? this.val(h, ab.back.dmg || ab.dmg, ab) : 0,
          color,
          slot,
          kind: 's',
          size: ab.width,
        });
        break;
      case 'aoe': {
        const k = Math.min(ab.range, d);
        const lg = ab.linger ? { ...ab.linger, dmg: this.val(h, ab.linger.dmg, ab), type: ab.linger.dmg.type } : null;
        this.addDelayed(h, h.x + dx * k, h.z + dz * k, ab.radius, ab.delay, this.val(h, ab.dmg, ab), ab.dmg?.type, ab.fx, color, null, lg);
        break;
      }
      case 'nova':
        if (ab.drain) this.drainNova(h, slot, ab, color);
        else if (ab.delay > 0) this.addDelayed(h, h.x, h.z, ab.radius, ab.delay, this.val(h, ab.dmg, ab), ab.dmg?.type, ab.fx, color, h);
        else this.hitArea(h, h.x, h.z, ab.radius, this.val(h, ab.dmg, ab), ab.dmg?.type, ab.fx, color);
        break;
      case 'cone': {
        const dmg = this.val(h, ab.dmg, ab);
        const half = ((ab.angle || 60) * Math.PI) / 360;
        for (const u of this.units) {
          if (!this.abilityTargetable(h, u, ab)) continue;
          const ux = u.x - h.x;
          const uz = u.z - h.z;
          const ud = Math.hypot(ux, uz);
          if (ud - u.r > ab.range) continue;
          if (ud > 0.5 && Math.acos(Math.max(-1, Math.min(1, (ux * dx + uz * dz) / ud))) > half + Math.atan2(u.r, ud)) continue;
          this.damage(u, h, dmg, ab.dmg.type);
          this.applyFx(u, ab.fx, h);
        }
        this.emit({ e: 'cone', id: h.id, x: r1(h.x), z: r1(h.z), a: r2(Math.atan2(dz, dx)), r: ab.range, w: ab.angle, c: color });
        break;
      }
      case 'dash': {
        const k = Math.min(ab.range, Math.max(d, 1.5));
        const [tx, tz] = clampWalk(h.x + dx * k, h.z + dz * k, h.r);
        const second = !!h.recasting;
        h.recasting = false;
        const emp = second && !!ab.recast?.emp && this.spendFury(h, slot);
        this.startDash(h, ab, tx, tz, null, emp ? '#ef4444' : color, { slot, second, emp });
        break;
      }
      case 'blink': {
        const k = Math.min(ab.range, d);
        let [tx, tz] = clampWalk(h.x + dx * k, h.z + dz * k, h.r);
        const fx0 = h.x;
        const fz0 = h.z;
        h.x = tx;
        h.z = tz;
        this.resolveStatic(h);
        this.emit({ e: 'blink', id: h.id, a: [r1(fx0), r1(fz0)], b: [r1(h.x), r1(h.z)], c: color, fl: ab.flash ? 1 : 0 });
        if (ab.bolts) this.queueBolts(h, ab, slot, color);
        // pulo de ida e volta: depois de um instante o herói reaparece de onde saiu
        if (ab.ret) {
          h.goBack = { x: fx0, z: fz0, t: ab.ret, c: color };
          this.emit({ e: 'mark', id: h.id, x: r1(fx0), z: r1(fz0), t: ab.ret, c: color });
        }
        if (ab.origin) this.addDelayed(h, fx0, fz0, ab.origin.radius, ab.origin.delay, this.val(h, ab.origin.dmg, ab), ab.origin.dmg.type, ab.origin.fx, color);
        break;
      }
      case 'target':
        if (!this.abilityTargetable(h, t, ab)) break;
        if (ab.dashTo) this.startDash(h, ab, t.x, t.z, t, color);
        else this.targetHit(h, ab, t);
        break;
      case 'self':
        if (ab.nextHit) {
          const nh = ab.nextHit;
          const emp = !!nh.emp && this.spendFury(h, slot);
          h.empower = { ab, t: nh.t, range: nh.range || 0, emp, hits: emp ? nh.emp.hits : nh.hits, stun: emp ? nh.emp.stun : nh.stun };
          h.atkCd = 0;
          h.windup = 0;
          this.calcStats(h);
        }
        this.applySelf(h, h, ab);
        if (ab.furyGain) this.addFury(h, ab.furyGain);
        if (ab.steal) this.castStolen(h, ab, slot, x, z);
        // os projéteis esperam um pouco por alguém ao alcance antes de se perderem
        if (ab.bolts) this.queueBolts(h, ab, slot, color);
        this.emit({ e: 'buff', id: h.id, s: slot, c: color });
        if (ab.burst) this.hitArea(h, h.x, h.z, ab.burst.radius, this.val(h, ab.burst.dmg, ab), ab.burst.dmg.type, ab.burst.fx, color);
        break;
      case 'ally': {
        let cx = h.x;
        let cz = h.z;
        if (ab.range > 0) {
          const k = Math.min(ab.range, d);
          cx = h.x + dx * k;
          cz = h.z + dz * k;
        }
        for (const a of this.heroes) {
          if (!a.alive || a.team !== h.team) continue;
          if (Math.hypot(a.x - cx, a.z - cz) > ab.radius + a.r) continue;
          this.applySelf(a, h, ab);
        }
        this.emit({ e: 'boom', x: r1(cx), z: r1(cz), r: ab.radius, c: color, al: 1, o: h.id });
        break;
      }
      case 'zone': {
        const k = Math.min(ab.range, d);
        const cx = h.x + dx * k;
        const cz = h.z + dz * k;
        let line = null;
        if (ab.line) {
          const half = ab.line / 2;
          const [ax, az] = clampWalk(cx + dz * half, cz - dx * half);
          const [bx, bz] = clampWalk(cx - dz * half, cz + dx * half);
          line = [r1(ax), r1(az), r1(bx), r1(bz)];
        }
        this.spawnZone(h, cx, cz, { r: ab.radius, dur: ab.dur, tick: ab.tick, dmg: this.val(h, ab.dmg, ab), type: ab.dmg.type, fx: ab.fx, line }, color);
        break;
      }
      default:
        break;
    }
  }

  applySelf(target, src, ab) {
    if (ab.heal) this.heal(target, this.val(src, ab.heal, ab), src);
    if (ab.shield) {
      target.shields.push({ amt: this.val(src, ab.shield, ab), t: ab.shield.t || 3 });
    }
    if (ab.buff) {
      const b = { ...ab.buff, t: ab.buff.t, src };
      if (b.aura) b.auraT = 0;
      if (b.hp && typeof b.hp === 'object') b.hp = this.val(src, b.hp, ab);
      target.buffs.push(b);
      this.calcStats(target);
    }
  }

  targetHit(h, ab, t) {
    let dmg = this.val(h, ab.dmg, ab);
    if (ab.exec) dmg *= 1 + ab.exec * (1 - t.hp / t.maxHp);
    this.damage(t, h, dmg, ab.dmg.type);
    this.applyFx(t, ab.fx, h);
    this.emit({ e: 'boom', x: r1(t.x), z: r1(t.z), r: 1.2, c: ab.color || h.def.color, o: h.id });
  }

  startDash(h, ab, tx, tz, tgt, color, opts = {}) {
    const d = Math.hypot(tx - h.x, tz - h.z);
    h.dash = { ab, tx, tz, tgt, speed: ab.speed || 26, hit: new Set(), left: d / (ab.speed || 26) + 0.4, color, ...opts, gained: 0 };
    h.windup = 0;
    this.emit({ e: 'dash', id: h.id, d: r2(d / (ab.speed || 26)), a: ab.arc ? 1 : 0, c: color });
  }

  updateDash(h, dt) {
    const ds = h.dash;
    ds.left -= dt;
    if (ds.tgt) {
      if (!ds.tgt.alive || this.byId.get(ds.tgt.id) !== ds.tgt) {
        h.dash = null;
        return;
      }
      ds.tx = ds.tgt.x;
      ds.tz = ds.tgt.z;
    }
    const dx = ds.tx - h.x;
    const dz = ds.tz - h.z;
    const d = Math.hypot(dx, dz);
    const stop = ds.tgt ? h.r + ds.tgt.r + 0.3 : 0.05;
    const step = ds.speed * dt;
    const ox = h.x;
    const oz = h.z;
    if (d > 0.01) h.facing = Math.atan2(dz, dx);
    let arrived = false;
    if (d - stop <= step) {
      if (d > stop) {
        h.x += (dx / d) * (d - stop);
        h.z += (dz / d) * (d - stop);
      }
      arrived = true;
    } else {
      h.x += (dx / d) * step;
      h.z += (dz / d) * step;
    }
    this.resolveStatic(h);
    const ab = ds.ab;
    if (ab.path) {
      const emp = ds.emp ? ab.recast.emp : null;
      const dmg = this.val(h, ab.path.dmg, ab) * (emp?.dmg || 1);
      for (const u of this.units) {
        if (ds.hit.has(u.id) || !this.abilityTargetable(h, u, ab)) continue;
        const [d2] = segDist2(u.x, u.z, ox, oz, h.x, h.z);
        const w = ab.path.width / 2 + u.r;
        if (d2 > w * w) continue;
        ds.hit.add(u.id);
        if (emp?.shred) {
          u.shredP = Math.max(u.shredP, emp.shred[0]);
          u.shredT = Math.max(u.shredT, emp.shred[1]);
        }
        this.damage(u, h, dmg, ab.path.dmg.type);
        this.applyFx(u, ab.path.fx, h);
        if (ab.fury && !ds.emp && ds.gained < ab.fury[2]) {
          const g = Math.min(ab.fury[2] - ds.gained, u.isHero ? ab.fury[1] : ab.fury[0]);
          ds.gained += g;
          this.addFury(h, g);
        }
      }
    }
    if (arrived || ds.left <= 0) {
      h.dash = null;
      if (ab.recast && !ds.second && ds.hit.size > 0 && ds.slot) {
        h.recast = { slot: ds.slot, t: ab.recast.t, cd: h.cds[ds.slot] };
        h.cds[ds.slot] = 0;
      }
      if (ds.tgt) this.targetHit(h, ab, ds.tgt);
      if (ab.end) this.hitArea(h, h.x, h.z, ab.end.radius, this.val(h, ab.end.dmg, ab), ab.end.dmg.type, ab.end.fx, ds.color);
      if (ab.buff) this.applySelf(h, h, { buff: ab.buff });
      if (ab.bolts) this.queueBolts(h, ab, this.slotOf(h, ab), ds.color);
      if (ds.tgt && this.attackable(h, ds.tgt) && h.order.type === 'idle') this.orderAttack(h, ds.tgt);
    }
  }

  addDelayed(h, x, z, r, delay, dmg, type, fx, color, follow = null, linger = null) {
    this.delayed.push({ owner: h, team: h.team, x, z, r, t: delay, dmg, type: type || 'magic', fx, color, linger });
    this.emit({ e: 'aoe', x: r1(x), z: r1(z), r, t: delay, c: color, tm: h.team, o: h.id });
  }

  hitArea(h, x, z, r, dmg, type, fx, color) {
    for (const u of this.units) {
      if (!u.alive || u.team === h.team || u.isStructure) continue;
      if (Math.hypot(u.x - x, u.z - z) > r + u.r) continue;
      this.damage(u, h, dmg, type || 'magic');
      this.applyFx(u, fx, h, x, z);
    }
    this.emit({ e: 'boom', x: r1(x), z: r1(z), r, c: color, o: h.id });
  }

  applyFx(t, fx, src, ox, oz) {
    if (!fx || !t.alive || t.isStructure || t.stasisT > 0) return;
    if (fx.slow) t.slows.push({ p: fx.slow[0], t: fx.slow[1] });
    if (fx.stun) t.stunT = Math.max(t.stunT, fx.stun);
    if (fx.root) t.rootT = Math.max(t.rootT, fx.root);
    if (fx.fear) {
      t.fearT = Math.max(t.fearT, fx.fear);
      t.fearX = ox ?? src?.x ?? t.x;
      t.fearZ = oz ?? src?.z ?? t.z;
    }
    if (fx.burn && src?.def?.burn) {
      const bd = src.def.burn;
      const dmg = this.val(src, bd);
      if (!t.burn || t.burn.dmg <= dmg || t.burn.t < fx.burn) t.burn = { src, dmg, type: bd.type || 'magic', t: fx.burn, tick: bd.tick, tickT: bd.tick };
    }
    if (fx.drowsy && !(t.sleepT > 0)) {
      // sono: primeiro fica lento, depois dorme; o golpe que acordar dói a mais (wake)
      t.drowsy = { t: fx.drowsy[0], sleep: fx.drowsy[1], bonus: fx.wake && src ? this.val(src, fx.wake) : 0, src };
      t.slows.push({ p: 0.3, t: fx.drowsy[0] });
    }
    if (fx.charm && src && src !== t) {
      t.charmT = Math.max(t.charmT, fx.charm);
      t.charmBy = src;
    }
    if (fx.knockup) {
      t.airT = Math.max(t.airT, fx.knockup);
      t.airMax = t.airT;
    }
    if (fx.knockback && src) {
      let dx = t.x - (ox ?? src.x);
      let dz = t.z - (oz ?? src.z);
      if (src.lastProjDir) [dx, dz] = src.lastProjDir;
      const d = Math.hypot(dx, dz) || 1;
      const T = 0.25;
      t.disp = { vx: ((dx / d) * fx.knockback) / T, vz: ((dz / d) * fx.knockback) / T, t: T };
    }
    if (fx.stun || fx.knockup || fx.knockback || fx.fear || fx.charm) {
      t.windup = 0;
      if (t.castT > 0) {
        t.castT = 0;
        t.pending = null;
        this.emit({ e: 'cancel', id: t.id });
      }
    }
    if (t.isHero) this.calcStats(t);
  }

  // ---------- dano ----------

  minionsNear(s, team, range) {
    for (const u of this.units) {
      if (u.alive && u.team === team && u.isMinion && dist(u, s) <= range) return true;
    }
    return false;
  }

  damage(t, src, amount, type = 'phys', opts = {}) {
    if (!t.alive || amount <= 0 || this.phase !== 'playing' || t.god || t.stasisT > 0) return 0;
    if (t.sleepT > 0) {
      // acordou com o golpe: leva o mesmo tanto de novo (até o teto) como dano verdadeiro
      t.sleepT = 0;
      const bonus = Math.min(amount, t.sleepBonus || 0);
      t.sleepBonus = 0;
      if (bonus > 0) this.damage(t, t.sleepBy?.alive ? t.sleepBy : src, bonus, 'true', { extra: true });
      if (!t.alive) return 0;
    }
    if (t.isStructure) {
      if (t.invuln) return 0;
      if (src && src.isHero && !this.minionsNear(t, src.team, TOWER.backdoorRange)) amount *= TOWER.backdoorMult;
    }
    let res = type === 'phys' ? t.stats.armor : type === 'magic' ? t.stats.mres : 0;
    if (type === 'phys' && t.shredT > 0) res *= 1 - t.shredP;
    amount *= 100 / (100 + Math.max(0, res));
    let left = amount;
    for (const sh of t.shields) {
      const a = Math.min(sh.amt, left);
      sh.amt -= a;
      left -= a;
      if (left <= 0) break;
    }
    t.shields = t.shields.filter((s) => s.amt > 0.5);
    t.hp -= left;
    if (src?.isHero && (t.isHero || t.isStructure)) src.dmgDealt += amount;
    if (t.isHero) {
      t.dmgTaken += amount;
      t.combatT = this.time;
      if (src?.isHero) t.damagers.set(src.id, this.time);
    }
    if (src?.isHero) src.combatT = this.time;
    if (src?.isHero || t.isHero || t.isStructure) {
      this.emit({ e: 'hit', v: t.id, a: src?.id || 0, d: Math.round(amount), k: DMG_TYPE[type] ?? 0, au: opts.auto ? 1 : 0, cr: opts.crit ? 1 : 0 });
    }
    if (src?.isHero && t.isHero) this.callForHelp(src, t);
    if (t.hp <= 0) this.kill(t, src);
    return amount;
  }

  heal(t, amt, src, silent = false) {
    if (!t.alive || amt <= 0) return;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amt);
    const d = t.hp - before;
    if (src?.isHero && src !== t) src.healDone += d;
    if (!silent && d >= 1) this.emit({ e: 'heal', v: t.id, d: Math.round(d) });
  }

  callForHelp(attacker, victim) {
    for (const s of this.structs[victim.team]) {
      if (s.kind !== 'tower' || !s.alive) continue;
      if (dist(s, attacker) > TOWER.range + attacker.r || dist(s, victim) > TOWER.range + 4) continue;
      s.forced = attacker;
      s.forcedT = this.time + 2.5;
    }
    for (const m of this.units) {
      if (!m.alive || !m.isMinion || m.team !== victim.team) continue;
      if (dist(m, attacker) > MINIONS.aggro) continue;
      m.helpTarget = attacker;
      m.helpT = this.time + 2;
    }
  }

  giveGold(h, amt, popupAt = null) {
    h.gold += amt;
    h.goldEarned += amt;
    if (popupAt && !h.isBot) this.emit({ e: 'gold', d: Math.round(amt), x: r1(popupAt.x), z: r1(popupAt.z) }, { to: h.id });
  }

  giveXp(h, amt) {
    if (this.sandbox || h.level >= MATCH.maxLevel) return;
    h.xp += amt;
    let up = false;
    while (h.level < MATCH.maxLevel && h.xp >= xpToNext(h.level)) {
      h.xp -= xpToNext(h.level);
      h.level++;
      up = true;
    }
    if (h.level >= MATCH.maxLevel) h.xp = 0;
    if (up) {
      this.calcStats(h);
      this.emit({ e: 'lvl', id: h.id, l: h.level });
    }
  }

  // gasta um ponto numa habilidade
  rankUp(h, slot) {
    if (!h.ranks || !canRankUp(h.level, h.ranks, slot)) return false;
    h.ranks[slot]++;
    if (!h.isBot) this.emit({ e: 'rank', s: slot, r: h.ranks[slot] }, { to: h.id });
    return true;
  }

  // bots (e bonecos) evoluem sozinhos: R sempre que der, depois a ordem do herói
  autoRank(h) {
    const order = ['r', ...(h.def.skillOrder || ['q', 'e', 'w'])];
    let guard = 20;
    while (skillPoints(h.level, h.ranks) > 0 && guard-- > 0) {
      // R primeiro, depois garante 1 ponto em cada habilidade, depois segue a ordem
      const ok = (s) => canRankUp(h.level, h.ranks, s);
      const slot = (ok('r') && 'r') || order.find((s) => !h.ranks[s] && ok(s)) || order.find(ok);
      if (!slot) break;
      h.ranks[slot]++;
    }
  }

  shareXp(team, at, amount, extra = []) {
    const near = this.heroes.filter((h) => h.team === team && h.alive && (dist(h, at) <= MATCH.xpRange || extra.includes(h)));
    if (near.length === 0) return;
    const each = near.length === 1 ? amount : (amount * 1.3) / near.length;
    for (const h of near) {
      this.giveXp(h, each);
      if (!h.isBot && each >= 20) this.emit({ e: 'xp', v: Math.round(each), x: r1(at.x), z: r1(at.z) }, { to: h.id });
    }
  }

  kill(t, src) {
    t.alive = false;
    t.hp = 0;
    t.dash = null;
    t.castT = 0;
    t.pending = null;
    if (t.isHero) return this.killHero(t, src);
    if (t.isMinion) {
      const d = MINIONS[t.kind];
      if (src?.isHero) {
        src.cs++;
        this.giveGold(src, d.gold, t);
      }
      this.shareXp(1 - t.team, t, d.xp);
      return;
    }
    this.killStruct(t, src);
  }

  killHero(t, src) {
    let killer = src?.isHero ? src : null;
    if (!killer) {
      let bestT = this.time - MATCH.assistWindow;
      for (const [id, time] of t.damagers) {
        if (time > bestT) {
          bestT = time;
          killer = this.byId.get(id) || null;
        }
      }
    }
    if (killer && killer.team === t.team) killer = null;
    const spree = t.streak;
    t.deaths++;
    t.streak = 0;
    t.respawnT = respawnTime(t.level, this.gameTime / 60);
    t.buffs = [];
    t.shields = [];
    t.slows = [];
    t.stunT = t.rootT = t.airT = t.fearT = t.charmT = t.sleepT = 0;
    t.drowsy = null;
    t.goBack = null;
    t.bolts = null;
    if (t.charge) this.endCharges(t);
    this.endStasis(t);
    this.clearHeroState(t);
    t.disp = null;
    t.windup = 0;
    t.order = { type: 'idle' };
    t.target = null;
    this.kills[1 - t.team]++;
    const assists = [];
    for (const [id, time] of t.damagers) {
      const a = this.byId.get(id);
      if (!a || a === killer || a.team === t.team || this.time - time > MATCH.assistWindow) continue;
      assists.push(a);
    }
    let first = false;
    if (killer) {
      killer.kills++;
      killer.streak++;
      let gold = MATCH.killGold + (spree >= 3 ? Math.min(400, 60 * (spree - 1)) : 0);
      if (!this.firstBlood) {
        gold += MATCH.firstBloodGold;
        this.firstBlood = true;
        first = true;
      }
      this.giveGold(killer, gold, t);
      for (const a of assists) {
        a.assists++;
        this.giveGold(a, (gold * 0.5) / assists.length, t);
      }
      if (this.time - killer.multiT < 10) killer.multi++;
      else killer.multi = 1;
      killer.multiT = this.time;
    }
    // abate vale mais contra quem está na frente e menos contra quem ficou pra trás
    const gap = killer ? Math.max(-4, Math.min(4, t.level - killer.level)) : 0;
    this.shareXp(1 - t.team, t, (115 + 26 * t.level) * (1 + gap * 0.12), killer ? [killer, ...assists] : assists);
    this.emit({
      e: 'kill',
      k: killer?.id || src?.id || 0,
      kk: killer ? 0 : src ? KIND[src.kind] : -1,
      v: t.id,
      as: assists.map((a) => a.id),
    });
    if (first) this.ann('Primeiro abate!', `${killer.name} abriu o placar`, 'first', killer.team);
    else if (killer && killer.multi >= 2) {
      const names = ['', '', 'Abate duplo!', 'Abate triplo!', 'Abate quádruplo!', 'MASSACRE!'];
      this.ann(names[Math.min(5, killer.multi)], killer.name, 'multi', killer.team);
    } else if (killer && killer.streak >= 3 && killer.streak % 2 === 1) {
      this.ann(killer.streak >= 7 ? 'Imparável!' : 'Em chamas!', `${killer.name} · ${killer.streak} abates seguidos`, 'spree', killer.team);
    } else if (spree >= 3 && killer) this.ann('Acabou a festa!', `${killer.name} parou ${t.name}`, 'shut', killer.team);
    const teamAlive = this.heroes.some((h) => h.team === t.team && h.alive);
    if (!teamAlive && killer) this.ann('Time inteiro no chão!', '', 'ace', killer.team);
  }

  killStruct(t) {
    const enemy = 1 - t.team;
    this.emit({ e: 'struct', id: t.id, d: 1 });
    if (t.kind === 'tower') {
      for (const h of this.heroes) {
        if (h.team !== enemy) continue;
        this.giveGold(h, MATCH.towerGold, null);
        this.giveXp(h, 120);
        if (!h.isBot) this.emit({ e: 'xp', v: 120, x: r1(t.x), z: r1(t.z) }, { to: h.id });
      }
      this.ann('Torre destruída', `Time ${enemy === 0 ? 'Azul' : 'Vermelho'} +${MATCH.towerGold} de ouro`, 'tower', enemy);
    } else if (t.kind === 'selo') {
      t.respawnT = MATCH.seloRespawn;
      this.ann('Selo quebrado!', 'Tropas gigantes vão marchar', 'selo', enemy);
    } else if (t.kind === 'core') {
      this.endMatch(enemy);
    }
  }

  // ---------- passo da simulação ----------

  step(dt) {
    this.time += dt;
    if (this.phase === 'draft') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startGame();
      return;
    }
    if (this.phase === 'ended') {
      if (this.persistent) {
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.newMatch();
      }
      return;
    }
    this.gameTime += dt;
    if (!this.sandbox || this.dbg.waves) this.waveT -= dt;
    if (this.waveT <= 0) {
      this.waveT += MATCH.waveEvery;
      this.spawnWave();
    }
    this.updateStructs(dt);
    this.updatePacks(dt);
    for (const u of this.units) {
      if (u.alive) this.tickStatus(u, dt);
    }
    // alterna a ordem a cada passo pra nenhum time levar vantagem por ser processado depois
    this.flip = !this.flip;
    const heroes = this.flip ? this.heroes : [...this.heroes].reverse();
    const units = this.flip ? this.units : [...this.units].reverse();
    for (const h of heroes) {
      h.gold += MATCH.goldPerSec * dt;
      h.goldEarned += MATCH.goldPerSec * dt;
      if (!this.sandbox) this.giveXp(h, MATCH.xpPerSec * dt);
      else {
        if (this.dbg.noCd && !h.isBot) for (const s of SLOTS) h.cds[s] = Math.min(h.cds[s], 0.25);
        if (h.alive && (h.god || (h.dummy && this.time - h.combatT > 2.5))) h.hp = h.maxHp;
        if (!h.alive) h.respawnT = Math.min(h.respawnT, 2);
      }
      if (!h.alive) {
        h.respawnT -= dt;
        if (h.respawnT <= 0) this.respawn(h);
        if (h.isBot) this.brains.get(h.id)?.update(dt);
        continue;
      }
      this.expireFresh(h);
      if ((h.isBot || h.dummy) && skillPoints(h.level, h.ranks) > 0) this.autoRank(h);
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.stats.regen * dt);
      if (h.def.fury && h.fury > 0 && this.time - h.combatT > h.def.fury.idle && !h.buffs.some((b) => b.fury)) h.fury = Math.max(0, h.fury - h.def.fury.decay * dt);
      if (h.isBot) this.brains.get(h.id)?.update(dt);
      if (this.phase !== 'playing') return;
      if (h.alive) this.updateHero(h, dt);
    }
    for (const u of units) {
      if (!u.alive) continue;
      if (u.isMinion) this.updateMinion(u, dt);
      else if (u.kind === 'tower' && this.dbg.towers) this.updateTower(u, dt);
    }
    this.integrate(dt);
    this.updateProjectiles(dt);
    this.updateDelayed(dt);
    this.updateZones(dt);
    if (this.dbg.towers) this.updateFountains(dt);
    if (this.phase !== 'playing') return;
    let dead = false;
    for (const u of this.units) if (!u.alive && u.isMinion) dead = true;
    if (dead) {
      this.units = this.units.filter((u) => {
        if (u.alive || !u.isMinion) return true;
        this.byId.delete(u.id);
        return false;
      });
    }
  }

  tickStatus(u, dt) {
    u.atkCd -= dt;
    if (u.attackAnim > 0) u.attackAnim -= dt;
    if (u.stunT > 0) u.stunT -= dt;
    if (u.rootT > 0) u.rootT -= dt;
    if (u.airT > 0) u.airT -= dt;
    if (u.shredT > 0) u.shredT -= dt;
    if (u.fearT > 0) {
      u.fearT -= dt;
      if (u.stunT <= 0 && u.airT <= 0 && !u.disp && u.stasisT <= 0 && u.rootT <= 0 && !u.dash) {
        let fx = u.x - u.fearX;
        let fz = u.z - u.fearZ;
        let fd = Math.hypot(fx, fz);
        if (fd < 0.1) {
          fx = -pushDir(u.team);
          fz = 0;
          fd = 1;
        }
        const sp = (u.isHero ? u.stats.ms : u.stats.ms * (u.slowMult ?? 1)) * 0.8;
        u.vx = (fx / fd) * sp;
        u.vz = (fz / fd) * sp;
        u.facing = Math.atan2(fz, fx);
      }
    }
    if (u.burn) {
      const b = u.burn;
      b.t -= dt;
      b.tickT -= dt;
      if (b.tickT <= 0) {
        b.tickT += b.tick;
        this.damage(u, b.src, b.dmg, b.type);
      }
      if (u.burn && u.burn.t <= 0) u.burn = null;
    }
    if (u.empower) {
      u.empower.t -= dt;
      if (u.empower.t <= 0) {
        u.empower = null;
        if (u.isHero) this.calcStats(u);
      }
    }
    if (u.recast) {
      u.recast.t -= dt;
      u.recast.cd -= dt;
      if (u.recast.t <= 0) {
        u.cds[u.recast.slot] = Math.max(u.cds[u.recast.slot], u.recast.cd);
        u.recast = null;
      }
    }
    if (u.charmT > 0) u.charmT -= dt;
    if (u.sleepT > 0) u.sleepT -= dt;
    if (u.drowsy && (u.drowsy.t -= dt) <= 0) {
      u.sleepT = u.drowsy.sleep;
      u.sleepBonus = u.drowsy.bonus;
      u.sleepBy = u.drowsy.src;
      u.drowsy = null;
      u.windup = 0;
      if (u.castT > 0) {
        u.castT = 0;
        u.pending = null;
        this.emit({ e: 'cancel', id: u.id });
      }
    }
    if (u.goBack && (u.goBack.t -= dt) <= 0) {
      const g = u.goBack;
      u.goBack = null;
      if (!u.dash && u.stasisT <= 0) {
        const from = [r1(u.x), r1(u.z)];
        u.x = g.x;
        u.z = g.z;
        this.resolveStatic(u);
        this.emit({ e: 'blink', id: u.id, a: from, b: [r1(u.x), r1(u.z)], c: g.c, fl: 0 });
      }
    }
    if (u.bolts) this.tickBolts(u, dt);
    if (u.charge && (u.charge.t -= dt) <= 0) this.endCharges(u);
    if (u.stasisT > 0) {
      u.stasisT -= dt;
      if (u.stasisT <= 0) this.endStasis(u);
    }
    if (u.itemCd) for (const id in u.itemCd) if (u.itemCd[id] > 0) u.itemCd[id] = Math.max(0, u.itemCd[id] - dt);
    if (u.disp) {
      u.x += u.disp.vx * dt;
      u.z += u.disp.vz * dt;
      u.disp.t -= dt;
      if (u.disp.t <= 0) u.disp = null;
    }
    let changed = false;
    if (u.slows.length) {
      for (const s of u.slows) s.t -= dt;
      const n = u.slows.length;
      u.slows = u.slows.filter((s) => s.t > 0);
      if (u.slows.length !== n) changed = true;
    }
    if (u.shields.length) {
      for (const s of u.shields) s.t -= dt;
      u.shields = u.shields.filter((s) => s.t > 0 && s.amt > 0.5);
    }
    if (u.buffs.length) {
      for (const b of u.buffs) {
        b.t -= dt;
        if (b.fury) this.addFury(u, b.fury * dt);
        if (b.aura) {
          b.auraT -= dt;
          if (b.auraT <= 0) {
            b.auraT += b.aura.tick;
            const src = b.src && b.src.alive ? b.src : u;
            const dmg = this.val(src, b.aura.dmg);
            for (const o of this.units) {
              if (!o.alive || o.team === u.team || o.isStructure) continue;
              if (dist(o, u) > b.aura.radius + o.r) continue;
              this.damage(o, src, dmg, b.aura.dmg.type);
            }
          }
        }
      }
      const n = u.buffs.length;
      u.buffs = u.buffs.filter((b) => b.t > 0);
      if (u.buffs.length !== n) changed = true;
    }
    if (u.isHero) {
      for (const s of SLOTS) if (u.cds[s] > 0) u.cds[s] = Math.max(0, u.cds[s] - dt);
      this.calcStats(u);
    } else if (changed && u.isMinion) {
      let slow = 0;
      for (const sl of u.slows) slow = Math.max(slow, sl.p);
      u.slowMult = 1 - slow;
    }
  }

  updateStructs(dt) {
    for (let team = 0; team < 2; team++) {
      for (const s of this.structs[team]) {
        s.invuln = s.req.some((r) => r.alive);
        if (!s.alive && s.kind === 'selo') {
          s.respawnT -= dt;
          if (s.respawnT <= 0) {
            s.alive = true;
            s.hp = s.stats.maxHp;
            this.emit({ e: 'struct', id: s.id, d: 0 });
            this.ann('Selo restaurado', '', 'selo', team);
          }
        }
      }
    }
  }

  updatePacks(dt) {
    for (const p of this.packs) {
      if (!p.up) {
        p.t -= dt;
        if (p.t <= 0) {
          p.up = true;
          this.emit({ e: 'pack', i: p.i, u: 1 });
        }
        continue;
      }
      for (const h of this.heroes) {
        if (!h.alive || Math.hypot(h.x - p.x, h.z - p.z) > h.r + 0.9) continue;
        p.up = false;
        p.t = MATCH.packRespawn;
        this.heal(h, MATCH.packHeal + MATCH.packHealPct * h.maxHp, null);
        this.emit({ e: 'pack', i: p.i, u: 0, id: h.id });
        break;
      }
    }
  }

  updateFountains(dt) {
    this.laserT = (this.laserT || 0) - dt;
    if (this.laserT > 0) return;
    this.laserT = 0.25;
    for (let team = 0; team < 2; team++) {
      const fx = fountainX(team);
      for (const h of this.heroes) {
        if (!h.alive || h.team === team) continue;
        if (Math.hypot(h.x - fx, h.z) > MAP.fountainLaser) continue;
        this.damage(h, null, 140, 'true');
        this.emit({ e: 'laser', tm: team, v: h.id });
      }
    }
  }

  // move de leve, desviando dos obstáculos redondos
  moveToward(u, tx, tz, dt, stop = 0, ignore = null) {
    if (u.rootT > 0 || u.cc) return false;
    let dx = tx - u.x;
    let dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    if (d <= stop + 0.05) return false;
    dx /= d;
    dz /= d;
    let best = null;
    let bestProj = Infinity;
    const blockers = this.blockers();
    for (const o of blockers) {
      if (o === u || o === ignore) continue;
      const ox = o.x - u.x;
      const oz = o.z - u.z;
      const proj = ox * dx + oz * dz;
      if (proj <= 0 || proj > Math.min(d, 4.5) + o.r) continue;
      const lat = ox * -dz + oz * dx;
      const clear = o.r + u.r + 0.2;
      if (Math.abs(lat) >= clear) continue;
      if (proj < bestProj) {
        bestProj = proj;
        best = { lat, clear };
      }
    }
    if (best) {
      const side = best.lat > 0.02 ? -1 : best.lat < -0.02 ? 1 : u.id % 2 ? 1 : -1;
      const k = ((best.clear - Math.abs(best.lat)) / best.clear) * 1.6 + 0.3;
      const nx = dx + -dz * side * k;
      const nz = dz + dx * side * k;
      const l = Math.hypot(nx, nz);
      dx = nx / l;
      dz = nz / l;
    }
    const sp = u.isHero ? u.stats.ms : u.stats.ms * (u.slowMult ?? 1);
    const step = Math.min(sp, (d - stop) / dt);
    u.vx = dx * step;
    u.vz = dz * step;
    u.facing = Math.atan2(dz, dx);
    return true;
  }

  blockers() {
    if (this._blockT !== this.time) {
      this._blockT = this.time;
      this._block = [...OBSTACLES];
      for (const team of this.structs) for (const s of team) if (s.alive) this._block.push(s);
    }
    return this._block;
  }

  resolveStatic(u) {
    for (const o of this.blockers()) if (o !== u) pushOut(u, o);
    const [x, z] = clampWalk(u.x, u.z, u.r);
    u.x = x;
    u.z = z;
  }

  integrate(dt) {
    const mobile = [];
    for (const u of this.units) {
      if (!u.alive || u.isStructure) continue;
      if (u.dash) {
        u.vx = u.vz = 0;
        continue;
      }
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      u.moving = Math.abs(u.vx) + Math.abs(u.vz) > 0.1;
      u.vx = u.vz = 0;
      mobile.push(u);
    }
    for (let i = 0; i < mobile.length; i++) {
      const a = mobile[i];
      for (let j = i + 1; j < mobile.length; j++) {
        const b = mobile[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = (a.r + b.r) * 0.8;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = ((min - d) / d) * 0.5;
        const nx = d2 > 0.0001 ? dx : (a.id % 2 ? 0.1 : -0.1);
        const nz = d2 > 0.0001 ? dz : 0.1;
        const wa = a.isHero && !b.isHero ? 0.3 : !a.isHero && b.isHero ? 1.7 : 1;
        a.x -= nx * push * wa;
        a.z -= nz * push * wa;
        b.x += nx * push * (2 - wa);
        b.z += nz * push * (2 - wa);
      }
    }
    for (const u of mobile) this.resolveStatic(u);
  }

  // ---------- heróis ----------

  inAttackRange(u, t, extra = 0) {
    return edgeDist(u, t) <= u.stats.range + extra;
  }

  updateHero(h, dt) {
    if (h.dash) {
      this.updateDash(h, dt);
      return;
    }
    if (h.cc) {
      h.windup = 0;
      if (h.charmT > 0 && h.stunT <= 0 && h.airT <= 0 && !h.disp && h.stasisT <= 0 && h.fearT <= 0) this.charmWalk(h);
      return;
    }
    if (h.castT > 0) {
      h.castT -= dt;
      if (h.castT <= 0 && h.pending) {
        const p = h.pending;
        h.pending = null;
        if (p.t) {
          p.x = p.t.x;
          p.z = p.t.z;
        }
        this.execute(h, p.slot, p.ab, p.x, p.z, p.t);
      }
      return;
    }
    const o = h.order;
    switch (o.type) {
      case 'move':
        if (!this.moveToward(h, o.x, o.z, dt)) h.order = { type: 'idle' };
        break;
      case 'attack':
        if (!this.attackable(h, o.target)) {
          h.order = { type: 'idle' };
          h.target = null;
          break;
        }
        this.engage(h, o.target, dt);
        break;
      case 'amove': {
        if (!this.attackable(h, h.target) || edgeDist(h, h.target) > 9 || (o.heroes && !h.target.isHero)) h.target = this.nearestEnemy(h, 7.5, !o.heroes, o.heroes);
        if (h.target) this.engage(h, h.target, dt);
        else if (!this.moveToward(h, o.x, o.z, dt)) h.order = { type: 'idle' };
        break;
      }
      case 'cast': {
        const t = o.target;
        const ab = abilityOf(h.heroId, o.slot, h.spells);
        if (!this.abilityTargetable(h, t, ab) || h.cds[o.slot] > 0) {
          h.order = { type: 'idle' };
          break;
        }
        if (edgeDist(h, t) <= ab.range) this.beginCast(h, o.slot, ab, t.x, t.z, t);
        else this.moveToward(h, t.x, t.z, dt, 0, t);
        break;
      }
      default: {
        if (!this.attackable(h, h.target) || !this.inAttackRange(h, h.target, 0.3) || h.target.sleepT > 0 || h.target.drowsy) h.target = this.nearestEnemy(h, h.stats.range + 0.2, false);
        if (h.target && this.inAttackRange(h, h.target, 0.3)) this.attackStep(h, h.target, dt);
        else h.windup = 0;
      }
    }
  }

  nearestEnemy(h, range, structures, heroesOnly = false) {
    let best = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (!this.attackable(h, u)) continue;
      if (heroesOnly && !u.isHero) continue;
      if (u.isStructure && !structures) continue;
      // quem dorme não é escolhido sozinho como alvo: acordar ele tem que ser decisão de quem joga
      if (u.isHero && (u.sleepT > 0 || u.drowsy)) continue;
      const d = edgeDist(h, u);
      if (d > range) continue;
      const score = d - (u.isHero ? 1.5 : 0);
      if (score < bestD) {
        bestD = score;
        best = u;
      }
    }
    return best;
  }

  engage(u, t, dt) {
    if (this.inAttackRange(u, t)) this.attackStep(u, t, dt);
    else {
      u.windup = 0;
      this.moveToward(u, t.x, t.z, dt, u.r + t.r + u.stats.range * 0.85, t);
    }
  }

  attackStep(u, t, dt) {
    u.facing = Math.atan2(t.z - u.z, t.x - u.x);
    if (u.windup > 0) {
      u.windup -= dt;
      if (u.windup <= 0) {
        u.windup = 0;
        // herói: a recarga só começa quando o golpe sai, então cancelar o preparo não custa um ataque
        if (u.isHero) u.atkCd = 1 / u.stats.as - u.windupMax;
        this.releaseAttack(u, t);
      }
      return;
    }
    if (u.atkCd <= 0) {
      const period = 1 / u.stats.as;
      if (u.isHero) {
        // preparo curto: o golpe sai quase junto com o clique
        u.windup = u.ranged ? Math.min(0.1, period * 0.08) : Math.min(0.14, period * 0.11);
        u.windupMax = u.windup;
        u.attackAnim = Math.min(0.3, period * 0.5);
        this.emit({ e: 'swing', id: u.id, v: t.id, r: u.ranged ? 1 : 0, w: Math.round(u.windup * 1000) });
      } else {
        u.windup = Math.min(0.32, period * 0.28);
        u.atkCd = period;
        u.attackAnim = Math.min(0.45, period * 0.8);
      }
    }
  }

  releaseAttack(u, t) {
    if (!t.alive) return;
    const dmg = u.stats.atk;
    const ranged = u.isHero ? u.ranged : u.kind === 'ranged' || u.kind === 'siege';
    if (ranged) {
      const speed = u.isHero ? 44 : MINIONS[u.kind].proj;
      this.spawnProj({ owner: u, team: u.team, x: u.x, z: u.z, homing: t, speed, dmg, type: 'phys', kind: 'a', color: u.isHero ? u.def.color : u.team === 0 ? '#7cc4ff' : '#ff7a8a', size: u.isHero ? 0.35 : 0.22 });
    } else {
      this.autoHit(u, t, dmg);
    }
  }

  autoHit(u, t, dmg) {
    if (!t.alive) return;
    if (u.isHero && u.empower && !t.isStructure) return this.biteHit(u, t);
    const crit = u.isHero && u.stats.crit > 0 && !t.isStructure && Math.random() < u.stats.crit;
    this.damage(t, u, crit ? dmg * CRIT_MULT : dmg, 'phys', { auto: true, crit });
    if (u.isHero && u.def.fury) this.addFury(u, u.def.fury.auto * (u.hp < u.maxHp * 0.5 ? u.def.fury.lowHp : 1));
  }

  biteHit(u, t) {
    const em = u.empower;
    u.empower = null;
    this.calcStats(u);
    const nh = em.ab.nextHit;
    const dmg = this.val(u, nh.dmg, em.ab);
    this.emit({ e: 'bite', id: u.id, v: t.id, n: em.hits, emp: em.emp ? 1 : 0 });
    for (let i = 0; i < em.hits && t.alive; i++) this.damage(t, u, dmg, nh.dmg.type, { auto: i === 0 });
    if (t.alive) this.applyFx(t, { stun: em.stun }, u);
    if (!em.emp) this.addFury(u, nh.fury || 0);
  }

  drainNova(h, slot, ab, color) {
    const emp = !!ab.emp && this.spendFury(h, slot);
    const dmg = this.val(h, ab.dmg, ab) * (emp ? ab.emp.dmg : 1);
    let healed = 0;
    let gained = 0;
    for (const u of this.units) {
      if (!u.alive || u.team === h.team || u.isStructure) continue;
      if (Math.hypot(u.x - h.x, u.z - h.z) > ab.radius + u.r) continue;
      const hero = u.isHero;
      const dealt = this.damage(u, h, dmg, ab.dmg.type);
      healed += dealt * (hero ? ab.drain.h : ab.drain.m) * (emp ? ab.emp.drain : 1);
      if (ab.fury && !emp) gained += hero ? ab.fury[1] : ab.fury[0];
      this.applyFx(u, ab.fx, h);
    }
    if (healed > 0) this.heal(h, healed, h);
    if (gained > 0) this.addFury(h, Math.min(gained, ab.fury[2]));
    this.emit({ e: 'boom', x: r1(h.x), z: r1(h.z), r: ab.radius, c: emp ? '#ef4444' : color, o: h.id });
  }

  // ---------- tropas ----------

  updateMinion(m, dt) {
    if (m.cc) {
      m.windup = 0;
      if (m.charmT > 0 && m.stunT <= 0 && m.airT <= 0 && !m.disp && m.fearT <= 0) this.charmWalk(m);
      return;
    }
    m.retargetT -= dt;
    const valid = (t) => this.attackable(m, t) && dist(m, t) <= MINIONS.aggro + 3 + t.r;
    if (m.helpTarget && m.helpT > this.time && valid(m.helpTarget) && m.target !== m.helpTarget) {
      m.target = m.helpTarget;
      m.windup = 0;
    }
    if (!valid(m.target) || (m.retargetT <= 0 && !m.target.isMinion && m.windup <= 0)) {
      m.target = this.acquireMinionTarget(m);
      m.retargetT = 0.5;
    }
    if (m.target) {
      this.engage(m, m.target, dt);
      return;
    }
    m.windup = 0;
    const core = this.structs[1 - m.team].core;
    this.moveToward(m, core.x, m.laneZ * 0.8, dt, 2);
  }

  acquireMinionTarget(m) {
    let best = null;
    let bestScore = Infinity;
    for (const u of this.units) {
      if (!this.attackable(m, u)) continue;
      const d = edgeDist(m, u);
      if (d > MINIONS.aggro) continue;
      const pri = u.isMinion ? 0 : u.isHero ? 6 : 3;
      const score = d + pri;
      if (score < bestScore) {
        bestScore = score;
        best = u;
      }
    }
    return best;
  }

  // ---------- torres ----------

  updateTower(t, dt) {
    t.atkCd -= dt;
    const R = TOWER.range;
    const valid = (u) => u && u.alive && u.team !== t.team && this.byId.get(u.id) === u && dist(t, u) <= R + u.r;
    if (t.forced && t.forcedT > this.time && valid(t.forced) && t.target !== t.forced) {
      t.target = t.forced;
      t.ramp = 0;
    }
    if (!valid(t.target)) {
      t.target = null;
      t.ramp = 0;
      let bestD = Infinity;
      for (const u of this.units) {
        if (!valid(u) || u.isStructure) continue;
        const d = dist(t, u) + (u.isHero ? 100 : 0);
        if (d < bestD) {
          bestD = d;
          t.target = u;
        }
      }
    }
    if (t.target && t.atkCd <= 0) {
      t.atkCd = 1 / TOWER.attackSpeed;
      this.spawnProj({ owner: t, team: t.team, x: t.x, z: t.z, homing: t.target, speed: TOWER.projSpeed, dmg: 0, type: 'phys', kind: 't', color: t.team === 0 ? '#9fd4ff' : '#ff9fb0', size: 0.6 });
    }
  }

  towerHit(t, u) {
    if (!u.alive) return;
    if (u.isMinion) {
      this.damage(u, t, u.maxHp * TOWER.vsMinion[u.kind], 'true');
      return;
    }
    if (u.isHero) {
      const base = TOWER.dmg + TOWER.dmgPerMin * (this.gameTime / 60);
      const ramp = t.target === u ? Math.min(TOWER.rampMax, t.ramp * TOWER.rampPerHit) : 0;
      if (t.target === u) t.ramp++;
      this.damage(u, t, base * (1 + ramp), 'phys');
    }
  }

  // ---------- projéteis, áreas e zonas ----------

  spawnProj(p) {
    p.id = this.projSeq++;
    p.x0 = p.x;
    p.z0 = p.z;
    p.traveled = 0;
    p.hit = new Set();
    this.projectiles.push(p);
    if (p.owner && p.dx !== undefined) p.owner.lastProjDir = null;
    this.emit({
      e: 'pj',
      id: p.id,
      o: p.owner.id,
      x: r1(p.x),
      z: r1(p.z),
      dx: p.dx !== undefined ? r2(p.dx) : 0,
      dz: p.dz !== undefined ? r2(p.dz) : 0,
      h: p.homing ? p.homing.id : 0,
      s: p.speed,
      r: p.range || 0,
      w: r2(p.size || 0.3),
      c: p.color,
      k: p.kind,
      sl: p.slot || '',
      wd: p.width || 0,
    });
  }

  updateProjectiles(dt) {
    const done = [];
    const back = [];
    for (const p of this.projectiles) {
      if (p.homing) {
        const t = p.homing;
        if (!t.alive || this.byId.get(t.id) !== t) {
          done.push(p);
          continue;
        }
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const d = Math.hypot(dx, dz);
        const step = p.speed * dt;
        const arrived = d <= step + t.r * 0.5;
        if (p.sweep) {
          // a volta pra mão do dono: fere uma vez cada inimigo que estiver no caminho
          const k = arrived ? d : step;
          const nx = d > 0.001 ? p.x + (dx / d) * k : p.x;
          const nz = d > 0.001 ? p.z + (dz / d) * k : p.z;
          for (const u of this.units) {
            if (!u.alive || u.team === p.team || u.isStructure || p.hit.has(u.id)) continue;
            const [d2] = segDist2(u.x, u.z, p.x, p.z, nx, nz);
            const w = p.width / 2 + u.r;
            if (d2 > w * w) continue;
            p.hit.add(u.id);
            this.damage(u, p.owner, p.dmg, p.type);
          }
          p.x = nx;
          p.z = nz;
          if (arrived) done.push(p);
          continue;
        }
        if (arrived) {
          done.push(p);
          if (p.kind === 't') this.towerHit(p.owner, t);
          else if (p.skill) {
            this.damage(t, p.owner, p.dmg, p.type);
            this.applyFx(t, p.fx, p.owner);
          } else this.autoHit(p.owner, t, p.dmg);
          continue;
        }
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        continue;
      }
      if (p.hoverT > 0) {
        // parado no ar esperando o segundo lançamento
        p.hoverT -= dt;
        if (p.hoverT <= 0 || !p.owner.alive) {
          done.push(p);
          if (p.owner.orb === p) p.owner.orb = null;
        }
        continue;
      }
      const step = Math.min(p.speed * dt, p.range - p.traveled);
      const nx = p.x + p.dx * step;
      const nz = p.z + p.dz * step;
      const hits = [];
      for (const u of this.units) {
        if (!u.alive || u.team === p.team || u.isStructure || p.hit.has(u.id)) continue;
        if (p.heroesOnly && !u.isHero) continue;
        const [d2, tt] = segDist2(u.x, u.z, p.x, p.z, nx, nz);
        const w = p.width / 2 + u.r;
        if (d2 <= w * w) hits.push({ u, tt });
      }
      hits.sort((a, b) => a.tt - b.tt);
      let stopped = false;
      for (const { u } of hits) {
        p.hit.add(u.id);
        this.skillHit(p, u);
        if (!p.pierce) {
          stopped = true;
          p.x = u.x;
          p.z = u.z;
          break;
        }
      }
      if (!stopped) {
        p.x = nx;
        p.z = nz;
        p.traveled += step;
      }
      if (!stopped && p.traveled >= p.range - 0.01 && p.hover && p.slot && p.owner.alive && !p.owner.recast) {
        p.hoverT = p.hover;
        p.hover = 0;
        p.owner.orb = p;
        p.owner.recast = { slot: p.slot, t: p.hoverT, cd: p.owner.cds[p.slot] };
        p.owner.cds[p.slot] = 0;
        continue;
      }
      if (stopped || p.traveled >= p.range - 0.01) {
        done.push(p);
        // errou: a fumaça fica no chão como armadilha pro primeiro que pisar
        if (!stopped && p.trap) this.spawnZone(p.owner, p.x, p.z, { r: p.trap.r, dur: p.trap.dur, tick: 0.1, dmg: p.dmg, type: p.type, fx: p.fx, once: true }, p.color);
        if (!stopped && p.back && p.owner.alive) {
          back.push({ owner: p.owner, team: p.team, x: p.x, z: p.z, homing: p.owner, sweep: true, speed: p.back.speed || p.speed, dmg: p.backDmg, type: p.back.type || p.type, width: p.width, color: p.color, slot: p.slot, kind: 's', size: p.width });
        }
      }
    }
    if (done.length) {
      for (const p of done) this.emit({ e: 'pjx', id: p.id, x: r1(p.x), z: r1(p.z) });
      this.projectiles = this.projectiles.filter((p) => !done.includes(p));
    }
    for (const p of back) this.spawnProj(p);
  }

  skillHit(p, u) {
    const owner = p.owner;
    const dmg = this.projDmg(p, u);
    if (p.explode) {
      for (const o of this.units) {
        if (!o.alive || o.team === p.team || o.isStructure) continue;
        if (o !== u && dist(o, u) > p.explode + o.r) continue;
        this.damage(o, owner, dmg, p.type);
        this.applyFx(o, p.fx, owner);
      }
      this.emit({ e: 'boom', x: r1(u.x), z: r1(u.z), r: p.explode, c: p.color, o: owner.id });
      return;
    }
    owner.lastProjDir = [p.dx, p.dz];
    this.damage(u, owner, dmg, p.type);
    this.applyFx(u, p.fx, owner);
    owner.lastProjDir = null;
  }

  updateDelayed(dt) {
    if (!this.delayed.length) return;
    for (const a of this.delayed) {
      a.t -= dt;
      if (a.t > 0) continue;
      this.hitArea(a.owner, a.x, a.z, a.r, a.dmg, a.type, a.fx, a.color);
      if (a.linger) this.spawnZone(a.owner, a.x, a.z, { r: a.r, dur: a.linger.dur, tick: a.linger.tick, dmg: a.linger.dmg, type: a.linger.type, fx: a.linger.fx }, a.color);
    }
    this.delayed = this.delayed.filter((a) => a.t > 0);
  }

  spawnZone(h, x, z, o, color) {
    const zn = { id: this.zoneSeq++, owner: h, team: h.team, x, z, r: o.r, t: o.dur, tick: o.tick, tickT: 0, dmg: o.dmg, type: o.type || 'magic', fx: o.fx, line: o.line || null, once: !!o.once, color };
    this.zones.push(zn);
    const m = { e: 'zone', id: zn.id, x: r1(x), z: r1(z), r: zn.r, t: zn.t, c: color, tm: h.team, o: h.id };
    if (zn.line) m.l = zn.line;
    this.emit(m);
    return zn;
  }

  updateZones(dt) {
    if (!this.zones.length) return;
    for (const zn of this.zones) {
      zn.t -= dt;
      zn.tickT -= dt;
      if (zn.tickT > 0) continue;
      zn.tickT += zn.tick;
      for (const u of this.units) {
        if (!u.alive || u.team === zn.team || u.isStructure) continue;
        if (zn.line) {
          const [d2] = segDist2(u.x, u.z, zn.line[0], zn.line[1], zn.line[2], zn.line[3]);
          if (d2 > (zn.r + u.r) ** 2) continue;
        } else if (Math.hypot(u.x - zn.x, u.z - zn.z) > zn.r + u.r) continue;
        this.damage(u, zn.owner, zn.dmg, zn.type);
        this.applyFx(u, zn.fx, zn.owner);
        if (zn.once) {
          // armadilha: dispara no primeiro que pisar e some
          zn.t = 0;
          break;
        }
      }
    }
    const gone = this.zones.filter((z) => z.t <= 0);
    if (gone.length) {
      for (const z of gone) this.emit({ e: 'zonex', id: z.id });
      this.zones = this.zones.filter((z) => z.t > 0);
    }
  }

  // ---------- loja ----------

  canShop(h) {
    return this.phase !== 'ended' && (this.sandbox || !h.alive || inBase(h.team, h.x, h.z) || this.phase === 'draft');
  }

  priceFor(h, id) {
    return ITEMS[id] ? itemPrice(h.items, id) : null;
  }

  buy(h, id) {
    const it = ITEMS[id];
    if (!it || !this.canShop(h)) return false;
    const p = this.priceFor(h, id);
    if (p.clash || !p.fits || h.gold < p.cost) return false;
    h.gold -= p.cost;
    // "fresco" = ouro gasto no item desde que o herói está na base; vender antes de sair devolve isso inteiro
    const fresh = this.freshOf(h);
    let carried = 0;
    for (const c of p.use) {
      const i = h.items.indexOf(c);
      carried += fresh[i] || 0;
      h.items.splice(i, 1);
      fresh.splice(i, 1);
    }
    h.items.push(id);
    fresh.push(p.cost + carried);
    h.freshAt = [h.x, h.z];
    this.calcStats(h);
    if (!h.isBot) this.emit({ e: 'bought', i: id }, { to: h.id });
    return true;
  }

  sell(h, idx) {
    if (!this.canShop(h)) return false;
    const id = h.items[idx];
    if (!id) return false;
    h.gold += this.sellPrice(h, idx);
    // pega a lista antes de mexer nos itens: com os tamanhos diferentes o freshOf zera a devolução dos outros
    const fresh = this.freshOf(h);
    h.items.splice(idx, 1);
    fresh.splice(idx, 1);
    this.calcStats(h);
    return true;
  }

  // ---------- itens de usar ----------

  endStasis(u) {
    if (u.stasisT > 0 || u.statue) u.invuln = false;
    u.stasisT = 0;
    u.statue = false;
  }

  // usa o item do espaço `idx` do inventário (ver `active` em ITEMS)
  useItem(h, idx) {
    if (!this.canAct(h) || h.cc || h.dash) return false;
    const id = h.items[idx];
    const act = ITEMS[id]?.active;
    if (!act || h.itemCd[id] > 0) return false;
    if (act.stasis) {
      h.stasisT = act.stasis;
      h.statue = true;
      h.invuln = true;
      h.windup = 0;
      h.order = { type: 'idle' };
    }
    if (act.cd) h.itemCd[id] = act.cd;
    this.emit({ e: 'use', id: h.id, i: id });
    return true;
  }

  freshOf(h) {
    if (!h.fresh || h.fresh.length !== h.items.length) h.fresh = h.items.map(() => 0);
    return h.fresh;
  }

  // a parte comprada sem sair da base volta inteira; o resto vale 70%
  sellPrice(h, idx) {
    const cost = ITEMS[h.items[idx]].cost;
    const fresh = Math.min(cost, this.freshOf(h)[idx] || 0);
    return fresh + Math.floor((cost - fresh) * 0.7);
  }

  // saiu da base (no treino: afastou-se de onde comprou): as compras deixam de ser devolvíveis
  expireFresh(h) {
    if (!h.freshAt || !h.alive) return;
    const left = this.sandbox ? Math.hypot(h.x - h.freshAt[0], h.z - h.freshAt[1]) > 6 : !inBase(h.team, h.x, h.z);
    if (!left) return;
    h.fresh = h.items.map(() => 0);
    h.freshAt = null;
  }

  // ---------- rede ----------

  handle(h, msg) {
    if (!h || !msg || typeof msg !== 'object') return;
    const x = Number(msg.x);
    const z = Number(msg.z);
    switch (msg.t) {
      case 'dbg':
        if (this.sandbox) this.debug(h, msg);
        break;
      case 'mv':
        this.orderMove(h, x, z);
        break;
      case 'am':
        this.orderAmove(h, x, z, Number(msg.h) === 1);
        break;
      case 'at':
        this.orderAttack(h, this.byId.get(Number(msg.id)));
        break;
      case 'st':
        this.orderStop(h);
        break;
      case 'c':
        this.cast(h, String(msg.s), x, z, Number(msg.id));
        break;
      case 'up':
        this.rankUp(h, String(msg.s));
        break;
      case 'buy':
        this.buy(h, String(msg.i));
        break;
      case 'sell':
        this.sell(h, Number(msg.n) | 0);
        break;
      case 'use':
        this.useItem(h, Number(msg.n) | 0);
        break;
      case 'pick':
        this.pick(h, String(msg.h));
        break;
      case 'rr':
        this.pickRandom(h);
        break;
      case 'spell':
        this.setSpell(h, String(msg.s), String(msg.v));
        break;
      case 'go':
        this.ready(h);
        break;
      default:
        break;
    }
  }

  flags(u) {
    let f = u.alive ? F.alive : 0;
    if (u.stunT > 0) f |= F.stun;
    if (u.rootT > 0) f |= F.root;
    if (u.slows.length) f |= F.slow;
    if (u.airT > 0) f |= F.air;
    if (u.dash) f |= F.dash;
    if (u.attackAnim > 0) f |= F.attack;
    if (u.invuln) f |= F.invuln;
    if (u.stasisT > 0) f |= F.stasis;
    if (u.charmT > 0) f |= F.charm;
    if (u.sleepT > 0) f |= F.sleep;
    if (u.bolts) f |= F.orbs;
    if (u.moving || u.dash) f |= F.move;
    if (u.castT > 0) f |= F.cast;
    if (u.buffs.length) f |= F.buff;
    if (u.buffs.some((b) => b.aura)) f |= F.aura;
    if (u.fearT > 0) f |= F.fear;
    if (u.burn) f |= F.burn;
    if (u.isHero && u.buffs.some((b) => b.big)) f |= F.big;
    if (u.isHero && u.def?.fury && u.fury >= u.def.fury.cost) f |= F.fury;
    return f;
  }

  snapshot() {
    return {
      e: 'snap',
      t: r2(this.time),
      ph: this.phase,
      pt: r1(this.phaseT),
      gt: r1(this.gameTime),
      k: this.kills,
      wv: r1(this.waveT),
      u: this.units.map((u) => [
        u.id,
        KIND[u.kind],
        u.team,
        r1(u.x),
        r1(u.z),
        r2(u.facing),
        Math.ceil(Math.max(0, u.hp)),
        Math.round(u.maxHp),
        this.flags(u),
        Math.round(u.shieldTotal()),
        u.isHero ? HERO_ORDER.indexOf(u.heroId) : 0,
        u.isHero ? u.level : 0,
        u.isHero && !u.alive ? r1(u.respawnT) : 0,
      ]),
      pk: this.packs.map((p) => (p.up ? 1 : 0)),
    };
  }

  meState(h) {
    const s = h.stats;
    return {
      e: 'me',
      id: h.id,
      g: Math.floor(h.gold),
      it: h.items,
      rk: RANK_SLOTS.map((k) => h.ranks?.[k] || 0),
      pt: h.ranks ? skillPoints(h.level, h.ranks) : 0,
      sp: h.items.map((_, i) => this.sellPrice(h, i)),
      ic: h.items.map((id) => r1(h.itemCd?.[id] || 0)),
      cd: SLOTS.map((k) => r1(h.cds[k])),
      cm: SLOTS.map((k) => r1(h.cdMax[k])),
      xp: Math.floor(h.xp),
      xn: xpToNext(h.level),
      lv: h.level,
      s: [Math.round(s.atk), Math.round(s.pow), Math.round(s.armor), Math.round(s.mres), r2(s.as), r2(s.ms), r1(s.range), Math.round(s.haste), Math.round(s.crit * 100)],
      sh: this.canShop(h) ? 1 : 0,
      rd: h.ready ? 1 : 0,
      ch: h.charge ? h.charge.left : 0,
      st: h.def?.abilities?.w?.steal ? this.stolenFor(h, h.def.abilities.w)?.id || '' : undefined,
      fu: h.def?.fury ? Math.floor(h.fury || 0) : undefined,
    };
  }

  board() {
    return {
      e: 'board',
      l: this.heroes.map((h) => [h.id, h.kills, h.deaths, h.assists, h.cs, h.level, h.items, Math.floor(h.goldEarned), Math.round(h.dmgDealt), Math.round(h.healDone)]),
    };
  }
}

export { SPELLS };
