/**
 * MediLink (Jibon Rokkha) - Service Worker
 * Progressive Web App & Offline Resilience
 */

const CACHE_NAME = "medilink-shell-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/symbol.png",
  "/logo.png",
  "/assets/logo.png",
];

// Pre-cache core shell resources on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Pre-caching core shell failed:", err);
      })
  );
});

// Clean up old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Helper to determine asset types
function isFontOrImage(request) {
  const url = request.url.toLowerCase();
  const destination = request.destination;
  return (
    destination === "image" ||
    destination === "font" ||
    /\.(png|jpe?g|svg|gif|webp|ico|woff2?|ttf|eot)(\?.*)?$/.test(url) ||
    url.includes("fonts.gstatic.com") ||
    url.includes("fonts.googleapis.com") ||
    url.includes("fontshare.com")
  );
}

function isHtmlOrJs(request) {
  const url = request.url.toLowerCase();
  const destination = request.destination;
  return (
    request.mode === "navigate" ||
    destination === "document" ||
    destination === "script" ||
    /\.(html?|js|mjs|tsx?)(\?.*)?$/.test(url)
  );
}

// Fetch event handler
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== "GET" || !request.url.startsWith("http")) {
    return;
  }

  // Cache-First for fonts and images
  if (isFontOrImage(request)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              (networkResponse.status === 200 || networkResponse.type === "opaque")
            ) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Return empty fallback or cached icon if available
            return caches.match("/symbol.png");
          });
      })
    );
    return;
  }

  // Network-First with Cache Fallback for HTML/JS (navigation and scripts)
  if (isHtmlOrJs(request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If navigation request fails, fallback to index.html shell
          if (request.mode === "navigate" || request.destination === "document") {
            const shell = await caches.match("/index.html");
            if (shell) return shell;
          }
          return new Response("Offline. Content not cached yet.", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" },
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate for CSS and other assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
