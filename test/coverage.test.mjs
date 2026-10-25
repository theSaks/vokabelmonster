// 1.15 Regression: Wortauswahl deckt lange Listen ab (vorher kamen bei 64 Wörtern viele Wörter kaum/nie dran)
import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
import { simulate } from '../tools/sim-coverage.mjs';
const V = createRequire(import.meta.url)('../logic.js');
const W = n => Array.from({ length: n }, (_, i) => ({ en: 'w' + i, de: 'x' + i }));
const lcg = seed => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const D = 864e5, T0 = Date.UTC(2026, 9, 16, 15);

test('64 Wörter, mehrere Spiele an einem Tag: alle spätestens im 6. Spiel (Anfänger) bzw. 4. Spiel (gut)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const good = simulate({ seed, perDay: 99 }), beg = simulate({ seed, perDay: 99, accNew: 0.5, accSeen: 0.7, perGame: 20 });
    assert.equal(good[3], 64, 'gut ' + good); assert.equal(beg[5], 64, 'Anfänger ' + beg); assert.ok(good[0] >= 17, 'Spiel 1: ' + good[0]);
  }
});
test('64 Wörter über mehrere Tage (3 Spiele/Tag): alle spätestens im 7. Spiel', () => {
  for (let seed = 1; seed <= 20; seed++) { const c = simulate({ seed, perDay: 3, accNew: 0.5, accSeen: 0.7, perGame: 20 }); assert.equal(c[6], 64, String(c)); }
});
test('erst alle neuen Wörter, kaum Wiederholung: perfekter Spieler sieht in 64 Zügen ≥ 56 verschiedene, alle 64 nach ≤ 90', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const ws = W(64), st = {}, rnd = lcg(seed), recent = [], seen = new Set(); let t = T0, all = 0;
    for (let i = 1; i <= 200 && !all; i++) { const w = V.pickNext(ws, st, { rnd, recent, now: t }); recent.push(V.wkey(w)); seen.add(V.wkey(w)); V.record(st, w, true, t += 5000);
      if (i === 64) assert.ok(seen.size >= 56, 'nach 64: ' + seen.size); if (seen.size === 64) all = i; }
    assert.ok(all && all <= 90, 'alle nach ' + all);
  }
});
test('keine Bevorzugung der ersten Zeilen (neue Wörter gleichverteilt)', () => {
  const ws = W(64); let sum = 0; const rnd = lcg(7); for (let i = 0; i < 4000; i++) sum += +V.pickNext(ws, {}, { rnd }).en.slice(1);
  assert.ok(Math.abs(sum / 4000 - 31.5) < 2, 'Mittel ' + sum / 4000);
});
test('Problemwörter und fällige bevorzugt, gelernte trotzdem ab und zu', () => {
  const ws = W(64), st = {}, t = T0;
  ws.forEach((w, i) => { V.record(st, w, true, t - 10 * D); if (i >= 54) V.record(st, w, true, t - 10 * D + 1); });   // alle gesehen
  ws.slice(0, 10).forEach(w => V.record(st, w, false, t - 60e3));                                                     // 10 Problemwörter
  ws.slice(10, 20).forEach(w => { st[V.wkey(w)].due = t - 2 * D; });                                                  // 10 fällig
  ws.slice(20).forEach(w => { st[V.wkey(w)].due = t + 5 * D; });                                                      // 44 gelernt, nicht fällig
  const rnd = lcg(3), n = { prob: 0, due: 0, rest: 0 }; for (let i = 0; i < 4000; i++) n[V.potOf(st[V.wkey(V.pickNext(ws, st, { rnd, now: t }))], t)]++;
  assert.ok(n.prob / 4000 > 0.5, JSON.stringify(n)); assert.ok(n.due > n.rest, JSON.stringify(n)); assert.ok(n.rest / 4000 > 0.05, JSON.stringify(n));
  // je Wort: Problemwort ≫ fällig ≫ gelernt
  assert.ok(n.prob / 10 > n.due / 10 && n.due / 10 > 3 * n.rest / 44, JSON.stringify(n));
});
test('kleine Listen, Duplikate, alles ausgeschlossen', () => {
  const ws = [{ en: 'a', de: 'x' }, { en: 'b', de: 'y' }]; const rnd = lcg(1);
  assert.ok(V.pickNext(ws, {}, { rnd, exclude: new Set(ws.map(V.wkey)) }));                       // nie null
  assert.equal(V.pickNext(ws, {}, { rnd, exclude: new Set([V.wkey(ws[0])]) }).en, 'b');
  assert.equal(V.pickNext([], {}), null); assert.equal(V.pickNext([ws[0], ws[0]], {}, { rnd }).en, 'a');
  const dup = [...W(3), ...W(3), ...W(3)], seen = new Set(), rec = []; for (let i = 0; i < 3; i++) { const w = V.pickNext(dup, {}, { rnd, recent: rec }); rec.push(V.wkey(w)); seen.add(w.en); }
  assert.ok(seen.size >= 2, 'Duplikate zählen nicht mehrfach: ' + [...seen]);
});
