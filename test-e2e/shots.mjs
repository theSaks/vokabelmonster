// Screenshots (Handy + Desktop): Menü, Spiel, Boss, Korrekturkarte, Ergebnis.  node test-e2e/shots.mjs <Ordner>
import puppeteer from 'puppeteer-core'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
const OUT = process.argv[2] || 'shots'; fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8094', '-d', 'www'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=de-DE'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPS = { handy: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { width: 1280, height: 800 } };
async function page(vp, s = {}) { const p = await (await b.createBrowserContext()).newPage(); await p.setViewport(vp);
  await p.evaluateOnNewDocument(s => { window.VM_TEST_FAST = true; window.__vmSpeakTest = true; if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1);
    localStorage.setItem('vm.settings', JSON.stringify(Object.assign({ v13: true, ui: 'de', input: 'tippen', speed: 'normal', dir: 'de-en', list: 'L:Unit 2: Familie & Zuhause – Startliste (an Red Line 1 angelehnt)' }, s))); } }, s);
  await p.goto('http://localhost:8094/index.html'); await p.waitForFunction(() => window.__vmReady); await sleep(300); return p; }
const play = async p => { await p.click('#playBtn'); await p.waitForFunction(() => window.__vm.state()); await p.evaluate(() => window.__vm.clearMons()); };
for (const [n, vp] of Object.entries(VPS)) {
  let p = await page(vp); await p.screenshot({ path: `${OUT}/${n}-1-menue.png` });
  await play(p); await p.evaluate(() => { const mr = Math.random; let i = 0; Math.random = () => [0.1, 0.5, 0.9][i++ % 3]; ['brother', 'kitchen', 'grandma/grandmother'].forEach(w => window.__vm.spawn(w)); Math.random = mr; window.__vm.setSpeedFactor(0.02); });
  await sleep(1500); for (const k of 'br') await p.keyboard.press(k); await sleep(400); await p.screenshot({ path: `${OUT}/${n}-2-spiel.png` });
  await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawnBoss('This is my sister.'); }); for (let i = 0; i < 2; i++) await p.keyboard.press('Backspace'); await p.waitForFunction(() => window.__vm.state().intro === 0, { timeout: 15000 });
  await p.evaluate(() => window.__vm.setSpeedFactor(0.02)); await sleep(800); await p.screenshot({ path: `${OUT}/${n}-3-boss.png` });
  await p.evaluate(() => { window.__vm.clearMons(); window.__vm.spawn('family'); window.__vm.showFix('family', 'famly'); }); await sleep(800); await p.screenshot({ path: `${OUT}/${n}-4-korrektur.png` });
  await p.evaluate(() => document.getElementById('fixBtn').click()); await sleep(200);
  await p.evaluate(() => window.__vm.endNow(240)); await sleep(500); await p.evaluate(() => { const s = document.getElementById('nameSkip'); if (s && document.getElementById('nameDlg').classList.contains('on')) s.click(); }); await sleep(1800);
  await p.screenshot({ path: `${OUT}/${n}-5-ergebnis.png` }); await p.close(); }
await b.close(); srv.kill();
