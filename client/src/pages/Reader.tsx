import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, ChevronLeft, Minus, Plus, Sun } from "lucide-react";

const CHARS_PER_PAGE = 1500;

type Theme = "light" | "sepia" | "dark";
const THEME_STYLES: Record<Theme, { bg: string; text: string; label: string }> = {
  light: { bg: "bg-white", text: "text-gray-900", label: "라이트" },
  sepia: { bg: "bg-amber-50", text: "text-amber-900", label: "세피아" },
  dark: { bg: "bg-gray-900", text: "text-gray-100", label: "다크" },
};

export default function Reader() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const bookId = Number(params.id);
  const { user, isAuthenticated } = useAuth();

  const { data: book, isLoading } = trpc.books.getById.useQuery({ id: bookId }, { enabled: !!bookId });
  const { data: progress } = trpc.progress.get.useQuery({ bookId }, { enabled: isAuthenticated && !!bookId });
  const { data: userBookmarks, refetch: refetchBookmarks } = trpc.bookmarks.list.useQuery({ bookId }, { enabled: isAuthenticated && !!bookId });

  const saveProgress = trpc.progress.save.useMutation();
  const addBookmark = trpc.bookmarks.add.useMutation({ onSuccess: () => refetchBookmarks() });
  const removeBookmark = trpc.bookmarks.remove.useMutation({ onSuccess: () => refetchBookmarks() });

  const [currentPage, setCurrentPage] = useState(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [progressRestored, setProgressRestored] = useState(false);

  const pages = useMemo(() => {
    if (!book?.content) return [];
    const content = book.content;
    const result: string[] = [];
    for (let i = 0; i < content.length; i += CHARS_PER_PAGE) {
      result.push(content.slice(i, i + CHARS_PER_PAGE));
    }
    return result.length > 0 ? result : [""];
  }, [book?.content]);

  const totalPages = pages.length;

  useEffect(() => {
    if (progressRestored) return;
    if (!isAuthenticated) {
      setProgressRestored(true);
      return;
    }
    if (progress !== undefined) {
      if (progress && progress.currentPage < totalPages) {
        setCurrentPage(progress.currentPage);
      }
      setProgressRestored(true);
    }
  }, [progress, progressRestored, totalPages, isAuthenticated]);

  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!isAuthenticated || !progressRestored || totalPages === 0) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      saveProgress.mutate({ bookId, currentPage, totalPages });
    }, 2000);
    return () => { if (saveRef.current) clearTimeout(saveRef.current); };
  }, [currentPage, isAuthenticated, progressRestored, bookId, totalPages]);

  const goNext = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const touchStartRef = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (diff > 50) goNext();
    else if (diff < -50) goPrev();
  };

  const isBookmarked = userBookmarks?.some((b) => b.page === currentPage);

  const toggleBookmark = () => {
    if (!isAuthenticated) return;
    const existing = userBookmarks?.find((b) => b.page === currentPage);
    if (existing) {
      removeBookmark.mutate({ id: existing.id });
    } else {
      addBookmark.mutate({ bookId, page: currentPage, label: `${currentPage + 1}페이지` });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">도서를 찾을 수 없습니다.</p>
          <Button onClick={() => setLocation("/")}>돌아가기</Button>
        </div>
      </div>
    );
  }

  const themeStyle = THEME_STYLES[theme];

  return (
    <div className={`min-h-screen flex flex-col ${themeStyle.bg} ${themeStyle.text}`}>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> 목록
        </Button>
        <h1 className="text-sm font-medium truncate max-w-[50%]">{book.title}</h1>
        <div className="flex gap-1">
          {isAuthenticated && (
            <Button variant="ghost" size="sm" onClick={toggleBookmark} className={isBookmarked ? "text-yellow-500" : ""}>
              <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Sun className="w-4 h-4" />
          </Button>
          {isAuthenticated && (
            <Button variant="ghost" size="sm" onClick={() => setShowBookmarks(!showBookmarks)}>
              <BookOpen className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {showSettings && (
        <div className="px-4 py-3 border-b border-border/30 flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center gap-2">
            <span>테마:</span>
            {(Object.keys(THEME_STYLES) as Theme[]).map((t) => (
              <Button key={t} variant={theme === t ? "default" : "outline"} size="sm" onClick={() => setTheme(t)}>
                {THEME_STYLES[t].label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span>글자:</span>
            <Button variant="outline" size="sm" onClick={() => setFontSize((s) => Math.max(12, s - 2))}><Minus className="w-3 h-3" /></Button>
            <span>{fontSize}px</span>
            <Button variant="outline" size="sm" onClick={() => setFontSize((s) => Math.min(32, s + 2))}><Plus className="w-3 h-3" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <span>줄간격:</span>
            <Button variant="outline" size="sm" onClick={() => setLineHeight((l) => Math.max(1.2, +(l - 0.2).toFixed(1)))}><Minus className="w-3 h-3" /></Button>
            <span>{lineHeight.toFixed(1)}</span>
            <Button variant="outline" size="sm" onClick={() => setLineHeight((l) => Math.min(3.0, +(l + 0.2).toFixed(1)))}><Plus className="w-3 h-3" /></Button>
          </div>
        </div>
      )}

      {showBookmarks && userBookmarks && userBookmarks.length > 0 && (
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-sm font-medium mb-2">북마크 목록</p>
          <div className="flex flex-wrap gap-2">
            {userBookmarks.map((bm) => (
              <Button key={bm.id} variant="outline" size="sm" onClick={() => { setCurrentPage(bm.page); setShowBookmarks(false); }}>
                {bm.label || `${bm.page + 1}p`}
              </Button>
            ))}
          </div>
        </div>
      )}

      <main
        className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
      >
        <div className="whitespace-pre-wrap break-words">
          {pages[currentPage] || ""}
        </div>
      </main>

      <footer className="flex items-center justify-between px-4 py-3 border-t border-border/30">
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentPage === 0}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="text-sm opacity-70">
          {currentPage + 1} / {totalPages}
          {isAuthenticated && totalPages > 0 && (
            <span className="ml-2">({Math.round(((currentPage + 1) / totalPages) * 100)}%)</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={goNext} disabled={currentPage >= totalPages - 1}>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </footer>
    </div>
  );
}
