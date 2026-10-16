// 1.11: Die App lädt @capacitor/core nicht (kein Bundler). Auf Android gibt es dann zwar die Native-Bridge
// (Capacitor.nativePromise), aber Capacitor.Plugins bleibt leer → bis 1.10 waren TextToSpeech und Filesystem
// in der APK unerreichbar (keine Aussprache, Vokabeln nur im WebView-Speicher statt in Dokumente/VokabelMonster).
// Hier werden fehlende Plugins als schlanke Proxys über die Bridge nachgereicht. Im Browser passiert nichts.
(function () {
  const c = window.Capacitor; if (!c || !c.isNativePlatform || !c.isNativePlatform() || typeof c.nativePromise !== 'function') return;
  c.Plugins = c.Plugins || {};
  const proxy = name => new Proxy({}, { get: (_, m) => m === 'then' || typeof m === 'symbol' ? undefined : (o => c.nativePromise(name, m, o || {})) });
  for (const name of ['TextToSpeech', 'Filesystem']) if (!c.Plugins[name]) c.Plugins[name] = proxy(name);
  window.__vmBridge = true;
})();
