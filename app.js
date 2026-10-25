(function () {
'use strict';
const V = window.VM, ST = window.VMStore, $ = id => document.getElementById(id), I = window.VMI18N, T = I.T, N = I.langName;
const LS = { get: (k, d) => { try { const v = localStorage.getItem('vm.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('vm.' + k, JSON.stringify(v)); } catch {} } };
// localStorage nur noch für Einstellungen, Statistik, Rekord – Vokabeln kommen aus vokabeln.txt
const L = window.VMLRS;
// 1.16: neue LRS-/Extra-Schalter werden ergänzt, vorhandene Werte aus 1.15 bleiben (L.mergeSettings)
let settings = L.mergeSettings({ dir: 'de-en', speed: 'sehrlangsam', input: 'tippen', say: true, sayPop: true, speech: true, skin: 'hero', laser: 'red', lives: 5, kb: true, snd: true, list: '', ui: I.lang }, LS.get('settings', {})); I.set(settings.ui); I.apply();
// 1.3: einmalig auf das neue, großzügige Standard-Tempo umstellen (vorher war es für Kinder zu schnell)
if (!settings.v13) { if (settings.speed === 'normal') settings.speed = 'sehrlangsam'; settings.v13 = true; LS.set('settings', settings); }
const NOLIMIT = () => settings.speed === 'ohne';
let stats = LS.get('stats', {});
let model = { head: [], lists: [] };
const saveStats = () => LS.set('stats', stats);
let times = LS.get('times', {}); const saveTimes = () => LS.set('times', times);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FAST = () => !!window.VM_TEST_FAST;

// ---------- Vokabeldatei ----------
function loadText(t) { model = V.parseFile(t); }
// Jede Änderung landet sofort in der lokalen Kopie (geht nie verloren). „💾 Speichern“ bestätigt und schreibt zusätzlich in die Datei.
let dirty = false;
function unsavedUi() { $('saveBtn').classList.toggle('pending', dirty); if (dirty) { $('saveMsg').textContent = T('unsaved'); $('saveMsg').className = 'msg warn'; } }
function changed() { dirty = true; ST.keepLocal(V.serializeFile(model), false); unsavedUi(); }
async function flush(gesture) {
  if (!dirty) return true; const text = V.serializeFile(model);
  try { const toFile = await ST.save(text, gesture); dirty = false; unsavedUi(); $('saveMsg').className = 'msg ok';
    $('saveMsg').textContent = toFile ? T('savedFile', { n: ST.label.replace(/^[^:：]*[:：]\s*/, '') }) : T('savedLocal'); fx('saved', $('saveBtn'), 900); fileUi(); return true; }
  catch (e) { $('saveMsg').className = 'msg warn'; $('saveMsg').textContent = T('saveFail', { e: e.message }); return false; }
}
async function migrateOld() {             // v1.0 hatte eigene Listen im Browser-Speicher
  const old = LS.get('lists', null); if (!old || !old.length || !ST.canWrite()) return;
  for (const l of old) { const r = V.parseList(l.text); if (r.words.length) model.lists.push({ name: l.name, items: r.words }); }
  await ST.save(V.serializeFile(model)); localStorage.removeItem('vm.lists');
}
function fileUi() {
  const needs = ST.mode === 'fsa' && ST.state !== 'ready';
  $('fileLabel').textContent = '📄 ' + ST.label; $('homeFile').textContent = needs || ST.mode === 'readonly' ? '📄 ' + ST.label : '';
  $('connectBtn').hidden = $('homeConnect').hidden = !needs; $('createBtn').hidden = ST.mode !== 'fsa';
  $('connectBtn').textContent = $('homeConnect').textContent = T(ST.state === 'needs-permission' ? 'reconnect' : 'connect');
}
async function connect(create) { try { const t = await ST.connect(create); if (t != null) { loadText(t); await migrateOld(); } } catch (e) { if (e.name !== 'AbortError') alert(T('openFail', { e: e.message })); } fileUi(); renderHome(); if ($('lists').classList.contains('on')) renderEditor(); }
$('connectBtn').onclick = () => connect(false); $('homeConnect').onclick = () => connect(false); $('createBtn').onclick = () => connect(true);
$('exportBtn').onclick = async () => { await flush(true); try { const n = await ST.exportFile(V.serializeFile(model)); $('saveMsg').textContent = T('exported', { n }); } catch (e) { $('saveMsg').textContent = '⚠️ ' + e.message; } };
$('importIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
  rd.onload = () => { const m = V.parseFile(rd.result); const n = m.lists.reduce((a, l) => a + V.listWords(l).length, 0);
    if (!n) { alert(T('noVocab')); return; }
    if (confirm(T('importAsk', { l: m.lists.length, n }))) model = m;
    else model.lists.push(...m.lists);
    changed(); renderEditor(); };
  rd.readAsText(f, 'utf-8'); e.target.value = ''; };

// ---------- Navigation ----------
async function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 'home') { if (!dirty && ST.canWrite()) loadText(await ST.reload()); renderHome(); }
  if (id === 'lists') renderEditor(); if (id === 'stats') renderStats(); if (id === 'scores') renderScores(); if (id === 'settings') renderSettings();
}
document.addEventListener('click', async e => { const b = e.target.closest('[data-go]'); if (!b) return; if (b.closest('#settings')) saveSettings();
  // Editor verlassen mit ungespeicherten Änderungen → nachfragen (OK = speichern, Abbrechen = bleiben)
  if (b.closest('#lists') && b.dataset.go !== 'lists' && dirty) { if (!confirm(T('unsavedAsk'))) return; if (!(await flush(true))) return; }
  show(b.dataset.go); });
$('saveBtn').onclick = async () => { if (!dirty) { $('saveMsg').className = 'msg ok'; $('saveMsg').textContent = T('savedOk'); fx('saved', $('saveBtn'), 900); return; } await flush(true); };
$('resetExBtn').onclick = async () => { if (!confirm(T('resetExAsk'))) return; model = V.parseFile(await ST.bundled()); edIdx = 0; changed(); await flush(true); renderEditor(); };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
function renderHome() {
  const sel = $('listSel'); sel.innerHTML = '';
  const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
  model.lists.forEach(l => add('L:' + l.name, `${l.name} (${V.listWords(l).length})`)); add('all', T('allLists')); add('weak', T('weakWords'));
  // 1.13: Erststart (settings.list = '') bzw. gelöschte Liste → erste Liste wählen UND merken (vorher „Diese Liste ist leer“)
  sel.value = settings.list; if (!sel.value || sel.value !== settings.list) { sel.selectedIndex = 0; if (sel.value && settings.list !== sel.value) { settings.list = sel.value; LS.set('settings', settings); } }
  $('hsVal').textContent = bestScore(); $('homeMastery').textContent = masteryText(sel.value); fileUi();
  const pw = L.lastWrong(stats, 5); $('probBtn').hidden = !pw.length; $('probBtn').textContent = T('probBtn', { n: pw.length });
}
// 1.16 Problemwort-Runde: die 5 zuletzt falsch beantworteten Problemwörter, mit Kacheln (bzw. Multiple Choice, wenn so eingestellt)
$('probBtn').onclick = () => start('prob5');
$('listSel').addEventListener('change', e => { settings.list = e.target.value; LS.set('settings', settings); $('homeMastery').textContent = masteryText(e.target.value); });
function renderSettings() { $('uiSel').value = I.lang; dirLabels(); $('dirSel').value = settings.dir; $('speedSel').value = settings.speed; $('inputSel').value = settings.input; $('livesSel').value = String(settings.lives); $('kbChk').checked = settings.kb; $('sndChk').checked = settings.snd; $('speechChk').checked = settings.speech !== false; $('sayChk').checked = settings.say; $('sayPopChk').checked = settings.sayPop;
  $('lrsChk').checked = !!settings.lrs; $('fontSel').value = settings.font; $('sylChk').checked = !!settings.syl; $('sayFirstChk').checked = !!settings.sayFirst; $('hearOnlyChk').checked = !!settings.hearOnly; $('autoDownChk').checked = settings.autoDown !== false;
  $('flipChk').checked = !!settings.flip; [...$('sessionSel').options].forEach(o => o.textContent = +o.value ? T('sess_n', { n: o.value }) : T('sess_0')); $('sessionSel').value = String(settings.session || 0);
  renderRewards(); inputNote(); }
// Sprachpaar der gewählten Liste (für die Richtungs-Beschriftung); gemischt mit verschiedenen Paaren → Spalten
function refLangs() { const ls = settings.list && settings.list.startsWith('L:') ? model.lists.filter(l => 'L:' + l.name === settings.list) : model.lists;
  const ps = [...new Set(ls.map(l => V.langsOf(l).join('-')))]; return ps.length === 1 ? ps[0].split('-') : null; }
function dirLabels() { const p = refLangs(), o = $('dirSel').options;
  o[0].textContent = p ? T('dirAns', { q: N(p[1]), a: N(p[0]) }) : T('dirCol1'); o[1].textContent = p ? T('dirAns', { q: N(p[0]), a: N(p[1]) }) : T('dirCol2'); }
const ansLang = (w, dir = settings.dir) => dir === 'de-en' ? (w.la || 'en') : (w.lb || 'de');
const noPinyin = (words, dir) => words.some(w => ansLang(w, dir) === 'zh' && !V.hasPinyin(dir === 'de-en' ? w.en : w.de));
function inputNote() { const ws = wordsFor(settings.list, true), d = $('dirSel').value, zh = ws.some(w => ansLang(w, d) === 'zh');
  $('inputNote').textContent = zh ? ($('inputSel').value === 'tippen' && noPinyin(ws, d) ? T('zhNote') : $('inputSel').value === 'tippen' ? T('zhPinyin') : '') : ''; }
$('dirSel').addEventListener('change', inputNote); $('inputSel').addEventListener('change', inputNote);
function setUi(l) { settings.ui = l; I.set(l); LS.set('settings', settings); I.apply(); fileUi(); renderHome(); if ($('settings').classList.contains('on')) renderSettings(); }
$('uiSel').onchange = e => { saveSettings(); setUi(e.target.value); };
$('homeLangs').addEventListener('click', e => { const b = e.target.closest('[data-ui]'); if (b) setUi(b.dataset.ui); });
function saveSettings() { Object.assign(settings, { dir: $('dirSel').value, speed: $('speedSel').value, input: $('inputSel').value, lives: +$('livesSel').value, kb: $('kbChk').checked, snd: $('sndChk').checked, speech: $('speechChk').checked, say: $('sayChk').checked, sayPop: $('sayPopChk').checked, skin: $('skinSel').value || settings.skin, laser: $('laserSel').value || settings.laser,
  font: $('fontSel').value, syl: $('sylChk').checked, sayFirst: $('sayFirstChk').checked, hearOnly: $('hearOnlyChk').checked, autoDown: $('autoDownChk').checked, flip: $('flipChk').checked, session: +$('sessionSel').value }); applyLook(); LS.set('settings', settings); }
// LRS-Modus: setzt die Vorgaben aus 1–3 (Schrift, Silben, Vorlesen, Kacheln, langsam); aus = vorherige Werte zurück
$('lrsChk').onchange = e => { saveSettings(); L.setLrs(settings, e.target.checked); LS.set('settings', settings); applyLook(); renderSettings(); };
// ---------- 1.16 Lese-Schrift & Silben ----------
// 1.18 Ruhig: LRS, langsame Tempos oder System „Bewegung reduzieren“ → Hintergrund steht still
const CALM = () => !!settings.lrs || ['ohne', 'sehrlangsam'].includes(settings.speed) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function applyLrsUi() { const b = document.body; b.classList.toggle('calm', CALM()); ['lrs-font', 'font-lexend', 'font-od', 'syl-on'].forEach(c => b.classList.remove(c)); L.bodyClasses(settings).forEach(c => b.classList.add(c)); if (settings.syl) ensureHyph(); }
const HYPH_FILES = { 'en-us': 'hyphenationPatternsEnUs', 'de-1996': 'hyphenationPatternsDe1996' }; let hyphReq = null;
function ensureHyph() { if (hyphReq) return hyphReq;
  hyphReq = Promise.all(Object.entries(HYPH_FILES).map(([code, glob]) => new Promise(res => { if (window[glob]) return res();
    const sc = document.createElement('script'); sc.src = 'hyph/' + code + '.js'; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); })))
    .then(() => { const m = {}; for (const [code, glob] of Object.entries(HYPH_FILES)) if (window[glob] && window.createHyphenator) m[code] = window.createHyphenator(window[glob]); L.useHyphenators(m); });
  return hyphReq; }
// Silben als HTML: abwechselnd zwei ruhige Hintergrundfarben + farbige Schrift; ohne Silbenmuster → normaler Text
function sylHtml(text, lang) { const sy = settings.syl ? L.syllables(text, lang) : null; if (!sy) return esc(text); let n = 0;
  // 1.17: Silben eines Wortes zusammenhalten (Umbruch nur zwischen Wörtern, nie mitten im Wort)
  let out = '', w = ''; for (const x of sy) { if (x.sep && /\s/.test(x.t)) { if (w) out += `<span class="w">${w}</span>`; w = ''; out += esc(x.t); } else w += x.sep ? esc(x.t) : `<span class="syl s${(n++) % 2}">${esc(x.t)}</span>`; }
  return out + (w ? `<span class="w">${w}</span>` : ''); }

// ---------- Editor ----------
let edIdx = 0;
function renderEditor() {
  fileUi(); if (!dirty) $('saveMsg').textContent = ''; unsavedUi(); const sel = $('edList'); sel.innerHTML = '';
  model.lists.forEach((l, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${l.name} (${V.listWords(l).length})`; sel.appendChild(o); });
  edIdx = Math.min(edIdx, model.lists.length - 1); sel.value = edIdx; renderRows();
}
function renderRows() {
  const box = $('edRows'); box.innerHTML = ''; const l = model.lists[edIdx]; if (!l) { box.innerHTML = '<p>' + esc(T('noList')) + '</p>'; return; }
  const [la, lb] = V.langsOf(l); $('edHa').textContent = N(la); $('edHb').textContent = N(lb);
  const opts = c => Object.keys(T('lang')).map(k => `<option value="${k}" ${k === c ? 'selected' : ''}>${esc(N(k))}</option>`).join(''); $('edLa').innerHTML = opts(la); $('edLb').innerHTML = opts(lb);
  if (!l) { box.innerHTML = '<p>' + esc(T('noList')) + '</p>'; return; }
  l.items.forEach((it, i) => { if (it.raw != null) return;
    const r = document.createElement('div'); r.className = 'er'; r.dataset.i = i;
    r.innerHTML = `<input class="en" value="${esc(it.en)}" placeholder="${esc(N(la))}" lang="${la}" autocapitalize="off" spellcheck="false"><input class="de" value="${esc(it.de)}" placeholder="${esc(N(lb))}" lang="${lb}" spellcheck="false"><button title="${esc(T('delRow'))}">🗑</button>`;
    box.appendChild(r); });
}
$('edRows').addEventListener('input', e => { const r = e.target.closest('.er'); if (!r) return; const it = model.lists[edIdx].items[+r.dataset.i];
  it[e.target.classList.contains('en') ? 'en' : 'de'] = e.target.value; changed(); });
$('edRows').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') return; const r = e.target.closest('.er');
  model.lists[edIdx].items.splice(+r.dataset.i, 1); changed(); renderRows(); });
$('edList').onchange = e => { edIdx = +e.target.value; renderRows(); };
const setPair = () => { const l = model.lists[edIdx]; if (!l) return; l.langs = [$('edLa').value, $('edLb').value]; changed(); renderRows(); };
$('edLa').onchange = setPair; $('edLb').onchange = setPair;
$('addRowBtn').onclick = () => { const l = model.lists[edIdx]; if (!l) return; l.items.unshift({ en: '', de: '' }); renderRows(); $('edRows').querySelector('.en').focus(); };
$('newListBtn').onclick = () => { const n = (prompt(T('newListAsk')) || '').trim(); if (!n) return;
  model.lists.push({ name: n, items: [] }); edIdx = model.lists.length - 1; changed(); renderEditor(); };
$('renListBtn').onclick = () => { const l = model.lists[edIdx]; if (!l) return; const n = (prompt(T('renAsk'), l.name) || '').trim(); if (n) { l.name = n; changed(); renderEditor(); } };
$('delListBtn').onclick = () => { const l = model.lists[edIdx]; if (l && confirm(T('delListAsk', { l: l.name, n: V.listWords(l).length }))) { model.lists.splice(edIdx, 1); edIdx = 0; changed(); renderEditor(); } };
$('bulkBtn').onclick = () => { const l = model.lists[edIdx]; if (!l) return; const r = V.parseList($('bulkText').value);
  l.items.push(...r.words); $('bulkText').value = ''; changed(); renderRows();
  $('saveMsg').textContent = T('bulkDone', { n: r.words.length }) + (r.errors.length ? T('bulkErr', { e: r.errors.join(', ') }) : ''); };

const dots = st => { const n = Math.min(V.MASTER_STREAK, (st && st.streak) || 0); return `<span class="dots" title="${n}/${V.MASTER_STREAK}">${'●'.repeat(n)}${'○'.repeat(V.MASTER_STREAK - n)}</span>`; };
function renderStats() {
  const keys = [...new Set(model.lists.flatMap(V.listWords).map(V.wkey))], o = L.overview(stats, keys, { isDue: V.isDue, isMastered: V.isMastered, isProb: st => V.potOf(st, Date.now()) === 'prob' });
  $('statOv').innerHTML = `<h3>${esc(T('ovTitle'))}</h3><div class="ov"><span>${esc(T('ovDue', { n: o.due }))}</span><span>${esc(T('ovProb', { n: o.prob }))}</span><span>${esc(T('ovWeek', { n: o.week }))}</span><span>${esc(T('ovSafe', { a: o.safe, b: o.total }))}</span></div>`;
  const arr = Object.values(stats).filter(s => s.wrong > 0).sort((a, b) => (b.wrong - b.right * .5) - (a.wrong - a.right * .5));
  $('statList').innerHTML = arr.length ? arr.slice(0, 60).map(s => `<div class="st"><span>${esc(s.de)} → <b>${esc(V.display(s.en))}</b></span><span>${dots(s)} <span class="good">✔${s.right}</span> <span class="bad">✘${s.wrong}</span></span></div>`).join('')
    : '<p>' + T('noErrors') + '</p>';
}
$('speechTest').onclick = () => { const sp = settings.speech; settings.speech = true; speak('Hello! Well done.', 'en'); settings.speech = sp; };
$('resetAllBtn').onclick = () => { $('resetHs').checked = false; $('resetDlg').classList.add('on'); };
$('resetNo').onclick = () => $('resetDlg').classList.remove('on');
$('resetRewBtn').onclick = () => $('resetRewDlg').classList.add('on');
$('resetRewNo').onclick = () => $('resetRewDlg').classList.remove('on');
$('resetRewYes').onclick = () => { V.resetRewards(prog); saveProg(); LS.set('unlocked', []); settings.skin = 'hero'; settings.laser = 'red'; LS.set('settings', settings);
  $('resetRewDlg').classList.remove('on'); renderSettings(); applyLook(); toast(T('resetRewDone'), true, 2500); };
$('resetYes').onclick = () => { const hs = $('resetHs').checked;
  // 1.16: vor dem Löschen den alten Stand archivieren (vm.archive, max. 3 Stände; Listen in vokabeln.txt bleiben ohnehin erhalten)
  try { LS.set('archive', L.pushArchive(LS.get('archive', []), L.archiveEntry(k => LS.get(k, null), V.resetKeys(true)))); } catch {}
  V.resetKeys(hs).forEach(k => { try { localStorage.removeItem('vm.' + k); } catch {} });
  stats = {}; times = {}; Object.keys(prog).forEach(k => delete prog[k]); Object.assign(prog, { pops: 0, wins: 0, solved: 0, kept: [], v19: true, v119: true, mastered: 0, ldays: 0 }); saveProg(); LS.set('unlocked', []);
  settings.skin = 'hero'; settings.laser = 'red'; LS.set('settings', settings); $('resetDlg').classList.remove('on'); renderSettings(); applyLook(); toast(T('resetDone') + ' ' + T('archived'), true, 3000); };
$('resetStats').onclick = () => { if (confirm(T('resetAsk'))) { stats = {}; saveStats(); renderStats(); } };

// ---------- Ton ----------
let ac; function beep(f, d = .1, type = 'square', vol = .06) { if (!settings.snd) return; try {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch {} }
const sfx = { pop: () => { beep(660, .08); setTimeout(() => beep(990, .1), 70); }, boss: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .12), i * 90)),
  hit: () => beep(440, .1, 'triangle', .08), soft: () => beep(330, .2, 'triangle', .06), level: () => [392, 523, 659].forEach((f, i) => setTimeout(() => beep(f, .15, 'triangle', .08), i * 120)) };
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

// ---------- Tastatur ----------
// Grundtastatur + Sonderzeichen der Antwort-Sprachen (z. B. ü ö ä ß für Deutsch, ñ á é … für Spanisch)
const KB_EXTRA = { de: 'üöäß', es: 'ñáéíóúü', fr: 'éèêàçùâôîë', it: 'àèéìòù', pt: 'ãõáâàçéêíóú', tr: 'çğıöşü', pl: 'ąćęłńóśźż', nl: 'éëï', zh: 'ü' };
function buildKb(langs = ['de']) { const kb = $('kb'); kb.innerHTML = '';
  const ex = [...new Set(langs.flatMap(l => [...(KB_EXTRA[l] || '')]))];
  const rows = [['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['z','x','c','v','b','n','m']];
  if (ex.length <= 4) { if (ex[0]) rows[0].push(ex[0]); rows[1].push(...ex.slice(1, 3)); rows[2].push(...ex.slice(3)); rows[2].push("'", '-'); }
  else { rows[2].push("'", '-'); rows.push(ex); }
  rows.push(['⌫','␣','✔']); kb.dataset.langs = langs.join(',');
  rows.forEach(r => { const row = document.createElement('div'); row.className = 'kr';
    r.forEach(k => { const b = document.createElement('button'); b.className = 'k'; b.dataset.k = k;
      b.textContent = k === '␣' ? T('space') : k === '✔' ? 'OK ✔' : k;
      if (k === '␣') b.classList.add('w5'); if (k === '⌫') b.classList.add('w2', 'fn'); if (k === '✔') b.classList.add('w2', 'ok');
      row.appendChild(b); }); kb.appendChild(row); }); }
buildKb();
$('kb').addEventListener('pointerdown', e => { const b = e.target.closest('.k'); if (!b) return; e.preventDefault(); b.classList.add('dn'); setTimeout(() => b.classList.remove('dn'), 110);
  const k = b.dataset.k; key(k === '⌫' ? 'Backspace' : k === '✔' ? 'Enter' : k === '␣' ? ' ' : k); });
document.addEventListener('keydown', e => {
  if ($('fix').classList.contains('on')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeFix(); } return; }
  if (!G || !$('game').classList.contains('on')) return;
  if (e.key === 'Escape') { pause(); return; }
  if (e.key === 'Backspace' || e.key === 'Enter' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) { e.preventDefault(); key(e.key); } });

// ---------- Spiel ----------
// Pixel-Sprites (Kenney „Pixel Platformer“, CC0) – je 2 Frames nebeneinander in img/*.png
const FACES = ['mon-green','mon-blue','mon-pink','mon-yellow','mon-imp','mon-bot','mon-bat','mon-drill'], BOSSES = ['boss-block','boss-robot','boss-spike','boss-drill'];
const bossName = spr => T('boss_' + String(spr).replace('boss-', ''));
const INTRO = () => FAST() ? 1.2 : 1.8;   // Boss-Intro: Sinken ist so lange angehalten
const sprite = n => `background-image:url(img/${n}.png)`;
let G = null, raf = 0;
function wordsFor(listId, quiet) {
  if (listId === 'prob5') { const w = L.lastWrong(stats, 5).map(s => ({ en: s.en, de: s.de, la: s.la || 'en', lb: s.lb || 'de' })); if (w.length) return w; listId = 'all'; }
  if (listId === 'weak') { const w = Object.values(stats).filter(s => s.wrong > 0 && s.streak < 3).map(s => ({ en: s.en, de: s.de, la: s.la || 'en', lb: s.lb || 'de' })); if (w.length >= 3) return w; if (!quiet) toast(T('notEnoughWeak')); listId = 'all'; }
  const ls = listId === 'all' ? model.lists : model.lists.filter(l => 'L:' + l.name === listId);
  return ls.flatMap(V.listWords);
}
// 1.16: Eingabeart des aktuellen Ziels – ein runtergestuftes Wort (L.modeFor) bringt seine leichtere Eingabe mit, solange es auf dem Feld ist
const IN = () => { if (!G) return settings.input; const d = G.mons.find(m => m.mode && m.mode !== G.input); return d ? d.mode : G.input; };
function inputUi() { if (!G) return; const i = IN(); G.curMode = i;
  $('kb').classList.toggle('off', !settings.kb || i !== 'tippen'); $('alt').className = i === 'tippen' ? 'off' : i; if (i === 'tippen') $('alt').innerHTML = ''; $('inputBar').classList.toggle('mcbar', i === 'mc'); }
function start(special) {
  const listId = typeof special === 'string' ? special : settings.list;
  const words = wordsFor(listId); if (!words.length) { alert(T('emptyList')); return; }
  G = { words, phrases: words.filter(V.isPhrase), level: 1, score: 0, combo: 0, best: 0, lives: settings.lives, pops: 0, mons: [], typed: '', last: 0, spawnT: 0,
    listId, world: 0, endless: false, finalPending: false, won: false, tileWord: '', bossUp: false, intro: 0, used: [], recent: [], altItems: [], altKey: '', revenge: [], sinceBoss: 0, missed: [], paused: false, hold: false, nid: 0, fixes: 0, input: settings.input, hits: 0, sessDone: false };
  if (listId === 'prob5' && G.input === 'tippen') G.input = 'kacheln';
  // Chinesische Antworten ohne Pinyin lassen sich nicht tippen → Kacheln
  const zh = words.some(w => ansLang(w) === 'zh'); if (zh && G.input === 'tippen' && noPinyin(words, settings.dir)) G.input = 'kacheln';
  buildKb([...new Set(words.flatMap(w => settings.flip ? [ansLang(w), ansLang(w, settings.dir === 'de-en' ? 'en-de' : 'de-en')] : [ansLang(w)]))]);
  inputUi(); $('sayAgain').hidden = !(settings.sayFirst || settings.hearOnly) || !SPEECH(); $('inputBar').classList.toggle('say', !$('sayAgain').hidden); if (settings.syl) ensureHyph(); show('game'); hud(); setTyped(''); $('arena').querySelectorAll('.mon,.px,.corpse').forEach(m => m.remove()); $('intro').classList.remove('on');
  if (zh && settings.input === 'tippen') setTimeout(() => G && toast(T(G.input === 'tippen' ? 'zhPinyin' : 'zhNoType'), false, 3000), 50);
  applyLook(); $('arena').dataset.w = 0; G.last = performance.now(); G.spawnT = 0.3; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
// flip (1.16, Extra): diese eine Frage andersherum
const qa = (w, flip) => (settings.dir === 'de-en') !== !!flip ? { q: w.de, a: w.en } : { q: w.en, a: w.de };
const qLang = (w, flip) => (settings.dir === 'de-en') !== !!flip ? (w.lb || 'de') : (w.la || 'en');
const aLang = (w, flip) => (settings.dir === 'de-en') !== !!flip ? (w.la || 'en') : (w.lb || 'de');
// Wort zuerst vorlesen: Monster wartet kurz oben, damit das Kind zuhören kann (Zeit nach Wortlänge, Android-TTS meldet kein Ende zuverlässig)
const listenSecs = w => FAST() ? 0 : Math.min(2.6, 0.9 + 0.07 * V.speakText(w.en).length);
// kind: 'normal' | 'phrase' (Level-Boss) | 'revenge' (verpasstes Wort, 3 Treffer)
function spawn(kind, word) {
  const onScreen = new Set(G.mons.map(m => V.wkey(m.w)));
  stopSpeech();   // 1.17: neues Wort → alles Alte (auch verspätete Timer) verwerfen
  // 1.15: Topf-Auswahl (neu → Problem → fällig → gelernt), keine Wiederholung der letzten Wörter dieses Spiels
  const pk = ex => V.pickNext(kind === 'phrase' && G.phrases.length ? G.phrases : G.words, stats, { rnd: window.__vmRnd || Math.random, exclude: ex, recent: G.recent });
  let w = word || pk(onScreen); if (!w) return;
  // 1.16 Auto-Runterstufen: ein runtergestuftes Wort kommt nur allein aufs Feld (eigene Eingabeart); sonst ein anderes Wort nehmen
  const downMode = ww => kind === 'normal' ? L.modeFor(stats[V.wkey(ww)], G.input, settings.autoDown !== false) : G.input;
  if (!word && G.mons.length && downMode(w) !== G.input) { const w2 = pk(new Set([...onScreen, V.wkey(w)])); if (w2 && downMode(w2) === G.input) w = w2; else return; }
  const mode = downMode(w), flip = kind === 'normal' && mode === G.input && settings.flip && !settings.hearOnly && (window.__vmRnd || Math.random)() < 0.2;
  G.recent.push(V.wkey(w)); if (G.recent.length > 40) G.recent.shift();
  const p = qa(w, flip), el = document.createElement('div'), boss = kind !== 'normal', hp = kind === 'revenge' ? 3 : kind === 'final' ? FINAL_HP : 1;
  const hear = settings.hearOnly && SPEECH() && canSpeak(w.la) && (kind === 'normal' || kind === 'revenge');
  el.className = 'mon' + (hear ? ' hear' : '') + (boss ? ' boss' : '') + (kind === 'revenge' ? ' revenge' : '') + (kind === 'final' ? ' final' : '');
  const x = boss ? 50 : 12 + Math.random() * 76, spr = kind === 'final' ? 'boss-robot' : boss ? BOSSES[(G.level + G.nid) % BOSSES.length] : FACES[Math.floor(Math.random() * FACES.length)];
  el.innerHTML = `${boss ? '<div class="hpbar"><b style="width:100%"></b></div>' : ''}${hp > 1 ? '<div class="shields"></div>' : ''}<div class="face spr" style="${sprite(spr)}"></div><div class="tag">${hear ? '🔊 ?' : sylHtml(V.display(p.q), qLang(w, flip))}</div>`;
  el.style.left = x + '%'; el.style.top = '-12%'; $('arena').appendChild(el);
  const travel = V.travelFor(p.a, G.level, settings.speed) * (kind === 'revenge' ? 1.8 : kind === 'phrase' ? 1.4 : kind === 'final' ? 2.2 : 1);
  const m = { id: ++G.nid, w, a: p.a, q: p.q, el, y: -12, x, boss, kind, hp, maxHp: hp, travel, speed: 100 / travel, tries: 0, spr, mode, flip, hear, listen: 0 };
  // 1.16 Speech-first: Wort aus Spalte 1 vorlesen, bevor es fällt (Bosse: nur vorlesen, kein Warten – die haben ihr Intro)
  if ((settings.sayFirst || hear) && SPEECH() && canSpeak(w.la) && kind !== 'final') { if (!boss || kind === 'revenge') m.listen = listenSecs(w); sayLater(w.en, w.la, boss ? (FAST() ? 0 : 600) : 0); }
  G.mons.push(m); shields(m); placeMon(m); renderAlt(); if (mode !== G.input) toast(T('downToast', { q: hear ? '🔊' : V.display(p.q) }), true, 1600); if (boss) bossIntro(m); if (kind === 'revenge') toast(T('revengeToast', { q: V.display(p.q) }));
}
function shields(m) { const s = m.el.querySelector('.shields'); if (s) s.innerHTML = '<i></i>'.repeat(m.hp) + '<i class="off"></i>'.repeat(m.maxHp - m.hp);
  const b = m.el.querySelector('.hpbar b'); if (b) b.style.width = (100 * m.hp / m.maxHp) + '%'; }
// ---------- Boss-Effekte (nur Optik; während des Intros sinkt nichts) ----------
function fx(cls, el, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
const flash = () => fx('on', $('flash'), 400), shake = () => fx('shake', $('game'), 500);
function bossIntro(m) {
  G.intro = INTRO() * (m.kind === 'final' ? 1.5 : 1); $('introBan').textContent = T(m.kind === 'final' ? 'banFinal' : m.kind === 'revenge' ? 'banRevenge' : 'banBoss');
  $('introName').textContent = m.kind === 'final' ? T('finalName', { n: FINAL_HP }) : m.kind === 'revenge' ? T('revengeName') : bossName(m.spr); $('intro').classList.add('on'); flash(); shake(); buzz([40, 40, 80]);
  [196, 185, 175, 330].forEach((f, i) => setTimeout(() => beep(f, .18, 'sawtooth', .05), i * 160));
}
function loop(t) {
  if (!G) return; const dt = Math.min(.1, (t - G.last) / 1000); G.last = t;
  if (!G.paused && !G.hold && G.intro > 0) { G.intro -= dt; if (G.intro <= 0) { G.intro = 0; $('intro').classList.remove('on'); } }
  else if (!G.paused && !G.hold) {
    const lp = Object.assign({}, V.levelParams(G.level, settings.speed)); if (NOLIMIT()) lp.maxMonsters = 1; else if (IN() !== 'tippen') lp.maxMonsters = settings.speed === 'challenger' ? Math.min(2, lp.maxMonsters) : 1; /* Challenger: bis zu 2 Monster auch bei Kacheln/MC */ const anyBoss = G.mons.some(m => m.boss);
    G.spawnT -= dt; if (!G.mons.length) G.spawnT = Math.min(G.spawnT, 0.7);
    if (G.finalPending && G.mons.length === 0) { G.finalPending = false; spawn('final'); }
    else if (lp.boss && !G.bossUp && G.mons.length === 0) { G.bossUp = true; spawn('phrase'); toast(T('bossWarn')); }
    else if (!anyBoss && G.revenge.length && G.sinceBoss >= 3 && G.mons.length === 0) { G.sinceBoss = 0; spawn('revenge', G.revenge.shift()); }
    else if (!anyBoss && !G.mons.some(m => m.mode !== G.input) && G.mons.length < lp.maxMonsters && G.spawnT <= 0) { spawn('normal'); G.spawnT = lp.travel / (lp.maxMonsters + .5); }
    const floor = 100 - 100 * 80 / Math.max(160, $('arena').clientHeight);
    for (const m of [...G.mons]) { if (m.listen > 0) { m.listen -= dt; placeMon(m); continue; } m.age = (m.age || 0) + dt; m.y += m.speed * dt; m.el.style.setProperty('--depth', (0.82 + 0.3 * Math.max(0, m.y) / 100).toFixed(3)); placeMon(m); if (NOLIMIT() && m.y >= floor - 14) { m.y = floor - 14; placeMon(m); m.el.classList.add('wait'); continue; } if (m.y >= floor) { escaped(m); break; } }
    if (G) target();
  }
  raf = requestAnimationFrame(loop);
}
// 1.17.1: echtes Ziel-Lock – das Monster, auf das man gerade tippt, bleibt Ziel, solange das Getippte passt
// (auch wenn neue Monster mit gleichem Anfang kommen oder sich die Reihenfolge ändert); das Ziel liegt immer obenauf.
function target() { const n = V.norm(G.typed), fits = m => !!n && V.variants(m.a).some(v => v.startsWith(n));
  let best = G.lock && G.mons.includes(G.lock) && fits(G.lock) ? G.lock : null; if (!best) best = G.mons.find(fits) || null;
  G.lock = best; for (const m of G.mons) m.el.classList.toggle('target', m === best); }
const lockedMatch = () => G.lock && G.mons.includes(G.lock) && V.isMatch(G.typed, G.lock.a) ? G.lock : G.mons.find(m => V.isMatch(G.typed, m.a));
function key(k) {
  if (!G || G.paused || G.hold) return;
  if (k === 'Backspace') setTyped(G.typed.slice(0, -1));
  else if (k === 'Enter') submit();
  else if (G.typed.length < 60) { setTyped(G.typed + k); const hit = lockedMatch(); if (hit) strike(hit);
    else { const n = V.norm(G.typed), t = n && k.trim() && (G.lock && G.mons.includes(G.lock) ? G.lock : [...G.mons].sort((a, b) => b.y - a.y).find(m => V.variants(m.a).some(v => v.startsWith(n)))); if (t) miniLaser(t); } }   // richtiger Buchstabe → kleiner Schuss
}
function addRevenge(w) { const k = V.wkey(w); if (!G.revenge.some(x => V.wkey(x) === k) && !G.mons.some(m => m.kind === 'revenge' && V.wkey(m.w) === k)) G.revenge.push(w); }
function miss(m) { const st = V.record(stats, m.w, false); st.miss = (st.miss || 0) + 1; st.lw = Date.now(); saveStats(); addRevenge(m.w); }
function submit() {
  if (!G.typed.trim()) return;
  const hit = lockedMatch(); if (hit) { strike(hit); return; }
  // falsch: Was war gemeint? Das Monster mit dem besten Präfix, sonst das vorderste
  const n = V.norm(G.typed), front = [...G.mons].sort((a, b) => (V.variants(b.a).some(v => v[0] === n[0]) - V.variants(a.a).some(v => v[0] === n[0])) || (b.y - a.y))[0];
  G.combo = 0; hud(); const input = G.typed; setTyped('');
  if (front) { front.tries++; if (front.tries === 1) miss(front); showFix(front, input, false); }
}
function strike(m) {
  if (m.hp > 1) { m.hp--; if (m.kind === 'final') nextFinalWord(m); shields(m); m.y = Math.max(-12, m.y - 10); placeMon(m); m.el.classList.remove('hurt'); void m.el.offsetWidth; m.el.classList.add('hurt');
    laser(m); G.score += 5; sfx.hit(); buzz(20); if (m.boss) { shake(); particles(m, 14, ['#fff', '#ffd84a', '#e04848'], 70); } setTyped(''); hud(); toast(T('hitLeft', { n: m.hp }), true); return; }
  pop(m);
}
function pop(m) {
  m.c = center(m); let crit = null; if (m.tries === 0 && m.age > 0) { crit = V.recordTime(times, V.wkey(m.w), IN(), m.age * 1000, window.__vmRnd || Math.random); saveTimes(); if (!crit.crit) crit = null; }
  if (crit) { m.crit = true; m.el.classList.add('critm'); } laser(m); remove(m); // 1.19: nur beim 1. Versuch richtig zählt (auch Rache-Monster nur ohne Fehler); neu „sicher“ + Lerntag für die Belohnungen
  if (m.tries === 0) { const was = V.isMastered(stats[V.wkey(m.w)]), rs = V.record(stats, m.w, true); L.noteMastery(rs, was, V.isMastered(rs)); if (rs.solved) prog.solved = (prog.solved || 0) + 1;
    const newSafe = !was && V.isMastered(rs) && V.noteMastered(prog, rs), newDay = V.noteFirstTry(prog); saveProg(); if (newSafe || newDay) toast((newDay ? T('rewDayDone') + ' ' : '') + progressText(), true, 2800); } saveStats();
  G.combo++; G.best = Math.max(G.best, G.combo); G.hits++; if ([3, 5, 10, 15, 20, 30].includes(G.combo)) setTimeout(() => G && toast(T('streakToast', { n: G.combo }), true, 1600), FAST() ? 0 : 700); let pts = V.points(G.combo, m.boss) * (m.kind === 'revenge' ? 2 : 1); if (crit) { pts = V.critPoints(pts); critFx(m, crit); } G.score += pts; G.pops++;
  if (!m.boss) G.sinceBoss++; prog.pops++; saveProg();
  stopSpeech();   // 1.17: kein Vorlesen nach einem Treffer (funkte in die nächste Runde rein); laufende Sprache beenden
  fx('cheer', $('hero'), 650);   // 1.18: Held jubelt
  m.boss ? sfx.boss() : sfx.pop(); buzz(m.boss ? [60, 40, 120] : 25); burst(m, pts); setTyped('');
  if (m.kind === 'revenge') toast(T('revengeWon', { a: V.display(m.a).split(' / ')[0] }), true);
  if (m.kind === 'phrase') { G.lives = Math.min(G.lives + 1, settings.lives + 3); toast(T('bossWon'), true); }
  if (m.kind === 'final') { hud(); victory(); return; }
  if (m.kind !== 'revenge' && (G.pops % 8 === 0 || m.kind === 'phrase')) { G.level++; G.bossUp = false; sfx.level(); if (m.kind !== 'phrase') toast(T('levelUp', { n: G.level }), true);
    if (!G.endless && G.level > FINAL_LEVEL) { G.finalPending = true; toast(T('finalComes')); } setWorld(); }
  hud(); if (V.grantReward(prog, [...SKINS, ...LASERS])) saveProg(); checkUnlocks();
  if (settings.session > 0 && !G.sessDone && G.hits >= settings.session) { G.sessDone = true; setTimeout(sessionEnd, FAST() ? 0 : 900); }
}
// 1.16 Kurze Runde: nach N getroffenen Wörtern „Heute fertig“ (Weiterspielen geht). Keine eigene Belohnung (Belohnungslogik unverändert).
function sessionEnd() { if (!G || $('fix').classList.contains('on')) { if (G) setTimeout(sessionEnd, 500); return; } G.hold = true; $('sessInfo').textContent = T('sessInfo', { n: G.hits }); $('sessDlg').classList.add('on'); sfx.level(); }
$('sessEnd').onclick = () => { $('sessDlg').classList.remove('on'); if (G) gameOver(); };
$('sessMore').onclick = () => { $('sessDlg').classList.remove('on'); if (!G) return; G.hold = false; G.last = performance.now(); };
function escaped(m) {
  stopSpeech(); remove(m); if (m.tries === 0 || m.kind === 'revenge') miss(m);
  G.missed.push(m); G.lives--; G.combo = 0; buzz([80, 60, 80]);
  const h = $('hero'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit');
  if (m.kind === 'phrase') G.bossUp = false; if (m.kind === 'final') G.finalPending = true;
  hud(); showFix(m, '', true);
}
// ---------- freundliche Korrektur (pausiert das Spiel) ----------
const CHEER = () => T('cheer');
let fixT = [], fixReady = 0;
function showFix(m, input, escapedMon) {
  G.hold = true; G.fixes++; sfx.soft();
  const sol = input ? V.bestVariant(input, m.a) : V.display(m.a).split(' / ')[0];
  $('fixTitle').textContent = (escapedMon ? '💚 ' : '🙂 ') + CHEER()[G.fixes % CHEER().length];
  $('fixQ').innerHTML = sylHtml(V.display(m.q), qLang(m.w, m.flip)); $('fixA').innerHTML = '';
  const alts = V.display(m.a).split(' / '), dc = input ? V.diffChars(input, sol) : [];
  // 1.16: falsche Buchstaben ruhig markiert (blau hinterlegt + Symbol ✎ für Farbenblinde, kein Rot)
  $('fixYou').innerHTML = input ? esc(T('youTyped')) + dc.map(c => c.ok ? esc(c.ch) : `<span class="bad wl">${esc(c.ch)}</span>`).join('') : (alts.length > 1 ? esc(T('alsoOk')) + esc(alts.filter(a => a !== sol).join(', ')) : '');
  $('fixLeg').hidden = !dc.some(c => !c.ok);
  $('fixNote').textContent = T(m.kind === 'revenge' && escapedMon ? 'noteRevenge' : escapedMon ? 'noteEscaped' : 'noteRetry');
  $('fix').classList.add('on'); fixT.forEach(clearTimeout); fixT = [];
  const al = aLang(m.w, m.flip), dur = buildAnswer(sol, al);
  const minT = FAST() ? 0 : 1200, total = FAST() ? 60000 : Math.max(3000, 1600 + dur + 1400) + (settings.say && SPEECH() ? 1200 : 0);
  fixReady = performance.now() + minT; $('fixBtn').disabled = !FAST(); fixT.push(setTimeout(() => $('fixBtn').disabled = false, minT));
  fixT.push(setTimeout(closeFix, total)); fixT.push(setTimeout(() => {}, 0));
  G.fixEscaped = escapedMon; G.fixWord = m.w; G.fixSol = sol; G.fixLang = al; $('fixSay').hidden = !SPEECH() || !canSpeak(al); $('fixHow').hidden = !(settings.say && SPEECH());
  // 1.16: das richtige Wort wird vorgelesen (Sprache der Antwort), während es sich Buchstabe für Buchstabe bzw. Silbe für Silbe aufbaut
  stopSpeech(); if (settings.say && SPEECH() && canSpeak(al)) sayLater(al === 'zh' ? m.a : sol, al, FAST() ? 0 : 250);   /* Chinesisch: Schriftzeichen statt Pinyin vorlesen */   // Sprache der Antwort (en-de → Deutsch, de-DE)
}
// „So klingt's / so sieht's aus“: Aufbau der Lösung – mit Silben-Schalter silbenweise (farbig), sonst buchstabenweise. Rückgabe: Dauer in ms
function buildAnswer(sol, lang) { const box = $('fixA'); box.innerHTML = ''; const sy = settings.syl ? L.syllables(sol, lang) : null;
  const chunks = sy ? sy.map((x, i) => ({ t: x.t, cls: x.sep ? 'l' : 'l syl s' + (sy.slice(0, i).filter(y => !y.sep).length % 2) })) : [...sol].map(ch => ({ t: ch, cls: 'l' }));
  const step = FAST() ? 0 : sy ? 360 : 110;
  chunks.forEach((c, i) => fixT.push(setTimeout(() => { const s = document.createElement('span'); s.className = c.cls; s.textContent = c.t.replace(/ /g, '\u00a0'); box.appendChild(s); }, i * step)));
  return chunks.length * step; }
function closeFix() {
  if (!$('fix').classList.contains('on') || performance.now() < fixReady) return;
  fixT.forEach(clearTimeout); fixT = []; $('fix').classList.remove('on'); stopSpeech();
  if (!G) return; G.hold = false; G.last = performance.now(); setTyped('');
  if (G.lives <= 0) gameOver();
}
$('fixBtn').onclick = closeFix; $('fix').addEventListener('pointerdown', e => { if (e.target.closest('#fixSay')) return; if (e.target.id === 'fix' || e.target.closest('#fixCard')) closeFix(); });
$('fixSay').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (G && G.fixSol) { speak(G.fixSol, G.fixLang); buildAnswer(G.fixSol, G.fixLang); } });
// 1.16 Wiederholen-Knopf im Spiel (Speech-first / Nur hören): liest das aktuelle Ziel nochmal vor
$('sayAgain').addEventListener('pointerdown', e => { e.preventDefault(); if (!G || G.paused || G.hold) return; const m = altTarget(); if (m) speak(m.w.en, m.w.la); });

// 1.17: Monster + Wort immer ganz sichtbar halten (Android: Wort lief am Rand raus, Boss rutschte unter die Eingabeleiste).
// Spiel-Logik (m.x, m.y, Entkommen) bleibt gleich – nur die Anzeige wird in die Arena geklemmt; Maße mit echter Schriftbreite (LRS/Silben).
function placeMon(m) { const a = $('arena'), W = a.clientWidth, H = a.clientHeight; if (!W || !H) { m.el.style.left = m.x + '%'; m.el.style.top = m.y + '%'; return; }
  const now = performance.now(); if (!m.dim || now - m.dim.t > 250) m.dim = { w: m.el.offsetWidth, h: m.el.offsetHeight, t: now };
  const d = parseFloat(m.el.style.getPropertyValue('--depth')) || 1, half = m.dim.w * d / 2 + 6, pad = 6;
  let lx = m.x / 100 * W; lx = half * 2 >= W ? W / 2 : Math.min(Math.max(lx, half), W - half);
  let ty = m.y / 100 * H; const maxT = H - m.dim.h - pad; if (ty > maxT) ty = Math.max(maxT, m.listen > 0 ? 0 : -m.dim.h);
  if (m.listen > 0 || m.boss) { const minT = m.dim.h * (1 - d) + pad; if (ty < minT && maxT >= minT) ty = minT; }   // wartendes/vorgelesenes Wort und Boss: nicht oben abgeschnitten
  m.el.style.left = lx + 'px'; m.el.style.top = ty + 'px'; m.vis = { lx, ty, W, H }; }
addEventListener('resize', () => G && G.mons.forEach(m => { m.dim = null; placeMon(m); }));
if (window.visualViewport) visualViewport.addEventListener('resize', () => G && G.mons.forEach(m => { m.dim = null; placeMon(m); }));
function remove(m) { if (G.lock === m) G.lock = null; G.mons = G.mons.filter(x => x !== m); m.el.remove(); renderAlt(); }
// ---------- Laser-Pistole: Held zielt und schießt auf das getroffene Monster (rein optisch, ~0,25 s) ----------
function laser(m) {
  const a = $('arena'), ar = a.getBoundingClientRect(), h = $('hero'), hr = h.getBoundingClientRect(); const [tx, ty] = m.c || center(m);
  const hx = hr.left - ar.left + hr.width / 2, hy = hr.top - ar.top + hr.height * .35, dx = tx - hx, dy = ty - hy, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
  h.style.setProperty('--aim', (ang + 90) + 'deg'); fx('aim', h, 260);
  const shots = m.boss ? [-8, 0, 8] : [0];
  shots.forEach((off, i) => setTimeout(() => { const b = document.createElement('div'); b.className = 'laser' + (m.boss ? ' big' : '') + (m.crit ? ' crit' : '');
    b.style.left = hx + 'px'; b.style.top = hy + 'px'; b.style.width = len + 'px'; b.style.transform = `rotate(${ang + off * .4}deg)`; a.appendChild(b); setTimeout(() => b.remove(), 260); }, i * 70));
  const mz = document.createElement('div'); mz.className = 'muzzle'; mz.style.left = hx + 'px'; mz.style.top = hy + 'px'; a.appendChild(mz); setTimeout(() => mz.remove(), 220);
  const im = document.createElement('div'); im.className = 'impact' + (m.boss || m.crit ? ' big' : '') + (m.crit ? ' crit' : ''); im.style.left = tx + 'px'; im.style.top = ty + 'px'; a.appendChild(im); setTimeout(() => im.remove(), 320);
  if (settings.snd) { beep(1400, .07, 'sawtooth', .04); setTimeout(() => beep(700, .09, 'square', .03), 40); if (m.boss) setTimeout(() => beep(1200, .1, 'sawtooth', .04), 140); }
}
// kleiner Schuss pro richtigem Buchstaben (nur Optik, ~0,15 s)
function miniLaser(m) {
  const a = $('arena'), ar = a.getBoundingClientRect(), hr = $('hero').getBoundingClientRect(), [tx, ty] = center(m);
  const hx = hr.left - ar.left + hr.width / 2, hy = hr.top - ar.top + hr.height * .35, dx = tx - hx, dy = ty - hy;
  const b = document.createElement('div'); b.className = 'laser mini'; b.style.left = hx + 'px'; b.style.top = hy + 'px'; b.style.width = Math.hypot(dx, dy) + 'px';
  b.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`; a.appendChild(b); setTimeout(() => b.remove(), 160);
  const sp = document.createElement('div'); sp.className = 'impact mini'; sp.style.left = tx + 'px'; sp.style.top = ty + 'px'; a.appendChild(sp); setTimeout(() => sp.remove(), 180);
  if (settings.snd) beep(1800 + Math.random() * 300, .03, 'square', .015);
}
// ---------- Belohnungen (freischaltbar durch Fortschritt, nur lokal) ----------
const prog = Object.assign({ pops: 0, wins: 0, solved: 0, kept: [] }, LS.get('prog', {})), saveProg = () => LS.set('prog', prog);
// 1.9: Belohnungen gibt es für gelöste Problemwörter (vorher falsch, jetzt richtig), Reihenfolge = rank, Schwelle V.rewardNeed(rank)
const SKINS = [{ id: 'hero', n: 'Astronaut' }, { id: 'skin-green', n: 'Grüner Glibber', rank: 2 }, { id: 'skin-blue', n: 'Blauer Blubb', rank: 4 },
  { id: 'skin-pink', n: 'Pinker Pixel', rank: 6 }, { id: 'skin-yellow', n: 'Gelber Blitz', rank: 8 }, { id: 'skin-gold', n: 'Goldener Held', rank: 10 }];
const LASERS = [{ id: 'red', n: 'Rot', c: '#ff4d6d' }, { id: 'green', n: 'Grün', c: '#5cff7a', rank: 1 }, { id: 'blue', n: 'Blau', c: '#4dc3ff', rank: 3 },
  { id: 'purple', n: 'Lila', c: '#c77dff', rank: 5 }, { id: 'gold', n: 'Gold', c: '#ffd84a', rank: 7 }, { id: 'rainbow', n: 'Regenbogen', c: '#ff4d6d', rank: 9 }];
// Migration auf 1.9: bereits freigeschaltete Belohnungen bleiben, offene Problemwörter aus der Statistik übernehmen
if (!prog.v19) { const old = LS.get('unlocked', []) || []; prog.kept = [...SKINS, ...LASERS].filter(r => r.rank && old.includes(r.n)).map(r => r.id);
  V.migrateProblems(stats); saveStats(); prog.v19 = true; saveProg(); }
const rn = r => T((r.c ? 'lz_' : 'skin_') + r.id);
// 1.19: freigeschaltet ist, was in prog.kept steht (wird von V.grantReward befüllt: sichere Wörter UND Lerntage, max. 1 pro Tag)
const unlocked = r => !r.rank || prog.kept.includes(r.id);
const ALL_REW = () => [...SKINS, ...LASERS];
// Umstieg auf 1.19: alles, was nach der alten Regel (gelöste Problemwörter) schon frei war, bleibt frei
if (V.migrateRewards119(prog, stats, ALL_REW().filter(r => r.rank && (prog.kept.includes(r.id) || (prog.solved || 0) >= V.rewardNeed(r.rank))).map(r => r.id))) { saveStats(); saveProg(); }
const need = r => { if (!r.rank) return ''; const n = V.rewardNeeds(r.rank); return T('rewNeed', { m: n.m, d: n.d }); };
// nächste noch gesperrte Belohnung (nach Rang) und Fortschritt dorthin
const nextReward = () => [...SKINS, ...LASERS].filter(r => r.rank && !unlocked(r)).sort((a, b) => a.rank - b.rank)[0];
// 1.19 kindgerecht: „Noch 3 sichere Wörter und 1 Lerntag – dann gibt's: Gelber Blitz 🎁“
const progressText = () => { const g = V.rewardGap(prog, ALL_REW()); if (!g) return T('rewAll', { m: prog.mastered || 0 });
  const parts = []; if (g.m) parts.push(T(g.m === 1 ? 'rewWord1' : 'rewWords', { n: g.m })); if (g.d) parts.push(T(g.d === 1 ? 'rewDay1' : 'rewDays', { n: g.d }));
  if (!parts.length) return T(g.today ? 'rewTomorrow' : 'rewReady', { r: rn(g.r) }); return T('rewNext', { p: parts.join(T('rewAnd')), r: rn(g.r) }); };
function renderRewards() { const opt = (r, cur) => `<option value="${r.id}" ${unlocked(r) ? '' : 'disabled'} ${r.id === cur ? 'selected' : ''}>${unlocked(r) ? '' : '🔒 '}${esc(rn(r))}${unlocked(r) ? '' : ' (' + need(r) + ')'}</option>`;
  $('skinSel').innerHTML = SKINS.map(r => opt(r, settings.skin)).join(''); $('laserSel').innerHTML = LASERS.map(r => opt(r, settings.laser)).join('');
  $('progInfo').textContent = progressText() + ' ' + T('rewHow'); $('sayRow').hidden = false; $('speechInfo').textContent = speechInfo(); }
function applyLook() { const sk = SKINS.find(r => r.id === settings.skin && unlocked(r)) || SKINS[0], lz = LASERS.find(r => r.id === settings.laser && unlocked(r)) || LASERS[0];
  $('hero').style.backgroundImage = `url(img/${sk.id}.png)`; $('arena').style.setProperty('--lz', lz.c); $('arena').classList.toggle('rainbow', lz.id === 'rainbow'); applyLrsUi(); }
function checkUnlocks() { const known = LS.get('unlocked', null), now = [...SKINS, ...LASERS].filter(unlocked).map(r => r.n);
  if (known) { const fresh = now.filter(n => !known.includes(n)); if (fresh.length) toast(T('unlockedToast', { r: fresh.map(id => { const r = [...SKINS, ...LASERS].find(x => x.n === id); return r ? rn(r) : id; }).join(', ') }), true, 3000); }
  LS.set('unlocked', now); }
// ---------- Aussprache (Capacitor-TTS auf Android, sonst Web Speech API) ----------
// ---- Sprachausgabe (1.12): nur die Systemstimme – Android-TTS (Capacitor-Plugin über bridge.js / Native-Bridge), im Browser Web Speech ----
// Bis 1.10 stumm auf Android: @capacitor/core wird nicht geladen, daher gab es Capacitor.Plugins.TextToSpeech nicht, und die
// Android-WebView hat keine Web Speech API → canSpeak() war false. Seit 1.11 direkt über die Native-Bridge (Capacitor.nativePromise).
const SPEECH = () => settings.speech !== false;
const NATIVE = () => { const c = window.Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()); };
const TTS = () => { const c = window.Capacitor; if (!c) return null; if (c.Plugins && c.Plugins.TextToSpeech) return c.Plugins.TextToSpeech;
  if (NATIVE() && c.nativePromise) return { speak: o => c.nativePromise('TextToSpeech', 'speak', o), stop: () => c.nativePromise('TextToSpeech', 'stop', {}), getSupportedVoices: () => c.nativePromise('TextToSpeech', 'getSupportedVoices', {}) };
  return null; };
// Sprache des vorgelesenen Wortes = Sprache von Spalte 1 der Liste (z. B. [zh-de] → Chinesisch)
const TTSL = { en: 'en-GB', de: 'de-DE', zh: 'zh-CN', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT', tr: 'tr-TR', pl: 'pl-PL', ru: 'ru-RU', nl: 'nl-NL', la: 'it-IT' };
const ttsTag = l => TTSL[l || 'en'] || l || 'en-GB';
// Web Speech (Edge/Chrome unter Windows): getVoices() ist anfangs oft leer und füllt sich erst mit 'voiceschanged'.
// Bis 1.12 galt das als „keine Stimme“ → canSpeak() false → nach richtigen Antworten wurde nie gesprochen (nur 🔊 Test ging).
const WEB = () => typeof window.speechSynthesis !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
let wVoices = [];
function loadWebVoices() { if (!WEB()) return wVoices; try { const v = speechSynthesis.getVoices() || []; if (v.length) wVoices = [...v]; } catch {} return wVoices; }
// Stimme für die Sprache (weiblich bevorzugt, lokal vor online); gibt es keine (z. B. deutsches Windows ohne englische Stimme) → null = Standardstimme mit lang
const voiceFor = (l = 'en', localOnly = false) => { const all = (wVoices.length ? wVoices : loadWebVoices()).filter(v => !localOnly || v.localService !== false); const p = V.pickVoice(all, ttsTag(l)); return p ? p.x : null; };
if (WEB()) { const upd = () => { loadWebVoices(); try { if ($('settings').classList.contains('on')) $('speechInfo').textContent = speechInfo(); } catch {} };
  try { speechSynthesis.addEventListener('voiceschanged', upd); } catch { try { speechSynthesis.onvoiceschanged = upd; } catch {} }
  loadWebVoices(); [250, 1000, 3000].forEach(ms => setTimeout(upd, ms)); }
let nVoices = null; const nativeVoice = l => { if (!nVoices) return -1; const p = V.pickVoice(nVoices, ttsTag(l)); return p ? p.i : -1; };
function loadNativeVoices() { const t = TTS(); if (!t || !t.getSupportedVoices || nVoices) return; t.getSupportedVoices().then(r => { nVoices = (r && r.voices) || []; }).catch(e => { nVoices = []; speechLog('voices', e); }); }
// Sprechen geht immer, wenn es Android-TTS oder Web Speech gibt – auch ohne passende Stimme (dann Standardstimme mit lang), auch wenn die Stimmen noch laden
const canSpeak = l => !!TTS() || WEB() || !!window.__vmSpeakTest;
function speechLog(src, e) { const m = src + ': ' + (e && e.message || e); window.__speechErr = (window.__speechErr || []).concat(m).slice(-10); try { console.warn('[speech]', m); } catch {} }
// 1.17 Sprach-Manager: immer nur EINE Äußerung. Jede neue Runde / jedes neue Wort / jede neue Äußerung bricht Altes ab;
// ein Token verwirft verspätete Timer und Callbacks (Grund für „altes Wort nochmal“ und das Verschlucken auf Android).
let sayTok = 0, sayTimers = [], sayLast = { k: '', t: 0 };
function stopSpeech() { sayTok++; sayTimers.forEach(clearTimeout); sayTimers = []; sayLast = { k: '', t: 0 }; window.__speechStops = (window.__speechStops || 0) + 1;
  try { if (WEB() && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch {}
  try { const t = TTS(); if (t && t.stop) Promise.resolve(t.stop()).catch(() => {}); } catch {} }
function sayLater(text, l, ms) { if (!ms) { speak(text, l); return; } const tok = sayTok; sayTimers.push(setTimeout(() => { if (tok === sayTok) speak(text, l); }, ms)); }
function webSpeak(text, l, v, tries, tok) {
  if (tok !== sayTok) return;
  const s = speechSynthesis, u = new SpeechSynthesisUtterance(text); if (v) u.voice = v; u.lang = v ? v.lang : ttsTag(l); u.rate = 0.85; u.volume = 1;
  window.__vmUtt = u;   // Referenz halten: Chrome/Edge verwerfen sonst gelegentlich die Äußerung (GC), onend kommt nie
  window.__speechVia = 'webspeech'; window.__webVoice = v ? v.name : '(Standard, ' + u.lang + ')';
  u.onerror = e => { const err = e && e.error; speechLog('webspeech', err || e);
    // Online-Stimme (Edge „… Online (Natural)“) ohne Internet → einmal mit lokaler Stimme bzw. Standardstimme wiederholen
    if (tok === sayTok && tries < 1 && err !== 'interrupted' && err !== 'canceled') webSpeak(text, l, v && v.localService === false ? voiceFor(l, true) : null, tries + 1, tok); };
  const busy = s.speaking || s.pending; if (busy) s.cancel(); try { if (s.paused) s.resume(); } catch {}
  // Chrome-Eigenheit: speak() direkt nach cancel() wird manchmal verschluckt → kurz warten
  if (busy) setTimeout(() => { if (tok === sayTok) s.speak(u); }, 60); else s.speak(u);
}
function ttsSpeak(text, l, tok) {
  try { const t = TTS(); if (t) { loadNativeVoices(); window.__speechVia = 'native-tts'; const vi = nativeVoice(l); if (nVoices && nVoices.length && vi < 0) speechLog('native-tts', 'keine Stimme für ' + ttsTag(l) + ' – Systemstandard');
      // QUEUE_FLUSH (0): Android verwirft selbst alles, was noch in der Warteschlange steht
      t.speak({ text, lang: ttsTag(l), rate: 0.85, pitch: 1.0, volume: 1, voice: vi, queueStrategy: 0 }).catch(e => { if (tok === sayTok) speechLog('native-tts', e); }); return; }
    if (WEB()) { webSpeak(text, l, voiceFor(l), 0, tok); return; }
    speechLog('none', 'keine Sprachausgabe verfügbar'); } catch (e) { speechLog('tts', e); } }
function speak(text, l = 'en') { if (!SPEECH()) return; text = V.speakText(text); if (!text) return;
  const k = text + '|' + l, now = performance.now(); if (k === sayLast.k && now - sayLast.t < 300) return;   // Doppel-Aufruf (z. B. Doppeltipp) ignorieren
  sayLast = { k, t: now }; const tok = ++sayTok; sayTimers.forEach(clearTimeout); sayTimers = []; window.__spoken = (window.__spoken || []).concat(text); window.__spokenLang = (window.__spokenLang || []).concat(ttsTag(l));
  ttsSpeak(text, l, tok); }
const speechInfo = () => { const t = TTS(), web = WEB(); let v = '–';
  if (t) { const p = nVoices && V.pickVoice(nVoices, ttsTag('en')); v = p ? p.x.name : T('voiceDefault'); }
  else if (web) { const x = voiceFor('en'); v = x ? x.name + (x.localService === false ? ' (online)' : '') : (loadWebVoices().length ? T('noEnVoice') : T('voicesLoading')); }
  return T('speechInfo', { f: t ? T('fbNative') : web ? T('fbWeb') : T('fbNone'), v }); };
loadNativeVoices();
// ---------- Welten (nur Optik, kein Einfluss auf die Schwierigkeit) ----------
const WORLDS = { get length() { return 7; } }, worldName = i => T('worlds')[i];
const FINAL_LEVEL = 10, FINAL_HP = 5;
function worldFor(level) { const i = Math.floor((level - 1) / 2); return G.endless ? i % WORLDS.length : Math.min(4, i); }
function setWorld(force) { const w = G.finalPending ? 5 : worldFor(G.level); if (w === G.world && !force) return; G.world = w; $('arena').dataset.w = w;
  $('worldName').textContent = worldName(w); fx('on', $('worldBan'), 2000); }
function nextFinalWord(m) { const w = V.pickNext(G.words, stats, { exclude: new Set([V.wkey(m.w)]), recent: G.recent }) || m.w;  G.recent.push(V.wkey(w)); const p = qa(w);
  m.w = w; m.a = p.a; m.q = p.q; m.tries = 0; m.el.querySelector('.tag').innerHTML = sylHtml(V.display(p.q), qLang(w)); }
function victory() { G.hold = true; prog.wins++; saveProg(); flash(); shake();
  [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, .2, 'square', .06), i * 150));
  $('winStats').innerHTML = '<p>' + esc(T('winStats', { s: G.score, l: G.level, p: G.pops, c: G.best, h: G.lives })) + '</p>';
  $('winEnd').disabled = $('winEndless').disabled = true; setTimeout(() => $('winEnd').disabled = $('winEndless').disabled = false, FAST() ? 400 : 1500);   // keine versehentlichen Tipps direkt nach dem Sieg
  $('win').classList.add('on'); checkUnlocks(); }
$('winEnd').onclick = () => { $('win').classList.remove('on'); if (!G) return; G.won = true; gameOver(); };
$('winEndless').onclick = () => { $('win').classList.remove('on'); if (!G) return; G.won = true; G.endless = true; G.level++; G.hold = false; G.last = performance.now(); hud(); setWorld(true); toast(T('endless'), true); };
const PX = ['#ffd84a', '#ffffff', '#5cb83a', '#6fb6f2', '#e04848', '#9a6a3c'];
function center(m) { const a = $('arena'), f = m.el.querySelector('.face') || m.el, r = f.getBoundingClientRect(), ar = a.getBoundingClientRect(); return [r.left - ar.left + r.width / 2, r.top - ar.top + r.height / 2]; }
function particles(m, n, cols, dist, at) { const a = $('arena'), [cx, cy] = at || center(m);
  for (let i = 0; i < n; i++) { const p = document.createElement('div'), ang = Math.random() * Math.PI * 2, d = dist * (.4 + Math.random() * .8);
    p.className = 'px'; p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.setProperty('--c', cols[i % cols.length]); p.style.setProperty('--s', (4 + 4 * Math.floor(Math.random() * 3)) + 'px');
    p.style.setProperty('--dx', Math.round(Math.cos(ang) * d / 4) * 4 + 'px'); p.style.setProperty('--dy', Math.round((Math.sin(ang) * d + d * .3) / 4) * 4 + 'px'); p.style.setProperty('--t', (.5 + Math.random() * .5) + 's');
    a.appendChild(p); setTimeout(() => p.remove(), 1100); } }
function critFx(m, c) { G.crits = (G.crits || 0) + 1; const a = $('arena'), [cx, cy] = m.c || center(m), b = document.createElement('div'); b.className = 'critban'; b.innerHTML = esc(T(c.lucky ? 'critLucky' : 'crit')) + '<small>' + esc(T(c.lucky ? 'critLuckyNote' : 'critNote', { s: (c.ms / 1000).toFixed(1), p: (c.prev / 1000).toFixed(1), b: (c.best / 1000).toFixed(1) })) + '</small>'; if (c.lucky) b.classList.add('lucky');
  b.style.left = Math.min(Math.max(cx, 120), a.clientWidth - 120) + 'px'; b.style.top = Math.max(cy, 110) + 'px'; a.appendChild(b); setTimeout(() => b.remove(), 2200);   // 1.16: länger sichtbar
  const r = document.createElement('div'); r.className = 'critring'; r.style.left = cx + 'px'; r.style.top = cy + 'px'; a.appendChild(r); setTimeout(() => r.remove(), 600);
  particles(m, 30, ['#ffd84a', '#fff', '#ff4dd2', '#4dc3ff'], 200, [cx, cy]); flash(); buzz([30, 30, 60]);
  if (settings.snd) [880, 1320, 1760, 2640].forEach((f, i) => setTimeout(() => beep(f, .09, 'square', .05), i * 55)); }
function burst(m, pts) { const a = $('arena'), [cx, cy] = m.c || center(m);
  if (m.boss) { const c = document.createElement('div'); c.className = 'corpse'; c.style.cssText = sprite(m.spr); c.style.left = cx + 'px'; c.style.top = cy + 'px'; a.appendChild(c); setTimeout(() => c.remove(), 1050);
    flash(); shake(); particles(m, 48, PX, 220, [cx, cy]); setTimeout(() => G && particles(m, 28, ['#ffd84a', '#fff'], 160, [cx, cy]), 250); }
  else particles(m, 22, PX, 130, [cx, cy]);
  // 1.18 PLOPP-Effekt (Ring + Schriftzug)
  const pl = document.createElement('div'); pl.className = 'plopp' + (m.boss ? ' big' : ''); pl.textContent = 'PLOPP!'; pl.style.left = cx + 'px'; pl.style.top = cy + 'px'; a.appendChild(pl); setTimeout(() => pl.remove(), 700);
  const rg = document.createElement('div'); rg.className = 'ploppring'; rg.style.left = cx + 'px'; rg.style.top = cy + 'px'; a.appendChild(rg); setTimeout(() => rg.remove(), 500);
  const t = document.createElement('div'); t.className = 'pts'; t.textContent = '+' + pts; t.style.left = cx + 'px'; t.style.top = cy + 'px'; a.appendChild(t); setTimeout(() => t.remove(), 950); }
let toastT; function toast(msg, good, ms = 1800) { const t = $('toast'); t.textContent = msg; t.className = 'on' + (good ? ' ok' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = '', ms); }
function setTyped(s) { if (!G) return; G.typed = s; $('typed').textContent = s; target(); if (!s) G.used = []; renderAlt(); fitTyped(); }
// 1.18: lange Wörter passen ins (schmalere) Eingabefeld – Schrift wird nur so weit kleiner wie nötig, nie unter 20 px
function fitTyped() { const el = $('typed'), bar = $('inputBar'); el.style.fontSize = ''; if (!el.textContent && !el.children.length) return; const cs = getComputedStyle(bar);
  const avail = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16; let fs = parseFloat(getComputedStyle(el).fontSize);
  for (let i = 0; i < 12 && el.scrollWidth > avail && fs > 20; i++) { fs = Math.max(20, fs * 0.9); el.style.fontSize = fs + 'px'; } }
// ---------- Eingabe-Modi: Buchstaben-Kacheln / Multiple Choice (gleiche Prüfung wie beim Tippen) ----------
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mainAnswer = V.speakText;
// Kacheln nur aus Zeichen, die bei der Prüfung zählen (keine ?!.,-Reste), Leerzeichen bleiben
const tileText = a => [...mainAnswer(a)].filter(c => c === ' ' || V.norm(c)).join('').replace(/\s+/g, ' ').trim();
// 1.11 Bugfix: Bei Kacheln mit 2 Monstern (Challenger) sprang das Ziel mitten im Wort auf ein tieferes Monster – der halbe Text blieb stehen,
// die Kacheln gehörten aber zum neuen Wort → nicht mehr lösbar. Jetzt bleibt das angefangene Wort Ziel, solange sein Monster lebt.
const tileStarts = (m, t) => { const w = tileText(m.a); return w.startsWith(t) || V.norm(w).startsWith(V.norm(t)); };
function altTarget() { if (!G || !G.mons.length) return null;
  if (IN() === 'kacheln' && G.typed) { if (G.lock && G.mons.includes(G.lock) && tileStarts(G.lock, G.typed)) return G.lock; const keep = G.mons.find(m => tileStarts(m, G.typed)); if (keep) return keep; }
  return [...G.mons].sort((a, b) => b.y - a.y)[0]; }
function mcOptions(m) {
  const right = mainAnswer(m.a), seen = new Set(V.variants(m.a)), out = [right];
  const pool = shuffle(G.words.map(w => qa(w, m.flip).a));
  const add = list => { for (const a of list) { if (out.length >= 4) break; const vs = V.variants(a); if (!vs.length || vs.some(v => seen.has(v))) continue; vs.forEach(v => seen.add(v)); out.push(mainAnswer(a)); } };
  add(pool);
  // 1.11: kleine Listen (1–3 Wörter) → Ablenker aus anderen Listen mit demselben Sprachpaar, sonst gäbe es nur eine Auswahl
  if (out.length < 4) add(shuffle(model.lists.flatMap(V.listWords).filter(w => (w.la || 'en') === (m.w.la || 'en') && (w.lb || 'de') === (m.w.lb || 'de')).map(w => qa(w, m.flip).a)));
  return shuffle(out);
}
function renderAlt(force) {
  if (G && G.curMode !== IN()) { inputUi(); force = true; }
  const box = $('alt'); if (!G || IN() === 'tippen') return; const m = altTarget();
  const key = m ? m.id + ':' + m.hp + ':' + G.fixes : 'none';
  if (key !== G.altKey && G.altKey && G.typed && IN() === 'kacheln' && m && !tileStarts(m, G.typed)) { G.typed = ''; $('typed').textContent = ''; target(); } // Ziel weg (geplatzt/entkommen) → Rest-Eingabe verwerfen
  if (key !== G.altKey || force) { G.altKey = key; G.used = []; G.tileWord = m && IN() === 'kacheln' ? tileText(m.a) : ''; G.altItems = !m ? [] : IN() === 'mc' ? mcOptions(m) : shuffle([...G.tileWord.replace(/ /g, '')]); }
  // 1.16 Silben: Slots je Silbe abwechselnd leicht hinterlegt (Sprache der Antwort)
  const smap = IN() === 'kacheln' && settings.syl && m ? L.sylIndexMap(G.tileWord, aLang(m.w, m.flip)) : null;
  if (IN() === 'kacheln') $('typed').innerHTML = [...G.tileWord].map((c, i) => c === ' ' ? '<i class="gap"></i>' : `<span class="slot${i < G.typed.length ? ' f' : ''}${smap && smap[i] >= 0 ? ' syl s' + (smap[i] % 2) + (smap[i + 1] !== smap[i] ? ' se' : '') : ''}">${i < G.typed.length ? esc(G.typed[i]) : '_'}</span>`).join('');
  if (IN() === 'mc') box.innerHTML = G.altItems.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('');
  else box.innerHTML = '<div class="tiles">' + G.altItems.map((c, i) => `<button class="tile${G.used.includes(i) ? ' used' : ''}" data-i="${i}" ${G.used.includes(i) ? 'disabled' : ''}>${c === ' ' ? '␣' : esc(c)}</button>`).join('') +
    `</div><div class="tilefn"><button class="undo" data-fn="undo">${T('undo')}</button><button class="clr" data-fn="clr">${T('clear')}</button><button class="okb" data-fn="ok">OK ✔</button></div>`;
}
$('alt').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || !G || G.paused || G.hold) return; e.preventDefault();
  b.classList.add('dn'); setTimeout(() => b.classList.remove('dn'), 110);
  if (b.dataset.fn === 'undo') { if (G.used.length) { const u = G.used.slice(0, -1); setTyped(G.typed.replace(/ +$/, '').slice(0, -1).replace(/ +$/, '')); G.used = u; renderAlt(); } return; }
  if (b.dataset.fn === 'clr') { setTyped(''); return; }
  if (b.dataset.fn === 'ok') { submit(); return; }
  const i = +b.dataset.i;
  if (IN() === 'mc') { const o = G.altItems[i], m = altTarget(); if (!m) return;
    if (V.isMatch(o, m.a)) { setTyped(o); strike(m); } else { G.typed = o; submit(); } return; }
  if (G.used.includes(i)) return; const used = [...G.used, i]; G.used = used; key(G.altItems[i]);
  while (G && G.used === used && G.tileWord[G.typed.length] === ' ') { G.typed += ' '; }   // Wortlücken automatisch
  if (G && G.typed && G.used === used) { renderAlt(); if (used.length === G.altItems.length) submit(); }
});
function hud() { $('lives').textContent = G.lives; $('level').textContent = G.level; $('score').textContent = G.score; $('combo').textContent = G.combo; $('comboBox').classList.toggle('hot', G.combo >= 3); }
function pause() { if (!G || G.paused) return; G.paused = true; $('pause').classList.add('on'); }
function resume() { if (!G) return; G.paused = false; G.last = performance.now(); $('pause').classList.remove('on'); }
$('pauseBtn').onclick = pause; $('resumeBtn').onclick = resume;
$('quitBtn').onclick = () => { $('pause').classList.remove('on'); endGame(); G = null; show('home'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (dirty) ST.keepLocal(V.serializeFile(model), false); } });
function endGame() { stopSpeech(); cancelAnimationFrame(raf); if (G) G.mons.forEach(m => m.el.remove()); }
// ---------- Highscores pro Vokabelbuch (nur localStorage, nicht in vokabeln.txt) ----------
const ICO_OK = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const TEMPO_ICO = { ohne: '⏸', sehrlangsam: '🐌', langsam: '🐢', normal: '🐇', schnell: '🚀', challenger: '🔥' }, MODE_ICO = { tippen: '⌨', kacheln: '🔤', mc: '✅' };
const TEMPO_TXT = new Proxy({}, { get: (o, k) => typeof k === 'string' && ICO_OK(TEMPO_ICO, k) ? T('tp_' + k) : undefined }), MODE_TXT = new Proxy({}, { get: (o, k) => typeof k === 'string' && ICO_OK(MODE_ICO, k) ? T('md_' + k) : undefined });
const shortName = n => String(n).split(' – ')[0].replace(/\s*\(.*\)\s*$/, '').trim() || String(n);   // 1.18: „Unit 2: Familie & Zuhause – Startliste (…)“ → „Unit 2: Familie & Zuhause“
const hsHead = id => `<h3 class="hshead">🏆 ${esc(shortName(listName(id)))}</h3>`;
function masteryText(id) { if (!id) return ''; const ws = id === 'weak' ? [] : (id === 'all' ? model.lists : model.lists.filter(l => 'L:' + l.name === id)).flatMap(V.listWords);
  if (!ws.length) return ''; const keys = [...new Set(ws.map(V.wkey))]; return T('mastery', { a: keys.filter(k => V.isMastered(stats[k])).length, b: keys.length }); }
// Tabellen pro Liste UND Antwort-Art: Schlüssel "Liste|Modus" (1.6). Einträge aus 1.5 werden nach ihrem gespeicherten Modus einsortiert.
(function migrateHs() { const old = LS.get('hs', null); if (!old || LS.get('hs2', null)) return; const n = {};
  for (const [id, l] of Object.entries(old)) for (const e of l) { const k = id + '|' + (e.mode || 'tippen'); (n[k] = n[k] || []).push(e); }
  for (const k in n) n[k].sort((a, b) => b.score - a.score || a.t - b.t).splice(10); LS.set('hs2', n); localStorage.removeItem('vm.hs'); })();
const HSMAX = 10, hsAll = () => LS.get('hs2', {}), hsOf = id => (hsAll()[id] || []), hkey = (list, mode) => list + '|' + mode, listOf = id => String(id).split('|')[0];
let hsMode = 'tippen';
const listName = id => (id = listOf(id)) === 'all' ? T('allLists') : id === 'weak' ? T('weakWords') : id === 'prob5' ? T('probList') : String(id).replace(/^L:/, '');
function bestScore() { return Math.max(LS.get('highscore', 0) && !Object.keys(hsAll()).length ? LS.get('highscore', 0) : 0, ...Object.values(hsAll()).flat().map(e => e.score), 0); }
const qualifies = (id, score) => score > 0 && (hsOf(id).length < HSMAX || score > hsOf(id)[HSMAX - 1].score);
function addScore(id, e) { const all = hsAll(), l = [...(all[id] || []), e].sort((a, b) => b.score - a.score || a.t - b.t).slice(0, HSMAX); all[id] = l; LS.set('hs2', all); return l.indexOf(e) >= 0 ? l.findIndex(x => x.t === e.t && x.name === e.name) : -1; }
function hsHtml(id, mark) { const l = hsOf(id);
  if (!l.length) return '<p>' + esc(T('noHs')) + '</p>';
  return `<div class="hsr hsh"><span>#</span><span>${T('hsName')}</span><span>${T('hsPts')}</span><span>Lvl</span><span>${T('hsMode')}</span><span>${T('hsDate')}</span></div>` + l.map((e, i) =>
    `<div class="hsr${i === mark ? ' new' : ''}${e.tempo === 'challenger' ? ' ch' : ''}"><span>${i + 1}.</span><span>${e.won ? '👑 ' : ''}${esc(e.name)}</span><b>${e.score}</b><span>${e.level}</span><span title="${esc((TEMPO_TXT[e.tempo] || '') + ' · ' + (MODE_TXT[e.mode] || ''))}">${TEMPO_ICO[e.tempo] || '?'}${MODE_ICO[e.mode] || ''}</span><span>${new Date(e.t).toLocaleDateString(I.locale())}</span></div>`).join(''); }
function renderScores() { const sel = $('hsSel'), cur = sel.value || settings.list; if (!renderScores.done) { hsMode = settings.input; renderScores.done = true; } sel.innerHTML = '';
  const ids = [...new Set([...model.lists.map(l => 'L:' + l.name), 'all', 'weak', ...Object.keys(hsAll()).map(listOf)])];
  ids.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = listName(id) + ` (${['tippen', 'kacheln', 'mc'].reduce((a, m) => a + hsOf(hkey(id, m)).length, 0)})`; sel.appendChild(o); });
  sel.value = ids.includes(cur) ? cur : ids[0]; showHsTable(); }
