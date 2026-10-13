import { test } from 'node:test'; import assert from 'node:assert'; import fs from 'node:fs';
const src = fs.readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');
const load = (nav, saved) => { const g = { window: {}, navigator: { language: nav }, localStorage: { getItem: () => saved ? JSON.stringify({ ui: saved }) : null }, document: {} };
  new Function('window', 'navigator', 'localStorage', 'document', src)(g.window, g.navigator, g.localStorage, g.document); return g.window.VMI18N; };
test('Standardsprache vom Gerät, sonst Deutsch', () => {
  assert.equal(load('zh-CN').lang, 'zh'); assert.equal(load('en-US').lang, 'en'); assert.equal(load('de-AT').lang, 'de'); assert.equal(load('fr-FR').lang, 'de'); assert.equal(load('en-US', 'zh').lang, 'zh'); });
test('alle Texte in allen Sprachen, gleiche Platzhalter', () => { const D = load('de').dict;
  for (const l of ['en', 'zh']) for (const k of Object.keys(D.de)) { assert.ok(k in D[l], l + ':' + k);
    if (typeof D.de[k] === 'string') assert.deepEqual((D[l][k].match(/\{\w+\}/g) || []).sort(), (D.de[k].match(/\{\w+\}/g) || []).sort(), l + ':' + k);
    if (Array.isArray(D.de[k])) assert.equal(D[l][k].length, D.de[k].length, l + ':' + k); } });
test('Platzhalter', () => { const I = load('en'); assert.equal(I.T('levelUp', { n: 3 }), '⬆️ Level 3!'); assert.equal(I.langName('zh'), 'Chinese'); });
