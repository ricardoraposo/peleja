import { BUILDS, ITEMS, TOWER, abilityOf, BUILDS_ALT, nextBuy } from './config.js';
import { fountainX, pushDir } from './geo.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hpf = (u) => u.hp / u.maxHp;

export class BotBrain {
  constructor(hero, sim, diff) {
    this.h = hero;
    this.sim = sim;
    this.diff = diff;
    this.zOff = (((hero.id * 37) % 7) - 3) * 0.9;
    this.track = new Map();
    this.reset();
  }

  reset() {
    this.t = Math.random() * 0.4;
    this.castLock = 0;
    this.lastMove = null;
    this.kiteT = 0;
  }

  update(dt) {
    this.t -= dt;
    this.castLock -= dt;
    this.kiteT -= dt;
    if (this.t > 0) return;
    this.t = this.diff.think * (0.8 + Math.random() * 0.4);
    const { h, sim } = this;
    if (sim.canShop(h)) this.shop();
    if (!h.alive || sim.phase !== 'playing' || h.dash || h.castT > 0) return;
    this.think();
  }

  shop() {
    const { h, sim } = this;
    // metade dos bots segue a build alternativa da classe, pra variar as partidas
    const alt = BUILDS_ALT[h.def.role];
    const build = (h.id % 2 === 1 && alt ? alt.items : BUILDS[h.def.role]) || BUILDS.lutador;
    for (let n = 0; n < 5; n++) {
      const next = build.find((id) => !h.items.includes(id));
      if (!next) return;
      const pick = nextBuy(h.items, h.gold, next);
      if (!pick) return;
      // peça solta só entra se ainda houver espaço sobrando pra montar depois
      if (pick !== next && !ITEMS[pick].from && h.items.length >= 5) return;
      if (!sim.buy(h, pick)) return;
    }
  }

  velocity(e) {
    const v = this.track.get(e.id);
    return v ? [v.vx, v.vz] : [0, 0];
  }

  updateTrack(list) {
    const now = this.sim.time;
    for (const e of list) {
      const p = this.track.get(e.id);
      if (p && now - p.t > 0.05) {
        const k = 1 / (now - p.t);
        p.vx = (e.x - p.x) * k;
        p.vz = (e.z - p.z) * k;
        if (Math.hypot(p.vx, p.vz) > 12) p.vx = p.vz = 0;
        p.x = e.x;
        p.z = e.z;
        p.t = now;
      } else if (!p) this.track.set(e.id, { x: e.x, z: e.z, t: now, vx: 0, vz: 0 });
    }
  }

  aimAt(e, delay) {
    const [vx, vz] = this.velocity(e);
    const k = delay * this.diff.aim;
    const err = this.diff.aimErr;
    return [e.x + vx * k + (Math.random() - 0.5) * err, e.z + vz * k + (Math.random() - 0.5) * err];
  }

  move(x, z) {
    const { h, sim } = this;
    const o = h.order;
    if (o.type === 'move' && Math.hypot(o.x - x, o.z - z) < 0.8) return;
    if (o.type === 'idle' && Math.hypot(h.x - x, h.z - z) < 1.2) return;
    sim.orderMove(h, x, z);
  }

  attack(t) {
    const { h, sim } = this;
    if (h.order.type === 'attack' && h.order.target === t) return;
    sim.orderAttack(h, t);
  }

  towerThreat(x, z, team) {
    for (const s of this.sim.structs[1 - team]) {
      if (!s.alive || s.kind !== 'tower') continue;
      if (Math.hypot(s.x - x, s.z - z) <= TOWER.range + 1.2) return s;
    }
    return null;
  }

  towerTanked(s) {
    const { h, sim } = this;
    if (s.target === h) return false;
    let n = 0;
    for (const u of sim.units) {
      if (u.alive && u.isMinion && u.team === h.team && dist(u, s) <= TOWER.range) n++;
    }
    return n >= 2 && s.target && s.target.isMinion;
  }

