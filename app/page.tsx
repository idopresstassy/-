"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Book } from "@/lib/books";
import { useBooks } from "@/lib/useBooks";
import { useDonation } from "@/lib/useDonation";
import BookReader from "@/components/BookReader";
import { useAuth } from "@/lib/AuthContext";
import AuthModal from "@/components/AuthModal";
import {
  Search,
  BookOpen,
  PlayCircle,
  Settings,
  Loader2,
  X,
  LogIn,
  LogOut,
  User,
} from "lucide-react";

const GENRES = ["전체", "고전", "현대", "해외"] as const;

export default function Home() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("전체");
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { books, isLoaded } = useBooks();
  const { donation, isLoaded: donationLoaded } = useDonation();
  const { user, isAdmin, signOut } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDonationModal(false);
    };
    if (showDonationModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showDonationModal]);

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.includes(searchTerm) || book.author.includes(searchTerm);
    const matchesGenre =
      selectedGenre === "전체" || book.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="min-h-screen pb-20 bg-[#fdfbf7]">
      {/* Header */}
      <header className="pt-16 pb-8 px-6 text-center border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="absolute top-6 right-6 flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-gray-500 hidden sm:inline">
                <User className="w-3 h-3 inline mr-1" />
                {user.email}
              </span>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
                  title="관리자 페이지"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              )}
              <button
                onClick={() => signOut()}
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
                title="로그아웃"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              로그인
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-2">
          <Image
            src="/logo.png"
            alt="한국문학도서관 로고"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 font-serif">
            한국문학도서관
          </h1>
        </div>
        <button
          onClick={() => setShowDonationModal(true)}
          className="text-gray-500 text-sm md:text-base mb-6 hover:text-amber-600 transition-colors cursor-pointer"
        >
          한국문화도서관은 여러분의 후원과 구독으로 운영됩니다.
          <span className="text-amber-500 ml-1 underline">(자세히 보기)</span>
        </button>

        {/* Search */}
        <div className="max-w-md mx-auto relative group mb-4">
          <input
            type="text"
            placeholder="도서명 또는 작가 검색..."
            className="w-full pl-12 pr-6 py-3 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Search className="w-5 h-5" />
          </div>
        </div>

        {/* Genre Filter */}
        <div className="flex justify-center gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedGenre === genre
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </header>

      {/* Book List */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!isLoaded ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {filteredBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 flex flex-col md:flex-row gap-6 items-start md:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 font-serif">
                        {book.title}
                      </h3>
                      <span className="text-sm text-gray-500 font-medium">
                        {book.author}
                      </span>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      {book.genre}
                    </span>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto shrink-0">
                    <button
                      onClick={() => setCurrentBook(book)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <BookOpen className="w-4 h-4" />
                      읽기
                    </button>
                    {book.videoUrl && (
                      <a
                        href={book.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium border border-amber-100"
                      >
                        <PlayCircle className="w-4 h-4" />
                        영상
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredBooks.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                검색 결과가 없습니다.
              </div>
            )}
          </>
        )}
      </main>

      {/* Reader Overlay */}
      {currentBook && (
        <BookReader
          bookId={currentBook.id}
          title={currentBook.title}
          content={currentBook.content}
          onClose={() => setCurrentBook(null)}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {/* 후원 안내 모달 - DB에서 동적으로 로드 */}
      {showDonationModal && donationLoaded && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDonationModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900 font-serif">
                한국문학도서관을 응원해 주세요
              </h2>
              <button
                onClick={() => setShowDonationModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 text-gray-700 text-sm leading-relaxed">
              {donation.description.split('\n').map((paragraph, idx) => (
                <p key={idx} className={paragraph.startsWith('*') ? 'text-amber-600 font-medium' : ''}>
                  {paragraph}
                </p>
              ))}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                <h3 className="font-bold text-gray-900 mb-3">후원 방법</h3>
                <div className="space-y-1">
                  <p>
                    <span className="text-gray-500">{donation.bank_name}</span>{" "}
                    <span className="font-mono font-bold">{donation.account_number}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">예금주</span>{" "}
                    <span className="font-bold">{donation.account_holder}</span>
                  </p>
                </div>
              </div>

              <p className="text-gray-500">
                문의:{" "}
                <a
                  href={`mailto:${donation.contact_email}`}
                  className="text-amber-600 hover:underline"
                >
                  {donation.contact_email}
                </a>
              </p>

              {donation.closing_message.split('\n').map((line, idx) => (
                <p key={idx} className={idx === 0 ? 'pt-2' : ''}>
                  {line}
                </p>
              ))}
              <p className="font-medium text-gray-900">{donation.representative}</p>

              <div className="bg-gray-100 rounded-lg p-3 text-xs text-gray-500 mt-4">
                {donation.legal_notice}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
