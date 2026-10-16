import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const V = createRequire(import.meta.url)('../logic.js');
test('CRIT: erster Versuch nie, Toleranz max(10 %, 300 ms), je Eingabeart getrennt', () => {
  const t = {}, k = 'dog|hund';
  const no = () => 0.99; // Zufall aus: kein Glückstreffer
  assert.equal(V.recordTime(t, k, 'tippen', 5000, () => 0).crit, false);   // erster Versuch: nie, auch nicht mit Glück
  assert.equal(V.recordTime(t, k, 'tippen', 4600, no).crit, false);   // nur 8 % schneller
  assert.equal(V.recordTime(t, k, 'tippen', 4100).crit, true);    // 500 ms = 10.9 % schneller
  assert.equal(t[k + '#tippen'].last, 4100); assert.equal(t[k + '#tippen'].best, 4100); assert.equal(t[k + '#tippen'].n, 3);
  assert.equal(V.recordTime(t, k, 'tippen', 6000).crit, false); assert.equal(t[k + '#tippen'].best, 4100);
  assert.equal(V.recordTime(t, k, 'kacheln', 1000).crit, false);  // andere Eingabeart: eigener erster Versuch
  assert.equal(V.recordTime(t, k, 'kacheln', 800, no).crit, false);   // 20 %, aber nur 200 ms < 300 ms
  assert.equal(V.recordTime(t, k, 'kacheln', 450).crit, true);    // 350 ms schneller
  assert.equal(V.recordTime(t, k, 'tippen', 6000 - 600).crit, true); // vs. letzter Zeit (6000), nicht Bestzeit
});
test('CRIT-Punkte +50 %', () => { assert.equal(V.critPoints(10), 15); assert.equal(V.critPoints(25), 38); });
test('Reset: Vokabeln/Einstellungen bleiben, Highscores nur optional', () => {
  const a = V.resetKeys(false), b = V.resetKeys(true);
  for (const k of ['prog', 'stats', 'unlocked', 'times']) { assert.ok(a.includes(k)); assert.ok(b.includes(k)); }
  for (const k of ['hs2', 'hs', 'highscore']) { assert.ok(!a.includes(k)); assert.ok(b.includes(k)); }
  for (const k of ['settings', 'vocab', 'lists', 'lastName']) assert.ok(!b.includes(k));
});
test('Glückstreffer am Tempo-Limit: nahe Bestzeit + Zufall < 18 %', () => {
  const t = {}, k = 'cat|katze';
  V.recordTime(t, k, 'mc', 2000, () => 0); V.recordTime(t, k, 'mc', 1000, () => 0.99);          // Bestzeit 1000 (Verbesserungs-Krit)
  let r = V.recordTime(t, k, 'mc', 1050, () => 0.17); assert.equal(r.crit, true); assert.equal(r.lucky, true);   // 5 % über Bestzeit, Zufall 0,17
  r = V.recordTime(t, k, 'mc', 1050, () => 0.18); assert.equal(r.crit, false); assert.equal(r.near, true);      // Zufall 0,18 → nein
  r = V.recordTime(t, k, 'mc', 1101, () => 0); assert.equal(r.crit, false); assert.equal(r.near, false);         // > 10 % über Bestzeit → nie
  r = V.recordTime(t, k, 'mc', 1100, () => 0); assert.equal(r.lucky, true);                                     // genau +10 % zählt noch
  r = V.recordTime(t, k, 'mc', 700, () => 0.99); assert.equal(r.crit, true); assert.equal(r.lucky, false);      // Verbesserung hat Vorrang
  assert.equal(V.LUCKY_P, 0.18); assert.equal(V.LUCKY_NEAR, 0.1);
  let n = 0, x = 1; const lcg = () => (x = (x * 48271) % 2147483647) / 2147483647; const t2 = { 'a#tippen': { last: 1000, best: 1000, n: 5 } };
  for (let i = 0; i < 5000; i++) { t2['a#tippen'].last = 1000; if (V.recordTime(t2, 'a', 'tippen', 1000, lcg).lucky) n++; }
  assert.ok(n > 800 && n < 1000, String(n));                                                                     // ≈ 18 %
});
test('Nur Belohnungen zurücksetzen', () => {
  const p = { pops: 50, wins: 2, solved: 30, kept: ['gold'], v19: true };
  V.resetRewards(p); assert.deepEqual(p, { pops: 50, wins: 2, solved: 0, kept: [], v19: true });
});