  think() {
    const { h, sim, diff } = this;
    const dir = pushDir(h.team);
    const life = hpf(h);
    const enemies = [];
    const allies = [];
    for (const o of sim.heroes) {
      if (!o.alive || o === h) continue;
      if (o.team === h.team) allies.push(o);
      else enemies.push(o);
    }
    this.updateTrack(enemies);
    const near = enemies.filter((e) => dist(e, h) < 14);
    const alliesNear = allies.filter((a) => dist(a, h) < 12);
    const minions = [];
    let front = null;
    for (const u of sim.units) {
      if (!u.alive || !u.isMinion) continue;
      if (u.team !== h.team) {
        if (dist(u, h) < 13) minions.push(u);
      } else if (front === null || u.x * dir > front * dir) front = u.x;
    }
    const myTowers = sim.structs[h.team].filter((s) => s.alive && s.kind === 'tower');
    let towerX = sim.structs[h.team].core.x;
    for (const s of myTowers) if (s.x * dir > towerX * dir) towerX = s.x;
    if (front === null || front * dir < towerX * dir - 6) front = towerX + dir * 3;

    const threat = this.towerThreat(h.x, h.z, h.team);
    const targetedByTower = threat && threat.target === h;
    // vantagem: time inimigo desfalcado → hora de derrubar estrutura
    const lead = allies.length + 1 - enemies.length;
    const pushing = enemies.length <= 1 || lead >= 2 || (lead >= 1 && sim.gameTime > 14 * 60);
    const ctx = { enemies, near, alliesNear, minions, life, dir, fight: false, target: null, threat, pushing };
    let siege = null;
    if (pushing) {
      siege = this.siegeTarget();
      if (siege && dist(siege, h) > 30) siege = null;
    }
    const tankers = threat ? allies.filter((a) => dist(a, threat) <= TOWER.range + 1).length : 0;
    const holdTower = targetedByTower && pushing && life > 0.45 && (hpf(threat) < 0.35 || tankers >= 2);

    // 1) perigo: recua
    const danger = near.filter((e) => dist(e, h) < 9).length;
    if ((life < 0.28 && danger > 0) || (targetedByTower && !holdTower && !(life > 0.6 && near.some((e) => hpf(e) < 0.2 && dist(e, h) < h.stats.range + 1)))) {
      this.tryEscape(ctx);
      const fx = fountainX(h.team);
      const backX = Math.abs(h.x - fx) < 6 ? fx : h.x - dir * 9;
      this.move(backX, this.zOff * 0.5);
      return;
    }

    // 2) escolhe um herói pra brigar
    let target = null;
    let best = Infinity;
    const reach = h.stats.range + (h.ranged ? 3 : 4.5) + diff.aggro * 2;
    for (const e of near) {
      const d = dist(e, h) - e.r - h.r;
      if (d > reach) continue;
      const score = hpf(e) * 1.4 + d / 15 - (e.stunT > 0 || e.rootT > 0 ? 0.3 : 0);
      if (score < best) {
        best = score;
        target = e;
      }
    }
    if (target) {
      const under = this.towerThreat(target.x, target.z, h.team);
      let score = life - hpf(target) + (alliesNear.length + 1 - near.length) * 0.15 + diff.aggro - 0.35;
      if (under && !this.towerTanked(under)) score = hpf(target) < 0.2 && life > 0.55 && diff.aggro > 0.5 ? 0.1 : -1;
      if (dist(target, h) <= h.stats.range + h.r + target.r + 0.5) score += 0.25;
      ctx.fight = score > 0;
      ctx.target = target;
    }

    if (this.castLock <= 0 && Math.random() < diff.abilityRate + 0.15 && this.tryAbilities(ctx)) {
      this.castLock = 0.35 + diff.reaction * (0.6 + Math.random() * 0.8);
      return;
    }

    // 3) fruta de cura
    if (life < 0.55 && !ctx.fight) {
      let pack = null;
      let pd = 24;
      for (const p of sim.packs) {
        if (!p.up) continue;
        const d = Math.hypot(p.x - h.x, p.z - h.z);
        if (d >= pd) continue;
        const contested = enemies.some((e) => Math.hypot(e.x - p.x, e.z - p.z) < d * 0.7);
        if (contested || this.towerThreat(p.x, p.z, h.team)) continue;
        pd = d;
        pack = p;
      }
      if (pack) {
        this.move(pack.x, pack.z);
        return;
      }
    }

    if (ctx.fight && target) {
      if (h.ranged && diff.kite > 0 && this.kiteT <= 0 && h.atkCd > 0.25 && h.windup <= 0) {
        const close = near.find((e) => !e.ranged && dist(e, h) < 3.2);
        if (close && Math.random() < diff.kite) {
          const ax = h.x - close.x;
          const az = h.z - close.z;
          const l = Math.hypot(ax, az) || 1;
          this.kiteT = 0.35;
          sim.orderMove(h, h.x + (ax / l) * 2.5, h.z + (az / l) * 2.5);
          return;
        }
      }
      this.attack(target);
      return;
    }

    // 4) cerco: com vantagem, bate na estrutura
    if (siege) {
      const tower = siege.kind === 'tower' ? siege : this.towerThreat(siege.x, siege.z, h.team);
      const helpers = allies.filter((a) => dist(a, siege) <= TOWER.range + 4).length;
      const ok = !tower || this.towerTanked(tower) || hpf(tower) < 0.25 || (life > 0.55 && helpers >= 1) || (life > 0.75 && enemies.length === 0);
      if (ok) {
        this.attack(tower && tower !== siege && !this.towerTanked(tower) && !tower.invuln ? tower : siege);
        return;
      }
    }

    // 5) farma e empurra
    const atk = h.stats.atk;
    let lastHit = null;
    let push = null;
    for (const m of minions) {
      const t = this.towerThreat(m.x, m.z, h.team);
      if (t && !this.towerTanked(t)) continue;
      const dmg = atk * (100 / (100 + m.stats.armor));
      const d = dist(m, h);
      if (d > h.stats.range + 6) continue;
      if (m.hp <= dmg * 1.05 && (!lastHit || m.hp < lastHit.hp)) lastHit = m;
      if (!push || m.hp < push.hp) push = m;
    }
    if (lastHit && Math.random() < 0.4 + diff.lastHit * 0.6) {
      this.attack(lastHit);
      return;
    }
    if (push && (Math.random() > diff.lastHit * 0.5 || push.hp < atk * 2.2)) {
      this.attack(push);
      return;
    }
    if (push) {
      // espera o último golpe perto da tropa
      this.move(push.x - dir * (h.stats.range + 0.5), push.z * 0.5 + this.zOff * 0.3);
      return;
    }

    // estrutura?
    for (const s of sim.structs[1 - h.team]) {
      if (!s.alive || s.invuln || dist(s, h) > h.stats.range + 9) continue;
      const t = s.kind === 'tower' ? s : this.towerThreat(s.x, s.z, h.team);
      if (t && !this.towerTanked(t) && t !== s) continue;
      if (s.kind === 'tower' && !this.towerTanked(s)) continue;
      this.attack(s);
      return;
    }

    // 6) segue a linha de frente
    let ax = front - dir * (h.ranged ? 5.5 : 2.5);
    for (const s of sim.structs[1 - h.team]) {
      if (!s.alive || s.kind !== 'tower') continue;
      if (Math.abs(ax - s.x) <= TOWER.range + 1.5 && !this.towerTanked(s)) ax = s.x - dir * (TOWER.range + 1.8);
    }
    this.move(ax, this.zOff);
  }

