// Medidor de desempenho (Configurações › Gráficos): quadros por segundo, o pior quadro, quanto da CPU
// vai em cada parte do quadro, o tamanho da cena e a placa de vídeo. Serve pra saber onde o jogo pesa
// na máquina de quem reclama: FPS baixo com CPU folgada quer dizer que a placa de vídeo é o gargalo.
const WINDOW = 500;

// "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)" vira "Intel(R) UHD Graphics 620"
function gpuName(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '?');
  let name = raw;
  if (raw.startsWith('ANGLE (')) {
    name = raw.replace(/^ANGLE \([^,]*, /, '').replace(/, [^,]*\)$/, '').replace(/ \(0x[0-9a-f]+\)/i, '').replace(/ Direct3D.*$/, '');
  }
  return name.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

const ms = (v) => v.toFixed(1).replace('.', ',');
const big = (v) => (v >= 1e6 ? `${ms(v / 1e6)} mi` : v >= 1e4 ? `${Math.round(v / 1e3)} mil` : Math.round(v).toLocaleString('pt-BR'));

export class PerfMeter {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('perf');
    this.on = false;
    this.gpu = '';
    this.reset(performance.now());
  }

  show(v) {
    this.on = v;
    this.el.classList.toggle('hidden', !v);
    document.body.classList.toggle('perf-on', v);
    if (v && !this.gpu) this.gpu = gpuName(this.game.renderer.getContext());
    this.reset(performance.now());
  }

  reset(now) {
    this.t0 = now;
    this.prev = 0;
    this.n = 0;
    this.worst = 0;
    this.sim = 0;
    this.scene = 0;
    this.draw = 0;
    this.calls = 0;
    this.tris = 0;
  }

  // um quadro: tempos de CPU (ms) da simulação local, da atualização da cena e do envio pro desenho
  sample(now, sim, scene, draw) {
    if (!this.on) return;
    // aba escondida para o requestAnimationFrame: essa pausa não é travada do jogo
    if (this.prev && now - this.prev < 1000) this.worst = Math.max(this.worst, now - this.prev);
    this.prev = now;
    const info = this.game.renderer.info.render;
    this.n++;
    this.sim += sim;
    this.scene += scene;
    this.draw += draw;
    this.calls += info.calls;
    this.tris += info.triangles;
    if (now - this.t0 >= WINDOW) this.flush(now);
  }

  flush(now) {
    const n = Math.max(1, this.n);
    const fps = (this.n * 1000) / (now - this.t0);
    const tr = this.game.transport;
    const c = this.game.canvas;
    let top = `<b>${Math.round(fps)}</b> FPS · pior quadro ${Math.round(this.worst)} ms`;
    // online o servidor manda o jogo 20 vezes por segundo: espera bem acima de 50 ms é travada de rede
    if (tr && !tr.local) {
      top += ` · rede ${Math.round(tr.gap)} ms`;
      tr.gap = 0;
    }
    const cpu = `CPU: ${tr?.local ? `sim ${ms(this.sim / n)} · ` : ''}cena ${ms(this.scene / n)} · desenho ${ms(this.draw / n)} ms`;
    const size = `${big(this.calls / n)} chamadas · ${big(this.tris / n)} triângulos · ${c.width}×${c.height}`;
    this.el.innerHTML = `<div>${top}</div><div>${cpu}</div><div>${size}</div><small>${this.gpu}</small>`;
    const prev = this.prev;
    this.reset(now);
    this.prev = prev;
  }
}
