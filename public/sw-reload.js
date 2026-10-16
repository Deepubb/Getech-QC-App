// Loaded into the service worker. When a new version takes over (after someone taps Update, or the
// app installs it by itself), reload the app windows on screen so the new version shows straight
// away; older app versions did not reload for an update found in an earlier session. Windows in the
// background (e.g. while the camera is open) are left alone and reload themselves when safe.
self.addEventListener('activate', () => {
  // Deliberately not inside event.waitUntil: the reload is served by this worker, so it can only
  // go through once activation has finished. Waiting on it here would wait forever.
  self.clients
    .matchAll({ type: 'window' })
    .then((windows) => windows.filter((w) => w.visibilityState === 'visible').forEach((w) => w.navigate(w.url).catch(() => undefined)));
});
