// Roda partidas só com bots, sem tela, pra checar regras e balanço.
import { HEROES } from '../src/config.js';
import { Sim } from '../src/sim.js';

const N = Number(process.argv[2]) || 3;
const diff = process.argv[3] || 'normal';
const DT = 1 / 30;
const results = [];
for (let m = 0; m < N; m++) {
  const events = { kill: 0, struct: 0, ann: [] };
  const sim = new Sim({ difficulty: diff, emit: (msg) => {
    if (msg.e === 'kill') events.kill++;
    if (msg.e === 'struct' && msg.d) events.struct++;
    if (msg.e === 'ann') events.ann.push(`${(sim?.gameTime / 60 || 0).toFixed(1)}m ${msg.t}`);
  } });
  sim.startGame();
  const t0 = performance.now();
  let steps = 0;
  let maxUnits = 0;
  let worst = 0;
  while (sim.phase === 'playing' && sim.gameTime < 60 * 40) {
    const s = performance.now();
    sim.step(DT);
    worst = Math.max(worst, performance.now() - s);
    steps++;
    maxUnits = Math.max(maxUnits, sim.units.length);
    if (steps % (30 * 120) === 0) {
      const st = sim.structs.map((t) => t.filter((s) => s.alive).map((s) => s.key).join(','));
      console.log(`  ${Math.round(sim.gameTime / 60)}min kills ${sim.kills} units ${sim.units.length} | azul[${st[0]}] verm[${st[1]}] lv ${sim.heroes.map((h) => h.level).join(',')}`);
    }
  }
  const ms = performance.now() - t0;
  console.log(`partida ${m + 1}: vencedor ${sim.winner === 0 ? 'Azul' : sim.winner === 1 ? 'Vermelho' : '—'} em ${(sim.gameTime / 60).toFixed(1)} min · abates ${sim.kills} · ${steps} passos em ${ms.toFixed(0)} ms (pior passo ${worst.toFixed(2)} ms, até ${maxUnits} unidades)`);
  for (const h of sim.heroes) {
    console.log(`   ${h.team ? 'V' : 'A'} ${HEROES[h.heroId].name.padEnd(10)} nv${String(h.level).padStart(2)} ${h.kills}/${h.deaths}/${h.assists} cs ${String(h.cs).padStart(3)} ouro ${Math.round(h.goldEarned)} dano ${Math.round(h.dmgDealt)} itens ${h.items.join(',')}`);
  }
  console.log('   anúncios:', events.ann.slice(0, 12).join(' | '));
  results.push({ winner: sim.winner, min: sim.gameTime / 60 });
}
console.log('resumo:', results.map((r) => `${r.winner}@${r.min.toFixed(1)}m`).join(' '));