function showHsTable() { const id = hkey($('hsSel').value, hsMode);
  document.querySelectorAll('#hsModes button').forEach(b => { b.classList.toggle('on', b.dataset.mode === hsMode); b.textContent = MODE_ICO[b.dataset.mode] + ' ' + MODE_TXT[b.dataset.mode] + ` (${hsOf(hkey($('hsSel').value, b.dataset.mode)).length})`; });
  $('hsTable').innerHTML = hsHtml(id); $('hsMastery').textContent = masteryText($('hsSel').value); }
$('hsSel').onchange = showHsTable;
$('hsModes').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { hsMode = b.dataset.mode; showHsTable(); } });
$('hsDel').onclick = () => { const id = hkey($('hsSel').value, hsMode); if (!hsOf(id).length) return; if (confirm(T('hsDelAsk', { l: listName(id), m: MODE_TXT[hsMode] }))) { const all = hsAll(); delete all[id]; LS.set('hs2', all); renderScores(); } };
// Namenseingabe mit eigener Pixel-Tastatur
(function () { const kb = $('nameKb'); ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', 'YXCVBNM-'].forEach(r => { const row = document.createElement('div'); row.className = 'kr';
  [...r, ...(r.length === 8 ? ['␣', '⌫'] : [])].forEach(c => { const b = document.createElement('button'); b.className = 'k' + (c === '⌫' ? ' fn w2' : c === '␣' ? ' w2' : ''); b.dataset.c = c; b.textContent = c === '␣' ? T('spaceShort') : c; if (c === '␣') b.dataset.i18n = 'spaceShort'; row.appendChild(b); }); kb.appendChild(row); });
  kb.addEventListener('pointerdown', e => { const b = e.target.closest('.k'); if (!b) return; e.preventDefault(); const n = $('nameIn'), c = b.dataset.c;
    n.value = c === '⌫' ? n.value.slice(0, -1) : (n.value + (c === '␣' ? ' ' : n.value ? c.toLowerCase() : c)).slice(0, 12); }); })();
