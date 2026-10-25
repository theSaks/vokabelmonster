// 1.19 Simulation: An welchem Tag kommt Belohnung 1…10? (sichere Wörter UND Lerntage, max. 1 pro Tag)
//   node tools/sim-rewards.mjs [Wochen=10] [Spieltage/Woche=5] [Schwellen sichere Wörter, z. B. 2,6,12,…]
// Modell: Wortauswahl = echte Logik (logic.js pickNext/record). Pro Spieltag 2 Runden à 20 Monster, Wortschatz 150 Wörter (mehrere Listen),
// Rache-Monster nach 3 Monstern; zählt nur, wenn ohne Fehler getroffen. Treffer beim 1. Versuch: neue Wörter / schon gesehene Wörter.
import { createRequire } from 'node:module'; import path from 'node:path';
const V = createRequire(import.meta.url)(path.resolve(new URL('../logic.js', import.meta.url).pathname));
const REWARDS = Array.from({ length: 10 }, (_, i) => ({ id: 'r' + (i + 1), rank: i + 1 }));
export function simulate({ seed = 1, n = 150, weeks = 10, playDays = 5, rounds = 2, perGame = 20, accNew = 0.55, accSeen = 0.75 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const words = Array.from({ length: n }, (_, i) => ({ en: 'w' + i, de: 'x' + i })), stats = {}, prog = { pops: 0, wins: 0, solved: 0, kept: [], v19: true, v119: true }, at = [];
  const start = new Date(2026, 9, 5, 15).getTime(); let now = start; const realNow = Date.now; Date.now = () => now;
  for (let d = 0; d < weeks * 7; d++) { if (d % 7 >= playDays) continue;
    for (let g = 0; g < rounds; g++) { now = start + d * 864e5 + g * 3600e3; const recent = [], screen = [], revenge = []; let since = 0;
      for (let i = 0; i < perGame; i++) { let w, rev = false;
        if (revenge.length && since >= 3) { w = revenge.shift(); rev = true; since = 0; } else { w = V.pickNext(words, stats, { rnd, exclude: new Set(screen.map(V.wkey)), recent, now }); since++; }
        recent.push(V.wkey(w)); screen.push(w); if (screen.length > 1) screen.shift();
        const st0 = stats[V.wkey(w)], ok = rnd() < (st0 ? accSeen : accNew); now += 30000;
        if (ok) { const was = V.isMastered(st0), st = V.record(stats, w, true, now); if (st.solved) prog.solved++; if (!was && V.isMastered(st)) V.noteMastered(prog, st); V.noteFirstTry(prog, now); }
        else if (!rev) { V.record(stats, w, false, now); revenge.push(w); }   // Rache nach Fehler: Wort wird nachgetippt, zählt nicht
        const r = V.grantReward(prog, REWARDS, now); if (r) at[r.rank - 1] = d + 1; } } }
  Date.now = realNow; return at;
}
export const KIDS = { 'schwach (40/60 %)': { accNew: 0.4, accSeen: 0.6 }, 'gemischt (55/75 %)': { accNew: 0.55, accSeen: 0.75 }, 'gut (75/90 %)': { accNew: 0.75, accSeen: 0.9 } };
if (import.meta.url === 'file://' + process.argv[1]) {
  const weeks = +(process.argv[2] || 10), playDays = +(process.argv[3] || 5), RUNS = 21;
  if (process.argv[4]) process.argv[4].split(',').map(Number).forEach((x, i) => { V.REW_MASTER[i] = x; });   // Schwellen zum Ausprobieren: 3,8,14,…
  console.log(`Schwellen sichere Wörter: ${V.REW_MASTER.join(' ')} | Lerntage: ${V.REW_DAYS.join(' ')} | max. 1/Tag | ${playDays} Spieltage/Woche, 2 Runden à 20`);
  for (const [name, o] of Object.entries(KIDS)) { const runs = Array.from({ length: RUNS }, (_, i) => simulate({ ...o, weeks, playDays, seed: i + 1 }));
    const med = k => { const v = runs.map(r => r[k] ?? Infinity).sort((a, b) => a - b)[RUNS >> 1]; return v === Infinity ? '–' : v; };
    console.log(`  ${name.padEnd(20)} Kalendertag (Median) Belohnung 1…10: ${Array.from({ length: 10 }, (_, k) => String(med(k)).padStart(3)).join(' ')}`); }
}
