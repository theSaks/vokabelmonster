// 1.11 Abschluss-Prüfung (headless): Sprachausgabe, alle Eingabearten × Tempos, Sprachen, Sonderfälle, Reset, Krit, Belohnungen
//   npm run web && node test-e2e/sweep.mjs     (CHROME=/pfad/zu/chrome)
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8097', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=de-DE', '--autoplay-policy=no-user-gesture-required'] });
const res = []; const errors = []; const ok = (n, c, info) => res.push(`${c ? 'OK  ' : 'FAIL'} ${n}${!c && info !== undefined ? '  → ' + JSON.stringify(info).slice(0, 300) : ''}`); const sleep = ms => new Promise(r => setTimeout(r, ms));
const FILE = '# Sweep\n## Edge\ncat;Katze\nice cream;Eis\nthe United Kingdom of Great Britain and Northern Ireland;Vereinigtes Königreich\nWhat is your name?;Wie heißt du?\nto go;gehen\n'
  + '## Matrix\ncat;Katze\nice cream;Eis\nWhat is your name?;Wie heißt du?\nto go;gehen\nyellow;gelb\n## Einzeln\ndog;Hund\n## Leer\n## Deutsch [de-en]\nMädchen;girl\nFußball;football\nÜbung;exercise\n## Chinesisch [zh-de]\n猫|māo;Katze\n你好|nǐ hǎo;hallo\n大|dà;groß\n';
