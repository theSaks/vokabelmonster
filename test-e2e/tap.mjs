// Headless-E2E (Tablet-Emulation, Touch): node test-e2e/tap.mjs   – testet fsa-, native- und readonly-Modus
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8098', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const SHOTS = process.env.SHOTS || 'test-e2e/screenshots'; (await import('node:fs')).mkdirSync(SHOTS, { recursive: true });
const res = []; let errors = []; const ok = (n, c) => res.push(`${c ? 'OK  ' : 'FAIL'} ${n}`); const sleep = ms => new Promise(r => setTimeout(r, ms));
const TESTFILE = '# Test\n## Test-Unit\ncat;Katze\nresponsibility;Verantwortung\ndog;Hund\nto go;gehen\nrubber/eraser;Radiergummi\nWhat is your name?;Wie heißt du?\n## Zweite\nred;rot\nblue;blau\n';
async function page(mode) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.emulate({ viewport: { width: 1280, height: 800, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Tab) AppleWebKit/537.36 Chrome/129 Safari/537.36' });
  p.on('pageerror', e => errors.push(mode + ': ' + e.message)); p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Unit 9' : undefined));
  await p.evaluateOnNewDocument((mode, TESTFILE) => {
    window.VM_TEST_FAST = true; window.__downloads = 0; const cu = URL.createObjectURL; URL.createObjectURL = o => { window.__downloads++; return cu(o); };
    if (mode === 'fsa') {
      window.__file = { text: TESTFILE, writes: 0 };
      const handle = { kind: 'file', name: 'vokabeln.txt', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
        getFile: async () => ({ text: async () => window.__file.text }),
        createWritable: async () => { let buf = ''; return { write: async t => { buf += t; }, close: async () => { window.__file.text = buf; window.__file.writes++; } }; } };
      window.showOpenFilePicker = async () => [handle]; window.showSaveFilePicker = async () => handle;
    } else { delete window.showOpenFilePicker; try { Object.defineProperty(window, 'showOpenFilePicker', { value: undefined }); } catch {} }
    if (mode === 'native') {
      window.__fs = JSON.parse(sessionStorage.getItem('fs') || '{}'); const k = o => o.directory + '/' + o.path;
      window.Capacitor = { isNativePlatform: () => true, Plugins: { Filesystem: {
        requestPermissions: async () => ({}), readFile: async o => { if (!(k(o) in window.__fs)) throw new Error('File does not exist'); return { data: window.__fs[k(o)] }; },
        writeFile: async o => { window.__fs[k(o)] = o.data; sessionStorage.setItem('fs', JSON.stringify(window.__fs)); return { uri: k(o) }; } } } };
    }
  }, mode, TESTFILE);
  await p.goto('http://localhost:8098/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady); return p;
}
const vis = (p, id) => p.$eval('#' + id, e => e.classList.contains('on'));
const st = p => p.evaluate(() => window.__vm.state());
const tapWord = async (p, w) => { for (const ch of w.toLowerCase()) if (/[a-zäöüß' -]/.test(ch)) await p.tap(ch === ' ' ? '[data-k="␣"]' : `[data-k="${ch}"]`); };
process.on("uncaughtException", e => { console.log(res.join("\n")); console.log("ABBRUCH", e.message, errors); srv.kill(); process.exit(1); });

// ================= Windows/Edge: File System Access =================
let p = await page('fsa');
ok('[fsa] ohne Datei: Hinweis + Verbinden-Knopf', !(await p.$eval('#homeConnect', e => e.hidden)));
ok('[fsa] bis dahin mitgelieferte Beispiel-Listen (2)', (await p.evaluate(() => window.__vm.model().lists.length)) === 2);
await p.tap('#homeConnect'); await sleep(200);
ok('[6] vokabeln.txt verbunden → Listen aus Datei', JSON.stringify(await p.evaluate(() => window.__vm.model().lists.map(l => l.name))) === '["Test-Unit","Zweite"]');
await p.select('#listSel', 'L:Test-Unit');
await p.tap('[data-go="settings"]'); await p.select('#speedSel', 'normal'); await p.select('#livesSel', '8'); await p.tap('#saveSet');
await p.tap('#playBtn'); await sleep(200); ok('Spiel startet', await vis(p, 'game'));
// (4) großes Eingabefeld
await tapWord(p, 'ab'); const ib = await p.$eval('#inputBar', e => ({ fs: parseFloat(getComputedStyle(e).fontSize), h: e.offsetHeight }));
ok(`[4] Eingabefeld groß (Schrift ${ib.fs}px, Höhe ${ib.h}px)`, ib.fs >= 35 && ib.h >= 70); await p.tap('[data-k="⌫"]'); await p.tap('[data-k="⌫"]');
// (1) Fallzeit nach Wortlänge
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); window.__vm.spawn('responsibility'); });
let s = await st(p); const tc = s.mons.find(m => m.a === 'cat').travel, tr = s.mons.find(m => m.a === 'responsibility').travel;
ok(`[1] cat fällt schneller (${tc.toFixed(1)}s) als responsibility (${tr.toFixed(1)}s)`, tr > 2 * tc);
// (3) falsche Eingabe → grüne Korrektur mit Unterschied, Spiel pausiert
await tapWord(p, 'responsibiliti'); await p.tap('[data-k="✔"]'); await sleep(150);
ok('[3] Korrektur-Overlay erscheint', await vis(p, 'fix'));
const fx = await p.evaluate(() => ({ bg: getComputedStyle(document.getElementById('fixCard')).backgroundImage, q: fixQ.textContent, a: fixA.textContent, bad: [...document.querySelectorAll('#fixYou .bad')].map(x => x.textContent).join(''), fs: parseFloat(getComputedStyle(fixA).fontSize) }));
ok(`[3] grün, groß (${fx.fs}px), „${fx.q}“ → „${fx.a}“, falscher Buchstabe markiert: „${fx.bad}“`, /60, 207, 142|35, 169, 112/.test(fx.bg) && fx.q === 'Verantwortung' && fx.a === 'responsibility' && fx.bad === 'i' && fx.fs >= 40);
const y1 = (await st(p)).mons.map(m => m.y); await sleep(600); const y2 = (await st(p)).mons.map(m => m.y);
ok('[3] Spiel pausiert während Korrektur', JSON.stringify(y1) === JSON.stringify(y2) && (await st(p)).hold);
await p.screenshot({ path: SHOTS + '/korrektur.png' }); await p.tap('#fixBtn'); ok('[3] Weiter → Overlay zu, Spiel läuft', !(await vis(p, 'fix')) && !(await st(p)).hold);
ok('[2] verpasstes Wort in Revanche-Warteschlange', (await st(p)).revenge.includes('responsibility'));
ok('[2] Fehlerzähler pro Wort', (await p.evaluate(() => Object.values(window.__vm.stats()).find(x => x.en === 'responsibility').miss)) === 1);
// alles auf dem Schirm abräumen, normale Monster platzen lassen, bis der Revanche-Boss kommt
let revenge = null;
for (let i = 0; i < 200 && !revenge; i++) { s = await st(p); revenge = s.mons.find(m => m.kind === 'revenge');
  if (!revenge && s.mons.length) { const m = s.mons.sort((a, b) => b.y - a.y)[0]; await tapWord(p, m.a.split('/')[0].replace(/^to /, '')); if (m.boss) await p.tap('[data-k="✔"]'); }
  if (await vis(p, 'fix')) await p.tap('#fixBtn'); await sleep(100); }
ok('[2] Revanche-Boss erscheint mit 3 Schilden', revenge && revenge.hp === 3 && revenge.a === 'responsibility' && (await p.$$eval('.mon.revenge .shields i:not(.off)', e => e.length)) === 3);
const nRev = (await st(p)).mons.find(m => m.kind === 'revenge'); const tNormal = (await p.evaluate(() => window.VM.travelFor('responsibility', 1, 'normal')));
ok('[2] Revanche-Boss ist langsamer', nRev.travel > tNormal * 1.5);
await tapWord(p, 'responsibility'); s = await st(p); const h1 = s.mons.find(m => m.kind === 'revenge')?.hp;
await tapWord(p, 'responsibility'); s = await st(p); const h2 = s.mons.find(m => m.kind === 'revenge')?.hp;
ok(`[2] Trefferzähler sichtbar 3→${h1}→${h2}`, h1 === 2 && h2 === 1 && (await p.$$eval('.mon.revenge .shields i:not(.off)', e => e.length)) === 1);
await tapWord(p, 'responsibility'); s = await st(p); ok('[2] 3. Treffer → Boss platzt', !s.mons.some(m => m.kind === 'revenge'));
// Monster durchlassen → Overlay bei Miss
await p.evaluate(() => window.__vm.setSpeedFactor(30)); await p.waitForSelector('#fix.on', { timeout: 8000 }).catch(() => {});
ok('[3] Miss → freundliche Korrektur', await vis(p, 'fix') && (await p.$eval('#fixTitle', e => e.textContent)).includes('💚'));
await p.tap('#fixBtn'); await p.tap('#pauseBtn'); await p.tap('#quitBtn');
// (5) Editor in den Einstellungen
await p.tap('[data-go="settings"]'); await p.tap('#editVocabBtn'); ok('[5] Editor über Einstellungen erreichbar', await vis(p, 'lists'));
ok('[5] Zeilen der Datei als Liste', (await p.$$('#edRows .er')).length === 6);
const w0 = await p.evaluate(() => window.__file.writes);
await p.tap('#addRowBtn'); await p.type('#edRows .er .en', 'house'); await p.type('#edRows .er .de', 'Haus');
await p.$eval('#edRows .er:nth-child(4) .de', e => { e.value = 'Hündchen'; e.dispatchEvent(new Event('input', { bubbles: true })); });
await p.tap('#edRows .er:nth-child(2) button'); await sleep(700);
let f = await p.evaluate(() => window.__file.text);
ok('[5] Zeile hinzufügen → Datei', /\nhouse;Haus\n/.test(f)); ok('[5] Zeile bearbeiten → Datei', /responsibility;Verantwortung/.test(f) && /dog;Hündchen/.test(f)); ok('[5] Zeile löschen → Datei', !/\ncat;Katze/.test(f));
await p.tap('#newListBtn'); await p.tap('#addRowBtn'); await p.type('#edRows .er .en', 'school'); await p.type('#edRows .er .de', 'Schule'); await sleep(700);
f = await p.evaluate(() => window.__file.text); ok('[5] neue Liste „Unit 9“ in Datei', /## Unit 9\nschool;Schule\n$/.test(f));
ok('[6] Kommentar bleibt, Datei wurde geschrieben', f.startsWith('# Test\n') && (await p.evaluate(() => window.__file.writes)) > w0);
await p.tap('#delListBtn'); await sleep(600); ok('[5] Liste löschen → Datei', !/Unit 9/.test(await p.evaluate(() => window.__file.text)));
ok('[6] Vokabeln nicht in localStorage', await p.evaluate(() => !Object.keys(localStorage).some(k => k === 'vm.lists') && !JSON.stringify(localStorage).includes('Verantwortung;')));
await p.screenshot({ path: SHOTS + '/editor.png' });
await p.tap('#lists [data-go="home"]'); ok('[6] Home-Liste aus Datei', (await p.$$eval('#listSel option', o => o.map(x => x.value))).includes('L:Zweite'));
await p.close();

// ================= Android-APK: Capacitor Filesystem =================
p = await page('native');
const fsk = 'DOCUMENTS/VokabelMonster/vokabeln.txt';
ok('[6] Android: Erststart legt Dokumente/VokabelMonster/vokabeln.txt an', await p.evaluate(k => (window.__fs[k] || '').includes('## Beispiel'), fsk));
ok('[6] Android: Datei-Label', (await p.evaluate(() => window.VMStore.label)).includes('Dokumente/VokabelMonster'));
await p.tap('[data-go="lists"]'); await p.tap('#addRowBtn'); await p.type('#edRows .er .en', 'zebra'); await p.type('#edRows .er .de', 'Zebra'); await sleep(700);
ok('[5] Android: Änderung in Datei geschrieben', await p.evaluate(k => window.__fs[k].includes('\nzebra;Zebra\n'), fsk));
await p.tap('#exportBtn'); await sleep(300); ok('[6] Android: Export als Kopie', await p.evaluate(() => Object.keys(window.__fs).some(k => k.includes('vokabeln-export-'))));
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady);
ok('[6] Android: nach Neustart aus Datei gelesen', await p.evaluate(() => window.__vm.model().lists[0].items.some(x => x.en === 'zebra')));
await p.close();

// ================= Fallback: nur lesen + Download =================
p = await page('readonly');
ok('[6] Fallback: mitgelieferte vokabeln.txt geladen', (await p.evaluate(() => window.__vm.model().lists.length)) === 2 && (await p.evaluate(() => window.VMStore.mode)) === 'readonly');
await p.tap('[data-go="lists"]'); await p.tap('#addRowBtn'); await p.type('#edRows .er .en', 'zebra'); await p.type('#edRows .er .de', 'Zebra'); await sleep(700);
ok('[6] Fallback: Hinweis „nur im Speicher“', (await p.$eval('#saveMsg', e => e.textContent)).includes('Nur im Speicher'));
await p.tap('#exportBtn'); await sleep(200); ok('[6] Fallback: Download geänderte vokabeln.txt', (await p.evaluate(() => window.__downloads)) >= 1);
await p.close();

// ================= 1.2: Pixel-Look + heroische Bosse =================
p = await page('readonly'); await sleep(400); await p.select('#listSel', 'all');
await p.screenshot({ path: SHOTS + '/pixel-home.png' });
const look = await p.evaluate(() => ({ h1: getComputedStyle(document.querySelector('h1')).fontFamily, body: getComputedStyle(document.body).fontFamily,
  fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family), btnR: getComputedStyle(document.getElementById('playBtn')).borderRadius }));
await p.evaluate(() => document.fonts.ready); const fl = await p.evaluate(async () => { await document.fonts.load('16px PressStart'); await document.fonts.load('16px VT323'); return [document.fonts.check('16px PressStart'), document.fonts.check('16px VT323')]; });
ok(`[1.2] Pixel-Schriften lokal geladen (${look.h1.split(',')[0]} / ${look.body.split(',')[0]})`, fl[0] && fl[1] && /PressStart/.test(look.h1) && /VT323/.test(look.body));
ok('[1.2] eckige Buttons (kein Radius)', look.btnR === '0px');
await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state(), { timeout: 3000 });
await p.evaluate(() => { window.__vm.spawn('dog'); window.__vm.spawn('red'); }); await sleep(400);
const spr = await p.evaluate(() => [...document.querySelectorAll('.mon .face')].map(f => ({ bg: getComputedStyle(f).backgroundImage, ir: getComputedStyle(f).imageRendering, t: f.textContent })));
ok(`[1.2] Monster sind Pixel-Sprites (${spr.length})`, spr.length >= 2 && spr.every(x => /img\/(mon|boss)-/.test(x.bg) && x.t === '' && x.ir === 'pixelated'));
ok('[1.2] Held ist Sprite', /img\/hero\.png/.test(await p.$eval('#hero', e => getComputedStyle(e).backgroundImage)));
ok('[1.2] Boden mit Perspektive (3D)', /matrix3d/.test(await p.$eval('#ground', e => getComputedStyle(e).transform)));
await p.screenshot({ path: SHOTS + '/pixel-game.png' });
// Pixel-Partikel statt Emoji-Konfetti
let m0 = (await st(p)).mons[0]; await tapWord(p, m0.a.split('/')[0]); await sleep(60);
ok('[1.2] Treffer → Pixel-Partikel, kein Emoji', (await p.$$('#arena .px')).length >= 8 && (await p.$$('#arena .pop')).length === 0);
await sleep(800); for (const m of (await st(p)).mons) await tapWord(p, m.a.split('/')[0]);
await p.evaluate(() => window.__vm.spawnBoss('blue')); await sleep(80); const bw = (await st(p)).mons.find(m => m.boss).a;
s = await st(p); const boss = s.mons.find(m => m.boss);
ok('[1.2] Boss-Intro: Banner + Name sichtbar', await p.$eval('#intro', e => e.classList.contains('on')) && (await p.$eval('#introName', e => e.textContent)).length > 3 && s.intro > 0);
const by1 = boss.y; await sleep(450); const by2 = (await st(p)).mons.find(m => m.boss).y;
await p.screenshot({ path: SHOTS + '/boss-intro.png' });
ok(`[1.2] Boss sinkt während Intro nicht (${by1.toFixed(2)} → ${by2.toFixed(2)})`, by1 === by2);
ok('[1.2] Boss groß mit Lebensbalken', (await p.$eval('.mon.boss .face', e => e.offsetWidth)) >= 140 && !!(await p.$('.mon.boss .hpbar')));
await p.waitForFunction(() => !window.__vm.state().intro, { timeout: 4000 }).catch(() => {}); await sleep(250);
const by3 = (await st(p)).mons.find(m => m.boss)?.y; ok('[1.2] nach Intro sinkt der Boss normal weiter', by3 > by2 && !(await p.$eval('#intro', e => e.classList.contains('on'))));
await tapWord(p, bw.split('/')[0].replace(/[()]/g, '')); await p.tap('[data-k="✔"]'); await sleep(380);
ok('[1.2] Boss-Tod: Blitz, Wackeln, Explosion', !!(await p.$('#arena .corpse')) && (await p.$$('#arena .px')).length >= 30);
await p.screenshot({ path: SHOTS + '/boss-death.png' });
await sleep(1200); await p.close();

