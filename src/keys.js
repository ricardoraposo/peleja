// Atalhos de teclado: o que dá pra trocar no menu de configurações, o padrão de cada um e o nome das teclas.
// Ficam de fora o Esc (menu) e o Shift + habilidade (evoluir).

export const ACTIONS = [
  ['q', 'Habilidade 1', 'KeyQ'],
  ['w', 'Habilidade 2', 'KeyW'],
  ['e', 'Habilidade 3', 'KeyE'],
  ['r', 'Habilidade especial', 'KeyR'],
  ['d', 'Feitiço 1', 'KeyD'],
  ['f', 'Feitiço 2', 'KeyF'],
  ['i1', 'Usar item 1', 'Digit1'],
  ['i2', 'Usar item 2', 'Digit2'],
  ['i3', 'Usar item 3', 'Digit3'],
  ['i4', 'Usar item 4', 'Digit4'],
  ['i5', 'Usar item 5', 'Digit5'],
  ['i6', 'Usar item 6', 'Digit6'],
  ['amove', 'Atacar o que aparecer (+ clique)', 'KeyA'],
  ['stop', 'Parar', 'KeyS'],
  ['shop', 'Abrir a loja', 'KeyP'],
  ['recall', 'Voltar pra base', 'KeyB'],
  ['cam', 'Prender ou soltar a câmera', 'KeyY'],
  ['center', 'Centralizar no herói (segurar)', 'Space'],
  ['board', 'Placar (segurar)', 'Tab'],
];

export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(([id, , code]) => [id, code]));

// teclas que não podem virar atalho
const FIXED = /^(Escape|Shift|Control|Alt|Meta|OS|ContextMenu|CapsLock|NumLock|ScrollLock|PrintScreen|Unidentified$|$)/;
export const canBind = (code) => typeof code === 'string' && !FIXED.test(code);

// o que veio salvo, com o padrão no que faltar; duas ações nunca ficam na mesma tecla
export function cleanKeys(stored) {
  // quem ainda tem o padrão antigo salvo (loja no B, recall no T ou sem tecla) passa pro novo: loja no P, recall no B
  if (stored?.shop === 'KeyB' && (!stored.recall || stored.recall === 'KeyT') && !Object.values(stored).includes('KeyP')) stored = { ...stored, shop: 'KeyP', recall: 'KeyB' };
  const out = {};
  const used = new Set();
  for (const [id] of ACTIONS) {
    const code = stored?.[id];
    if (canBind(code) && !used.has(code)) {
      out[id] = code;
      used.add(code);
    }
  }
  for (const [id, , def] of ACTIONS) {
    if (out[id]) continue;
    out[id] = used.has(def) ? '' : def;
    used.add(out[id]);
  }
  return out;
}

const NAMES = {
  Space: 'Espaço',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Apagar',
  Delete: 'Del',
  Insert: 'Ins',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: "'",
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: '~',
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '\\',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
};

export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
