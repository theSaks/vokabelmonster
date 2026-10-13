// Erzeugt fonts/FusionPixel-12px-zh_hans-subset.woff2 aus der Fusion-Pixel-Font (OFL 1.1, v2026.09.25, 12px proportional zh_hans).
// Teilmenge: GB2312 Ebene 1 (3755 häufigste Hanzi) + chinesische UI-Texte + Satzzeichen. Benötigt: npm i subset-font
import subsetFont from 'subset-font'; import fs from 'fs';
// Aufruf: node tools/font-subset.mjs pfad/zu/fusion-pixel-12px-proportional-zh_hans.ttf
const root = new URL('..', import.meta.url), src = fs.readFileSync(process.argv[2]);
let chars = fs.readFileSync(new URL('i18n.js', root), 'utf8') + fs.readFileSync(new URL('beispiel-vokabeln.txt', root), 'utf8');
// GB2312 Ebene 1 (3755 häufigste Hanzi) + Satzzeichen
const td = new TextDecoder('gb18030'); for (let a = 0xB0; a <= 0xD7; a++) for (let b = 0xA1; b <= 0xFE; b++) chars += td.decode(new Uint8Array([a, b]));
chars += '，。！？：；、“”‘’（）《》…—·￥' ;
for (let c = 32; c < 0x250; c++) chars += String.fromCharCode(c);
const set = [...new Set(chars)].filter(c => c.codePointAt(0) >= 0x2E80 || /[，。！？：；、“”‘’（）《》…—·￥]/.test(c)).join('');
const out = await subsetFont(src, set, { targetFormat: 'woff2' });
fs.writeFileSync(new URL('fonts/FusionPixel-12px-zh_hans-subset.woff2', root), out); console.log(set.length, out.length);
