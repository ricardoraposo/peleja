import { initAudio, playSound, setVolume } from './audio.js';
import { DEFAULT_SPELLS, HERO_ORDER, HEROES, SPELL_POOL, TEAMS } from './config.js';
import { Game } from './game.js';
import { esc, heroCard, spellPicker } from './hud.js';
import { LocalTransport, SocketTransport, serverUrl } from './net.js';

const $ = (id) => document.getElementById(id);

function load() {
  try {
    return JSON.parse(localStorage.getItem('peleja') || '{}');
  } catch {
    return {};
  }
}

function save(s) {
  try {
    localStorage.setItem('peleja', JSON.stringify(s));
  } catch {
    return;
  }
}

const stored = load();
const settings = {
  name: stored.name || '',
  difficulty: stored.difficulty || 'normal',
  size: stored.size === 3 ? 3 : 5,
  volume: stored.volume ?? 0.7,
  // padrão: cursor do próprio sistema (sem atraso). 'mouse' substitui a antiga opção 'grab'.
  mouse: [0, 1, 2].includes(stored.mouse) ? stored.mouse : 0,
  // último herói escolhido: já vem marcado na próxima partida
  hero: HEROES[stored.hero] ? stored.hero : '',
  // feitiços do D e do F: também voltam marcados
  spells: SPELL_POOL[stored.spells?.d] && SPELL_POOL[stored.spells?.f] && stored.spells.d !== stored.spells.f ? { d: stored.spells.d, f: stored.spells.f } : null,
};
setVolume(settings.volume);

const game = new Game($('game'), $('overlay'));
window.__peleja = game;
game.grab.mode = settings.mouse;
const params = new URLSearchParams(location.search);
let mode = 'bots';
let endTimer = null;
let joinWait = null;

function show(id, v) {
  $(id).classList.toggle('hidden', !v);
}

function netMsg(text, info = false) {
  const el = $('net-msg');
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
  el.classList.toggle('info', info);
}

// O treino só existe no servidor de desenvolvimento (npm run dev).
// No build de produção (npm run build / online) este bloco e o src/debug.js nem entram no pacote.
const DEV = import.meta.env.DEV;
let debugPanel = null;

function attract() {
  debugPanel?.show(false);
  game.connect(new LocalTransport({ difficulty: 'normal', teamSize: 5 }), { spectator: true });
}

function showMenu() {
  clearInterval(endTimer);
  clearInterval(joinWait);
  for (const id of ['end', 'draft', 'pause', 'shop', 'board', 'lobby']) show(id, false);
  show('menu', true);
  $('online-tag').classList.add('hidden');
  attract();
}

function readName() {
  settings.name = $('name').value.trim().slice(0, 14) || 'Jogador';
  save(settings);
}

function enterMatch() {
  for (const id of ['menu', 'end', 'pause']) show(id, false);
}

function playBots() {
  debugPanel?.show(false);
  initAudio();
  readName();
  mode = 'bots';
  netMsg('');
  enterMatch();
  game.connect(new LocalTransport({ difficulty: settings.difficulty, teamSize: settings.size }), { name: settings.name });
}

function playSandbox() {
  if (!DEV || !debugPanel) return;
  initAudio();
  readName();
  mode = 'sandbox';
  netMsg('');
  enterMatch();
  game.connect(new LocalTransport({ difficulty: settings.difficulty, sandbox: true }), { name: settings.name });
  debugPanel.show(true);
}

// ---------- online: salas ----------
// ONLINE abre a caixinha de criar sala ou entrar com código. Dentro da sala (saguão) cada um escolhe o time,
// o dono ajusta tamanho e bots e manda começar; daí todo mundo vai pra escolha de herói.

const DIFF_NAMES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };
const inviteLink = (code) => `${location.origin}${location.pathname}?sala=${code}`;

function connectOnline(hello) {
  debugPanel?.show(false);
  initAudio();
  readName();
  mode = 'online';
  netMsg('Conectando...', true);
  const transport = new SocketTransport(serverUrl());
  game.connect(transport, { name: settings.name, hello });
  const started = performance.now();
  clearInterval(joinWait);
  joinWait = setInterval(() => {
    if (game.room) clearInterval(joinWait);
    else if (transport.closed || performance.now() - started > 8000) {
      clearInterval(joinWait);
      if (game.transport === transport) {
        netMsg(NO_SERVER);
        attract();
      }
    }
  }, 100);
}

function createRoom() {
  connectOnline({ t: 'create', size: settings.size, diff: settings.difficulty });
}

