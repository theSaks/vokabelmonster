// 1.16 LRS-Hilfen: Silben, Runterstufen, LRS-Modus-Vorgaben, Schrift-Schalter (CSS-Klassen), Migration von 1.15
import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const req = createRequire(import.meta.url); const V = req('../logic.js'), L = req('../lrs.js'), H = req('../hyph/hyphen.js');
L.useHyphenators({ 'en-us': H(req('../hyph/en-us.js')), 'de-1996': H(req('../hyph/de-1996.js')) });
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8'), html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Silben Englisch (Red-Line-1-Wörter)', () => {
  const exp = { umbrella: 'um·brel·la', seventeen: 'sev·en·teen', animal: 'an·i·mal', family: 'fam·i·ly', yellow: 'yel·low', computer: 'com·put·er',
    fourteen: 'four·teen', sister: 'sis·ter', pencil: 'pen·cil', 'See you later': 'See you lat·er', music: 'mu·sic', hello: 'hel·lo', twenty: 'twen·ty' };
  for (const [w, s] of Object.entries(exp)) assert.equal(L.sylString(w, 'en'), s, w);
  assert.equal(L.sylString('red', 'en'), 'red'); assert.equal(L.sylString("What's your name?", 'en'), "What's your name?");
});
test('Silben Deutsch', () => {
  const exp = { Farbenmischung: 'Far·ben·mi·schung', Radiergummi: 'Ra·dier·gum·mi', Schwester: 'Schwes·ter', 'auf Wiedersehen': 'auf Wie·der·se·hen', zwanzig: 'zwan·zig', Familie: 'Fa·mi·lie', Tschüss: 'Tschüss', achtzehn: 'acht·zehn' };
  for (const [w, s] of Object.entries(exp)) assert.equal(L.sylString(w, 'de'), s, w);
});
test('Silben: unbekannte Sprache → keine Markierung; Index-Karte für Kachel-Slots', () => {
  assert.equal(L.syllables('ni hao', 'zh'), null); assert.equal(L.syllables('hola', 'es'), null); assert.ok(!L.sylSupported('fr')); assert.ok(L.sylSupported('en') && L.sylSupported('de'));
  assert.deepEqual(L.sylIndexMap('my umbrella', 'en'), [0, 0, -1, 1, 1, 2, 2, 2, 2, 3, 3]);
});
test('Runterstufen-Regel: ≥2 Fehler und Serie < 2 → leichtere Eingabe; nach 2 richtigen wieder oben; 3 = sicher', () => {
  const st = {}, w = { en: 'umbrella', de: 'Regenschirm' }, k = V.wkey(w); let t = Date.UTC(2026, 9, 20);
  V.record(st, w, false, t++); assert.ok(!L.isDown(st[k]), '1 Fehler: noch nicht'); assert.equal(L.modeFor(st[k], 'tippen', true), 'tippen');
  V.record(st, w, false, t++); assert.ok(L.isDown(st[k])); assert.equal(L.modeFor(st[k], 'tippen', true), 'kacheln'); assert.equal(L.modeFor(st[k], 'kacheln', true), 'mc'); assert.equal(L.modeFor(st[k], 'mc', true), 'mc');
  assert.equal(L.modeFor(st[k], 'tippen', false), 'tippen', 'Schalter aus');
  V.record(st, w, true, t++); assert.ok(L.isDown(st[k]), '1 richtig: bleibt unten');
  V.record(st, w, true, t++); assert.ok(!L.isDown(st[k]), '2 richtig: wieder oben'); assert.ok(!V.isMastered(st[k]));
  V.record(st, w, true, t++); assert.ok(V.isMastered(st[k]), '3. richtig (normale Eingabe) → sicher, MASTER_STREAK unverändert'); assert.equal(V.MASTER_STREAK, 3);
  V.record(st, w, false, t++); assert.ok(L.isDown(st[k]), 'neuer Fehler → sofort wieder runter');
  assert.ok(!L.isDown(undefined) && !L.isDown({ wrong: 5, streak: 2 }));
});
test('LRS-Modus setzt Vorgaben aus 1–3 und stellt beim Ausschalten zurück', () => {
  const s = L.mergeSettings({ input: 'tippen', speed: 'normal', speech: true, say: true }, {});
  assert.equal(s.font, 'aus'); assert.equal(s.syl, false); assert.equal(s.sayFirst, false); assert.equal(s.hearOnly, false); assert.equal(s.autoDown, true); assert.equal(s.lrs, false);
  L.setLrs(s, true); assert.deepEqual([s.font, s.syl, s.sayFirst, s.input, s.speed, s.autoDown, s.speech], ['lexend', true, true, 'kacheln', 'sehrlangsam', true, true]); assert.equal(s.hearOnly, false);
  L.setLrs(s, false); assert.deepEqual([s.font, s.syl, s.sayFirst, s.input, s.speed, s.lrs], ['aus', false, false, 'tippen', 'normal', false]); assert.equal(s.lrsPrev, undefined);
  const o = L.setLrs(L.mergeSettings({ speed: 'ohne', input: 'mc' }, {}), true); assert.equal(o.speed, 'ohne', 'ohne Zeitlimit bleibt');
});
test('Schrift-Schalter: CSS-Klassen + Schriften + Lizenzen vorhanden', () => {
  assert.deepEqual(L.bodyClasses(L.mergeSettings({}, {})), []);
  assert.deepEqual(L.bodyClasses({ font: 'lexend', syl: true }), ['lrs-font', 'font-lexend', 'syl-on']); assert.deepEqual(L.bodyClasses({ font: 'opendyslexic' }), ['lrs-font', 'font-od']);
  for (const sel of ['body.lrs-font .mon .tag', 'body.lrs-font .fixa', 'body.font-od', '.syl.s0', '.syl.s1', '.fixyou .bad.wl::after', 'letter-spacing:.12em', 'word-spacing:.35em', 'font-family:"Lexend"', 'font-family:"OpenDyslexic"']) assert.ok(css.includes(sel), sel);
  for (const f of ['Lexend-VF.ttf', 'OFL-Lexend.txt', 'OpenDyslexic-Regular.woff2', 'OFL-OpenDyslexic.txt']) assert.ok(fs.existsSync(new URL('../fonts/' + f, import.meta.url)), f);
  assert.ok(fs.existsSync(new URL('../hyph/LICENSES.txt', import.meta.url)));
  for (const id of ['lrsChk', 'fontSel', 'sylChk', 'sayFirstChk', 'hearOnlyChk', 'autoDownChk', 'sayAgain', 'fixHow']) assert.ok(html.includes(`id="${id}"`), id);
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'); for (const f of ['lrs.js', 'hyph/en-us.js', 'hyph/de-1996.js', 'fonts/Lexend-VF.ttf']) assert.ok(sw.includes(f), 'offline: ' + f);
});
test('Migration: Spielstand aus 1.15 bleibt gültig', () => {
  const D = 864e5, now = Date.UTC(2026, 9, 20, 12);
  const set115 = { dir: 'de-en', speed: 'langsam', input: 'tippen', say: true, sayPop: true, speech: true, skin: 'skin-green', laser: 'blue', lives: 8, kb: true, snd: false, list: 'L:Unit 1', ui: 'de', v13: true };
  const stats115 = { 'dog|hund': { en: 'dog', de: 'Hund', right: 4, wrong: 1, streak: 3, box: 2, due: now + D, last: now - D, prob: false, solves: 1, la: 'en', lb: 'de' },
    'cat|katze': { en: 'cat', de: 'Katze', right: 1, wrong: 3, streak: 0, box: 0, due: now - D, last: now - 2 * D, prob: true, miss: 2 },
    'red|rot': { en: 'red', de: 'rot', right: 2, wrong: 0, streak: 2 } };
  const s = L.mergeSettings({ dir: 'en-de', speed: 'sehrlangsam', input: 'kacheln', lives: 5, skin: 'hero' }, JSON.parse(JSON.stringify(set115)));
  for (const k of Object.keys(set115)) assert.deepEqual(s[k], set115[k], 'Einstellung ' + k + ' bleibt');
  assert.equal(s.font, 'aus'); assert.equal(s.lrs, false);
  const st = JSON.parse(JSON.stringify(stats115));
  assert.ok(V.isMastered(st['dog|hund'])); assert.ok(!L.isDown(st['dog|hund'])); assert.ok(L.isDown(st['cat|katze'])); assert.ok(!L.isDown(st['red|rot']));
  assert.equal(V.potOf(st['cat|katze'], now), 'prob');
  assert.deepEqual(st, stats115, 'Statistik durch 1.16-Logik unverändert (kein neues Pflichtfeld, keine Migration)');
  assert.deepEqual(L.lastWrong(st).map(x => x.en), ['cat'], 'Problemwort-Runde nutzt alte Stände (ohne lw) über last');
  const ov = L.overview(st, Object.keys(st), { isDue: V.isDue, isMastered: V.isMastered, isProb: x => V.potOf(x, now) === 'prob' }, now);
  assert.deepEqual([ov.prob, ov.safe, ov.week, ov.total], [1, 1, 0, 3]);
});
test('Archiv bei „Neues Schuljahr“ hält höchstens 3 Stände', () => {
  const store = { stats: { a: 1 }, prog: { solved: 2 }, times: null }; const e = L.archiveEntry(k => store[k] ?? null, ['stats', 'prog', 'times'], 5);
  assert.deepEqual(e, { t: 5, data: { stats: { a: 1 }, prog: { solved: 2 } } });
  let arr = []; for (let i = 0; i < 5; i++) arr = L.pushArchive(arr, { t: i }); assert.deepEqual(arr.map(x => x.t), [2, 3, 4]);
  assert.ok(!V.resetKeys(true).includes('archive'));
});
test('„sicher geworden“-Zeitpunkt nur beim Übergang', () => { const st = {}; L.noteMastery(st, false, true, 7); assert.equal(st.mAt, 7); L.noteMastery(st, true, true, 9); assert.equal(st.mAt, 7); });
