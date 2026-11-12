import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Bookmark,
  Type,
  Sun,
  Moon,
  Coffee,
  Loader2,
  Columns,
  Smartphone,
  ArrowLeft,
  Download,
  Check,
  List,
  BookOpen,
  X,
  Volume2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { cleanReaderAudioText, collectPageAudioSentences, splitReaderParagraph, type ReaderAudioSentence } from "@/lib/readerAudioText";

type Theme = "light" | "dark" | "sepia" | "eink";

const THEME_CLASSES = {
  light: "bg-[#fdfbf7] text-gray-900",
  dark: "bg-gray-900 text-gray-100",
  sepia: "bg-[#f4ecd8] text-[#5b4636]",
  eink: "bg-[#FFFFFF] text-[#000000]",
} as const;

export default function Reader() {
  // FIXED: route path matches App.tsx "/read/:id"
  const [, params] = useRoute("/read/:id");
  const [, navigate] = useLocation();
  const bookId = params?.id ? Number(params.id) : 0;
  const { user, loading: authLoading } = useAuth();

  // Fetch book data
  const { data: book, isLoading: bookLoading } = trpc.books.getById.useQuery(
    { id: bookId },
    { enabled: bookId > 0 }
  );

  // Fetch Google Drive content if available
  const { data: gdriveData, isLoading: gdriveLoading } =
    trpc.books.fetchGoogleDriveContent.useQuery(
      { url: book?.googleDriveUrl || "" },
      { enabled: !!book?.googleDriveUrl }
    );

  // Reading progress
  const { data: savedProgress, isLoading: savedProgressLoading } = trpc.progress.get.useQuery(
    { bookId },
    { enabled: bookId > 0 && !!user }
  );
  const saveProgressMutation = trpc.progress.save.useMutation();
  const recordBookViewMutation = trpc.bookViews.record.useMutation();
  const bookViewRecorded = useRef(false);

  // 로그인 여부와 관계없이 도서 열람을 누적 인기 순위에 반영한다.
  // 같은 브라우저가 같은 도서를 새로고침해도 한 번만 기록한다.
  useEffect(() => {
    if (authLoading || !book || !bookId || bookViewRecorded.current) return;

    const viewerKey = "book_reader_id";
    let viewerId = localStorage.getItem(viewerKey);
    if (!viewerId) {
      viewerId = crypto.randomUUID();
      localStorage.setItem(viewerKey, viewerId);
    }

    const bookViewKey = `book_view_${bookId}`;
    if (localStorage.getItem(bookViewKey)) {
      bookViewRecorded.current = true;
      return;
    }

    bookViewRecorded.current = true;
    recordBookViewMutation.mutate(
      { bookId, viewerId },
      {
        onSuccess: () => localStorage.setItem(bookViewKey, "1"),
        onError: () => {
          bookViewRecorded.current = false;
        },
      }
    );
  }, [authLoading, book, bookId, recordBookViewMutation]);

  // Bookmarks
  const { data: userBookmarks } = trpc.bookmarks.list.useQuery(
    { bookId },
    { enabled: bookId > 0 && !!user }
  );
  const addBookmarkMutation = trpc.bookmarks.add.useMutation();
  const removeBookmarkMutation = trpc.bookmarks.remove.useMutation();
  const utils = trpc.useUtils();

  // Determine content (offline fallback handled below after useOfflineCache)
  const [offlineBook, setOfflineBook] = useState<{ content: string; title: string; author: string } | null>(null);

  const content = useMemo(() => {
    if (gdriveData?.content) return gdriveData.content;
    if (book?.content) return book.content;
    if (offlineBook?.content) return offlineBook.content;
    return "";
  }, [gdriveData, book, offlineBook]);

  const lines = useMemo(
    () => content.split("\n").filter((l) => l.trim()),
    [content]
  );
  const displaySentences = useMemo(() => {
    let nextId = 0;
    return lines.map((line) => splitReaderParagraph(line).map((displayText) => ({
      id: nextId++, displayText, text: displayText.trim(),
    })));
  }, [lines]);

  // TOC & Study Material
  const [showToc, setShowToc] = useState(false);
  const [showStudyMaterial, setShowStudyMaterial] = useState(false);

  const tocItems = useMemo(() => {
    if (!book?.tableOfContents) return [];
    return book.tableOfContents
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [book?.tableOfContents]);

  // 차례 항목에 해당하는 lines 인덱스 매핑
  const tocLineIndices = useMemo(() => {
    if (tocItems.length === 0 || lines.length === 0) return [];
    return tocItems.map((tocItem) => {
      // 차례 제목에서 괄호 안의 한자 등을 제거하고 핵심 키워드 추출
      const cleanItem = tocItem.replace(/\s*\(.*?\)\s*/g, "").trim();
      // lines에서 해당 제목이 포함된 줄을 찾음
      const idx = lines.findIndex((line) => {
        const cleanLine = line.replace(/\s*\(.*?\)\s*/g, "").trim();
        return cleanLine.includes(cleanItem) || cleanItem.includes(cleanLine.slice(0, 5));
      });
      return idx >= 0 ? idx : -1;
    });
  }, [tocItems, lines]);

  // State
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [audioQueue, setAudioQueue] = useState<ReaderAudioSentence[]>([]);
  const [audioIndex, setAudioIndex] = useState(0);
  const [audioPage, setAudioPage] = useState(0);
  const [audioRequest, setAudioRequest] = useState<{ page: number; sentenceId: number | null; nonce: number } | null>(null);
  const [audioActiveSentenceId, setAudioActiveSentenceId] = useState<number | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Keep the device screen awake only while narration is playing.
  useEffect(() => {
    if (!isAudioPlaying) return;
    const wakeLockApi = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    }).wakeLock;
    if (!wakeLockApi) return;

    let activeLock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const requestScreenLock = async () => {
      if (cancelled || document.visibilityState !== "visible" || activeLock) return;
      try {
        const lock = await wakeLockApi.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        activeLock = lock;
      } catch {
        // Unsupported or denied by the browser; narration should continue normally.
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void requestScreenLock();
    };

    void requestScreenLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (activeLock) void activeLock.release();
    };
  }, [isAudioPlaying]);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(0.8);
  const [audioUsesBrowserVoice, setAudioUsesBrowserVoice] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const audioPlayTokenRef = useRef(0);
  const prefetchedPageRef = useRef<number | null>(null);
  const audioProgressKey = `reader_audio_progress_${bookId}`;
  const audioMutation = trpc.readerAudio.getOrCreate.useMutation();
  const audioRequestCacheRef = useRef(new Map<string, ReturnType<typeof audioMutation.mutateAsync>>());
  const preloadedAudioRef = useRef(new Map<string, HTMLAudioElement>());
  const audioCacheKey = useCallback((item: ReaderAudioSentence) =>
    String(bookId) + ":" + item.pageNumber + ":" + item.sentenceNumber + ":" + item.text, [bookId]);
  const requestReaderAudio = useCallback((item: ReaderAudioSentence) => {
    const key = audioCacheKey(item);
    const cache = audioRequestCacheRef.current;
    let request = cache.get(key);
    if (!request) {
      request = audioMutation.mutateAsync({
        bookId, pageNumber: item.pageNumber, sentenceNumber: item.sentenceNumber, text: item.text,
      });
      cache.set(key, request);
      while (cache.size > 20) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey || oldestKey === key) break;
        cache.delete(oldestKey);
        const oldAudio = preloadedAudioRef.current.get(oldestKey);
        if (oldAudio) {
          oldAudio.pause();
          oldAudio.removeAttribute("src");
          oldAudio.load();
          preloadedAudioRef.current.delete(oldestKey);
        }
      }
    }
    return request;
  }, [audioCacheKey, audioMutation.mutateAsync, bookId]);
  const prepareReaderAudio = useCallback(async (item: ReaderAudioSentence) => {
    const key = audioCacheKey(item);
    const result = await requestReaderAudio(item);
    if (!result.fallback && !preloadedAudioRef.current.has(key)) {
      const preload = new Audio();
      preload.preload = "auto";
      preload.src = result.audioUrl;
      preload.load();
      preloadedAudioRef.current.set(key, preload);
    }
    return result;
  }, [audioCacheKey, requestReaderAudio]);
  const [isTwoPageMode, setIsTwoPageMode] = useState(false);
  const [stride, setStride] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [theme, setTheme] = useState<Theme>("light");
  const [showSettings, setShowSettings] = useState(false);
  const [readMode, setReadMode] = useState<"page" | "scroll">("page");

  // E-ink 모드에서는 애니메이션 비활성화
  const isEinkMode = theme === "eink";

  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Offline cache
  const { cacheBook, isBookCached, removeCachedBook, getCachedBook } = useOfflineCache();

  // Try loading from offline cache if network fails
  useEffect(() => {
    if (bookId > 0 && !bookLoading && !book && !gdriveData) {
      getCachedBook(bookId).then((cached) => {
        if (cached) {
          setOfflineBook({ content: cached.content, title: cached.title, author: cached.author });
        }
      });
    }
  }, [bookId, bookLoading, book, gdriveData, getCachedBook]);
  const [isCached, setIsCached] = useState(false);
  const [isCaching, setIsCaching] = useState(false);

  const GAP_SIZE = 40;

  // Check if book is cached offline
  useEffect(() => {
    if (bookId > 0) {
      isBookCached(bookId).then(setIsCached);
    }
  }, [bookId, isBookCached]);

  const addToShelfMutation = trpc.bookshelf.add.useMutation();
  const removeFromShelfMutation = trpc.bookshelf.remove.useMutation();

  const handleOfflineSave = async () => {
    if ((!book && !offlineBook) || !content) return;
    setIsCaching(true);
    try {
      const title = book?.title || offlineBook?.title || "";
      const author = book?.author || offlineBook?.author || "";
      await cacheBook(bookId, content, title, author);
      // Also add to server bookshelf if logged in
      if (user) {
        try {
          await addToShelfMutation.mutateAsync({ bookId });
        } catch (e) {
          // Server save is optional, don't block offline save
        }
      }
      setIsCached(true);
    } catch (e) {
      console.error("Failed to cache book:", e);
    }
    setIsCaching(false);
  };

  const handleOfflineRemove = async () => {
    setIsCaching(true);
    await removeCachedBook(bookId);
    // Also remove from server bookshelf if logged in
    if (user) {
      try {
        await removeFromShelfMutation.mutateAsync({ bookId });
      } catch (e) {}
    }
    setIsCached(false);
    setIsCaching(false);
  };

  // Content is still loading from server
  const isContentLoading =
    bookLoading || (!!book?.googleDriveUrl && gdriveLoading);

  // Fully ready to show content (measured + content loaded)
  const isFullyReady = isReady && !isContentLoading && lines.length > 0;

  // Measure container - the key to preventing overflow
  const measure = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientWidth = Math.floor(rect.width);
    const clientHeight = Math.floor(rect.height);

    if (clientWidth <= 0 || clientHeight <= 0) return;

    const margin = clientWidth > 768 ? 48 : 32;
    let availableWidth = clientWidth - margin * 2;

    const isTwoPage = availableWidth > 800;
    setIsTwoPageMode(isTwoPage);

    if (isTwoPage) {
      const colWidth = Math.floor((availableWidth - GAP_SIZE) / 2);
      availableWidth = colWidth * 2 + GAP_SIZE;
    }

    setDimensions({ width: availableWidth, height: clientHeight });
    setIsReady(true);
  }, []);

  useEffect(() => {
    // Retry measure until containerRef is available (handles early return during bookLoading)
    if (!isReady) {
      const retryTimer = setInterval(() => {
        if (containerRef.current) {
          measure();
          clearInterval(retryTimer);
        }
      }, 50);
      // Also try immediately
      measure();
      return () => clearInterval(retryTimer);
    }
  }, [measure, isReady]);

  useEffect(() => {
    let lastWidth = window.innerWidth;
    let resizeTimer: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (Math.abs(currentWidth - lastWidth) > 5) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          lastWidth = currentWidth;
          setContainerWidth(null);
          measure();
        }, 150);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, [measure]);

  // Column dimensions - strictly within viewport
  const columnDimensions = useMemo(() => {
    if (!isReady) return { colWidth: 0, colHeight: 0 };

    const availableWidth = dimensions.width;
    const colWidth = isTwoPageMode
      ? Math.floor((availableWidth - GAP_SIZE) / 2)
      : Math.floor(availableWidth);

    // Match original: subtract vertical padding from height
    const verticalPadding = isTwoPageMode ? 80 : 40;
    const colHeight = Math.floor(dimensions.height - verticalPadding - 20);

    return { colWidth, colHeight };
  }, [isReady, dimensions, isTwoPageMode]);

  // Reset containerWidth when layout changes
  useEffect(() => {
    setContainerWidth(null);
  }, [dimensions, fontSize, lineHeight, lines, isTwoPageMode]);

  // Calculate columns and pages
  useEffect(() => {
    if (
      !isReady ||
      !contentRef.current ||
      dimensions.width === 0 ||
      lines.length === 0
    )
      return;

    const timer = setTimeout(() => {
      if (contentRef.current) {
        const scrollWidth = contentRef.current.scrollWidth;
        const { colWidth } = columnDimensions;

        const estimatedColumns = Math.round(
          (scrollWidth + GAP_SIZE) / (colWidth + GAP_SIZE)
        );

        if (containerWidth === null) {
          const exactWidth =
            estimatedColumns * colWidth + (estimatedColumns - 1) * GAP_SIZE;
          setContainerWidth(exactWidth);
        }

        const columnsPerView = isTwoPageMode ? 2 : 1;
        const finalStride =
          columnsPerView * colWidth + columnsPerView * GAP_SIZE;

        setStride(finalStride);

        const pages = Math.ceil(estimatedColumns / columnsPerView);
        setTotalPages(Math.max(1, pages));

        setCurrentPage((prev) => Math.min(prev, Math.max(0, pages - 1)));
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [
    isReady,
    lines,
    containerWidth,
    columnDimensions,
    isTwoPageMode,
    GAP_SIZE,
    dimensions.width,
  ]);

  // Save progress on page change
  useEffect(() => {
    if (!user || totalPages <= 1 || stride === 0 || !hasRestoredProgress)
      return;
    const timer = setTimeout(() => {
      saveProgressMutation.mutate({
        bookId,
        currentPage,
        totalPages,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPage, totalPages, stride, user, bookId, hasRestoredProgress]);

  // Wait for the saved-progress request before deciding whether to restore a page.
  // Otherwise its initial undefined data can be mistaken for "no saved progress".
  useEffect(() => {
    if (
      hasRestoredProgress ||
      authLoading ||
      (user && savedProgressLoading) ||
      !contentRef.current ||
      totalPages <= 1 ||
      stride === 0
    )
      return;

    if (user && savedProgress && savedProgress.currentPage > 0) {
      setCurrentPage(Math.min(savedProgress.currentPage, totalPages - 1));
    }
    setHasRestoredProgress(true);
  }, [savedProgress, savedProgressLoading, user, authLoading, totalPages, stride, hasRestoredProgress]);

  // Navigation
  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : prev));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const requestAudioPage = useCallback((page: number, sentenceId: number | null = null) => {
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    setReadMode("page");
    setCurrentPage(safePage);
    setAudioQueue([]);
    setAudioPage(safePage);
    setAudioRequest({ page: safePage, sentenceId, nonce: Date.now() });
  }, [totalPages]);

  const startAudioFromSentence = useCallback((sentenceId: number) => {
    if (readMode === "scroll") {
      requestAudioPage(0, sentenceId);
      return;
    }
    const spans = Array.from(contentRef.current?.querySelectorAll<HTMLElement>("[data-audio-sentence-id]") ?? []);
    const target = spans.find((span) => Number(span.dataset.audioSentenceId) === sentenceId);
    const paragraph = target?.closest<HTMLElement>("[data-line-index]");
    const page = target && paragraph && contentRef.current && stride > 0
      ? Math.floor(Math.max(0, target.getBoundingClientRect().left - contentRef.current.getBoundingClientRect().left) / stride)
      : currentPage;
    requestAudioPage(page, sentenceId);
  }, [readMode, requestAudioPage, stride, currentPage]);

  const pauseAudio = useCallback(() => {
    setIsAudioPlaying(false);
    setIsAudioLoading(false);
    audioPlayTokenRef.current += 1;
    audioElementRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const toggleAudioPlayback = useCallback(() => {
    if (isAudioPlaying) {
      pauseAudio();
      return;
    }
    if (audioQueue.length > 0) {
      setIsAudioPlaying(true);
      return;
    }
    let saved: { page?: number; sentenceId?: number } = {};
    try { saved = JSON.parse(localStorage.getItem(audioProgressKey) || "{}"); } catch { /* Start from the current page. */ }
    requestAudioPage(Number.isInteger(saved.page) ? Number(saved.page) : currentPage,
      Number.isInteger(saved.sentenceId) ? Number(saved.sentenceId) : null);
  }, [isAudioPlaying, pauseAudio, audioQueue.length, audioProgressKey, requestAudioPage, currentPage]);

  const skipAudioSentence = useCallback((direction: -1 | 1) => {
    if (audioQueue.length === 0) {
      requestAudioPage(currentPage);
      return;
    }
    const target = audioIndex + direction;
    if (target >= 0 && target < audioQueue.length) {
      setAudioIndex(target);
      setAudioActiveSentenceId(audioQueue[target].id);
      setIsAudioPlaying(true);
      return;
    }
    const page = audioPage + direction;
    if (page >= 0 && page < totalPages) {
      requestAudioPage(page, direction < 0 ? -1 : null);
      setIsAudioPlaying(true);
    }
  }, [audioQueue, audioIndex, audioPage, currentPage, totalPages, requestAudioPage]);

  const renderAudioLine = useCallback((line: string, lineIndex: number) => (
    <p key={lineIndex} data-line-index={lineIndex} className="mb-4 sm:mb-6" style={{ textIndent: "1em" }}>
      {displaySentences[lineIndex]?.map((sentence) => (
        <span
          key={sentence.id}
          data-audio-sentence-id={sentence.id}
          data-audio-text={cleanReaderAudioText(sentence.text)}
          onClick={() => startAudioFromSentence(sentence.id)}
          className="relative z-20 cursor-pointer rounded-sm transition-colors"
          style={audioActiveSentenceId === sentence.id ? { backgroundColor: "#fde047", color: "#111827", boxShadow: "0 0 0 2px #fde047" } : undefined}
        >{sentence.displayText}</span>
      )) ?? line}
    </p>
  ), [displaySentences, startAudioFromSentence, audioActiveSentenceId]);

  // Prepare the page queue from the same paragraph spans rendered by the reader.
  useEffect(() => {
    if (!audioRequest || audioRequest.page !== currentPage || stride <= 0 || !isReady) return;
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        const rows = collectPageAudioSentences(contentRef.current, audioRequest.page, stride);
        const found = audioRequest.sentenceId === null ? 0 : rows.findIndex((row) => row.id === audioRequest.sentenceId);
        const index = audioRequest.sentenceId === -1 ? Math.max(0, rows.length - 1) : Math.max(0, found);
        setAudioQueue(rows);
        setAudioPage(audioRequest.page);
        setAudioIndex(index);
        setAudioActiveSentenceId(rows[index]?.id ?? null);
        setAudioRequest(null);
        setIsAudioPlaying(rows.length > 0);
        if (rows.length === 0) setIsAudioLoading(false);
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, [audioRequest, currentPage, stride, isReady]);

  const advanceAudio = useCallback(() => {
    if (audioIndex + 1 < audioQueue.length) {
      setAudioIndex((index) => index + 1);
      setAudioActiveSentenceId(audioQueue[audioIndex + 1].id);
      return;
    }
    const item = audioQueue[audioIndex];
    const crossedPage = item?.pageTransitions[item.pageTransitions.length - 1]?.pageIndex;
    const nextPage = crossedPage !== undefined && crossedPage > audioPage
      ? crossedPage
      : audioPage + 1;
    if (nextPage < totalPages) {
      setCurrentPage(nextPage);
      setAudioQueue([]);
      setAudioRequest({ page: nextPage, sentenceId: null, nonce: Date.now() });
      return;
    }
    setIsAudioPlaying(false);
    setAudioActiveSentenceId(null);
    setIsAudioLoading(false);
  }, [audioIndex, audioQueue, audioPage, totalPages]);

  // Synthesize or reuse one paragraph at a time. Quota/service failures use the browser voice.
  useEffect(() => {
    if (!isAudioPlaying || !audioQueue[audioIndex]) return;
    const item = audioQueue[audioIndex];
    const audio = audioElementRef.current;
    const token = ++audioPlayTokenRef.current;
    let cancelled = false;
    let nextPageTransition = 0;
    let speechStartedAt = 0;
    let lastSpeechBoundaryAt = 0;
    let speechFallbackTimer: number | null = null;
    const stillCurrent = () => !cancelled && token === audioPlayTokenRef.current;
    // Keep page movement tied to measured text boundaries when a legacy
    // whole-paragraph audio item crosses pages.
    const followSpokenPage = (progress: number) => {
      if (!stillCurrent()) return;
      while (nextPageTransition < item.pageTransitions.length &&
        progress >= item.pageTransitions[nextPageTransition].progress) {
        const pageIndex = item.pageTransitions[nextPageTransition].pageIndex;
        setCurrentPage((page) => Math.max(page, pageIndex));
        nextPageTransition += 1;
      }
    };
    const speakInBrowser = () => {
      if (!stillCurrent()) return;
      setAudioUsesBrowserVoice(true);
      setIsAudioLoading(false);
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = "ko-KR";
      utterance.rate = audioSpeed;
      speechStartedAt = performance.now();
      lastSpeechBoundaryAt = speechStartedAt;
      // Some browser voices do not emit boundary events for Korean. Estimate
      // progress only after boundary callbacks stop arriving.
      const estimatedDurationMs = Math.max(1500, (item.text.length / (4 * audioSpeed)) * 1000);
      speechFallbackTimer = window.setInterval(() => {
        const now = performance.now();
        if (now - lastSpeechBoundaryAt > 1200) {
          followSpokenPage(Math.min(1, (now - speechStartedAt) / estimatedDurationMs));
        }
      }, 250);
      utterance.onboundary = (event) => {
        lastSpeechBoundaryAt = performance.now();
        if (event.charIndex >= 0 && item.text.length > 0) {
          followSpokenPage(event.charIndex / item.text.length);
        }
      };
      utterance.onend = () => {
        if (speechFallbackTimer !== null) window.clearInterval(speechFallbackTimer);
        if (stillCurrent()) {
          followSpokenPage(1);
          advanceAudio();
        }
      };
      utterance.onerror = () => {
        if (speechFallbackTimer !== null) window.clearInterval(speechFallbackTimer);
        if (stillCurrent()) advanceAudio();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    setAudioActiveSentenceId(item.id);
    setIsAudioLoading(true);
    requestReaderAudio(item).then((result) => {
      if (!stillCurrent()) return;
      if (result.fallback) { speakInBrowser(); return; }
      if (!audio) { speakInBrowser(); return; }
      setAudioUsesBrowserVoice(false);
      audio.src = result.audioUrl;
      audio.playbackRate = audioSpeed;
      audio.ontimeupdate = () => {
        if (audio.duration > 0) followSpokenPage(audio.currentTime / audio.duration);
      };
      audio.onended = () => {
        if (stillCurrent()) {
          followSpokenPage(1);
          advanceAudio();
        }
      };
      audio.onerror = speakInBrowser;
      setIsAudioLoading(false);
      void audio.play().catch(speakInBrowser);
    }).catch(speakInBrowser);
    return () => {
      cancelled = true;
      if (speechFallbackTimer !== null) window.clearInterval(speechFallbackTimer);
      if (audio) { audio.pause(); audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; }
      window.speechSynthesis?.cancel();
    };
  }, [isAudioPlaying, audioQueue, audioIndex, audioSpeed, bookId, requestReaderAudio, advanceAudio]);

  // Prepare the next two clips while the current clip is playing to reduce silence.
  useEffect(() => {
    if (!isAudioPlaying || audioQueue.length === 0) return;
    const upcoming = audioQueue.slice(audioIndex + 1, audioIndex + 3);
    void Promise.all(upcoming.map((row) => prepareReaderAudio(row).catch(() => undefined)));
  }, [isAudioPlaying, audioQueue, audioIndex, prepareReaderAudio]);

  // Keep the first two clips of only the next page ready; do not synthesize the whole book.
  useEffect(() => {
    if (!isAudioPlaying || audioQueue.length === 0 || audioPage + 1 >= totalPages || stride <= 0) return;
    const nextPage = audioPage + 1;
    if (prefetchedPageRef.current === nextPage) return;
    const frame = requestAnimationFrame(() => {
      const rows = collectPageAudioSentences(contentRef.current, nextPage, stride);
      if (rows.length === 0) return;
      prefetchedPageRef.current = nextPage;
      void Promise.all(rows.slice(0, 2).map((row) => prepareReaderAudio(row).catch(() => undefined)));
    });
    return () => cancelAnimationFrame(frame);
  }, [isAudioPlaying, audioQueue.length, audioPage, totalPages, stride, prepareReaderAudio]);

  useEffect(() => {
    if (!isAudioPlaying || !audioQueue[audioIndex]) return;
    localStorage.setItem(audioProgressKey, JSON.stringify({ page: audioPage, sentenceId: audioQueue[audioIndex].id }));
  }, [isAudioPlaying, audioQueue, audioIndex, audioProgressKey, audioPage]);

  useEffect(() => () => {
    audioPlayTokenRef.current += 1;
    audioElementRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextPage();
      if (e.key === "ArrowLeft") prevPage();
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage, navigate]);

  // 차례 항목 클릭 시 정확한 페이지로 이동하는 함수
  const navigateToTocItem = useCallback((tocIdx: number) => {
    const lineIdx = tocLineIndices[tocIdx];
    if (lineIdx < 0 || !contentRef.current || stride === 0) {
      // 매칭 실패 시 비율 기반 폴백
      const fallbackPage = Math.floor((tocIdx / tocItems.length) * totalPages);
      setCurrentPage(Math.min(fallbackPage, totalPages - 1));
      return;
    }
    // data-line-index 속성으로 해당 DOM 요소를 찾아 offsetLeft 기반 페이지 계산
    const targetEl = contentRef.current.querySelector(
      `[data-line-index="${lineIdx}"]`
    ) as HTMLElement | null;
    if (targetEl) {
      const targetLeft = targetEl.offsetLeft;
      const page = Math.floor(targetLeft / stride);
      setCurrentPage(Math.min(page, totalPages - 1));
    } else {
      // DOM 요소를 못 찾으면 비율 기반 폴백
      const fallbackPage = Math.floor((lineIdx / lines.length) * totalPages);
      setCurrentPage(Math.min(fallbackPage, totalPages - 1));
    }
  }, [tocLineIndices, tocItems.length, totalPages, stride, lines.length]);

  // Bookmark toggle
  const isCurrentPageBookmarked = useMemo(() => {
    if (!userBookmarks) return false;
    return userBookmarks.some((b) => b.page === currentPage);
  }, [userBookmarks, currentPage]);

  const toggleBookmark = useCallback(() => {
    if (!user) return;
    if (isCurrentPageBookmarked) {
      const bm = userBookmarks?.find((b) => b.page === currentPage);
      if (bm) {
        removeBookmarkMutation.mutate(
          { id: bm.id },
          { onSuccess: () => utils.bookmarks.list.invalidate({ bookId }) }
        );
      }
    } else {
      addBookmarkMutation.mutate(
        { bookId, page: currentPage, label: `${currentPage + 1}페이지` },
        { onSuccess: () => utils.bookmarks.list.invalidate({ bookId }) }
      );
    }
  }, [
    user,
    isCurrentPageBookmarked,
    userBookmarks,
    currentPage,
    bookId,
    utils,
  ]);

  // Touch swipe
  const minSwipeDistance = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextPage();
    } else if (isRightSwipe) {
      prevPage();
    }
  }, [touchStart, touchEnd, nextPage, prevPage]);

  const onClose = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (bookLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fdfbf7]">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!book && !offlineBook) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fdfbf7] gap-4">
        <p className="text-lg">도서를 찾을 수 없습니다.</p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-amber-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const displayTitle = book?.title || offlineBook?.title || "";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col h-screen transition-colors duration-300 ${THEME_CLASSES[theme]}`}
    >
      {/* Header */}
      <header
        className={`flex justify-between items-center px-4 md:px-6 h-14 border-b ${
          theme === "dark"
            ? "border-gray-800 bg-gray-900/90"
            : "border-gray-200 bg-white/80"
        } backdrop-blur-md z-20`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-serif font-bold truncate max-w-[150px] md:max-w-md">
            {displayTitle}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleAudioPlayback}
            className={`p-2 hover:bg-black/5 rounded-full transition-colors ${isAudioPlaying ? "text-amber-600" : ""}`}
            title={isAudioPlaying ? "낭독 일시정지" : "낭독 시작"}
            aria-label={isAudioPlaying ? "낭독 일시정지" : "낭독 시작"}
          >
            {isAudioPlaying ? <Pause className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          {tocItems.length > 0 && (
            <button
              onClick={() => { setShowToc(!showToc); setShowStudyMaterial(false); setShowSettings(false); }}
              className={`p-2 hover:bg-black/5 rounded-full transition-colors ${showToc ? "text-amber-500" : ""}`}
              title="차례"
            >
              <List className="w-5 h-5" />
            </button>
          )}
          {book?.studyMaterial && (
            <button
              onClick={() => { setShowStudyMaterial(!showStudyMaterial); setShowToc(false); setShowSettings(false); }}
              className={`p-2 hover:bg-black/5 rounded-full transition-colors ${showStudyMaterial ? "text-amber-500" : ""}`}
              title="학습자료"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          )}
          {user && (
            <button
              onClick={toggleBookmark}
              className={`p-2 hover:bg-black/5 rounded-full ${
                isCurrentPageBookmarked ? "text-amber-500" : ""
              }`}
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isCurrentPageBookmarked ? "fill-current" : ""
                }`}
              />
            </button>
          )}
          <button
            onClick={isCached ? handleOfflineRemove : handleOfflineSave}
            disabled={isCaching || !content}
            className={`p-2 hover:bg-black/5 rounded-full transition-colors ${
              isCached ? "text-green-600" : ""
            }`}
            title={isCached ? "오프라인 저장됨 (클릭하여 삭제)" : "오프라인 저장"}
          >
            {isCaching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isCached ? (
              <Check className="w-5 h-5" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); setShowToc(false); setShowStudyMaterial(false); }}
            className="p-2 hover:bg-black/5 rounded-full"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>
      <audio ref={audioElementRef} preload="none" className="hidden" />

      {/* TOC Panel */}
      <AnimatePresence>
        {showToc && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`absolute top-16 left-4 p-5 rounded-xl shadow-2xl border z-30 w-72 max-h-[70vh] overflow-y-auto ${
              theme === "dark"
                ? "bg-gray-800 border-gray-700 text-gray-100"
                : "bg-white border-gray-100 text-gray-900"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">📋 차례</h3>
              <button onClick={() => setShowToc(false)} className="p-1 hover:bg-black/5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {tocItems.map((item, idx) => {
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      navigateToTocItem(idx);
                      setShowToc(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors ${
                      theme === "dark" ? "hover:bg-gray-700 hover:text-amber-400" : ""
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Study Material Panel */}
      <AnimatePresence>
        {showStudyMaterial && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`absolute top-16 left-4 p-5 rounded-xl shadow-2xl border z-30 w-80 max-h-[70vh] overflow-y-auto ${
              theme === "dark"
                ? "bg-gray-800 border-gray-700 text-gray-100"
                : "bg-white border-gray-100 text-gray-900"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">📚 학습자료</h3>
              <button onClick={() => setShowStudyMaterial(false)} className="p-1 hover:bg-black/5 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {book?.studyMaterial || "학습자료가 없습니다."}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-16 right-4 p-5 rounded-xl shadow-2xl border z-30 w-80 max-h-[70vh] overflow-y-auto ${
              theme === "dark"
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
            }`}
          >
            <div className="space-y-6">
              {/* Theme */}
              <div>
                <p className="text-xs font-bold mb-3 opacity-60 uppercase tracking-wider">
                  테마
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className={`p-3 rounded-lg border transition-all ${
                      theme === "light"
                        ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <Sun className="w-4 h-4" />
                    <span className="text-[10px]">라이트</span>
                  </button>
                  <button
                    onClick={() => setTheme("sepia")}
                    className={`p-3 rounded-lg border transition-all ${
                      theme === "sepia"
                        ? "border-amber-500 bg-[#f4ecd8] ring-1 ring-amber-500"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <Coffee className="w-4 h-4" />
                    <span className="text-[10px]">세피아</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`p-3 rounded-lg border transition-all ${
                      theme === "dark"
                        ? "border-amber-500 bg-gray-700 text-white ring-1 ring-amber-500"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <Moon className="w-4 h-4" />
                    <span className="text-[10px]">다크</span>
                  </button>
                  <button
                    onClick={() => setTheme("eink")}
                    className={`p-3 rounded-lg border transition-all ${
                      theme === "eink"
                        ? "border-gray-900 bg-white ring-1 ring-gray-900"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">E</span>
                    <span className="text-[10px]">E-ink</span>
                  </button>
                </div>
              </div>

              {/* Read Mode */}
              <div>
                <p className="text-xs font-bold mb-3 opacity-60 uppercase tracking-wider">
                  읽기 방식
                </p>
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <button
                    onClick={() => setReadMode("page")}
                    className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      readMode === "page"
                        ? "bg-white dark:bg-gray-600 shadow-sm text-amber-600"
                        : "text-gray-500"
                    }`}
                  >
                    <ChevronLeft className="w-3 h-3" />페이지 넘김<ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setReadMode("scroll")}
                    className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      readMode === "scroll"
                        ? "bg-white dark:bg-gray-600 shadow-sm text-amber-600"
                        : "text-gray-500"
                    }`}
                  >
                    ↕ 스크롤
                  </button>
                </div>
              </div>

              {/* Audio playback */}
              <div>
                <p className="text-xs font-bold mb-3 opacity-60 uppercase tracking-wider">오디오 낭독</p>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                  <button onClick={() => skipAudioSentence(-1)} className="p-2 rounded hover:bg-black/5" title="이전 문단" aria-label="이전 문단">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={toggleAudioPlayback}
                    disabled={isAudioLoading && !isAudioPlaying}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-600 px-3 py-2 text-white text-sm disabled:opacity-50"
                  >
                    {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isAudioLoading ? "준비 중" : isAudioPlaying ? "일시정지" : "듣기"}
                  </button>
                  <button onClick={() => skipAudioSentence(1)} className="p-2 rounded hover:bg-black/5" title="다음 문단" aria-label="다음 문단">
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>
                <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span>읽기 속도</span>
                  <select
                    value={audioSpeed}
                    onChange={(event) => setAudioSpeed(Number(event.target.value))}
                    className="rounded border border-border bg-background px-3 py-2"
                    aria-label="낭독 속도"
                  >
                    {[0.8, 1, 1.2, 1.5].map((speed) => <option key={speed} value={speed}>{speed.toFixed(1)}배</option>)}
                  </select>
                </label>
                {audioUsesBrowserVoice && <p className="mt-2 text-xs text-muted-foreground">브라우저 기본 음성 사용 중</p>}
              </div>

              {/* Font Size */}
              <div>
                <div className="flex justify-between mb-3">
                  <p className="text-xs font-bold opacity-60 uppercase tracking-wider">
                    글자 크기
                  </p>
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                    {fontSize}px
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <button
                    onClick={() => setFontSize((s) => Math.max(12, s - 2))}
                    className="p-2 rounded-md bg-white dark:bg-gray-600 shadow-sm hover:bg-gray-100 transition-colors"
                    aria-label="글자 작게"
                  >
                    <Type className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    step="1"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <button
                    onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                    className="p-2 rounded-md bg-white dark:bg-gray-600 shadow-sm hover:bg-gray-100 transition-colors"
                    aria-label="글자 크게"
                  >
                    <Type className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Line Height */}
              <div>
                <div className="flex justify-between mb-3">
                  <p className="text-xs font-bold opacity-60 uppercase tracking-wider">
                    줄 간격
                  </p>
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                    {lineHeight.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <span className="text-xs opacity-50">좁게</span>
                  <input
                    type="range"
                    min="1.4"
                    max="2.4"
                    step="0.1"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-xs opacity-80">넓게</span>
                </div>
              </div>

              {/* View Mode - only show on larger screens */}
              <div className="hidden md:block">
                <p className="text-xs font-bold mb-3 opacity-60 uppercase tracking-wider">
                  보기 모드
                </p>
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <button
                    onClick={() => setIsTwoPageMode(false)}
                    className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      !isTwoPageMode
                        ? "bg-white dark:bg-gray-600 shadow-sm text-amber-600"
                        : "text-gray-500"
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />한 페이지
                  </button>
                  <button
                    onClick={() => setIsTwoPageMode(true)}
                    className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      isTwoPageMode
                        ? "bg-white dark:bg-gray-600 shadow-sm text-amber-600"
                        : "text-gray-500"
                    }`}
                  >
                    <Columns className="w-3 h-3" />두 페이지
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden flex items-center justify-center">
        {!isFullyReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-inherit">
            <Loader2 className={`w-10 h-10 ${isEinkMode ? '' : 'animate-spin'} text-amber-500`} />
            <p className="font-serif text-sm">문서를 불러오는 중입니다...</p>
          </div>
        )}

        {readMode === "scroll" ? (
          /* 스크롤 모드 */
          <div
            className={`w-full h-full overflow-y-auto px-4 md:px-8 py-8 max-w-[800px] mx-auto ${
              !isFullyReady ? "opacity-0" : "opacity-100"
            }`}
            ref={containerRef}
          >
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-bold mb-4">{displayTitle}</h2>
              <div className={`w-10 h-1 mx-auto opacity-50 ${isEinkMode ? 'bg-black' : 'bg-amber-500'}`}></div>
            </div>
            <div
              ref={contentRef}
              className="font-serif text-justify select-text"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
              }}
            >
              {lines.map((line, idx) => renderAudioLine(line, idx))}
            </div>
            <div className="h-20 flex items-center justify-center opacity-30">
              <p className="text-sm font-sans">- 끝 -</p>
            </div>
          </div>
        ) : (
          /* 페이지 넘김 모드 */
          <div
            ref={containerRef}
            className={`relative w-full h-full max-w-[1200px] mx-auto ${
              isEinkMode ? '' : 'transition-all duration-300'
            } ${
              !isFullyReady ? "opacity-0" : "opacity-100"
            }`}
            style={{
              paddingTop: isTwoPageMode ? "40px" : "20px",
              paddingBottom: isTwoPageMode ? "40px" : "20px",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* 좌우 터치 영역 (페이지 넘김) */}
            <div
              className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
              onClick={prevPage}
              aria-label="이전 페이지"
            />
            <div
              className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer"
              onClick={nextPage}
              aria-label="다음 페이지"
            />

            {/* Viewport mask */}
            <div
              className="h-full overflow-hidden mx-auto"
              style={{
                width: dimensions.width > 0 ? `${dimensions.width}px` : "100%",
              }}
            >
              {/* Sliding content track */}
              {isEinkMode ? (
                <div
                  className="h-full"
                  style={{
                    display: "flex",
                    width: "max-content",
                    backfaceVisibility: "hidden",
                    transform: `translateX(${-currentPage * stride}px)`,
                  }}
                >
                  <div
                    ref={contentRef}
                    className="font-serif text-justify select-text"
                    style={{
                      columnWidth: `${columnDimensions.colWidth}px`,
                      columnGap: `${GAP_SIZE}px`,
                      columnFill: "auto",
                      height: `${columnDimensions.colHeight}px`,
                      width:
                        containerWidth !== null
                          ? `${containerWidth}px`
                          : "max-content",
                      fontSize: `${fontSize}px`,
                      lineHeight: lineHeight,
                      boxSizing: "border-box",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    <div className="mb-4 sm:mb-8 text-center">
                      <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">{displayTitle}</h2>
                      <div className="w-10 h-1 bg-black mx-auto opacity-30"></div>
                    </div>
                    {lines.map((line, idx) => renderAudioLine(line, idx))}
                    <div className="h-8 w-full flex items-center justify-center opacity-30">
                      <p className="text-sm font-sans">- 끝 -</p>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  animate={{ x: -currentPage * stride }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="h-full"
                  style={{
                    display: "flex",
                    width: "max-content",
                    backfaceVisibility: "hidden",
                  }}
                >
                  <div
                    ref={contentRef}
                    className="font-serif text-justify select-text"
                    style={{
                      columnWidth: `${columnDimensions.colWidth}px`,
                      columnGap: `${GAP_SIZE}px`,
                      columnFill: "auto",
                      height: `${columnDimensions.colHeight}px`,
                      width:
                        containerWidth !== null
                          ? `${containerWidth}px`
                          : "max-content",
                      fontSize: `${fontSize}px`,
                      lineHeight: lineHeight,
                      boxSizing: "border-box",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    <div className="mb-4 sm:mb-8 text-center">
                      <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-4">{displayTitle}</h2>
                      <div className="w-10 h-1 bg-amber-500 mx-auto opacity-50"></div>
                    </div>
                    {lines.map((line, idx) => renderAudioLine(line, idx))}
                    <div className="h-8 w-full flex items-center justify-center opacity-30">
                      <p className="text-sm font-sans">- 끝 -</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className={`flex flex-col justify-center px-4 md:px-6 min-h-14 py-1 border-t ${
          theme === "dark" ? "border-gray-800" : "border-gray-100"
        } z-20 bg-inherit`}
      >
        <div className="flex justify-between items-center max-w-[1200px] mx-auto w-full">
          <div className="flex-1 mr-6 hidden md:block">
            <div className="w-full bg-gray-200/50 h-1 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${
                  theme === "dark" ? "bg-gray-500" : "bg-gray-800"
                }`}
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentPage + 1) / totalPages) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mx-auto md:mx-0">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="p-2 disabled:opacity-30 hover:text-amber-600 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="font-mono text-xs font-medium min-w-[60px] text-center">
              {`${currentPage + 1} / ${totalPages}`}
            </span>

            <button
              onClick={nextPage}
              disabled={currentPage >= totalPages - 1}
              className="p-2 disabled:opacity-30 hover:text-amber-600 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