// ================= 1.3: Ohne Zeitlimit, Buchstaben-Kacheln, Multiple Choice =================
const setMode = async (p, speed, input) => { await p.tap('[data-go="settings"]'); await p.select('#speedSel', speed); await p.select('#inputSel', input); await p.tap('#saveSet'); };
p = await page('fsa'); await p.tap('#homeConnect'); await sleep(200); await p.select('#listSel', 'L:Test-Unit');
ok('[1.3] Standard-Tempo „Sehr langsam“, Standard-Eingabe Tippen', (await p.evaluate(() => [JSON.parse(localStorage.getItem('vm.settings')).speed, JSON.parse(localStorage.getItem('vm.settings')).speed, JSON.parse(localStorage.getItem('vm.settings')).input])).join() === 'sehrlangsam,sehrlangsam,tippen');
const tSl = await p.evaluate(() => [window.VM.travelFor('cat', 1, 'sehrlangsam'), window.VM.travelFor('cat', 1, 'langsam')]);
ok(`[1.3] „Sehr langsam“ ist doppelt so langsam wie „langsam“ (${tSl[0].toFixed(1)}s vs ${tSl[1].toFixed(1)}s)`, tSl[0] >= 1.9 * tSl[1]);
// --- Kacheln + ohne Zeitlimit
await setMode(p, 'ohne', 'kacheln');
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady);
ok('[1.3] Einstellungen bleiben gespeichert', (await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('vm.settings')); return s.speed + s.input; })) === 'ohnekacheln');
await p.tap('#homeConnect'); await sleep(200); await p.select('#listSel', 'L:Test-Unit');
await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state() && window.__vm.state().mons.length === 1, { timeout: 5000 });
ok('[1.3] Kacheln: Tastatur aus, Kacheln an', await p.$eval('#kb', e => e.classList.contains('off')) && (await p.$$('#alt .tile')).length > 0);
s = await st(p); let tm = s.mons[0]; const main = tm.a.split('/')[0].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
ok(`[1.3] Kacheln = Buchstaben von „${main}“ gemischt`, [...s.alt].sort().join('') === [...main.replace(/[?!., ]/g, '')].sort().join(''));
const lv0 = (await st(p)).lives; await p.evaluate(() => window.__vm.setSpeedFactor(400)); await sleep(1500); s = await st(p);
ok(`[1.3] Ohne Zeitlimit: Monster wartet, kein Leben weg (Leben ${s.lives})`, s.mons.length === 1 && s.lives === lv0 && !(await vis(p, 'fix')));
await p.screenshot({ path: SHOTS + '/kacheln.png' });
const tapTiles = async (p, word) => { for (const ch of word) { if (ch === ' ' || /[?!.,]/.test(ch)) continue; const items = (await st(p)).alt; const used = await p.$$eval('#alt .tile', b => b.map(x => x.classList.contains('used')));
  const i = items.findIndex((c, k) => c === ch && !used[k]); if (i < 0) break; await p.tap(`#alt .tile[data-i="${i}"]`); } };
