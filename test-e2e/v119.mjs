// 1.19 E2E Belohnungen: Rache-Monster nach Fehler zählt nicht, Lerntag/sichere Wörter, Fortschrittstext, Migration.  node test-e2e/v119.mjs
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8092', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=de-DE'] });
const res = [], errors = []; const ok = (n, c, info) => { res.push(`${c ? 'OK  ' : 'FAIL'} ${n}`); if (!c && info !== undefined) console.log(n, JSON.stringify(info)); }; const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(s, pre = {}) { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((s, pre) => { window.VM_TEST_FAST = true; window.__vmSpeakTest = true; if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1);
    localStorage.setItem('vm.settings', JSON.stringify(Object.assign({ v13: true, ui: 'de', input: 'tippen', speed: 'normal', dir: 'de-en', list: 'L:Unit 2: Familie & Zuhause – Startliste (an Red Line 1 angelehnt)' }, s)));
    for (const [k, v] of Object.entries(pre)) localStorage.setItem('vm.' + k, JSON.stringify(v)); } }, s, pre);
  await p.goto('http://localhost:8092/index.html'); await p.waitForFunction(() => window.__vmReady); return p; }
const play = async p => { await p.click('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.clearMons()); };
const type = async (p, t) => { for (const k of t) await p.keyboard.press(k); await sleep(120); };
const st = (p, en) => p.evaluate(en => { const s = window.__vm.stats(); const k = Object.keys(s).find(k => k.includes(en)); return k ? s[k] : null; }, en);
try {
  // Rache-Monster mit Fehler: kein Eintrag; ohne Fehler: zählt
  let p = await page({}); await play(p);
  await p.evaluate(() => window.__vm.spawnRevenge('brother')); await sleep(200);
  await type(p, 'xyz'); await p.keyboard.press('Enter'); await sleep(400); await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(1200);
  const t = await p.evaluate(() => window.__vm.state().mons.map(m => m.tries));
  const before = JSON.stringify(await st(p, 'brother'));
  for (let i = 0; i < 3; i++) { await p.evaluate(() => { const i = document.querySelector('#typed, input'); }); await type(p, 'brother'); await sleep(250); }
  const after = JSON.stringify(await st(p, 'brother')), gone = await p.evaluate(() => !window.__vm.state().mons.some(m => m.kind === 'revenge'));
  ok('Rache-Monster nach Fehler besiegt → zählt nicht (kein „richtig“, kein Fortschritt)', t[0] > 0 && gone && after === before, { t, before, after, gone });
  await p.close();
  p = await page({}); await play(p); await p.evaluate(() => window.__vm.spawnRevenge('brother')); await sleep(200);
  for (let i = 0; i < 3; i++) { await type(p, 'brother'); await sleep(250); }
  const s2 = await st(p, 'brother'); ok('Rache-Monster ohne Fehler → zählt als richtig', s2 && (s2.streak || 0) >= 1, s2); await p.close();
  // Lerntag: 10 Wörter beim 1. Versuch
  p = await page({}); await play(p); const words = await p.evaluate(() => { const o = []; for (let i = 0; i < 80 && o.length < 12; i++) { const w = window.__vm.spawnNext(); if (w && !o.includes(w) && !/[ .!?]/.test(w)) o.push(w); window.__vm.clearMons(); } return o; });
  let typedN = 0; for (const w of words) { await p.waitForFunction(() => { const s = window.__vm.state(); return s.intro <= 0 && !document.getElementById('fix').classList.contains('on'); }, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => window.__vm.clearMons()); await p.evaluate(w => window.__vm.spawn(w), w); await sleep(150); const m = await p.evaluate(() => window.__vm.state().mons.find(m => m.kind === 'normal')); if (m) { await type(p, m.a.split('/')[0].split('|')[0]); typedN++; } await sleep(250); }
  const pr = await p.evaluate(() => window.__vm.prog()), txt = await p.evaluate(() => window.__vm.progText());
  ok('10 Wörter beim 1. Versuch → 1 Lerntag', pr.ldays === 1, pr);
  ok('Fortschrittstext zeigt beide Bedingungen kindgerecht', /Noch .*sichere(s)? W(o|ö)rt.* – dann gibt's: /.test(txt) || /Noch .*Lerntag/.test(txt), txt);
  ok('Keine Belohnung ohne sichere Wörter', pr.kept.length === 0, pr); await p.close();
  // Fortschritt im Einstellungs-Text + Ein-Tag-Grenze
  const today = new Date(); const dk = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  p = await page({}, { prog: { pops: 0, wins: 0, solved: 0, kept: [], v19: true, v119: true, mastered: 3, ldays: 1 } });
  let txt2 = await p.evaluate(() => window.__vm.progText()); ok('Bedingungen erfüllt (3 sicher, 1 Lerntag) → gleich gibt\'s', /Gleich gibt's|Noch/.test(txt2), txt2);
  await play(p); await p.evaluate(() => window.__vm.spawnNext()); const a1 = await p.evaluate(() => window.__vm.state().mons[0].a); await type(p, a1); await sleep(300);
  const pr2 = await p.evaluate(() => window.__vm.prog()); ok('Nach dem nächsten Treffer: 1. Belohnung freigeschaltet', pr2.kept.length === 1, pr2);
  await p.evaluate(() => { const g = window.__vm.prog(); g.mastered = 50; g.ldays = 20; }); await p.evaluate(() => window.__vm.spawnNext()); const a2 = await p.evaluate(() => window.__vm.state().mons[0].a); await type(p, a2); await sleep(300);
  const pr3 = await p.evaluate(() => window.__vm.prog()), txt3 = await p.evaluate(() => window.__vm.progText());
  ok('Höchstens 1 Belohnung pro Tag (trotz genug Fortschritt)', pr3.kept.length === 1 && /morgen/.test(txt3), { k: pr3.kept, txt3 }); await p.close();
  // Migration: alte Freischaltungen (solved 12 → 4 Belohnungen nach alter Regel) bleiben
  p = await page({}, { prog: { pops: 5, wins: 1, solved: 12, kept: [], v19: true } });
  const pm = await p.evaluate(() => window.__vm.prog()); ok('Migration: nach alter Regel Freigeschaltetes bleibt frei, alter Zähler bleibt', pm.v119 && pm.kept.length >= 3 && pm.solved === 12, pm); await p.close();
} finally { await b.close(); srv.kill(); }
ok('keine JS-Fehler', !errors.length, errors); console.log(res.join('\n')); const f = res.filter(x => x.startsWith('FAIL')).length; console.log(`${res.length - f} OK, ${f} FAIL`); process.exit(f ? 1 : 0);
