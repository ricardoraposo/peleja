import { MAP, STRUCTS, STRUCT_SIZE } from './config.js';

// A ponte: um retângulo comprido no meio e um círculo de base em cada ponta.

export const OBSTACLES = [];
for (const [x, z, r] of MAP.obstacles) {
  OBSTACLES.push({ x, z, r });
  if (x !== 0) OBSTACLES.push({ x: -x, z: -z, r });
  else OBSTACLES.push({ x, z: -z, r });
}

export const PACKS = [];
for (const [x, z] of MAP.packs) {
  PACKS.push({ x, z });
  PACKS.push({ x: -x, z: -z });
}

export function structLayout(team) {
  const s = team === 0 ? 1 : -1;
  return STRUCTS.map((d) => ({ ...d, x: d.x * s, z: d.z * s, r: STRUCT_SIZE[d.kind] }));
}

export const baseX = (team) => (team === 0 ? -MAP.baseX : MAP.baseX);
export const fountainX = (team) => (team === 0 ? -MAP.fountainX : MAP.fountainX);
// onde fica o canhão da base de cada time
export const cannonPos = (team) => (team === 0 ? { x: MAP.cannon.x, z: MAP.cannon.z } : { x: -MAP.cannon.x, z: -MAP.cannon.z });
// direção em x pra onde o time avança
export const pushDir = (team) => (team === 0 ? 1 : -1);

export function inBase(team, x, z) {
  return Math.hypot(x - baseX(team), z) <= MAP.baseR;
}

export function walkable(x, z, r = 0) {
  if (Math.abs(x) <= MAP.laneHalf && Math.abs(z) <= MAP.laneWidth - r) return true;
  const R = MAP.baseR - r;
  return Math.hypot(x - MAP.baseX, z) <= R || Math.hypot(x + MAP.baseX, z) <= R;
}

// ponto andável mais perto de (x, z)
export function clampWalk(x, z, r = 0) {
  if (walkable(x, z, r)) return [x, z];
  let best = null;
  let bestD = Infinity;
  const W = MAP.laneWidth - r;
  const rx = Math.max(-MAP.laneHalf, Math.min(MAP.laneHalf, x));
  const rz = Math.max(-W, Math.min(W, z));
  const d0 = (rx - x) ** 2 + (rz - z) ** 2;
  if (d0 < bestD) {
    bestD = d0;
    best = [rx, rz];
  }
  for (const cx of [-MAP.baseX, MAP.baseX]) {
    const dx = x - cx;
    const d = Math.hypot(dx, z) || 1;
    const R = MAP.baseR - r;
    const px = cx + (dx / d) * R;
    const pz = (z / d) * R;
    const dd = (px - x) ** 2 + (pz - z) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = [px, pz];
    }
  }
  return best;
}

// empurra um círculo pra fora de outro
export function pushOut(u, o, extra = 0) {
  const dx = u.x - o.x;
  const dz = u.z - o.z;
  const min = u.r + o.r + extra;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2) || 0.001;
  const nx = d > 0.001 ? dx / d : 1;
  const nz = d > 0.001 ? dz / d : 0;
  u.x = o.x + nx * min;
  u.z = o.z + nz * min;
  return true;
}

// distância de ponto a segmento, devolve [dist², t]
export function segDist2(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + vx * t - px;
  const cz = az + vz * t - pz;
  return [cx * cx + cz * cz, t];
}
