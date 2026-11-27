import * as THREE from 'three';
import { DEFAULT_KEYS, MOVE_ACTIONS, keyName, mouseCode } from './keys.js';
import { MouseGrab } from './grab.js';
import { initAudio, playSound, setListener, setMuted } from './audio.js';
import { HERO_ORDER, HEROES, ITEMS, MAP, SLOTS, TEAMS, TOWER, abilityOf, canRankUp } from './config.js';
import { Effects } from './effects.js';
import { fxOf, projShape } from './fxstyle.js';
import { PACKS, bushAt, cannonPos, pushDir, structLayout } from './geo.js';
import { Hud, esc } from './hud.js';
import { buildMapView } from './mapview.js';
import { CannonModel, HeroModel, MinionModel, StructModel, packModel } from './models.js';
import { Overlay } from './overlay.js';
import { F, KIND_NAMES } from './sim.js';

const STEP = 1 / 30;
// altura da câmera enquanto o herói está no canhão (a roda do mouse vai de 18 a 40)
const CANNON_ZOOM = 62;
// segundos que o ping de dúvida fica no minimapa
const PING_LIFE = 4;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const STRUCT = new Set(['tower', 'selo', 'core']);

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Game {
  constructor(canvas, overlayCanvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a9d8e6');
    this.scene.fog = new THREE.Fog('#a9d8e6', 70, 170);
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 400);
    this.scene.add(new THREE.HemisphereLight('#eaf6ff', '#6b5a40', 1.15));
    this.sun = new THREE.DirectionalLight('#fff0d4', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -42;
    sc.right = 42;
    sc.top = 42;
    sc.bottom = -42;
    sc.near = 5;
    sc.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    this.mapView = buildMapView(this.scene);
    this.effects = new Effects(this.scene);
    this.overlay = new Overlay(overlayCanvas);
    this.hud = new Hud(this);
    this.pings = [];

    this.packs = PACKS.map((p) => {
      const m = packModel();
      m.position.set(p.x, 0, p.z);
      this.scene.add(m);
      return { x: p.x, z: p.z, up: true, model: m };
    });

    // canhão de cada base; `to` = onde ele deixa o herói agora (null sem torre da ponte de pé)
    this.cannons = [0, 1].map((team) => {
      const p = cannonPos(team);
      const model = new CannonModel(team);
      model.root.position.set(p.x, 0, p.z);
      this.scene.add(model.root);
      const layout = structLayout(team);
      return { team, x: p.x, z: p.z, model, to: null, towers: MAP.cannon.to.map((k) => layout.find((d) => d.key === k)) };
    });
    this.shots = [];
    this.cannonHint = null;

    this.units = new Map();
    this.roster = new Map();
    this.board = new Map();
    this.transport = null;
    this.myId = 0;
    this.meState = null;
    this.phase = 'idle';
    this.phaseT = 0;
    this.gameTime = 0;
    this.kills = [0, 0];
    this.waveIn = 0;
    this.snapT = 0;
    this.snapRecv = 0;
    this.snapLt = 0;
    this.time = 0;
    this.cam = { x: 0, z: 0, h: 26, zoom: 26, locked: false };
    // preferências do menu de configurações (o main.js preenche com o que está salvo)
    this.castMode = 'release';
    // esquema de controle: 'click' (o botão direito anda) ou 'wasd' (as teclas andam, o botão esquerdo ataca)
    this.input = 'click';
    this.camSpeed = 1;
    this.inputBlocked = false;
    this.keys = { ...DEFAULT_KEYS };
    this.codeAction = {};
    this.camSnap = false;
    this.lastEsc = 0;
    this.shake = 0;
    this.targetId = 0;
    this.mouse = { x: 0, y: 0, wx: 0, wz: 0, inside: false, out: null };
    this.rightHeld = false;
    this.rightT = 0;
    // WASD: teclas de andar seguradas, última direção mandada, botão esquerdo segurado e botão de espiar
    this.moveKeys = new Set();
    this.dirSent = '';
    this.leftHeld = false;
    this.leftT = 0;
    this.peekHeld = false;
    this.aiming = null;
    this.amove = false;
    this.hoverId = 0;
    this.spaceHeld = false;
    this.aimHeld = false;
    this.aimForced = false;
    this.paused = false;
    this.onPhase = null;
    this.onEnd = null;
    this.onNetError = null;
    this.onRoom = null;
    this.room = null;
    this.onPause = null;

    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  get online() {
    return !!this.transport && !this.transport.local;
  }

  get me() {
    return this.units.get(this.myId) || null;
  }

  get myTeam() {
    return this.roster.get(this.myId)?.team ?? 0;
  }

  get flip() {
    return this.myTeam === 1 ? -1 : 1;
  }

  get playing() {
    return this.phase === 'playing' && !!this.me && !this.paused;
  }

  get wasd() {
    return this.input === 'wasd';
  }

  // Shift + clique escolhe só heróis; no WASD o Shift é habilidade
  get heroesOnly() {
    return this.shiftHeld && !this.wasd;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.overlay.resize(w, h);
  }

  // ---------- conexão ----------

  // `hello` troca a mensagem de entrada (online: criar sala ou entrar numa pelo código)
  connect(transport, { name = 'Jogador', spectator = false, hello = null } = {}) {
    this.disconnect();
    this.transport = transport;
    this.spectator = spectator;
    setMuted(spectator);
    transport.onMessage((m) => this.onNet(m));
    if (!spectator) transport.send(hello ? { ...hello, name } : { t: 'join', name });
    else if (transport.sim) transport.sim.startGame();
  }

  disconnect() {
    if (this.transport) this.transport.close();
    this.transport = null;
    this.room = null;
    this.resetMatch();
  }

  // esquece a partida mas mantém a conexão (online: a sala voltou pro saguão)
  resetMatch() {
    for (const u of this.units.values()) this.dropModel(u);
    this.units.clear();
    this.roster.clear();
    this.board.clear();
    for (const p of [...this.effects.projs.keys()]) this.effects.endProj({ id: p });
    for (const z of [...this.effects.zones.keys()]) this.effects.endZone(z);
    this.myId = 0;
    this.meState = null;
    this.phase = 'idle';
    this.kills = [0, 0];
    this.aiming = null;
    this.amove = false;
    this.shots = [];
    this.cannonAim = null;
    this.paused = false;
    this.toggleShop(false);
    this.hud.show(false);
    this.canvas.style.filter = '';
  }

  send(msg) {
    this.transport?.send(msg);
  }

  // ---------- rede ----------

  onNet(m) {
    switch (m.e) {
      case 'welcome':
        this.myId = m.id;
        for (const u of this.units.values()) if (u.kind === 'hero') u.modelKey = '';
        break;
      case 'roster':
        this.roster.clear();
        for (const [id, team, name, isBot, heroIdx, sp] of m.l) this.roster.set(id, { team, name, isBot: !!isBot, heroIdx, spells: sp ? { d: sp[0], f: sp[1] } : null });
        for (const u of this.units.values()) {
          const r = this.roster.get(u.id);
          if (r) u.name = r.name;
        }
        break;
      case 'phase':
        this.setPhase(m.ph);
        break;
      case 'snap':
        this.applySnap(m);
        break;
      case 'me':
        this.meState = m;
        break;
      case 'board':
        this.board.clear();
        for (const row of m.l) this.board.set(row[0], row);
        break;
      case 'pj':
      {
        const owner = this.units.get(m.o);
        const st = this.styleOf(m.o);
        this.effects.addProj(m, projShape(st, m), st.el);
        if (m.k === 'a') owner?.model?.strike?.(-0.45);
        if (st.muzzle && owner && m.k !== 't') {
          // o tiro pode ir teleguiado: a boca do cano aponta pro alvo
          let dx = m.dx;
          let dz = m.dz;
          const tg = m.h && this.units.get(m.h);
          if (tg) {
            const d = Math.hypot(tg.x - m.x, tg.z - m.z) || 1;
            dx = (tg.x - m.x) / d;
            dz = (tg.z - m.z) / d;
          }
          if (dx || dz) this.effects.muzzle(m.x, 1.3, m.z, dx, dz, m.c);
        }
        if (!this.spectator || this.near(m.x, m.z)) {
          if (m.k === 't') playSound('tower', { x: m.x, z: m.z });
          else if (m.k === 's') playSound(st.snd.cast || 'zap', { x: m.x, z: m.z });
          else if (owner?.kind === 'hero') playSound(st.snd.shoot || 'shoot', { x: m.x, z: m.z });
        }
        break;
      }
      case 'pjx':
        this.effects.endProj(m);
        break;
      case 'hit':
        this.onHit(m);
        break;
      case 'heal': {
        const v = this.units.get(m.v);
        if (v && (v.team === this.myTeam || v.id === this.myId)) this.overlay.float(v.x, 2.6, v.z, `+${m.d}`, '#5ee67a', 17);
        if (v && m.d >= 8 && this.near(v.x, v.z)) this.effects.healFx(v.x, v.z, v.heroId === 'iara');
        break;
      }
      case 'gold':
        this.overlay.float(m.x, 2.2, m.z, `+${m.d}`, '#f4c430', 16, 1.1, 40);
        playSound('gold');
        break;
      case 'kill':
        this.onKill(m);
        break;
      case 'ann':
        this.hud.announce(m.t, m.s, m.tm >= 0 ? (m.tm === this.myTeam ? '#4aa3ff' : '#f43f5e') : '#f4c430', m.k === 'penta');
        playSound(m.k === 'start' ? 'horn' : /^(multi\d|penta)$/.test(m.k) ? m.k : 'announce');
        break;
      case 'cast':
        this.onCast(m);
        break;
      case 'aoe':
        this.effects.telegraph(m.x, m.z, m.r, m.t, m.c, m.tm !== this.myTeam, this.styleOf(m.o).el);
        break;
      case 'boom':
      {
        const st = this.styleOf(m.o);
        this.effects.boom(m.x, m.z, m.r, m.c, !!m.al, st.el);
        playSound(m.al ? st.snd.heal || 'heal' : m.r >= 2 ? st.snd.boom || (m.r >= 2.5 ? 'boom' : 'thud') : st.snd.hit || 'thud', { x: m.x, z: m.z });
        break;
      }
      case 'cone':
      {
        const st = this.styleOf(m.id);
        this.effects.cone(m.x, m.z, m.a, m.r, m.w, m.c, st.el);
        playSound(st.snd.boom || 'swing', { x: m.x, z: m.z });
        break;
      }
      case 'zone':
      {
        const st = this.styleOf(m.o);
        this.effects.addZone(m, st.el);
        playSound(st.snd.boom || 'boom', { x: m.x, z: m.z });
        if (st.el === 'ember') playSound('crackle', { x: m.x, z: m.z });
      }
        break;
      case 'mark':
        this.effects.mark(m);
        this.units.get(m.id)?.model?.startHole?.(m.t);
        break;
      case 'zonex':
        this.effects.endZone(m.id);
        break;
      case 'emp': {
        const u = this.units.get(m.id);
        if (!u) break;
        this.effects.furyBurst(u.x, u.z);
        playSound('fury', u);
        if (m.id === this.myId || this.near(u.x, u.z)) this.overlay.float(u.x, 3.2, u.z, 'FÚRIA!', '#ef4444', 20, 0.9, 40);
        break;
      }
      case 'bite': {
        const a = this.units.get(m.id);
        const v = this.units.get(m.v);
        if (!a || !v) break;
        const dir = Math.atan2(v.z - a.z, v.x - a.x);
        this.effects.bite(v.x, v.z, dir, m.n, !!m.emp);
        a.model?.strike?.(1.4);
        for (let i = 0; i < m.n; i++) setTimeout(() => playSound('chomp', v, 0.9), i * 120);
        if (m.id === this.myId) this.shake = Math.max(this.shake, m.emp ? 0.45 : 0.3);
        break;
      }
      case 'blink': {
        // teleporte é instantâneo: esquece as posições antigas, senão o herói desliza até o destino como num avanço
        const u = this.units.get(m.id);
        if (u) {
          u.samples = [];
          u.x = m.b[0];
          u.z = m.b[1];
        }
        // teleporte longo (a volta pra base): a câmera pula junto, mesmo solta
        if (m.id === this.myId && Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) > 25) this.camSnap = true;
        if (m.fl) {
          this.effects.flash(m.a, m.b, m.c);
          playSound('flash', { x: m.b[0], z: m.b[1] });
        } else {
          this.effects.blink(m.a, m.b, m.c, this.styleOf(m.id).el);
          playSound('blink', { x: m.b[0], z: m.b[1] });
        }
        break;
      }
      case 'dash': {
        const u = this.units.get(m.id);
        u?.model?.startDash?.(m.d, m.a);
        if (u) {
          const st = this.styleOf(m.id);
          if (st.el !== 'neutral') this.effects.trail(m.id, m.d, st.el, m.c);
          playSound('dash', u);
          if (st.snd.cast) playSound(st.snd.cast, u, 0.6);
        }
        break;
      }
      case 'buff': {
        const u = this.units.get(m.id);
        if (u) {
          const st = this.styleOf(m.id);
          this.effects.buffFx(u.x, u.z, m.c, st.el);
          if (u.heroId === 'cuca' && m.s === 'r') {
            this.effects.transform(u.x, u.z);
            playSound('roar', u);
            if (m.id === this.myId || this.near(u.x, u.z)) this.shake = Math.max(this.shake, 0.5);
          } else playSound('shield', u);
          if (st.el === 'wind') playSound('gust', u, 0.7);
          else if (st.el === 'thorn') playSound('bash', u, 0.6);
        }
        break;
      }
      case 'ping': {
        this.effects.ping(m.x, m.z);
        this.pings.push({ x: m.x, z: m.z, t: PING_LIFE });
        playSound('ping');
        break;
      }
      case 'laser': {
        const v = this.units.get(m.v);
        if (v) {
          const fx = m.tm === 0 ? -MAP.fountainX : MAP.fountainX;
          this.effects.laser(new THREE.Vector3(fx, 2.6, 0), new THREE.Vector3(v.x, 1.2, v.z), TEAMS[m.tm].color);
          playSound('laser', v);
        }
        break;
      }
      case 'cannon': {
        // entrou no cano: some lá dentro; se for eu, a câmera abre pra escolher onde cair
        const u = this.units.get(m.id);
        if (!u) break;
        u.model?.startFly?.(m.a + MAP.cannon.load, MAP.cannon.flight);
        if (m.id === this.myId) {
          this.cannonAim = { cx: m.x, cz: m.z, x: m.x, z: m.z, t: m.a, age: 0 };
          this.aiming = null;
          this.amove = false;
          this.toggleShop(false);
          playSound('click');
        }
        break;
      }
      case 'shot': {
        const u = this.units.get(m.id);
        if (!u) break;
        const c = this.cannons[u.team];
        c.model.charge(m.l, m.x - c.x, m.z - c.z);
        u.model?.startFly?.(m.l, m.d);
        this.shots.push({ t: m.l, c, id: m.id, x: m.x, z: m.z });
        this.effects.telegraph(m.x, m.z, MAP.cannon.radius, m.l + m.d, TEAMS[u.team].color, u.team !== this.myTeam);
        if (m.id === this.myId) this.cannonAim = null;
        if (m.id === this.myId || this.near(c.x, c.z)) playSound('sizzle', c);
        break;
      }
      case 'land': {
        const u = this.units.get(m.id);
        this.effects.cannonLand(m.x, m.z, m.r, TEAMS[u?.team ?? 0].color);
        if (m.id === this.myId || this.near(m.x, m.z)) {
          playSound('boom', { x: m.x, z: m.z });
          playSound('crash', { x: m.x, z: m.z }, 0.6);
          this.shake = Math.max(this.shake, m.id === this.myId ? 0.6 : 0.3);
        }
        break;
      }
      case 'rank':
        playSound('level');
        this.hud.flashSkill(m.s);
        break;
      case 'xp':
        this.overlay.float(m.x, 1.6, m.z, `+${m.v} xp`, '#c4b5fd', 14, 1.0, 34);
        break;
      case 'reset': {
        // habilidade devolvida por abate: aviso em cima do herói
        const u = this.units.get(m.id);
        if (u) this.overlay.float(u.x, 2.6, u.z, 'Recarga zerada!', '#fde047', 18, 1.3, 44);
        if (m.id === this.myId) playSound('level');
        break;
      }
      case 'lvl': {
        const u = this.units.get(m.id);
        if (u) this.effects.levelUp(u.x, u.z);
        if (m.id === this.myId) playSound('level');
        break;
      }
      case 'pack':
        if (this.packs[m.i]) this.packs[m.i].up = !!m.u;
        if (!m.u) {
          const p = this.packs[m.i];
          if (p) this.effects.burst(p.x, 1, p.z, '#4ade80', 16, 4);
          if (m.id === this.myId) playSound('pack');
        }
        break;
      case 'struct': {
        const u = this.units.get(m.id);
        if (u && m.d) {
          this.effects.boom(u.x, u.z, 5, TEAMS[u.team].color);
          this.effects.burst(u.x, 4, u.z, '#a8a29e', 40, 9, 0.35, 1.2);
          playSound('crash', u);
        }
        break;
      }
      case 'swing': {
        const u = this.units.get(m.id);
        if (!u) break;
        u.model?.swing?.((m.w || 140) / 1000);
        if (!m.r && this.near(u.x, u.z)) playSound(this.styleOf(m.id).snd.swing || 'swing', u);
        break;
      }
      case 'cancel':
        this.units.get(m.id)?.model?.interrupt?.(!!m.a);
        break;
      case 'spawn':
        if (m.id === this.myId) this.camSnap = true;
        if (m.id === this.myId) playSound('heal');
        break;
      case 'bought':
        playSound('buy');
        break;
      case 'use': {
        const u = this.units.get(m.id);
        const act = ITEMS[m.i]?.active;
        if (u && act) {
          this.effects.buffFx(u.x, u.z, act.color || '#e8c170', this.styleOf(m.id).el);
          playSound('shield', u);
        }
        break;
      }
      case 'end':
        this.onMatchEnd(m);
        break;
      case 'room': {
        const was = this.room?.state;
        this.room = m;
        if (m.state === 'lobby' && was === 'match') this.resetMatch();
        this.onRoom?.(m);
        break;
      }
      case 'disconnect':
      case 'error':
      case 'full':
      case 'noroom':
      case 'busy':
        if (!this.transport?.local) this.onNetError?.(m.e);
        break;
      default:
        break;
    }
  }

  setPhase(ph) {
    const prev = this.phase;
    if (ph === prev) return;
    this.phase = ph;
    if (ph === 'playing' && !this.spectator) {
      this.camSnap = true;
      // herói novo na simulação: quem já segura a tecla de andar sai andando
      this.dirSent = '';
      if (this.wasd) this.sendDir();
      playSound('horn');
      // como num ARAM: a partida abre com a loja na sua frente
      setTimeout(() => this.phase === 'playing' && this.meState?.sh && this.gameTime < 20 && !this.transport?.sandbox && this.toggleShop(true), 300);
    }
    if (ph === 'draft') {
      this.kills = [0, 0];
      this.toggleShop(false);
      this.setPaused(false);
    }
    this.onPhase?.(ph, prev);
  }

  near(x, z) {
    return Math.hypot(x - this.cam.x, z - this.cam.z) < 45;
  }

  applySnap(s) {
    this.snapT = s.t;
    this.snapRecv = performance.now() / 1000;
    this.snapLt = s.lt ?? 0;
    this.setPhase(s.ph);
    this.phaseT = s.pt;
    this.gameTime = s.gt;
    this.kills = s.k;
    this.waveIn = s.wv;
    const seen = new Set();
    for (const a of s.u) {
      const [id, kc, team, x, z, f, hp, maxHp, flags, shield, heroIdx, level, respawn] = a;
      seen.add(id);
      let u = this.units.get(id);
      if (!u) {
        u = { id, kind: KIND_NAMES[kc], team, samples: [], x, z, facing: f, model: null, modelKey: '', name: this.roster.get(id)?.name || '' };
        this.units.set(id, u);
      }
      const last = u.samples[u.samples.length - 1];
      if (last && last.t === s.t) {
        last.x = x;
        last.z = z;
        last.f = f;
      }
      else u.samples.push({ t: s.t, x, z, f });
      if (u.samples.length > 12) u.samples.shift();
      if (u.kind === 'hero' && u.alive === true && !(flags & F.alive)) u.samples = [{ t: s.t, x, z, f }];
      if (u.kind === 'hero' && last && Math.hypot(last.x - x, last.z - z) > 15) u.samples = [{ t: s.t, x, z, f }];
      u.hp = hp;
      u.maxHp = maxHp;
      u.flags = flags;
      u.alive = !!(flags & F.alive);
      u.shield = shield;
      u.level = level;
      u.respawn = respawn;
      if (u.kind === 'hero') {
        u.heroId = HERO_ORDER[heroIdx];
        u.def = HEROES[u.heroId];
        u.r = 0.65;
      }
      u.gone = false;
    }
    for (const u of this.units.values()) {
      if (!seen.has(u.id) && !u.gone) {
        u.gone = true;
        u.alive = false;
      }
    }
    if (s.pk) s.pk.forEach((v, i) => this.packs[i] && (this.packs[i].up = !!v));
  }

  renderTime() {
    if (this.transport?.local) return this.snapT + this.snapLt - STEP;
    const now = performance.now() / 1000;
    return this.snapT + Math.min(0.25, now - this.snapRecv) - this.transport.interpDelay;
  }

  interpolate(u, rt) {
    const s = u.samples;
    if (!s.length) return;
    if (rt >= s[s.length - 1].t || s.length === 1) {
      const l = s[s.length - 1];
      u.x = l.x;
      u.z = l.z;
      u.facing = l.f;
      return;
    }
    for (let i = s.length - 2; i >= 0; i--) {
      const a = s[i];
      if (a.t <= rt) {
        const b = s[i + 1];
        const k = (rt - a.t) / Math.max(0.0001, b.t - a.t);
        u.x = a.x + (b.x - a.x) * k;
        u.z = a.z + (b.z - a.z) * k;
        u.facing = lerpAngle(a.f, b.f, k);
        return;
      }
    }
    u.x = s[0].x;
    u.z = s[0].z;
    u.facing = s[0].f;
  }

  ensureModel(u) {
    let key = u.kind;
    if (u.kind === 'hero') key = `${u.heroId}:${u.id === this.myId ? 1 : 0}:${u.team}`;
    if (u.modelKey === key && u.model) return;
    this.dropModel(u);
    u.modelKey = key;
    if (u.kind === 'hero') u.model = new HeroModel(u.def, u.team, u.id === this.myId);
    else if (STRUCT.has(u.kind)) u.model = new StructModel(u.kind, u.team);
    else u.model = new MinionModel(u.kind, u.team);
    this.scene.add(u.model.root);
  }

  dropModel(u) {
    if (!u.model) return;
    this.scene.remove(u.model.root);
    u.model.dispose?.();
    u.model = null;
  }

  onHit(m) {
    const v = this.units.get(m.v);
    if (!v) return;
    const a = this.units.get(m.a);
    const mine = m.a === this.myId;
    const onMe = m.v === this.myId;
    if (mine && !onMe) this.onDamage?.(m.d);
    if (m.au && a && (mine || onMe || this.near(v.x, v.z))) {
      let dx = v.x - a.x;
      let dz = v.z - a.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      const heroHit = a.kind === 'hero';
      const struct = STRUCT.has(v.kind);
      const melee = heroHit ? !a.def?.ranged : a.kind === 'melee' || a.kind === 'super';
      const power = heroHit ? 1 : 0.5;
      v.model?.hit?.(dx, dz, struct ? 0 : heroHit ? 0.42 : 0.16);
      const y = struct ? 2.2 : v.kind === 'hero' ? 1.3 : 0.8;
      const back = struct ? (v.kind === 'core' ? 3 : 1.8) : 0.35;
      this.effects.impact(v.x - dx * back, y, v.z - dz * back, dx, dz, a.def?.color || (a.team === 0 ? '#7cc4ff' : '#ff7a8a'), power, melee && heroHit, heroHit ? fxOf(a.heroId) : null);
      if (heroHit) {
        if (melee) a.model?.strike?.(1);
        playSound(fxOf(a.heroId).snd.hit || (melee ? 'punch' : 'pop'), mine ? null : v, mine ? 0.8 : 0.7);
        if (mine) this.shake = Math.max(this.shake, melee ? 0.22 : 0.1);
      }
      if (onMe) this.shake = Math.max(this.shake, heroHit || a.kind === 'tower' ? 0.3 : 0.1);
    } else {
      v.model?.hit?.();
      if (onMe && m.d > 40) this.shake = Math.max(this.shake, 0.25);
    }
    if (m.a === this.myId && m.v !== this.myId) {
      if (m.cr) this.overlay.float(v.x, 2.9, v.z, `${m.d}!`, '#ffd23f', 30, 1.0, 54);
      else this.overlay.damage(v.x, v.z, m.d, m.k, true);
    } else if (m.v === this.myId && m.d >= 1) {
      this.overlay.damage(v.x, v.z, m.d, m.k, false);
    } else if (v.kind === 'hero' && this.spectator && m.d > 40) {
      this.overlay.damage(v.x, v.z, m.d, m.k, true);
    }
  }

  nameOf(id, kk) {
    const r = this.roster.get(id);
    if (r) {
      const color = r.team === this.myTeam ? '#7cc4ff' : '#ff8a9c';
      return `<b style="color:${color}">${esc(r.name)}</b>`;
    }
    if (kk === 5) return '<b>Torre</b>';
    if (kk === -1) return '<b>Fonte</b>';
    return '<b>Tropa</b>';
  }

  onKill(m) {
    const killerHero = this.roster.get(m.k)?.heroIdx;
    const victimHero = this.roster.get(m.v)?.heroIdx;
    const kh = killerHero !== undefined ? HEROES[HERO_ORDER[killerHero]] : null;
    const vh = victimHero !== undefined ? HEROES[HERO_ORDER[victimHero]] : null;
    const assists = m.as?.length ? `<small>+${m.as.length}</small>` : '';
    this.hud.feed(
      `${kh ? `<span class="kf-hero" style="--c:${kh.color}">${kh.name[0]}</span>` : ''}${this.nameOf(m.k, m.kk)}${assists}<span class="kf-x">✕</span>${vh ? `<span class="kf-hero" style="--c:${vh.color}">${vh.name[0]}</span>` : ''}${this.nameOf(m.v)}`,
    );
    const v = this.units.get(m.v);
    if (m.v === this.myId) playSound('death');
    else if (m.k === this.myId || m.as?.includes(this.myId)) {
      playSound('kill');
      if (v) this.overlay.float(v.x, 3.6, v.z, m.k === this.myId ? 'ABATE!' : 'ASSISTÊNCIA', '#f4c430', 22, 1.4, 60);
    }
  }

  onCast(m) {
    const u = this.units.get(m.id);
    if (!u) return;
    const spells = this.roster.get(u.id)?.spells;
    const cab = u.def && abilityOf(u.heroId, m.s, spells);
    if (cab) u.model?.cast?.(m.s, cab, m.ct);
    if (m.ct >= 0.6 && u.def) {
      const ab = abilityOf(u.heroId, m.s, spells);
      playSound('channel', u);
      const dx = m.x - u.x;
      const dz = m.z - u.z;
      const d = Math.hypot(dx, dz) || 1;
      const len = ab?.range || 20;
      const geo = new THREE.PlaneGeometry(0.25, len);
      geo.translate(0, len / 2, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: u.team === this.myTeam ? ab.color : '#ff4d6d', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -Math.atan2(dz / d, dx / d) - Math.PI / 2;
      mesh.position.set(u.x, 0.15, u.z);
      this.effects.temp(mesh, m.ct, (k) => {
        mesh.material.opacity = 0.25 + (1 - k) * 0.6;
        if (k <= 0) geo.dispose();
      });
    } else if (m.s !== 'd' && m.s !== 'f') {
      // projétil já toca o próprio som ao sair
      if (cab?.kind !== 'proj') playSound(fxOf(u.heroId).snd.cast || 'cast', u);
    }
  }

  // estilo visual de quem causou o efeito (só heróis têm; o resto cai no neutro)
  styleOf(id) {
    const u = this.units.get(id);
    return fxOf(u?.kind === 'hero' ? u.heroId : null);
  }

  onMatchEnd(m) {
    this.toggleShop(false);
    this.aiming = null;
    if (!this.spectator) playSound(m.w === this.myTeam ? 'win' : 'lose');
    this.gameTime = m.t ?? this.gameTime;
    this.kills = m.k ?? this.kills;
    this.onEnd?.(m.w, m.next);
  }

  // ---------- ações do jogador ----------

  buy(id) {
    if (!this.meState?.sh) {
      playSound('error');
      return;
    }
    this.send({ t: 'buy', i: id });
  }

  sell(n) {
    if (!this.meState?.sh) {
      playSound('error');
      return;
    }
    this.send({ t: 'sell', n });
    playSound('gold');
  }

  pick(heroId, quiet = false) {
    this.send({ t: 'pick', h: heroId });
    if (!quiet) playSound('click');
  }

  pickRandom() {
    this.send({ t: 'rr' });
    playSound('click');
  }

  setSpell(slot, id, quiet = false) {
    this.send({ t: 'spell', s: slot, v: id });
    if (!quiet) playSound('click');
  }

  get mySpells() {
    return this.roster.get(this.myId)?.spells || null;
  }

  ready() {
    this.send({ t: 'go' });
    playSound('click');
  }

  toggleShop(force) {
    const el = document.getElementById('shop');
    const open = force ?? el.classList.contains('hidden');
    if (open && (this.phase !== 'playing' || this.spectator)) return;
    el.classList.toggle('hidden', !open);
    if (open) {
      this.hud.shopKey = '';
      this.hud.updateShop();
    }
  }

  // contra bots o jogo para de verdade; online só abre o menu
  setPaused(p) {
    if (this.paused === p) return;
    this.paused = p;
    if (this.transport?.local) this.transport.paused = p;
    this.onPause?.(p, this.online);
  }

  refreshMouse() {
    const p = this.groundAt(this.mouse.x, this.mouse.y, _v);
    if (p) {
      this.mouse.wx = p.x;
      this.mouse.wz = p.z;
    }
  }

  // troca os atalhos: `keys` é ação -> tecla (ver src/keys.js)
  setKeys(keys) {
    this.keys = { ...keys };
    this.codeAction = {};
    for (const [action, code] of Object.entries(this.keys)) if (code) this.codeAction[code] = action;
    this.hud.heroId = null;
    const hint = document.querySelector('#cam-hint kbd');
    if (hint) hint.textContent = this.keyLabel('cam');
    const close = document.getElementById('shop-close');
    if (close) close.title = `Fechar (${this.keyLabel('shop')})`;
  }

  keyLabel(action, short = false) {
    if (action === 'evolve') return this.wasd ? 'Ctrl' : 'Shift';
    return keyName(this.keys[action], short);
  }

  // troca o esquema de controle, já com os atalhos dele; saindo do WASD, o herói para de seguir as teclas
  setInput(input, keys) {
    if (this.wasd && input !== 'wasd') {
      this.moveKeys.clear();
      this.sendDir();
    }
    this.input = input;
    this.leftHeld = false;
    this.peekHeld = false;
    this.setKeys(keys);
  }

  // WASD: manda a direção das teclas seguradas, já girada pro lado da tela (o time vermelho vê o mapa invertido)
  sendDir() {
    const k = this.moveKeys;
    let x = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    let z = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    const d = Math.hypot(x, z) || 1;
    x = Math.round(((x * this.flip) / d) * 100) / 100 || 0;
    z = Math.round(((z * this.flip) / d) * 100) / 100 || 0;
    const key = `${x},${z}`;
    if (key === this.dirSent || this.spectator || this.phase === 'idle') return;
    this.dirSent = key;
    this.send({ t: 'dr', x, z });
  }

  castSlot(slot) {
    const me = this.me;
    if (!me) return;
    this.refreshMouse();
    this.send({ t: 'c', s: slot, x: Math.round(this.mouse.wx * 10) / 10, z: Math.round(this.mouse.wz * 10) / 10, id: this.hoverId || 0 });
  }

  // usa o item do espaço `n` do inventário (a estátua da Carranca e os itens de suporte)
  useItem(n) {
    const st = this.meState;
    if (!this.playing || !st) return;
    const act = ITEMS[st.it[n]]?.active;
    if (!act) return;
    if (!this.me?.alive || st.ic?.[n] > 0) {
      this.hud.flashItem(n);
      playSound('error');
      return;
    }
    this.send({ t: 'use', n });
  }

  rankUp(slot) {
    if (this.phase !== 'playing' || !this.meState) return;
    const st = this.meState;
    const ranks = { q: st.rk[0], w: st.rk[1], e: st.rk[2], r: st.rk[3] };
    if (!canRankUp(st.lv, ranks, slot)) {
      this.hud.flashSkill(slot);
      playSound('error');
      return;
    }
    this.send({ t: 'up', s: slot });
  }

  pressSlot(slot) {
    if (!this.playing || !this.meState) return;
    const st = this.meState;
    const i = SLOTS.indexOf(slot);
    const me = this.me;
    if (!me.alive || st.cd[i] > 0 || (i < 4 && !(st.rk[i] > 0))) {
      this.hud.flashSkill(slot);
      playSound('error');
      return;
    }
    const ab = abilityOf(me.heroId, slot, this.mySpells);
    // 'instant': lança na hora onde o mouse está · 'release': mira segurando e lança ao soltar ·
    // 'click': a tecla só mostra a mira, o clique esquerdo lança e o direito cancela
    // Com a tecla de mostrar o alcance segurada, vale sempre o 'click', seja qual for o modo escolhido
    if (ab.kind === 'self' || (this.castMode === 'instant' && !this.aimHeld)) {
      this.aiming = null;
      this.castSlot(slot);
      return;
    }
    this.aiming = slot;
    this.aimForced = this.aimHeld;
    this.amove = false;
  }

  releaseSlot(slot) {
    if (this.aiming !== slot || this.castMode === 'click' || this.aimForced) return;
    this.aiming = null;
    this.castSlot(slot);
  }

  // dentro do canhão, qualquer clique confirma a queda onde a mira está
  fireCannon() {
    const a = this.cannonAim;
    this.send({ t: 'cn', x: Math.round(a.x * 10) / 10, z: Math.round(a.z * 10) / 10 });
    this.rightTarget = true;
  }

  rightClick() {
    if (!this.playing) return;
    if (this.cannonAim) return this.fireCannon();
    if (this.aiming) {
      this.aiming = null;
      return;
    }
    this.amove = false;
    this.refreshMouse();
    this.hoverId = this.pickUnit(this.heroesOnly);
    const t = this.hoverId ? this.units.get(this.hoverId) : null;
    const cn = this.overCannon();
    if (t && t.team !== this.myTeam && t.alive && !(t.flags & F.invuln)) {
      this.send({ t: 'at', id: t.id });
      this.effects.clickMarker(t.x, t.z, true);
      this.rightTarget = true;
      this.targetId = t.id;
      playSound('click');
    } else if (cn?.to) {
      // andar até o canhão é a ordem de entrar nele (a simulação resolve)
      this.targetId = 0;
      this.send({ t: 'mv', x: cn.x, z: cn.z });
      this.effects.clickMarker(cn.x, cn.z, false);
      this.rightTarget = true;
      playSound('click');
    } else {
      this.targetId = 0;
      this.send({ t: 'mv', x: Math.round(this.mouse.wx * 10) / 10, z: Math.round(this.mouse.wz * 10) / 10 });
      this.effects.clickMarker(this.mouse.wx, this.mouse.wz, false);
      this.rightTarget = false;
    }
    this.rightT = 0.12;
  }

  leftClick() {
    if (!this.playing) return;
    if (this.cannonAim) return this.fireCannon();
    if (this.aiming) {
      const s = this.aiming;
      this.aiming = null;
      this.castSlot(s);
      return;
    }
    if (this.amove) {
      this.amove = false;
      this.refreshMouse();
      this.send(this.heroesOnly ? { t: 'am', x: this.mouse.wx, z: this.mouse.wz, h: 1 } : { t: 'am', x: this.mouse.wx, z: this.mouse.wz });
      this.effects.clickMarker(this.mouse.wx, this.mouse.wz, true);
      return;
    }
    if (this.wasd) {
      this.leftHeld = true;
      this.leftT = 0.15;
      this.attackClick(false);
    }
  }

  // WASD: o botão esquerdo ataca quem está embaixo do mouse ou, no chão, o inimigo mais perto dele; no canhão da base, entra.
  // Segurando o botão, o ataque se repete (`again`), sem marcador nem som
  attackClick(again) {
    this.refreshMouse();
    const t = this.attackPick();
    if (t) {
      this.send({ t: 'at', id: t.id });
      this.targetId = t.id;
      if (!again) {
        this.effects.clickMarker(t.x, t.z, true);
        playSound('click');
      }
      return;
    }
    const cn = again ? null : this.overCannon();
    if (cn?.to) {
      this.targetId = 0;
      this.send({ t: 'mv', x: cn.x, z: cn.z });
      this.effects.clickMarker(cn.x, cn.z, false);
      playSound('click');
    }
  }

  attackPick() {
    const hover = this.units.get(this.pickUnit());
    if (hover && hover.team !== this.myTeam && hover.alive && !(hover.flags & F.invuln)) return hover;
    let best = null;
    let bestD = 2.5;
    for (const u of this.units.values()) {
      if (!u.alive || u.team === this.myTeam || u.flags & (F.invuln | F.fly)) continue;
      const d = Math.hypot(u.x - this.mouse.wx, u.z - this.mouse.wz) - (u.kind === 'hero' ? 0.6 : 0);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  // o canhão do meu time, se o mouse estiver em cima dele
  overCannon() {
    if (this.spectator || this.phase !== 'playing') return null;
    const c = this.cannons[this.myTeam];
    return Math.hypot(this.mouse.wx - c.x, this.mouse.wz - c.z) <= MAP.cannon.r ? c : null;
  }

  // mira dos canhões, pavio de quem está no cano e o disparo na hora certa
  updateCannons(dt) {
    for (const c of this.cannons) {
      c.to = null;
      for (const d of c.towers) {
        let up = false;
        for (const u of this.units.values()) if (u.kind === 'tower' && u.alive && u.team === c.team && Math.abs(u.x - d.x) < 0.5 && Math.abs(u.z - d.z) < 0.5) up = true;
        if (!up) continue;
        c.to = [d.x - pushDir(c.team) * MAP.cannon.back, 0];
        break;
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const m = s.c.model;
      s.t -= dt;
      if (s.t > 0) {
        if (dt > 0) {
          m.fuse.getWorldPosition(_v);
          this.effects.fuseSparks(_v.x, _v.y, _v.z);
        }
        continue;
      }
      this.shots.splice(i, 1);
      m.kick();
      m.mouth.getWorldPosition(_v);
      const d = Math.hypot(s.x - s.c.x, s.z - s.c.z) || 1;
      this.effects.cannonShot(_v.x, _v.y, _v.z, (s.x - s.c.x) / d, (s.z - s.c.z) / d, s.c.x, s.c.z, TEAMS[s.c.team].color);
      if (s.id === this.myId || this.near(s.c.x, s.c.z)) {
        playSound('blast', s.c);
        playSound('boom', s.c, 0.8);
        playSound('whistle', s.c, 0.6);
        this.shake = Math.max(this.shake, s.id === this.myId ? 0.55 : 0.3);
      }
    }
    const over = this.overCannon();
    const hover = over && !(this.units.get(this.hoverId)?.team !== this.myTeam && this.hoverId) ? over : null;
    this.cannonHint = hover ? { x: hover.x, z: hover.z, on: !!hover.to, text: hover.to ? `Canhão · botão ${this.wasd ? 'esquerdo' : 'direito'} pra entrar e escolher onde cair` : 'Canhão sem torre pra mirar' } : null;
    const a = this.cannonAim;
    const me = this.me;
    if (a) {
      a.age += dt;
      a.t -= dt;
      // saí do cano sem atirar (desisti ou a partida acabou): fecha a mira
      if (!me?.alive || this.phase !== 'playing' || (a.age > 0.4 && !(me.flags & F.fly))) this.cannonAim = null;
    }
    if (this.cannonAim) {
      // a mira segue o mouse, presa ao alcance; o cano acompanha
      let dx = this.mouse.wx - a.cx;
      let dz = this.mouse.wz - a.cz;
      const d = Math.hypot(dx, dz);
      const k = d > MAP.cannon.range ? MAP.cannon.range / d : 1;
      a.x = a.cx + dx * k;
      a.z = a.cz + dz * k;
      const c = this.cannons[this.myTeam];
      c.model.yaw = Math.atan2(a.z - c.z, a.x - c.x);
      this.cannonHint = { x: a.cx, z: a.cz - this.flip * (MAP.cannon.range + MAP.cannon.radius + 1.5), on: true, text: `Clique onde quer cair · ${Math.max(0, a.t).toFixed(1)} s · ${this.keyLabel('stop')} desiste` };
    }
    this.effects.showCannonAim(this.cannonAim, this.time);
    for (const c of this.cannons) c.model.update(dt, this.time, !!c.to, c === hover || (!!this.cannonAim && c.team === this.myTeam));
  }

  // Esc: fecha a loja, cancela a mira ou pausa (também chamado quando o Esc solta o mouse)
  escape() {
    const now = performance.now();
    if (now - this.lastEsc < 200) return;
    this.lastEsc = now;
    if (!document.getElementById('shop').classList.contains('hidden')) this.toggleShop(false);
    else if (this.cannonAim) this.send({ t: 'st' });
    else if (this.aiming || this.amove) {
      this.aiming = null;
      this.amove = false;
    } else if (this.phase === 'playing') this.setPaused(!this.paused);
  }

  // atalho apertado (tecla ou botão do mouse); `evolve`: com o modificador de evoluir habilidade
  press(act, evolve, repeat) {
    if (act === 'board') {
      this.hud.el.board.classList.remove('hidden');
      this.hud.renderBoard();
      // o mouse pode já estar em cima de alguém: confere o que está embaixo dele
      this.grab.dirty = true;
      return;
    }
    if (repeat) return;
    if (MOVE_ACTIONS.includes(act)) {
      this.moveKeys.add(act);
      this.sendDir();
      return;
    }
    if (SLOTS.includes(act)) {
      if (evolve) this.rankUp(act);
      else this.pressSlot(act);
      return;
    }
    if (/^i[1-6]$/.test(act)) {
      this.useItem(Number(act[1]) - 1);
      return;
    }
    switch (act) {
      case 'amove':
        if (this.playing) {
          this.amove = true;
          this.aiming = null;
        }
        break;
      case 'stop':
        if (this.playing) this.send({ t: 'st' });
        this.targetId = 0;
        break;
      case 'recall':
        if (this.playing) this.send({ t: 'rc' });
        this.targetId = 0;
        break;
      case 'ping': {
        if (!this.playing) break;
        // com o mouse em cima do minimapa, o ping cai no ponto do mapa que ele aponta
        const mm = this.hud.el.minimap.getBoundingClientRect();
        const onMap = this.mouse.x >= mm.left && this.mouse.x <= mm.right && this.mouse.y >= mm.top && this.mouse.y <= mm.bottom;
        const [x, z] = onMap ? this.hud.minimapToWorld(((this.mouse.x - mm.left) / mm.width) * this.hud.el.minimap.width, ((this.mouse.y - mm.top) / mm.height) * this.hud.el.minimap.height) : [this.mouse.wx, this.mouse.wz];
        this.send({ t: 'pg', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
        break;
      }
      case 'shop':
        this.toggleShop();
        break;
      case 'cam':
        this.cam.locked = !this.cam.locked;
        break;
      case 'center':
        this.spaceHeld = true;
        break;
      case 'peek':
        this.peekHeld = true;
        break;
      case 'aim':
        this.aimHeld = true;
        break;
      default:
        break;
    }
  }

  release(act) {
    if (act === 'board') {
      this.hud.el.board.classList.add('hidden');
      this.grab.dirty = true;
    } else if (MOVE_ACTIONS.includes(act)) {
      if (this.moveKeys.delete(act)) this.sendDir();
    } else if (act === 'center') this.spaceHeld = false;
    else if (act === 'peek') this.peekHeld = false;
    else if (act === 'aim') this.aimHeld = false;
    else if (SLOTS.includes(act)) this.releaseSlot(act);
  }

  bindInput() {
    this.grab = new MouseGrab(this);
    // na captura: nenhum outro handler consegue segurar o evento e deixar o menu do navegador abrir
    window.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // arrastar o canvas também oferece salvar a imagem em alguns navegadores
    this.canvas.addEventListener('dragstart', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      initAudio();
      this.shiftHeld = e.shiftKey;
      // botão do mouse que virou atalho (no WASD o direito é a Habilidade 1)
      const act = this.codeAction[mouseCode(e.button)];
      if (e.button === 1 || e.button > 2) e.preventDefault();
      if (act) {
        if (!this.inputBlocked && this.phase !== 'idle' && !this.spectator) this.press(act, this.wasd ? e.ctrlKey : e.shiftKey, false);
      } else if (e.button === 2 && !this.wasd) {
        this.rightHeld = true;
        this.rightClick();
      } else if (e.button === 0) this.leftClick();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rightHeld = false;
      if (e.button === 0) this.leftHeld = false;
      // voltar e avançar do mouse trocam de página no navegador: como atalho, ficam só no jogo
      if (e.button > 2 && this.phase !== 'idle') e.preventDefault();
      const act = this.codeAction[mouseCode(e.button)];
      if (act) this.release(act);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.grab.locked) return;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.inside = true;
      this.mouse.out = null;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.grab.locked) return;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.inside = true;
    }, true);
    // o cursor saiu da janela por uma borda: guarda o lado, pra câmera continuar andando pra lá
    document.addEventListener('mouseleave', (e) => {
      if (this.grab.locked) return;
      this.mouse.inside = false;
      const ex = e.clientX <= 2 ? -1 : e.clientX >= window.innerWidth - 2 ? 1 : 0;
      const ey = e.clientY <= 2 ? -1 : e.clientY >= window.innerHeight - 2 ? 1 : 0;
      this.mouse.out = ex || ey ? { ex, ey } : null;
    });
    document.addEventListener('mouseenter', () => (this.mouse.out = null));
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.cam.zoom = Math.max(18, Math.min(40, this.cam.zoom + Math.sign(e.deltaY) * 2));
      },
      { passive: false },
    );
    const mm = this.hud.el.minimap;
    const mmAct = (e) => {
      const r = mm.getBoundingClientRect();
      const [x, z] = this.hud.minimapToWorld(((e.clientX - r.left) / r.width) * mm.width, ((e.clientY - r.top) / r.height) * mm.height);
      return [x, z];
    };
    mm.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const [x, z] = mmAct(e);
      if (e.button === 2 && this.playing) {
        this.send({ t: 'mv', x, z });
        return;
      }
      this.cam.locked = false;
      this.cam.x = x;
      this.cam.z = z;
      this.mmDrag = true;
    });
    window.addEventListener('mouseup', () => (this.mmDrag = false));
    mm.addEventListener('mousemove', (e) => {
      if (!this.mmDrag) return;
      const [x, z] = mmAct(e);
      this.cam.x = x;
      this.cam.z = z;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this.shiftHeld = true;
      if (e.target instanceof HTMLInputElement || this.inputBlocked) return;
      if (this.phase === 'idle' || this.spectator) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (e.code === 'Escape') {
        if (!e.repeat) this.escape();
        return;
      }
      const act = this.codeAction[e.code];
      if (!act) return;
      e.preventDefault();
      // evoluir: Shift + habilidade no clique; no WASD o Shift é habilidade, então é Ctrl + habilidade
      this.press(act, this.wasd ? e.ctrlKey : e.shiftKey, e.repeat);
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.shiftHeld = false;
      const act = this.codeAction[e.code];
      if (act) this.release(act);
    });
    // no WASD o Ctrl evolui habilidade e o W anda: Ctrl+W fecharia a aba no meio da partida, então o navegador pergunta antes
    window.addEventListener('beforeunload', (e) => {
      if (!this.wasd || this.phase !== 'playing' || this.spectator) return;
      e.preventDefault();
      e.returnValue = '';
    });
    window.addEventListener('blur', () => {
      this.rightHeld = false;
      this.leftHeld = false;
      this.peekHeld = false;
      if (this.moveKeys.size) {
        this.moveKeys.clear();
        this.sendDir();
      }
      this.spaceHeld = false;
      this.aimHeld = false;
      this.shiftHeld = false;
      this.aiming = null;
      this.hud.el.board.classList.add('hidden');
    });
  }

  // ---------- câmera e mira ----------

  groundAt(px, py, out) {
    _ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    return _ray.ray.intersectPlane(GROUND, out);
  }

  viewPolygon() {
    const pts = [];
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      _ndc.set(nx, ny);
      _ray.setFromCamera(_ndc, this.camera);
      const p = _ray.ray.intersectPlane(GROUND, _v);
      if (!p) return null;
      pts.push([p.x, p.z]);
    }
    return pts;
  }

  // Clique generoso: mede a distância do mouse até o corpo inteiro (dos pés à cabeça)
  // na tela, com folga extra pra inimigos. Aliado nunca rouba o clique de um inimigo.
  pickUnit(heroesOnly = false) {
    let best = 0;
    let bestScore = Infinity;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const mx = this.mouse.x;
    const my = this.mouse.y;
    for (const u of this.units.values()) {
      if (!u.alive || u.id === this.myId || u.flags & F.fly) continue;
      const hero = u.kind === 'hero';
      if (heroesOnly && (!hero || u.team === this.myTeam)) continue;
      const struct = STRUCT.has(u.kind);
      const top = hero ? 2.4 : struct ? (u.kind === 'core' ? 4.2 : 5.2) : u.kind === 'super' ? 2.3 : 1.3;
      const rad = hero ? 0.8 : struct ? (u.kind === 'core' ? 3.3 : 1.9) : u.kind === 'super' ? 0.95 : 0.6;
      _v.set(u.x, 0, u.z).project(this.camera);
      if (_v.z > 1) continue;
      const ax = (_v.x * 0.5 + 0.5) * W;
      const ay = (-_v.y * 0.5 + 0.5) * H;
      _v2.set(u.x + 1, 0, u.z).project(this.camera);
      const ppu = Math.abs((_v2.x - _v.x) * 0.5 * W) || 20;
      _v2.set(u.x, top, u.z).project(this.camera);
      const bx = (_v2.x * 0.5 + 0.5) * W;
      const by = (-_v2.y * 0.5 + 0.5) * H;
      const ex = bx - ax;
      const ey = by - ay;
      const k = Math.max(0, Math.min(1, ((mx - ax) * ex + (my - ay) * ey) / (ex * ex + ey * ey || 1)));
      const d = Math.hypot(mx - (ax + ex * k), my - (ay + ey * k));
      const enemy = u.team !== this.myTeam;
      const lim = rad * ppu + (enemy ? (hero ? 18 : 11) : 2);
      if (d > lim) continue;
      let score = d / lim;
      if (!enemy) score += 3;
      else if (u.flags & F.invuln) score += 1.5;
      else if (hero) score -= 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = u.id;
      }
    }
    return best;
  }

  spectatorFocus() {
    let x = 0;
    let n = 0;
    for (const u of this.units.values()) {
      if (u.kind !== 'hero' || !u.alive) continue;
      x += u.x;
      n++;
    }
    return n ? x / n : 0;
  }

  updateCamera(dt) {
    const c = this.cam;
    const me = this.me;
    if (this.spectator) {
      const fx = this.spectatorFocus();
      c.x += (fx - c.x) * Math.min(1, dt * 0.6);
      c.z += (0 - c.z) * Math.min(1, dt);
      c.zoom = 34;
    } else if (me && this.camSnap) {
      this.camSnap = false;
      c.x = me.x;
      c.z = me.z;
    } else if (me && this.cannonAim) {
      // escolhendo a queda: a câmera vai pra perto do alcance, que é o que importa ver inteiro
      const a = this.cannonAim;
      const k = Math.min(1, dt * 5);
      c.x += (me.x + (a.cx - me.x) * 0.85 - c.x) * k;
      c.z += (0 - c.z) * k;
    } else if (me && me.flags & F.fly) {
      // voando: acompanha o herói sem pular, até a queda
      const k = Math.min(1, dt * 10);
      c.x += (me.x - c.x) * k;
      c.z += (me.z - c.z) * k;
    } else if (me && (c.locked || this.spaceHeld)) {
      let tx = me.x;
      let tz = me.z;
      let reach = 0;
      // WASD: câmera dinâmica, presa no herói mas espiando pro lado do mouse; segurando o botão de espiar, bem mais longe
      if (this.wasd && !this.spaceHeld && (this.mouse.inside || this.grab.locked) && document.hasFocus()) {
        const nx = Math.max(-1, Math.min(1, (this.mouse.x / window.innerWidth) * 2 - 1));
        const ny = Math.max(-1, Math.min(1, (this.mouse.y / window.innerHeight) * 2 - 1));
        reach = c.h * (this.peekHeld ? 0.9 : 0.2);
        tx += nx * reach * this.flip;
        tz += ny * reach * this.flip;
      }
      // herói longe da câmera (renasceu, voltou pra base): pula direto em vez de deslizar
      const jump = Math.hypot(me.x - c.x, me.z - c.z) > 30 + reach * 1.5;
      const k = jump ? 1 : Math.min(1, dt * (this.peekHeld ? 4 : 10));
      c.x += (tx - c.x) * k;
      c.z += (tz - c.z) * k;
    } else if ((this.mouse.inside || this.mouse.out) && document.hasFocus() && this.phase === 'playing') {
      const edge = this.grab.locked ? 3 : 18;
      const sp = (30 + c.h * 0.9) * dt * this.camSpeed;
      const out = this.mouse.inside ? null : this.mouse.out;
      const ex = out ? out.ex : this.mouse.x < edge ? -1 : this.mouse.x > window.innerWidth - edge ? 1 : 0;
      const ey = out ? out.ey : this.mouse.y < edge ? -1 : this.mouse.y > window.innerHeight - edge ? 1 : 0;
      c.x += ex * sp * this.flip;
      c.z += ey * sp * this.flip;
    }
    c.x = Math.max(-100, Math.min(100, c.x));
    c.z = Math.max(-16, Math.min(16, c.z));
    // no canhão a câmera sobe além do limite da roda do mouse e volta quando o herói cai
    const far = me && (this.cannonAim || me.flags & F.fly) ? CANNON_ZOOM : c.zoom;
    c.h += (far - c.h) * Math.min(1, dt * (far > c.h ? 4 : 5));
    const haze = Math.max(0, c.h - 40) * 1.6;
    this.scene.fog.near = 70 + haze;
    this.scene.fog.far = 170 + haze;
    const flip = this.spectator ? 1 : this.flip;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sk = this.shake * this.shake * 2.2;
    const sx = (Math.random() - 0.5) * sk;
    const sz = (Math.random() - 0.5) * sk;
    this.camera.position.set(c.x + sx, c.h, c.z + flip * c.h * 0.6 + sz);
    this.camera.lookAt(c.x + sx, 0, c.z - flip * 1.5 + sz);
    this.sun.position.set(c.x + 30, 70, c.z + 25);
    this.sun.target.position.set(c.x, 0, c.z);
    setListener(c.x, c.z, flip);
    document.getElementById('cam-mode').textContent = c.locked ? 'câmera presa no herói' : `câmera solta · ${this.keyLabel('center')} centraliza`;
  }

  // ---------- quadro ----------

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.transport?.update(dt);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    const rt = this.renderTime();
    const visDt = this.paused && !this.online ? 0 : dt;
    this.pings = this.pings.filter((p) => (p.t -= dt) > 0);
    for (const u of [...this.units.values()]) {
      this.interpolate(u, rt);
      if (u.kind === 'hero' && u.gone) {
        this.dropModel(u);
        this.units.delete(u.id);
        continue;
      }
      if (u.kind === 'hero' && !u.def) continue;
      this.ensureModel(u);
      if (u.kind === 'hero' || STRUCT.has(u.kind)) {
        u.model.update(visDt, u, this.time);
        // herói escondido na moita: só o próprio time recebe ele, e vê meio transparente
        if (u.kind === 'hero') u.model.setGhost(!!(u.flags & F.hidden));
        if (visDt > 0 && u.model.flying) this.effects.flySmoke(u.x, u.model.body.position.y + 1, u.z, u.def.color);
      } else {
        const keep = u.model.update(visDt, u);
        if (!keep && u.gone) {
          this.dropModel(u);
          this.units.delete(u.id);
        }
      }
    }
    // moita: a sua fica translúcida pra você ver lá dentro; o capim balança com o vento
    const mine = this.units.get(this.myId);
    const myBush = mine && mine.alive ? bushAt(mine.x, mine.z) : -1;
    this.mapView.bushes.forEach((b, i) => {
      b.setInside(i === myBush);
      b.update(visDt, this.time);
    });
    for (const p of this.packs) {
      p.model.visible = p.up;
      p.model.userData.spin.rotation.y = this.time * 2;
      p.model.userData.spin.position.y = 1.1 + Math.sin(this.time * 3) * 0.15;
    }
    this.grab.update();
    this.effects.update(visDt, this.time, (id) => this.units.get(id));
    this.updateCamera(dt);
    if (this.mouse.inside) {
      const p = this.groundAt(this.mouse.x, this.mouse.y, _v);
      if (p) {
        this.mouse.wx = p.x;
        this.mouse.wz = p.z;
      }
    }
    this.hoverId = this.phase === 'playing' && !this.spectator ? this.pickUnit(this.heroesOnly) : 0;
    const hover = this.units.get(this.hoverId);
    this.updateCannons(visDt);
    document.body.classList.toggle('cur-attack', !!hover && hover.team !== this.myTeam);
    document.body.classList.toggle('cur-amove', this.amove);
    const me = this.me;
    if (this.rightHeld && this.playing && !this.aiming && !this.cannonAim) {
      this.rightT -= dt;
      if (this.rightT <= 0 && !this.rightTarget) {
        this.rightT = 0.12;
        this.send({ t: 'mv', x: Math.round(this.mouse.wx * 10) / 10, z: Math.round(this.mouse.wz * 10) / 10 });
      }
    }
    // WASD: segurar o botão esquerdo continua atacando quem estiver no mouse; andando, cada golpe sai assim que der
    if (this.leftHeld && this.wasd && this.playing && !this.aiming && !this.cannonAim && !this.amove) {
      this.leftT -= dt;
      if (this.leftT <= 0) {
        this.leftT = 0.15;
        this.attackClick(true);
      }
    }
    if (me && this.aiming && me.alive) this.effects.showIndicator(me, abilityOf(me.heroId, this.aiming, this.mySpells), this.mouse.wx, this.mouse.wz);
    else if (me && this.amove && this.meState) this.effects.showIndicator(me, { kind: 'range', range: this.meState.s[6] + 0.65 }, this.mouse.wx, this.mouse.wz);
    else this.effects.hideIndicator();
    let ring = null;
    if (me && me.alive && !this.spectator) {
      for (const u of this.units.values()) {
        if (u.kind !== 'tower' || !u.alive || u.team === this.myTeam) continue;
        if (Math.hypot(u.x - me.x, u.z - me.z) < TOWER.range + 4) ring = u;
      }
    }
    this.effects.showTowerRange(ring?.x, ring?.z, TOWER.range, !!ring);
    const tgt = this.targetId ? this.units.get(this.targetId) : null;
    if (!tgt || !tgt.alive || !me?.alive || this.phase !== 'playing') this.targetId = 0;
    this.effects.showTarget(this.targetId ? tgt : null, this.time);
    this.effects.showHover(hover && hover.id !== this.targetId ? hover : null, hover ? hover.team !== this.myTeam : false);
    this.canvas.style.filter = me && !me.alive && this.phase === 'playing' ? 'grayscale(0.85) brightness(0.8)' : '';
    this.overlay.draw(this, visDt);
    if (this.phase !== 'idle') {
      this.hud.update(dt);
      this.hud.drawMinimap();
    }
  }
}
