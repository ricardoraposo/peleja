let ctx = null;
let master = null;
let noiseBuf = null;
let listener = { x: 0, z: 0, flip: 1 };
let volume = 0.7;
let muted = false;

// a partida de fundo do menu não faz barulho
export function setMuted(m) {
  muted = m;
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

export function setListener(x, z, flip = 1) {
  listener = { x, z, flip };
}

function spatial(pos, base = 1) {
  if (!pos) return { gain: base, pan: 0, d: 0 };
  const dx = pos.x - listener.x;
  const dz = pos.z - listener.z;
  const d = Math.hypot(dx, dz);
  const gain = base / (1 + d * 0.035 + d * d * 0.0018);
  const pan = Math.max(-0.8, Math.min(0.8, (dx * listener.flip) / 28));
  return { gain, pan, d };
}

function out(pos, base) {
  const s = spatial(pos, base);
  if (s.gain < 0.004) return null;
  const g = ctx.createGain();
  g.gain.value = s.gain;
  const p = ctx.createStereoPanner();
  p.pan.value = s.pan;
  g.connect(p).connect(master);
  return { node: g, dist: s.d || 0 };
}

function noiseBurst(dest, t, dur, freq, q, type = 'bandpass', peak = 1, attack = 0.002) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
  return f;
}

// notas em sequência, com metal (serra) e corpo (triângulo); a última fica soando por `hold` segundos
function fanfare(dest, t, notes, step, hold) {
  notes.forEach((f, i) => {
    const dur = i === notes.length - 1 ? hold : step * 1.4;
    tone(dest, t + i * step, dur, f, f, 'sawtooth', 0.07);
    tone(dest, t + i * step, dur, f, f, 'triangle', 0.16);
  });
}

