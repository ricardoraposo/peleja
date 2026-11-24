// Tudo que dá pra balancear mora aqui.

export const TEAMS = [
  { name: 'Azul', color: '#4aa3ff', side: -1 },
  { name: 'Vermelho', color: '#f43f5e', side: 1 },
];

export const MAP = {
  laneHalf: 70,
  laneWidth: 9,
  baseX: 84,
  baseR: 17,
  fountainX: 96,
  fountainLaser: 13,
  // voltar pra base: segundos parado canalizando (dano, andar ou agir cancela) e a cura da fonte
  recall: 8,
  fountainHealR: 6,
  fountainHeal: 0.12, // fração da vida máxima por segundo, pra quem está fora de combate há 3 s
  // canhão da base (posição do lado azul; o vermelho é espelhado): atira o herói pra `back` passos atrás da
  // torre mais avançada do time que ainda está de pé, na ordem de `to`. Dentro do cano o jogador tem `aim` segundos
  // pra escolher onde cair, até `range` passos desse ponto (se não escolher, cai nele). `load` = segundos de pavio,
  // `flight` = segundos no ar (intocável); na queda, inimigos no `radius` sobem por `knockup` segundos
  cannon: { x: -90, z: -8, r: 1.6, aim: 5, range: 8, load: 0.7, flight: 1.5, to: ['t1', 't2'], back: 5, radius: 3, knockup: 0.6 },
  // obstáculos do lado azul (x < 0); o lado vermelho é espelhado
  obstacles: [
    [-15, 5.8, 1.6],
    [-23, -6.2, 1.3],
    [-40, 6.4, 1.4],
    [-56, -6.6, 1.2],
    [0, 7.4, 1.1],
  ],
  // frutas de cura no meio da ponte
  packs: [
    [-9, -5.5],
    [-38, -1],
  ],
};

export const MATCH = {
  teamSize: 5,
  draftTime: 30,
  // herói sorteado: ninguém escolhe, só dá pra sortear de novo `rerolls` vezes por partida
  randomPick: true,
  rerolls: 2,
  startLevel: 3,
  maxLevel: 18,
  startGold: 1400,
  goldPerSec: 4,
  xpPerSec: 3.5,
  firstWave: 12,
  waveEvery: 26,
  packRespawn: 40,
  packHeal: 110,
  packHealPct: 0.08,
  assistWindow: 10,
  killGold: 300,
  firstBloodGold: 100,
  towerGold: 150,
  // habilidade em área fere estrutura com essa fração do dano (sem isso, time só de magos não derrubava torre)
  abilityStructDmg: 0.3,
  seloRespawn: 150,
  endDelay: 15,
  xpRange: 18,
};

// xp pra sair do nível L
export const xpToNext = (L) => 80 + 70 * L;
// renascer demora mais no fim do jogo, pra brigas decidirem a partida
export const respawnTime = (L, minutes = 0) => Math.min(40, 4 + 1.2 * L + Math.max(0, minutes - 10) * 1.1);

export const STRUCTS = [
  { key: 't1', kind: 'tower', x: -30, z: 2.6, hp: 2600, req: [] },
  { key: 't2', kind: 'tower', x: -48, z: -2.6, hp: 2800, req: ['t1'] },
  { key: 'selo', kind: 'selo', x: -63, z: 0, hp: 2100, req: ['t2'] },
  { key: 't3a', kind: 'tower', x: -73, z: 4.6, hp: 2400, req: ['selo'] },
  { key: 't3b', kind: 'tower', x: -73, z: -4.6, hp: 2400, req: ['selo'] },
  { key: 'core', kind: 'core', x: -84, z: 0, hp: 4200, req: ['t3a', 't3b'] },
];

export const TOWER = {
  range: 12.5,
  armor: 55,
  mres: 55,
  dmg: 165,
  dmgPerMin: 9,
  rampPerHit: 0.4,
  rampMax: 1.2,
  attackSpeed: 0.85,
  projSpeed: 24,
  // ataque básico de herói em estrutura: ataque inteiro + essa fração do poder; se o poder pesar mais que o ataque dos itens, o golpe vira mágico
  apRatio: 0.6,
  // e essa fração da vida máxima, pra tanque e suporte de vida também derrubarem torre
  hpRatio: 0.015,
  backdoorRange: 15,
  backdoorMult: 0.5,
  vsMinion: { melee: 0.45, ranged: 0.7, siege: 0.14, super: 0.08 },
};

export const STRUCT_SIZE = { tower: 1.5, selo: 1.9, core: 3.2 };

export const MINIONS = {
  melee: { hp: 470, atk: 13, armor: 8, mres: 0, as: 1.0, range: 1.4, ms: 4.4, r: 0.5, gold: 21, xp: 49 },
  ranged: { hp: 290, atk: 23, armor: 0, mres: 0, as: 0.75, range: 7.5, ms: 4.4, r: 0.45, gold: 15, xp: 26, proj: 20 },
  siege: { hp: 900, atk: 42, armor: 20, mres: 0, as: 0.5, range: 9.5, ms: 4.2, r: 0.75, gold: 52, xp: 78, proj: 16 },
  super: { hp: 1600, atk: 70, armor: 30, mres: 30, as: 0.85, range: 1.8, ms: 4.6, r: 0.8, gold: 40, xp: 77 },
  aggro: 9,
  growHp: 0.07, // por minuto
  growAtk: 0.06,
};

// Feitiços: cada jogador escolhe dois na tela de escolha, um pro D e outro pro F.
// Não evoluem com pontos; o que cresce (l) acompanha o nível do herói.
export const SPELL_POOL = {
  folego: { name: 'Fôlego', icon: 'leaf', kind: 'self', cd: 110, cast: 0, heal: { b: 90, l: 16 }, buff: { t: 1.6, ms: 0.35 }, color: '#5ee67a', desc: 'Cura um pouco e acelera por um instante.' },
  salto: { name: 'Salto', icon: 'blink', kind: 'blink', cd: 110, cast: 0, range: 6.5, flash: true, color: '#facc15', desc: 'Some num clarão e reaparece na mesma hora onde o mouse aponta.' },
  carapaca: { name: 'Carapaça', icon: 'shield', kind: 'self', cd: 90, cast: 0, shield: { b: 110, l: 22, t: 2.5 }, color: '#94a3b8', desc: 'Um escudo forte por 2,5 segundos.' },
  disparada: { name: 'Disparada', icon: 'wind', kind: 'self', cd: 80, cast: 0, buff: { t: 6, ms: 0.3 }, color: '#38bdf8', desc: 'Corre bem mais rápido por 6 segundos.' },
  brasa: { name: 'Brasa', icon: 'fire', kind: 'target', cd: 90, cast: 0, range: 6, heroesOnly: true, dmg: { b: 70, l: 16, type: 'true' }, color: '#fb923c', desc: 'Queima um herói inimigo com dano que ignora defesas.' },
  laco: { name: 'Laço', icon: 'net', kind: 'target', cd: 80, cast: 0, range: 6.5, heroesOnly: true, dmg: { b: 20, l: 4, type: 'magic' }, fx: { slow: [0.5, 2.5] }, color: '#c084fc', desc: 'Laça um herói inimigo e deixa ele bem lento.' },
};
export const SPELL_ORDER = Object.keys(SPELL_POOL);
export const DEFAULT_SPELLS = { d: 'folego', f: 'salto' };
export const SPELLS = { d: SPELL_POOL[DEFAULT_SPELLS.d], f: SPELL_POOL[DEFAULT_SPELLS.f] };

