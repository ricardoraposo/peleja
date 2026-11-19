import { SPELL_ORDER, SPELL_POOL, HERO_ORDER, HEROES, ITEM_ORDER, ITEMS, MAP, SLOTS, STAT_LABEL, TEAMS, abilityOf, BUILDS, BUILD_WHY, RANK_MAX, RANK_SLOTS, ULT_LEVELS, canRankUp, BUILDS_ALT, AFFINITY_BONUS, STAT_PCT, affinityOf, itemPrice, itemStatsFor, itemTier, missingBasics, nextBuy, effectiveLevel } from './config.js';
import { OBSTACLES } from './geo.js';
import { ITEM_ICONS } from './itemicons.js';

const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const ICONS = {
  bolt: S('<path d="M3 12h11M10 7l5 5-5 5M17 8l4 4-4 4"/>'),
  dash: S('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  bomb: S('<circle cx="11" cy="14" r="7"/><path d="M14 7.5V5h-4v2.5M14 5l4-2"/>'),
  comet: S('<circle cx="16" cy="8" r="4"/><path d="M13 11 3 21M10 8 4 14M16 14l-6 6"/>'),
  hammer: S('<path d="M14 4h6v6h-6zM15 9 4 20"/>'),
  shield: S('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  leap: S('<path d="M4 20c2-9 8-14 16-15M14 5h6v6M3 21h7"/>'),
  storm: S('<path d="M6 14a5 5 0 1 1 3-9 6 6 0 0 1 11 3 4 4 0 0 1-2 6"/><path d="m12 13-3 5h4l-2 4"/>'),
  needle: S('<path d="M3 21 21 3M15 3h6v6"/>'),
  net: S('<path d="M4 4l16 16M20 4 4 20M12 2v20M2 12h20"/>'),
  feather: S('<path d="M20 4C10 4 5 10 5 19M5 19l4-4M20 4c0 8-6 12-11 12"/>'),
  scope: S('<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>'),
  sting: S('<path d="M5 19 19 5M14 5h5v5M5 19l2-6 4 4z"/>'),
  heart: S('<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>'),
  swarm: S('<circle cx="6" cy="8" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="12" cy="14" r="2"/><circle cx="18" cy="17" r="2"/><circle cx="6" cy="18" r="2"/>'),
  skull: S('<path d="M5 11a7 7 0 1 1 14 0v4h-3v4H8v-4H5z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/>'),
  thorns: S('<path d="M3 12h18M7 12 5 7M11 12l-2-6M15 12l2-6M19 12l2-5M9 12l-2 5M15 12l2 5"/>'),
  bark: S('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M9 9v6M12 8v8M15 9v6"/>'),
  roots: S('<path d="M12 3v8M12 11c-3 2-6 3-8 8M12 11c3 2 6 3 8 8M12 11v10"/>'),
  flower: S('<circle cx="12" cy="12" r="3"/><path d="M12 3a3 3 0 0 1 0 6M12 15a3 3 0 0 1 0 6M3 12a3 3 0 0 1 6 0M15 12a3 3 0 0 1 6 0"/>'),
  wave: S('<path d="M2 12c3-4 5-4 8 0s5 4 8 0 3-2 4-2M2 18c3-4 5-4 8 0s5 4 8 0"/>'),
  drop: S('<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>'),
  bubble: S('<circle cx="12" cy="12" r="8"/><path d="M9 8a4 4 0 0 0-2 3"/>'),
  tide: S('<path d="M2 16c4-8 9-12 20-10-6 2-8 6-6 10M2 20h20"/>'),
  fire: S('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 2 0-2-1-4 0-7z"/>'),
  wisp: S('<circle cx="12" cy="10" r="4"/><path d="M8 13c-2 3-1 6 2 8M16 13c2 3 1 6-2 8M12 14v7"/>'),
  snake: S('<path d="M4 18c3 0 3-4 6-4s3 4 6 4 3-6 0-8-6 0-6-3 3-4 6-3"/><circle cx="17" cy="4" r="1"/>'),
  blaze: S('<path d="M5 20c-1-5 3-7 3-11 2 2 3 4 3 6 1-4 3-7 6-10 0 4 2 7 2 10a7 7 0 0 1-14 5z"/>'),
  spin: S('<path d="M20 12a8 8 0 1 1-3-6.3M20 4v5h-5"/>'),
  hop: S('<path d="M12 21V9M8 13l4-4 4 4M5 5c3-3 11-3 14 0"/>'),
  cap: S('<path d="M4 18c0-6 4-12 10-14 2 3 1 7-1 9l7 5z"/>'),
  tornado: S('<path d="M3 4h18M5 8h14M7 12h10M9 16h6M11 20h2"/>'),
  leaf: S('<path d="M5 19C5 10 10 4 20 4c0 10-6 15-15 15zM5 19l7-7"/>'),
  blink: S('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="3"/><path d="M8 16l2-2M12 12l2-2" stroke-dasharray="2 2"/>'),
  boots: S('<path d="M7 3v10l-3 3v4h16v-3l-6-2V3z"/>'),
  sword: S('<path d="M14 3h7v7L9 22l-2-2-3 1 1-3-2-2z"/>'),
  bow: S('<path d="M5 3c8 3 13 8 16 16M5 3l16 16M5 3v6M5 3h6"/>'),
  gem: S('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/>'),
  vest: S('<path d="M8 3 4 6v15h16V6l-4-3-4 4z"/>'),
  cloak: S('<path d="M9 3h6l5 18H4z"/><path d="M12 3v18"/>'),
  blade: S('<path d="M4 20 18 6l2-3-3 2L3 19zM6 14l4 4"/>'),
  wind: S('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>'),
  spear: S('<path d="M3 21 17 7M17 7l4-4-1 5-3-1zM6 15l3 3"/>'),
  crown: S('<path d="M3 18 4 7l5 5 3-7 3 7 5-5 1 11z"/>'),
  orb: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'),
  shell: S('<path d="M3 15a9 9 0 0 1 18 0zM8 15l2-8M16 15l-2-8M12 6v9M2 18h20"/>'),
  moon: S('<path d="M20 15A8 8 0 1 1 10 4a7 7 0 0 0 10 11z"/>'),
  book: S('<path d="M3 5h7a2 2 0 0 1 2 2 2 2 0 0 1 2-2h7v14h-7a2 2 0 0 0-2 2 2 2 0 0 0-2-2H3zM12 7v14"/>'),
  axe: S('<path d="M4 21 15 8M11 5c4-2 8-1 10 3-2 2-5 3-8 2z"/>'),
  drum: S('<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M8 10v9M16 10v9"/>'),
};

const $ = (id) => document.getElementById(id);
// filtros da aba "todos": cada categoria junta os atributos que ela cobre
const SHOP_CATS = [
  { id: 'all', name: 'Tudo', icon: S('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>') },
  { id: 'atk', name: 'Ataque', stats: ['atk', 'as', 'ls', 'crit', 'pen', 'onhit'], icon: ICONS.sword },
  { id: 'pow', name: 'Poder', stats: ['pow', 'haste', 'mpen', 'sv', 'hsp'], icon: ICONS.gem },
  { id: 'def', name: 'Defesa', stats: ['hp', 'armor', 'mres', 'regen', 'thorns', 'ten'], icon: ICONS.vest },
  { id: 'mov', name: 'Passo', stats: ['ms'], icon: ICONS.boots },
];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const KIND_LABEL = { proj: 'disparo', aoe: 'área', nova: 'ao redor', cone: 'leque', dash: 'avanço', blink: 'teleporte', target: 'no alvo', self: 'em você', ally: 'aliados', zone: 'zona' };

const DMG_NAME = { phys: 'físico', magic: 'mágico', true: 'verdadeiro' };
const DMG_CLASS = { phys: 'd-phys', magic: 'd-magic', true: 'd-true' };

// Uma linha de valor (dano, cura ou escudo): total de agora + de onde ele vem.
// ctx = { lv, rank, atk, pow, hp }. Sem ctx (menu, sorteio) mostra só a fórmula no nível 1.
function valueLine(label, v, slot, ctx, cls = '') {
  if (!v) return '';
  const calc = (rank) => {
    const lvl = effectiveLevel(ctx.lv, slot, Math.max(1, rank));
    const base = (v.b || 0) + (v.l || 0) * (lvl - 1);
    return { base, total: base + (v.ad || 0) * ctx.atk + (v.ap || 0) * ctx.pow + (v.hp || 0) * ctx.hp };
  };
  const now = calc(ctx.rank);
  const parts = [`<i>${Math.round(now.base)} base</i>`];
  if (v.ad) parts.push(`<i class="s-atk">${Math.round(v.ad * 100)}% do ataque (${Math.round(v.ad * ctx.atk)})</i>`);
  if (v.ap) parts.push(`<i class="s-pow">${Math.round(v.ap * 100)}% do poder (${Math.round(v.ap * ctx.pow)})</i>`);
  if (v.hp) parts.push(`<i class="s-hp">${Math.round(v.hp * 1000) / 10}% da vida máx. (${Math.round(v.hp * ctx.hp)})</i>`);
  const max = RANK_MAX[slot];
  const next = max && ctx.rank >= 1 && ctx.rank < max ? ` <u>→ ${Math.round(calc(ctx.rank + 1).total)} no próximo nível</u>` : '';
  return `<div class="tv"><span class="tv-top"><em class="${cls}">${label}: ${Math.round(now.total)}</em>${next}</span><span class="tv-parts">${parts.join(' + ')}</span></div>`;
}

function fxText(fx) {
  if (!fx) return [];
  const out = [];
  if (fx.slow) out.push(`deixa ${Math.round(fx.slow[0] * 100)}% mais lento por ${fx.slow[1]} s`);
  if (fx.stun) out.push(`atordoa por ${fx.stun} s`);
  if (fx.root) out.push(`prende no lugar por ${fx.root} s`);
  if (fx.knockup) out.push(`joga pra cima por ${fx.knockup} s`);
  if (fx.knockback) out.push(`empurra ${fx.knockback} passos`);
  return out;
}

export function abilityTip(ab, slot, ctx = null) {
  const key = slot.toUpperCase();
  const c = ctx || { lv: 1, rank: 1, atk: 0, pow: 0, hp: 0 };
  const max = RANK_MAX[slot];
  const lines = [];
  const dmg = (label, d, extra = '') => valueLine(`${label} ${DMG_NAME[d.type] || ''}${extra}`, d, slot, c, DMG_CLASS[d.type]);
  if (ab.dmg) lines.push(dmg(ab.kind === 'zone' ? `Dano a cada ${ab.tick} s,` : 'Dano', ab.dmg));
  if (ab.end?.dmg) lines.push(dmg('Dano na chegada,', ab.end.dmg));
  if (ab.path?.dmg) lines.push(dmg('Dano no caminho,', ab.path.dmg));
  if (ab.buff?.aura) lines.push(dmg(`Dano a cada ${ab.buff.aura.tick} s,`, ab.buff.aura.dmg));
  if (ab.heal) lines.push(valueLine('Cura', ab.heal, slot, c, 'd-heal'));
  if (ab.shield) lines.push(valueLine(`Escudo por ${ab.shield.t || 3} s`, ab.shield, slot, c, 'd-shield'));
  const notes = [...fxText(ab.fx), ...fxText(ab.end?.fx), ...fxText(ab.path?.fx)];
  if (ab.exec) notes.push(`até +${Math.round(ab.exec * 100)}% de dano conforme o alvo perde vida`);
  if (ab.buff) {
    const b = ab.buff;
    const bits = [];
    if (b.as) bits.push(`+${Math.round(b.as * 100)}% vel. de ataque`);
    if (b.ms) bits.push(`+${Math.round(b.ms * 100)}% de passo`);
    if (b.armor) bits.push(`+${b.armor} armadura`);
    if (b.mres) bits.push(`+${b.mres} resist. mágica`);
    if (bits.length) notes.push(`${bits.join(', ')} por ${b.t} s`);
  }
  if (ab.heroesOnly) notes.push('só acerta heróis');
  if (ab.pierce) notes.push('atravessa os inimigos');
  if (ab.explode) notes.push('explode em área');
  // recarga real: aceleração do herói e nível da habilidade
  let cd = ab.cd;
  if (max && ctx) cd = ab.cd * (100 / (100 + (ctx.haste || 0))) * (1 - (slot === 'r' ? 0.1 : 0.04) * (Math.max(1, c.rank) - 1));
  const foot = [KIND_LABEL[ab.kind] || '', ab.range ? `alcance ${ab.range}` : ab.radius ? `raio ${ab.radius}` : '', cd ? `recarga ${Math.round(cd * 10) / 10} s` : ''].filter(Boolean).join(' · ');
  const rankTxt = max ? (ctx ? (c.rank > 0 ? `nível ${c.rank}/${max}` : slot === 'r' ? `libera no nível ${ULT_LEVELS[0]}` : 'não aprendida') : '') : '';
  const scale = max ? `<small>Evoluir aumenta os valores base e encurta a recarga em ${slot === 'r' ? 10 : 4}% por nível.</small>` : '';
  return (
    `<b>${key} · ${esc(ab.name)}${rankTxt ? ` <i class="tip-rank">${rankTxt}</i>` : ''}</b><span>${esc(ab.desc || '')}</span>` +
    lines.join('') +
    (notes.length ? `<span class="tv-notes">${notes.map((n) => esc(n[0].toUpperCase() + n.slice(1))).join('. ')}.</span>` : '') +
    `<small>${foot}</small>${ctx ? scale : ''}`
  );
}

// texto dos atributos de um item. Com `heroId`, já soma a afinidade e marca o que foi reforçado.
export function itemStats(it, heroId = null, sep = ' · ') {
  const aff = heroId ? affinityOf(heroId) : [];
  return Object.entries(it.stats)
    .map(([k, base]) => {
      const up = aff.includes(k);
      const v = up ? base * (1 + AFFINITY_BONUS) : base;
      const val = STAT_PCT.includes(k) ? `+${Math.round(v * 100)}%` : `+${Math.round(v * 10) / 10}`;
      return up ? `<em class="aff">${val} ${STAT_LABEL[k]} ★</em>` : `${val} ${STAT_LABEL[k]}`;
    })
    .join(sep);
}

// desenho do item (cada um tem o seu) e a classe da moldura, que fica mais rica a cada nível do item
export const itemIcon = (id) => ITEM_ICONS[id] || ICONS[ITEMS[id]?.icon] || '';
const tierClass = (id) => `tier${itemTier(id)}`;

// escolha dos feitiços do D e do F: `active` é a tecla que está sendo trocada
export function spellPicker(spells, active) {
  const other = active === 'd' ? 'f' : 'd';
  const slots = ['d', 'f']
    .map((s) => {
      const ab = SPELL_POOL[spells[s]];
      return `<button class="sp-slot${s === active ? ' on' : ''}" data-slot="${s}" style="--c:${ab.color}"><kbd>${s.toUpperCase()}</kbd><span class="sp-ic">${ICONS[ab.icon] || ''}</span><b>${esc(ab.name)}</b></button>`;
    })
    .join('');
  const opts = SPELL_ORDER.map((id) => {
    const ab = SPELL_POOL[id];
    const mark = spells[active] === id ? active : spells[other] === id ? other : '';
    return `<button class="sp-opt${mark === active ? ' on' : ''}" data-spell="${id}" style="--c:${ab.color}" title="${esc(ab.desc)}"><span class="sp-ic">${ICONS[ab.icon] || ''}</span>${mark ? `<kbd>${mark.toUpperCase()}</kbd>` : ''}<b>${esc(ab.name)}</b></button>`;
  }).join('');
  const cur = SPELL_POOL[spells[active]];
  return `<div class="sp-slots">${slots}</div><div class="sp-opts">${opts}</div><p class="sp-desc"><b style="color:${cur.color}">${esc(cur.name)}</b> · ${esc(cur.desc)} <i>Recarga de ${cur.cd} s.</i></p>`;
}

export function heroCard(heroId, big = false) {
  const h = HEROES[heroId];
  const abil = ['q', 'w', 'e', 'r']
    .map((s) => {
      const ab = h.abilities[s];
      return `<div class="hc-ab" title="${esc(ab.desc)}"><span class="hc-key">${s.toUpperCase()}</span><span class="hc-icon">${ICONS[ab.icon] || ''}</span><span class="hc-name">${esc(ab.name)}${big ? `<small>${esc(ab.desc)}</small>` : ''}</span></div>`;
    })
    .join('');
  return `<div class="hero-card${big ? ' big' : ''}" style="--c:${h.color}">
    <div class="hc-top"><div class="hc-badge">${h.name[0]}</div><div><div class="hc-title">${h.name}</div><div class="hc-role">${h.title} · ${h.ranged ? 'à distância' : 'corpo a corpo'}</div></div></div>
    <div class="hc-abs">${abil}</div>
  </div>`;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      root: $('hud'),
      kBlue: $('k-blue'),
      kRed: $('k-red'),
      clock: $('clock'),
      wave: $('wave-in'),
      feed: $('feed'),
      announce: $('announce'),
      dead: $('dead'),
      deadCount: $('dead-count'),
      portrait: $('portrait'),
      letter: $('portrait-letter'),
      lvl: $('lvl'),
      xp: $('xp-fill'),
      hpFill: $('hp-fill'),
      hpShield: $('hp-shield'),
      hpText: $('hp-text'),
      skills: $('skills'),
      stats: $('stats'),
      items: $('items'),
      gold: $('gold-num'),
      goldBtn: $('gold'),
      minimap: $('minimap'),
      camMode: $('cam-mode'),
      shop: $('shop'),
      board: $('board'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.skillEls = {};
    this.heroId = null;
    this.annT = 0;
    this.itemsKey = '';
    this.shopKey = '';
    this.buildShop();
    this.el.goldBtn.addEventListener('click', () => game.toggleShop());
    this.el.skills.addEventListener('click', (e) => {
      const b = e.target.closest('[data-up]');
      if (b) game.rankUp(b.dataset.up);
    });
    $('shop-close').addEventListener('click', (e) => {
      e.stopPropagation();
      game.toggleShop(false);
    });
  }

  show(v) {
    this.el.root.classList.toggle('hidden', !v);
  }

  buildSkills(heroId, spells = null) {
    this.heroId = heroId;
    this.spellKey = spells ? spells.d + spells.f : '';
    const h = HEROES[heroId];
    this.el.skills.innerHTML = '';
    this.skillEls = {};
    for (const slot of SLOTS) {
      const ab = abilityOf(heroId, slot, spells);
      const d = document.createElement('div');
      d.className = 'skill' + (slot === 'd' || slot === 'f' ? ' spell' : '') + (slot === 'r' ? ' ult' : '');
      d.style.setProperty('--c', ab.color || h.color);
      const max = RANK_MAX[slot] || 0;
      const pips = max ? `<div class="sk-rank">${'<i></i>'.repeat(max)}</div><button class="sk-up" data-up="${slot}" title="Evoluir (Shift+${slot.toUpperCase()})">+</button>` : '';
      d.innerHTML = `<div class="sk-icon">${ICONS[ab.icon] || ''}</div><div class="sk-cd"></div><div class="sk-num"></div><div class="sk-key">${slot.toUpperCase()}</div>${pips}<div class="tip">${abilityTip(ab, slot)}</div>`;
      this.el.skills.appendChild(d);
      this.skillEls[slot] = { root: d, ab, tip: d.querySelector('.tip'), tipKey: '', cd: d.querySelector('.sk-cd'), num: d.querySelector('.sk-num'), pips: [...d.querySelectorAll('.sk-rank i')], rank: -1 };
    }
    this.el.portrait.style.setProperty('--c', h.color);
    this.el.letter.textContent = h.name[0];
  }

  flashSkill(slot) {
    const s = this.skillEls[slot];
    if (!s) return;
    s.root.classList.remove('deny');
    void s.root.offsetWidth;
    s.root.classList.add('deny');
  }

  update(dt) {
    const g = this.game;
    const me = g.me;
    const st = g.meState;
    this.el.kBlue.textContent = g.kills[0];
    this.el.kRed.textContent = g.kills[1];
    const t = Math.max(0, Math.floor(g.gameTime));
    this.el.clock.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.el.wave.textContent = g.phase === 'playing' && g.waveIn > 0 && g.waveIn < 8 ? `tropas em ${Math.ceil(g.waveIn)}` : '';
    if (this.annT > 0) {
      this.annT -= dt;
      if (this.annT <= 0) this.el.announce.classList.remove('on');
    }
    if (!me || !st) return;
    const spells = g.mySpells;
    if (me.heroId !== this.heroId || (spells ? spells.d + spells.f : '') !== this.spellKey) this.buildSkills(me.heroId, spells);
    const total = Math.max(me.maxHp, me.hp + me.shield);
    this.el.hpFill.style.width = `${(me.hp / total) * 100}%`;
    this.el.hpShield.style.left = `${(me.hp / total) * 100}%`;
    this.el.hpShield.style.width = `${(me.shield / total) * 100}%`;
    this.el.hpText.textContent = `${Math.ceil(me.hp)} / ${Math.round(me.maxHp)}${me.shield > 0 ? ` (+${me.shield})` : ''}`;
    this.el.lvl.textContent = st.lv;
    this.el.xp.style.height = `${st.lv >= 18 ? 100 : (st.xp / st.xn) * 100}%`;
    this.el.gold.textContent = st.g;
    this.el.goldBtn.classList.toggle('can', !!st.sh);
    this.el.skills.classList.toggle('has-points', st.pt > 0);
    this.el.skills.dataset.pt = st.pt > 0 ? `+${st.pt} ${st.pt === 1 ? 'ponto' : 'pontos'} · Shift + tecla` : '';
    SLOTS.forEach((slot, i) => {
      const s = this.skillEls[slot];
      if (!s) return;
      const cd = st.cd[i];
      const max = st.cm[i] || 1;
      const ranks = { q: st.rk[0], w: st.rk[1], e: st.rk[2], r: st.rk[3] };
      const rank = ranks[slot] ?? 1;
      const locked = !!RANK_MAX[slot] && rank <= 0;
      if (RANK_MAX[slot]) {
        s.root.classList.toggle('up', canRankUp(st.lv, ranks, slot));
        if (rank !== s.rank) {
          s.rank = rank;
          s.pips.forEach((p, n) => p.classList.toggle('on', n < rank));
        }
      }
      // a dica acompanha nível, pontos e atributos de agora
      const tipKey = `${st.lv}|${rank}|${st.s[0]}|${st.s[1]}|${st.s[7]}|${Math.round(me.maxHp)}`;
      if (tipKey !== s.tipKey) {
        s.tipKey = tipKey;
        s.tip.innerHTML = abilityTip(s.ab, slot, { lv: st.lv, rank: RANK_MAX[slot] ? rank : 1, atk: st.s[0], pow: st.s[1], haste: st.s[7], hp: me.maxHp });
      }
      s.root.classList.toggle('locked', locked);
      s.root.classList.toggle('ready', cd <= 0 && !locked);
      s.root.classList.toggle('aiming', g.aiming === slot);
      s.cd.style.setProperty('--p', cd > 0 ? Math.min(1, cd / max) : 0);
      s.num.textContent = cd > 0 ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : locked && slot === 'r' && st.lv < ULT_LEVELS[0] ? String(ULT_LEVELS[0]) : '';
    });
    const s = st.s;
    const statsHtml = [
      ['ataque', s[0], 'atk'],
      ['poder', s[1], 'pow'],
      ['armadura', s[2], 'arm'],
      ['resist.', s[3], 'mr'],
      ['vel. ataque', s[4].toFixed(2), 'as'],
      ['passo', s[5].toFixed(1), 'ms'],
      ['aceleração', s[7], 'ah'],
      ['roubo', s[8] + '%', 'ls'],
    ]
      .map(([l, v, k]) => `<div class="st st-${k}" title="${l}"><i></i>${v}</div>`)
      .join('');
    if (statsHtml !== this.statsKey) {
      this.statsKey = statsHtml;
      this.el.stats.innerHTML = statsHtml;
    }
    const key = st.it.join(',');
    if (key !== this.itemsKey) {
      this.itemsKey = key;
      this.el.items.innerHTML = Array.from({ length: 6 }, (_, i) => {
        const id = st.it[i];
        if (!id) return '<div class="item empty"></div>';
        const it = ITEMS[id];
        return `<div class="item ${tierClass(id)}" style="--c:${itemColor(id)}">${itemIcon(id)}<div class="tip"><b>${esc(it.name)}</b><span>${itemStats(it, this.heroId)}</span></div></div>`;
      }).join('');
    }
    this.el.dead.classList.toggle('hidden', me.alive || g.phase !== 'playing');
    if (!me.alive) this.el.deadCount.textContent = Math.ceil(me.respawn);
    if (!this.el.shop.classList.contains('hidden')) this.updateShop();
    if (!this.el.board.classList.contains('hidden')) this.renderBoard();
  }

  announce(text, sub, color) {
    const a = this.el.announce;
    a.querySelector('.an-title').textContent = text;
    a.querySelector('.an-sub').textContent = sub || '';
    a.style.setProperty('--c', color || '#f4c430');
    a.classList.remove('on');
    void a.offsetWidth;
    a.classList.add('on');
    this.annT = 3;
  }

  feed(html) {
    const d = document.createElement('div');
    d.className = 'kf';
    d.innerHTML = html;
    this.el.feed.prepend(d);
    while (this.el.feed.children.length > 6) this.el.feed.lastChild.remove();
    setTimeout(() => d.classList.add('fade'), 6000);
    setTimeout(() => d.remove(), 7000);
  }

  // ---------- loja ----------
  // Abas (recomendados / todos) à esquerda com os itens só como ícone e preço;
  // à direita ficam seu inventário, a árvore de montagem e os detalhes do item apontado.

  shopTile(id, extra = '') {
    const it = ITEMS[id];
    const aff = affinityOf(this.shopHero || this.heroId);
    const hit = Object.keys(it.stats).some((k) => aff.includes(k));
    return `<button class="tile ${tierClass(id)}${extra}${hit ? ' aff' : ''}" data-id="${id}" style="--c:${itemColor(id)}"><span class="tile-icon">${itemIcon(id)}</span>${hit ? '<span class="tile-aff" title="Combina com a sua classe">★</span>' : ''}<span class="tile-cost">${it.cost}</span></button>`;
  }

  buildShop() {
    this.shopTab = 'rec';
    this.shopCat = 'all';
    this.shopSel = null;
    this.shopHover = null;
    this.sellSel = -1;
    $('shop-filters').innerHTML = SHOP_CATS.map((c) => `<button data-cat="${c.id}" title="${c.name}">${c.icon}<span>${c.name}</span></button>`).join('');
    const root = this.el.shop;
    const pick = (e, sel) => e.target.closest?.(sel);
    root.addEventListener('click', (e) => {
      const tab = pick(e, '[data-tab]');
      const cat = pick(e, '[data-cat]');
      const tile = pick(e, '.tile');
      const slot = pick(e, '.inv-slot[data-n]');
      if (tab) this.shopTab = tab.dataset.tab;
      else if (cat) this.shopCat = cat.dataset.cat;
      else if (tile) {
        // clicar seleciona; clicar de novo no item já selecionado compra
        if (this.shopSel === tile.dataset.id && tile.closest('.shop-list')) this.game.buy(tile.dataset.id);
        this.shopSel = tile.dataset.id;
        this.sellSel = -1;
      } else if (slot) {
        this.sellSel = Number(slot.dataset.n);
        this.shopSel = slot.dataset.id;
      } else if (pick(e, '#shop-buy')) this.game.buy(this.shopSel);
      else if (pick(e, '#shop-sell') && this.sellSel >= 0) {
        this.game.sell(this.sellSel);
        this.sellSel = -1;
      } else return;
      this.updateShop(true);
    });
    // botão direito: compra o item (em qualquer lista) ou vende o do inventário, direto.
    // Escuta os dois eventos porque nem todo navegador/mouse entrega o mesmo; o tempo evita contar duas vezes.
    let lastRight = 0;
    const right = (e) => {
      if (e.type === 'mousedown' && e.button !== 2) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastRight < 250) return;
      const tile = pick(e, '.tile');
      const slot = pick(e, '.inv-slot[data-n]');
      if (!tile && !slot) return;
      lastRight = now;
      if (tile) {
        this.shopSel = tile.dataset.id;
        this.sellSel = -1;
        this.game.buy(tile.dataset.id);
      } else {
        this.game.sell(Number(slot.dataset.n));
        this.sellSel = -1;
      }
      this.updateShop(true);
    };
    root.addEventListener('mousedown', right);
    root.addEventListener('contextmenu', right);
    root.addEventListener('mouseover', (e) => {
      const id = pick(e, '.tile, .inv-slot[data-id]')?.dataset.id || null;
      if (id === this.shopHover) return;
      this.shopHover = id;
      this.updateShop(true);
    });
  }

  // a ordem de compra indicada pro herói atual (a mesma que os bots seguem)
  buildRecommended(heroId) {
    this.shopHero = heroId;
    this.shopSel = null;
    const h = HEROES[heroId];
    const build = BUILDS[h.role] || BUILDS.lutador;
    const alt = BUILDS_ALT[h.role];
    this.shopBuild = build;
    const start = [...new Set(build.slice(0, 2).flatMap((id) => missingBasics([], id)))];
    const aff = affinityOf(heroId);
    const row = (ids) => `<div class="tiles">${ids.map((id, i) => this.shopTile(id).replace('<span class="tile-icon">', `<span class="tile-n">${i + 1}</span><span class="tile-icon">`)).join('')}</div>`;
    $('shop-rec').innerHTML =
      `<p class="rec-why"><b style="color:${h.color}">${esc(h.name)}</b> · ${esc(BUILD_WHY[h.role] || '')}</p>` +
      `<p class="rec-aff"><b>★ Afinidade:</b> itens rendem +${Math.round(AFFINITY_BONUS * 100)}% de ${aff.map((k) => esc(STAT_LABEL[k].split(' (')[0])).join(', ')} em você.</p>` +
      `<h3>Comece por</h3><div class="tiles">${start.map((id) => this.shopTile(id)).join('')}</div>` +
      `<h3>Build principal, na ordem</h3>${row(build)}` +
      (alt ? `<h3>Outro caminho · ${esc(alt.name)}</h3>${row(alt.items)}` : '');
    const tiers = ['Básicos', 'Intermediários', 'Grandes'];
    $('shop-all').innerHTML = tiers.map((name, t) => `<h3>${name}</h3><div class="tiles">${ITEM_ORDER.filter((id) => itemTier(id) === t).map((id) => this.shopTile(id)).join('')}</div>`).join('');
    this.shopKey = '';
  }

  shopPrice(st, id) {
    const p = itemPrice(st.it, id);
    const why = !st.sh ? 'Só na base ou quando cair' : p.clash ? 'Você já tem uma bota' : !p.fits ? 'Inventário cheio' : st.g < p.cost ? `Faltam ${p.cost - st.g} de ouro` : '';
    return { cost: p.cost, ok: !why, why };
  }

  shopNext(st) {
    for (const id of this.shopBuild || []) {
      if (st.it.includes(id)) continue;
      return nextBuy(st.it, st.g, id) || missingBasics(st.it, id)[0] || id;
    }
    return null;
  }

  updateShop(force = false) {
    const g = this.game;
    const st = g.meState;
    if (!st) return;
    $('shop-gold').textContent = st.g;
    const where = $('shop-where');
    where.textContent = st.sh ? 'Pode comprar' : 'Só compra na base ou quando cair';
    where.classList.toggle('bad', !st.sh);
    const heroId = g.me?.heroId;
    if (heroId && heroId !== this.shopHero) {
      this.buildRecommended(heroId);
      force = true;
    }
    const key = st.g + '|' + st.it.join(',') + '|' + st.sh + '|' + (st.sp || []).join(',');
    if (key === this.shopKey && !force) return;
    this.shopKey = key;
    if (this.sellSel >= st.it.length) this.sellSel = -1;
    const next = this.shopNext(st);
    if (!this.shopSel) this.shopSel = next || ITEM_ORDER[0];
    const shown = this.shopHover || this.shopSel;

    for (const b of this.el.shop.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === this.shopTab);
    $('shop-rec').classList.toggle('hidden', this.shopTab !== 'rec');
    $('shop-all').classList.toggle('hidden', this.shopTab !== 'all');
    $('shop-filters').classList.toggle('hidden', this.shopTab !== 'all');
    for (const b of this.el.shop.querySelectorAll('[data-cat]')) b.classList.toggle('on', b.dataset.cat === this.shopCat);
    const cat = SHOP_CATS.find((c) => c.id === this.shopCat);

    // lado direito: inventário, árvore do item selecionado e detalhes do item apontado
    $('shop-inv').innerHTML = Array.from({ length: 6 }, (_, i) => {
      const id = st.it[i];
      if (!id) return '<div class="inv-slot empty"></div>';
      const full = (st.sp?.[i] ?? 0) >= ITEMS[id].cost;
      return `<button class="inv-slot ${tierClass(id)}${i === this.sellSel ? ' sel' : ''}${full ? ' refund' : ''}" data-n="${i}" data-id="${id}" style="--c:${itemColor(id)}" title="Botão direito vende por ${st.sp?.[i] ?? 0}">${itemIcon(id)}<small>${st.sp?.[i] ?? ''}</small></button>`;
    }).join('');
    const sel = ITEMS[this.shopSel];
    const into = ITEM_ORDER.filter((id) => ITEMS[id].from?.includes(this.shopSel));
    $('shop-tree').innerHTML =
      (into.length ? `<h3>Vira</h3><div class="tiles small">${into.map((id) => this.shopTile(id)).join('')}</div>` : '') +
      `<h3>Montagem</h3><div class="tree"><div class="tiles">${this.shopTile(this.shopSel)}</div>${sel.from ? `<div class="tree-line" style="--n:${sel.from.length}"></div><div class="tiles">${sel.from.map((id) => this.shopTile(id)).join('')}</div>` : '<small>Item básico: não precisa de nada antes.</small>'}</div>`;
    const it = ITEMS[shown];
    const p = this.shopPrice(st, shown);
    $('shop-detail').innerHTML =
      `<div class="sd-head ${tierClass(shown)}" style="--c:${itemColor(shown)}"><span class="tile-icon">${itemIcon(shown)}</span><div><b>${esc(it.name)}</b><span class="sd-cost"><span class="coin"></span>${p.cost}${p.cost < it.cost ? ` <s>${it.cost}</s>` : ''}</span></div></div>` +
      `<ul class="sd-stats">${itemStats(it, this.shopHero, '|').split('|').map((s) => `<li>${s}</li>`).join('')}</ul>` +
      (it.from ? `<p>Aproveita o que você já tiver de: ${it.from.map((c) => esc(ITEMS[c].name)).join(' e ')}.</p>` : '') +
      (it.group ? '<p>Só uma bota por herói.</p>' : '');
    const ps = this.shopPrice(st, this.shopSel);
    const buy = $('shop-buy');
    buy.disabled = !ps.ok;
    buy.innerHTML = ps.ok ? `COMPRAR · ${ps.cost}` : esc(ps.why);
    const sell = $('shop-sell');
    sell.disabled = this.sellSel < 0;
    const sp = this.sellSel >= 0 ? st.sp?.[this.sellSel] ?? 0 : 0;
    sell.textContent = this.sellSel >= 0 ? `Vender (+${sp})${sp >= ITEMS[st.it[this.sellSel]].cost ? ' · devolve tudo' : ''}` : 'Vender';

    for (const b of this.el.shop.querySelectorAll('.tile')) {
      const id = b.dataset.id;
      const pr = this.shopPrice(st, id);
      b.querySelector('.tile-cost').textContent = pr.cost;
      b.classList.toggle('afford', pr.ok);
      b.classList.toggle('owned', st.it.includes(id));
      b.classList.toggle('sel', id === this.shopSel);
      b.classList.toggle('next', id === next && !!b.closest('#shop-rec'));
      b.classList.toggle('off', !!b.closest('#shop-all') && !!cat?.stats && !Object.keys(ITEMS[id].stats).some((k) => cat.stats.includes(k)));
    }
  }

  // ---------- placar ----------

  boardRows(team, withItems = true) {
    const g = this.game;
    const rows = [];
    for (const [id, r] of g.roster) {
      if (r.team !== team) continue;
      const b = g.board.get(id) || [id, 0, 0, 0, 0, 0, [], 0, 0, 0];
      const h = HEROES[HERO_ORDER[r.heroIdx]] || HEROES.faisca;
      const items = withItems ? `<td><div class="b-items">${(b[6] || []).map((it) => `<span class="mini-item" style="--c:${itemColor(it)}">${itemIcon(it)}</span>`).join('')}</div></td>` : '';
      rows.push(
        `<tr class="${id === g.myId ? 'me' : ''}"><td><span class="b-hero" style="--c:${h.color}">${h.name[0]}</span></td><td class="b-name">${esc(r.name)}${r.isBot ? ' <small>bot</small>' : ''}<small class="b-sub">${h.name} · nv ${b[5]}</small></td><td class="n">${b[1]} / ${b[2]} / ${b[3]}</td><td class="n">${b[4]} <small>cs</small></td>${items}<td class="n">${Math.round(b[8] / 100) / 10}k <small>dano</small></td></tr>`,
      );
    }
    return rows.join('');
  }

  renderBoard() {
    const g = this.game;
    $('board-blue').innerHTML = this.boardRows(0);
    $('board-red').innerHTML = this.boardRows(1);
    $('bk-blue').textContent = g.kills[0];
    $('bk-red').textContent = g.kills[1];
  }

  // ---------- minimapa ----------

  drawMinimap() {
    const g = this.game;
    const c = this.mm;
    const W = c.canvas.width;
    const H = c.canvas.height;
    const sx = W / 212;
    const flip = g.flip;
    const X = (x) => W / 2 + x * flip * sx;
    const Z = (z) => H / 2 + z * flip * sx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(16,52,64,0.92)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#b9a98c';
    c.fillRect(X(-MAP.laneHalf * flip), Z(-MAP.laneWidth * flip), MAP.laneHalf * 2 * sx, MAP.laneWidth * 2 * sx);
    for (const bx of [-MAP.baseX, MAP.baseX]) {
      c.beginPath();
      c.arc(X(bx), Z(0), MAP.baseR * sx, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#7c7368';
    for (const o of OBSTACLES) {
      c.beginPath();
      c.arc(X(o.x), Z(o.z), Math.max(1.5, o.r * sx), 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < g.packs.length; i++) {
      if (!g.packs[i].up) continue;
      c.fillStyle = '#4ade80';
      c.beginPath();
      c.arc(X(g.packs[i].x), Z(g.packs[i].z), 2.5, 0, Math.PI * 2);
      c.fill();
    }
    const mine = g.myTeam;
    for (const u of g.units.values()) {
      if (!u.alive || u.kind === 'hero') continue;
      const col = u.team === mine ? '#5aaeff' : '#ff5470';
      c.fillStyle = col;
      if (u.kind === 'tower' || u.kind === 'selo' || u.kind === 'core') {
        const s = u.kind === 'core' ? 7 : 5;
        c.fillRect(X(u.x) - s / 2, Z(u.z) - s / 2, s, s);
        c.strokeStyle = 'rgba(0,0,0,0.6)';
        c.strokeRect(X(u.x) - s / 2, Z(u.z) - s / 2, s, s);
      } else c.fillRect(X(u.x) - 1, Z(u.z) - 1, 2.2, 2.2);
    }
    for (const u of g.units.values()) {
      if (u.kind !== 'hero' || !u.alive) continue;
      c.fillStyle = u.def?.color || '#fff';
      c.beginPath();
      c.arc(X(u.x), Z(u.z), 4.5, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = u.id === g.myId ? 2.5 : 1.8;
      c.strokeStyle = u.id === g.myId ? '#f4c430' : u.team === mine ? '#4aa3ff' : '#f43f5e';
      c.stroke();
    }
    const view = g.viewPolygon();
    if (view) {
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1;
      c.beginPath();
      view.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z))));
      c.closePath();
      c.stroke();
    }
  }

  minimapToWorld(px, py) {
    const W = this.el.minimap.width;
    const H = this.el.minimap.height;
    const sx = W / 212;
    const flip = this.game.flip;
    return [((px - W / 2) / sx) * flip, ((py - H / 2) / sx) * flip];
  }
}

const ITEM_COLORS = {
  botas: '#a3a3a3',
  lamina: '#fb923c',
  arco: '#facc15',
  cristal: '#818cf8',
  colete: '#a8a29e',
  capa: '#c084fc',
  pedra: '#f87171',
  facao: '#ef4444',
  vento: '#fde047',
  lanca: '#f97316',
  tiara: '#a78bfa',
  gema: '#8b5cf6',
  jabuti: '#84cc16',
  lua: '#60a5fa',
  fonte: '#22d3ee',
};
const STAT_COLOR = { atk: '#fb923c', as: '#facc15', crit: '#fde047', ls: '#ef4444', pen: '#f97316', onhit: '#fbbf24', pow: '#818cf8', mpen: '#a78bfa', sv: '#c084fc', haste: '#38bdf8', hsp: '#22d3ee', regen: '#34d399', hp: '#f87171', armor: '#84cc16', mres: '#60a5fa', thorns: '#65a30d', ten: '#2dd4bf', ms: '#a3a3a3' };
// a cor vem do primeiro atributo; nas botas melhoradas o passo é comum a todas, então vale o atributo que cada uma acrescenta
export const itemColor = (id) => {
  if (ITEM_COLORS[id]) return ITEM_COLORS[id];
  const keys = Object.keys(ITEMS[id]?.stats || {});
  return STAT_COLOR[keys.find((k) => k !== 'ms' || keys.length === 1)] || '#e5e7eb';
};

export function teamColor(t) {
  return TEAMS[t].color;
}