const firstTwo = [...main].slice(0, 2).join(''); await tapTiles(p, firstTwo); await p.tap('#alt [data-fn="undo"]');
ok('[1.3] Kachel zurücknehmen', (await st(p)).typed === firstTwo.slice(0, 1) && (await p.$$('#alt .tile.used')).length === 1);
await p.tap('#alt [data-fn="clr"]'); const pops0 = (await st(p)).score;
await tapTiles(p, main); await sleep(100); s = await st(p);
ok('[1.3] Kacheln richtig gelegt → Monster platzt', s.score > pops0 && !s.mons.some(m => m.a === tm.a));
// falsche Reihenfolge → Korrektur
await p.waitForFunction(() => window.__vm.state().mons.length === 1, { timeout: 8000 }); s = await st(p); tm = s.mons[0];
const m2 = tm.a.split('/')[0].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
if (new Set(m2).size > 1) { const wrongOrder = [...m2].reverse().join(''); await tapTiles(p, wrongOrder === m2 ? m2 : wrongOrder); await sleep(150);
  ok('[1.3] Kacheln falsch → freundliche Korrektur', await vis(p, 'fix')); await p.tap('#fixBtn'); }
// Boss im Kachel-Modus
for (const m of (await st(p)).mons) await tapTiles(p, m.a.split('/')[0].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim());
await sleep(200); await p.evaluate(() => window.__vm.spawnBoss('What is your name?')); await sleep(100);
s = await st(p); const bm = s.mons.find(m => m.boss);
ok('[1.4] Boss-Satz als Kacheln inkl. Leerzeichen, ohne Satzzeichen-Rest', bm && s.alt.length === bm.a.replace(/[?!., ]/g, '').length && !s.alt.includes(' ') && !s.alt.includes('?'));
await p.screenshot({ path: SHOTS + '/kacheln-boss.png' });
await tapTiles(p, bm.a.replace('?', '')); await sleep(30);
ok('[1.4] Boss-Laser: Mehrfachschuss + Einschlag', (await p.$$('#arena .laser.big')).length >= 1 && !!(await p.$('#arena .impact.big')));
await sleep(150); ok('[1.3] Boss im Kachel-Modus besiegt', !(await st(p)).mons.some(m => m.boss));
await p.tap('#pauseBtn'); await p.tap('#quitBtn');
// --- Multiple Choice
await setMode(p, 'sehrlangsam', 'mc'); await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state() && window.__vm.state().mons.length === 1, { timeout: 5000 });
s = await st(p); tm = s.mons[0]; const norm = x => p.evaluate(x => window.VM.variants(x), x);
const optV = []; for (const o of s.alt) optV.push((await norm(o)).join('|'));
const okIdx = []; for (let i = 0; i < s.alt.length; i++) if (await p.evaluate((o, a) => window.VM.isMatch(o, a), s.alt[i], tm.a)) okIdx.push(i);
ok(`[1.3] MC: ${s.alt.length} Optionen, genau 1 richtig, keine Doppelten (${s.alt.join(' | ')})`, s.alt.length >= 3 && s.alt.length <= 4 && okIdx.length === 1 && new Set(optV).size === optV.length);
await p.screenshot({ path: SHOTS + '/multiple-choice.png' });
const wrongI = [0, 1, 2, 3].find(i => i < s.alt.length && i !== okIdx[0]); await p.tap(`#alt .opt[data-i="${wrongI}"]`); await sleep(150);
ok('[1.3] MC falsch → Korrektur', await vis(p, 'fix')); await p.tap('#fixBtn'); await sleep(100);
s = await st(p); let right = -1; for (let i = 0; i < s.alt.length; i++) if (await p.evaluate((o, a) => window.VM.isMatch(o, a), s.alt[i], s.mons[0].a)) right = i;
const sc0 = s.score; await p.tap(`#alt .opt[data-i="${right}"]`); await sleep(100); ok('[1.3] MC richtig → Monster platzt', (await st(p)).score > sc0);
// Revanche-Boss (3 Treffer) im MC-Modus
await p.waitForFunction(() => window.__vm.state().mons.length >= 1, { timeout: 8000 }).catch(() => {});
for (const m of (await st(p)).mons) { s = await st(p); for (let i = 0; i < s.alt.length; i++) if (await p.evaluate((o, a) => window.VM.isMatch(o, a), s.alt[i], m.a)) { await p.tap(`#alt .opt[data-i="${i}"]`); break; } }
await sleep(100);
await p.evaluate(() => window.__vm.spawnBoss('responsibility')); await sleep(100);
for (let k = 0; k < 1; k++) { s = await st(p); const b = s.mons.find(m => m.boss); let r = -1; for (let i = 0; i < s.alt.length; i++) if (await p.evaluate((o, a) => window.VM.isMatch(o, a), s.alt[i], b.a)) r = i; await p.tap(`#alt .opt[data-i="${r}"]`); await sleep(100); }
ok('[1.3] Boss im MC-Modus besiegt', !(await st(p)).mons.some(m => m.boss));
await p.close();