// dmg/heal/shield: b = base, l = por nível, ad = × ataque, ap = × poder, hp = × vida máxima
// fx: slow [porcentagem, segundos], stun, root, knockup, charm (segundos), knockback (distância)
// back: o projétil volta pra mão de quem lançou, ferindo de novo no caminho (speed e type da volta)
// bolts: n projéteis teleguiados nos inimigos próximos, heróis primeiro; repeat = fração do dano quando repete o alvo;
//        wait = segundos que eles esperam alguém chegar ao alcance
// charges: a habilidade pode ser usada n vezes em t segundos, com gap entre uma e outra; a recarga começa no fim
// fx.pull: puxa o alvo até tantos passos pra perto de quem lançou · fetch (em ally): arrasta o aliado mais perto do ponto pro seu lado
// grow: o projétil fere mais quanto mais longe voa (per = fração a mais por passo, até max)
// hover: se não acertar ninguém, o projétil para no ar por t segundos e dá pra lançar de novo (o segundo voo sai na direção do mouse, com speed, e só para ao acertar alguém
//        ou ao sair do círculo de raio reach em volta do herói; o círculo anda com ele, a pé ou de teleporte)
// trap: se errar, o projétil vira uma armadilha no chão (raio r, dura dur segundos, dispara no primeiro que pisar)
// fx.drowsy [segundos lento, segundos dormindo] · fx.wake: teto do dano extra de quem acordar o alvo
// steal: copia o último feitiço (D/F) que um herói inimigo lançou nos últimos `window` segundos
// ret: o salto (blink) volta sozinho pro ponto de partida depois de tantos segundos
export const HEROES = {
  faisca: {
    name: 'Faísca',
    title: 'Atiradora',
    role: 'atirador',
    color: '#ff6b35',
    look: { weapon: 'pistol', hat: 'visor', extra: 'poncho' },
    ranged: true,
    stats: { hp: 570, hpL: 92, atk: 62, atkL: 3.4, armor: 26, armorL: 2.8, mres: 30, mresL: 1.3, as: 0.68, asL: 0.032, ms: 5.95, range: 8.6, regen: 1.6, regenL: 0.15 },
    abilities: {
      q: { name: 'Rajada', icon: 'bolt', kind: 'proj', cd: 6, cast: 0.15, range: 13, speed: 34, width: 0.8, dmg: { b: 55, l: 17, ad: 0.95, type: 'phys' }, color: '#ffb35c', desc: 'Disparo reto que fere o primeiro inimigo.' },
      w: { name: 'Arrancada', icon: 'dash', kind: 'dash', cd: 12, cast: 0, range: 5, speed: 26, buff: { t: 3, as: 0.45 }, desc: 'Avança e ganha velocidade de ataque.' },
      e: { name: 'Bombinha', icon: 'bomb', kind: 'aoe', cd: 10, cast: 0.15, range: 11, radius: 3, delay: 0.55, dmg: { b: 50, l: 15, ad: 0.45, ap: 0.4, type: 'magic' }, fx: { slow: [0.35, 1.5] }, color: '#ff8a3d', desc: 'Explode numa área e deixa lento.' },
      r: { name: 'Chuva de Faíscas', icon: 'comet', kind: 'proj', cd: 60, cast: 0.3, range: 42, speed: 27, width: 1.6, heroesOnly: true, dmg: { b: 180, l: 26, ad: 1.0, type: 'phys' }, color: '#ffd166', desc: 'Um cometa que atravessa a ponte e atinge o primeiro herói.' },
    },
  },
  trovao: {
    name: 'Trovão',
    title: 'Brigão',
    role: 'lutador',
    color: '#8b5cf6',
    look: { weapon: 'hammer', hat: 'helm', scale: 1.1, bulk: 1.15, extra: 'pauldrons' },
    ranged: false,
    stats: { hp: 660, hpL: 104, atk: 66, atkL: 3.6, armor: 35, armorL: 3.1, mres: 32, mresL: 1.6, as: 0.66, asL: 0.024, ms: 6.1, range: 1.9, regen: 2.2, regenL: 0.22 },
    abilities: {
      q: { name: 'Martelada', icon: 'hammer', kind: 'cone', cd: 6, cast: 0.2, range: 3.8, angle: 75, dmg: { b: 80, l: 22, ad: 1.0, type: 'phys' }, fx: { slow: [0.3, 1.5] }, color: '#c4b5fd', desc: 'Pancada em leque que deixa lento.' },
      w: { name: 'Couraça', icon: 'shield', kind: 'self', cd: 14, cast: 0, shield: { b: 80, l: 24, hp: 0.08, t: 3 }, buff: { t: 3, armor: 25 }, desc: 'Escudo e armadura por 3 segundos.' },
      e: { name: 'Salto-foguete', icon: 'leap', kind: 'dash', cd: 13, cast: 0.05, range: 8, speed: 20, arc: true, end: { radius: 2.7, dmg: { b: 60, l: 15, ad: 0.6, type: 'phys' }, fx: { knockup: 0.65 } }, color: '#a78bfa', desc: 'Salta e joga pra cima quem estiver na queda.' },
      r: { name: 'Trovoada', icon: 'storm', kind: 'nova', cd: 70, cast: 0.15, radius: 5.5, delay: 0.55, dmg: { b: 170, l: 30, ad: 0.8, type: 'magic' }, fx: { stun: 1.3 }, color: '#8b5cf6', desc: 'Depois de um instante, atordoa todos ao redor.' },
    },
  },
  coruja: {
    name: 'Coruja',
    title: 'Franco-atiradora',
    role: 'atirador',
    color: '#14b8a6',
    look: { weapon: 'bow', hat: 'tufts', extra: 'quiver' },
    ranged: true,
    stats: { hp: 550, hpL: 88, atk: 64, atkL: 3.5, armor: 24, armorL: 2.7, mres: 30, mresL: 1.3, as: 0.64, asL: 0.03, ms: 5.9, range: 9.6, regen: 1.5, regenL: 0.15 },
    abilities: {
      q: { name: 'Agulha', icon: 'needle', kind: 'proj', cd: 8, cast: 0.25, range: 16, speed: 44, width: 0.55, dmg: { b: 80, l: 21, ad: 1.2, type: 'phys' }, color: '#5eead4', desc: 'Tiro longo e fino, muito dano.' },
      w: { name: 'Rede', icon: 'net', kind: 'proj', cd: 13, cast: 0.15, range: 10, speed: 28, width: 1.1, dmg: { b: 40, l: 10, ap: 0.3, type: 'magic' }, fx: { root: 1.3 }, color: '#99f6e4', desc: 'Prende o primeiro inimigo no lugar.' },
      e: { name: 'Revoada', icon: 'feather', kind: 'blink', cd: 14, cast: 0, range: 6, desc: 'Some e reaparece mais adiante.' },
      r: { name: 'Tiro Certeiro', icon: 'scope', kind: 'proj', cd: 55, cast: 1.0, range: 34, speed: 70, width: 0.9, heroesOnly: true, dmg: { b: 240, l: 44, ad: 1.4, type: 'phys' }, color: '#2dd4bf', desc: 'Mira por um segundo e dispara do outro lado da ponte.' },
    },
  },
  vespa: {
    name: 'Vespa',
    title: 'Caçadora',
    role: 'assassino',
    color: '#eab308',
    look: { weapon: 'stingers', hat: 'antennae', scale: 0.95, extra: 'wings' },
    ranged: false,
    stats: { hp: 660, hpL: 101, atk: 68, atkL: 3.8, armor: 34, armorL: 2.8, mres: 34, mresL: 1.8, as: 0.7, asL: 0.03, ms: 6.25, range: 1.9, regen: 1.9, regenL: 0.2 },
    abilities: {
      q: { name: 'Ferroada', icon: 'sting', kind: 'target', cd: 7, cast: 0, range: 6.5, dashTo: true, dmg: { b: 60, l: 19, ad: 1.0, type: 'phys' }, color: '#fde047', desc: 'Avança no alvo e fere.' },
      w: { name: 'Adrenalina', icon: 'heart', kind: 'self', cd: 14, cast: 0, heal: { b: 55, l: 17, ad: 0.3 }, buff: { t: 2.5, ms: 0.3, as: 0.3 }, desc: 'Cura e acelera ataque e passo.' },
      e: { name: 'Enxame', icon: 'swarm', kind: 'nova', cd: 9, cast: 0.1, radius: 3.3, delay: 0, dmg: { b: 50, l: 15, ad: 0.5, ap: 0.5, type: 'magic' }, fx: { slow: [0.4, 1.5] }, color: '#facc15', desc: 'Nuvem de ferrões ao redor que deixa lento.' },
      r: { name: 'Ferrão Mortal', icon: 'skull', kind: 'target', cd: 45, cast: 0, range: 5, dashTo: true, heroesOnly: true, exec: 1.2, dmg: { b: 140, l: 28, ad: 1.0, type: 'phys' }, color: '#eab308', desc: 'Golpe que fica mais forte quanto menos vida o alvo tem.' },
    },
  },
  mandacaru: {
    name: 'Mandacaru',
    title: 'Tanque',
    role: 'tanque',
    color: '#65a30d',
    look: { weapon: 'shield', hat: 'spikes', scale: 1.18, bulk: 1.3 },
    ranged: false,
    stats: { hp: 700, hpL: 112, atk: 60, atkL: 3.2, armor: 38, armorL: 3.2, mres: 32, mresL: 1.9, as: 0.62, asL: 0.02, ms: 6.0, range: 1.9, regen: 2.6, regenL: 0.25 },
    abilities: {
      q: { name: 'Espinhos', icon: 'thorns', kind: 'proj', cd: 10, cast: 0.2, range: 11, speed: 24, width: 1.2, dmg: { b: 60, l: 15, ap: 0.4, hp: 0.03, type: 'magic' }, fx: { stun: 0.9 }, color: '#a3e635', desc: 'Arremessa espinhos que atordoam.' },
      w: { name: 'Casca Grossa', icon: 'bark', kind: 'self', cd: 15, cast: 0, shield: { b: 60, l: 20, hp: 0.1, t: 4 }, buff: { t: 4, armor: 30, mres: 30 }, desc: 'Escudo, armadura e resistência mágica.' },
      e: { name: 'Raízes', icon: 'roots', kind: 'nova', cd: 9, cast: 0.1, radius: 4, delay: 0, dmg: { b: 40, l: 12, hp: 0.03, type: 'magic' }, fx: { slow: [0.5, 2] }, color: '#4d7c0f', desc: 'Raízes ao redor deixam todo mundo lento.' },
      r: { name: 'Florada', icon: 'flower', kind: 'dash', cd: 70, cast: 0.2, range: 10, speed: 22, path: { width: 2.4, dmg: { b: 140, l: 25, ap: 0.5, hp: 0.04, type: 'magic' }, fx: { knockup: 1.0 } }, color: '#bef264', desc: 'Investida que joga pra cima quem estiver no caminho.' },
    },
  },
  iara: {
    name: 'Iara',
    title: 'Suporte',
    role: 'suporte',
    color: '#3b82f6',
    look: { weapon: 'staff', hat: 'hair', robe: true, extra: 'scales' },
    ranged: true,
    stats: { hp: 560, hpL: 90, atk: 54, atkL: 2.8, armor: 26, armorL: 2.7, mres: 30, mresL: 1.3, as: 0.63, asL: 0.022, ms: 6.0, range: 8.2, regen: 1.8, regenL: 0.17 },
    abilities: {
      q: { name: 'Onda', icon: 'wave', kind: 'proj', cd: 7, cast: 0.2, range: 12, speed: 22, width: 1.3, pierce: true, dmg: { b: 60, l: 16, ap: 0.55, type: 'magic' }, fx: { slow: [0.25, 1.5] }, color: '#60a5fa', desc: 'Onda que atravessa todo mundo e deixa lento.' },
      w: { name: 'Água Viva', icon: 'drop', kind: 'ally', cd: 12, cast: 0.15, range: 10, radius: 3.4, heal: { b: 45, l: 12, ap: 0.35 }, color: '#7dd3fc', desc: 'Cura aliados numa área.' },
      e: { name: 'Bolha', icon: 'bubble', kind: 'ally', cd: 14, cast: 0, range: 0, radius: 6, shield: { b: 45, l: 14, ap: 0.35, t: 2.5 }, color: '#bae6fd', desc: 'Escudo em você e nos aliados por perto.' },
      r: { name: 'Maré Alta', icon: 'tide', kind: 'proj', cd: 75, cast: 0.3, range: 18, speed: 17, width: 4.2, pierce: true, dmg: { b: 150, l: 28, ap: 0.6, type: 'magic' }, fx: { knockback: 4, slow: [0.4, 2] }, color: '#3b82f6', desc: 'Uma onda gigante que empurra e fere todos.' },
    },
  },
  boitata: {
    name: 'Boitatá',
    title: 'Mago',
    role: 'mago',
    color: '#ec4899',
    look: { weapon: 'hands', hat: 'flame', robe: true, extra: 'embers' },
    ranged: true,
    stats: { hp: 545, hpL: 88, atk: 52, atkL: 2.8, armor: 24, armorL: 2.5, mres: 30, mresL: 1.3, as: 0.64, asL: 0.02, ms: 5.95, range: 8.3, regen: 1.6, regenL: 0.15 },
    abilities: {
      q: { name: 'Labareda', icon: 'fire', kind: 'proj', cd: 6, cast: 0.15, range: 12, speed: 26, width: 0.9, explode: 2.1, dmg: { b: 70, l: 22, ap: 0.6, type: 'magic' }, color: '#f472b6', desc: 'Bola de fogo que explode no primeiro inimigo.' },
      w: { name: 'Fogo-fátuo', icon: 'wisp', kind: 'aoe', cd: 12, cast: 0.15, range: 10, radius: 2.6, delay: 0.75, dmg: { b: 70, l: 19, ap: 0.6, type: 'magic' }, fx: { stun: 1.1 }, color: '#f9a8d4', desc: 'Depois de um instante, atordoa quem estiver na área.' },
      e: { name: 'Serpentear', icon: 'snake', kind: 'dash', cd: 13, cast: 0, range: 6, speed: 30, buff: { t: 2, ms: 0.25 }, desc: 'Desliza rápido e ganha velocidade.' },
      r: { name: 'Incêndio', icon: 'blaze', kind: 'zone', cd: 70, cast: 0.25, range: 11, radius: 4.6, dur: 4, tick: 0.5, dmg: { b: 50, l: 10, ap: 0.18, type: 'magic' }, fx: { slow: [0.3, 0.6] }, color: '#ec4899', desc: 'Incendeia o chão: queima e deixa lento por 4 s.' },
    },
  },
  saci: {
    name: 'Saci',
    title: 'Duelista',
    role: 'lutador',
    color: '#dc2626',
    look: { weapon: 'sword', hat: 'cap', oneLeg: true, pipe: true },
    ranged: false,
    stats: { hp: 680, hpL: 104, atk: 66, atkL: 3.7, armor: 36, armorL: 2.9, mres: 34, mresL: 1.9, as: 0.7, asL: 0.028, ms: 6.3, range: 1.9, regen: 2, regenL: 0.2 },
    abilities: {
      q: { name: 'Redemoinho', icon: 'spin', kind: 'nova', cd: 6, cast: 0.1, radius: 3.4, delay: 0, dmg: { b: 70, l: 19, ad: 0.9, type: 'phys' }, color: '#f87171', desc: 'Gira e fere todo mundo em volta.' },
      w: { name: 'Pulo de uma perna', icon: 'hop', kind: 'dash', cd: 10, cast: 0, range: 6, speed: 26, arc: true, end: { radius: 2.2, dmg: { b: 40, l: 12, ad: 0.6, type: 'phys' }, fx: { slow: [0.35, 1.2] } }, color: '#fca5a5', desc: 'Pula e deixa lento quem estiver na queda.' },
      e: { name: 'Gorro Encantado', icon: 'cap', kind: 'self', cd: 14, cast: 0, buff: { t: 3, ms: 0.4, as: 0.45 }, desc: 'Fica muito rápido por 3 segundos.' },
      r: { name: 'Ventania', icon: 'tornado', kind: 'self', cd: 60, cast: 0.1, buff: { t: 4, ms: 0.3, aura: { radius: 3.4, tick: 0.5, dmg: { b: 45, l: 9, ad: 0.3, type: 'phys' } } }, color: '#dc2626', desc: 'Vira um redemoinho por 4 s, ferindo quem chegar perto.' },
    },
  },
  cuca: {
    name: 'Cuca',
    title: 'Bruxa-jacaré',
    role: 'lutador',
    color: '#22c55e',
    look: { weapon: 'claws', hat: 'gator', scale: 1.1, bulk: 1.2, extra: 'tail', skin: '#3f7d3a' },
    ranged: false,
    fury: { max: 100, cost: 50, auto: 5, lowHp: 1.5, idle: 6, decay: 5 },
    skillOrder: ['q', 'e', 'w'],
    stats: { hp: 650, hpL: 102, atk: 67, atkL: 3.7, armor: 34, armorL: 3.1, mres: 32, mresL: 1.6, as: 0.665, asL: 0.025, ms: 6.1, range: 1.9, regen: 2.2, regenL: 0.2 },
    abilities: {
      q: { name: 'Bocada Faminta', icon: 'jaws', kind: 'nova', cd: 7, cast: 0.1, radius: 3.6, delay: 0, dmg: { b: 65, l: 18, ad: 0.75, type: 'phys' }, drain: { m: 0.042, h: 0.14 }, fury: [2.5, 7.5, 25], emp: { dmg: 1.5, drain: 3 }, color: '#86efac', desc: 'Gira a bocarra e o rabo em volta: fere todo mundo e cura pelo dano. Com fúria, fere 50% a mais e cura o triplo.' },
      w: { name: 'Mordida do Jacaré', icon: 'bite', kind: 'self', cd: 13, cast: 0, nextHit: { t: 4, range: 0.8, hits: 2, stun: 0.75, dmg: { b: 12, l: 8, ad: 0.6, type: 'phys' }, fury: 10, emp: { hits: 3, stun: 1.5 } }, color: '#4ade80', desc: 'O próximo ataque vira duas mordidas que atordoam. Com fúria, são três mordidas e o atordoamento dobra.' },
      e: { name: 'Bote do Pântano', icon: 'lunge', kind: 'dash', cd: 15, cast: 0, range: 5.5, speed: 24, path: { width: 2.2, dmg: { b: 45, l: 15, ad: 0.7, type: 'phys' } }, fury: [2.5, 5, 15], recast: { t: 4, emp: { dmg: 1.5, shred: [0.25, 4] } }, color: '#16a34a', desc: 'Avança cortando quem estiver no caminho. Se acertar alguém, dá pra dar o bote de novo em até 4 s. Com fúria, o segundo bote fere 50% a mais e racha a armadura.' },
      r: { name: 'Cuca Vem Pegar', icon: 'witch', kind: 'self', cd: 80, cast: 0.25, furyGain: 25, burst: { radius: 3.8, dmg: { b: 60, l: 16, ad: 0.3, type: 'magic' }, fx: { fear: 0.75 } }, buff: { t: 15, big: 1, range: 0.5, hp: { b: 220, l: 26 }, fury: 5, aura: { radius: 3.8, tick: 0.5, dmg: { b: 14, l: 3.5, ad: 0.05, type: 'magic' } } }, color: '#a855f7', desc: 'Dorme, neném: a Cuca cresce, ganha vida, assusta quem estiver perto e queima tudo em volta por 15 s, enchendo a fúria.' },
    },
  },
  curupira: {
    name: 'Curupira',
    title: 'Guardião da Mata',
    role: 'mago',
    color: '#ff4d1a',
    look: { weapon: 'torch', hat: 'firehair', scale: 0.94, extra: 'leaves', backFeet: true, body: '#3f6212', skin: '#9a5b34' },
    ranged: true,
    burn: { b: 3, l: 1, ap: 0.02, type: 'magic', tick: 0.5 },
    skillOrder: ['q', 'w', 'e'],
    stats: { hp: 530, hpL: 86, atk: 51, atkL: 2.7, armor: 22, armorL: 2.4, mres: 30, mresL: 1.3, as: 0.64, asL: 0.02, ms: 6.0, range: 9.2, regen: 1.5, regenL: 0.14 },
    abilities: {
      q: { name: 'Tocha', icon: 'torch', kind: 'proj', cd: 6, cast: 0.2, range: 14, speed: 30, width: 0.9, explode: 1.8, dmg: { b: 65, l: 19, ap: 0.6, type: 'magic' }, fx: { burn: 3 }, color: '#ff7a1a', desc: 'Arremessa uma tocha de bem longe: explode no primeiro inimigo e deixa todo mundo em volta queimando.' },
      w: { name: 'Trilha de Brasa', icon: 'firewall', kind: 'zone', cd: 14, cast: 0.2, range: 11, radius: 1.1, line: 7, dur: 3, tick: 0.5, dmg: { b: 14, l: 4, ap: 0.08, type: 'magic' }, fx: { slow: [0.35, 0.6], burn: 2 }, color: '#ffb020', desc: 'Risca uma parede de fogo atravessada no chão: queima e deixa lento quem passar por ela.' },
      e: { name: 'Pés Virados', icon: 'feet', kind: 'blink', cd: 15, cast: 0, range: 6.5, origin: { radius: 2.4, delay: 0.5, dmg: { b: 60, l: 18, ap: 0.5, type: 'magic' }, fx: { burn: 3 } }, color: '#fb923c', desc: 'Some e reaparece mais adiante. As pegadas ficam viradas pro outro lado e explodem em brasa onde você estava.' },
      r: { name: 'Fúria da Mata', icon: 'forestfire', kind: 'aoe', cd: 80, cast: 0.35, range: 16, radius: 4.4, delay: 0.9, dmg: { b: 160, l: 28, ap: 0.8, type: 'magic' }, fx: { fear: 1.25, burn: 4 }, linger: { dur: 3, tick: 0.5, dmg: { b: 14, l: 4, ap: 0.06, type: 'magic' }, fx: { slow: [0.3, 0.6] } }, color: '#ff3d00', desc: 'De bem longe, a mata pega fogo: depois de um instante explode, os inimigos fogem de medo e o chão fica queimando.' },
    },
  },
  caipora: {
    name: 'Caipora',
    title: 'Traquina',
    role: 'mago',
    color: '#d946ef',
    look: { weapon: 'coco', hat: 'cocar', scale: 0.9, extra: 'boar', body: '#a16207', skin: '#8d5a3b', pipe: true },
    ranged: true,
    skillOrder: ['q', 'e', 'w'],
    stats: { hp: 560, hpL: 90, atk: 52, atkL: 2.8, armor: 22, armorL: 2.4, mres: 30, mresL: 1.3, as: 0.65, asL: 0.02, ms: 6.1, range: 8.0, regen: 1.5, regenL: 0.14 },
    abilities: {
      q: { name: 'Coquinho', icon: 'coco', kind: 'proj', cd: 8, cast: 0.15, range: 9, speed: 22, width: 1.0, explode: 1.6, grow: { per: 0.09, max: 1.5 }, hover: { t: 2, reach: 9, speed: 30 }, dmg: { b: 56, l: 15, ap: 0.55, type: 'magic' }, color: '#e879f9', desc: 'Joga um coquinho que fere mais quanto mais longe voar. Se não acertar ninguém, ele para no ar: use de novo pra rebater na direção do mouse. Ele voa até acertar alguém ou sair do seu alcance, que anda com você.' },
      w: { name: 'Traquinagem', icon: 'mask', kind: 'self', cd: 12, cast: 0, buff: { t: 2, ms: 0.25 }, steal: { window: 40 }, bolts: { n: 3, range: 7, speed: 22, repeat: 0.3, wait: 2.5, dmg: { b: 34, l: 8, ap: 0.3, type: 'magic' } }, color: '#d946ef', desc: 'Lança de graça o último feitiço que um herói inimigo usou. Três vaga-lumes avançam nos inimigos próximos e você acelera.' },
      e: { name: 'Fumaça do Sono', icon: 'sleep', kind: 'proj', cd: 16, cast: 0.25, range: 10, speed: 20, width: 1.1, dmg: { b: 60, l: 17, ap: 0.5, type: 'magic' }, fx: { drowsy: [1.2, 2], wake: { b: 40, l: 12, ap: 0.3 } }, trap: { r: 1.6, dur: 4 }, color: '#c4b5fd', desc: 'Sopra a fumaça do cachimbo: o primeiro inimigo fica com sono e logo dorme. O golpe que acordar ele dói em dobro. Se errar, a fumaça fica no chão como armadilha.' },
      r: { name: 'Buraco de Tatu', icon: 'portal', kind: 'blink', cd: 16, cast: 0, range: 6.5, ret: 1, bolts: { n: 3, range: 7, speed: 24, repeat: 0.4, dmg: { b: 35, l: 8, ap: 0.35, type: 'magic' } }, color: '#d946ef', desc: 'Some num buraco e sai onde o mouse aponta, solta três vaga-lumes e, depois de 1 s, volta pelo mesmo buraco pra onde estava. Não dá pra andar enquanto está do outro lado.' },
    },
  },
  fulozinha: {
    name: 'Fulozinha',
    title: 'Pegadora',
    role: 'suporte',
    color: '#14b8a6',
    look: { weapon: 'braid', hat: 'braids', robe: true, extra: 'leaves', body: '#3f6212', skin: '#a8704a' },
    ranged: true,
    skillOrder: ['q', 'e', 'w'],
    stats: { hp: 660, hpL: 98, atk: 52, atkL: 2.8, armor: 36, armorL: 3.1, mres: 31, mresL: 1.4, as: 0.62, asL: 0.02, ms: 6.0, range: 6.2, regen: 1.9, regenL: 0.18 },
    abilities: {
      q: { name: 'Laço de Trança', icon: 'braid', kind: 'proj', cd: 10, cast: 0.25, range: 11, speed: 24, width: 1.1, dmg: { b: 66, l: 17, ap: 0.54, type: 'magic' }, fx: { pull: 6, stun: 0.5 }, color: '#2dd4bf', desc: 'Joga a trança: o primeiro inimigo que ela pegar é puxado pra perto de você e fica atordoado.' },
      w: { name: 'Cipó Amigo', icon: 'vine', kind: 'ally', cd: 15, cast: 0.1, range: 10, radius: 2.6, shield: { b: 55, l: 18, ap: 0.4, t: 3 }, fetch: true, color: '#5eead4', desc: 'Lança um cipó num aliado: ele ganha um escudo e é puxado pro seu lado.' },
      e: { name: 'Chicotada', icon: 'whip', kind: 'cone', cd: 10, cast: 0.2, range: 5.5, angle: 70, dmg: { b: 60, l: 16, ap: 0.48, type: 'magic' }, fx: { root: 1.1 }, color: '#14b8a6', desc: 'Chicoteia com a trança num leque à frente e prende os inimigos no lugar.' },
      r: { name: 'Redemoinho de Folhas', icon: 'whirl', kind: 'nova', cd: 80, cast: 0.3, radius: 6, dmg: { b: 110, l: 24, ap: 0.5, type: 'magic' }, fx: { pull: 5, stun: 1 }, color: '#14b8a6', desc: 'Um redemoinho arrasta todos os inimigos em volta pra junto de você e atordoa.' },
    },
  },
  uirapuru: {
    name: 'Uirapuru',
    title: 'Cantador',
    role: 'suporte',
    color: '#ef4444',
    look: { weapon: 'none', hat: 'crest', extra: 'wings', scale: 0.92, body: '#dc2626', skin: '#fbbf24' },
    ranged: true,
    skillOrder: ['w', 'q', 'e'],
    stats: { hp: 540, hpL: 88, atk: 50, atkL: 2.7, armor: 24, armorL: 2.6, mres: 30, mresL: 1.3, as: 0.64, asL: 0.022, ms: 6.1, range: 8.0, regen: 1.8, regenL: 0.17 },
    abilities: {
      q: { name: 'Canto Afiado', icon: 'note', kind: 'ally', cd: 8, cast: 0.1, range: 0, radius: 6.5, buff: { t: 3, atk: 14, pow: 24 }, bolts: { n: 2, range: 8, speed: 22, repeat: 0.4, wait: 1.5, dmg: { b: 34, l: 9, ap: 0.3, type: 'magic' } }, color: '#f87171', desc: 'Um canto agudo: duas notas voam nos inimigos próximos e você e os aliados em volta batem mais forte.' },
      w: { name: 'Canto Sereno', icon: 'song', kind: 'ally', cd: 11, cast: 0.1, range: 0, radius: 6.5, heal: { b: 40, l: 11, ap: 0.3 }, color: '#fde68a', desc: 'Um canto calmo que cura você e os aliados em volta.' },
      e: { name: 'Canto Ligeiro', icon: 'wingfoot', kind: 'ally', cd: 13, cast: 0.1, range: 0, radius: 6.5, buff: { t: 3, ms: 0.25, as: 0.25 }, color: '#fdba74', desc: 'Um canto rápido: você e os aliados em volta andam e atacam mais depressa.' },
      r: { name: 'Canto do Uirapuru', icon: 'bird', kind: 'proj', cd: 85, cast: 0.35, range: 14, speed: 18, width: 4, pierce: true, dmg: { b: 120, l: 24, ap: 0.5, type: 'magic' }, fx: { stun: 1.3 }, color: '#ef4444', desc: 'O canto que faz a mata inteira parar pra ouvir: uma onda larga que atordoa todos os inimigos que atravessa.' },
    },
  },
  pilintra: {
    name: 'Zé Pilintra',
    title: 'Malandro',
    role: 'suporte',
    color: '#f1f5f9',
    look: { weapon: 'cane', hat: 'panama', extra: 'tie', suit: '#f8fafc', skin: '#6b4423' },
    ranged: true,
    skillOrder: ['w', 'e', 'q'],
    stats: { hp: 550, hpL: 90, atk: 51, atkL: 2.7, armor: 25, armorL: 2.7, mres: 30, mresL: 1.3, as: 0.63, asL: 0.02, ms: 6.15, range: 7.8, regen: 1.8, regenL: 0.17 },
    abilities: {
      q: { name: 'Vela Acesa', icon: 'candle', kind: 'zone', cd: 9, cast: 0.2, range: 10, radius: 3, dur: 3, tick: 0.5, dmg: { b: 14, l: 4, ap: 0.12, type: 'magic' }, fx: { slow: [0.35, 0.8] }, color: '#fbbf24', desc: 'Acende uma vela no chão: a luz fere aos poucos e deixa lentos os inimigos dentro dela.' },
      w: { name: 'Corpo Fechado', icon: 'bless', kind: 'ally', cd: 11, cast: 0.1, range: 10, radius: 2.6, shield: { b: 60, l: 18, ap: 0.45, t: 3 }, buff: { t: 3, ms: 0.2 }, color: '#fecaca', desc: 'Fecha o corpo de um aliado: ele ganha um escudo forte e anda mais rápido.' },
      e: { name: 'Rasteira', icon: 'kick', kind: 'nova', cd: 12, cast: 0.15, radius: 4.2, dmg: { b: 45, l: 12, ap: 0.35, type: 'magic' }, fx: { knockback: 4.5, slow: [0.3, 1.5] }, color: '#f1f5f9', desc: 'Gira numa rasteira: empurra pra longe e deixa lentos os inimigos em volta.' },
      r: { name: 'Cartas na Mesa', icon: 'cards', kind: 'proj', cd: 80, cast: 0.3, range: 18, speed: 20, width: 4, pierce: true, dmg: { b: 130, l: 26, ap: 0.55, type: 'magic' }, fx: { knockup: 1 }, color: '#dc2626', desc: 'Abre o baralho num leque largo de cartas que voa em frente e joga pro alto todos os inimigos no caminho.' },
    },
  },
  boto: {
    name: 'Boto',
    title: 'Encantador',
    role: 'mago',
    color: '#ff8fab',
    look: { weapon: 'pearl', hat: 'boater', extra: 'fin', suit: '#f8fafc', skin: '#f7a1b8', snout: true },
    ranged: true,
    stats: { hp: 550, hpL: 90, atk: 53, atkL: 2.9, armor: 24, armorL: 2.6, mres: 30, mresL: 1.3, as: 0.65, asL: 0.02, ms: 6.05, range: 7.6, regen: 1.6, regenL: 0.15 },
    abilities: {
      q: { name: 'Pérola do Rio', icon: 'pearl', kind: 'proj', cd: 7, cast: 0.2, range: 11, speed: 24, width: 1.1, pierce: true, back: { speed: 30, type: 'true' }, dmg: { b: 36, l: 10, ap: 0.35, type: 'magic' }, color: '#ffc2d1', desc: 'Joga uma pérola que atravessa todo mundo e volta pra sua mão. Na volta, o dano ignora defesas.' },
      w: { name: 'Cardume', icon: 'fish', kind: 'self', cd: 9, cast: 0, buff: { t: 1.5, ms: 0.3 }, bolts: { n: 3, range: 6.5, speed: 20, repeat: 0.3, wait: 2.5, dmg: { b: 30, l: 7, ap: 0.25, type: 'magic' } }, color: '#ff8fab', desc: 'Três peixinhos avançam nos inimigos mais próximos, de preferência heróis. Você acelera por um instante.' },
      e: { name: 'Galanteio', icon: 'heart', kind: 'proj', cd: 13, cast: 0.2, range: 10, speed: 26, width: 1.0, dmg: { b: 60, l: 16, ap: 0.5, type: 'magic' }, fx: { charm: 1.3 }, color: '#ff5d8f', desc: 'Manda um beijo: o primeiro inimigo fica encantado e anda devagar até você.' },
      r: { name: 'Mergulho', icon: 'dive', kind: 'dash', cd: 75, cast: 0, range: 5.5, speed: 30, charges: { n: 3, t: 10, gap: 0.8 }, bolts: { n: 3, range: 6.5, speed: 24, repeat: 0.4, dmg: { b: 30, l: 6, ap: 0.2, type: 'magic' } }, color: '#ff8fab', desc: 'Mergulha e, ao sair, espirra jatos em até três inimigos próximos. Dá pra usar três vezes em 10 s.' },
    },
  },
};