function joinRoom() {
  const code = $('room-code').value.trim().toUpperCase();
  if (code.length !== 4) {
    netMsg('O código da sala tem 4 letras.');
    $('room-code').focus();
    return;
  }
  connectOnline({ t: 'join', room: code });
}

function renderLobby(r) {
  const mine = r.members.find((m) => m[0] === r.you);
  const host = r.members.find((m) => m[0] === r.host);
  const amHost = r.you === r.host;
  $('lobby-code').textContent = r.code;
  $('lobby-sub').textContent = amHost ? 'Você é o dono da sala. Chame a galera e comece quando quiser: os bots completam as vagas.' : `Esperando ${host ? host[1] : 'o dono da sala'} começar a partida.`;
  $('lobby-link').value = inviteLink(r.code);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const warn = $('lobby-warn');
  warn.textContent = local ? 'Você abriu o jogo por localhost, então este link só funciona neste computador. Pra convidar, abra o jogo pelo endereço da sua rede ou do túnel (npm run tunnel) e crie a sala por lá.' : '';
  warn.classList.toggle('hidden', !local);
  for (const t of [0, 1]) {
    const list = r.members.filter((m) => m[2] === t);
    const rows = list.map((m) => `<div class="lb-slot${m[0] === r.you ? ' me' : ''}"><b>${esc(m[1])}</b>${m[0] === r.host ? '<small>dono</small>' : ''}${m[0] === r.you ? '<small>você</small>' : ''}</div>`);
    for (let i = list.length; i < r.size; i++) rows.push(`<div class="lb-slot bot"><b>Bot</b><small>${DIFF_NAMES[r.diff]}</small></div>`);
    $(t === 0 ? 'lobby-blue' : 'lobby-red').innerHTML = rows.join('');
  }
  const otherFull = r.members.filter((m) => m[2] === 1 - mine[2]).length >= r.size;
  const most = Math.max(r.members.filter((m) => m[2] === 0).length, r.members.filter((m) => m[2] === 1).length);
  const seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, label, off]) => `<button data-cfg="${key}" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}"${amHost && !off ? '' : ' disabled'}>${label}</button>`).join('')}</div>`;
  $('lobby-cfg').innerHTML =
    `<button data-act="team" class="ghost"${otherFull ? ' disabled' : ''}>Ir pro time ${TEAMS[1 - mine[2]].name}</button>` +
    `<div class="field"><span>Tamanho</span>${seg('size', [[3, '3 x 3', most > 3], [5, '5 x 5', false]], r.size)}</div>` +
    `<div class="field"><span>Bots</span>${seg('diff', Object.entries(DIFF_NAMES).map(([v, l]) => [v, l, false]), r.diff)}</div>`;
  $('lobby-start').classList.toggle('hidden', !amHost);
  $('lobby').style.setProperty('--team', TEAMS[mine[2]].color);
}

game.onRoom = (r) => {
  clearInterval(joinWait);
  netMsg('');
  const tag = $('online-tag');
  tag.textContent = `SALA ${r.code}`;
  if (r.state === 'lobby') {
    clearInterval(endTimer);
    for (const id of ['menu', 'end', 'draft', 'pause', 'shop', 'board']) show(id, false);
    tag.classList.add('hidden');
    show('lobby', true);
    renderLobby(r);
  } else {
    show('lobby', false);
    show('menu', false);
    tag.classList.remove('hidden');
  }
};

// ---------- escolha de herói ----------

let draftKey = '';
let draftSlot = 'd';
function renderDraft() {
  if (game.phase !== 'draft' || game.spectator) return;
  const me = game.me;
  const st = game.meState;
  $('draft-count').textContent = Math.max(0, Math.ceil(game.phaseT));
  if (!me?.heroId) return;
  const allies = [...game.roster.entries()].filter(([id, r]) => r.team === game.myTeam && id !== game.myId);
  const myHero = HERO_ORDER[game.roster.get(game.myId)?.heroIdx] || me.heroId;
  const locked = !!st?.rd;
  const spells = game.mySpells || DEFAULT_SPELLS;
  const key = myHero + '|' + allies.map(([, r]) => r.heroIdx + r.name + (r.isBot ? 1 : 0)).join(',') + '|' + (locked ? 1 : 0) + '|' + spells.d + spells.f + draftSlot;
  if (key === draftKey) return;
  draftKey = key;
  $('draft-grid').innerHTML = HERO_ORDER.map((id, idx) => {
    const h = HEROES[id];
    const holder = allies.find(([, r]) => r.heroIdx === idx)?.[1];
    const mine = id === myHero;
    const taken = !!holder && !holder.isBot;
    const note = mine ? 'você' : holder ? (holder.isBot ? 'com bot' : esc(holder.name)) : h.title;
    const tip = taken ? 'Já escolhido por um aliado' : holder ? 'Está com um bot: se você pegar, ele fica com o seu' : h.title;
    return `<button class="pick${mine ? ' on' : ''}${taken ? ' taken' : ''}" data-hero="${id}" style="--c:${h.color}" title="${tip}"${taken || locked ? ' disabled' : ''}><span class="pick-badge">${h.name[0]}</span><b>${h.name}</b><small>${note}</small></button>`;
  }).join('');
  $('draft-me').innerHTML = heroCard(myHero, true);
  $('draft-spells').innerHTML = spellPicker(spells, draftSlot);
  $('draft-allies').innerHTML = allies
    .map(([, r]) => {
      const h = HEROES[HERO_ORDER[r.heroIdx]];
      return `<div class="ally" style="--c:${h.color}"><span class="b-hero">${h.name[0]}</span><div><b>${h.name}</b><small>${esc(r.name)}${r.isBot ? ' · bot' : ''}</small></div></div>`;
    })
    .join('');
  $('reroll').disabled = locked;
  $('ready').disabled = locked;
  $('ready').textContent = locked ? 'ESPERANDO...' : 'PRONTO!';
  $('draft').style.setProperty('--team', TEAMS[game.myTeam].color);
}
setInterval(renderDraft, 100);

game.onPhase = (ph) => {
  if (game.spectator) return;
  if (ph === 'draft') {
    draftKey = '';
    show('end', false);
    show('draft', true);
    game.hud.show(false);
    if (settings.hero) game.pick(settings.hero, true);
    if (settings.spells) for (const s of ['d', 'f']) game.setSpell(s, settings.spells[s], true);
    renderDraft();
  } else if (ph === 'playing') {
    show('draft', false);
    show('end', false);
    game.hud.show(true);
  }
};

game.onPause = (p, online) => {
  $('pause-title').textContent = online ? 'Menu' : 'Pausa';
  show('pause', p);
};
const NO_SERVER = 'Não achei o servidor online. Deixe "npm run server" rodando em outro terminal (ou use "npm run online", que já serve o jogo pronto).';
const NET_ERRORS = {
  full: 'Essa sala está cheia.',
  noroom: 'Não existe sala com esse código. Confere com quem te chamou: a sala some quando todo mundo sai.',
  busy: 'O servidor está com salas demais abertas. Tente de novo daqui a pouco.',
};
game.onNetError = (kind) => {
  // sem ter entrado numa sala, não foi queda: o servidor nem está de pé
  const joined = !!game.room;
  showMenu();
  show('online-box', true);
  netMsg(NET_ERRORS[kind] || (joined ? 'A conexão com o servidor caiu.' : NO_SERVER));
};

game.onEnd = (winner, next) => {
  if (game.spectator) {
    setTimeout(() => game.spectator && attract(), 4000);
    return;
  }
  const won = winner === game.myTeam;
  const title = $('end-title');
  title.textContent = won ? 'Vitória!' : 'Derrota';
  title.classList.toggle('win', won);
  const t = Math.floor(game.gameTime);
  $('end-sub').textContent = `${TEAMS[winner].name} derrubou o núcleo em ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · placar ${game.kills[0]} x ${game.kills[1]}`;
  $('end-blue').innerHTML = game.hud.boardRows(0);
  $('end-red').innerHTML = game.hud.boardRows(1);
  const nextEl = $('end-next');
  clearInterval(endTimer);
  if (next > 0) {
    let left = Math.ceil(next);
    const label = mode === 'online' ? 'Voltando pra sala em' : 'Próxima partida em';
    nextEl.innerHTML = `${label} <b>${left}</b> s`;
    nextEl.classList.remove('hidden');
    $('again').classList.add('hidden');
    endTimer = setInterval(() => {
      left = Math.max(0, left - 1);
      nextEl.innerHTML = `${label} <b>${left}</b> s`;
    }, 1000);
  } else {
    nextEl.classList.add('hidden');
    $('again').classList.remove('hidden');
  }
  game.hud.show(false);
  setTimeout(() => show('end', true), 1800);
};

// ---------- menu ----------

$('menu-heroes').innerHTML = HERO_ORDER.map((id) => {
  const h = HEROES[id];
  return `<div class="mh" style="--c:${h.color}" title="${h.title}"><span class="b-hero">${h.name[0]}</span><b>${h.name}</b><small>${h.title}</small></div>`;
}).join('');

$('name').value = settings.name;
$('vol').value = settings.volume;
$('vol-val').textContent = Math.round(settings.volume * 100);
function seg(id, key, parse = (v) => v) {
  for (const b of $(id).querySelectorAll('button')) {
    b.classList.toggle('on', String(parse(b.dataset.v)) === String(settings[key]));
    b.addEventListener('click', () => {
      settings[key] = parse(b.dataset.v);
      for (const o of $(id).querySelectorAll('button')) o.classList.toggle('on', o === b);
      save(settings);
      playSound('click');
    });
  }
}
seg('diff', 'difficulty');
seg('size', 'size', Number);
seg('grab', 'mouse', Number);
$('grab').addEventListener('click', () => (game.grab.mode = settings.mouse));
$('vol').addEventListener('input', (e) => {
  settings.volume = Number(e.target.value);
  $('vol-val').textContent = Math.round(settings.volume * 100);
  setVolume(settings.volume);
  save(settings);
});
$('name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') playBots();
});
$('play').addEventListener('click', playBots);
$('play-online').addEventListener('click', () => {
  $('online-box').classList.toggle('hidden');
  playSound('click');
  if (!$('online-box').classList.contains('hidden')) $('room-code').focus();
});
$('room-create').addEventListener('click', createRoom);
$('room-join').addEventListener('click', joinRoom);
$('room-code').addEventListener('input', (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')));
$('room-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoom();
});
$('lobby-leave').addEventListener('click', showMenu);
$('lobby-start').addEventListener('click', () => {
  game.send({ t: 'start' });
  playSound('click');
});
$('lobby-copy').addEventListener('click', async () => {
  const el = $('lobby-link');
  try {
    await navigator.clipboard.writeText(el.value);
  } catch {
    el.select();
    document.execCommand('copy');
  }
  $('lobby-copy').textContent = 'Copiado!';
  setTimeout(() => ($('lobby-copy').textContent = 'Copiar link'), 1500);
});
$('lobby-cfg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.act === 'team') game.send({ t: 'team' });
  else if (b.dataset.cfg === 'size') game.send({ t: 'cfg', size: Number(b.dataset.v) });
  else if (b.dataset.cfg === 'diff') game.send({ t: 'cfg', diff: b.dataset.v });
  playSound('click');
});
if (DEV) {
  import('./debug.js').then(({ DebugPanel }) => {
    debugPanel = new DebugPanel(game, () => playSandbox());
    $('play-sandbox').classList.remove('hidden');
    $('play-sandbox').addEventListener('click', playSandbox);
    // atalho: ?treino abre direto no modo de treino
    if (params.has('treino')) {
      settings.name = settings.name || 'Jogador';
      playSandbox();
    }
  });
}
$('draft-grid').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-hero]');
  if (!b || b.disabled) return;
  settings.hero = b.dataset.hero;
  save(settings);
  game.pick(b.dataset.hero);
});
$('draft-spells').addEventListener('click', (e) => {
  const slot = e.target.closest('button[data-slot]');
  const opt = e.target.closest('button[data-spell]');
  if (slot) {
    draftSlot = slot.dataset.slot;
    playSound('click');
    renderDraft();
  } else if (opt) {
    // já calcula a troca aqui (escolher o da outra tecla inverte os dois) pra salvar a preferência
    const cur = { ...(game.mySpells || DEFAULT_SPELLS) };
    const other = draftSlot === 'd' ? 'f' : 'd';
    if (cur[other] === opt.dataset.spell) cur[other] = cur[draftSlot];
    cur[draftSlot] = opt.dataset.spell;
    settings.spells = cur;
    save(settings);
    game.setSpell(draftSlot, opt.dataset.spell);
  }
});
$('reroll').addEventListener('click', () => {
  settings.hero = '';
  save(settings);
  game.pickRandom();
});
$('ready').addEventListener('click', () => game.ready());
$('again').addEventListener('click', () => (mode === 'online' ? showMenu() : playBots()));
$('to-menu').addEventListener('click', showMenu);
$('resume').addEventListener('click', () => game.setPaused(false));
$('quit').addEventListener('click', showMenu);

if (params.has('demo')) {
  // atalho pra testes: ?demo pula o menu e começa direto contra bots
  show('menu', false);
  settings.name = params.get('name') || 'Demo';
  game.connect(new LocalTransport({ difficulty: params.get('diff') || 'normal', teamSize: Number(params.get('size')) || 5 }), { name: settings.name });
  if (params.has('go')) setTimeout(() => game.ready(), 300);
} else {
  attract();
  // link de convite: ?sala=ABCD já deixa o código preenchido
  const invited = (params.get('sala') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (invited.length === 4) {
    $('room-code').value = invited;
    show('online-box', true);
    netMsg(`Você foi chamado pra sala ${invited}. Coloque seu nome e clique em "Entrar na sala".`, true);
  }
}
