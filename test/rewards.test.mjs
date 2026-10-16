import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const V = createRequire(import.meta.url)('../logic.js');
test('Schwellen dreieckig 1,3,6,10,…', () => {
  assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(V.rewardNeed), [1,3,6,10,15,21,28,36,45,55]);
  assert.equal(V.rewardsEarned(0), 0); assert.equal(V.rewardsEarned(1), 1); assert.equal(V.rewardsEarned(2), 1); assert.equal(V.rewardsEarned(3), 2); assert.equal(V.rewardsEarned(55), 10);
});
test('Nur vorher falsche Wörter zählen, je Lösung einmal', () => {
  const st = {}, w = { en: 'dog', de: 'Hund' };
  assert.equal(V.record(st, w, true).solved, false);          // nie falsch → kein Problemwort
  V.record(st, w, false); V.record(st, w, false);              // 2× falsch = ein Problemwort
  assert.equal(V.record(st, w, true).solved, true);
  assert.equal(V.record(st, w, true).solved, false);           // nicht doppelt
  V.record(st, w, false); assert.equal(V.record(st, w, true).solved, true); // erneut Problem → erneut lösbar
  assert.equal(st[V.wkey(w)].solves, 2);
});
test('Migration alter Stände', () => {
  const st = { a: { wrong: 2, streak: 0 }, b: { wrong: 1, streak: 3 }, c: { wrong: 0, streak: 0 } };
  assert.equal(V.migrateProblems(st), 1); assert.equal(st.a.prob, true); assert.equal(st.b.prob, false); assert.equal(st.c.prob, false);
  assert.equal(V.migrateProblems(st), 0);
});
