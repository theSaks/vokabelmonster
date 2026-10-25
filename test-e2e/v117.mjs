// 1.17 E2E: Vorlesen (kein Nachsprechen, Abbruch bei neuem Wort, Sprache je Wort) + Wörter bleiben im Bild (Handy, Boss).  node test-e2e/v117.mjs [Screenshot-Ordner]
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const OUT = process.argv[2] || ''; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8098', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=de-DE'] });
const res = [], errors = []; const ok = (n, c, info) => { res.push(`${c ? 'OK  ' : 'FAIL'} ${n}`); if (!c && info !== undefined) console.log(n, JSON.stringify(info)); }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async (p, n) => { if (OUT) await p.screenshot({ path: `${OUT}/${n}.png` }); };
const PHONE = { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function page(settings, { fast = true, vp = PHONE } = {}) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.emulate({ viewport: vp, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36' });
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.evaluateOnNewDocument((s, fast) => { if (fast) window.VM_TEST_FAST = true; window.__vmRnd = () => 0.99;
    // Fake-Sprachausgabe: protokolliert speak/cancel und ob sich zwei Äußerungen überlappen
    const log = window.__ttsLog = { speak: [], cancel: 0, overlap: 0 }; let busy = false;
    const fake = { get speaking() { return busy; }, pending: false, paused: false, getVoices: () => [{ name: 'de', lang: 'de-DE', localService: true }, { name: 'en', lang: 'en-GB', localService: true }],
      speak(u) { if (busy) log.overlap++; busy = true; log.speak.push({ t: u.text, l: u.lang }); setTimeout(() => { busy = false; u.onend && u.onend(); }, 150); },
      cancel() { log.cancel++; busy = false; }, resume() {}, addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('vm.settings', JSON.stringify(Object.assign({ v13: true, ui: 'de', list: 'L:Unit 2: Familie & Zuhause – Startliste (an Red Line 1 angelehnt)' }, s))); } }, settings, fast);
  await p.goto('http://localhost:8098/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady); return p;
}
const play = async p => { await p.click('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.clearMons()); };
const spoken = p => p.evaluate(() => window.__ttsLog.speak.map(x => x.t));
// liegt das Monster (inkl. Wort) ganz in der Arena bzw. über der Eingabeleiste?
const inView = p => p.evaluate(() => { const a = document.getElementById('arena').getBoundingClientRect(), bar = document.getElementById('inputBar').getBoundingClientRect();
  return [...document.querySelectorAll('#arena .mon')].map(el => { const t = el.querySelector('.tag').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: Math.round(t.left - a.left), r: Math.round(a.right - t.right), top: Math.round(r.top - a.top), bot: Math.round(Math.min(a.bottom, bar.top) - r.bottom), tb: Math.round(bar.top - t.bottom) }; }); });
const inside = v => v.length && v.every(x => x.l >= 0 && x.r >= 0 && x.bot >= 0 && x.tb >= 0);
try {
  // 1) Kein Vorlesen nach einem Treffer (echtes Timing, nicht FAST)
  let p = await page({ input: 'tippen', sayFirst: false, say: true, sayPop: true, dir: 'de-en' }, { fast: false });
  await play(p); await p.evaluate(() => { window.__vm.spawn('family'); window.__vm.state(); }); await sleep(300);
  const before = (await spoken(p)).length; for (const k of 'family') await p.keyboard.press(k); await sleep(900);
  const s1 = await spoken(p);
  ok('Kein Vorlesen bei Erfolg (auch wenn altes sayPop=true gespeichert)', s1.length === before && !s1.includes('family'), s1);
  ok('Haken „beim Zerplatzen vorlesen“ ausgeblendet', await p.evaluate(() => getComputedStyle(document.getElementById('sayPopChk').closest('label')).display === 'none'));
  await p.close();

  // 2) Neues Wort bricht geplante/alte Sprache ab (Boss-Vorlesen ist 600 ms verzögert → darf nach neuem Wort nicht mehr kommen)
  p = await page({ input: 'tippen', sayFirst: true, dir: 'de-en' }, { fast: false });
  await play(p); await p.evaluate(() => window.__vm.spawnBoss('This is my sister.')); await sleep(100);
  const stops0 = await p.evaluate(() => window.__speechStops || 0);
  await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('family'); }); await sleep(1200);
  const s2 = await spoken(p), st2 = await p.evaluate(() => ({ stops: window.__speechStops || 0, log: window.__ttsLog }));
  ok('Neues Wort: verspätetes altes Wort wird nicht mehr gesprochen', !s2.some(t => /sister/i.test(t)) && s2.at(-1) === 'family', s2);
  ok('Neues Wort: laufende Sprache wird abgebrochen (stopSpeech)', st2.stops > stops0);
  // schnell hintereinander: nie zwei Äußerungen gleichzeitig, Doppeltipp auf 🔊 nur einmal
  await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('brother'); window.__vm.clearMons(); window.__vm.spawn('sister'); }); await sleep(100);
  const n0 = (await spoken(p)).length; await p.evaluate(() => { const b = document.getElementById('sayAgain'); for (let i = 0; i < 2; i++) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); await sleep(400);
  const st3 = await p.evaluate(() => window.__ttsLog);
  ok('Nie zwei Äußerungen gleichzeitig (Fake-TTS: kein Überlappen)', st3.overlap === 0, st3);
  ok('Doppeltipp auf „Nochmal“ spricht nur einmal', st3.speak.length - n0 <= 1, st3.speak.slice(n0));
  await p.close();

  // 3) Sprache je Wort: Englisch → Deutsch, Korrekturkarte liest die deutsche Lösung mit de-DE; Deutsch → Englisch + Vorlesen zuerst liest Englisch (en-GB)
  p = await page({ input: 'tippen', say: true, sayFirst: false, dir: 'en-de' });
  await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(150);
  for (const k of 'famile') await p.keyboard.press(k); await p.keyboard.press('Enter'); await sleep(300);
  const l3 = await p.evaluate(() => window.__ttsLog.speak.at(-1));
  ok('Korrekturkarte (Englisch → Deutsch): „Familie“ mit de-DE vorgelesen', l3 && l3.t === 'Familie' && l3.l === 'de-DE', l3);
  await p.close();
  p = await page({ input: 'kacheln', sayFirst: true, dir: 'de-en' });
  await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(150);
  const l4 = await p.evaluate(() => window.__ttsLog.speak.at(-1));
  ok('Deutsch → Englisch + Vorlesen zuerst: englisches Wort mit en-GB (Hörübung)', l4 && l4.t === 'family' && l4.l === 'en-GB', l4);
  await p.close();

  // 4) Wort am Rand bleibt im Bild (Handy 360 px, LRS-Schrift + Silben, x ganz rechts / ganz links)
  for (const [rnd, side] of [[0.999, 'rechts'], [0.0, 'links']]) {
    p = await page({ input: 'tippen', font: 'lexend', syl: true, lrs: true, dir: 'de-en' });
    await p.evaluate(() => window.__vm.hyph()); await play(p); await sleep(300); await p.evaluate(() => window.__vm.setSpeedFactor(0.01));
    await p.evaluate(r => { const mr = Math.random; Math.random = () => r; window.__vm.clearMons(); window.__vm.spawn('grandma/grandmother'); Math.random = mr; }, rnd); await sleep(400);
    const v = await inView(p); ok(`Handy: langes Wort am Rand ${side} ganz sichtbar`, inside(v), v);
    if (side === 'rechts') await shot(p, '01-wort-am-rand-handy');
    await p.close();
  }
  // 5) Boss mit langem Satz: über der Eingabeleiste, auch ganz unten (Handy + schmal 320 px)
  for (const vp of [PHONE, { ...PHONE, width: 320, height: 640 }]) {
    p = await page({ input: 'tippen', font: 'lexend', syl: true, dir: 'de-en' }, { vp });
    await play(p); await p.evaluate(() => window.__vm.spawnBoss('This is my sister.')); await sleep(400);
    await p.waitForFunction(() => window.__vm.state().intro === 0, { timeout: 15000 }); await p.evaluate(() => window.__vm.setSpeedFactor(6)); await p.waitForFunction(() => { const m = window.__vm.state().mons[0]; return m && m.y > 65; }, { timeout: 20000, polling: "raf" }); await sleep(200);
    const v = await inView(p), y = await p.evaluate(() => window.__vm.state().mons.map(m => Math.round(m.y)));
    ok(`Boss ${vp.width}px: Wort bleibt über der Eingabeleiste (y=${y})`, inside(v), v);
    if (vp.width === 360) await shot(p, '02-boss-langer-satz-handy');
    await p.close();
  }
  // 6) Soft-Keyboard: Viewport wird kleiner → Monster werden neu eingepasst
  p = await page({ input: 'tippen', dir: 'de-en' }); await play(p);
  await p.evaluate(() => window.__vm.spawnBoss('This is my sister.')); await p.waitForFunction(() => window.__vm.state().intro === 0, { timeout: 15000 }); await p.evaluate(() => window.__vm.setSpeedFactor(6)); await p.waitForFunction(() => { const m = window.__vm.state().mons[0]; return m && m.y > 25; }, { timeout: 20000, polling: "raf" }); await p.evaluate(() => window.__vm.setSpeedFactor(1 / 30));
  await p.setViewport({ ...PHONE, height: 420 }); await sleep(400);
  const v6 = await inView(p); ok('Kleinerer Viewport (Bildschirmtastatur): Boss-Wort weiter sichtbar', inside(v6), v6);
  await p.close();

  // 7) 1.17.1 Ziel-Lock bei 3+ Monstern (freies Tippen): Ziel + Getipptes bleiben, auch bei neuen Monstern / Relayout; Ziel nie verdeckt
  const tgt = p => p.evaluate(() => { const t = document.querySelector('.mon.target'); if (!t) return null; const r = t.querySelector('.tag').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { q: t.querySelector('.tag').textContent, n: document.querySelectorAll('.mon.target').length, vis: !!(e && t.contains(e)), typed: window.__vm.state().typed }; });
  for (const vp of [PHONE, { width: 1280, height: 800 }]) {
    p = await page({ input: 'tippen', speed: 'normal', dir: 'de-en' }, { vp }); await play(p);
    await p.evaluate(() => { const mr = Math.random; Math.random = () => 0.5; ['bathroom', 'brother', 'bed'].forEach(w => window.__vm.spawn(w)); Math.random = mr; window.__vm.setSpeedFactor(0.05); });
    for (const k of 'br') await p.keyboard.press(k); await sleep(100);
    const a = await tgt(p);
    await p.evaluate(() => { const mr = Math.random; Math.random = () => 0.5; window.__vm.spawn('bedroom'); window.__vm.spawn('baby'); Math.random = mr; window.__vm.setSpeedFactor(0.05); }); await sleep(300);
    await p.setViewport({ ...vp, height: vp.height - 120 }); await sleep(300); const b1 = await tgt(p);
    ok(`Lock ${vp.width}px: 5 Monster, „br“ → Ziel „Bruder“ bleibt, Getipptes bleibt`, a && a.q === 'Bruder' && b1 && b1.q === 'Bruder' && b1.typed === 'br' && b1.n === 1, { a, b1 });
    ok(`Lock ${vp.width}px: Ziel liegt obenauf (nicht verdeckt), obwohl alle Monster an derselben Stelle stehen`, a.vis && b1.vis, { a, b1 });
    await p.keyboard.press('Backspace'); await sleep(100); const c = await tgt(p);
    ok(`Lock ${vp.width}px: Rücktaste auf „b“ → Ziel bleibt „Bruder“ (springt nicht auf „Badezimmer“)`, c && c.q === 'Bruder', c);
    for (const k of 'rother') await p.keyboard.press(k); await sleep(200);
    ok(`Lock ${vp.width}px: „brother“ trifft das gelockte Monster, die anderen 4 bleiben`, await p.evaluate(() => window.__vm.state().mons.length === 4 && !window.__vm.state().mons.some(m => m.a === 'brother')));
    await p.close();
  }
  // 8) Kacheln mit 3 Monstern: begonnenes Wort bleibt das Kachel-Wort, auch wenn neue Monster kommen
  p = await page({ input: 'kacheln', speed: 'challenger', dir: 'de-en' }); await play(p);
  await p.evaluate(() => { window.__vm.spawn('brother'); window.__vm.spawn('bed'); window.__vm.setSpeedFactor(0.05); }); await sleep(200);
  const tw = await p.evaluate(() => window.__vm.state().tileWord);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#alt .tile')].find(x => !x.classList.contains('used') && x.textContent.trim().toLowerCase() === window.__vm.state().tileWord[0].toLowerCase()); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); await sleep(150);
  await p.evaluate(() => { window.__vm.spawn('bathroom'); window.__vm.setSpeedFactor(0.05); }); await sleep(300);
  const k8 = await p.evaluate(() => ({ tw: window.__vm.state().tileWord, typed: window.__vm.state().typed, n: window.__vm.state().mons.length }));
  ok('Kacheln (3 Monster): Kachel-Wort und erster Buchstabe bleiben nach neuem Monster', k8.tw === tw && k8.typed.length === 1 && k8.n === 3, { tw, k8 });
  await p.close();
  // 9) Boss: halb getippter Satz bleibt bei Relayout (kleineres Fenster) erhalten, Boss bleibt Ziel
  p = await page({ input: 'tippen', dir: 'de-en' }); await play(p); await p.evaluate(() => window.__vm.spawnBoss('This is my sister.'));
  await p.waitForFunction(() => window.__vm.state().intro === 0, { timeout: 15000 }); for (const k of 'This is') await p.keyboard.press(k === ' ' ? 'Space' : k);
  await p.setViewport({ ...PHONE, height: 600 }); await sleep(300); const b9 = await tgt(p);
  ok('Boss: Getipptes „This is“ und Ziel bleiben nach Relayout', b9 && b9.typed === 'This is' && /Schwester/.test(b9.q) && b9.vis, b9);
  await p.close();
} catch (e) { ok('Ausnahme: ' + e.message, false); }
ok('keine JS-Fehler', !errors.length); if (errors.length) console.log(errors.join('\n'));
console.log(res.join('\n')); console.log(`${res.filter(r => r.startsWith('OK')).length} OK, ${res.filter(r => r.startsWith('FAIL')).length} FAIL`);
await b.close(); srv.kill(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
