// Estilo visual e sonoro de cada herói: que cara têm os tiros, os golpes e as habilidades.
// Só aparência: nenhum número daqui muda as regras da partida.

// Elementos: paleta das partículas e como elas se comportam (g = gravidade, up = impulso pra cima).
export const ELEMENTS = {
  neutral: { cols: ['#ffffff', '#cbd5e1', '#94a3b8'], g: 10, up: 3 },
  spark: { cols: ['#ffb35c', '#ffe08a', '#ffffff', '#ff6b35'], g: 13, up: 4.5 },
  arrow: { cols: ['#5eead4', '#ffffff', '#d6c08a'], g: 5, up: 2 },
  thunder: { cols: ['#c4b5fd', '#ffffff', '#8b5cf6', '#e9d5ff'], g: 0, up: 1.2 },
  sting: { cols: ['#fde047', '#fff7b0', '#eab308'], g: 0, up: 0.6 },
  thorn: { cols: ['#a3e635', '#d6c08a', '#4d7c0f', '#b8a37a'], g: 11, up: 3.2 },
  water: { cols: ['#7dd3fc', '#e0f2fe', '#3b82f6', '#bae6fd'], g: 14, up: 6 },
  fire: { cols: ['#ff7a1a', '#ffd166', '#f472b6', '#ff4d2e'], g: -4, up: 2.2 },
  wind: { cols: ['#ffffff', '#fca5a5', '#e5e7eb'], g: -1.2, up: 1.4 },
  swamp: { cols: ['#4ade80', '#86efac', '#a855f7', '#365314', '#d9f99d'], g: 7, up: 3.4 },
  ember: { cols: ['#ff3d00', '#ffb020', '#ffe08a', '#ff7a1a', '#7c2d12'], g: -4.5, up: 2.4 },
};

// auto: forma do tiro do ataque básico (atiradores) · slash: rastro do golpe (corpo a corpo)
// proj: forma do projétil de cada habilidade (por tecla) · snd: sons no lugar dos genéricos
export const HERO_FX = {
  faisca: {
    el: 'spark',
    auto: 'tracer',
    muzzle: true,
    proj: { q: 'tracer', r: 'comet' },
    snd: { shoot: 'gun', hit: 'ricochet', cast: 'gun', boom: 'blast' },
  },
  coruja: {
    el: 'arrow',
    auto: 'arrow',
    proj: { q: 'arrow', w: 'net', r: 'arrowBig' },
    snd: { shoot: 'bow', hit: 'thunk', cast: 'bow', boom: 'thunk' },
  },
  trovao: {
    el: 'thunder',
    slash: 'smash',
    snd: { swing: 'heavySwing', hit: 'thunderHit', cast: 'thunderCast', boom: 'thunder' },
  },
  vespa: {
    el: 'sting',
    slash: 'double',
    snd: { swing: 'sting', hit: 'stab', cast: 'sting', boom: 'swarm' },
  },
  mandacaru: {
    el: 'thorn',
    slash: 'bash',
    proj: { q: 'thorns' },
    snd: { swing: 'heavySwing', hit: 'bash', cast: 'rustle', boom: 'bash' },
  },
  iara: {
    el: 'water',
    auto: 'orb',
    proj: { q: 'wave', r: 'wave' },
    snd: { shoot: 'bubble', hit: 'splash', cast: 'water', boom: 'splash', heal: 'chime' },
  },
  boitata: {
    el: 'fire',
    auto: 'fireball',
    proj: { q: 'fireball' },
    snd: { shoot: 'fire', hit: 'sizzle', cast: 'fire', boom: 'fireBoom' },
  },
  saci: {
    el: 'wind',
    slash: 'wide',
    snd: { swing: 'blade', hit: 'slice', cast: 'gust', boom: 'gust' },
  },
  cuca: {
    el: 'swamp',
    slash: 'bite',
    snd: { swing: 'heavySwing', hit: 'chomp', cast: 'growl', boom: 'chomp' },
  },
  curupira: {
    el: 'ember',
    auto: 'ember',
    proj: { q: 'torch' },
    snd: { shoot: 'fire', hit: 'sizzle', cast: 'whistle', boom: 'fireBoom' },
  },
};

const NONE = { el: 'neutral', snd: {} };

export function fxOf(heroId) {
  return HERO_FX[heroId] || NONE;
}

// forma do projétil a partir do evento 'pj' (k: 'a' básico, 's' habilidade, 't' torre)
export function projShape(style, m) {
  if (m.k === 'a') return style.auto || 'bolt';
  if (m.k === 's') return style.proj?.[m.sl] || (style.el === 'neutral' ? 'bolt' : 'orbEl');
  return 'bolt';
}
