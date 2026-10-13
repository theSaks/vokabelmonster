// Speicher für vokabeln.txt – die Datei ist die einzige Quelle der Vokabeln.
//  native  : Android-APK, Capacitor Filesystem → Documents/VokabelMonster/vokabeln.txt
//  fsa     : Edge/Chrome, File System Access API (Datei einmal wählen, Handle in IndexedDB)
//  readonly: kein Dateizugriff – Änderungen bleiben im Browser-Speicher (localStorage), Export per Download
//  In allen Modi gibt es zusätzlich eine lokale Kopie in localStorage (siehe resolve).
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
const getHandle = () => window.__vmTestHandle ? Promise.resolve(window.__vmTestHandle) : idb('readonly', s => s.get('file')).catch(() => null);   // __vmTestHandle nur für E2E (Mock-Handles lassen sich nicht in IndexedDB ablegen)
const putHandle = h => idb('readwrite', s => s.put(h, 'file')).catch(() => {});

// --- Lokale Kopie (localStorage, bleibt auch im Android-WebView über Neustarts erhalten) ---
// vm.vocab = zuletzt bearbeiteter Stand, vm.vocabSynced = '1', wenn genau dieser Stand auch in der Datei steht.
// Vorrang: ungespeicherte/nicht in die Datei geschriebene lokale Änderungen > Datei > lokale Kopie > Beispiel (nur beim allerersten Start).
const LK = 'vm.vocab', LKS = 'vm.vocabSynced';
S.local = () => { try { return localStorage.getItem(LK); } catch { return null; } };
S.localSynced = () => { try { return localStorage.getItem(LKS) === '1'; } catch { return false; } };
S.keepLocal = (text, synced) => { S.text = text; try { localStorage.setItem(LK, text); localStorage.setItem(LKS, synced ? '1' : '0'); } catch {} };
S.bundled = bundled;
async function resolve(fileText, writeFile) {
  const local = S.local();
  if (fileText != null) {
    if (local != null && !S.localSynced() && local !== fileText) {      // lokale Änderungen noch nicht in der Datei → nicht überschreiben
      let ok = false; try { await writeFile(local); ok = true; } catch {} S.keepLocal(local, ok); return local; }
    S.keepLocal(fileText, true); return fileText; }
  if (local != null) { S.text = local; return local; }
  const b = await bundled(); S.keepLocal(b, false); return b;          // allererster Start
}
S.init = async function () {
  const fs = FS();
  if (fs) {
    S.mode = 'native';
    try { await fs.requestPermissions(); } catch {}
    let fileText = null;
    for (const dir of ['DOCUMENTS', 'DATA']) {
      try { const r = await fs.readFile({ path: FILE, directory: dir, encoding: 'utf8' }); S.dir = dir; fileText = r.data; break; }
      catch {
        // Nur anlegen, wenn die Datei wirklich fehlt – eine vorhandene (z. B. gerade nicht lesbare) Datei nie mit dem Beispiel überschreiben
        let exists = false; try { await fs.stat({ path: FILE, directory: dir }); exists = true; } catch {}
        if (exists) continue;
        try { const seed = S.local() != null ? S.local() : await bundled(); await fs.writeFile({ path: FILE, directory: dir, data: seed, encoding: 'utf8', recursive: true }); S.dir = dir; fileText = seed; if (S.local() == null) S.keepLocal(seed, true); break; }
        catch { if (dir === 'DATA') S.mode = 'readonly'; }
      }
    }
    S.text = await resolve(S.mode === 'native' ? fileText : null, t => fs.writeFile({ path: FILE, directory: S.dir, data: t, encoding: 'utf8', recursive: true }));
    S.lab = [S.mode === 'native' ? (S.dir === 'DOCUMENTS' ? 'st_dl' : 'st_data') : 'st_local'];
    S.state = 'ready'; return S.text;
  }
  if (typeof window.showOpenFilePicker === 'function') {
    S.mode = 'fsa'; S.handle = await getHandle();
    if (S.handle) {
      try { if (await S.handle.queryPermission({ mode: 'readwrite' }) === 'granted') { const ft = await (await S.handle.getFile()).text(); S.state = 'ready'; S.lab = ['st_file', { n: S.handle.name }];
        S.text = await resolve(ft, writeHandle); return S.text; } } catch {}
      S.state = 'needs-permission';
    } else S.state = 'needs-pick';
    S.text = await resolve(null); S.lab = ['st_local']; return S.text;
  }
  S.mode = 'readonly'; S.text = await resolve(null); S.lab = ['st_local']; return S.text;
};
async function writeHandle(t) { const w = await S.handle.createWritable(); await w.write(t); await w.close(); }
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
  S.text = await (await S.handle.getFile()).text(); S.keepLocal(S.text, true); return S.text;
};
S.reload = async function () {
  if (S.local() != null && !S.localSynced()) return S.text = S.local();   // lokale Änderungen haben Vorrang
  try {
    if (S.mode === 'native') S.text = (await FS().readFile({ path: FILE, directory: S.dir, encoding: 'utf8' })).data;
    else if (S.mode === 'fsa' && S.state === 'ready') S.text = await (await S.handle.getFile()).text();
  } catch {}
  if (S.canWrite()) S.keepLocal(S.text, true);
  return S.text;
};
// Speichern: immer zuerst lokal (überlebt jeden Neustart), dann – falls vorhanden – in die Datei. Rückgabe: true = auch in Datei.
S.save = async function (text, gesture) {
  S.keepLocal(text, false);
  if (S.mode === 'native') { await FS().writeFile({ path: FILE, directory: S.dir, data: text, encoding: 'utf8', recursive: true }); S.keepLocal(text, true); return true; }
  if (S.mode === 'fsa' && S.handle && S.state === 'needs-permission' && gesture) {
    try { if (await S.handle.requestPermission({ mode: 'readwrite' }) === 'granted') { S.state = 'ready'; S.lab = ['st_file', { n: S.handle.name }]; } } catch {} }
  if (S.mode === 'fsa' && S.state === 'ready') { await writeHandle(text); S.keepLocal(text, true); return true; }
  return false;                                   // nur lokal gespeichert (Browser-Speicher)
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
