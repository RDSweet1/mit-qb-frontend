// Minimal service worker — required for PWA installability
// Does NOT cache anything; the app is a live data dashboard
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // pass-through
