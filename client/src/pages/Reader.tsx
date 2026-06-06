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
} from "lucide-react";

type Theme = "light" | "dark" | "sepia";

const THEME_CLASSES = {
  light: "bg-[#fdfbf7] text-gray-900",
  dark: "bg-gray-900 text-gray-100",
  sepia: "bg-[#f4ecd8] text-[#5b4636]",
} as const;

export default function Reader() {
  // FIXED: route path matches App.tsx "/read/:id"
  const [, params] = useRoute("/read/:id");
  const [, navigate] = useLocation();
  const bookId = params?.id ? Number(params.id) : 0;
  const { user } = useAuth();

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
  const { data: savedProgress } = trpc.progress.get.useQuery(
    { bookId },
    { enabled: bookId > 0 && !!user }
  );
  const saveProgressMutation = trpc.progress.save.useMutation();

  // Bookmarks
  const { data: userBookmarks } = trpc.bookmarks.list.useQuery(
    { bookId },
    { enabled: bookId > 0 && !!user }
  );
  const addBookmarkMutation = trpc.bookmarks.add.useMutation();
  const removeBookmarkMutation = trpc.bookmarks.remove.useMutation();
  const utils = trpc.useUtils();

  // Determine content
  const content = useMemo(() => {
    if (gdriveData?.content) return gdriveData.content;
    if (book?.content) return book.content;
    return "";
  }, [gdriveData, book]);

  const lines = useMemo(
    () => content.split("\n").filter((l) => l.trim()),
    [content]
  );

  // State
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isTwoPageMode, setIsTwoPageMode] = useState(false);
  const [stride, setStride] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [theme, setTheme] = useState<Theme>("light");
  const [showSettings, setShowSettings] = useState(false);

  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const GAP_SIZE = 40;

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

  // Restore reading position
  useEffect(() => {
    if (
      hasRestoredProgress ||
      !savedProgress ||
      savedProgress.currentPage === 0 ||
      !contentRef.current ||
      totalPages <= 1 ||
      stride === 0
    )
      return;

    setCurrentPage(Math.min(savedProgress.currentPage, totalPages - 1));
    setHasRestoredProgress(true);
  }, [savedProgress, totalPages, stride, hasRestoredProgress]);

  // Mark progress as restored if no saved progress
  useEffect(() => {
    if (!hasRestoredProgress && !savedProgress && totalPages > 1 && stride > 0) {
      setHasRestoredProgress(true);
    }
  }, [savedProgress, totalPages, stride, hasRestoredProgress]);

  // Navigation
  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : prev));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : prev));
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

  if (!book) {
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
            {book.title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
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
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-black/5 rounded-full"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-16 right-4 p-5 rounded-xl shadow-2xl border z-30 w-80 ${
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
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      theme === "light"
                        ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <Sun className="w-5 h-5" />
                    <span className="text-xs">라이트</span>
                  </button>
                  <button
                    onClick={() => setTheme("sepia")}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      theme === "sepia"
                        ? "border-amber-500 bg-[#f4ecd8] ring-1 ring-amber-500"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <Coffee className="w-5 h-5" />
                    <span className="text-xs">세피아</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      theme === "dark"
                        ? "border-amber-500 bg-gray-700 text-white ring-1 ring-amber-500"
                        : "border-gray-200 hover:bg-gray-50"
                    } flex flex-col items-center gap-1`}
                  >
                    <Moon className="w-5 h-5" />
                    <span className="text-xs">다크</span>
                  </button>
                </div>
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
                  <Type className="w-4 h-4 opacity-50" />
                  <input
                    type="range"
                    min="14"
                    max="28"
                    step="1"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <Type className="w-5 h-5 opacity-80" />
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
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
            <p className="font-serif text-sm">문서를 불러오는 중입니다...</p>
          </div>
        )}

        <div
          ref={containerRef}
          className={`relative w-full h-full max-w-[1200px] mx-auto transition-all duration-300 ${
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
          {/* Viewport mask */}
          <div
            className="h-full overflow-hidden mx-auto"
            style={{
              width: dimensions.width > 0 ? `${dimensions.width}px` : "100%",
            }}
          >
            {/* Sliding content track */}
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
              {/* CSS Columns Content */}
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
                <div className="mb-12 text-center break-inside-avoid">
                  <h2 className="text-2xl font-bold mb-4">{book.title}</h2>
                  <div className="w-10 h-1 bg-amber-500 mx-auto opacity-50"></div>
                </div>

                {lines.map((line, idx) => (
                  <p
                    key={idx}
                    data-line-index={idx}
                    className="mb-6 break-inside-avoid"
                    style={{ textIndent: "1em" }}
                  >
                    {line}
                  </p>
                ))}

                <div className="h-[30vh] w-full break-inside-avoid flex items-center justify-center opacity-30">
                  <p className="text-sm font-sans">- 끝 -</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`flex items-center px-4 md:px-6 h-14 border-t ${
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
