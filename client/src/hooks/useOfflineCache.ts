import { useState, useEffect, useCallback } from "react";

// Register service worker
export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  }
}

// Hook to interact with the offline cache
export function useOfflineCache() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => setIsReady(true));
    }
  }, []);

  const getController = async (): Promise<ServiceWorker | null> => {
    if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
    // Wait for controller to be available (first load)
    const reg = await navigator.serviceWorker.ready;
    return reg.active;
  };

  const cacheBook = useCallback(
    (bookId: number, content: string, title: string, author: string): Promise<void> => {
      return new Promise(async (resolve) => {
        const controller = await getController();
        if (!controller) {
          resolve();
          return;
        }
        const handler = (event: MessageEvent) => {
          if (event.data.type === "BOOK_CACHED" && event.data.payload.bookId === bookId) {
            navigator.serviceWorker.removeEventListener("message", handler);
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        controller.postMessage({
          type: "CACHE_BOOK",
          payload: { bookId, content, title, author },
        });
        // Timeout fallback
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve();
        }, 5000);
      });
    },
    []
  );

  const removeCachedBook = useCallback((bookId: number): Promise<void> => {
    return new Promise(async (resolve) => {
      const controller = await getController();
      if (!controller) {
        resolve();
        return;
      }
      const handler = (event: MessageEvent) => {
        if (event.data.type === "BOOK_REMOVED" && event.data.payload.bookId === bookId) {
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      controller.postMessage({
        type: "REMOVE_CACHED_BOOK",
        payload: { bookId },
      });
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve();
      }, 5000);
    });
  }, []);

  const getCachedBook = useCallback(
    (bookId: number): Promise<{ bookId: number; content: string; title: string; author: string; cachedAt: number } | null> => {
      return new Promise(async (resolve) => {
        const controller = await getController();
        if (!controller) {
          resolve(null);
          return;
        }
        const handler = (event: MessageEvent) => {
          if (event.data.type === "CACHED_BOOK_DATA") {
            navigator.serviceWorker.removeEventListener("message", handler);
            resolve(event.data.payload);
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        controller.postMessage({
          type: "GET_CACHED_BOOK",
          payload: { bookId },
        });
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve(null);
        }, 5000);
      });
    },
    []
  );

  const getAllCachedBooks = useCallback(
    (): Promise<Array<{ bookId: number; title: string; author: string; cachedAt: number }>> => {
      return new Promise(async (resolve) => {
        const controller = await getController();
        if (!controller) {
          resolve([]);
          return;
        }
        const handler = (event: MessageEvent) => {
          if (event.data.type === "ALL_CACHED_BOOKS") {
            navigator.serviceWorker.removeEventListener("message", handler);
            resolve(event.data.payload);
          }
        };
        navigator.serviceWorker.addEventListener("message", handler);
        controller.postMessage({ type: "GET_ALL_CACHED_BOOKS" });
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve([]);
        }, 5000);
      });
    },
    []
  );

  const isBookCached = useCallback((bookId: number): Promise<boolean> => {
    return new Promise(async (resolve) => {
      const controller = await getController();
      if (!controller) {
        resolve(false);
        return;
      }
      const handler = (event: MessageEvent) => {
        if (event.data.type === "BOOK_CACHE_STATUS" && event.data.payload.bookId === bookId) {
          navigator.serviceWorker.removeEventListener("message", handler);
          resolve(event.data.payload.cached);
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      controller.postMessage({
        type: "IS_BOOK_CACHED",
        payload: { bookId },
      });
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve(false);
      }, 3000);
    });
  }, []);

  return { isReady, cacheBook, removeCachedBook, getCachedBook, getAllCachedBooks, isBookCached };
}