export const HERO_ORDER = ['faisca', 'trovao', 'coruja', 'vespa', 'mandacaru', 'iara', 'boitata', 'saci', 'cuca', 'curupira', 'boto', 'caipora', 'fulozinha', 'uirapuru', 'pilintra'];

// Três camadas: básico -> intermediário -> grande. `from` lista as peças; quem já tem peça paga só a diferença.
// Só atributos: ataque, poder, aceleração, vel. de ataque, crítico, roubo de vida, armadura, resistência, vida (e passo nas botas).
// Roubo de vida: o ataque básico em herói ou tropa cura essa fração do dano que entrou; não vale em estrutura nem em habilidade.
// Preço: os básicos valem o que custam; intermediários rendem ~105-110% do preço e os grandes ~113-116%.
// Os de suporte (de usar) rendem ~100% só nos atributos: o efeito de usar é o resto do valor.
// Exceções: os de poder rendem mais (~125%), porque poder escala menos que ataque; os de defesa rendem ~100%,
// porque vida e resistência se multiplicam e um tanque cheio deles ficava quase imortal.
// `group`: só um item do grupo por herói (as botas e suas melhorias).
// `active`: item de usar, pela tecla do espaço dele no inventário. `cd` é a recarga.
//   stasis = segundos como estátua: não leva dano nem controle, mas também não anda, não ataca e não lança nada
export const ITEMS = {
  // ----- básicos -----
  alpercata: { name: 'Alpercata', cost: 350, stats: { ms: 0.8 }, group: 'botas' },
  dente: { name: 'Dente de Piranha', cost: 350, stats: { atk: 8 } },
  facao: { name: 'Facão', cost: 850, stats: { atk: 20 } },
  zarabatana: { name: 'Zarabatana', cost: 800, stats: { as: 0.25 } },
  acaua: { name: 'Olho de Acauã', cost: 700, stats: { crit: 0.15 } },
  pena: { name: 'Pena de Uirapuru', cost: 400, stats: { pow: 16 } },
  raio: { name: 'Pedra-de-Raio', cost: 850, stats: { pow: 35 } },
  guarana: { name: 'Semente de Guaraná', cost: 600, stats: { haste: 10 } },
  tatu: { name: 'Couro de Tatu', cost: 750, stats: { armor: 30 } },
  vitoria: { name: 'Folha de Vitória-régia', cost: 750, stats: { mres: 30 } },
  beiju: { name: 'Beiju', cost: 400, stats: { hp: 150 } },
  mandioca: { name: 'Raiz de Mandioca', cost: 800, stats: { hp: 300 } },
  morcego: { name: 'Dente de Morcego', cost: 450, stats: { ls: 0.08 } },

  // ----- botas -----
  pevento: { name: 'Pé-de-Vento', cost: 1100, from: ['alpercata'], stats: { ms: 1, as: 0.25 }, group: 'botas' },
  perneira: { name: 'Perneira de Vaqueiro', cost: 1000, from: ['alpercata'], stats: { ms: 1, armor: 25 }, group: 'botas' },
  boto: { name: 'Sapato do Boto', cost: 1000, from: ['alpercata'], stats: { ms: 1, mres: 25 }, group: 'botas' },
  andarilho: { name: 'Sandália do Andarilho', cost: 1050, from: ['alpercata'], stats: { ms: 1, haste: 12 }, group: 'botas' },

  // ----- intermediários -----
  peixeira: { name: 'Peixeira', cost: 1550, from: ['facao', 'guarana'], stats: { atk: 25, haste: 10 } },
  flecha: { name: 'Flecha de Taquara', cost: 1200, from: ['zarabatana', 'dente'], stats: { as: 0.25, atk: 12 } },
  arraia: { name: 'Ferrão de Arraia', cost: 1250, from: ['acaua', 'dente'], stats: { crit: 0.15, atk: 15 } },
  borduna: { name: 'Borduna', cost: 1200, from: ['dente', 'beiju'], stats: { atk: 15, hp: 250 } },
  maraca: { name: 'Maracá', cost: 1600, from: ['raio', 'guarana'], stats: { pow: 52, haste: 10 } },
  muiraquita: { name: 'Muiraquitã', cost: 1200, from: ['pena', 'beiju'], stats: { pow: 35, hp: 200 } },
  curare: { name: 'Dardo de Curare', cost: 1300, from: ['zarabatana', 'pena'], stats: { as: 0.2, pow: 35 } },
  gibao: { name: 'Gibão de Vaqueiro', cost: 1300, from: ['tatu', 'beiju'], stats: { armor: 30, hp: 250 } },
  patua: { name: 'Patuá', cost: 1300, from: ['vitoria', 'beiju'], stats: { mres: 30, hp: 250 } },
  jacare: { name: 'Couro de Jacaré', cost: 1400, from: ['tatu', 'guarana'], stats: { armor: 35, haste: 10 } },
  garramorcego: { name: 'Garra de Morcego', cost: 1200, from: ['morcego', 'dente'], stats: { ls: 0.1, atk: 15 } },

  // ----- grandes: ataque -----
  lobisomem: { name: 'Garra do Lobisomem', cost: 3100, from: ['peixeira', 'facao'], stats: { atk: 55, haste: 20 } },
  cobra: { name: 'Presa da Cobra-Grande', cost: 2600, from: ['facao', 'facao', 'dente'], stats: { atk: 70 } },
  anhanga: { name: 'Borduna de Anhangá', cost: 3200, from: ['borduna', 'peixeira'], stats: { atk: 40, hp: 400, haste: 15 } },
  cangaceiro: { name: 'Gume do Cangaceiro', cost: 2700, from: ['borduna', 'gibao'], stats: { atk: 30, armor: 40, hp: 300 } },
  icamiabas: { name: 'Lança das Icamiabas', cost: 2600, from: ['flecha', 'borduna'], stats: { atk: 35, as: 0.3, hp: 200 } },
  onca: { name: 'Garra da Onça-Pintada', cost: 3050, from: ['flecha', 'peixeira'], stats: { atk: 50, as: 0.25, haste: 10 } },
  bradador: { name: 'Tacape do Bradador', cost: 2850, from: ['facao', 'facao', 'tatu'], stats: { atk: 60, armor: 30 } },
  bonfim: { name: 'Fita do Bonfim', cost: 2250, from: ['facao', 'vitoria'], stats: { atk: 30, mres: 45 } },
  caipora: { name: 'Arco da Caipora', cost: 2650, from: ['flecha', 'zarabatana'], stats: { as: 0.55, atk: 30 } },
  agouro: { name: 'Agouro da Acauã', cost: 3050, from: ['arraia', 'facao'], stats: { atk: 55, crit: 0.25 } },
  mortalha: { name: 'Rasga-Mortalha', cost: 2350, from: ['arraia', 'zarabatana'], stats: { crit: 0.2, as: 0.35, atk: 15 } },
  matinta: { name: 'Assobio da Matinta', cost: 2350, from: ['curare', 'pena'], stats: { as: 0.55, pow: 70 } },
  cascavel: { name: 'Chocalho da Cascavel', cost: 2550, from: ['flecha', 'vitoria'], stats: { as: 0.4, atk: 20, mres: 30 } },
  maracatu: { name: 'Tambor de Maracatu', cost: 2450, from: ['flecha', 'guarana'], stats: { as: 0.4, atk: 15, haste: 15 } },
  paimato: { name: 'Olho do Pai-do-Mato', cost: 2850, from: ['arraia', 'flecha'], stats: { crit: 0.25, atk: 30, as: 0.25 } },
  lampiao: { name: 'Peixeira de Lampião', cost: 3000, from: ['arraia', 'peixeira'], stats: { crit: 0.2, atk: 45, haste: 10 } },
  // ----- grandes: roubo de vida -----
  chupacabra: { name: 'Presa do Chupa-cabra', cost: 2950, from: ['garramorcego', 'facao'], stats: { ls: 0.15, atk: 60 } },
  corposeco: { name: 'Foice do Corpo-Seco', cost: 2800, from: ['garramorcego', 'borduna'], stats: { ls: 0.12, atk: 40, hp: 300 } },
  labatut: { name: 'Lança do Labatut', cost: 2650, from: ['garramorcego', 'flecha'], stats: { ls: 0.1, atk: 35, as: 0.3 } },
  // ----- grandes: poder -----
  tupa: { name: 'Cajado de Tupã', cost: 2750, from: ['raio', 'raio', 'pena'], stats: { pow: 150 } },
  cocar: { name: 'Cocar do Pajé', cost: 2750, from: ['maraca', 'raio'], stats: { pow: 92, haste: 20 } },
  maedouro: { name: 'Coração da Mãe-do-Ouro', cost: 2500, from: ['muiraquita', 'raio'], stats: { pow: 92, hp: 350 } },
  maedagua: { name: "Véu da Mãe-d'Água", cost: 2500, from: ['raio', 'vitoria', 'pena'], stats: { pow: 80, mres: 45 } },
  carranca: { name: 'Carranca', cost: 2900, from: ['raio', 'tatu', 'pena'], stats: { pow: 90, armor: 45 }, active: { stasis: 2.5, cd: 120, desc: 'Vira estátua por 2,5 s: não leva dano nem controle, mas não anda, não ataca e não lança nada. Recarga de 120 s.' } },
  mula: { name: 'Fogo da Mula sem Cabeça', cost: 3000, from: ['maraca', 'raio'], stats: { pow: 130, haste: 10 } },
  rezadeira: { name: 'Rosário da Rezadeira', cost: 2700, from: ['maraca', 'vitoria'], stats: { pow: 70, haste: 15, mres: 30 } },
  cabaca: { name: 'Cabaça do Pajé', cost: 2600, from: ['maraca', 'guarana'], stats: { haste: 30, pow: 52 } },
  // ----- grandes: suporte (de usar, em você e nos aliados em volta) -----
  cheiro: { name: 'Água de Cheiro', cost: 2500, from: ['muiraquita', 'guarana'], stats: { pow: 40, haste: 15, hp: 250 }, active: { radius: 6, heal: { b: 70, l: 12, ap: 0.3 }, cd: 60, color: '#5ee67a', desc: 'Borrifa água de cheiro: cura você e os aliados em volta. Recarga de 60 s.' } },
  figa: { name: 'Figa de Guiné', cost: 2500, from: ['tatu', 'vitoria', 'guarana'], stats: { armor: 30, mres: 30, haste: 10 }, active: { radius: 6, shield: { b: 60, l: 14, hp: 0.06, t: 2.5 }, cd: 60, color: '#fde68a', desc: 'Dá um escudo em você e nos aliados em volta por 2,5 s. Recarga de 60 s.' } },
  berrante: { name: 'Berrante do Vaqueiro', cost: 2200, from: ['mandioca', 'guarana'], stats: { hp: 350, haste: 15 }, active: { radius: 7, buff: { t: 3, ms: 0.4 }, cd: 50, color: '#38bdf8', desc: 'Toca o berrante: você e os aliados em volta correm 40% mais rápido por 3 s. Recarga de 50 s.' } },
  benzedeira: { name: 'Cuia da Benzedeira', cost: 2700, from: ['muiraquita', 'guarana', 'pena'], stats: { pow: 58, haste: 20, hp: 250 } },
  // ----- grandes: defesa -----
  jabuti: { name: 'Casco de Jabuti', cost: 2400, from: ['gibao', 'tatu'], stats: { armor: 65, hp: 300 } },
  jaci: { name: 'Manto de Jaci', cost: 2400, from: ['patua', 'vitoria'], stats: { mres: 65, hp: 300 } },
  mapinguari: { name: 'Couro do Mapinguari', cost: 2600, from: ['gibao', 'vitoria'], stats: { armor: 40, mres: 40, hp: 250 } },
  xiquexique: { name: 'Armadura de Xique-xique', cost: 2800, from: ['jacare', 'mandioca'], stats: { armor: 50, haste: 20, hp: 200 } },
  sumauma: { name: 'Raiz de Sumaúma', cost: 2800, from: ['patua', 'guarana', 'vitoria'], stats: { mres: 45, haste: 20, hp: 250 } },
  boibumba: { name: 'Tambor do Boi-Bumbá', cost: 2400, from: ['mandioca', 'mandioca'], stats: { hp: 800 } },
  canastra: { name: 'Couraça do Tatu-Canastra', cost: 2450, from: ['gibao', 'beiju'], stats: { armor: 50, hp: 450 } },
  pirarucu: { name: 'Escama do Pirarucu', cost: 2850, from: ['jacare', 'vitoria'], stats: { armor: 55, mres: 30, haste: 15 } },
  tucum: { name: 'Rede de Tucum', cost: 2400, from: ['vitoria', 'vitoria', 'beiju'], stats: { mres: 60, hp: 200, armor: 15 } },
  jequitiba: { name: 'Tronco do Jequitibá', cost: 2500, from: ['mandioca', 'patua'], stats: { hp: 600, mres: 30 } },
  divino: { name: 'Bandeira do Divino', cost: 2650, from: ['guarana', 'mandioca', 'guarana'], stats: { haste: 25, hp: 300, armor: 20 } },
  tacaca: { name: 'Cuia de Tacacá', cost: 2250, from: ['mandioca', 'guarana', 'beiju'], stats: { hp: 500, haste: 15 } },
};

