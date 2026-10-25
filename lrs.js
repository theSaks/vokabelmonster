(function () {
// 1.16 LRS-Hilfen (Lese-Rechtschreib-Schwäche) – reine Logik ohne DOM. Im Browser window.VMLRS, in Node per require.
// ---------------------------------------------------------------------------------------------------------------
// Einstellungen: Standardwerte der neuen Schalter (alte Spielstände aus 1.15 bekommen sie beim Laden ergänzt,
// vorhandene Werte bleiben unverändert – siehe mergeSettings).
const LRS_DEFAULTS_OFF = { font: 'aus', syl: false, sayFirst: false, hearOnly: false, autoDown: true, lrs: false,
  session: 0, flip: false };
// „LRS-Modus“ setzt sinnvolle Vorgaben aus 1–3 (Schrift, Silben, Vorlesen, Kacheln, langsames Tempo). Ausschalten stellt
// die vorherigen Werte wieder her (gemerkt in settings.lrsPrev).
const LRS_ON = { font: 'lexend', syl: true, sayFirst: true, speech: true, say: true, autoDown: true, input: 'kacheln', speed: 'sehrlangsam' };
const LRS_KEYS = Object.keys(LRS_ON);
const SLOW = ['ohne', 'sehrlangsam'];
function mergeSettings(base, saved) {
  const s = Object.assign({}, base, LRS_DEFAULTS_OFF, saved || {});
  if (!['aus', 'lexend', 'opendyslexic'].includes(s.font)) s.font = 'aus';
  return s;
}
function setLrs(s, on) {
  if (on && !s.lrs) { s.lrsPrev = {}; for (const k of LRS_KEYS) s.lrsPrev[k] = s[k];
    Object.assign(s, LRS_ON); if (SLOW.includes(s.lrsPrev.speed)) s.speed = s.lrsPrev.speed;   // schon langsam(er) → so lassen
    s.lrs = true; }
  else if (!on && s.lrs) { if (s.lrsPrev) Object.assign(s, s.lrsPrev); delete s.lrsPrev; s.lrs = false; }
  return s;
}
// CSS-Klassen am <body> für Schrift & Silben (Test: Klassen vorhanden)
const bodyClasses = s => [s.font && s.font !== 'aus' ? 'lrs-font' : '', s.font === 'lexend' ? 'font-lexend' : '', s.font === 'opendyslexic' ? 'font-od' : '', s.syl ? 'syl-on' : ''].filter(Boolean);

// ---- Auto-Runterstufen (Punkt 4) ----
// REGEL: Ein Wort ist „runtergestuft“, wenn es insgesamt mindestens DOWN_WRONG = 2-mal falsch war UND seine aktuelle Serie
// (richtig beim ersten Versuch in Folge) unter DOWN_UP = 2 liegt. Es kommt dann mit leichterer Eingabe:
//   Tippen → Buchstaben-Kacheln, Kacheln → Multiple Choice, Multiple Choice bleibt.
// Nach 2 richtigen Antworten in Folge (auch in der leichteren Eingabe) ist es wieder „oben“ (normale Eingabe).
// Die 3. richtige Antwort in Folge – dann wieder in der normalen Eingabe – macht es „sicher“ (MASTER_STREAK = 3, unverändert).
// Ein neuer Fehler setzt die Serie wie bisher auf 0 → sofort wieder runter.
// Der Zustand wird nur aus den vorhandenen Statistikfeldern (wrong, streak) abgeleitet: kein neues Feld, keine Migration,
// record()/Töpfe/Belohnungen bleiben unverändert.
const DOWN_WRONG = 2, DOWN_UP = 2;
const isDown = st => !!st && (st.wrong || 0) >= DOWN_WRONG && (st.streak || 0) < DOWN_UP;
const easier = input => input === 'tippen' ? 'kacheln' : 'mc';
function modeFor(st, input, autoDown) { return autoDown && isDown(st) ? easier(input) : input; }

// ---- Silben (Punkt 2) ----
// Liang/TeX-Muster (hyphen-Paket): Englisch = en-us (trennt feiner als en-gb, näher an gesprochenen Silben: um-brel-la, an-i-mal),
// Deutsch = de-1996 (neue Rechtschreibung). Andere Sprachen → keine Markierung (null).
// Hinweis: Trennmuster sind für den Satz gemacht → am Wortanfang bleiben ≥ 2, am Ende ≥ 3 Buchstaben (en) bzw. 2 (de) zusammen.
const SYL_LANGS = { en: 'en-us', de: 'de-1996' };
let hyphen = {}, loader = null;
function useHyphenators(map) { hyphen = Object.assign({}, hyphen, map); }
function setLoader(fn) { loader = fn; }
const sylSupported = l => !!SYL_LANGS[l];
// Ergebnis: Array von Silben (Leerzeichen/Satzzeichen als eigene Stücke mit sep:true), oder null
function syllables(text, lang) {
  const code = SYL_LANGS[lang]; if (!code) return null;
  let h = hyphen[code]; if (!h && loader) { h = loader(code); if (h) hyphen[code] = h; }
  if (!h) return null;
  const out = [];
  for (const tok of String(text).split(/([^\p{L}\p{M}'’]+)/u)) { if (!tok) continue;
    if (!/\p{L}/u.test(tok)) { out.push({ t: tok, sep: true }); continue; }
    const parts = h(tok, { hyphenChar: '\u2027', minWordLength: 4 }).split('\u2027');
    parts.forEach(p => out.push({ t: p, sep: false })); out.push({ t: '', sep: true, end: true }); }
  if (out.length && out[out.length - 1].end) out.pop();
  return out.filter(x => x.t || x.end);
}
const sylString = (text, lang, sep = '·') => { const s = syllables(text, lang); if (!s) return null;
  let r = '', prevSyl = false; for (const x of s) { if (x.sep) { r += x.t; prevSyl = false; } else { r += (prevSyl ? sep : '') + x.t; prevSyl = true; } } return r; };
// Zeichenindex → Silbennummer (für Kachel-Slots); Trennzeichen bekommen -1
function sylIndexMap(text, lang) { const s = syllables(text, lang); if (!s) return null; const map = []; let n = 0;
  for (const x of s) { if (x.sep) { for (const _ of x.t) map.push(-1); continue; } for (const _ of x.t) map.push(n); n++; } return map; }

// ---- Fortschritt & Übersicht (Zusatz) ----
const DAY = 864e5;
const weekStart = now => { const d = new Date(now); d.setHours(0, 0, 0, 0); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; };
// stats-Einträge: wann wurde ein Wort „sicher“? (optional st.mAt, ab 1.16 protokolliert – ältere Wörter zählen nicht)
function noteMastery(st, wasMastered, isMasteredNow, now = Date.now()) { if (!wasMastered && isMasteredNow) st.mAt = now; return st; }
function overview(stats, keys, V, now = Date.now()) {
  const ws = weekStart(now); let due = 0, prob = 0, week = 0, safe = 0;
  for (const k of keys) { const st = stats[k]; if (!st) continue;
    if (V.isProb ? V.isProb(st) : st.prob) prob++; else if (st.box != null && V.isDue(st, now)) due++;
    if (V.isMastered(st)) safe++; if (st.mAt && st.mAt >= ws) week++; }
  return { due, prob, week, safe, total: keys.length };
}
// Problemwort-Runde: die 5 zuletzt falsch beantworteten offenen Problemwörter
function lastWrong(stats, n = 5) { const t = st => st.lw || st.last || 0; return Object.values(stats).filter(st => st && st.prob === true).sort((a, b) => t(b) - t(a)).slice(0, n); }
// Neues Schuljahr: Fortschritt vorher archivieren (höchstens 3 Archive)
function archiveEntry(get, keys, now = Date.now()) { const e = { t: now, data: {} }; for (const k of keys) { const v = get(k); if (v != null) e.data[k] = v; } return e; }
const pushArchive = (arr, e, max = 3) => [...(arr || []), e].slice(-max);

const API = { LRS_DEFAULTS_OFF, LRS_ON, mergeSettings, setLrs, bodyClasses, DOWN_WRONG, DOWN_UP, isDown, easier, modeFor,
  SYL_LANGS, sylSupported, syllables, sylString, sylIndexMap, useHyphenators, setLoader, weekStart, noteMastery, overview, lastWrong, archiveEntry, pushArchive };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.VMLRS = API;
})();
