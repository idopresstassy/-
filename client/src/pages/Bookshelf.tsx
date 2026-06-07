import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import {
  BookOpen,
  Download,
  Trash2,
  ArrowLeft,
  WifiOff,
  Library,
  Loader2,
} from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Bookshelf() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { getAllCachedBooks, removeCachedBook } = useOfflineCache();

  // Server bookshelf (logged-in users)
  const { data: serverBooks, isLoading: serverLoading } =
    trpc.bookshelf.list.useQuery(undefined, { enabled: !!user });
  const removeFromShelfMutation = trpc.bookshelf.remove.useMutation();
  const utils = trpc.useUtils();

  // Offline cached books (all users)
  const [cachedBooks, setCachedBooks] = useState<
    Array<{ bookId: number; title: string; author: string; cachedAt: number }>
  >([]);
  const [loadingCached, setLoadingCached] = useState(true);

  useEffect(() => {
    getAllCachedBooks().then((books) => {
      setCachedBooks(books);
      setLoadingCached(false);
    });
  }, [getAllCachedBooks]);

  const handleRemoveFromServer = async (bookId: number) => {
    await removeFromShelfMutation.mutateAsync({ bookId });
    utils.bookshelf.list.invalidate();
  };

  const handleRemoveOffline = async (bookId: number) => {
    await removeCachedBook(bookId);
    setCachedBooks((prev) => prev.filter((b) => b.bookId !== bookId));
  };

  const isLoading = serverLoading || loadingCached;

  // Merge server books and cached books (avoid duplicates)
  const allBooks = (() => {
    const merged: Array<{
      bookId: number;
      title: string;
      author: string;
      inServer: boolean;
      inCache: boolean;
      genre?: string;
    }> = [];

    // Add server books first
    if (serverBooks) {
      for (const sb of serverBooks) {
        merged.push({
          bookId: sb.bookId,
          title: sb.title,
          author: sb.author,
          genre: sb.genre,
          inServer: true,
          inCache: cachedBooks.some((cb) => cb.bookId === sb.bookId),
        });
      }
    }

    // Add cached-only books
    for (const cb of cachedBooks) {
      if (!merged.some((m) => m.bookId === cb.bookId)) {
        merged.push({
          bookId: cb.bookId,
          title: cb.title,
          author: cb.author,
          inServer: false,
          inCache: true,
        });
      }
    }

    return merged;
  })();

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Library className="w-5 h-5 text-amber-700" />
              <h1 className="text-lg font-bold font-serif">내 책장</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Not logged in notice */}
        {!user && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              로그인하면 여러 기기에서 내 책장을 동기화할 수 있습니다.
              오프라인 저장은 로그인 없이도 사용 가능합니다.
            </p>
            <a
              href={getLoginUrl()}
              className="inline-block mt-2 text-sm font-medium text-amber-700 underline"
            >
              로그인하기
            </a>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-700" />
          </div>
        ) : allBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-lg font-medium text-gray-500 mb-2">
              책장이 비어있습니다
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              도서를 읽으면서 오프라인 저장 버튼(↓)을 눌러 책을 추가하세요.
            </p>
            <Link
              href="/"
              className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm hover:bg-amber-800 transition-colors"
            >
              도서 목록으로
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {allBooks.map((book) => (
              <div
                key={book.bookId}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Book info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-bold text-base truncate">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{book.author}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {book.inCache && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                        <WifiOff className="w-3 h-3" />
                        오프라인 저장됨
                      </span>
                    )}
                    {book.inServer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        <Download className="w-3 h-3" />
                        서버 저장됨
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/read/${book.bookId}`}
                    className="p-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                    title="읽기"
                  >
                    <BookOpen className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => {
                      if (book.inCache) handleRemoveOffline(book.bookId);
                      if (book.inServer) handleRemoveFromServer(book.bookId);
                    }}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            오프라인 읽기 안내
          </h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 이북 뷰어에서 ↓ 버튼을 누르면 오프라인 저장됩니다</li>
            <li>• 오프라인 저장된 책은 인터넷 없이도 읽을 수 있습니다</li>
            <li>• 브라우저 캐시를 삭제하면 저장된 데이터도 사라집니다</li>
            {user && (
              <li>
                • 로그인 상태에서는 서버에도 책장이 저장되어 다른 기기에서도
                확인 가능합니다
              </li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