export const ITEM_ORDER = Object.keys(ITEMS);

// 0 = básico, 1 = intermediário, 2 = grande
export function itemTier(id) {
  const it = ITEMS[id];
  if (!it.from) return 0;
  return it.from.some((c) => ITEMS[c].from) || it.cost >= 2000 ? 2 : 1;
}

export const STAT_LABEL = {
  hp: 'vida',
  atk: 'ataque',
  pow: 'poder',
  armor: 'armadura',
  mres: 'resist. mágica',
  as: 'vel. de ataque',
  crit: 'chance de crítico',
  ls: 'roubo de vida',
  haste: 'aceleração de habilidade',
  ms: 'passo',
};
export const STAT_PCT = ['as', 'crit', 'ls'];
export const CRIT_MULT = 1.75;

// Afinidade: cada classe aproveita melhor certos atributos. Itens rendem +20% nesses atributos.
export const AFFINITY_BONUS = 0.2;
export const AFFINITY = {
  atirador: ['crit', 'atk'],
  assassino: ['atk', 'crit', 'haste'],
  lutador: ['atk', 'hp'],
  tanque: ['hp', 'armor', 'mres'],
  mago: ['pow', 'haste'],
  suporte: ['haste', 'hp'],
};
export const affinityOf = (heroId) => AFFINITY[HEROES[heroId]?.role] || [];