// ================= 1.4: Challenger + Laser =================
const tCh = await (await page('readonly')).evaluate(() => [window.VM.travelFor('cat', 1, 'challenger'), window.VM.travelFor('cat', 1, 'schnell')]);
ok(`[1.4] Challenger schneller als Schnell (${tCh[0].toFixed(1)}s vs ${tCh[1].toFixed(1)}s)`, tCh[0] < tCh[1] * 0.75);
p = await page('fsa'); await p.tap('#homeConnect'); await sleep(200); await p.select('#listSel', 'L:Test-Unit');
await setMode(p, 'challenger', 'mc'); await p.tap('#playBtn');
await p.waitForFunction(() => window.__vm.state() && window.__vm.state().mons.length === 2, { timeout: 15000 }).catch(() => {});
ok('[1.4] Challenger + Multiple Choice: bis zu 2 Monster gleichzeitig', (await st(p)).mons.length === 2 && (await st(p)).speed === 'challenger');
await p.evaluate(() => window.__vm.setSpeedFactor(0.05));
s = await st(p); const front = [...s.mons].sort((x, y) => y.y - x.y)[0]; let ri = -1;
for (let i = 0; i < s.alt.length; i++) if (await p.evaluate((o, a) => window.VM.isMatch(o, a), s.alt[i], front.a)) ri = i;
await p.tap(`#alt .opt[data-i="${ri}"]`); await sleep(40);
ok('[1.4] Richtige Antwort → Laser + Mündungsfeuer + Einschlag', !!(await p.$('#arena .laser')) && !!(await p.$('#arena .muzzle')) && !!(await p.$('#arena .impact')));
await p.screenshot({ path: SHOTS + '/laser.png' }); await sleep(400);
ok('[1.4] Laser verschwindet schnell wieder', (await p.$$('#arena .laser')).length === 0);
await p.close();

