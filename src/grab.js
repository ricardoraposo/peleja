// Captura do mouse: durante a partida o navegador "empresta" o mouse pro jogo (Pointer Lock).
// O cursor do sistema some e a gente desenha um cursor próprio que nunca sai da janela,
// então dá pra encostar na borda e arrastar a câmera. Esc devolve o mouse.
// Como o cursor de verdade fica parado, cliques e passagens de mouse na interface
// (loja, minimapa, painel de treino) são repassados pro elemento que está embaixo do cursor.
export class MouseGrab {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.mode = 0; // 0 = normal (cursor do sistema), 1 = preso (cursor desenhado pelo jogo), 2 = tela cheia (cursor do sistema)
    this.dirty = false;
    this.forced = false;
    this.self = false;
    this.hover = null;
    this.tipEl = null;
    this.cursor = document.getElementById('cursor');
    window.addEventListener('mousemove', (e) => e.isTrusted && this.locked && this.move(e.movementX, e.movementY), true);
    window.addEventListener(
      'mousedown',
      (e) => {
        if (!e.isTrusted) return;
        if (this.locked) {
          if (this.forward('mousedown', e.button)) e.stopImmediatePropagation();
        } else if (e.target === this.canvas && this.wanted) {
          if (this.mode === 1) this.lock(e.clientX, e.clientY);
          else if (this.mode === 2 && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        }
      },
      true,
    );
    window.addEventListener('mouseup', (e) => e.isTrusted && this.locked && this.forward('mouseup', e.button) && this.forward('click', e.button), true);
    window.addEventListener(
      'wheel',
      (e) => {
        if (!e.isTrusted || !this.locked) return;
        const el = this.under();
        if (!el) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          if (n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflowY !== 'visible') {
            n.scrollTop += e.deltaY;
            break;
          }
        }
      },
      { capture: true, passive: false },
    );
    document.addEventListener('pointerlockchange', () => {
      const on = this.locked;
      document.body.classList.toggle('grab', on);
      if (!on) {
        this.setHover(null);
        // saiu sem a gente pedir: foi o Esc do navegador
        if (!this.self && this.wanted) this.game.escape();
      }
      this.self = false;
    });
  }

  get locked() {
    return this.forced || document.pointerLockElement === this.canvas;
  }

  // só segura o mouse com a partida rolando
  get wanted() {
    const g = this.game;
    return this.mode > 0 && g.phase === 'playing' && !g.spectator && !g.paused;
  }

  lock(x, y) {
    const m = this.game.mouse;
    m.x = x;
    m.y = y;
    m.inside = true;
    this.place();
    try {
      const p = this.canvas.requestPointerLock?.();
      p?.catch?.(() => {});
    } catch {
      return;
    }
  }

  release() {
    if (document.pointerLockElement !== this.canvas) return;
    this.self = true;
    document.exitPointerLock();
  }

  // uma vez por quadro: o trabalho pesado (descobrir o que está embaixo do cursor) fica fora do evento do mouse
  update() {
    if (this.locked && (!this.wanted || this.mode !== 1)) this.release();
    if (!this.dirty || !this.locked) return;
    this.dirty = false;
    const el = this.under();
    this.setHover(el);
    if (el && this.game.mmDrag) this.fire(el, 'mousemove', 0);
  }

  // no evento do mouse só anda o cursor, pra ele responder o mais rápido possível
  move(dx, dy) {
    const m = this.game.mouse;
    m.x = Math.max(0, Math.min(window.innerWidth - 1, m.x + dx));
    m.y = Math.max(0, Math.min(window.innerHeight - 1, m.y + dy));
    m.inside = true;
    this.cursor.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
    this.dirty = true;
  }

  place() {
    const m = this.game.mouse;
    this.cursor.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
  }

  // elemento de interface embaixo do cursor (null = é o campo de jogo)
  under() {
    const m = this.game.mouse;
    const el = document.elementFromPoint(m.x, m.y);
    return !el || el === this.canvas || el === document.body || el === document.documentElement ? null : el;
  }

  setHover(el) {
    if (el === this.hover) return;
    if (this.hover) this.fire(this.hover, 'mouseout', 0);
    this.hover = el;
    if (el) this.fire(el, 'mouseover', 0);
    const tip = el?.closest?.('.skill, .item') || null;
    if (tip !== this.tipEl) {
      this.tipEl?.classList.remove('hov');
      tip?.classList.add('hov');
      this.tipEl = tip;
    }
    document.body.classList.toggle('cur-ui', !!el);
  }

  fire(el, type, button) {
    const m = this.game.mouse;
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: m.x, clientY: m.y, button, buttons: type === 'mousedown' ? 1 << button : 0 }));
  }

  // repassa o clique pra interface; devolve false quando o clique é no campo
  forward(type, button) {
    const el = this.under();
    this.setHover(el);
    if (!el) return false;
    if (type !== 'click' || button === 0) this.fire(el, type, button);
    return true;
  }
}
