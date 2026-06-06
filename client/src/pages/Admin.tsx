import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Plus, Trash2, Edit, Save, X } from "lucide-react";

const GENRE_OPTIONS = [
  { value: "classic" as const, label: "고전" },
  { value: "modern" as const, label: "현대" },
  { value: "foreign" as const, label: "해외" },
];

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: books, isLoading: booksLoading } = trpc.books.list.useQuery({});
  const { data: donation } = trpc.donation.get.useQuery();

  const createBook = trpc.books.create.useMutation({ onSuccess: () => utils.books.list.invalidate() });
  const updateBook = trpc.books.update.useMutation({ onSuccess: () => utils.books.list.invalidate() });
  const deleteBook = trpc.books.delete.useMutation({ onSuccess: () => utils.books.list.invalidate() });
  const updateDonation = trpc.donation.update.useMutation({ onSuccess: () => utils.donation.get.invalidate() });

  const [editingBook, setEditingBook] = useState<number | null>(null);
  const [bookForm, setBookForm] = useState({ title: "", author: "", genre: "classic" as "classic" | "modern" | "foreign", content: "", youtubeUrl: "" });
  const [showAddBook, setShowAddBook] = useState(false);
  const [donationForm, setDonationForm] = useState<Record<string, string>>({});
  const [editingDonation, setEditingDonation] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>로딩 중...</p></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
          <a href={getLoginUrl()}><Button>로그인</Button></a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground mb-2">접근 권한이 없습니다</p>
          <p className="text-muted-foreground mb-4">관리자 권한이 필요합니다.</p>
          <Button onClick={() => setLocation("/")}>메인으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  const startEditBook = async (book: { id: number; title: string; author: string; genre: string; youtubeUrl?: string | null }) => {
    setEditingBook(book.id);
    setBookForm({
      title: book.title,
      author: book.author,
      genre: book.genre as "classic" | "modern" | "foreign",
      content: "로딩 중...",
      youtubeUrl: book.youtubeUrl || "",
    });
    // Fetch full book content from API
    try {
      const fullBook = await utils.books.getById.fetch({ id: book.id });
      setBookForm(prev => ({ ...prev, content: fullBook.content || "" }));
    } catch {
      setBookForm(prev => ({ ...prev, content: "" }));
    }
  };

  const handleSaveBook = async () => {
    if (!editingBook) return;
    const data: Record<string, string> = { title: bookForm.title, author: bookForm.author, genre: bookForm.genre };
    if (bookForm.youtubeUrl) data.youtubeUrl = bookForm.youtubeUrl;
    if (bookForm.content) data.content = bookForm.content;
    await updateBook.mutateAsync({ id: editingBook, ...data } as any);
    setEditingBook(null);
  };

  const handleAddBook = async () => {
    if (!bookForm.title || !bookForm.author || !bookForm.content) return;
    await createBook.mutateAsync(bookForm);
    setShowAddBook(false);
    setBookForm({ title: "", author: "", genre: "classic", content: "", youtubeUrl: "" });
  };

  const handleDeleteBook = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteBook.mutateAsync({ id });
  };

  const startEditDonation = () => {
    setEditingDonation(true);
    setDonationForm({
      bankName: donation?.bankName || "",
      accountNumber: donation?.accountNumber || "",
      accountHolder: donation?.accountHolder || "",
      description: donation?.description || "",
      email: donation?.email || "",
      representative: donation?.representative || "",
      closingMessage: donation?.closingMessage || "",
      legalNotice: donation?.legalNotice || "",
    });
  };

  const handleSaveDonation = async () => {
    await updateDonation.mutateAsync(donationForm);
    setEditingDonation(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 메인으로
          </Button>
          <h1 className="text-lg font-bold">관리자 페이지</h1>
          <div className="w-20" />
        </div>
      </header>

      <div className="container py-8 space-y-8">
        {/* Donation Info Section */}
        <section className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">후원 안내 정보</h2>
            {!editingDonation && (
              <Button variant="outline" size="sm" onClick={startEditDonation}>
                <Edit className="w-4 h-4 mr-1" /> 수정
              </Button>
            )}
          </div>

          {editingDonation ? (
            <div className="space-y-3">
              {[
                { key: "bankName", label: "은행명" },
                { key: "accountNumber", label: "계좌번호" },
                { key: "accountHolder", label: "예금주" },
                { key: "description", label: "안내 문구" },
                { key: "email", label: "이메일" },
                { key: "representative", label: "대표자" },
                { key: "closingMessage", label: "마무리 인사말" },
                { key: "legalNotice", label: "법적 고지" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-28 text-sm font-medium text-muted-foreground shrink-0">{label}</label>
                  {key === "description" || key === "closingMessage" || key === "legalNotice" ? (
                    <textarea
                      className="flex-1 border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[60px]"
                      value={donationForm[key] || ""}
                      onChange={(e) => setDonationForm({ ...donationForm, [key]: e.target.value })}
                    />
                  ) : (
                    <Input
                      value={donationForm[key] || ""}
                      onChange={(e) => setDonationForm({ ...donationForm, [key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveDonation} disabled={updateDonation.isPending}>
                  <Save className="w-4 h-4 mr-1" /> 저장
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingDonation(false)}>
                  <X className="w-4 h-4 mr-1" /> 취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">은행명:</span> {donation?.bankName || "-"}</div>
              <div><span className="text-muted-foreground">계좌번호:</span> {donation?.accountNumber || "-"}</div>
              <div><span className="text-muted-foreground">예금주:</span> {donation?.accountHolder || "-"}</div>
              <div><span className="text-muted-foreground">이메일:</span> {donation?.email || "-"}</div>
              <div><span className="text-muted-foreground">대표자:</span> {donation?.representative || "-"}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">안내 문구:</span> {donation?.description || "-"}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">마무리 인사말:</span> {donation?.closingMessage || "-"}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">법적 고지:</span> {donation?.legalNotice || "-"}</div>
            </div>
          )}
        </section>

        {/* Books Section */}
        <section className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">도서 관리</h2>
            <Button size="sm" onClick={() => { setShowAddBook(true); setBookForm({ title: "", author: "", genre: "classic", content: "", youtubeUrl: "" }); }}>
              <Plus className="w-4 h-4 mr-1" /> 도서 추가
            </Button>
          </div>

          {showAddBook && (
            <div className="border border-border rounded p-4 mb-4 bg-secondary/30 space-y-3">
              <h3 className="font-medium">새 도서 추가</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="제목" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
                <Input placeholder="작가" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
                <select
                  className="border border-input rounded px-3 py-2 text-sm bg-background"
                  value={bookForm.genre}
                  onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value as any })}
                >
                  {GENRE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
                <Input placeholder="YouTube URL (선택)" value={bookForm.youtubeUrl} onChange={(e) => setBookForm({ ...bookForm, youtubeUrl: e.target.value })} />
              </div>
              <textarea
                className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[120px]"
                placeholder="본문 내용"
                value={bookForm.content}
                onChange={(e) => setBookForm({ ...bookForm, content: e.target.value })}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddBook} disabled={createBook.isPending}>
                  <Save className="w-4 h-4 mr-1" /> 추가
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddBook(false)}>
                  <X className="w-4 h-4 mr-1" /> 취소
                </Button>
              </div>
            </div>
          )}

          {booksLoading ? (
            <div className="animate-pulse text-muted-foreground">로딩 중...</div>
          ) : books && books.length > 0 ? (
            <div className="space-y-3">
              {books.map((book) => (
                <div key={book.id} className="border border-border rounded p-4">
                  {editingBook === book.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input placeholder="제목" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
                        <Input placeholder="작가" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
                        <select
                          className="border border-input rounded px-3 py-2 text-sm bg-background"
                          value={bookForm.genre}
                          onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value as any })}
                        >
                          {GENRE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                        <Input placeholder="YouTube URL" value={bookForm.youtubeUrl} onChange={(e) => setBookForm({ ...bookForm, youtubeUrl: e.target.value })} />
                      </div>
                      <textarea
                        className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[80px]"
                        placeholder="본문 수정 (비워두면 기존 내용 유지)"
                        value={bookForm.content}
                        onChange={(e) => setBookForm({ ...bookForm, content: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveBook} disabled={updateBook.isPending}>
                          <Save className="w-4 h-4 mr-1" /> 저장
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingBook(null)}>
                          <X className="w-4 h-4 mr-1" /> 취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground mr-2">
                          {book.genre === "classic" ? "고전" : book.genre === "modern" ? "현대" : "해외"}
                        </span>
                        <span className="font-medium">{book.title}</span>
                        <span className="text-muted-foreground ml-2">— {book.author}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEditBook(book)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteBook(book.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">등록된 도서가 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}
