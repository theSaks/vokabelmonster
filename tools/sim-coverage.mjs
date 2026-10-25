// Simulation: Wie viele verschiedene Wörter einer 64er-Liste kommen nach k Spielen dran?
//   node tools/sim-coverage.mjs [pfad/zu/logic.js]   (Standard: ../logic.js)
// Modell: Spiel = 25 Monster (ein Kind spielt ~3 Level), 1–4 Monster gleichzeitig (onScreen ausgeschlossen),
// richtig beim 1. Versuch: neue Wörter 70 %, gesehene 85 %; falsch → Rache-Monster später im selben Spiel.
import { createRequire } from 'node:module'; import path from 'node:path';
const req = createRequire(import.meta.url);
const V = req(path.resolve(process.argv[2] || new URL('../logic.js', import.meta.url).pathname));
const pickFn = V.pickNext ? (ws, st, rnd, ex, recent, now) => V.pickNext(ws, st, { rnd, exclude: ex, recent, now }) : (ws, st, rnd, ex) => V.pick(ws, st, rnd, ex);
export function simulate({ n = 64, games = 12, perDay = 3, perGame = 25, seed = 1, onScreen = 2, accNew = 0.7, accSeen = 0.85 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const words = Array.from({ length: n }, (_, i) => ({ en: 'w' + i, de: 'x' + i })); const stats = {}, seen = new Set(), cov = [];
  let now = Date.UTC(2026, 9, 1, 15); const realNow = Date.now; Date.now = () => now;   // alte pick() nutzt Date.now()
  for (let g = 0; g < games; g++) {
    if (g && g % perDay === 0) now += 864e5; else now += 20 * 60e3;
    const recent = [], screen = [], revenge = [];
    for (let i = 0; i < perGame; i++) {
      let w;
      if (revenge.length && i % 4 === 3) w = revenge.shift();
      else w = pickFn(words, stats, rnd, new Set(screen.map(V.wkey)), recent, now);
      seen.add(V.wkey(w)); recent.push(V.wkey(w)); screen.push(w); if (screen.length > onScreen - 1) screen.shift();
      const ok = rnd() < (stats[V.wkey(w)] ? accSeen : accNew); V.record(stats, w, ok, now += 4000); if (!ok) revenge.push(w);
    }
    cov.push(seen.size);
  }
  Date.now = realNow; return cov;
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const sc = [['gute Spielerin (70/85 %), 25 Monster', { accNew: 0.7, accSeen: 0.85, perGame: 25 }], ['Anfänger (50/70 %), 20 Monster', { accNew: 0.5, accSeen: 0.7, perGame: 20 }]];
  for (const [name, o] of sc) for (const perDay of [99, 3]) {
    const runs = Array.from({ length: 20 }, (_, i) => simulate({ ...o, perDay, seed: i + 1 }));
    const avg = runs[0].map((_, k) => (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(0)), min = runs[0].map((_, k) => Math.min(...runs.map(r => r[k])));
    console.log(`${name}, ${perDay === 99 ? 'alle an 1 Tag' : '3 Spiele/Tag'}:\n  Ø  ${avg.join(' ')}\n  min ${min.join(' ')}`); }
}