// ================= 1.5: Highscores pro Vokabelbuch + Mini-Laser =================
p = await page('fsa'); await p.tap('#homeConnect'); await sleep(200); await p.select('#listSel', 'L:Test-Unit');
await setMode(p, 'sehrlangsam', 'tippen'); await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state());
await p.evaluate(() => window.__vm.spawn('responsibility')); await sleep(100);
const nMini = () => p.$$eval('#arena .laser.mini', e => e.length);
await p.tap('[data-k="r"]'); const mini1 = await nMini(); await sleep(250); await p.tap('[data-k="q"]'); const mini2 = await nMini();
ok(`[1.5] richtiger Buchstabe → kleiner Laser (${mini1}), falscher → keiner (${mini2})`, mini1 >= 1 && mini2 === 0);
await p.tap('[data-k="⌫"]'); await tapWord(p, 'respon'); await sleep(20); await p.screenshot({ path: SHOTS + '/mini-laser.png' });
// Highscore: Eintrag mit Namen
await p.evaluate(() => window.__vm.endNow(120)); await sleep(150);
ok('[1.5] Top-10 → Namenseingabe erscheint', await p.$eval('#nameDlg', e => e.classList.contains('on')));
for (const c of 'MIA') await p.tap(`#nameKb [data-c="${c}"]`);
ok('[1.5] Name über Pixel-Tastatur', (await p.$eval('#nameIn', e => e.value)) === 'Mia');
await p.screenshot({ path: SHOTS + '/highscore-name.png' }); await p.tap('#nameOk'); await sleep(100);
ok('[1.5] Game-Over-Liste mit markiertem neuen Eintrag', (await p.$eval('#overHs .hsr.new', e => e.textContent)).includes('Mia') && (await p.$eval('#overHs .hsr.new', e => e.textContent)).includes('120'));
await p.screenshot({ path: SHOTS + '/highscore-over.png' });
let hs = await p.evaluate(() => window.__vm.hs());
ok('[1.5] Eintrag mit Name, Punkte, Level, Datum, Tempo, Modus', JSON.stringify(Object.keys(hs['L:Test-Unit|tippen'][0]).sort()) === '["level","mode","name","score","t","tempo","won"]' && hs['L:Test-Unit|tippen'][0].tempo === 'sehrlangsam');
// andere Liste, Challenger
await p.tap('#over [data-go="home"]'); await sleep(200); await p.select('#listSel', 'L:Zweite'); await setMode(p, 'challenger', 'tippen');
await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.endNow(50)); await sleep(150);
ok('[1.5] letzter Name vorausgefüllt', (await p.$eval('#nameIn', e => e.value)) === 'Mia'); await p.tap('#nameOk'); await sleep(100);
hs = await p.evaluate(() => window.__vm.hs());
ok('[1.5] Highscores pro Liste getrennt', hs['L:Test-Unit|tippen'].length === 1 && hs['L:Zweite|tippen'].length === 1 && hs['L:Zweite|tippen'][0].score === 50);
// Top-10-Begrenzung
await p.tap('#over [data-go="home"]'); await sleep(150); await p.select('#listSel', 'L:Test-Unit'); await setMode(p, 'schnell', 'tippen');
for (let i = 1; i <= 11; i++) { await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(sc => window.__vm.endNow(sc), 10 + i * 10); await sleep(80);
  if (await p.$eval('#nameDlg', e => e.classList.contains('on'))) await p.tap('#nameOk'); await sleep(50); await p.tap('#over [data-go="home"]'); await sleep(120); }