function tone(dest, t, dur, f0, f1, type = 'sine', peak = 1) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playSound(name, pos = null, gain = 1) {
  if (!ctx || (muted && name !== 'click')) return;
  const t = ctx.currentTime;
  const o = out(pos, gain);
  if (!o) return;
  const d = o.node;
  switch (name) {
    case 'swing':
      noiseBurst(d, t, 0.14, 1800, 1.4, 'bandpass', 0.35, 0.03);
      break;
    case 'thud':
      noiseBurst(d, t, 0.1, 500, 1, 'lowpass', 0.5);
      tone(d, t, 0.08, 160, 80, 'sine', 0.35);
      break;
    case 'punch':
      noiseBurst(d, t, 0.05, 2600, 0.8, 'bandpass', 0.55, 0.001);
      noiseBurst(d, t, 0.13, 420, 0.9, 'lowpass', 0.9, 0.002);
      tone(d, t, 0.11, 190 + Math.random() * 40, 70, 'sine', 0.6);
      break;
    case 'pop':
      noiseBurst(d, t, 0.04, 3200, 1.2, 'bandpass', 0.4, 0.001);
      tone(d, t, 0.08, 520 + Math.random() * 80, 180, 'triangle', 0.4);
      break;
    case 'shoot':
      tone(d, t, 0.12, 900, 500, 'triangle', 0.16);
      noiseBurst(d, t, 0.06, 3000, 2, 'bandpass', 0.12);
      break;
    case 'tower':
      tone(d, t, 0.3, 300, 120, 'sawtooth', 0.18);
      noiseBurst(d, t, 0.25, 900, 1, 'bandpass', 0.4, 0.01);
      break;
    case 'zap':
      tone(d, t, 0.18, 1200, 300, 'square', 0.12);
      noiseBurst(d, t, 0.12, 2500, 1.5, 'bandpass', 0.3);
      break;
    case 'cast':
      tone(d, t, 0.22, 400, 900, 'triangle', 0.18);
      noiseBurst(d, t, 0.2, 2200, 1.2, 'bandpass', 0.18, 0.04);
      break;
    case 'channel':
      tone(d, t, 1.0, 200, 900, 'sine', 0.16);
      break;
    case 'boom':
      noiseBurst(d, t, 0.6, 500, 0.6, 'lowpass', 1.1, 0.005);
      tone(d, t, 0.4, 110, 40, 'sine', 0.9);
      break;
    case 'stun':
      tone(d, t, 0.25, 1500, 1500, 'triangle', 0.12);
      tone(d, t + 0.08, 0.25, 1900, 1900, 'triangle', 0.1);
      break;
    case 'heal':
      tone(d, t, 0.25, 520, 780, 'triangle', 0.22);
      tone(d, t + 0.12, 0.3, 780, 1040, 'triangle', 0.2);
      break;
    case 'shield':
      tone(d, t, 0.35, 300, 600, 'sine', 0.25);
      noiseBurst(d, t, 0.3, 4000, 1, 'highpass', 0.08, 0.05);
      break;
    case 'dash':
      noiseBurst(d, t, 0.3, 1500, 0.7, 'bandpass', 0.6, 0.02).frequency.exponentialRampToValueAtTime(400, t + 0.3);
      break;
    case 'flash':
      // estalo seco e brilhante, com um rabo descendo
      noiseBurst(d, t, 0.07, 5200, 0.8, 'highpass', 0.5, 0.001);
      tone(d, t, 0.07, 1400, 4200, 'triangle', 0.3);
      tone(d, t + 0.05, 0.3, 3000, 700, 'sine', 0.2);
      tone(d, t + 0.05, 0.22, 1500, 1500, 'sine', 0.08);
      break;
    case 'blink':
      tone(d, t, 0.18, 2000, 400, 'sine', 0.25);
      tone(d, t + 0.05, 0.2, 400, 2400, 'sine', 0.15);
      break;
    case 'level':
      [660, 880, 1320].forEach((f, i) => tone(d, t + i * 0.07, 0.25, f, f, 'triangle', 0.18));
      break;
    case 'gold':
      tone(d, t, 0.08, 1800, 1800, 'square', 0.05);
      tone(d, t + 0.05, 0.12, 2400, 2400, 'square', 0.05);
      break;
    case 'buy':
      tone(d, t, 0.1, 900, 900, 'triangle', 0.2);
      tone(d, t + 0.07, 0.18, 1350, 1350, 'triangle', 0.2);
      break;
    case 'error':
      tone(d, t, 0.12, 220, 200, 'square', 0.1);
      break;
    case 'pack':
      tone(d, t, 0.2, 700, 1400, 'sine', 0.25);
      break;
    case 'kill':
      tone(d, t, 0.09, 880, 880, 'square', 0.12);
      tone(d, t + 0.08, 0.16, 1320, 1320, 'square', 0.12);
      break;
    case 'death':
      tone(d, t, 0.6, 300, 60, 'sawtooth', 0.25);
      break;
    case 'crash':
      noiseBurst(d, t, 1.6, 300, 0.5, 'lowpass', 2, 0.01);
      tone(d, t, 1.0, 70, 25, 'sine', 1.6);
      noiseBurst(d, t + 0.2, 0.8, 1200, 0.8, 'bandpass', 0.5, 0.05);
      break;
    case 'horn':
      tone(d, t, 0.9, 220, 230, 'sawtooth', 0.1);
      tone(d, t, 0.9, 330, 335, 'triangle', 0.12);
      break;
    case 'announce':
      tone(d, t, 0.15, 880, 880, 'triangle', 0.18);
      tone(d, t + 0.12, 0.3, 1175, 1175, 'triangle', 0.18);
      break;
    // multi-abate: fanfarra que ganha uma nota a cada abate seguido; o pentakill fecha num acorde com tambor
    case 'multi2':
      fanfare(d, t, [784, 1047], 0.1, 0.35);
      break;
    case 'multi3':
      fanfare(d, t, [659, 784, 1047], 0.09, 0.45);
      break;
    case 'multi4':
      fanfare(d, t, [523, 659, 784, 1047], 0.08, 0.55);
      noiseBurst(d, t + 0.24, 0.3, 180, 0.8, 'lowpass', 0.7);
      break;
    case 'penta':
      fanfare(d, t, [523, 659, 784, 1047], 0.07, 0.2);
      for (const f of [1047, 1319, 1568]) fanfare(d, t + 0.3, [f], 0, 1.1);
      tone(d, t + 0.3, 0.9, 131, 65, 'sine', 0.9);
      noiseBurst(d, t + 0.3, 0.5, 160, 0.8, 'lowpass', 1);
      noiseBurst(d, t + 0.3, 0.6, 5000, 0.6, 'highpass', 0.25, 0.01);
      break;
    case 'laser':
      tone(d, t, 0.25, 2400, 1800, 'sawtooth', 0.08);
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(d, t + i * 0.13, 0.4, f, f, 'triangle', 0.3));
      break;
    case 'lose':
      [523, 466, 392, 311].forEach((f, i) => tone(d, t + i * 0.16, 0.45, f, f, 'triangle', 0.3));
      break;
    // ----- sons de cada herói -----
    case 'gun': // garrucha: estalo seco e um coice grave
      noiseBurst(d, t, 0.05, 3800, 0.7, 'bandpass', 0.6, 0.001);
      noiseBurst(d, t, 0.16, 700, 0.7, 'lowpass', 0.7, 0.001);
      tone(d, t, 0.07, 240, 70, 'square', 0.14);
      break;
    case 'ricochet':
      noiseBurst(d, t, 0.03, 4500, 2, 'bandpass', 0.35, 0.001);
      tone(d, t, 0.1, 2600 + Math.random() * 600, 1400, 'triangle', 0.1);
      break;
    case 'blast': // pólvora
      noiseBurst(d, t, 0.45, 900, 0.5, 'lowpass', 1.1, 0.002);
      noiseBurst(d, t, 0.2, 4000, 0.8, 'highpass', 0.25, 0.001);
      tone(d, t, 0.3, 140, 45, 'sine', 0.8);
      break;
    case 'bow': // corda solta e o assobio da flecha
      tone(d, t, 0.16, 260 + Math.random() * 30, 150, 'triangle', 0.3);
      tone(d, t, 0.05, 900, 500, 'sine', 0.12);
      noiseBurst(d, t + 0.02, 0.16, 3200, 3, 'bandpass', 0.14, 0.03).frequency.exponentialRampToValueAtTime(1600, t + 0.18);
      break;
    case 'thunk': // flecha cravando
      noiseBurst(d, t, 0.035, 2200, 1.5, 'bandpass', 0.4, 0.001);
      tone(d, t, 0.09, 300 + Math.random() * 40, 120, 'triangle', 0.4);
      break;
    case 'heavySwing':
      noiseBurst(d, t, 0.22, 700, 1.1, 'bandpass', 0.45, 0.06).frequency.exponentialRampToValueAtTime(300, t + 0.22);
      break;
    case 'thunderHit': // martelo: baque e estalo elétrico
      noiseBurst(d, t, 0.16, 380, 0.8, 'lowpass', 1, 0.002);
      tone(d, t, 0.16, 130, 50, 'sine', 0.7);
      noiseBurst(d, t, 0.09, 5200, 1.2, 'highpass', 0.22, 0.001);
      tone(d, t, 0.07, 1800, 400, 'sawtooth', 0.06);
      break;
    case 'thunderCast':
      tone(d, t, 0.25, 90, 240, 'sawtooth', 0.14);
      noiseBurst(d, t, 0.22, 5000, 1, 'highpass', 0.12, 0.08);
      break;
    case 'thunder': // estalo e trovão rolando
      noiseBurst(d, t, 0.07, 5000, 0.7, 'highpass', 0.5, 0.001);
      noiseBurst(d, t + 0.03, 0.9, 260, 0.5, 'lowpass', 1.3, 0.01);
      tone(d, t + 0.03, 0.6, 90, 35, 'sine', 0.9);
      break;
    case 'sting': // ferrão: silvo curto e agudo
      noiseBurst(d, t, 0.07, 5200, 2.5, 'bandpass', 0.3, 0.01);
      break;
    case 'stab':
      noiseBurst(d, t, 0.04, 4200, 1.5, 'bandpass', 0.45, 0.001);
      tone(d, t, 0.06, 620 + Math.random() * 120, 260, 'triangle', 0.25);
      break;
    case 'swarm': // zumbido
      tone(d, t, 0.45, 210, 260, 'sawtooth', 0.1);
      tone(d, t, 0.45, 223, 250, 'sawtooth', 0.1);
      noiseBurst(d, t, 0.4, 3000, 2, 'bandpass', 0.12, 0.08);
      break;
    case 'bash': // escudo: pancada surda de madeira
      noiseBurst(d, t, 0.16, 300, 0.9, 'lowpass', 1.1, 0.002);
      tone(d, t, 0.14, 120 + Math.random() * 20, 55, 'sine', 0.8);
      tone(d, t, 0.05, 420, 200, 'square', 0.08);
      break;
    case 'rustle':
      noiseBurst(d, t, 0.2, 2600, 0.8, 'bandpass', 0.25, 0.05);
      tone(d, t, 0.12, 180, 120, 'triangle', 0.15);
      break;
    case 'bubble': // gota
      tone(d, t, 0.09, 380 + Math.random() * 80, 950, 'sine', 0.26);
      break;
    case 'splash':
      noiseBurst(d, t, 0.22, 1700, 0.7, 'bandpass', 0.4, 0.004).frequency.exponentialRampToValueAtTime(600, t + 0.22);
      tone(d, t, 0.08, 700, 300, 'sine', 0.14);
      break;
    case 'water': // onda subindo
      noiseBurst(d, t, 0.45, 500, 0.8, 'bandpass', 0.5, 0.15).frequency.exponentialRampToValueAtTime(1800, t + 0.4);
      tone(d, t, 0.12, 320, 760, 'sine', 0.14);
      break;
    case 'chime': // cura da água
      tone(d, t, 0.3, 660, 660, 'sine', 0.2);
      tone(d, t + 0.09, 0.3, 880, 880, 'sine', 0.18);
      tone(d, t + 0.18, 0.4, 1320, 1320, 'sine', 0.14);
      break;
    case 'fire': // sopro de chama
      noiseBurst(d, t, 0.3, 500, 0.6, 'bandpass', 0.6, 0.04).frequency.exponentialRampToValueAtTime(1500, t + 0.25);
      tone(d, t, 0.2, 110, 70, 'sawtooth', 0.08);
      break;
    case 'sizzle':
      noiseBurst(d, t, 0.2, 4200, 0.8, 'highpass', 0.22, 0.004);
      noiseBurst(d, t, 0.09, 600, 0.8, 'lowpass', 0.4, 0.002);
      break;
    case 'fireBoom':
      noiseBurst(d, t, 0.7, 420, 0.5, 'lowpass', 1.2, 0.01);
      noiseBurst(d, t, 0.5, 2400, 0.6, 'bandpass', 0.3, 0.05);
      tone(d, t, 0.45, 100, 38, 'sine', 0.9);
      break;
    case 'blade': // espada cortando o ar
      noiseBurst(d, t, 0.13, 2600, 3, 'bandpass', 0.4, 0.03).frequency.exponentialRampToValueAtTime(5200, t + 0.12);
      break;
    case 'slice':
      noiseBurst(d, t, 0.07, 3600, 1.2, 'bandpass', 0.5, 0.001);
      tone(d, t, 0.12, 2100, 1500, 'triangle', 0.07);
      tone(d, t, 0.06, 300, 120, 'sine', 0.3);
      break;
    case 'gust': // rajada de vento
      noiseBurst(d, t, 0.45, 600, 1.2, 'bandpass', 0.6, 0.12).frequency.exponentialRampToValueAtTime(2000, t + 0.4);
      break;
    case 'chomp':
      noiseBurst(d, t, 0.06, 1400, 1.2, 'bandpass', 0.6, 0.001);
      tone(d, t, 0.1, 210 + Math.random() * 40, 70, 'square', 0.22);
      noiseBurst(d, t + 0.04, 0.12, 380, 0.8, 'lowpass', 0.8, 0.002);
      break;
    case 'growl':
      tone(d, t, 0.35, 70, 55, 'sawtooth', 0.22);
      tone(d, t, 0.35, 74, 60, 'sawtooth', 0.18);
      noiseBurst(d, t, 0.3, 300, 1.2, 'bandpass', 0.35, 0.05);
      break;
    case 'roar':
      tone(d, t, 1.1, 120, 45, 'sawtooth', 0.35);
      tone(d, t, 1.1, 127, 48, 'sawtooth', 0.3);
      noiseBurst(d, t, 1.0, 500, 0.7, 'bandpass', 0.8, 0.08).frequency.exponentialRampToValueAtTime(180, t + 1);
      tone(d, t + 0.1, 0.9, 660, 330, 'triangle', 0.08);
      break;
    case 'fury':
      tone(d, t, 0.2, 90, 160, 'sawtooth', 0.2);
      noiseBurst(d, t, 0.18, 900, 1, 'bandpass', 0.35, 0.02);
      break;
    case 'whistle':
      tone(d, t, 0.18, 1500, 2300, 'sine', 0.14);
      tone(d, t + 0.16, 0.28, 2300, 1300, 'sine', 0.12);
      break;
    case 'crackle':
      for (let i = 0; i < 5; i++) noiseBurst(d, t + Math.random() * 0.3, 0.03, 2500 + Math.random() * 2500, 2, 'bandpass', 0.35, 0.001);
      noiseBurst(d, t, 0.4, 500, 0.6, 'lowpass', 0.4, 0.05);
      break;
    case 'scream':
      tone(d, t, 0.5, 900, 1500, 'sawtooth', 0.06);
      tone(d, t, 0.5, 950, 1400, 'triangle', 0.08);
      break;
    case 'click':
      tone(d, t, 0.03, 1200, 1100, 'square', 0.06);
      break;
    default:
      break;
  }
}
