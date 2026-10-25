// 1.16 E2E für die LRS-Hilfen (Headless-Chrome, Tablet-Emulation) + Screenshots:  node test-e2e/lrs.mjs [Screenshot-Ordner]
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const OUT = process.argv[2] || ''; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8099', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=de-DE', '--autoplay-policy=no-user-gesture-required'] });
const res = [], errors = []; const ok = (n, c) => res.push(`${c ? 'OK  ' : 'FAIL'} ${n}`); const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async (p, n) => { if (OUT) await p.screenshot({ path: `${OUT}/${n}.png` }); };
async function page(settings, stats, fast = true) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.emulate({ viewport: { width: 1280, height: 800, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Tab) AppleWebKit/537.36 Chrome/129 Safari/537.36' });
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.evaluateOnNewDocument((s, st, fast) => { if (fast) window.VM_TEST_FAST = true; window.__vmSpeakTest = true; window.__vmRnd = () => 0.99;
    try { Object.defineProperty(window, 'showOpenFilePicker', { value: undefined }); } catch {}
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('vm.settings', JSON.stringify(Object.assign({ v13: true, ui: 'de', list: 'L:Unit 2: Familie & Zuhause – Startliste (an Red Line 1 angelehnt)' }, s))); if (st) localStorage.setItem('vm.stats', JSON.stringify(st)); } }, settings, stats, fast);
  await p.goto('http://localhost:8099/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady); return p;
}
const play = async p => { await p.click('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.clearMons()); };
try {
  // 1) Einstellungen: LRS-Modus setzt Vorgaben, bleibt nach Neustart
  let p = await page({ input: 'tippen', speed: 'normal' });
  await p.click('[data-go="settings"]'); await p.click('#lrsChk'); await sleep(100);
  const s1 = await p.evaluate(() => ({ cls: document.body.className, font: $v('fontSel'), syl: document.getElementById('sylChk').checked, say: document.getElementById('sayFirstChk').checked, input: $v('inputSel'), speed: $v('speedSel') }), null).catch(async () => p.evaluate(() => { const v = id => document.getElementById(id).value; return { cls: document.body.className, font: v('fontSel'), syl: document.getElementById('sylChk').checked, say: document.getElementById('sayFirstChk').checked, input: v('inputSel'), speed: v('speedSel') }; }));
  ok('LRS-Modus: Lexend, Silben, Vorlesen, Kacheln, sehr langsam', s1.font === 'lexend' && s1.syl && s1.say && s1.input === 'kacheln' && s1.speed === 'sehrlangsam');
  ok('LRS-Modus: CSS-Klassen am body (lrs-font font-lexend syl-on)', /lrs-font/.test(s1.cls) && /font-lexend/.test(s1.cls) && /syl-on/.test(s1.cls));
  await p.evaluate(() => document.getElementById('lrsChk').scrollIntoView({ block: 'start' })); await sleep(300); await shot(p, '01-einstellungen-lrs');
  await p.click('#saveSet'); await sleep(200); await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady);
  const s2 = await p.evaluate(() => ({ s: window.__vm.settings(), cls: document.body.className }));
  ok('Einstellungen bleiben nach Neustart', s2.s.lrs && s2.s.font === 'lexend' && s2.s.syl && /font-lexend/.test(s2.cls));
  await p.close();

  // 2) Kacheln + Silben + Lexend
  p = await page({ input: 'kacheln', font: 'lexend', syl: true, sayFirst: true, dir: 'de-en' });
  await p.evaluate(() => window.__vm.hyph()); await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(400);
  const t2 = await p.evaluate(() => ({ slots: [...document.querySelectorAll('#typed .slot')].map(s => s.className), tag: document.querySelector('.mon .tag').innerHTML, spoken: window.__spoken || [] }));
  ok('Kachel-Slots je Silbe markiert (fam·i·ly)', t2.slots.length === 6 && t2.slots.filter(c => /s0/.test(c)).length === 5 && t2.slots.filter(c => /s1/.test(c)).length === 1 && t2.slots.filter(c => / se/.test(c)).length === 3);
  ok('Monster-Wort (Deutsch) in Silben: Fa·mi·lie', (t2.tag.match(/class="syl/g) || []).length === 3);
  ok('Speech-first: Wort aus Spalte 1 vorgelesen', t2.spoken.includes('family'));
  await sleep(300); await shot(p, '02-kacheln-silben-lexend');
  await p.close();

  // 3) Korrekturkarte (Tippen, Lexend, Silben): falsch tippen
  p = await page({ input: 'tippen', font: 'lexend', syl: true, say: true, dir: 'de-en' });
  await p.evaluate(() => window.__vm.hyph()); await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(200);
  for (const k of 'famly') await p.keyboard.press(k); await p.keyboard.press('Enter'); await sleep(300);
  const t3 = await p.evaluate(() => ({ on: document.getElementById('fix').classList.contains('on'), wl: document.querySelectorAll('#fixYou .wl').length, leg: !document.getElementById('fixLeg').hidden, a: document.getElementById('fixA').textContent.replace(/\u00a0/g, ' '), syl: document.querySelectorAll('#fixA .syl').length, spoken: window.__spoken || [], lang: window.__spokenLang || [], title: document.getElementById('fixTitle').textContent }));
  ok('Korrekturkarte offen, falsche Buchstaben ruhig markiert + Legende', t3.on && t3.wl >= 1 && t3.leg);
  ok('Korrekturkarte: Lösung baut sich silbenweise auf (fam·i·ly)', t3.a === 'family' && t3.syl === 3);
  ok('Korrekturkarte: richtiges Wort vorgelesen (en-GB)', t3.spoken.includes('family') && t3.lang[t3.lang.length - 1] === 'en-GB');
  ok('Korrekturkarte: ermutigender Titel, kein „falsch“', !/falsch|wrong/i.test(t3.title));
  await shot(p, '03-korrekturkarte-lexend-silben');
  await p.close();

  // 3b) Korrekturkarte ohne Lese-Schrift (Pixel-Schrift), OpenDyslexic-Variante
  p = await page({ input: 'tippen', font: 'opendyslexic', syl: false, say: true, dir: 'de-en' });
  await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(200);
  for (const k of 'famly') await p.keyboard.press(k); await p.keyboard.press('Enter'); await sleep(400);
  ok('OpenDyslexic: Klasse font-od', await p.evaluate(() => document.body.classList.contains('font-od')));
  await shot(p, '04-korrekturkarte-opendyslexic');
  await p.close();

  // 4) Nur hören, dann tippen
  p = await page({ input: 'tippen', hearOnly: true, dir: 'de-en', font: 'lexend' });
  await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(300);
  const t4 = await p.evaluate(() => ({ tag: document.querySelector('.mon .tag').textContent, again: !document.getElementById('sayAgain').hidden, spoken: (window.__spoken || []).length }));
  await p.evaluate(() => document.getElementById('sayAgain').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); const sp2 = await p.evaluate(() => (window.__spoken || []).length);
  ok('Nur hören: Wort versteckt, Wiederholen-Knopf da und spricht', t4.tag === '🔊 ?' && t4.again && t4.spoken >= 1 && sp2 >= t4.spoken + 1);
  for (const k of 'family') await p.keyboard.press(k); await sleep(200);
  ok('Nur hören: richtig tippen lässt das Monster platzen', await p.evaluate(() => !window.__vm.state().mons.some(m => m.a === 'family') && window.__vm.stats()['family|familie'].right === 1));
  await p.evaluate(() => window.__vm.spawn('animal')); await sleep(200); await shot(p, '05-nur-hoeren');
  await p.close();

  // 5) Auto-Runterstufen: Wort mit 2 Fehlern → Kacheln statt Tippen; nach 2 richtigen wieder Tippen
  const st = { 'family|familie': { en: 'family', de: 'Familie', right: 0, wrong: 2, streak: 0, box: 0, due: 0, prob: true, la: 'en', lb: 'de', last: Date.now() - 1000 } };
  p = await page({ input: 'tippen', dir: 'de-en' }, st);
  await play(p); await p.evaluate(() => window.__vm.spawn('family')); await sleep(300);
  const t5 = await p.evaluate(() => ({ mode: window.__vm.state().input, m: window.__vm.state().mons[0].mode, alt: document.getElementById('alt').className, kbOff: document.getElementById('kb').classList.contains('off') }));
  ok('Runterstufen: Tippen → Kacheln für dieses Wort', t5.mode === 'kacheln' && t5.m === 'kacheln' && t5.alt === 'kacheln' && t5.kbOff);
  await shot(p, '06-runtergestuft-kacheln');
  for (const k of 'family') await p.keyboard.press(k); await sleep(200);
  ok('Runterstufen: nach dem Wort zurück zu Tippen', await p.evaluate(() => window.__vm.state().input === 'tippen' && !document.getElementById('kb').classList.contains('off')));
  await p.evaluate(() => window.__vm.spawn('family')); await sleep(100); for (const k of 'family') await p.keyboard.press(k); await sleep(200);
  await p.evaluate(() => window.__vm.spawn('family')); await sleep(100);
  ok('Runterstufen: nach 2 richtigen wieder normale Eingabe', await p.evaluate(() => window.__vm.state().mons[0].mode === 'tippen'));
  await p.close();

  // 6) Problemwort-Runde + Überblick in der Statistik
  const st6 = { 'family|familie': { ...st['family|familie'] }, 'brother|bruder': { en: 'brother', de: 'Bruder', right: 1, wrong: 1, streak: 0, box: 0, due: 0, prob: true, la: 'en', lb: 'de', lw: Date.now() } };
  p = await page({ input: 'tippen' }, st6);
  const pb = await p.evaluate(() => ({ hidden: document.getElementById('probBtn').hidden, t: document.getElementById('probBtn').textContent }));
  ok('Problemwort-Runde: Knopf mit Anzahl', !pb.hidden && /\(2\)/.test(pb.t));
  await p.click('#probBtn'); await p.waitForFunction(() => window.__vm.state()); await sleep(300);
  ok('Problemwort-Runde: läuft mit Kacheln', await p.evaluate(() => window.__vm.state().input !== 'tippen'));
  await p.click('#pauseBtn'); await p.click('#quitBtn'); await sleep(200); await p.click('[data-go="stats"]'); await sleep(200);
  ok('Überblick: heute dran / Problemwörter / diese Woche', await p.evaluate(() => /Problemwörter: 2/.test(document.getElementById('statOv').textContent) && document.querySelectorAll('#statList .dots').length === 2));
  await shot(p, '07-statistik-ueberblick');
  await p.close();

  // 6b) Ab und zu andersherum (Extra)
  p = await page({ input: 'tippen', flip: true, dir: 'de-en' });
  await play(p); await p.evaluate(() => { window.__vmRnd = () => 0.1; window.__vm.spawn('family'); }); await sleep(200);
  const f = await p.evaluate(() => window.__vm.state().mons[0]);
  for (const k of 'familie') await p.keyboard.press(k); await sleep(200);
  ok('Andersherum: Frage „family“, Antwort „Familie“ wird erkannt', f.flip && f.q === 'family' && f.a === 'Familie' && await p.evaluate(() => window.__vm.stats()['family|familie'].right === 1));
  await p.close();

  // 7) Kurze Runde
  p = await page({ input: 'tippen', session: 8 });
  await play(p); for (let i = 0; i < 8; i++) { const en = await p.evaluate(() => window.__vm.spawnNext()); const a = await p.evaluate(() => window.__vm.state().mons.at(-1).a.split('/')[0].replace(/\(.*?\)/g, '').trim()); await p.evaluate(a => { window.__vm.state(); }, a);
    for (const k of a) await p.keyboard.press(k === ' ' ? 'Space' : k).catch(() => {}); await sleep(60); await p.evaluate(() => window.__vm.clearMons()); }
  await sleep(300);
  ok('Kurze Runde: „Heute fertig“ nach 8 Wörtern', await p.evaluate(() => document.getElementById('sessDlg').classList.contains('on')));
  await shot(p, '08-kurze-runde');
  await p.close();
} catch (e) { ok('Ausnahme: ' + e.message, false); }
ok('keine JS-Fehler', !errors.length); if (errors.length) console.log(errors.join('\n'));
console.log(res.join('\n')); console.log(`${res.filter(r => r.startsWith('OK')).length} OK, ${res.filter(r => r.startsWith('FAIL')).length} FAIL`);
await b.close(); srv.kill(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
