// Service Worker for PWA + offline book caching
const CACHE_NAME = "book-cache-v3";
const STATIC_CACHE_NAME = "static-cache-v3";
const BOOK_CACHE_PREFIX = "book-content-";

const STATIC_ASSETS = [
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Listen for messages from the main thread (book caching)
self.addEventListener("message", async (event) => {
  const { type, payload } = event.data;

  if (type === "CACHE_BOOK") {
    const { bookId, content, title, author } = payload;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `${BOOK_CACHE_PREFIX}${bookId}`;
    const response = new Response(JSON.stringify({ bookId, content, title, author, cachedAt: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put(new Request(cacheKey), response);
    event.source.postMessage({ type: "BOOK_CACHED", payload: { bookId } });
  }

  if (type === "REMOVE_CACHED_BOOK") {
    const { bookId } = payload;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `${BOOK_CACHE_PREFIX}${bookId}`;
    await cache.delete(new Request(cacheKey));
    event.source.postMessage({ type: "BOOK_REMOVED", payload: { bookId } });
  }

  if (type === "GET_CACHED_BOOK") {
    const { bookId } = payload;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `${BOOK_CACHE_PREFIX}${bookId}`;
    const response = await cache.match(new Request(cacheKey));
    if (response) {
      const data = await response.json();
      event.source.postMessage({ type: "CACHED_BOOK_DATA", payload: data });
    } else {
      event.source.postMessage({ type: "CACHED_BOOK_DATA", payload: null });
    }
  }

  if (type === "GET_ALL_CACHED_BOOKS") {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const books = [];
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        try {
          const data = await response.json();
          if (data.bookId) {
            books.push({ bookId: data.bookId, title: data.title, author: data.author, cachedAt: data.cachedAt });
          }
        } catch (e) {}
      }
    }
    event.source.postMessage({ type: "ALL_CACHED_BOOKS", payload: books });
  }

  if (type === "IS_BOOK_CACHED") {
    const { bookId } = payload;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `${BOOK_CACHE_PREFIX}${bookId}`;
    const response = await cache.match(new Request(cacheKey));
    event.source.postMessage({ type: "BOOK_CACHE_STATUS", payload: { bookId, cached: !!response } });
  }
});

// Fetch event - network first with static cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests - network only (with offline fallback for book content)
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes("/api/trpc/books.fetchGoogleDriveContent") || 
        url.pathname.includes("/api/trpc/books.getById")) {
      event.respondWith(
        fetch(request).catch(async () => {
          return new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        })
      );
    }
    return;
  }

  // Static assets - stale-while-revalidate
  // Always fetch HTML shells from the network first so an old PWA cannot retain
  // prior Manus login or logo markup after a Render deployment.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
