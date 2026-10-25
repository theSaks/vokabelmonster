import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const V = createRequire(import.meta.url)('../logic.js');
const R = Array.from({ length: 10 }, (_, i) => ({ id: 'r' + (i + 1), rank: i + 1 }));
const D = (d, h = 15) => new Date(2026, 9, d, h).getTime();
test('1.19 Schwellen: sichere Wörter UND Lerntage', () => {
  assert.deepEqual(V.REW_MASTER, [2, 6, 12, 20, 30, 42, 56, 72, 90, 110]); assert.deepEqual(V.REW_DAYS, [1, 2, 4, 6, 9, 12, 15, 19, 23, 28]); assert.equal(V.LEARN_DAY_MIN, 10);
  const p = { kept: [], mastered: 1, ldays: 5 }; assert.equal(V.grantReward(p, R, D(1)), null);                 // zu wenig sichere Wörter
  const q = { kept: [], mastered: 50, ldays: 0 }; assert.equal(V.grantReward(q, R, D(1)), null);               // kein Lerntag
  const r = { kept: [], mastered: 2, ldays: 1 }; assert.equal(V.grantReward(r, R, D(1)).id, 'r1'); assert.deepEqual(r.kept, ['r1']);
});
test('1.19 höchstens 1 Belohnung pro Kalendertag', () => {
  const p = { kept: [], mastered: 200, ldays: 40 };
  assert.equal(V.grantReward(p, R, D(1, 9)).id, 'r1'); assert.equal(V.grantReward(p, R, D(1, 20)), null);     // gleicher Tag: nichts mehr
  assert.equal(V.grantReward(p, R, D(2, 9)).id, 'r2'); assert.equal(V.grantReward(p, R, D(2, 23)), null);
  for (let d = 3; d < 20; d++) V.grantReward(p, R, D(d)); assert.equal(p.kept.length, 10); assert.equal(V.grantReward(p, R, D(30)), null);
  const g = V.rewardGap({ kept: ['r1'], mastered: 3, ldays: 1, lastRew: V.dayKey(D(5)) }, R, D(5)); assert.deepEqual({ id: g.r.id, m: g.m, d: g.d, today: g.today }, { id: 'r2', m: 3, d: 1, today: true });
});
test('1.19 Lerntag = 10 Wörter beim 1. Versuch richtig an einem Kalendertag, zählt 1× pro Tag', () => {
  const p = {}; for (let i = 0; i < 9; i++) assert.equal(V.noteFirstTry(p, D(1, 10)), false); assert.equal(p.ldays || 0, 0);
  assert.equal(V.noteFirstTry(p, D(1, 11)), true); assert.equal(p.ldays, 1);
  for (let i = 0; i < 30; i++) V.noteFirstTry(p, D(1, 12)); assert.equal(p.ldays, 1);                          // gleicher Tag: bleibt 1
  for (let i = 0; i < 9; i++) V.noteFirstTry(p, D(2, 23)); for (let i = 0; i < 5; i++) V.noteFirstTry(p, D(3, 8)); assert.equal(p.ldays, 1);   // nicht über Mitternacht addieren
  for (let i = 0; i < 5; i++) V.noteFirstTry(p, D(3, 9)); assert.equal(p.ldays, 2);
});
test('1.19 sicheres Wort zählt nur einmal', () => {
  const p = {}, st = {}; assert.equal(V.noteMastered(p, st), true); assert.equal(V.noteMastered(p, st), false); assert.equal(p.mastered, 1);
});
test('1.19 Migration: Freigeschaltetes bleibt, Zähler passen zum Stand, nur einmal', () => {
  const stats = { a: { streak: 3, prob: false }, b: { streak: 5 }, c: { streak: 1 }, d: { streak: 4, prob: true } };
  const p = { solved: 12, kept: ['r1'], v19: true };
  assert.equal(V.migrateRewards119(p, stats, ['r1', 'r2', 'r3', 'r4']), true);
  assert.deepEqual(p.kept, ['r1', 'r2', 'r3', 'r4']); assert.equal(p.mastered, 2); assert.equal(p.ldays, 6); assert.equal(p.solved, 12);   // alter Zähler bleibt für die Statistik
  assert.ok(stats.a.mEver && stats.b.mEver && !stats.c.mEver && !stats.d.mEver);
  assert.equal(V.migrateRewards119(p, stats, ['r9']), false); assert.ok(!p.kept.includes('r9'));
  assert.equal(V.grantReward(p, R, D(1)), null);                                                               // r5 braucht 30 sichere Wörter + 9 Lerntage
  const fresh = {}; V.migrateRewards119(fresh, {}, []); assert.deepEqual({ k: fresh.kept, m: fresh.mastered, d: fresh.ldays }, { k: [], m: 0, d: 0 });
});
test('1.19 „Belohnungen zurücksetzen“ setzt alles zurück, alte sichere Wörter zählen nicht doppelt', () => {
  const p = { pops: 9, solved: 30, kept: ['r1', 'r2'], v19: true, v119: true, mastered: 20, ldays: 7, lastRew: 'x', dayKey: 'y', dayOk: 4 };
  V.resetRewards(p); assert.deepEqual(p.kept, []); assert.equal(p.mastered, 0); assert.equal(p.ldays, 0); assert.equal(p.lastRew, null); assert.equal(p.pops, 9);
  assert.equal(V.migrateRewards119(p, {}, ['r1']), false);                                                     // keine erneute Migration nach Reset
  const st = { mEver: true }; assert.equal(V.noteMastered(p, st), false);
});