// atributos de um item já com a afinidade do herói
export function itemStatsFor(heroId, id) {
  const aff = affinityOf(heroId);
  const out = {};
  for (const [k, v] of Object.entries(ITEMS[id].stats)) out[k] = aff.includes(k) ? v * (1 + AFFINITY_BONUS) : v;
  return out;
}

// preço de um item pra quem já tem `items`: desconta as peças (e as peças das peças) que a pessoa tiver
export function itemPrice(items, id) {
  const owned = [...items];
  const use = [];
  const walk = (cid) => {
    let cost = ITEMS[cid].cost;
    for (const c of ITEMS[cid].from || []) {
      const i = owned.indexOf(c);
      if (i >= 0) {
        owned.splice(i, 1);
        use.push(c);
        cost -= ITEMS[c].cost;
      } else if (ITEMS[c].from) cost -= ITEMS[c].cost - walk(c);
    }
    return cost;
  };
  const cost = walk(id);
  const it = ITEMS[id];
  const clash = !!it.group && owned.some((o) => ITEMS[o].group === it.group);
  return { cost, use, fits: items.length - use.length + 1 <= 6, clash };
}

// o que comprar agora pra chegar em `id` com esse ouro: o próprio item ou a maior peça que der
export function nextBuy(items, gold, id) {
  if (gold >= itemPrice(items, id).cost) return id;
  const owned = [...items];
  for (const c of ITEMS[id].from || []) {
    const i = owned.indexOf(c);
    if (i >= 0) {
      owned.splice(i, 1);
      continue;
    }
    const r = nextBuy(items, gold, c);
    if (r) return r;
  }
  return null;
}