const dialogs = [];
async function page({ lang = 'de-DE', native = false, voices = null, settings = {}, fresh = true, virgin = false, web = null, ctx } = {}) {
  ctx = ctx || await b.createBrowserContext(); const p = await ctx.newPage();
  await p.emulate({ viewport: { width: 1280, height: 800, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Tab) AppleWebKit/537.36 Chrome/129 Safari/537.36' });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await p.evaluateOnNewDocument((lang, native, voices, settings, fresh, FILE, virgin, web) => {
    window.VM_TEST_FAST = true; Object.defineProperty(navigator, 'language', { get: () => lang }); Object.defineProperty(navigator, 'languages', { get: () => [lang] });
    delete window.showOpenFilePicker; try { Object.defineProperty(window, 'showOpenFilePicker', { value: undefined }); } catch {}
    if (virgin && !sessionStorage.getItem('init')) { localStorage.clear(); sessionStorage.setItem('init', '1'); }
    else if (fresh && !sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('vm.vocab', FILE); localStorage.setItem('vm.vocabSynced', '1');
      localStorage.setItem('vm.settings', JSON.stringify(Object.assign({ v13: true, list: 'L:Edge', dir: 'de-en' }, settings))); sessionStorage.setItem('init', '1'); }
    // Audio-Elemente protokollieren: seit 1.12 darf keins mehr abgespielt werden (nur Systemstimme)
    const AP = HTMLMediaElement.prototype.play; window.__plays = [];
    HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); return AP.call(this).then(() => { window.__playOk = (window.__playOk || 0) + 1; }); };
    if (native) { // wie auf dem Tablet: Native-Bridge da, aber kein @capacitor/core → Capacitor.Plugins ohne TextToSpeech; WebView ohne Web Speech
      try { delete window.speechSynthesis; Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch {}
      window.__native = [];
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {}, nativePromise: (pl, m, o) => { window.__native.push([pl, m, o]);
        if (pl === 'TextToSpeech' && m === 'getSupportedVoices') return Promise.resolve({ voices: voices || [] }); if (pl === 'TextToSpeech') return Promise.resolve({});
        if (pl === 'Filesystem') { const fs = JSON.parse(sessionStorage.getItem('fs') || '{}'), k = o.directory + '/' + o.path;
          if (m === 'requestPermissions') return Promise.resolve({ publicStorage: 'granted' });
          if (m === 'readFile' || m === 'stat') return k in fs ? Promise.resolve(m === 'readFile' ? { data: fs[k] } : { type: 'file' }) : Promise.reject(new Error('File does not exist'));
          if (m === 'writeFile') { fs[k] = o.data; sessionStorage.setItem('fs', JSON.stringify(fs)); return Promise.resolve({ uri: k }); } }
        return Promise.reject(new Error('not implemented')); } };
    }
    if (web) { // Edge/Windows-Nachbau: getVoices() erst leer, Stimmen kommen per 'voiceschanged' nach web.delay ms
      const et = new EventTarget(); let list = []; window.__webSpoken = [];
      const ss = { getVoices: () => list, speaking: false, pending: false, paused: false, cancel() { window.__webCancel = (window.__webCancel || 0) + 1; }, resume() {},
        speak(u) { window.__webSpoken.push({ text: u.text, lang: u.lang, voice: u.voice ? u.voice.name : null }); if (u.voice && u.voice.localService === false && web.offline) setTimeout(() => u.onerror && u.onerror({ error: 'network' }), 5); },
        addEventListener: (t, f) => et.addEventListener(t, f), removeEventListener: (t, f) => et.removeEventListener(t, f) };
      Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; this.voice = null; this.rate = 1; this.volume = 1; };
      setTimeout(() => { list = web.voices; et.dispatchEvent(new Event('voiceschanged')); }, web.delay || 0);
    }
  }, lang, native, voices, settings, fresh, FILE, virgin, web);
  await p.goto('http://localhost:8097/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady, { timeout: 8000 }); return p;
}
const st = p => p.evaluate(() => window.__vm.state());
const vis = (p, id) => p.$eval('#' + id, e => e.classList.contains('on'));
const setS = (p, s) => p.evaluate(s => { const o = JSON.parse(localStorage.getItem('vm.settings') || '{}'); Object.assign(o, s); localStorage.setItem('vm.settings', JSON.stringify(o)); }, s);
async function start(p) { await p.evaluate(() => document.getElementById('playBtn').click()); await p.waitForFunction(() => window.__vm.state() && window.__vm.state().mons.length > 0 && !window.__vm.state().intro, { timeout: 8000 }); await sleep(100); }
async function waitMon(p, ms = 6000) { try { await p.waitForFunction(() => { const s = window.__vm.state(); return s && s.mons.length && !s.intro && !s.hold; }, { timeout: ms }); } catch {} await sleep(80); }
const tapSel = async (p, sel) => { for (let k = 0; k < 3; k++) { try { await p.tap(sel); return; } catch (e) { if (!/detached|No node|No element/.test(e.message)) throw e; await sleep(40); } } };
const mainA = a => a.split(/[\/;]/)[0].replace(/\([^)]*\)/g, '').trim();
// eine Antwort richtig geben, je nach Eingabeart
async function solve(p) {
  const s = await st(p); if (!s || !s.mons.length) return false; const before = s.score;
  if (s.input === 'tippen') { const m = s.mons[0]; let a = mainA(m.a); if (a.includes('|')) a = a.split('|')[1];
    a = a.normalize('NFD').replace(/[\u0300-\u036f]/g, (c, i) => /[aou]/i.test(a.normalize('NFD')[i - 1]) && c === '\u0308' ? c : '').normalize('NFC'); // Pinyin-Töne weg, Umlaute bleiben
    for (const ch of a.toLowerCase()) { if (/[?!.,]/.test(ch)) continue; const sel = ch === ' ' ? '[data-k="␣"]' : `[data-k="${ch}"]`; if (await p.$(sel)) await p.tap(sel); else await p.keyboard.type(ch); }
    if (await p.$('[data-k="✔"]')) await p.tap('[data-k="✔"]'); else await p.keyboard.press('Enter'); }
  else if (s.input === 'mc') { for (let i = 0; i < s.alt.length; i++) if (await p.evaluate((o, ms) => ms.some(m => window.VM.isMatch(o, m.a)), s.alt[i], s.mons)) { await tapSel(p, `#alt .opt[data-i="${i}"]`); break; } }
  else { let w = s.tileWord; for (const ch of [...w]) { const cw = (await st(p)).tileWord; if (cw !== w) { if ((await st(p)).typed) break; return solve(p); } if (ch === ' ' || /[?!.,]/.test(ch)) continue; const cur = await st(p); const used = await p.$$eval('#alt .tile', bs => bs.map(x => x.classList.contains('used')));
      const i = cur.alt.findIndex((c, k) => c === ch && !used[k]); if (i < 0) break; await tapSel(p, `#alt .tile[data-i="${i}"]`); } }
  await sleep(120); const s2 = await st(p); return !!s2 && s2.score > before;
}
process.on('uncaughtException', e => { console.log(res.join('\n')); console.log('ABBRUCH', e.stack, errors); srv.kill(); process.exit(1); });
process.on('unhandledRejection', e => { console.log(res.join('\n')); console.log('ABBRUCH', e && e.stack, errors); srv.kill(); process.exit(1); });

