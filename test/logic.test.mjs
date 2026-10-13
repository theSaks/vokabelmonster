import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); const V = req('../logic.js'); import fs from 'node:fs'; const FILE = fs.readFileSync(new URL('../vokabeln.txt', import.meta.url), 'utf8');
test('Matching tolerant', () => {
  assert.ok(V.isMatch('  DOG ', 'dog')); assert.ok(V.isMatch('go', 'to go')); assert.ok(V.isMatch('to go', 'go'));
  assert.ok(V.isMatch('eraser', 'rubber/eraser')); assert.ok(V.isMatch('rubber', 'rubber; eraser'));
  assert.ok(V.isMatch('schueler', 'Schüler')); assert.ok(V.isMatch('Schüler', 'Schüler/Schülerin'));
  assert.ok(V.isMatch("whats your name", "What's your name?")); assert.ok(V.isMatch('What’s your name?', "What's your name?"));
  assert.ok(V.isMatch('cinema', '(the) cinema')); assert.ok(V.isMatch('the cinema', '(the) cinema'));
  assert.ok(!V.isMatch('', 'dog')); assert.ok(!V.isMatch('dogs', 'dog')); assert.ok(!V.isMatch('cat', 'dog'));
});
test('Verteiltes Wiederholen: 3× heute ist nicht „sicher“, Intervalle 1/3/7/14 Tage', () => {
  const D = 864e5, st = {}, w = { en: 'dog', de: 'Hund' }; let t = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 3; i++) V.record(st, w, true, t + i * 1000);
  let s = st[V.wkey(w)]; assert.equal(s.box, 1); assert.ok(!V.isMastered(s)); assert.equal(s.due, t + D);
  assert.ok(!V.isDue(s, t + D / 2)); assert.ok(V.isDue(s, t + D));
  V.record(st, w, true, t + D); assert.equal(s.box, 2); assert.equal(s.due, t + D + 3 * D);
  V.record(st, w, true, t + 4 * D); assert.equal(s.box, 3); assert.ok(V.isMastered(s)); assert.equal(s.due, t + 11 * D);
  V.record(st, w, false, t + 12 * D); assert.equal(s.box, 0); assert.ok(!V.isMastered(s));
  assert.ok(V.weight(s, t + 12 * D) > V.weight({ ...s, box: 1, due: t + 20 * D }, t + 12 * D));
});
test('Liste parsen', () => {
  const r = V.parseList('\uFEFFenglish;deutsch\n# Kommentar\ndog;Hund\nto go = gehen\ncat\tKatze\n"red","rot"\nkaputt\n\n');
  assert.deepEqual(r.words.map(w => w.en), ['dog', 'to go', 'cat', 'red']); assert.equal(r.words[1].de, 'gehen'); assert.equal(r.words[3].de, 'rot'); assert.deepEqual(r.errors, [7]);
});
test('vokabeln.txt valide + verlustfrei', () => { const m = V.parseFile(FILE); assert.equal(m.errors.length, 0); assert.ok(m.lists.length >= 1);
  for (const l of m.lists) assert.ok(V.listWords(l).length >= 3, l.name);
  assert.equal(V.serializeFile(m), FILE); });