// peças básicas que ainda faltam pra um item
export function missingBasics(items, id) {
  const owned = [...items];
  const out = [];
  const walk = (cid) => {
    for (const c of ITEMS[cid].from || []) {
      const i = owned.indexOf(c);
      if (i >= 0) owned.splice(i, 1);
      else if (ITEMS[c].from) walk(c);
      else out.push(c);
    }
  };
  if (ITEMS[id].from) walk(id);
  else if (!items.includes(id)) out.push(id);
  return out;
}

// build principal de cada classe e uma alternativa com outro estilo
export const BUILDS = {
  atirador: ['pevento', 'caipora', 'agouro', 'mortalha', 'cobra', 'jaci'],
  mago: ['andarilho', 'cocar', 'tupa', 'maedouro', 'benzedeira', 'maedagua'],
  suporte: ['andarilho', 'benzedeira', 'cheiro', 'cocar', 'figa', 'jaci'],
  tanque: ['perneira', 'jabuti', 'jaci', 'mapinguari', 'berrante', 'xiquexique'],
  lutador: ['perneira', 'anhanga', 'corposeco', 'cangaceiro', 'jaci', 'xiquexique'],
  assassino: ['andarilho', 'lobisomem', 'agouro', 'chupacabra', 'anhanga', 'jaci'],
};
export const BUILDS_ALT = {
  atirador: { name: 'Atirador que aguenta', items: ['perneira', 'caipora', 'labatut', 'agouro', 'jaci', 'jabuti'] },
  mago: { name: 'Mago casca-grossa', items: ['boto', 'maedouro', 'benzedeira', 'carranca', 'jaci', 'cocar'] },
  suporte: { name: 'Suporte que machuca', items: ['andarilho', 'cocar', 'maedouro', 'tupa', 'benzedeira', 'jaci'] },
  tanque: { name: 'Tanque que bate', items: ['boto', 'cangaceiro', 'anhanga', 'xiquexique', 'sumauma', 'jabuti'] },
  lutador: { name: 'Só dano', items: ['pevento', 'lobisomem', 'agouro', 'cobra', 'anhanga', 'jabuti'] },
  assassino: { name: 'Briga longa', items: ['perneira', 'anhanga', 'lobisomem', 'cangaceiro', 'icamiabas', 'jaci'] },
};