// ===== 1) Sprachausgabe: Systemstimme nach richtiger Antwort =====
let p = await page({ settings: { speed: 'ohne', input: 'tippen' } });
ok('[1.12] keine vorab erzeugten Aufnahmen mehr', await p.evaluate(() => !window.VM_AUDIO));
await p.evaluate(() => { window.__vmSpeakTest = true; /* Browser-Stimme simulieren (headless hat keine) */ });
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); }); await sleep(300);
ok('[1.11] richtige Antwort „cat“ gelöst', await solve(p)); await sleep(500);
ok('[1.17] richtige Antwort → kein Nachsprechen', !(await p.evaluate(() => window.__spoken || [])).includes('cat'));
await p.evaluate(en => { window.__vm.clearMons(); if (en) window.__vm.spawn(en); else window.__vm.spawnNext(); window.__vm.showFix('', 'x'); }, 'cat'); await sleep(400); await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(100);
let sp = await p.evaluate(() => ({ plays: window.__plays, spoken: window.__spoken, lang: window.__spokenLang, via: window.__speechVia }));
ok('[1.12] Browser: Korrekturkarte → Systemstimme (Web Speech, en-GB), kein Audio-Element', !sp.plays.length && sp.spoken.includes('cat') && sp.lang.includes('en-GB') && sp.via === 'webspeech', sp);
// Schalter aus
await p.keyboard.press('Escape'); await sleep(100); await p.evaluate(() => document.getElementById('quitBtn').click()); await sleep(200);
await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(150);
ok('[1.11] Schalter „Sprachausgabe“ sichtbar + an', await p.$eval('#speechChk', e => e.checked && e.offsetParent !== null));
const info = await p.$eval('#speechInfo', e => e.textContent); ok('[1.12] Info-Zeile nennt Systemstimme', /Systemstimme: Browser-Stimme/.test(info), info);
await p.evaluate(() => { window.__plays = []; document.getElementById('speechTest').click(); }); await sleep(300);
ok('[1.11] 🔊 Test spricht', (await p.evaluate(() => window.__spoken.slice(-1)[0])) === 'Hello! Well done.');
await p.$eval('#speechChk', e => e.click()); await p.evaluate(() => document.getElementById('saveSet').click()); await sleep(150);
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); window.__plays = []; window.__spoken = []; }); await sleep(300);
await solve(p); await sleep(400); sp = await p.evaluate(() => ({ plays: window.__plays, spoken: window.__spoken }));
ok('[1.11] Sprachausgabe aus → nichts gesprochen', !sp.plays.length && !sp.spoken.length, sp);
ok('[1.11] Einstellung bleibt gespeichert', await p.evaluate(() => JSON.parse(localStorage.getItem('vm.settings')).speech === false));
await p.browserContext().close();

// ===== 2) Android-Fall: Bridge ohne @capacitor/core, keine Web Speech =====
p = await page({ native: true, settings: { speed: 'ohne', input: 'tippen', list: 'L:Chinesisch', dir: 'de-en' },
  voices: [{ name: 'en-gb-x-rjs-local', lang: 'en-GB' }, { name: 'en-gb-x-gba-local', lang: 'en-GB' }, { name: 'zh-CN-language', lang: 'zh-CN' }, { name: 'cmn-cn-x-ccc-local', lang: 'zh-CN' }] });
