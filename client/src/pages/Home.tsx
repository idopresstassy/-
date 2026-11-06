import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { booksQueryOptions, getBookCountLabel, shouldShowEmptyBooks } from "@/lib/booksQueryPolicy";
import { getSupabaseLoginRoute } from "@/lib/authNavigation";
import { BRAND_LOGO_URL } from "@/lib/brand";
import { WEBTOON_SITE_URL } from "@/lib/externalLinks";
import { CREATIVE_GENRES, CREATIVE_GENRE_LABELS, type CreativeGenre } from "@shared/creative";
import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Heart, Search, Youtube, LogIn, LogOut, Settings, List, X, Library, BookImage, Palette, PenLine } from "lucide-react";

const GENRES = [
  { value: undefined, label: "전체" },
  { value: "classic" as const, label: "고전" },
  { value: "modern" as const, label: "현대" },
  { value: "foreign" as const, label: "해외" },
  { value: "creative" as const, label: "창작" },
];

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [genre, setGenre] = useState<"classic" | "modern" | "foreign" | "creative" | undefined>(undefined);
  const [creativeGenre, setCreativeGenre] = useState<CreativeGenre | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showDonation, setShowDonation] = useState(false);
  const [showBookList, setShowBookList] = useState(false);

  // 전체목록용 데이터 (필터 없이 전체)
  const { data: allBooks, isError: allBooksError, refetch: refetchAllBooks } = trpc.books.list.useQuery({}, booksQueryOptions);

  const { data: books, isLoading, isError: booksError, refetch: refetchBooks } = trpc.books.list.useQuery(
    { genre, creativeGenre: genre === "creative" ? creativeGenre : undefined, search: search || undefined },
    booksQueryOptions,
  );
  const { data: donation } = trpc.donation.get.useQuery();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container flex flex-col">
          {/* Top row: Logo */}
          <div className="flex items-center justify-center py-2">
            <Link href="/" className="flex items-center gap-2">
              <img src={BRAND_LOGO_URL} alt="명작무료책방 로고" className="w-10 h-10 object-contain" />
              <h1 className="text-2xl font-bold text-foreground font-serif">명작무료책방</h1>
            </Link>
          </div>
          {/* Bottom row: Navigation */}
          <div className="flex items-center justify-center gap-3 pb-2">
            <Link href="/bookshelf">
              <Button variant="ghost" size="sm">
                <Library className="w-4 h-4 mr-1" /> 내 책장
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setShowDonation(true)}>
              <Heart className="w-4 h-4 mr-1" /> 후원
            </Button>
            {isAuthenticated ? (
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-1" /> 로그아웃
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate(getSupabaseLoginRoute(navigator.userAgent))}>
                <LogIn className="w-4 h-4 mr-1" /> 로그인
              </Button>
            )}
            {isAuthenticated && user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4 mr-1" /> 관리
                </Button>
              </Link>
            )}
            <a href={WEBTOON_SITE_URL} target="_blank" rel="noopener noreferrer" title="웹툰">
              <Button variant="ghost" size="icon" className="w-8 h-8 opacity-60 hover:opacity-100">
                <BookImage className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Announcement Banner */}
      <div className="bg-secondary/70 border-b border-border">
        <div className="container py-2 text-center">
          <p className="text-sm text-foreground">한국문학·고전문학 명작을 무료 전자책으로 읽는 명작무료책방은 여러분의 후원과 구독으로 운영됩니다.</p>
        </div>
      </div>

      {/* Search */}
      <div className="container pt-4 pb-2">
        <div className="flex gap-2 items-center">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <Input
              placeholder="제목 또는 작가명으로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="sm">
              <Search className="w-4 h-4" />
            </Button>
          </form>
          <Button variant="outline" size="sm" onClick={() => setShowBookList(true)}>
            <List className="w-4 h-4 mr-1" /> <span className="sm:hidden">목록</span><span className="hidden sm:inline">전체목록({getBookCountLabel(allBooks, allBooksError)})</span>
          </Button>
        </div>
      </div>

      {/* Genre Filter */}
      <section className="container py-6">
        <div className="flex gap-2 flex-wrap">
          {GENRES.map((g) => (
            <Button
              key={g.label}
              variant={genre === g.value ? "default" : "outline"}
              size="sm"
              onClick={() => setGenre(g.value)}
            >
              {g.label}
            </Button>
          ))}
        </div>
        {genre === "creative" && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-1">장르:</span>
            <Button size="sm" variant={creativeGenre === undefined ? "secondary" : "outline"} onClick={() => setCreativeGenre(undefined)}>전체</Button>
            {CREATIVE_GENRES.map((item) => (
              <Button key={item.value} size="sm" variant={creativeGenre === item.value ? "secondary" : "outline"} onClick={() => setCreativeGenre(item.value)}>
                {item.label}
              </Button>
            ))}
            <Link href="/creative">
              <Button size="sm" className="ml-1"><PenLine className="w-4 h-4 mr-1" />내 글 올리기</Button>
            </Link>
          </div>
        )}
      </section>

      {/* Book Grid */}
      <section className="container pb-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : booksError ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">도서 목록을 불러오는 데 시간이 걸리고 있습니다.</p>
            <p className="text-sm mb-5">잠시 후 다시 시도하거나 아래 버튼을 눌러 새로 불러와 주세요.</p>
            <Button variant="outline" onClick={() => refetchBooks()}>다시 불러오기</Button>
          </div>
        ) : books && books.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div key={book.id} className="border border-border rounded-lg p-5 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {book.genre === "classic" ? "고전" : book.genre === "modern" ? "현대" : book.genre === "creative" ? "창작" : "해외"}
                    </span>
                    {book.genre === "creative" && book.creativeGenre && (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {CREATIVE_GENRE_LABELS[book.creativeGenre]}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">{book.author}</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1 font-serif">{book.title}</h3>
                {book.description && (
                  <p className="text-sm text-muted-foreground mb-3">{book.description}</p>
                )}
                <div className="flex flex-row flex-wrap gap-2">
                  <Link href={`/read/${book.id}`} className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs flex-1">
                      <BookOpen className="w-4 h-4" /> 읽기
                  </Link>
                 {book.youtubeUrl && (
                   <a href={book.youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium transition-all border bg-transparent shadow-xs hover:bg-red-50 hover:text-red-600 text-red-500 h-8 rounded-md px-3 text-xs flex-1">
                     <Youtube className="w-4 h-4" /> 오디오북 듣기
                   </a>
                 )}
                  {book.webtoonUrl && (
                    <a href={book.webtoonUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 whitespace-nowrap font-medium transition-all border bg-transparent shadow-xs hover:bg-purple-50 hover:text-purple-600 text-purple-500 h-8 rounded-md px-3 text-xs flex-1">
                      <Palette className="w-4 h-4" /> 웹툰 보기
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : shouldShowEmptyBooks(books, booksError) ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>등록된 도서가 없습니다.</p>
          </div>
        ) : null}
      </section>

      {/* Donation Modal */}
      {showDonation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowDonation(false)}>
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold font-serif mb-4 text-foreground">후원 안내</h3>
            {donation ? (
              <div className="space-y-3 text-sm">
                {donation.description && <p className="text-foreground">{donation.description}</p>}
                {donation.bankName && (
                  <div className="bg-secondary p-3 rounded">
                    <p className="font-medium">입금 정보</p>
                    <p>{donation.bankName} {donation.accountNumber}</p>
                    <p>예금주: {donation.accountHolder}</p>
                  </div>
                )}
                {donation.email && <p className="text-muted-foreground">이메일: {donation.email}</p>}
                {donation.representative && <p className="text-muted-foreground">대표: {donation.representative}</p>}
                {donation.closingMessage && <p className="text-foreground mt-3 italic">{donation.closingMessage}</p>}
                {donation.legalNotice && <p className="text-xs text-muted-foreground mt-3">{donation.legalNotice}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground">후원 정보를 불러오는 중...</p>
            )}
            <Button variant="outline" className="w-full mt-4" onClick={() => setShowDonation(false)}>
              닫기
            </Button>
          </div>
        </div>
      )}

      {/* Book List Modal */}
      {showBookList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowBookList(false)}>
          <div className="bg-card rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold font-serif text-foreground">전체 목록 <span className="text-sm font-normal text-muted-foreground">({getBookCountLabel(allBooks, allBooksError)}{allBooksError ? "" : "권"})</span></h3>
              <button onClick={() => setShowBookList(false)} className="p-1 hover:bg-secondary rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {allBooksError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-4">전체 목록을 불러오지 못했습니다.</p>
                  <Button variant="outline" size="sm" onClick={() => refetchAllBooks()}>다시 불러오기</Button>
                </div>
              ) : allBooks && allBooks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allBooks.map((book) => {
                    const genreColor = book.genre === "classic"
                      ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                      : book.genre === "modern"
                      ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                      : book.genre === "creative"
                      ? "bg-violet-50 border-violet-200 hover:bg-violet-100"
                      : "bg-sky-50 border-sky-200 hover:bg-sky-100";
                    return (
                      <Link
                        key={book.id}
                        href={`/read/${book.id}`}
                        className={`flex flex-col items-center justify-center p-3 rounded-md border text-center transition-colors ${genreColor}`}
                        onClick={() => setShowBookList(false)}
                      >
                        <span className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{book.title}</span>
                        <span className="text-xs text-muted-foreground mt-1">{book.author}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : shouldShowEmptyBooks(allBooks, allBooksError) ? (
                <p className="text-center py-8 text-muted-foreground">등록된 도서가 없습니다.</p>
              ) : <p className="text-center py-8 text-muted-foreground">도서 목록을 불러오는 중입니다.</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
