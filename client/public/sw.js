// Service Worker for offline book caching
const CACHE_NAME = "book-cache-v1";
const BOOK_CACHE_PREFIX = "book-content-";

// Install event
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  const { type, payload } = event.data;

  if (type === "CACHE_BOOK") {
    // Cache book content for offline reading
    const { bookId, content, title, author } = payload;
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `${BOOK_CACHE_PREFIX}${bookId}`;
    const response = new Response(JSON.stringify({ bookId, content, title, author, cachedAt: Date.now() }), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put(new Request(cacheKey), response);
    // Notify client
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

// Fetch event - serve cached book content when offline
self.addEventListener("fetch", (event) => {
  // Only intercept tRPC book content requests when offline
  if (event.request.url.includes("/api/trpc/books.fetchGoogleDriveContent") || 
      event.request.url.includes("/api/trpc/books.getById")) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Network failed, try to serve from cache
        // This is a fallback - main offline reading uses direct cache messaging
        return new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
  }
});
