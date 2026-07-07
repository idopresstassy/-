import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Plus, Trash2, Edit, Save, X, Upload, Sparkles, Loader2 } from "lucide-react";

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
  const [bookForm, setBookForm] = useState({ title: "", author: "", genre: "classic" as "classic" | "modern" | "foreign", content: "", description: "", youtubeUrl: "", googleDriveUrl: "" });
  const [showAddBook, setShowAddBook] = useState(false);
  const [donationForm, setDonationForm] = useState<Record<string, string>>({});
  const [editingDonation, setEditingDonation] = useState(false);

  // 파일 업로드 관련 상태
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI 분석 관련 상태
  const [analyzingBookId, setAnalyzingBookId] = useState<number | null>(null);

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

  const startEditBook = async (book: { id: number; title: string; author: string; genre: string; description?: string | null; youtubeUrl?: string | null; googleDriveUrl?: string | null }) => {
    setEditingBook(book.id);
    setBookForm({
      title: book.title,
      author: book.author,
      genre: book.genre as "classic" | "modern" | "foreign",
      content: "로딩 중...",
      description: book.description || "",
      youtubeUrl: book.youtubeUrl || "",
      googleDriveUrl: book.googleDriveUrl || "",
    });
    try {
      const fullBook = await utils.books.getById.fetch({ id: book.id });
      setBookForm(prev => ({ ...prev, content: fullBook.content || "", description: fullBook.description || "", googleDriveUrl: fullBook.googleDriveUrl || "" }));
    } catch {
      setBookForm(prev => ({ ...prev, content: "" }));
    }
  };

  const handleSaveBook = async () => {
    if (!editingBook) return;
    const data: Record<string, string> = { title: bookForm.title, author: bookForm.author, genre: bookForm.genre };
    if (bookForm.youtubeUrl) data.youtubeUrl = bookForm.youtubeUrl;
    if (bookForm.content) data.content = bookForm.content;
    if (bookForm.description) data.description = bookForm.description;
    if (bookForm.googleDriveUrl) data.googleDriveUrl = bookForm.googleDriveUrl;
    await updateBook.mutateAsync({ id: editingBook, ...data } as any);
    setEditingBook(null);
  };

  const handleAddBook = async () => {
    if (!bookForm.title || !bookForm.author) return;
    if (!bookForm.content && !bookForm.googleDriveUrl) {
      alert("본문 내용 또는 구글 드라이브 URL 중 하나는 입력해야 합니다.");
      return;
    }
    const payload: any = { title: bookForm.title, author: bookForm.author, genre: bookForm.genre };
    if (bookForm.content) payload.content = bookForm.content;
    if (bookForm.description) payload.description = bookForm.description;
    if (bookForm.youtubeUrl) payload.youtubeUrl = bookForm.youtubeUrl;
    if (bookForm.googleDriveUrl) payload.googleDriveUrl = bookForm.googleDriveUrl;
    await createBook.mutateAsync(payload);
    setShowAddBook(false);
    setBookForm({ title: "", author: "", genre: "classic", content: "", description: "", youtubeUrl: "", googleDriveUrl: "" });
  };

  const handleDeleteBook = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteBook.mutateAsync({ id });
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError("");
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload/book", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setUploadError(result.error || "업로드 실패");
      } else {
        setUploadResult(result);
        utils.books.list.invalidate();
      }
    } catch (err: any) {
      setUploadError(err.message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // AI 분석 핸들러 (기존 도서에 차례/학습자료 생성)
  const handleAIAnalyze = async (bookId: number) => {
    if (!confirm("AI가 이 도서의 차례와 학습자료를 자동 생성합니다. 진행하시겠습니까?")) return;
    
    setAnalyzingBookId(bookId);
    try {
      const response = await fetch(`/api/upload/analyze/${bookId}`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        alert(`AI 분석 실패: ${result.error}`);
      } else {
        alert("AI 분석 완료! 차례와 학습자료가 생성되었습니다.");
        utils.books.list.invalidate();
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setAnalyzingBookId(null);
    }
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
        {/* File Upload Section */}
        <section className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">📁 파일로 도서 등록 (AI 자동 처리)</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            .docx 또는 .txt 파일을 업로드하면 AI가 자동으로 제목, 작가, 분류를 인식하고, 차례와 학습자료를 생성합니다.
          </p>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 처리 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  파일 업로드
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">.docx 또는 .txt (최대 50MB)</span>
          </div>

          {uploading && (
            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI가 도서 정보를 분석하고 차례/학습자료를 생성하고 있습니다... (30초~1분 소요)</span>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
          )}

          {uploadResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <p className="text-sm font-medium text-green-800">✅ 도서 등록 완료!</p>
              <div className="text-sm space-y-1">
                <p><strong>제목:</strong> {uploadResult.title}</p>
                <p><strong>작가:</strong> {uploadResult.author}</p>
                <p><strong>분류:</strong> {uploadResult.genre === "classic" ? "고전" : uploadResult.genre === "modern" ? "현대" : "해외"}</p>
                <p><strong>작품소개:</strong> {uploadResult.description}</p>
                {uploadResult.tableOfContents && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-green-700 font-medium">📋 생성된 차례 보기</summary>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-white p-2 rounded">{uploadResult.tableOfContents}</pre>
                  </details>
                )}
                {uploadResult.studyMaterial && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-green-700 font-medium">📚 생성된 학습자료 미리보기</summary>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-white p-2 rounded">{uploadResult.studyMaterial}</pre>
                  </details>
                )}
              </div>
            </div>
          )}
        </section>

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
            <Button size="sm" onClick={() => { setShowAddBook(true); setBookForm({ title: "", author: "", genre: "classic", content: "", description: "", youtubeUrl: "", googleDriveUrl: "" }); }}>
              <Plus className="w-4 h-4 mr-1" /> 수동 추가
            </Button>
          </div>

          {showAddBook && (
            <div className="border border-border rounded p-4 mb-4 bg-secondary/30 space-y-3">
              <h3 className="font-medium">새 도서 수동 추가</h3>
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
                className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[60px]"
                placeholder="작품소개 (홈 화면 도서 카드에 표시됩니다)"
                value={bookForm.description}
                onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
              />
              <Input
                placeholder="구글 드라이브 문서 URL (선택 — 이북 뷰어에서 내용을 불러옵니다)"
                value={bookForm.googleDriveUrl}
                onChange={(e) => setBookForm({ ...bookForm, googleDriveUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">구글 드라이브 URL을 입력하면 이북 뷰어에서 해당 문서의 내용을 자동으로 불러옵니다. 본문 직접 입력과 병행 가능합니다.</p>
              <textarea
                className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[120px]"
                placeholder="본문 내용 (구글 드라이브 URL을 입력한 경우 비워둘 수 있습니다)"
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
                        className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[60px]"
                        placeholder="작품소개 (홈 화면 도서 카드에 표시됩니다)"
                        value={bookForm.description}
                        onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                      />
                      <Input
                        placeholder="구글 드라이브 문서 URL"
                        value={bookForm.googleDriveUrl}
                        onChange={(e) => setBookForm({ ...bookForm, googleDriveUrl: e.target.value })}
                      />
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
                        {book.googleDriveUrl && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Drive</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 hover:text-purple-800"
                          onClick={() => handleAIAnalyze(book.id)}
                          disabled={analyzingBookId === book.id}
                          title="AI 분석 (차례/학습자료 생성)"
                        >
                          {analyzingBookId === book.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </Button>
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
