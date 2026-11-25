// Atalhos: o que dá pra trocar no menu de configurações, o padrão de cada um e o nome das teclas.
// Dois esquemas, cada um com os seus atalhos: 'click' (o botão direito anda) e 'wasd' (as teclas andam e o mouse mira, como no LoL).
// Ficam de fora o Esc (menu), o botão esquerdo e o modificador de evoluir (Shift no clique, Ctrl no WASD).

// [ação, nome, padrão no clique, padrão no WASD]; null: a ação não existe naquele esquema, '' : existe mas começa sem tecla
export const ACTIONS = [
  ['up', 'Andar pra cima', null, 'KeyW'],
  ['left', 'Andar pra esquerda', null, 'KeyA'],
  ['down', 'Andar pra baixo', null, 'KeyS'],
  ['right', 'Andar pra direita', null, 'KeyD'],
  ['q', 'Habilidade 1', 'KeyQ', 'MouseRight'],
  ['w', 'Habilidade 2', 'KeyW', 'ShiftLeft'],
  ['e', 'Habilidade 3', 'KeyE', 'KeyE'],
  ['r', 'Habilidade especial', 'KeyR', 'KeyR'],
  ['d', 'Feitiço 1', 'KeyD', 'KeyQ'],
  ['f', 'Feitiço 2', 'KeyF', 'KeyF'],
  ['i1', 'Usar item 1', 'Digit1', 'Digit1'],
  ['i2', 'Usar item 2', 'Digit2', 'Digit2'],
  ['i3', 'Usar item 3', 'Digit3', 'Digit3'],
  ['i4', 'Usar item 4', 'Digit4', 'Digit4'],
  ['i5', 'Usar item 5', 'Digit5', 'Digit5'],
  ['i6', 'Usar item 6', 'Digit6', 'Digit6'],
  ['aim', 'Só mostrar o alcance (segurar + habilidade; clique lança)', 'KeyC', 'KeyC'],
  ['amove', 'Atacar o que aparecer (+ clique)', 'KeyA', ''],
  ['stop', 'Parar', 'KeyS', 'KeyH'],
  ['shop', 'Abrir a loja', 'KeyP', 'KeyP'],
  ['recall', 'Voltar pra base', 'KeyB', 'KeyB'],
  ['cam', 'Prender ou soltar a câmera', 'KeyY', 'KeyY'],
  ['center', 'Centralizar no herói (segurar)', 'Space', 'Space'],
  ['peek', 'Espiar longe com a câmera (segurar)', null, 'MouseMiddle'],
  ['board', 'Placar (segurar)', 'Tab', 'Tab'],
];

export const INPUTS = ['click', 'wasd'];
export const MOVE_ACTIONS = ['up', 'left', 'down', 'right'];

const col = (input) => (input === 'wasd' ? 3 : 2);
export const actionsOf = (input) => ACTIONS.filter((a) => a[col(input)] !== null);
export const defaultKeys = (input) => Object.fromEntries(actionsOf(input).map((a) => [a[0], a[col(input)]]));
export const DEFAULT_KEYS = defaultKeys('click');

// botão do mouse (MouseEvent.button) como se fosse uma tecla, pra poder virar atalho
export const mouseCode = (button) => ['MouseLeft', 'MouseMiddle', 'MouseRight', 'Mouse4', 'Mouse5'][button] || '';

// teclas que não podem virar atalho; no clique pra andar, o Shift evolui habilidade e o botão direito anda
const FIXED = /^(Escape|Control|Alt|Meta|OS|ContextMenu|CapsLock|NumLock|ScrollLock|PrintScreen|MouseLeft|Unidentified$|$)/;
export const canBind = (code, input = 'click') => typeof code === 'string' && !FIXED.test(code) && (input === 'wasd' || !/^(Shift|MouseRight)/.test(code));

// o que veio salvo, com o padrão no que faltar; duas ações nunca ficam na mesma tecla
export function cleanKeys(stored, input = 'click') {
  // quem ainda tem o padrão antigo salvo (loja no B, recall no T ou sem tecla) passa pro novo: loja no P, recall no B
  if (input === 'click' && stored?.shop === 'KeyB' && (!stored.recall || stored.recall === 'KeyT') && !Object.values(stored).includes('KeyP')) stored = { ...stored, shop: 'KeyP', recall: 'KeyB' };
  const list = actionsOf(input);
  const out = {};
  const used = new Set();
  for (const [id] of list) {
    const code = stored?.[id];
    if (canBind(code, input) && !used.has(code)) {
      out[id] = code;
      used.add(code);
    }
  }
  for (const a of list) {
    const def = a[col(input)];
    if (out[a[0]] !== undefined) continue;
    out[a[0]] = def && !used.has(def) ? def : '';
    if (out[a[0]]) used.add(out[a[0]]);
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
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift dir.',
  MouseRight: 'Botão direito',
  MouseMiddle: 'Botão do meio',
  Mouse4: 'Mouse 4',
  Mouse5: 'Mouse 5',
};

// nomes curtos pros botões do mouse, que cabem na etiqueta da barra de habilidades
const SHORT = { ShiftRight: 'Shift', MouseRight: 'M dir', MouseMiddle: 'M meio', Mouse4: 'M4', Mouse5: 'M5' };

export function keyName(code, short = false) {
  if (!code) return '—';
  if (short && SHORT[code]) return SHORT[code];
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