await sleep(300); await start(p); await p.evaluate(() => { window.__native = window.__native.filter(x => x[1] !== 'getSupportedVoices'); });
const s0 = await st(p); ok('[1.11] Android: zh-de-Liste läuft, Tippen mit Pinyin', s0.input === 'tippen', s0);
ok('[1.11] Android: Chinesisch richtig gelöst', await solve(p)); await sleep(400);
ok('[1.17] Android: nach Treffer kein speak', !(await p.evaluate(() => window.__native.some(x => x[1] === 'speak'))));
await p.evaluate(en => { window.__vm.clearMons(); if (en) window.__vm.spawn(en); else window.__vm.spawnNext(); window.__vm.showFix('', 'x'); }, null); await sleep(400); await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(100);
let nat = await p.evaluate(() => window.__native.filter(x => x[0] === 'TextToSpeech' && x[1] === 'speak'));
ok('[1.11] Android: Fallback über Native-Bridge (TextToSpeech.speak, zh-CN)', nat.length === 1 && nat[0][2].lang === 'zh-CN' && nat[0][2].voice === 3, nat);
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('vm.settings')); s.list = 'L:Edge'; localStorage.setItem('vm.settings', JSON.stringify(s)); }); await p.reload(); await p.waitForFunction(() => window.__vmReady);
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('to go'); window.__native = []; window.__plays = []; }); await sleep(200);
await solve(p); await sleep(400); ok('[1.17] Android: „to go“ gelöst, still', !(await p.evaluate(() => window.__native.some(x => x[1] === 'speak')))); await p.evaluate(en => { window.__vm.clearMons(); if (en) window.__vm.spawn(en); else window.__vm.spawnNext(); window.__vm.showFix('', 'x'); }, 'to go'); await sleep(400); await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(100); nat = await p.evaluate(() => ({ n: window.__native.filter(x => x[1] === 'speak'), plays: window.__plays }));
ok('[1.12] Android: „to go“ → TTS en-GB mit weiblicher Stimme (gba), kein Audio', !nat.plays.length && nat.n.length === 1 && nat.n[0][2].lang === 'en-GB' && nat.n[0][2].voice === 1 && nat.n[0][2].text === 'to go', nat);
await p.evaluate(() => { window.__vm.clearMons(); window.__native = []; }); await p.evaluate(en => { window.__vm.clearMons(); if (en) window.__vm.spawn(en); else window.__vm.spawnNext(); window.__vm.showFix('', 'x'); }, 'the United Kingdom of Great Britain and Northern Ireland'); await sleep(400); await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(100);
nat = await p.evaluate(() => window.__native.filter(x => x[1] === 'speak'));
ok('[1.11] Android: langer Satz → TTS en-GB mit weiblicher Stimme (gba)', nat.length === 1 && nat[0][2].lang === 'en-GB' && nat[0][2].voice === 1, nat);
await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('quitBtn').click()); await sleep(100); await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(100);
const fsNow = await p.evaluate(() => JSON.parse(sessionStorage.getItem('fs') || '{}'));
ok('[1.11] Android: Vokabeln landen über die Bridge in Dokumente/VokabelMonster/vokabeln.txt (lokale Liste übernommen)', /cat;Katze/.test(fsNow['DOCUMENTS/VokabelMonster/vokabeln.txt'] || ''), Object.keys(fsNow));
ok('[1.11] Android: Datei-Label Dokumente', /Dokumente|Documents/.test(await p.evaluate(() => window.VMStore.label)), await p.evaluate(() => window.VMStore.label));
const ninfo = await p.$eval('#speechInfo', e => e.textContent);
ok('[1.11] Android: Sprach-Optionen sichtbar (bis 1.10 versteckt), Info nennt Android + gewählte Stimme', await p.$eval('#sayRow', e => !e.hidden) && /Android/.test(ninfo) && /en-gb-x-gba-local/.test(ninfo), ninfo);
await p.browserContext().close();

