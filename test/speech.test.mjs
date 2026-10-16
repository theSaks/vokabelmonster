import test from 'node:test'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const V = createRequire(import.meta.url)('../logic.js');
test('Sprechtext: erste Alternative, ohne Klammern', () => {
  assert.equal(V.speakText('rubber/eraser'), 'rubber'); assert.equal(V.speakText('(the) cinema'), 'cinema'); assert.equal(V.speakText('to go'), 'to go');
});
test('Weibliche Stimme bevorzugt, Sprache muss passen', () => {
  const vs = [{ name: 'en-gb-x-rjs-local', lang: 'en-GB' }, { name: 'en-gb-x-gba-local', lang: 'en-GB' }, { name: 'de-de-x-deb-local', lang: 'de-DE' }, { name: 'Google UK English Male', lang: 'en-GB' }];
  assert.equal(V.pickVoice(vs, 'en-GB').i, 1); assert.equal(V.pickVoice(vs, 'de-DE').i, 2); assert.equal(V.pickVoice(vs, 'zh-CN'), null);
  assert.equal(V.pickVoice([{ name: 'Daniel', lang: 'en_GB' }, { name: 'Samantha', lang: 'en-US' }], 'en-GB').x.name, 'Samantha');
  assert.equal(V.pickVoice([{ name: 'X', lang: 'en-US' }], 'en-GB').x.name, 'X'); // sonst irgendeine englische
});
test('Edge/Windows: Online-Stimmen, nur deutsche Stimmen', () => {
  const de = [{ name: 'Microsoft Hedda - German (Germany)', lang: 'de-DE', localService: true }, { name: 'Microsoft Katja - German (Germany)', lang: 'de-DE', localService: true }, { name: 'Microsoft Stefan - German (Germany)', lang: 'de-DE', localService: true }];
  assert.equal(V.pickVoice(de, 'en-GB'), null);                                   // keine englische → Standardstimme mit lang
  assert.match(V.pickVoice(de, 'de-DE').x.name, /Hedda|Katja/);                   // weiblich bevorzugt
  const edge = [...de, { name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false }, { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)', lang: 'en-GB', localService: false }, { name: 'Microsoft Ana Online (Natural) - English (United States)', lang: 'en-US', localService: false }];
  assert.match(V.pickVoice(edge, 'en-GB').x.name, /Sonia/);                       // weiblich + en-GB
  assert.equal(V.pickVoice([{ name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB', localService: true }], 'en-GB').x.name, 'Microsoft George - English (United Kingdom)'); // nur männlich: trotzdem nehmen
  assert.equal(V.pickVoice([], 'en-GB'), null);
});
