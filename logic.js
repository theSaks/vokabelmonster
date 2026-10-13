(function(){
// Reine Spiellogik (ohne DOM) – im Browser als window.VM, in Node per import.
const UML = [[/ä/g, 'ae'], [/ö/g, 'oe'], [/ü/g, 'ue'], [/ß/g, 'ss']];
function norm(s) {
  s = String(s || '').toLowerCase().normalize('NFC').replace(/[’‘`´]/g, "'");
  s = s.replace(/[.,!?;:"«»„“”()\[\]]/g, ' ').replace(/'/g, '');
  for (const [r, v] of UML) s = s.replace(r, v);
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(to|sich) /, '');               // "to go" == "go"
  return s;
}
// Alle akzeptierten Varianten einer Lösung ("a/an; one", "(the) cinema")
function variants(answer) {
  const out = new Set();
  for (const alt of String(answer || '').split(/[\/;]/)) {
    const a = alt.trim(); if (!a) continue;
    out.add(norm(a.replace(/\([^)]*\)/g, ' ')));     // ohne Klammerteil
    out.add(norm(a));                                 // mit Klammerinhalt
  }
  out.delete(''); return [...out];
}
function isMatch(input, answer) { const n = norm(input); return !!n && variants(answer).includes(n); }
// Erste angezeigte Lösung (für "richtig wäre …")
function display(answer) { return String(answer).split(/[\/;]/).map(s => s.trim()).filter(Boolean).join(' / '); }

// Liste parsen: "english;deutsch", "english = deutsch", Tab oder CSV mit Komma
function parseList(text) {
  const words = [], errors = [];
  String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim(); if (!line || line.startsWith('#') || line.startsWith('//')) return;
    let parts;
    if (line.includes('=')) { const k = line.indexOf('='); parts = [line.slice(0, k), line.slice(k + 1)]; }
    else if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(';')) { const k = line.indexOf(';'); parts = [line.slice(0, k), line.slice(k + 1)]; }
    else if (line.includes(',')) { const k = line.indexOf(','); parts = [line.slice(0, k), line.slice(k + 1)]; }
    else { errors.push(i + 1); return; }
    const en = parts[0].trim().replace(/^"|"$/g, ''), de = parts.slice(1).join(' ').trim().replace(/^"|"$/g, '');
    if (!en || !de) { errors.push(i + 1); return; }
    if (/^(english|englisch|en)$/i.test(en) && /^(deutsch|german|de)$/i.test(de)) return; // Kopfzeile
    words.push({ en, de });
  });
  return { words, errors };
}
const wkey = w => norm(w.en) + '|' + norm(w.de);
// Gewicht für die Auswahl: Fehler kommen deutlich öfter, gut gekonnte seltener
// Verteiltes Wiederholen: Box 0..4, nächste Fälligkeit nach 1, 3, 7, 14 Tagen. Richtig vor der Fälligkeit zählt nicht als Aufstieg.
const DAY = 864e5, SRS_DAYS = [1, 3, 7, 14], MASTER_BOX = 3;
const isDue = (st, now = Date.now()) => !st || !st.due || now >= st.due;
const isMastered = st => !!st && (st.box || 0) >= MASTER_BOX;
function weight(st, now = Date.now()) {
  if (!st) return 2.5;                               // neu: bevorzugt
  let w = (1 + 3 * (st.wrong || 0) + (st.streak === 0 && st.wrong ? 3 : 0)) / (1 + 0.6 * (st.right || 0));
  if (st.box != null) w *= isDue(st, now) ? 3 : 0.25; // fällige Wörter zuerst, nicht fällige selten
  return Math.max(0.1, Math.min(12, w));
}
function pick(words, stats, rnd = Math.random, exclude = new Set()) {
  const pool = words.filter(w => !exclude.has(wkey(w))); const src = pool.length ? pool : words;
  if (!src.length) return null;
  const ws = src.map(w => weight(stats[wkey(w)])); let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < src.length; i++) { r -= ws[i]; if (r <= 0) return src[i]; }
  return src[src.length - 1];
}
function record(stats, w, correct, now = Date.now()) {
  const k = wkey(w); const st = stats[k] || (stats[k] = { en: w.en, de: w.de, right: 0, wrong: 0, streak: 0 });
  if (correct) { st.right++; st.streak++; if (isDue(st, now)) { st.box = Math.min(SRS_DAYS.length, (st.box || 0) + 1); st.due = now + SRS_DAYS[st.box - 1] * DAY; } }
  else { st.wrong++; st.streak = 0; st.box = 0; st.due = now; }
  st.last = now; return st;
}
const isPhrase = w => norm(w.en).split(' ').length >= 3;
// Spielwerte je Level
function levelParams(level, speed = 'normal') {
  const base = { ohne: 60, sehrlangsam: 34, langsam: 17, normal: 12, schnell: 8.5, challenger: 5.5 }[speed] || 12;   // 'ohne' = ohne Zeitlimit (schwebt, kein Lebensverlust)
  return { travel: base * Math.max(0.5, 1 - 0.06 * (level - 1)), maxMonsters: Math.min(4, 1 + Math.floor((level + 1) / 2)), boss: level % 3 === 0 };
}
function points(combo, boss) { return (boss ? 50 : 10) * Math.min(5, 1 + Math.floor(combo / 3)); }

// ---- Vokabeldatei: "## Listenname" + "englisch;deutsch" ----
function parseLine(line) {
  let parts;
  if (line.includes('=')) { const k = line.indexOf('='); parts = [line.slice(0, k), line.slice(k + 1)]; }
  else if (line.includes('\t')) parts = line.split('\t');
  else if (line.includes(';')) { const k = line.indexOf(';'); parts = [line.slice(0, k), line.slice(k + 1)]; }
  else if (line.includes(',')) { const k = line.indexOf(','); parts = [line.slice(0, k), line.slice(k + 1)]; }
  else return null;
  const en = parts[0].trim().replace(/^"|"$/g, ''), de = parts.slice(1).join(' ').trim().replace(/^"|"$/g, '');
  return en && de ? { en, de } : null;
}
function parseFile(text) {
  const head = [], lists = [], errors = []; let cur = null;
  String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const h = line.match(/^##\s*(.+)$/);
    if (h) { cur = { name: h[1].trim(), items: [] }; lists.push(cur); return; }
    if (!line || line.startsWith('#') || line.startsWith('//')) { (cur ? cur.items : head).push({ raw }); return; }
    const w = parseLine(line);
    if (!w) { errors.push(i + 1); (cur ? cur.items : head).push({ raw }); return; }
    if (/^(english|englisch|en)$/i.test(w.en) && /^(deutsch|german|de)$/i.test(w.de)) return;
    if (!cur) { cur = { name: 'Meine Vokabeln', items: [] }; lists.push(cur); }
    cur.items.push(w);
  });
  return { head, lists, errors };
}
const listWords = l => l.items.filter(x => x.en != null && x.en.trim() && x.de.trim()).map(x => ({ en: x.en.trim(), de: x.de.trim() }));
function serializeFile(model) {
  const clean = s => String(s).replace(/[\r\n;]+/g, ' ').trim();
  let lines = model.head.map(x => x.raw);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  for (const l of model.lists) {
    if (lines.length) lines.push('');
    lines.push('## ' + clean(l.name));
    const body = l.items.map(x => x.raw != null ? x.raw : (x.en.trim() && x.de.trim() ? clean(x.en) + ';' + clean(x.de) : null)).filter(x => x != null);
    while (body.length && !body[body.length - 1].trim()) body.pop();
    while (body.length && !body[0].trim()) body.shift();
    lines.push(...body);
  }
  return lines.join('\n') + '\n';
}
// Fallzeit: lange Antworten fallen langsamer (mehr Sekunden pro Buchstabe)
function lengthFactor(answer) {
  const n = String(answer).split(/[\/;]/)[0].replace(/\([^)]*\)/g, '').trim().length || 1;
  return Math.max(0.65, Math.min(2.4, 0.45 + 0.11 * n));
}
function travelFor(answer, level, speed) { return levelParams(level, speed).travel * lengthFactor(answer); }
// Vergleich Kind-Eingabe vs. Lösung, Buchstabe für Buchstabe
function bestVariant(input, answer) {
  const n = norm(input), alts = String(answer).split(/[\/;]/).map(s => s.trim().replace(/\([^)]*\)\s*/g, '')).filter(Boolean);
  let best = alts[0] || '', sc = -1;
  for (const a of alts) { const na = norm(a); let s = 0; for (let i = 0; i < Math.min(na.length, n.length); i++) if (na[i] === n[i]) s++; if (s > sc) { sc = s; best = a; } }
  return best;
}
function diffChars(input, target) {
  const a = String(input || '').toLowerCase(), t = String(target).toLowerCase();
  return [...String(input || '')].map((ch, i) => ({ ch, ok: a[i] === t[i] }));
}
const VM_API = { isDue, isMastered, SRS_DAYS, parseLine, parseFile, listWords, serializeFile, lengthFactor, travelFor, bestVariant, diffChars, norm, variants, isMatch, display, parseList, wkey, weight, pick, record, isPhrase, levelParams, points };
if (typeof module !== 'undefined' && module.exports) module.exports = VM_API; else window.VM = VM_API;
})();
