// TEMPORÁRIO: caça ao travamento da tela cheia (diálogo de "salvar imagem" que abre sozinho).
// Guarda os últimos cliques e teclas e, toda vez que a janela perde o foco, grava esse histórico
// no localStorage (chave peleja.diag) pra dar pra ver o que veio logo antes. Não sai do computador.
const ring = [];
const t0 = performance.now();
const note = (type, extra) => {
  ring.push({ t: Math.round(performance.now() - t0), type, fs: document.fullscreenElement ? 1 : 0, ...extra });
  if (ring.length > 50) ring.shift();
};
const mods = (e) => (e.shiftKey ? 'S' : '') + (e.ctrlKey ? 'C' : '') + (e.altKey ? 'A' : '') + (e.metaKey ? 'M' : '');
const where = (e) => (e.target?.id ? '#' + e.target.id : e.target?.tagName || '?');
const dump = (why) => {
  try {
    const all = JSON.parse(localStorage.getItem('peleja.diag') || '[]');
    all.push({ at: new Date().toISOString(), why, events: ring.slice() });
    localStorage.setItem('peleja.diag', JSON.stringify(all.slice(-12)));
  } catch {
    return;
  }
};

export function startDiag() {
  for (const type of ['mousedown', 'mouseup', 'auxclick', 'dragstart']) {
    window.addEventListener(type, (e) => note(type, { b: e.button, bs: e.buttons, m: mods(e), on: where(e), tr: e.isTrusted ? 1 : 0 }), true);
  }
  window.addEventListener('keydown', (e) => !e.repeat && note('keydown', { k: e.code, m: mods(e) }), true);
  window.addEventListener(
    'contextmenu',
    (e) => {
      const rec = { b: e.button, bs: e.buttons, m: mods(e), on: where(e), tr: e.isTrusted ? 1 : 0, prevented: -1 };
      note('contextmenu', rec);
      // depois que todo mundo tratou o evento: 0 aqui quer dizer que o menu do navegador abriu
      setTimeout(() => {
        rec.prevented = e.defaultPrevented ? 1 : 0;
        if (!e.defaultPrevented) dump('contextmenu sem bloqueio');
      }, 0);
    },
    true,
  );
  document.addEventListener('fullscreenchange', () => note('fullscreenchange', {}));
  document.addEventListener('pointerlockchange', () => note('pointerlockchange', { lock: document.pointerLockElement ? 1 : 0 }));
  window.addEventListener('blur', () => {
    note('blur', {});
    dump('blur');
  });
  document.addEventListener('visibilitychange', () => note('visibility', { v: document.visibilityState }));
}
