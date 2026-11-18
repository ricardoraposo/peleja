import { initAudio, playSound, setVolume } from './audio.js';
import { HERO_ORDER, HEROES, TEAMS } from './config.js';
import { Game } from './game.js';
import { esc, heroCard } from './hud.js';
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
  for (const id of ['end', 'draft', 'pause', 'shop', 'board']) show(id, false);
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

function playOnline() {
  debugPanel?.show(false);
  initAudio();
  readName();
  mode = 'online';
  netMsg('Conectando...', true);
  const transport = new SocketTransport(serverUrl());
  game.connect(transport, { name: settings.name });
  const started = performance.now();
  clearInterval(joinWait);
  joinWait = setInterval(() => {
    if (game.myId) {
      clearInterval(joinWait);
      netMsg('');
      enterMatch();
      const tag = $('online-tag');
      tag.textContent = 'ONLINE';
      tag.classList.remove('hidden');
      game.onPhase(game.phase);
    } else if (transport.closed || performance.now() - started > 8000) {
      clearInterval(joinWait);
      netMsg('Não achei o servidor online. Quem abriu a partida precisa rodar "npm run online".');
      attract();
    }
  }, 100);
}

// ---------- escolha de herói ----------

let draftKey = '';
function renderDraft() {
  if (game.phase !== 'draft' || game.spectator) return;
  const me = game.me;
  const st = game.meState;
  $('draft-count').textContent = Math.max(0, Math.ceil(game.phaseT));
  if (!me?.heroId) return;
  const allies = [...game.roster.entries()].filter(([id, r]) => r.team === game.myTeam && id !== game.myId);
  const myHero = HERO_ORDER[game.roster.get(game.myId)?.heroIdx] || me.heroId;
  const locked = !!st?.rd;
  const key = myHero + '|' + allies.map(([, r]) => r.heroIdx + r.name + (r.isBot ? 1 : 0)).join(',') + '|' + (locked ? 1 : 0);
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
game.onNetError = () => {
  showMenu();
  netMsg('A conexão com o servidor caiu.');
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
    nextEl.innerHTML = `Próxima partida em <b>${left}</b> s`;
    nextEl.classList.remove('hidden');
    $('again').classList.add('hidden');
    endTimer = setInterval(() => {
      left = Math.max(0, left - 1);
      nextEl.innerHTML = `Próxima partida em <b>${left}</b> s`;
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
$('play-online').addEventListener('click', playOnline);
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
$('reroll').addEventListener('click', () => {
  settings.hero = '';
  save(settings);
  game.pickRandom();
});
$('ready').addEventListener('click', () => game.ready());
$('again').addEventListener('click', () => (mode === 'online' ? playOnline() : playBots()));
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
}
