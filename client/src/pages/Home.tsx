import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, Heart, Search, Youtube, LogIn, LogOut, Settings } from "lucide-react";

const GENRES = [
  { value: undefined, label: "전체" },
  { value: "classic" as const, label: "고전" },
  { value: "modern" as const, label: "현대" },
  { value: "foreign" as const, label: "해외" },
];

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [genre, setGenre] = useState<"classic" | "modern" | "foreign" | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showDonation, setShowDonation] = useState(false);

  const { data: books, isLoading } = trpc.books.list.useQuery({ genre, search: search || undefined });
  const { data: donation } = trpc.donation.get.useQuery();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground font-serif">한국문학도서관</h1>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowDonation(true)}>
              <Heart className="w-4 h-4 mr-1" /> 후원
            </Button>
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm">
                      <Settings className="w-4 h-4 mr-1" /> 관리
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={() => logout()}>
                  <LogOut className="w-4 h-4 mr-1" /> 로그아웃
                </Button>
              </>
            ) : (
              <a href={getLoginUrl()}>
                <Button variant="ghost" size="sm">
                  <LogIn className="w-4 h-4 mr-1" /> 로그인
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container text-center">
          <h2 className="text-3xl font-bold font-serif text-foreground mb-2">아름다운 한국 문학을 만나보세요</h2>
          <p className="text-muted-foreground mb-6">고전부터 현대까지, 다양한 문학 작품을 무료로 읽어보세요.</p>
          <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2">
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
        </div>
      </section>

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
      </section>

      {/* Book Grid */}
      <section className="container pb-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : books && books.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div key={book.id} className="border border-border rounded-lg p-5 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {book.genre === "classic" ? "고전" : book.genre === "modern" ? "현대" : "해외"}
                  </span>
                  {book.youtubeUrl && (
                    <a href={book.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600">
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1 font-serif">{book.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{book.author}</p>
                <Link href={`/read/${book.id}`} className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs w-full">
                    <BookOpen className="w-4 h-4" /> 읽기
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>등록된 도서가 없습니다.</p>
          </div>
        )}
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
    </div>
  );
}