// por que cada classe compra o que compra (aparece na loja, em "Recomendados")
export const BUILD_WHY = {
  atirador: 'Atirador: velocidade de ataque e crítico pra bater de longe sem parar. Defesa só no fim.',
  mago: 'Mago: poder deixa as habilidades mais fortes e aceleração faz elas voltarem mais rápido.',
  suporte: 'Suporte: aceleração e vida pra usar as habilidades o tempo todo e aguentar a briga.',
  tanque: 'Tanque: vida, armadura e resistência pra entrar na frente e aguentar o tranco.',
  lutador: 'Lutador: ataque com vida, pra bater forte e sobreviver no meio da briga.',
  assassino: 'Assassino: muito ataque, crítico e aceleração pra derrubar um alvo rápido.',
};

export const DIFFICULTY = {
  facil: { label: 'Fácil', reaction: 0.5, aim: 0.35, aimErr: 1.4, abilityRate: 0.45, aggro: 0.3, lastHit: 0.35, kite: 0, think: 0.26 },
  normal: { label: 'Normal', reaction: 0.3, aim: 0.75, aimErr: 0.7, abilityRate: 0.75, aggro: 0.55, lastHit: 0.7, kite: 0.5, think: 0.17 },
  dificil: { label: 'Difícil', reaction: 0.16, aim: 1, aimErr: 0.3, abilityRate: 1, aggro: 0.75, lastHit: 0.95, kite: 1, think: 0.11 },
};