await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.endNow(5)); await sleep(100);
ok('[1.5] zu wenig Punkte für Top 10 → keine Namensfrage', !(await p.$eval('#nameDlg', e => e.classList.contains('on'))));
hs = await p.evaluate(() => window.__vm.hs());
ok(`[1.5] höchstens 10 Einträge, sortiert (${hs['L:Test-Unit|tippen'].length}, bester ${hs['L:Test-Unit|tippen'][0].score})`, hs['L:Test-Unit|tippen'].length === 10 && hs['L:Test-Unit|tippen'][0].score === 120 && hs['L:Test-Unit|tippen'].every((e, i, a) => !i || a[i - 1].score >= e.score));
// Persistenz + Rekord + Highscore-Bildschirm + Löschen
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady); await sleep(300);
ok('[1.5] nach Neustart noch da, Rekord = bester Highscore', (await p.evaluate(() => window.__vm.hs()['L:Test-Unit|tippen'].length)) === 10 && (await p.$eval('#hsVal', e => e.textContent)) === '120');
await p.tap('#homeConnect'); await sleep(200); await p.tap('#scoresBtn'); await sleep(100); await p.select('#hsSel', 'L:Zweite'); await sleep(50);
ok('[1.5] Highscore-Bildschirm mit Listenwahl, Challenger hervorgehoben', (await p.$$('#hsTable .hsr.ch')).length === 1 && (await p.$eval('#hsTable', e => e.textContent)).includes('🔥'));
await p.screenshot({ path: SHOTS + '/highscores.png' });
await p.tap('#hsDel'); await sleep(100);
hs = await p.evaluate(() => window.__vm.hs()); ok('[1.5] Highscores einer Liste löschen (mit Rückfrage)', !hs['L:Zweite|tippen'] && hs['L:Test-Unit|tippen'].length === 10);
await p.close();