  siegeTarget() {
    const { h, sim } = this;
    let best = null;
    let bd = Infinity;
    for (const s of sim.structs[1 - h.team]) {
      if (!s.alive || s.invuln) continue;
      const d = dist(s, h);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  tryEscape(ctx) {
    const { h, sim } = this;
    const fx = fountainX(h.team);
    const ex = h.x - ctx.dir * 8;
    for (const slot of ['e', 'w', 'f', 'd']) {
      if (h.cds[slot] > 0) continue;
      const ab = abilityOf(h.heroId, slot, h.spells);
      if (slot === 'd' && ctx.life < 0.35) {
        sim.cast(h, 'd', h.x, h.z);
        return true;
      }
      if (slot === 'f' && ctx.life > 0.22) continue;
      if (ab.kind === 'blink' || (ab.kind === 'dash' && !ab.end && !ab.path)) {
        sim.cast(h, slot, Math.abs(ex - fx) < Math.abs(h.x - fx) ? ex : fx, h.z * 0.5);
        return true;
      }
      if (ab.kind === 'self' && (ab.heal || ab.shield || ab.buff?.ms)) {
        sim.cast(h, slot, h.x, h.z);
        return true;
      }
    }
    return false;
  }

  tryAbilities(ctx) {
    const { h, sim } = this;
    const slots = ['r', 'q', 'w', 'e', 'd'];
    for (const slot of slots) {
      if (h.cds[slot] > 0 || !(h.ranks?.[slot] > 0)) continue;
      const ab = abilityOf(h.heroId, slot, h.spells);
      const plan = this.plan(slot, ab, ctx);
      if (!plan) continue;
      if (sim.cast(h, slot, plan[0], plan[1], plan[2])) return true;
    }
    return false;
  }

  reachOf(ab) {
    switch (ab.kind) {
      case 'proj':
        return ab.range * 0.9;
      case 'aoe':
      case 'zone':
        return ab.range + ab.radius * 0.5;
      case 'cone':
        return ab.range + 0.4;
      case 'nova':
        return ab.radius * (ab.delay > 0 ? 0.65 : 0.9);
      case 'target':
        return ab.range + 0.5;
      case 'dash':
        return ab.range + (ab.end ? ab.end.radius * 0.5 : 0) + (ab.bolts ? ab.bolts.range * 0.6 : 0);
      // teleporte que fere: ou atira na chegada (bolts) ou explode onde você estava (origin), então o inimigo precisa estar colado
      case 'blink':
        return ab.bolts ? ab.range + ab.bolts.range * 0.6 : ab.origin ? ab.origin.radius * 0.8 : 0;
      default:
        return 0;
    }
  }

  delayOf(ab, d) {
    const cast = ab.cast || 0;
    if (ab.kind === 'proj') return cast + d / ab.speed;
    if (ab.kind === 'aoe' || ab.kind === 'nova') return cast + (ab.delay || 0);
    if (ab.kind === 'zone') return cast + 0.4;
    if (ab.kind === 'dash') return cast + d / ab.speed;
    return cast;
  }

  plan(slot, ab, ctx) {
    const { h, sim, diff } = this;
    const { target, near, life } = ctx;
    const offensive = ab.dmg || ab.end || ab.path || ab.kind === 'zone' || (ab.kind === 'dash' && ab.bolts) || (ab.kind === 'blink' && (ab.bolts || ab.origin));
    if (offensive) {
      const reach = this.reachOf(ab);
      let e = target && dist(target, h) <= reach + target.r ? target : null;
      if (!e) {
        let bd = Infinity;
        for (const o of near) {
          const d = dist(o, h);
          if (d <= reach + o.r && hpf(o) * 10 + d < bd) {
            bd = hpf(o) * 10 + d;
            e = o;
          }
        }
      }
      if (e) {
        const engage = ab.kind === 'dash' || (ab.kind === 'target' && ab.dashTo);
        if (engage) {
          const under = this.towerThreat(e.x, e.z, h.team);
          if (under && !this.towerTanked(under) && hpf(e) > 0.15) return null;
          if (!ctx.fight && !(hpf(e) < 0.3 && life > 0.35)) return null;
        }
        if (slot === 'r') {
          const others = near.filter((o) => o !== e && dist(o, e) < (ab.radius || ab.width || 3) + 1).length;
          if (hpf(e) > 0.65 && others === 0 && life > 0.35) return null;
        }
        if (ab.kind === 'nova' || (ab.kind === 'self' && ab.buff?.aura)) return [h.x, h.z, 0];
        if (ab.kind === 'blink' && ab.origin) {
          // some pra longe do alvo e deixa a explosão pra trás, em cima dele
          const d = dist(e, h) || 1;
          return [h.x - ((e.x - h.x) / d) * ab.range, h.z - ((e.z - h.z) / d) * ab.range, 0];
        }
        if ((ab.kind === 'dash' || ab.kind === 'blink') && ab.bolts) {
          // mergulho que atira na chegada: para a uma distância segura do alvo em vez de cair em cima dele
          const d = dist(e, h) || 1;
          const keep = ab.bolts.range * 0.6;
          if (d <= keep) return [h.x - (e.z - h.z) / d * 3, h.z + (e.x - h.x) / d * 3, 0];
          return [e.x - ((e.x - h.x) / d) * keep, e.z - ((e.z - h.z) / d) * keep, 0];
        }
        const [x, z] = this.aimAt(e, this.delayOf(ab, dist(e, h)));
        return [x, z, e.id];
      }
      if (slot === 'r' || ab.kind === 'target' || ab.kind === 'dash' || ab.kind === 'zone') return null;
      if (ctx.threat && !this.towerTanked(ctx.threat)) return null;
      if (Math.random() > 0.3 * diff.abilityRate) return null;
      const reachM = this.reachOf(ab);
      const inReach = ctx.minions.filter((m) => dist(m, h) <= reachM);
      if (inReach.length < 3) return null;
      let cx = 0;
      let cz = 0;
      for (const m of inReach) {
        cx += m.x;
        cz += m.z;
      }
      return [cx / inReach.length, cz / inReach.length, 0];
    }
    if (ab.kind === 'self') {
      if (ab.bolts) return near.some((e) => dist(e, h) <= ab.bolts.range + e.r) ? [h.x, h.z, 0] : null;
      const fightingNear = near.some((e) => dist(e, h) < 7);
      if (ab.nextHit) {
        const t = ctx.target;
        return ctx.fight && t && !h.empower && dist(t, h) <= h.stats.range + h.r + t.r + ab.nextHit.range + 1 ? [h.x, h.z, 0] : null;
      }
      if (ab.buff?.aura) return (fightingNear && ctx.fight) || (fightingNear && life < 0.35) ? [h.x, h.z, 0] : null;
      if (ab.heal && life < 0.55 && (fightingNear || sim.time - h.combatT < 3)) return [h.x, h.z, 0];
      if (ab.shield && fightingNear && (ctx.fight || life < 0.6)) return [h.x, h.z, 0];
      if (!ab.heal && !ab.shield && ab.buff && ctx.fight && ctx.target && dist(ctx.target, h) < 9) return [h.x, h.z, 0];
      return null;
    }
    if (ab.kind === 'ally') {
      if (ab.heal) {
        let pick = null;
        for (const a of [h, ...ctx.alliesNear]) {
          if (hpf(a) > 0.65 || dist(a, h) > ab.range + ab.radius * 0.5) continue;
          if (!pick || hpf(a) < hpf(pick)) pick = a;
        }
        return pick ? [pick.x, pick.z, 0] : null;
      }
      if (ab.shield) {
        const busy = [h, ...ctx.alliesNear].filter((a) => dist(a, h) <= ab.radius && near.some((e) => dist(e, a) < 7));
        return busy.length > 0 && (ctx.fight || life < 0.6) ? [h.x, h.z, 0] : null;
      }
    }
    if (ab.kind === 'dash' && ctx.fight && ctx.target && ab.buff) {
      const d = dist(ctx.target, h);
      if (d > h.stats.range + 1.5 && d < h.stats.range + ab.range && hpf(ctx.target) < 0.45) return [ctx.target.x, ctx.target.z, 0];
      // quem bate de longe usa o avanço pra se afastar de quem chegou perto, e ainda ganha o bônus
      const close = h.ranged && near.find((o) => !o.ranged && dist(o, h) < 3);
      if (close) {
        const c = dist(close, h) || 1;
        return [h.x + ((h.x - close.x) / c) * ab.range, h.z + ((h.z - close.z) / c) * ab.range, 0];
      }
    }
    return null;
  }
}