export const BOT_NAMES = [
  'Caju',
  'Paçoca',
  'Tatu',
  'Mandioca',
  'Biscoito',
  'Jabuti',
  'Pitanga',
  'Sabiá',
  'Quindim',
  'Capivara',
  'Pamonha',
  'Siriema',
  'Jambo',
  'Cuscuz',
  'Bem-te-vi',
  'Goiaba',
  'Tapioca',
  'Graúna',
  'Jaca',
  'Cocada',
];

export const SLOTS = ['q', 'w', 'e', 'r', 'd', 'f'];

// `spells` = { d, f } com os feitiços escolhidos; sem ele valem os padrões
export function abilityOf(heroId, slot, spells = null) {
  if (slot === 'd' || slot === 'f') return SPELL_POOL[spells?.[slot]] || SPELLS[slot];
  return HEROES[heroId].abilities[slot];
}

// ---------- evolução de habilidades ----------
// Cada nível dá 1 ponto. Q/W/E vão até 5; o R até 3 (níveis 6, 11 e 16).
export const RANK_SLOTS = ['q', 'w', 'e', 'r'];
export const RANK_MAX = { q: 5, w: 5, e: 5, r: 3 };
export const ULT_LEVELS = [6, 11, 16];

export function skillPoints(level, ranks) {
  return level - RANK_SLOTS.reduce((n, s) => n + (ranks[s] || 0), 0);
}

// uma habilidade comum não pode passar da metade do nível do herói (arredondada pra cima)
export function canRankUp(level, ranks, slot) {
  if (!RANK_MAX[slot] || skillPoints(level, ranks) <= 0) return false;
  const r = ranks[slot] || 0;
  if (r >= RANK_MAX[slot]) return false;
  return slot === 'r' ? level >= ULT_LEVELS[r] : r < Math.ceil(level / 2);
}

// "nível efetivo" pra conta do dano/cura: metade vem do nível do herói, metade do nível da habilidade
export function effectiveLevel(level, slot, rank) {
  if (!RANK_MAX[slot]) return level;
  const eq = slot === 'r' ? [1, 6, 12, 18][rank] || 1 : 1 + (Math.max(1, rank) - 1) * 4.25;
  return (level + eq) / 2;
}
