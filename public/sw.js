// Minimal service worker — its only job is to exist and handle fetch events,
// which is what Chrome/Edge require before showing the "Install app" icon.
// It doesn't cache anything, so it won't cause stale-content issues.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally a no-op passthrough — required for installability.
});