test('Datei: Listen, Kommentare, Bearbeiten', () => {
  const m = V.parseFile('# Kopf\ndog;Hund\n## Unit 1\n# Kommentar\ncat = Katze\nkaputt\n## Leer\n');
  assert.deepEqual(m.lists.map(l => l.name), ['Meine Vokabeln', 'Unit 1', 'Leer']); assert.deepEqual(m.errors, [6]);
  m.lists[1].items.push({ en: 'to go', de: 'gehen' }, { en: '', de: '' }); m.lists[0].items[0].de = 'Hund;Köter';
  const out = V.serializeFile(m); assert.match(out, /^# Kopf\n/); assert.match(out, /dog;Hund Köter/); assert.match(out, /## Unit 1\n# Kommentar\ncat;Katze\nkaputt\nto go;gehen\n/);
  assert.equal(V.parseFile(out).lists[1].items.filter(x => x.en).length, 2); });
test('Fallzeit nach Wortlänge', () => { assert.ok(V.travelFor('responsibility', 1, 'normal') > 2 * V.travelFor('cat', 1, 'normal'));
  assert.ok(V.travelFor('cat', 5, 'normal') < V.travelFor('cat', 1, 'normal')); assert.ok(V.travelFor('cat', 1, 'schnell') < V.travelFor('cat', 1, 'langsam'));
  assert.equal(V.lengthFactor('rubber/eraser'), V.lengthFactor('rubber')); });
test('Diff für Korrektur', () => { assert.equal(V.bestVariant('erazer', 'rubber/eraser'), 'eraser');
  assert.deepEqual(V.diffChars('erazer', 'eraser').map(c => c.ok), [true, true, true, false, true, true]); assert.equal(V.bestVariant('', '(the) cinema'), 'cinema'); });
test('Fehlerwörter kommen öfter', () => {
  const words = [{ en: 'a', de: 'x' }, { en: 'b', de: 'y' }]; const stats = {};
  for (let i = 0; i < 5; i++) { V.record(stats, words[0], true); } V.record(stats, words[1], false);
  let n = 0; let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) if (V.pick(words, stats, rnd).en === 'b') n++;
  assert.ok(n > 1600, 'b gewählt ' + n);
  assert.equal(V.pick(words, stats, rnd, new Set([V.wkey(words[1])])).en, 'a');
});
test('Level & Punkte', () => {
  assert.ok(V.levelParams(5).travel < V.levelParams(1).travel); assert.ok(V.levelParams(3).boss); assert.ok(!V.levelParams(2).boss);
  assert.ok(V.levelParams(40).travel >= 6); assert.equal(V.points(0, false), 10); assert.equal(V.points(3, false), 20); assert.equal(V.points(0, true), 50);
});

// ---- 1.7: Sprachpaare + Pinyin ----
test('1.7 Sprachpaar im Listenkopf, verlustfrei', () => {
  const t = '## Alt\ndog;Hund\n\n## China [zh-de]\n你好|nǐ hǎo;hallo\n书;Buch\n\n## Spanisch [es-en]\nel niño;the boy\n';
  const m = V.parseFile(t); assert.deepEqual(m.lists.map(l => V.langsOf(l).join('-')), ['en-de', 'zh-de', 'es-en']);
  assert.equal(m.lists[1].name, 'China'); assert.equal(V.serializeFile(m), t);
  assert.deepEqual(V.listWords(m.lists[1])[0], { en: '你好|nǐ hǎo', de: 'hallo', la: 'zh', lb: 'de' }); });
test('1.7 Pinyin: mit/ohne Töne, mit/ohne Leerzeichen, oder Hanzi', () => {
  const a = '你好|nǐ hǎo'; for (const x of ['你好', 'nǐ hǎo', 'ni hao', 'nihao', 'NI HAO']) assert.ok(V.isMatch(x, a), x);
  assert.ok(!V.isMatch('ni', a)); assert.ok(!V.isMatch('ni hau', a)); assert.ok(V.isMatch('lü', '绿|lǜ')); assert.ok(V.isMatch('lu', '绿|lǜ'));
  assert.equal(V.display(a), '你好 (nǐ hǎo)'); assert.equal(V.bestVariant('ni hai', a), 'nǐ hǎo'); assert.equal(V.bestVariant('你', a), '你好');
  assert.ok(V.hasPinyin(a)); assert.ok(!V.hasPinyin('书')); });
test('1.7 strenge Prüfung sonst unverändert (Akzente zählen)', () => { assert.ok(!V.isMatch('el nino', 'el niño')); assert.ok(V.isMatch('el niño', 'el niño')); assert.ok(V.isMatch('Hund', 'Hund')); });