// ===== 2b) Windows/Edge (file://, Web Speech) =====
const DEV = [{ name: 'Microsoft Hedda - German (Germany)', lang: 'de-DE', localService: true }, { name: 'Microsoft Katja - German (Germany)', lang: 'de-DE', localService: true }];
const ONL = [{ name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false }, { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false }];
// a) Stimmen kommen erst 1,5 s nach dem Start (getVoices anfangs leer)
p = await page({ settings: { speed: 'ohne', input: 'tippen' }, web: { voices: [...DEV, ...ONL], delay: 1500 } });
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); window.__vm.showFix('', 'x'); /* 1.17: Treffer still → Korrekturkarte spricht */ }); await sleep(150); await sleep(200);
let ws = await p.evaluate(() => window.__webSpoken);
ok('[1.13] Edge: getVoices() noch leer → trotzdem gesprochen (Standardstimme, en-GB)', ws.length === 1 && ws[0].text === 'cat' && ws[0].lang === 'en-GB', ws);
await sleep(1500); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('to go'); window.__vm.showFix('', 'x'); /* 1.17: Treffer still → Korrekturkarte spricht */ }); await sleep(150); await sleep(200);
ws = await p.evaluate(() => window.__webSpoken);
ok('[1.13] Edge: nach voiceschanged → weibliche englische Stimme (Sonia)', ws.length === 2 && /Sonia/.test(ws[1].voice || '') && ws[1].lang === 'en-GB', ws);
await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('quitBtn').click()); await sleep(100); await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(100);
let wi = await p.$eval('#speechInfo', e => e.textContent); ok('[1.13] Edge: Info-Zeile zeigt Sonia (online)', /Englisch: Microsoft Sonia Online.*\(online\)/.test(wi), wi);
await p.browserContext().close();
// b) deutsches Windows, offline: nur deutsche lokale + englische Online-Stimmen; Online schlägt fehl → einmal Standardstimme
p = await page({ settings: { speed: 'ohne', input: 'tippen' }, web: { voices: [...DEV, ...ONL], delay: 0, offline: true } }); await sleep(400);
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); window.__vm.showFix('', 'x'); /* 1.17: Treffer still → Korrekturkarte spricht */ }); await sleep(150); await sleep(300);
ws = await p.evaluate(() => window.__webSpoken);
ok('[1.13] Edge offline: Online-Stimme scheitert → Wiederholung mit Standardstimme (en-GB)', ws.length === 2 && /Online/.test(ws[0].voice) && ws[1].voice === null && ws[1].lang === 'en-GB', ws);
await p.browserContext().close();
// c) nur deutsche Stimmen
p = await page({ settings: { speed: 'ohne', input: 'tippen' }, web: { voices: DEV, delay: 0 } }); await sleep(400);
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); window.__vm.showFix('', 'x'); /* 1.17: Treffer still → Korrekturkarte spricht */ }); await sleep(150); await sleep(200);
ws = await p.evaluate(() => window.__webSpoken);
ok('[1.13] nur deutsche Stimmen: kein deutsches Voice für Englisch, Standardstimme mit lang en-GB', ws.length === 1 && ws[0].voice === null && ws[0].lang === 'en-GB', ws);
await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('quitBtn').click()); await sleep(100); await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(100);
wi = await p.$eval('#speechInfo', e => e.textContent); ok('[1.13] Info-Zeile warnt: keine englische Stimme', /keine englische Stimme/.test(wi), wi);
await p.evaluate(() => { window.__webSpoken = []; document.getElementById('speechTest').click(); }); await sleep(100);
ok('[1.13] 🔊 Test spricht auch hier', (await p.evaluate(() => window.__webSpoken.length)) === 1);
await p.browserContext().close();
// d) Erststart: nichts gespeichert → erste Liste gewählt, Spielen startet (vorher „Diese Liste ist leer“)
p = await page({ virgin: true }); dialogs.length = 0;
const firstSel = await p.$eval('#listSel', e => ({ v: e.value, i: e.selectedIndex }));
await p.evaluate(() => document.getElementById('playBtn').click()); await sleep(600);
ok('[1.13] Erststart: erste Liste gewählt + Spiel startet ohne „leer“-Meldung', firstSel.i === 0 && /^L:/.test(firstSel.v) && !!(await st(p)) && !dialogs.some(d => /leer/i.test(d)), { firstSel, dialogs });
ok('[1.13] Erststart: Auswahl gemerkt', await p.evaluate(v => JSON.parse(localStorage.getItem('vm.settings') || '{}').list === v, firstSel.v));
await p.browserContext().close();
p = await page({ settings: { list: 'L:Gibt es nicht mehr' } }); dialogs.length = 0; await p.evaluate(() => document.getElementById('playBtn').click()); await sleep(600);
ok('[1.13] gespeicherte, gelöschte Liste → erste Liste statt „leer“', !!(await st(p)) && !dialogs.length, dialogs); await p.browserContext().close();

