import { HERO_ORDER, HEROES, MATCH } from './config.js';

// Painel do modo treino: manda comandos 'dbg' pra simulação local.
// Botões criam coisas na frente do herói; as teclas criam onde o mouse está.
const SPAWN_KEYS = {
  Digit1: { c: 'dummy' },
  Digit2: { c: 'bot' },
  Digit3: { c: 'bot', ally: 1 },
  Digit4: { c: 'minions' },
  Digit5: { c: 'minions', ally: 1 },
};

export class DebugPanel {
  constructor(game, onRestart) {
    this.game = game;
    this.el = document.getElementById('debug');
    this.hits = [];
    this.total = 0;
    this.best = 0;
    this.heroKey = '';
    this.el.querySelector('#dbg-heroes').innerHTML = HERO_ORDER.map((id) => `<button data-hero="${id}" style="--c:${HEROES[id].color}" title="${HEROES[id].name} · ${HEROES[id].title}">${HEROES[id].name[0]}</button>`).join('');
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      const d = b.dataset;
      if (d.hero) this.cmd({ c: 'hero', v: d.hero });
      else if (d.lvl) this.cmd({ c: 'lvl', v: d.lvl === 'max' ? MATCH.maxLevel : (this.game.me?.level || 1) + Number(d.lvl) });
      else if (d.toggle) {
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on);
        this.cmd({ c: d.toggle, v: on ? 1 : 0 });
      } else if (d.speed) {
        this.game.transport.speed = Number(d.speed);
        for (const o of this.el.querySelectorAll('[data-speed]')) o.classList.toggle('on', o === b);
      } else if (d.act === 'restart') onRestart();
      else if (d.act === 'meter') this.resetMeter();
      else if (d.act === 'hide') this.el.classList.toggle('min');
      else if (d.c) this.cmd({ c: d.c, ally: d.ally ? 1 : 0 });
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active || e.repeat || e.target instanceof HTMLInputElement) return;
      const g = this.game;
      if (e.code === 'F1') {
        e.preventDefault();
        this.el.classList.toggle('min');
      } else if (SPAWN_KEYS[e.code]) this.cmd({ ...SPAWN_KEYS[e.code], x: g.mouse.wx, z: g.mouse.wz });
      else if (e.code === 'KeyT') this.cmd({ c: 'tp', x: g.mouse.wx, z: g.mouse.wz });
    });
    game.onDamage = (d) => {
      if (!this.active) return;
      this.hits.push([performance.now(), d]);
      this.total += d;
      this.best = Math.max(this.best, d);
    };
    setInterval(() => this.refresh(), 200);
  }

  get active() {
    return !!this.game.transport?.sandbox && !this.el.classList.contains('hidden');
  }

  cmd(m) {
    this.game.send({ t: 'dbg', ...m });
  }

  resetMeter() {
    this.hits = [];
    this.total = 0;
    this.best = 0;
  }

  show(v) {
    this.el.classList.toggle('hidden', !v);
    if (!v) return;
    this.resetMeter();
    this.el.classList.remove('min');
    for (const b of this.el.querySelectorAll('[data-toggle]')) b.classList.toggle('on', b.dataset.toggle === 'towers');
    for (const b of this.el.querySelectorAll('[data-speed]')) b.classList.toggle('on', b.dataset.speed === '1');
  }

  refresh() {
    if (!this.active) return;
    const me = this.game.me;
    const now = performance.now();
    this.hits = this.hits.filter((h) => now - h[0] < 5000);
    const sum = this.hits.reduce((a, h) => a + h[1], 0);
    const span = this.hits.length ? Math.max(1, (now - this.hits[0][0]) / 1000) : 1;
    this.el.querySelector('#dbg-dps').textContent = Math.round(sum / span);
    this.el.querySelector('#dbg-total').textContent = Math.round(this.total);
    this.el.querySelector('#dbg-best').textContent = Math.round(this.best);
    if (!me) return;
    this.el.querySelector('#dbg-lvl').textContent = me.level;
    if (me.heroId !== this.heroKey) {
      this.heroKey = me.heroId;
      for (const b of this.el.querySelectorAll('[data-hero]')) b.classList.toggle('on', b.dataset.hero === me.heroId);
    }
  }
}