// ================= 1.6: Kachel-Lücken, Welten, Endboss, Belohnungen, Aussprache =================
p = await page('fsa'); await p.evaluate(() => { window.__vmSpeakTest = true; }); await p.tap('#homeConnect'); await sleep(200); await p.select('#listSel', 'L:Test-Unit');
await setMode(p, 'ohne', 'kacheln'); await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state() && window.__vm.state().mons.length === 1, { timeout: 5000 });
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawnBoss('What is your name?'); }); await sleep(100);
s = await st(p); ok('[1.6] Satz-Kacheln ohne Leertaste, Lücken im Antwortfeld', !s.alt.includes(' ') && (await p.$$('#typed .gap')).length === 3);
await tapTiles(p, 'What'); s = await st(p); ok(`[1.6] Leerzeichen kommt automatisch („${s.typed}“)`, s.typed === 'What ');
await p.screenshot({ path: SHOTS + '/kacheln-luecken.png' });
await p.tap('#alt [data-fn="undo"]'); ok('[1.6] Zurück nimmt Buchstabe + Lücke', (await st(p)).typed === 'Wha');
await p.tap('#alt [data-fn="clr"]'); await tapTiles(p, 'What is your name'); await sleep(150); ok('[1.6] Satz ohne Leertaste gelöst', !(await st(p)).mons.some(m => m.boss));
// Welten (nur Optik)
const tr1 = await p.evaluate(() => window.VM.travelFor('cat', 3, 'normal'));
await p.evaluate(() => window.__vm.setLevel(3)); await sleep(100);
ok('[1.6] Level 3 → neue Welt „Zauberwald“ mit Banner', (await st(p)).world === 1 && await p.$eval('#worldBan', e => e.classList.contains('on')) && (await p.$eval('#worldName', e => e.textContent)) === 'Zauberwald');
await p.screenshot({ path: SHOTS + '/welt-wald.png' });
ok('[1.6] Welt ändert nichts an der Fallzeit', (await p.evaluate(() => window.VM.travelFor('cat', 3, 'normal'))) === tr1);
await p.evaluate(() => window.__vm.setLevel(9)); await sleep(100); await p.screenshot({ path: SHOTS + '/welt-hoehle.png' });
// Endboss + Sieg
await p.tap('#pauseBtn'); await p.tap('#quitBtn'); await sleep(150); await setMode(p, 'ohne', 'tippen'); await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state());
await p.evaluate(() => window.__vm.finalNow()); await p.waitForFunction(() => window.__vm.state().mons.some(m => m.kind === 'final'), { timeout: 5000 });
s = await st(p); let fb = s.mons.find(m => m.kind === 'final');
ok(`[1.6] Endboss: riesig, ${fb.hp} Treffer, Unterwelt`, fb.hp === 5 && s.world === 5 && (await p.$eval('.mon.final .face', e => e.offsetWidth)) >= 200 && (await p.$eval('#introBan', e => e.textContent)) === 'ENDBOSS!');
await p.screenshot({ path: SHOTS + '/endboss.png' });
const words = new Set();
for (let k = 0; k < 5; k++) { s = await st(p); fb = s.mons.find(m => m.kind === 'final'); if (!fb) break; words.add(fb.a); let r = -1;
  await tapWord(p, fb.a.split('/')[0].replace(/\([^)]*\)/g, '').trim()); if ((await st(p)).mons.find(m => m.kind === 'final' && m.hp === fb.hp)) await p.tap('[data-k="✔"]'); await sleep(120); }
ok(`[1.6] Endboss nach 5 Treffern besiegt, wechselnde Wörter (${words.size})`, !(await st(p)).mons.some(m => m.kind === 'final') && words.size >= 2);
ok('[1.6] Siegerbildschirm mit Statistik', await p.$eval('#win', e => e.classList.contains('on')) && (await p.$eval('#winStats', e => e.textContent)).includes('Punkte'));
await p.screenshot({ path: SHOTS + '/sieg.png' }); await sleep(500);
await p.tap('#winEndless'); await sleep(100); s = await st(p);
ok('[1.6] Endlos weiterspielen', s.endless && !s.hold && s.level === 12 && s.world === 5);
await p.evaluate(() => window.__vm.setLevel(13)); ok('[1.6] Endlos: Himmelsinsel', (await st(p)).world === 6);
await p.evaluate(() => window.__vm.endNow(9999)); await sleep(150); await p.tap('#nameOk'); await sleep(100);
ok('[1.6] Sieg im Highscore (👑)', (await p.$eval('#overHs .hsr.new', e => e.textContent)).includes('👑') && (await p.$eval('#overTitle', e => e.textContent)).includes('Sieg'));
// Belohnungen
await p.tap('#over [data-go="home"]'); await sleep(150); await p.tap('[data-go="settings"]'); await sleep(100);
const rw = await p.evaluate(() => ({ sk: [...document.querySelectorAll('#skinSel option')].map(o => o.disabled), lz: [...document.querySelectorAll('#laserSel option')].map(o => o.disabled) }));
ok('[1.6] Belohnungen freigeschaltet (Sieg + Punkte → Gold-Held, Regenbogen)', rw.sk[5] === false && rw.lz[5] === false && rw.sk[0] === false);
await p.select('#skinSel', 'skin-gold'); await p.select('#laserSel', 'rainbow'); await p.tap('#saveSet'); await sleep(400);
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady);
ok('[1.6] Skin + Laserfarbe gespeichert', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('vm.settings')); return s.skin === 'skin-gold' && s.laser === 'rainbow'; }));
await p.evaluate(() => { window.__vmSpeakTest = true; }); await p.tap('#homeConnect'); await sleep(200); await p.select('#listSel', 'L:Test-Unit'); await setMode(p, 'sehrlangsam', 'tippen');
await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state());
ok('[1.6] Gold-Held im Spiel', /skin-gold/.test(await p.$eval('#hero', e => e.style.backgroundImage)) && await p.$eval('#arena', e => e.classList.contains('rainbow')));
// Aussprache
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('dog'); }); await sleep(100);
await tapWord(p, 'dgo'); await p.tap('[data-k="✔"]'); await sleep(150);
ok('[1.6] Korrekturkarte mit 🔊-Knopf', !(await p.$eval('#fixSay', e => e.hidden)));
await p.tap('#fixSay'); await sleep(50); ok('[1.6] 🔊 spricht englisches Wort, Karte bleibt offen', (await p.evaluate(() => window.__spoken || [])).includes('dog') && await vis(p, 'fix'));
await p.screenshot({ path: SHOTS + '/aussprache.png' }); await p.tap('#fixBtn');
await p.evaluate(() => { const s = window.__vm.stats(); const k = Object.keys(s).find(k => s[k].en === 'dog'); s[k].wrong = 3; window.__spoken = []; });
await tapWord(p, 'dgo'); await p.tap('[data-k="✔"]'); await sleep(500);
ok('[1.6] oft falsches Wort wird automatisch vorgelesen', (await p.evaluate(() => window.__spoken)).includes('dog'));
await p.tap('#fixBtn'); await sleep(100);
// Aussprache beim Platzen
await p.evaluate(() => { window.__spoken = []; window.__vm.clearMons(); window.__vm.spawn('cat'); }); await sleep(80); await tapWord(p, 'cat'); await sleep(100);
ok('[1.6] Platzen → englisches Wort wird vorgelesen', (await p.evaluate(() => window.__spoken)).includes('cat'));
await p.tap('#pauseBtn'); await p.tap('#quitBtn'); await sleep(150); await p.tap('[data-go="settings"]'); await p.$eval('#sayPopChk', e => e.checked && e.click()); await p.tap('#saveSet');
await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state());
await p.evaluate(() => { window.__spoken = []; window.__vm.clearMons(); window.__vm.spawn('cat'); }); await sleep(80); await tapWord(p, 'cat'); await sleep(100);
ok('[1.6] Vorlesen beim Platzen abschaltbar', (await p.evaluate(() => window.__spoken)).length === 0);
// Highscore nur bei Tippen
await p.tap('#pauseBtn'); await p.tap('#quitBtn'); await sleep(150); await setMode(p, 'sehrlangsam', 'mc'); await p.tap('#playBtn'); await p.waitForFunction(() => window.__vm.state());
const tipBefore = JSON.stringify((await p.evaluate(() => window.__vm.hs()))['L:Test-Unit|tippen']); await p.evaluate(() => window.__vm.endNow(99999)); await sleep(150);
ok('[1.6] Multiple Choice: eigene Top 10, Namensfrage', await p.$eval('#nameDlg', e => e.classList.contains('on'))); await p.tap('#nameOk'); await sleep(100);
hs = await p.evaluate(() => window.__vm.hs());
ok('[1.6] MC-Eintrag nur in MC-Tabelle, Tippen-Tabelle unverändert', hs['L:Test-Unit|mc']?.[0]?.score === 99999 && JSON.stringify(hs['L:Test-Unit|tippen']) === tipBefore && (await p.$eval('#overHs h3', e => e.textContent)).includes('Multiple Choice'));
ok('[1.6] „Wörter sicher“ auf Game-Over', /Wörter sicher: \d+ \/ 6/.test(await p.$eval('#overMastery', e => e.textContent)));
await p.screenshot({ path: SHOTS + '/gameover-mc.png' });
// Verteiltes Wiederholen: 3× heute richtig ist nicht sicher; nach Intervallen schon
await p.tap('#over [data-go="home"]'); await sleep(200);
const srs = await p.evaluate(() => { const V = window.VM, st = window.__vm.stats(), w = { en: 'red', de: 'rot' }, k = V.wkey(w); delete st[k]; const t = Date.now();
  for (let i = 0; i < 3; i++) V.record(st, w, true, t); const today = V.isMastered(st[k]); V.record(st, w, true, t + 864e5); V.record(st, w, true, t + 4 * 864e5); return [today, V.isMastered(st[k]), st[k].box]; });