// ===== 2c) 1.14 Regression: „Wörter sicher“ steigt über mehrere Spiele (vorher immer 0 / n) =====
p = await page({ settings: { list: 'L:Matrix', speed: 'ohne', input: 'tippen' } });
const mast = async sel => (await p.$eval(sel, e => e.textContent)).match(/(\d+) \/ (\d+)/).slice(1).map(Number);
const ms0 = await mast('#homeMastery'); const msSeen = [ms0[0]];
for (let g = 0; g < 3; g++) {
  await start(p);
  for (const w of ['cat', 'ice cream', 'to go']) { await p.evaluate(w => { window.__vm.clearMons(); window.__vm.spawn(w); }, w); await sleep(120); await solve(p); await sleep(120); }
  if (g < 2) { await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('quitBtn').click()); await sleep(150); msSeen.push((await mast('#homeMastery'))[0]); }
  else { await p.evaluate(() => window.__vm.endNow(10)); await sleep(250); if (await vis(p, 'nameDlg')) { await p.evaluate(() => document.getElementById('nameOk').click()); await sleep(100); }
    msSeen.push((await mast('#overMastery'))[0]); await p.evaluate(() => document.querySelector('#over [data-go="home"]').click()); await sleep(150); }
}
ok('[1.14] „Wörter sicher“: 3 Spiele mit je 3 richtigen Wörtern → 0, 0, 0, 3 (von 5)', JSON.stringify(msSeen) === '[0,0,0,3]' && ms0[1] === 5, msSeen);
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__vmReady); await sleep(200);
ok('[1.14] „Wörter sicher“ nach Neustart gespeichert (3 / 5)', JSON.stringify(await mast('#homeMastery')) === '[3,5]', await mast('#homeMastery'));
await p.browserContext().close();

// ===== 2d) 1.15 Wortauswahl im Spiel: Topf-Auswahl + keine Wiederholung der letzten Wörter =====
p = await page({ settings: { list: 'L:Matrix', speed: 'ohne', input: 'tippen' } }); await start(p);
const picks = await p.evaluate(() => { let s = 11; window.__vmRnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); const out = [];
  for (let i = 0; i < 12; i++) { window.__vm.clearMons(); out.push(window.__vm.spawnNext()); } window.__vmRnd = null; return out; });
const noRep = picks.every((w, i) => i < 2 || (w !== picks[i - 1] && w !== picks[i - 2]));
ok('[1.15] Spiel: alle 5 Wörter der Liste innerhalb von 12 Monstern, keine Wiederholung der letzten 2', new Set(picks).size === 5 && noRep && !picks.includes(null), picks);
await p.browserContext().close();

// ===== 3) Alle Eingabearten × Tempos =====
for (const input of ['tippen', 'kacheln', 'mc']) for (const speed of ['ohne', 'sehrlangsam', 'langsam', 'normal', 'schnell', 'challenger']) {
  p = await page({ settings: { speed, input, list: 'L:Matrix' } }); await start(p); let n = 0;
  for (let k = 0; k < 3; k++) { await waitMon(p); if (await solve(p)) n++; if (await vis(p, 'fix')) await p.evaluate(() => document.getElementById('fixBtn').click()); }
  const s = await st(p); ok(`[sweep] ${input} × ${speed}: 3 Antworten richtig`, n === 3, { n, s: s && { lives: s.lives, mons: s.mons, alt: s.alt, tileWord: s.tileWord } });
  await p.browserContext().close();
}
// Langes Wort / Satz mit Leerzeichen / Fragezeichen in allen Eingabearten
for (const input of ['tippen', 'kacheln', 'mc']) for (const w of ['the United Kingdom of Great Britain and Northern Ireland', 'What is your name?']) {
  p = await page({ settings: { speed: 'ohne', input } }); await start(p); await p.evaluate(w => { window.__vm.clearMons(); window.__vm.spawn(w); }, w); await sleep(300);
  ok(`[sweep] ${input}: „${w.slice(0, 22)}…“ lösbar`, await solve(p), await st(p)); await p.browserContext().close();
}
// Umlaute/ß als Antwort (Englisch → Deutsch)
for (const input of ['tippen', 'kacheln']) { p = await page({ settings: { speed: 'ohne', input, list: 'L:Deutsch', dir: 'de-en' } }); await start(p); let n = 0;
  for (let k = 0; k < 3; k++) { await waitMon(p); if (await solve(p)) n++; }
  ok(`[sweep] Umlaute/ß (${input}): 3 richtig`, n === 3, await st(p)); await p.browserContext().close(); }
// Einzelnes Wort, leere Liste
p = await page({ settings: { speed: 'ohne', input: 'mc', list: 'L:Einzeln' } }); await start(p);
ok('[sweep] Liste mit 1 Wort: MC hat Auswahl', (await st(p)).alt.length >= 2, await st(p)); ok('[sweep] 1 Wort lösbar', await solve(p)); await p.browserContext().close();
p = await page({ settings: { list: 'L:Leer' } }); dialogs.length = 0; await p.evaluate(() => document.getElementById('playBtn').click()); await sleep(500);
ok('[sweep] leere Liste: Hinweis, kein Spielstart, kein Absturz', !(await st(p)) && dialogs.some(d => /leer/i.test(d)), dialogs); await p.browserContext().close();

