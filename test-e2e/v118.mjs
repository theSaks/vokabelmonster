// 1.18 E2E Grafik: große Monster, Ziel obenauf, Text lesbar/sichtbar, PLOPP + Jubel, ruhiger Modus, Eingabe, Ergebnis.  node test-e2e/v118.mjs
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8093', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=de-DE'] });
const res = [], errors = []; const ok = (n, c, info) => { res.push(`${c ? 'OK  ' : 'FAIL'} ${n}`); if (!c && info !== undefined) console.log(n, JSON.stringify(info)); }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, DESK = { width: 1280, height: 800 };
async function page(s, { vp = PHONE, rm = false } = {}) { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport(vp); p.on('pageerror', e => errors.push(e.message));
  if (rm) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument(s => { window.VM_TEST_FAST = true; window.__vmSpeakTest = true; if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1);
    localStorage.setItem('vm.settings', JSON.stringify(Object.assign({ v13: true, ui: 'de', input: 'tippen', speed: 'normal', dir: 'de-en', list: 'L:Unit 2: Familie & Zuhause – Startliste (an Red Line 1 angelehnt)' }, s))); } }, s);
  await p.goto('http://localhost:8093/index.html'); await p.waitForFunction(() => window.__vmReady); return p; }
const play = async p => { await p.click('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.clearMons()); };
const spawn3 = (p, x = null) => p.evaluate(x => { const mr = Math.random; let i = 0; Math.random = () => x ?? [0.05, 0.5, 0.95][i++ % 3]; ['bathroom', 'brother', 'grandma/grandmother'].forEach(w => window.__vm.spawn(w)); Math.random = mr; window.__vm.setSpeedFactor(0.02); }, x);
const anim = (p, sel, pseudo = null) => p.evaluate((sel, ps) => getComputedStyle(document.querySelector(sel), ps).animationName, sel, pseudo);
try {
  for (const [vn, vp, min] of [['Handy', PHONE, 110], ['Desktop', DESK, 170]]) {
    let p = await page({}, { vp }); await play(p); await spawn3(p, 0.5); await sleep(300);
    for (const k of 'br') await p.keyboard.press(k); await sleep(150);
    const r = await p.evaluate(() => { const a = document.getElementById('arena').getBoundingClientRect(), t = document.querySelector('.mon.target'), tr = t.querySelector('.tag').getBoundingClientRect(), e = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
      return { face: document.querySelector('.mon .face').offsetWidth, q: t.querySelector('.tag').textContent, vis: !!(e && t.contains(e)), fs: parseFloat(getComputedStyle(t.querySelector('.tag')).fontSize), ff: getComputedStyle(t.querySelector('.tag')).fontFamily,
        inside: [...document.querySelectorAll('.mon .tag')].every(x => { const b = x.getBoundingClientRect(); return b.left >= a.left - 1 && b.right <= a.right + 1 && b.bottom <= a.bottom + 1; }) }; });
    ok(`${vn}: Monster groß (Gesicht ${Math.round(r.face)} px ≥ ${min})`, r.face >= min, r);
    ok(`${vn}: 3 Monster übereinander – Ziel „Bruder“ liegt obenauf (nicht verdeckt)`, r.q === 'Bruder' && r.vis, r);
    ok(`${vn}: Vokabel lesbar – Lexend, ≥ 18 px, alle Wörter in der Arena`, /Lexend/.test(r.ff) && r.fs >= 18 && r.inside, r);
    await p.close();
    p = await page({}, { vp }); await play(p); await spawn3(p); await sleep(300);
    const r2 = await p.evaluate(() => { const a = document.getElementById('arena').getBoundingClientRect(); return [...document.querySelectorAll('.mon .tag')].map(x => { const b = x.getBoundingClientRect(); return [Math.round(b.left - a.left), Math.round(a.right - b.right)]; }); });
    ok(`${vn}: Rand-Monster (links/rechts) mit großen Sprites ganz sichtbar`, r2.every(([l, rr]) => l >= 0 && rr >= 0), r2);
    for (const k of 'brother') await p.keyboard.press(k); await sleep(60);
    const fx = await p.evaluate(() => ({ plopp: !!document.querySelector('#arena .plopp'), ring: !!document.querySelector('#arena .ploppring'), cheer: document.getElementById('hero').classList.contains('cheer') }));
    ok(`${vn}: Treffer → PLOPP-Effekt + Held jubelt`, fx.plopp && fx.ring && fx.cheer, fx);
    await p.close();
  }
  // Ruhiger Modus
  let p = await page({ speed: 'normal' }); await play(p);
  ok('Normal: Wolken + Hügel bewegen sich', (await anim(p, '#hills .hl1')) === 'hills1' && (await anim(p, '#hills .hl2')) === 'hills2' && !(await p.evaluate(() => document.body.classList.contains('calm'))));
  await p.close();
  for (const [n, s, rm] of [['LRS-Modus', { lrs: true, font: 'lexend', syl: true, speed: 'normal' }, false], ['Tempo „sehr langsam“', { speed: 'sehrlangsam' }, false], ['System „Bewegung reduzieren“', { speed: 'normal' }, true]]) {
    p = await page(s, { rm }); await play(p);
    const a = { hl1: await anim(p, '#hills .hl1'), hl2: await anim(p, '#hills .hl2'), clouds: await anim(p, '#arena', '::before'), bar: await anim(p, '#inputBar') };
    ok(`${n}: Hintergrund ohne Animation (Wolken, Hügel), nichts hinter der Eingabe`, a.hl1 === 'none' && a.hl2 === 'none' && a.clouds === 'none' && a.bar === 'none', a);
    await p.close();
  }
  // Eingabe: schmal, mittig, Cursor + Nochmal-Knopf klar
  for (const [vn, vp] of [['Handy', PHONE], ['Desktop', DESK]]) {
    p = await page({ sayFirst: true }, { vp }); await play(p); for (const k of 'grandmother') await p.keyboard.press(k); await sleep(100);
    const e = await p.evaluate(() => { const bar = document.getElementById('inputBar').getBoundingClientRect(), t = document.getElementById('typed').getBoundingClientRect(), c = document.querySelector('.caret').getBoundingClientRect(), s = document.getElementById('sayAgain'), sr = s.getBoundingClientRect();
      return { w: bar.width, vw: innerWidth, center: Math.abs((t.left + t.right) / 2 - (bar.left + bar.right) / 2), cw: c.width, ch: c.height, say: !s.hidden && sr.width > 30, sayIn: sr.left >= bar.left && sr.right <= bar.right, noOverlap: sr.left >= c.right, fs: parseFloat(getComputedStyle(document.getElementById('typed')).fontSize) }; });
    ok(`${vn}: Eingabe schmal (≤ 560 px) und Buchstaben groß (≥ 28 px, langes Wort) + mittig`, e.w <= 561 && e.fs >= 28 && e.center < 50, e);
    ok(`${vn}: Cursor gut sichtbar, Nochmal-Knopf im Feld, überdeckt den Text nicht`, e.cw >= 3 && e.ch >= 24 && e.say && e.sayIn && e.noOverlap, e);
    await p.close();
  }
  // Ergebnis: kurzer Titel + Sterne
  p = await page({}); await play(p); await p.evaluate(() => window.__vm.endNow(120)); await sleep(300);
  await p.evaluate(() => { if (document.getElementById('nameDlg').classList.contains('on')) document.getElementById('nameSkip').click(); }); await sleep(200);
  const o = await p.evaluate(() => ({ h: document.querySelector('#overHs h3').textContent.trim(), n: document.querySelectorAll('#overStars i').length, on: document.querySelectorAll('#overStars i.on').length }));
  ok('Ergebnis: Highscore-Titel nur Listenname („Unit 2: Familie & Zuhause“)', o.h === '🏆 Unit 2: Familie & Zuhause', o);
  ok('Ergebnis: 3 Sterne angezeigt, 1–3 davon leuchten', o.n === 3 && o.on >= 1 && o.on <= 3, o);
  await p.close();
  // Menü: großes Monster neben dem Titel
  p = await page({}); const m = await p.evaluate(() => { const l = document.querySelector('.titlerow .logo').getBoundingClientRect(), h = document.querySelector('.titlerow h1').getBoundingClientRect(); return { w: l.width, side: l.right <= h.left + 2 && Math.abs((l.top + l.bottom) / 2 - (h.top + h.bottom) / 2) < l.height / 2 }; });
  ok('Menü: großes Monster (≥ 110 px) neben dem Titel', m.w >= 110 && m.side, m); await p.close();
} catch (e) { ok('Ausnahme: ' + e.message, false); }
ok('keine JS-Fehler', !errors.length); if (errors.length) console.log(errors.join('\n'));
console.log(res.join('\n')); console.log(`${res.filter(r => r.startsWith('OK')).length} OK, ${res.filter(r => r.startsWith('FAIL')).length} FAIL`);
await b.close(); srv.kill(); process.exit(res.some(r => r.startsWith('FAIL')) ? 1 : 0);
