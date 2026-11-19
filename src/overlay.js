import * as THREE from 'three';
import { F } from './sim.js';
import { MAP } from './config.js';

const _v = new THREE.Vector3();
const COLORS = { me: '#5ee67a', ally: '#4aa3ff', enemy: '#f43f5e' };
const DMG_COLORS = ['#ffb35c', '#c084fc', '#ffffff'];

// Desenha barras de vida, nomes e números flutuantes num canvas 2D por cima do 3D.
export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.texts = [];
    this.dpr = 1;
  }

  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.w = w;
    this.h = h;
  }

  float(x, y, z, text, color, size = 18, life = 0.9, rise = 50) {
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push({ x, y, z, text, color, size, life, max: life, rise, jitter: (Math.random() - 0.5) * 24 });
  }

  damage(x, z, amount, type, mine) {
    this.float(x, 2.6, z, String(amount), mine ? DMG_COLORS[type] : '#ff6b6b', mine ? (amount > 300 ? 28 : 21) : 17);
  }

  project(x, y, z, camera) {
    _v.set(x, y, z).project(camera);
    if (_v.z > 1 || _v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.2) return null;
    return [(_v.x * 0.5 + 0.5) * this.w, (-_v.y * 0.5 + 0.5) * this.h];
  }

  bar(x, y, w, h, frac, color, shieldFrac = 0, ticks = 0, u = null, dt = 0) {
    const c = this.ctx;
    c.fillStyle = 'rgba(8,10,18,0.85)';
    c.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (u) {
      if (!(u.hpLag >= frac)) u.hpLag = frac;
      else u.hpLag = Math.max(frac, u.hpLag - dt * Math.max(0.35, (u.hpLag - frac) * 2.5));
      if (u.hpLag > frac) {
        c.fillStyle = '#fff3c4';
        c.fillRect(x, y, Math.min(1, u.hpLag) * w, h);
      }
    }
    c.fillStyle = color;
    c.fillRect(x, y, fw, h);
    if (shieldFrac > 0) {
      c.fillStyle = 'rgba(240,248,255,0.95)';
      c.fillRect(x + fw, y, Math.min(w - fw, shieldFrac * w), h);
    }
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(x, y, fw, Math.max(1, h * 0.35));
    if (ticks > 1) {
      c.fillStyle = 'rgba(0,0,0,0.55)';
      for (let i = 1; i < ticks; i++) c.fillRect(x + (w * i) / ticks, y, 1, h * (i % 5 === 0 ? 1 : 0.6));
    }
  }

  draw(game, dt) {
    const c = this.ctx;
    const cam = game.camera;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const myTeam = game.myTeam;
    for (const u of game.units.values()) {
      if (!u.alive || u.kind === 'pack') continue;
      const rel = u.id === game.myId ? 'me' : u.team === myTeam ? 'ally' : 'enemy';
      if (u.kind === 'hero') {
        const lift = u.flags & F.air ? 1.2 : 0;
        const p = this.project(u.x, 3.4 + lift + (u.def?.look.scale || 1) * 0.3, u.z, cam);
        if (!p) continue;
        const w = 92;
        const x = p[0] - w / 2 + 10;
        const y = p[1];
        const total = Math.max(u.maxHp, u.hp + u.shield);
        this.bar(x, y, w, 10, u.hp / total, COLORS[rel], u.shield / total, Math.floor(u.maxHp / 200), u, dt);
        c.fillStyle = 'rgba(8,10,18,0.9)';
        c.fillRect(x - 22, y - 2, 20, 14);
        c.fillStyle = '#f4f1ea';
        c.font = '700 11px "Chakra Petch", monospace';
        c.fillText(String(u.level), x - 12, y + 5.5);
        c.font = '600 12px Rubik, system-ui, sans-serif';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        const name = u.name || '';
        c.strokeText(name, p[0] + 10, y - 10);
        c.fillStyle = rel === 'enemy' ? '#ffd0d6' : rel === 'me' ? '#fff3c4' : '#d6ebff';
        c.fillText(name, p[0] + 10, y - 10);
        if (u.flags & F.stasis) {
          c.font = '700 11px Rubik, sans-serif';
          c.fillStyle = '#e8c170';
          c.strokeText('ESTÁTUA', p[0] + 10, y + 22);
          c.fillText('ESTÁTUA', p[0] + 10, y + 22);
        } else if (u.flags & F.recall) {
          c.font = '700 11px Rubik, sans-serif';
          c.fillStyle = '#7dd3fc';
          const k = Math.min(1, (u.model?.recallAge || 0) / MAP.recall);
          const left = Math.max(0, MAP.recall * (1 - k));
          c.strokeText(`VOLTANDO ${left.toFixed(1)} s`, p[0] + 10, y + 22);
          c.fillText(`VOLTANDO ${left.toFixed(1)} s`, p[0] + 10, y + 22);
          // barra de progresso da volta pra base
          const bw = 96;
          const bx = p[0] + 10 - bw / 2;
          const by = y + 28;
          c.fillStyle = 'rgba(8, 15, 28, 0.85)';
          c.fillRect(bx - 2, by - 2, bw + 4, 11);
          c.fillStyle = '#7dd3fc';
          c.fillRect(bx, by, bw * k, 7);
          c.fillStyle = '#e0f2fe';
          c.fillRect(bx + bw * k - 2, by, 2, 7);
        } else if (u.flags & F.sleep) {
          c.font = '700 11px Rubik, sans-serif';
          c.fillStyle = '#c4b5fd';
          c.strokeText('DORMINDO', p[0] + 10, y + 22);
          c.fillText('DORMINDO', p[0] + 10, y + 22);
        } else if (u.flags & F.charm) {
          c.font = '700 11px Rubik, sans-serif';
          c.fillStyle = '#ff8fab';
          c.strokeText('ENCANTADO', p[0] + 10, y + 22);
          c.fillText('ENCANTADO', p[0] + 10, y + 22);
        } else if (u.flags & F.stun || u.flags & F.root || u.flags & F.air) {
          c.font = '700 11px Rubik, sans-serif';
          c.fillStyle = '#fde047';
          const tag = u.flags & F.root ? 'PRESO' : u.flags & F.air ? 'NO AR' : 'ATORDOADO';
          c.strokeText(tag, p[0] + 10, y + 22);
          c.fillText(tag, p[0] + 10, y + 22);
        }
      } else if (u.kind === 'tower' || u.kind === 'selo' || u.kind === 'core') {
        const top = u.kind === 'tower' ? 6.6 : u.kind === 'core' ? 6 : 3.6;
        const p = this.project(u.x, top, u.z, cam);
        if (!p) continue;
        const w = u.kind === 'core' ? 150 : 120;
        this.bar(p[0] - w / 2, p[1], w, 9, u.hp / u.maxHp, rel === 'enemy' ? COLORS.enemy : COLORS.ally, 0, 0, u, dt);
        if (u.flags & F.invuln) {
          const sx = p[0] + w / 2 + 11;
          const sy = p[1] + 4;
          c.fillStyle = 'rgba(230,236,255,0.9)';
          c.beginPath();
          c.moveTo(sx, sy - 7);
          c.lineTo(sx + 6, sy - 4);
          c.lineTo(sx + 5, sy + 3);
          c.lineTo(sx, sy + 7);
          c.lineTo(sx - 5, sy + 3);
          c.lineTo(sx - 6, sy - 4);
          c.closePath();
          c.fill();
        }
      } else {
        if (u.hp >= u.maxHp && !game.hoverId) continue;
        const p = this.project(u.x, u.kind === 'super' ? 2.8 : u.kind === 'siege' ? 1.9 : 1.6, u.z, cam);
        if (!p) continue;
        const w = u.kind === 'siege' || u.kind === 'super' ? 46 : 34;
        this.bar(p[0] - w / 2, p[1], w, 4, u.hp / u.maxHp, rel === 'enemy' ? '#ff5470' : '#5aaeff', 0, 0, u, dt);
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      const p = this.project(t.x, t.y, t.z, cam);
      if (!p) continue;
      const k = 1 - t.life / t.max;
      const pop = k < 0.15 ? 1 + (0.15 - k) * 3 : 1;
      c.globalAlpha = Math.min(1, t.life / (t.max * 0.4));
      c.font = `900 ${Math.round(t.size * pop)}px Rubik, system-ui, sans-serif`;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      const y = p[1] - k * t.rise;
      c.strokeText(t.text, p[0] + t.jitter, y);
      c.fillStyle = t.color;
      c.fillText(t.text, p[0] + t.jitter, y);
      c.globalAlpha = 1;
    }
  }
}