// ===== 4) Sprachen =====
for (const [lang, play] of [['de-DE', '▶ Spielen'], ['en-US', '▶ Play'], ['zh-CN', '▶ 开始']]) { p = await page({ lang });
  const t = await p.$eval('#playBtn', e => e.textContent); ok(`[sweep] Oberfläche ${lang}`, t.includes(play.slice(2)), t);
  await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(100);
  const miss = await p.evaluate(() => [...document.querySelectorAll('#settings [data-i18n]')].filter(e => !e.textContent.trim() || /^[a-z][A-Za-z]+$/.test(e.textContent.trim())).map(e => e.dataset.i18n));
  ok(`[sweep] Einstellungen ${lang}: alle Texte übersetzt`, !miss.length, miss); await p.browserContext().close(); }

// ===== 5) Editor + Speichern + Neustart =====
p = await page({}); await p.evaluate(() => document.querySelector('[data-go="lists"]').click()); await sleep(200);
const ed = await p.evaluate(() => { const i = document.querySelector('#edRows input'); return !!i; }); ok('[sweep] Editor öffnet', ed);
await p.evaluate(() => { const i = document.querySelector('#edRows input'); i.value = 'kitten'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(100);
await p.evaluate(() => document.getElementById('saveBtn').click()); await sleep(300); await p.reload(); await p.waitForFunction(() => window.__vmReady);
ok('[sweep] Editor: Änderung übersteht Neustart', /kitten;Katze/.test(await p.evaluate(() => localStorage.getItem('vm.vocab'))));
await p.browserContext().close();

// ===== 6) Highscores je Liste/Modus, Reset, Krit, Belohnungen =====
p = await page({ settings: { speed: 'ohne', input: 'tippen' } }); await start(p); await solve(p);
await p.evaluate(() => window.__vm.endNow(1234)); await sleep(200); if (await vis(p, 'nameDlg')) { await p.evaluate(() => document.getElementById('nameOk').click()); await sleep(100); }
let hs = await p.evaluate(() => window.__vm.hs()); ok('[sweep] Highscore unter L:Edge|tippen', hs['L:Edge|tippen'] && hs['L:Edge|tippen'][0].score === 1234, hs);
// Problemwort lösen → Belohnung
await p.evaluate(() => document.querySelector('#over [data-go="home"]').click()); await sleep(100);
await start(p); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); }); await sleep(200);
for (const c of 'cag') await p.tap(`[data-k="${c}"]`); await p.tap('[data-k="✔"]'); await sleep(200); if (await vis(p, 'fix')) await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(200);
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('cat'); }); await sleep(200); await solve(p); await sleep(200);
ok('[sweep] Problemwort gelöst → Zähler 1, Laser Grün frei', await p.evaluate(() => window.__vm.prog().solved === 1), await p.evaluate(() => window.__vm.prog()));
// Krit
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('to go'); }); await sleep(1500); await solve(p);
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('to go'); }); await sleep(150); const sc = (await st(p)).score; await solve(p); await sleep(100);
ok('[sweep] Krit: 2. Mal deutlich schneller → KRITISCH!-Banner', await p.evaluate(() => !!document.querySelector('.critban')), { sc, now: (await st(p)).score });
// Glückstreffer am Tempo-Limit (Zufall injiziert)
await sleep(1500); await p.evaluate(() => document.querySelectorAll('.critban').forEach(e => e.remove()));
await p.evaluate(() => { const k = window.VM.wkey({ en: 'yellow', de: 'gelb' }); window.__vm.times()[k + '#tippen'] = { last: 50, best: 50, n: 3 }; });
await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('to go'); }); await sleep(100);
await p.evaluate(() => { const k = window.VM.wkey({ en: 'to go', de: 'gehen' }), t = window.__vm.times()[k + '#tippen']; t.best = 100000; t.last = 1; window.__vmRnd = () => 0.99; }); await sleep(100); await solve(p);
ok('[1.12] am Limit, Zufall 0,99 → kein Krit', await p.evaluate(() => !document.querySelector('.critban')));
await sleep(1500); await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('to go'); }); await sleep(100);
await p.evaluate(() => { const k = window.VM.wkey({ en: 'to go', de: 'gehen' }), t = window.__vm.times()[k + '#tippen']; t.best = 100000; t.last = 1; window.__vmRnd = () => 0.05; }); await sleep(100); const scL = (await st(p)).score; await solve(p);
const luck = await p.evaluate(() => { const b = document.querySelector('.critban'); return b && { t: b.textContent, lucky: b.classList.contains('lucky') }; });
ok('[1.12] am Limit, Zufall 0,05 → GLÜCKSTREFFER! (+50 %)', luck && luck.lucky && /GLÜCKSTREFFER!/.test(luck.t), { luck, scL, now: (await st(p)).score });
await p.evaluate(() => { delete window.__vmRnd; });
// Endboss / Sieg
await p.evaluate(() => window.__vm.finalNow()); await sleep(1600); let fb = (await st(p)).mons.find(m => m.kind === 'final');
ok('[sweep] Endboss erscheint', !!fb, await st(p)); for (let k = 0; k < 8 && fb; k++) { await waitMon(p); await solve(p); await sleep(150); if (await vis(p, 'win')) break; fb = ((await st(p)) || { mons: [] }).mons.find(m => m.kind === 'final'); }
ok('[sweep] Endboss besiegt → Siegerbildschirm', await vis(p, 'win'));
await p.evaluate(() => document.getElementById('winEndless') && document.getElementById('winEndless').click()); await sleep(100);
await p.keyboard.press('Escape'); await p.evaluate(() => document.getElementById('quitBtn').click()); await sleep(200);
// Nur Belohnungen zurücksetzen
await p.evaluate(() => { const pr = window.__vm.prog(); pr.solved = 12; pr.kept = ['gold']; localStorage.setItem('vm.prog', JSON.stringify(pr)); });
await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(100);
await p.evaluate(() => document.getElementById('resetRewBtn').click()); await sleep(100);
const rdlg = await p.$eval('#resetRewDlg', e => e.classList.contains('on') && e.textContent); ok('[1.12] „Nur Belohnungen zurücksetzen“: Bestätigung', /Highscores bleiben/.test(rdlg || ''), rdlg);
const tBefore = await p.evaluate(() => JSON.stringify([window.__vm.times(), window.__vm.stats(), window.__vm.hs(), localStorage.getItem('vm.vocab')]));
await p.evaluate(() => document.getElementById('resetRewYes').click()); await sleep(150);
const rr = await p.evaluate(() => ({ prog: window.__vm.prog(), keep: JSON.stringify([window.__vm.times(), window.__vm.stats(), window.__vm.hs(), localStorage.getItem('vm.vocab')]), lz: [...document.querySelectorAll('#laserSel option')].map(o => o.disabled), set: JSON.parse(localStorage.getItem('vm.settings')) }));
ok('[1.12] Belohnungen gesperrt, Zähler 0, Held/Laser Standard; Zeiten/Statistik/Highscores/Listen unverändert', rr.prog.solved === 0 && !rr.prog.kept.length && rr.lz.slice(1).every(Boolean) && rr.set.skin === 'hero' && rr.set.laser === 'red' && rr.keep === tBefore, rr);
await p.evaluate(() => document.getElementById('saveSet').click()); await sleep(100);
// Reset
await p.evaluate(() => document.querySelector('[data-go="settings"]').click()); await sleep(100); await p.evaluate(() => document.getElementById('resetAllBtn').click()); await sleep(100);
await p.evaluate(() => document.getElementById('resetYes').click()); await sleep(200);
const after = await p.evaluate(() => ({ prog: window.__vm.prog(), times: window.__vm.times(), stats: window.__vm.stats(), hs: window.__vm.hs(), vocab: localStorage.getItem('vm.vocab') }));
ok('[sweep] Reset: Fortschritt/Zeiten/Statistik leer, Highscores + Vokabeln bleiben', after.prog.solved === 0 && !Object.keys(after.times).length && !Object.keys(after.stats).length && after.hs['L:Edge|tippen'] && /cat;Katze/.test(after.vocab), after);
await p.browserContext().close();

console.log(res.join('\n')); console.log(errors.length ? 'FEHLER: ' + JSON.stringify(errors) : 'OK   keine JS-/Konsolenfehler');
console.log(`${res.filter(r => r.startsWith('OK')).length} OK, ${res.filter(r => r.startsWith('FAIL')).length} FAIL`);
await b.close(); srv.kill(); process.exit(0);