let pendingHs = null;
function finishName(save) { if (!pendingHs) return; const p = pendingHs; pendingHs = null; $('nameDlg').classList.remove('on'); let mark = -1;
  if (save) { const name = ($('nameIn').value.trim() || T('player')).slice(0, 12); LS.set('lastName', name); p.e.name = name; mark = addScore(p.id, p.e); }
  $('overHs').innerHTML = hsHead(p.id) + hsHtml(p.id, mark); if (mark === 0) $('overTitle').textContent = (p.e.won ? T('victory') + ' ' : '🏆 ') + T('newRecord'); }
$('nameOk').onclick = () => finishName(true); $('nameSkip').onclick = () => finishName(false);
$('nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') finishName(true); });
function gameOver() {
  const id = hkey(G.listId || settings.list, IN()), e = { name: '', score: G.score, level: G.level, t: Date.now(), tempo: settings.speed, mode: IN(), won: !!G.won }, q = qualifies(id, G.score);
  endGame(); const rec = G.score > bestScore();
  const acc = G.hits / Math.max(1, G.hits + G.fixes), stars = G.won || (G.hits >= 5 && acc >= 0.9) ? 3 : G.hits >= 3 && acc >= 0.7 ? 2 : 1;   // 1.18 Jubel: 1–3 Sterne
  $('overStars').dataset.n = stars; $('overStars').innerHTML = [1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--i:${i}">★</i>`).join('');
  $('overTitle').textContent = G.won ? T('victory') + (rec ? ' ' + T('newRecord') : '') : rec ? '🏆 ' + T('newRecord') : T('gameOver'); checkUnlocks(); $('overMastery').textContent = masteryText(listOf(id)); $('overNote').textContent = ''; $('overHs').innerHTML = hsHead(id) + hsHtml(id);
  if (q) { pendingHs = { id, e }; $('nameIn').value = LS.get('lastName', ''); $('nameInfo').textContent = T('nameInfo', { s: G.score, l: listName(id) }); $('nameDlg').classList.add('on'); } $('finalScore').textContent = G.score;
  $('overInfo').textContent = T('overInfo', { l: G.level, p: G.pops, c: G.best });
  const uniq = [...new Map(G.missed.map(m => [V.wkey(m.w), m])).values()];
  $('missList').innerHTML = uniq.length ? '<h3>' + esc(T('practice')) + '</h3>' + uniq.map(m => `<div class="st"><span>${esc(V.display(m.q))}</span><b>${esc(V.display(m.a))}</b></div>`).join('') : '';
  window.__lastGame = G; G = null; show('over');
}
$('playBtn').onclick = () => { const sel = $('listSel'); if (!sel.value && sel.options.length) sel.selectedIndex = 0; settings.list = sel.value || 'all'; LS.set('settings', settings); start(); };
$('againBtn').onclick = () => start(window.__lastGame && window.__lastGame.listId === 'prob5' ? 'prob5' : undefined);
// Test-Schnittstelle
window.__vm = { state: () => G && { level: G.level, score: G.score, lives: G.lives, combo: G.combo, typed: G.typed, hold: G.hold, world: G.world, endless: G.endless, tileWord: G.tileWord, intro: G.intro, alt: G.altItems, input: IN(), kbLangs: $('kb').dataset.langs, speed: settings.speed, revenge: G.revenge.map(w => w.en),
    mons: G.mons.map(m => ({ q: m.q, a: m.a, boss: m.boss, kind: m.kind, hp: m.hp, y: m.y, travel: m.travel, mode: m.mode, flip: m.flip, hear: m.hear, listen: m.listen, tries: m.tries })) },
  settings: () => settings, showFix: (en, input) => { const mm = G.mons.find(x => x.w.en === en) || G.mons[0]; if (mm) showFix(mm, input, !input); }, hyph: () => ensureHyph(), setStats: s => { stats = s; saveStats(); },
  stats: () => stats, model: () => model, setSpeedFactor: f => G && G.mons.forEach(m => m.speed *= f), spawn: (en) => { const w = G.words.find(x => x.en === en || x.en.split('|')[0] === en); spawn('normal', w); }, clearMons: () => G && [...G.mons].forEach(m => remove(m)), spawnNext: () => { spawn('normal'); return G.mons.length ? G.mons[G.mons.length - 1].w.en : null; }, endNow: score => { if (!G) return; G.score = score; G.lives = 0; gameOver(); }, hs: () => hsAll(), finalNow: () => { G.level = FINAL_LEVEL + 1; G.finalPending = true; [...G.mons].forEach(m => remove(m)); setWorld(); }, setLevel: l => { G.level = l; setWorld(); hud(); }, prog: () => prog, times: () => times, spawnRevenge: (en) => { const w = G.words.find(x => x.en === en || x.en.split('|')[0] === en); spawn('revenge', w); }, progText: () => progressText(), spawnBoss: (en) => { const w = G.words.find(x => x.en === en); spawn('phrase', w); }, flush };
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => {});
applyLrsUi();
ST.init().then(async t => { loadText(t); await migrateOld(); show('home'); window.__vmReady = true; });
})();
