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
const splitPy = a => { const k = a.indexOf('|'); return [a.slice(0, k).trim(), a.slice(k + 1).trim()]; };
// Pinyin ohne Tonzeichen; keepU: ü bleibt ü (lǚ → lü)
const toneless = (s, keepU) => String(s).normalize('NFD').replace(keepU ? /[\u0300-\u0307\u0309-\u036f]/g : /[\u0300-\u036f]/g, '').normalize('NFC');
const hasPinyin = a => String(a).split(/[\/;]/).some(x => x.includes('|'));
const isHan = s => /[\u3400-\u9fff\uf900-\ufaff]/.test(String(s));
// Alle akzeptierten Varianten einer Lösung ("a/an; one", "(the) cinema")
function variants(answer) {
  const out = new Set();
  for (const alt of String(answer || '').split(/[\/;]/)) {
    const a = alt.trim(); if (!a) continue;
    if (a.includes('|')) { const [h, py] = splitPy(a);   // Chinesisch "汉字|hàn zì": Zeichen ODER Pinyin (mit/ohne Töne, mit/ohne Leerzeichen)
      for (const v of [h, py, toneless(py, true), toneless(py)]) { const n = norm(v); if (n) { out.add(n); out.add(n.replace(/ /g, '')); } } continue; }
    out.add(norm(a.replace(/\([^)]*\)/g, ' ')));     // ohne Klammerteil
    out.add(norm(a));                                 // mit Klammerinhalt
  }
  out.delete(''); return [...out];
}
function isMatch(input, answer) { const n = norm(input); return !!n && variants(answer).includes(n); }
// Erste angezeigte Lösung (für "richtig wäre …")
function display(answer) { return String(answer).split(/[\/;]/).map(s => s.trim()).filter(Boolean).map(s => s.includes('|') ? splitPy(s).join(' (') + ')' : s).join(' / '); }

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
  const k = wkey(w); const st = stats[k] || (stats[k] = { en: w.en, de: w.de, right: 0, wrong: 0, streak: 0 }); if (w.la) { st.la = w.la; st.lb = w.lb; }
  st.solved = false;
  if (correct) { if (st.prob) { st.prob = false; st.solves = (st.solves || 0) + 1; st.solved = true; } st.right++; st.streak++; if (isDue(st, now)) { st.box = Math.min(SRS_DAYS.length, (st.box || 0) + 1); st.due = now + SRS_DAYS[st.box - 1] * DAY; } }
  else { st.prob = true; st.wrong++; st.streak = 0; st.box = 0; st.due = now; }
  st.last = now; return st;
}
// 1.9 Belohnungen: k-te Belohnung nach k·(k+1)/2 gelösten Problemwörtern (1, 3, 6, 10, 15, 21, 28, 36, 45, 55)
const rewardNeed = k => k * (k + 1) / 2;
const rewardsEarned = solved => { let k = 0; while (rewardNeed(k + 1) <= solved) k++; return k; };
// Altstände: Wörter, die zuletzt falsch waren (Serie 0), gelten als offene Problemwörter
function migrateProblems(stats) { let n = 0; for (const st of Object.values(stats)) if (st && st.prob == null) { st.prob = (st.wrong || 0) > 0 && !st.streak; if (st.prob) n++; } return n; }
// 1.10 Tempo-Krit: Zeit vom Erscheinen bis zur richtigen Lösung je Wort und Eingabeart.
// CRIT, wenn schneller als die letzte gespeicherte Zeit um mindestens max(10 %, 300 ms). Erster Versuch zählt nie.
// 1.12 Glückstreffer: Ist ein Wort schon am Tempo-Limit, kann die Regel oben kaum noch greifen. Darum: kein Verbesserungs-Krit,
// aber Zeit höchstens 10 % über der Bestzeit (≤ best × 1,1) → mit 18 % Wahrscheinlichkeit Glückstreffer (gleicher Bonus +50 %).
// rnd ist für Tests austauschbar (Standard Math.random).
const CRIT_MIN_MS = 300, CRIT_FRAC = 0.1, CRIT_BONUS = 0.5, LUCKY_NEAR = 0.1, LUCKY_P = 0.18;
function recordTime(times, key, mode, ms, rnd = Math.random) {
  const k = key + '#' + mode, prev = times[k]; ms = Math.round(ms);
  const better = !!prev && prev.last > 0 && ms <= prev.last - Math.max(CRIT_MIN_MS, CRIT_FRAC * prev.last);
  const near = !better && !!prev && prev.best > 0 && ms <= prev.best * (1 + LUCKY_NEAR);
  const lucky = near && rnd() < LUCKY_P;
  times[k] = { last: ms, best: prev ? Math.min(prev.best, ms) : ms, n: (prev ? prev.n : 0) + 1 };
  return { crit: better || lucky, lucky, near, prev: prev ? prev.last : null, best: prev ? prev.best : null, ms };
}
// 1.12 „Nur Belohnungen zurücksetzen“: Zähler gelöster Problemwörter + übernommene Belohnungen weg, alles andere bleibt
function resetRewards(prog) { prog.solved = 0; prog.kept = []; prog.v19 = true; return prog; }
const critPoints = pts => Math.round(pts * (1 + CRIT_BONUS));
// 1.10 Neues Schuljahr: diese localStorage-Schlüssel werden gelöscht (Vokabellisten liegen in der Datei und bleiben)
const RESET_KEYS = ['prog', 'stats', 'unlocked', 'times'], HS_KEYS = ['hs2', 'hs', 'highscore'];
const resetKeys = clearHs => clearHs ? [...RESET_KEYS, ...HS_KEYS] : [...RESET_KEYS];
// Sprachausgabe: Hauptform einer Antwort (erste Alternative, ohne Klammerteile)
const speakText = a => display(a).split(' / ')[0].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
// Weibliche Stimme bevorzugen (Android-TTS / Web Speech liefern kein Geschlecht – Namensheuristik), Sprache muss passen
const FEMALE_RE = /female|frau|weiblich|woman|samantha|zira|susan|hazel|libby|sonia|kate|serena|karen|moira|tessa|fiona|victoria|allison|ava|joanna|amy|emma|jenny|aria|ting-?ting|mei-?jia|xiaoxiao|huihui|yaoyao|xiaoyi|anna|petra|katja|helena|monica|paulina|amelie|alice|-x-(sfg|tpc|tpf|tpg|iob|iog|gba|gbc|gbg|fra|frc|eea|eec|dea|deb|ccc|ccd|cfc|dfc|esc|esd|itb|itc)/i;
const MALE_RE = /\bmale\b|daniel|david|mark|george|ryan|guy|fred|alex|thomas|oliver|-x-(iom|tpd|rjs|gbb|gbd|frb|frd|deg|ded|cfd|ccc_male|esf|ite|itd)/i;
function pickVoice(voices, tag) {
  const pre = String(tag).toLowerCase().split('-')[0], reg = String(tag).toLowerCase().replace('_', '-');
  const v = (voices || []).map((x, i) => ({ x, i, lang: String(x.lang || '').toLowerCase().replace('_', '-') })).filter(o => o.lang.split('-')[0] === pre);
  if (!v.length) return null;
  const score = o => (FEMALE_RE.test(o.x.name || '') || FEMALE_RE.test(o.x.voiceURI || '') ? 4 : 0) - (MALE_RE.test(o.x.name || '') ? 4 : 0) + (o.lang === reg ? 2 : 0) + (o.x.localService ? 1 : 0) + (/network|online/i.test(o.x.name || '') ? -1 : 0);
  return v.sort((a, b) => score(b) - score(a) || a.i - b.i)[0];
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
// Listenkopf mit Sprachpaar: "## Name [zh-de]" = Spalte 1 Chinesisch, Spalte 2 Deutsch. Ohne Angabe: [en-de].
const PAIR_RE = /^(.*?)\s*\[([a-z]{2,3})-([a-z]{2,3})\]$/i, DEF_LANGS = ['en', 'de'];
const langsOf = l => (l && l.langs) || DEF_LANGS;
function parseFile(text) {
  const head = [], lists = [], errors = []; let cur = null;
  String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    const h = line.match(/^##\s*(.+)$/);
    if (h) { const lp = h[1].trim().match(PAIR_RE); cur = lp ? { name: lp[1].trim(), langs: [lp[2].toLowerCase(), lp[3].toLowerCase()], items: [] } : { name: h[1].trim(), items: [] }; lists.push(cur); return; }
    if (!line || line.startsWith('#') || line.startsWith('//')) { (cur ? cur.items : head).push({ raw }); return; }
    const w = parseLine(line);
    if (!w) { errors.push(i + 1); (cur ? cur.items : head).push({ raw }); return; }
    if (/^(english|englisch|en)$/i.test(w.en) && /^(deutsch|german|de)$/i.test(w.de)) return;
    if (!cur) { cur = { name: 'Meine Vokabeln', items: [] }; lists.push(cur); }
    cur.items.push(w);
  });
  return { head, lists, errors };
}
const listWords = l => { const [la, lb] = langsOf(l); return l.items.filter(x => x.en != null && x.en.trim() && x.de.trim()).map(x => ({ en: x.en.trim(), de: x.de.trim(), la, lb })); };
function serializeFile(model) {
  const clean = s => String(s).replace(/[\r\n;]+/g, ' ').trim();
  let lines = model.head.map(x => x.raw);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  for (const l of model.lists) {
    if (lines.length) lines.push('');
    lines.push('## ' + clean(l.name) + (l.langs ? ` [${l.langs[0]}-${l.langs[1]}]` : ''));
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
  const n = norm(input), latin = /[a-z]/i.test(String(input)), alts = String(answer).split(/[\/;]/).map(s => s.trim()).map(s => s.includes('|') ? splitPy(s)[latin ? 1 : 0] : s.replace(/\([^)]*\)\s*/g, '')).filter(Boolean);
  let best = alts[0] || '', sc = -1;
  for (const a of alts) { const na = norm(a); let s = 0; for (let i = 0; i < Math.min(na.length, n.length); i++) if (na[i] === n[i]) s++; if (s > sc) { sc = s; best = a; } }
  return best;
}
function diffChars(input, target) {
  const a = String(input || '').toLowerCase(), t = String(target).toLowerCase();
  return [...String(input || '')].map((ch, i) => ({ ch, ok: a[i] === t[i] }));
}
const VM_API = { speakText, pickVoice, recordTime, resetRewards, LUCKY_NEAR, LUCKY_P, critPoints, CRIT_MIN_MS, CRIT_FRAC, CRIT_BONUS, resetKeys, rewardNeed, rewardsEarned, migrateProblems, hasPinyin, isHan, toneless, langsOf, DEF_LANGS, isDue, isMastered, SRS_DAYS, parseLine, parseFile, listWords, serializeFile, lengthFactor, travelFor, bestVariant, diffChars, norm, variants, isMatch, display, parseList, wkey, weight, pick, record, isPhrase, levelParams, points };
if (typeof module !== 'undefined' && module.exports) module.exports = VM_API; else window.VM = VM_API;
})();
