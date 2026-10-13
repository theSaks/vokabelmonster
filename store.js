// Speicher für vokabeln.txt – die Datei ist die einzige Quelle der Vokabeln.
//  native  : Android-APK, Capacitor Filesystem → Documents/VokabelMonster/vokabeln.txt
//  fsa     : Edge/Chrome, File System Access API (Datei einmal wählen, Handle in IndexedDB)
//  readonly: Fallback – mitgelieferte vokabeln.txt, Änderungen nur per Download
(function () {
'use strict';
const FILE = 'VokabelMonster/vokabeln.txt';
const S = { mode: 'readonly', state: 'ready', handle: null, dir: 'DOCUMENTS', text: '', lab: ['st_ro'] };
Object.defineProperty(S, 'label', { get: () => window.T ? window.T(S.lab[0], S.lab[1]) : S.lab[0] });
const FS = () => window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;

async function bundled() {
  try { const r = await fetch('vokabeln.txt', { cache: 'no-store' }); if (r.ok) { const t = await r.text(); if (t.trim()) return t; } } catch {}
  return window.BUNDLED_VOCAB || '';
}
// --- IndexedDB nur als Handle-Cache ---
function idb(mode, fn) { return new Promise((res, rej) => { const o = indexedDB.open('vokabelmonster', 1);
  o.onupgradeneeded = () => o.result.createObjectStore('h'); o.onerror = () => rej(o.error);
  o.onsuccess = () => { let tx, r; try { tx = o.result.transaction('h', mode); r = fn(tx.objectStore('h')); } catch (e) { rej(e); return; } tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }; }); }
const getHandle = () => idb('readonly', s => s.get('file')).catch(() => null);
const putHandle = h => idb('readwrite', s => s.put(h, 'file')).catch(() => {});

S.init = async function () {
  const fs = FS();
  if (fs) {
    S.mode = 'native';
    try { await fs.requestPermissions(); } catch {}
    for (const dir of ['DOCUMENTS', 'DATA']) {
      try { const r = await fs.readFile({ path: FILE, directory: dir, encoding: 'utf8' }); S.dir = dir; S.text = r.data; break; }
      catch {
        try { const seed = await bundled(); await fs.writeFile({ path: FILE, directory: dir, data: seed, encoding: 'utf8', recursive: true }); S.dir = dir; S.text = seed; break; }
        catch (e) { if (dir === 'DATA') { S.text = await bundled(); S.mode = 'readonly'; } }
      }
    }
    S.lab = [S.mode === 'native' ? (S.dir === 'DOCUMENTS' ? 'st_dl' : 'st_data') : 'st_ro'];
    S.state = 'ready'; return S.text;
  }
  if (typeof window.showOpenFilePicker === 'function') {
    S.mode = 'fsa'; S.handle = await getHandle();
    if (S.handle) {
      try { if (await S.handle.queryPermission({ mode: 'readwrite' }) === 'granted') { S.text = await (await S.handle.getFile()).text(); S.state = 'ready'; S.lab = ['st_file', { n: S.handle.name }]; return S.text; } } catch {}
      S.state = 'needs-permission';
    } else S.state = 'needs-pick';
    S.text = await bundled(); S.lab = ['st_none']; return S.text;
  }
  S.mode = 'readonly'; S.text = await bundled(); S.lab = ['st_browser']; return S.text;
};
S.canWrite = () => (S.mode === 'native') || (S.mode === 'fsa' && S.state === 'ready');
// Edge: Datei verbinden (braucht Klick)
S.connect = async function (create) {
  if (S.mode !== 'fsa') return null;
  if (!create && S.handle && S.state === 'needs-permission') {
    if (await S.handle.requestPermission({ mode: 'readwrite' }) !== 'granted') return null;
  } else if (create) {
    S.handle = await window.showSaveFilePicker({ suggestedName: 'vokabeln.txt', types: [{ description: 'Vokabeldatei', accept: { 'text/plain': ['.txt'] } }] });
    const w = await S.handle.createWritable(); await w.write(S.text || await bundled()); await w.close();
  } else {
    [S.handle] = await window.showOpenFilePicker({ types: [{ description: 'Vokabeldatei', accept: { 'text/plain': ['.txt'] } }] });
    if (await S.handle.queryPermission({ mode: 'readwrite' }) !== 'granted' && await S.handle.requestPermission({ mode: 'readwrite' }) !== 'granted') return null;
  }
  await putHandle(S.handle); S.state = 'ready'; S.lab = ['st_file', { n: S.handle.name }];
  S.text = await (await S.handle.getFile()).text(); return S.text;
};
S.reload = async function () {
  try {
    if (S.mode === 'native') S.text = (await FS().readFile({ path: FILE, directory: S.dir, encoding: 'utf8' })).data;
    else if (S.mode === 'fsa' && S.state === 'ready') S.text = await (await S.handle.getFile()).text();
  } catch {}
  return S.text;
};
S.save = async function (text) {
  S.text = text;
  if (S.mode === 'native') { await FS().writeFile({ path: FILE, directory: S.dir, data: text, encoding: 'utf8', recursive: true }); return true; }
  if (S.mode === 'fsa' && S.state === 'ready') { const w = await S.handle.createWritable(); await w.write(text); await w.close(); return true; }
  return false;                                   // nur im Speicher → Download anbieten
};
// Export: Android → Kopie mit Datum in Dokumente/VokabelMonster, sonst Download
S.exportFile = async function (text) {
  if (S.mode === 'native') { const d = new Date(), n = `VokabelMonster/vokabeln-export-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.txt`;
    await FS().writeFile({ path: n, directory: S.dir, data: text, encoding: 'utf8', recursive: true }); return n; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); a.download = 'vokabeln.txt';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return window.T ? window.T('st_download') : 'vokabeln.txt (Download)';
};
window.VMStore = S;
})();