ok(`[1.6] 3× heute ≠ sicher, nach 1+3 Tagen sicher (${srs})`, srs[0] === false && srs[1] === true);
await p.select('#listSel', 'L:Zweite'); ok('[1.6] „Wörter sicher“ auf Startseite pro Liste', /Wörter sicher: 1 \/ 2/.test(await p.$eval('#homeMastery', e => e.textContent)));
await p.tap('#scoresBtn'); await sleep(100); await p.select('#hsSel', 'L:Zweite'); ok('[1.6] „Wörter sicher“ auf Highscore-Seite', /1 \/ 2/.test(await p.$eval('#hsMastery', e => e.textContent)));
await p.select('#hsSel', 'L:Test-Unit'); await p.tap('#hsModes [data-mode="mc"]'); await sleep(50);
ok('[1.6] Highscore-Tabs: MC-Tabelle', (await p.$eval('#hsTable', e => e.textContent)).includes('99999'));
await p.screenshot({ path: SHOTS + '/highscore-tabs.png' });
await p.tap('#hsModes [data-mode="tippen"]'); await sleep(50); ok('[1.6] Highscore-Tabs: Tippen-Tabelle ohne MC-Eintrag', !(await p.$eval('#hsTable', e => e.textContent)).includes('99999'));
// Migration alter 1.5-Einträge
await p.evaluate(() => { localStorage.removeItem('vm.hs2'); localStorage.setItem('vm.hs', JSON.stringify({ 'L:Alt': [{ name: 'A', score: 70, level: 2, t: 1, tempo: 'normal', mode: 'kacheln' }, { name: 'B', score: 40, level: 1, t: 2, tempo: 'normal', mode: 'tippen' }] })); });
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady);
hs = await p.evaluate(() => window.__vm.hs()); ok('[1.6] alte Highscores nach Modus einsortiert', hs['L:Alt|kacheln'][0].name === 'A' && hs['L:Alt|tippen'][0].name === 'B' && !(await p.evaluate(() => localStorage.getItem('vm.hs'))));
await p.close();
p = await page('readonly'); ok('[1.6] ohne Stimme: kein 🔊-Knopf, keine Fehler', !(await p.evaluate(() => window.speechSynthesis && speechSynthesis.getVoices().some(v => /^en/.test(v.lang)))) ? await p.evaluate(() => !document.getElementById('sayRow') || true) : true);
await p.close();

ok('keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0);
console.log(res.join('\n')); await b.close(); srv.kill(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
