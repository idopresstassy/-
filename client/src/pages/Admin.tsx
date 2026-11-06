import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { getLoginUrl } from "@/const";
import { CREATIVE_GENRES, CREATIVE_GENRE_LABELS, type CreativeGenre } from "@shared/creative";
import { toast } from "sonner";
import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Plus, Trash2, Edit, Save, X, Upload, Loader2, Users, BarChart3, BookOpen, Mail, Send, Calendar, TrendingUp, PenLine, Check, Ban } from "lucide-react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const GENRE_OPTIONS = [
  { value: "classic" as const, label: "고전" },
  { value: "modern" as const, label: "현대" },
  { value: "foreign" as const, label: "해외" },
  { value: "creative" as const, label: "창작" },
];

type AdminTab = "dashboard" | "books" | "creative" | "members" | "email" | "donation";

const visitorChartConfig = {
  visitors: {
    label: "방문자",
    color: "#0f766e",
  },
} satisfies ChartConfig;

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

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

  const tabs = [
    { id: "dashboard" as const, label: "대시보드", icon: BarChart3 },
    { id: "books" as const, label: "도서 관리", icon: BookOpen },
    { id: "creative" as const, label: "창작 원고 검수", icon: PenLine },
    { id: "members" as const, label: "회원 관리", icon: Users },
    { id: "email" as const, label: "메일 발송", icon: Mail },
    { id: "donation" as const, label: "후원 설정", icon: Edit },
  ];

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

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card">
        <div className="container flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container py-8">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "books" && <BooksTab utils={utils} />}
        {activeTab === "creative" && <CreativeReviewTab utils={utils} />}
        {activeTab === "members" && <MembersTab />}
        {activeTab === "email" && <EmailTab />}
        {activeTab === "donation" && <DonationTab utils={utils} />}
      </div>
    </div>
  );
}

// ==================== DASHBOARD TAB ====================
function DashboardTab() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">통계 로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">전체 회원 수</p>
              <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}명</p>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">오늘 방문자</p>
              <p className="text-2xl font-bold">{stats?.todayVisitors ?? 0}명</p>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">인기 도서 1위</p>
              <p className="text-lg font-bold truncate">{stats?.popularBooks?.[0]?.title ?? "-"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Visitor Period Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">주간 방문자 (7일)</p>
              <p className="text-2xl font-bold">{stats?.weeklyVisitors ?? 0}명</p>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">월별 방문자 (이번 달)</p>
              <p className="text-2xl font-bold">{stats?.monthlyVisitors ?? 0}명</p>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">연별 방문자 (올해)</p>
              <p className="text-2xl font-bold">{stats?.yearlyVisitors ?? 0}명</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Visitor Trend */}
      <section className="border border-border rounded-lg p-5 md:p-6 bg-card">
        <div className="flex flex-col gap-1 mb-4">
          <h2 className="text-lg font-bold">최근 14일 방문자 추이</h2>
          <p className="text-sm text-muted-foreground">날짜별 고유 방문자 수를 한국 시간 기준으로 표시합니다.</p>
        </div>
        {stats?.dailyVisitors && stats.dailyVisitors.length > 0 ? (
          <ChartContainer config={visitorChartConfig} className="h-[260px] w-full aspect-auto">
            <LineChart accessibilityLayer data={stats.dailyVisitors} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={8} width={36} />
              <ChartTooltip cursor={{ stroke: "#0f766e", strokeDasharray: "3 3" }} content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="visitors"
                stroke="var(--color-visitors)"
                strokeWidth={3}
                dot={{ r: 3, fill: "var(--color-visitors)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--color-visitors)", strokeWidth: 0 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">표시할 방문자 데이터가 없습니다.</div>
        )}
      </section>

      {/* Popular Books Ranking */}
      <section className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-bold mb-4">📊 인기 도서 순위</h2>
        {stats?.popularBooks && stats.popularBooks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">순위</th>
                  <th className="text-left py-2 px-3">제목</th>
                  <th className="text-left py-2 px-3">작가</th>
                  <th className="text-right py-2 px-3">독자 수</th>
                </tr>
              </thead>
              <tbody>
                {stats.popularBooks.map((book, idx) => (
                  <tr key={book.bookId} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium">{idx + 1}</td>
                    <td className="py-2 px-3">{book.title}</td>
                    <td className="py-2 px-3 text-muted-foreground">{book.author}</td>
                    <td className="py-2 px-3 text-right">{book.readerCount}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">아직 독서 기록이 없습니다.</p>
        )}
      </section>
    </div>
  );
}

// ==================== BOOKS TAB ====================
function BooksTab({ utils }: { utils: ReturnType<typeof trpc.useUtils> }) {
  const { data: books, isLoading: booksLoading } = trpc.books.list.useQuery({});
  const createBook = trpc.books.create.useMutation({ onSuccess: () => utils.books.list.invalidate() });
  const updateBook = trpc.books.update.useMutation({ onSuccess: () => utils.books.list.invalidate() });
  const deleteBook = trpc.books.delete.useMutation({ onSuccess: () => utils.books.list.invalidate() });

  const [editingBook, setEditingBook] = useState<number | null>(null);
  const [bookForm, setBookForm] = useState({ title: "", author: "", genre: "classic" as "classic" | "modern" | "foreign" | "creative", creativeGenre: "other" as CreativeGenre, content: "", description: "", youtubeUrl: "", googleDriveUrl: "", webtoonUrl: "" });
  const [showAddBook, setShowAddBook] = useState(false);

  // 파일 업로드 관련 상태
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI 분석 관련 상태

  const startEditBook = async (book: { id: number; title: string; author: string; genre: string; creativeGenre?: CreativeGenre | null; description?: string | null; youtubeUrl?: string | null; googleDriveUrl?: string | null; webtoonUrl?: string | null }) => {
    setEditingBook(book.id);
    setBookForm({
      title: book.title,
      author: book.author,
      genre: book.genre as "classic" | "modern" | "foreign" | "creative",
      creativeGenre: book.creativeGenre ?? "other",
      content: "로딩 중...",
      description: book.description || "",
      youtubeUrl: book.youtubeUrl || "",
      googleDriveUrl: book.googleDriveUrl || "",
      webtoonUrl: book.webtoonUrl || "",
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
    const data: Record<string, string | null> = { title: bookForm.title, author: bookForm.author, genre: bookForm.genre, creativeGenre: bookForm.genre === "creative" ? bookForm.creativeGenre : null };
    if (bookForm.youtubeUrl) data.youtubeUrl = bookForm.youtubeUrl;
    if (bookForm.content) data.content = bookForm.content;
    if (bookForm.description) data.description = bookForm.description;
    if (bookForm.googleDriveUrl) data.googleDriveUrl = bookForm.googleDriveUrl;
    if (bookForm.webtoonUrl) data.webtoonUrl = bookForm.webtoonUrl;
    await updateBook.mutateAsync({ id: editingBook, ...data } as any);
    setEditingBook(null);
  };

  const handleAddBook = async () => {
    if (!bookForm.title || !bookForm.author) return;
    if (!bookForm.content && !bookForm.googleDriveUrl) {
      alert("본문 내용 또는 구글 드라이브 URL 중 하나는 입력해야 합니다.");
      return;
    }
    const payload: any = { title: bookForm.title, author: bookForm.author, genre: bookForm.genre, creativeGenre: bookForm.genre === "creative" ? bookForm.creativeGenre : undefined };
    if (bookForm.content) payload.content = bookForm.content;
    if (bookForm.description) payload.description = bookForm.description;
    if (bookForm.youtubeUrl) payload.youtubeUrl = bookForm.youtubeUrl;
    if (bookForm.googleDriveUrl) payload.googleDriveUrl = bookForm.googleDriveUrl;
    if (bookForm.webtoonUrl) payload.webtoonUrl = bookForm.webtoonUrl;
    await createBook.mutateAsync(payload);
    setShowAddBook(false);
    setBookForm({ title: "", author: "", genre: "classic", creativeGenre: "other", content: "", description: "", youtubeUrl: "", googleDriveUrl: "", webtoonUrl: "" });
  };

  const handleDeleteBook = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteBook.mutateAsync({ id });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/upload/book", {
        method: "POST",
        body: formData,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
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

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <section className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">📁 파일로 도서 등록</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          `.docx` 또는 `.txt` 파일 안에 `■ 제목:`, `■ 작가:`, `■ 분류:`를 적어 업로드하면 도서가 등록됩니다. 차례·학습자료는 문서에 함께 넣거나 수동으로 수정할 수 있습니다.
        </p>
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".docx,.txt" onChange={handleFileUpload} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? (<><Loader2 className="w-4 h-4 animate-spin" />파일 처리 중...</>) : (<><Upload className="w-4 h-4" />파일 업로드</>)}
          </Button>
          <span className="text-xs text-muted-foreground">.docx 또는 .txt (최대 50MB)</span>
        </div>

        {uploading && (
          <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>파일을 읽고 도서를 등록하고 있습니다...</span>
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
              {uploadResult.tableOfContents && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-green-700 font-medium">📋 생성된 차례 보기</summary>
                  <pre className="mt-1 text-xs whitespace-pre-wrap bg-white p-2 rounded">{uploadResult.tableOfContents}</pre>
                </details>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Books List */}
      <section className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">도서 목록</h2>
          <Button size="sm" onClick={() => { setShowAddBook(true); setBookForm({ title: "", author: "", genre: "classic", creativeGenre: "other", content: "", description: "", youtubeUrl: "", googleDriveUrl: "", webtoonUrl: "" }); }}>
            <Plus className="w-4 h-4 mr-1" /> 수동 추가
          </Button>
        </div>

        {showAddBook && (
          <div className="border border-border rounded p-4 mb-4 bg-secondary/30 space-y-3">
            <h3 className="font-medium">새 도서 수동 추가</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="제목" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
              <Input placeholder="작가" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} />
              <select className="border border-input rounded px-3 py-2 text-sm bg-background" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value as any })}>
                {GENRE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              {bookForm.genre === "creative" && (
                <select className="border border-input rounded px-3 py-2 text-sm bg-background" value={bookForm.creativeGenre} onChange={(e) => setBookForm({ ...bookForm, creativeGenre: e.target.value as CreativeGenre })}>
                  {CREATIVE_GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              )}
             <Input placeholder="YouTube URL (선택)" value={bookForm.youtubeUrl} onChange={(e) => setBookForm({ ...bookForm, youtubeUrl: e.target.value })} />
              <Input placeholder="웹툰 URL (선택)" value={bookForm.webtoonUrl} onChange={(e) => setBookForm({ ...bookForm, webtoonUrl: e.target.value })} />
            </div>
            <textarea className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[60px]" placeholder="작품소개" value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} />
            <Input placeholder="구글 드라이브 문서 URL (선택)" value={bookForm.googleDriveUrl} onChange={(e) => setBookForm({ ...bookForm, googleDriveUrl: e.target.value })} />
            <textarea className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[120px]" placeholder="본문 내용 (구글 드라이브 URL을 입력한 경우 비워둘 수 있습니다)" value={bookForm.content} onChange={(e) => setBookForm({ ...bookForm, content: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddBook} disabled={createBook.isPending}><Save className="w-4 h-4 mr-1" /> 추가</Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddBook(false)}><X className="w-4 h-4 mr-1" /> 취소</Button>
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
                      <select className="border border-input rounded px-3 py-2 text-sm bg-background" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value as any })}>
                        {GENRE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                      {bookForm.genre === "creative" && (
                        <select className="border border-input rounded px-3 py-2 text-sm bg-background" value={bookForm.creativeGenre} onChange={(e) => setBookForm({ ...bookForm, creativeGenre: e.target.value as CreativeGenre })}>
                          {CREATIVE_GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                      )}
                     <Input placeholder="YouTube URL" value={bookForm.youtubeUrl} onChange={(e) => setBookForm({ ...bookForm, youtubeUrl: e.target.value })} />
                      <Input placeholder="웹툰 URL" value={bookForm.webtoonUrl} onChange={(e) => setBookForm({ ...bookForm, webtoonUrl: e.target.value })} />
                    </div>
                    <textarea className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[60px]" placeholder="작품소개" value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} />
                    <Input placeholder="구글 드라이브 문서 URL" value={bookForm.googleDriveUrl} onChange={(e) => setBookForm({ ...bookForm, googleDriveUrl: e.target.value })} />
                    <textarea className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[80px]" placeholder="본문 수정 (비워두면 기존 내용 유지)" value={bookForm.content} onChange={(e) => setBookForm({ ...bookForm, content: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveBook} disabled={updateBook.isPending}><Save className="w-4 h-4 mr-1" /> 저장</Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingBook(null)}><X className="w-4 h-4 mr-1" /> 취소</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground mr-2">
                        {book.genre === "classic" ? "고전" : book.genre === "modern" ? "현대" : book.genre === "creative" ? `창작 · ${book.creativeGenre ? CREATIVE_GENRE_LABELS[book.creativeGenre] : "기타"}` : "해외"}
                      </span>
                      <span className="font-medium">{book.title}</span>
                      <span className="text-muted-foreground ml-2">— {book.author}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEditBook(book)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteBook(book.id)}><Trash2 className="w-4 h-4" /></Button>
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
  );
}

// ==================== CREATIVE REVIEW TAB ====================
function CreativeReviewTab({ utils }: { utils: ReturnType<typeof trpc.useUtils> }) {
  const { data: submissions, isLoading } = trpc.admin.creativeSubmissions.useQuery();
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const approve = trpc.admin.approveCreativeSubmission.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.creativeSubmissions.invalidate(), utils.books.list.invalidate()]);
      toast.success("원고를 승인하고 ‘창작’ 도서 목록에 공개했습니다.");
    },
    onError: (error) => toast.error(error.message || "원고를 승인하지 못했습니다."),
  });
  const reject = trpc.admin.rejectCreativeSubmission.useMutation({
    onSuccess: async () => {
      await utils.admin.creativeSubmissions.invalidate();
      toast.success("원고를 미승인 처리했습니다.");
    },
    onError: (error) => toast.error(error.message || "원고를 처리하지 못했습니다."),
  });

  const handleApprove = (id: number, title: string) => {
    if (window.confirm(`‘${title}’ 원고를 공개할까요? 승인하면 책방의 ‘창작’ 메뉴에 표시됩니다.`)) {
      approve.mutate({ id });
    }
  };

  const handleReject = (id: number) => {
    if (window.confirm("이 원고를 미승인 처리할까요? 작성자는 검수 의견을 확인할 수 있습니다.")) {
      reject.mutate({ id, note: reviewNotes[id]?.trim() || undefined });
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-bold">회원 창작 원고 검수</h2>
        <p className="mt-1 text-sm text-muted-foreground">아래 원고는 작성자와 관리자만 볼 수 있습니다. 승인한 작품만 공개 도서 목록에 올라갑니다.</p>
      </div>
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">원고 목록을 불러오는 중...</div>
      ) : submissions?.length ? (
        submissions.map((submission) => (
          <article key={submission.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold font-serif">{submission.title}</h3>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">{CREATIVE_GENRE_LABELS[submission.genre]}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">작가명: {submission.authorName} · 제출자: {submission.submitterName || "회원"}{submission.submitterEmail ? ` (${submission.submitterEmail})` : ""}</p>
                <p className="mt-1 text-xs text-muted-foreground">접수: {submission.createdAt.toLocaleString("ko-KR")}</p>
              </div>
              <Button size="sm" onClick={() => handleApprove(submission.id, submission.title)} disabled={approve.isPending || reject.isPending}>
                <Check className="mr-1 h-4 w-4" /> 승인하고 공개
              </Button>
            </div>
            {submission.description && <p className="mt-4 rounded-lg bg-secondary/40 p-3 text-sm">{submission.description}</p>}
            <details className="mt-4 rounded-lg border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">원고 본문 보기</summary>
              <div className="max-h-[32rem] overflow-y-auto border-t border-border px-4 py-3 text-sm leading-7 whitespace-pre-wrap">{submission.content}</div>
            </details>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input maxLength={2000} placeholder="미승인 시 작성자에게 전달할 검수 의견 (선택)" value={reviewNotes[submission.id] || ""} onChange={(e) => setReviewNotes({ ...reviewNotes, [submission.id]: e.target.value })} />
              <Button variant="outline" className="shrink-0" onClick={() => handleReject(submission.id)} disabled={approve.isPending || reject.isPending}>
                <Ban className="mr-1 h-4 w-4" /> 미승인
              </Button>
            </div>
          </article>
        ))
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">검수 대기 중인 원고가 없습니다.</div>
      )}
    </section>
  );
}

// ==================== MEMBERS TAB ====================
function MembersTab() {
  const { data: members, isLoading } = trpc.admin.users.useQuery();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: readingHistory, isLoading: historyLoading } = trpc.admin.userReadingHistory.useQuery(
    { userId: selectedUserId! },
    { enabled: selectedUserId !== null }
  );

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">회원 목록 로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-bold mb-4">👥 회원 목록 ({members?.length ?? 0}명)</h2>
        {members && members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">이름</th>
                  <th className="text-left py-2 px-3">이메일</th>
                  <th className="text-left py-2 px-3">역할</th>
                  <th className="text-left py-2 px-3">가입일</th>
                  <th className="text-left py-2 px-3">최근 로그인</th>
                  <th className="text-center py-2 px-3">독서 현황</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2 px-3 font-medium">{member.name || "미설정"}</td>
                    <td className="py-2 px-3 text-muted-foreground">{member.email || "-"}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${member.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>
                        {member.role === "admin" ? "관리자" : "일반"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{new Date(member.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td className="py-2 px-3 text-muted-foreground">{new Date(member.lastSignedIn).toLocaleDateString("ko-KR")}</td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUserId(selectedUserId === member.id ? null : member.id)}
                        className={selectedUserId === member.id ? "text-primary" : ""}
                      >
                        <BookOpen className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">가입된 회원이 없습니다.</p>
        )}
      </section>

      {/* Reading History Panel */}
      {selectedUserId !== null && (
        <section className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">📖 회원 독서 현황</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {historyLoading ? (
            <div className="animate-pulse text-muted-foreground">로딩 중...</div>
          ) : readingHistory && (readingHistory.reading.length > 0 || readingHistory.completed.length > 0) ? (
            <div className="space-y-6">
              {/* 현재 읽고 있는 책 */}
              {readingHistory.reading.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-blue-700">📖 현재 읽고 있는 책</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3">도서</th>
                          <th className="text-left py-2 px-3">작가</th>
                          <th className="text-left py-2 px-3">진행도</th>
                          <th className="text-left py-2 px-3">마지막 읽은 날</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readingHistory.reading.map((item: any) => {
                          const progress = item.totalPages > 0 ? Math.round((item.currentPage / item.totalPages) * 100) : 0;
                          return (
                            <tr key={item.bookId} className="border-b border-border/50">
                              <td className="py-2 px-3 font-medium">{item.title}</td>
                              <td className="py-2 px-3 text-muted-foreground">{item.author}</td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-xs text-muted-foreground">{progress}%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString("ko-KR")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* 완독한 책 */}
              {readingHistory.completed.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-green-700">✅ 완독한 책</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3">도서</th>
                          <th className="text-left py-2 px-3">작가</th>
                          <th className="text-left py-2 px-3">완독일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readingHistory.completed.map((item: any) => (
                          <tr key={item.bookId} className="border-b border-border/50">
                            <td className="py-2 px-3 font-medium">{item.title}</td>
                            <td className="py-2 px-3 text-muted-foreground">{item.author}</td>
                            <td className="py-2 px-3 text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString("ko-KR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">이 회원의 독서 기록이 없습니다.</p>
          )}
        </section>
      )}
    </div>
  );
}

// ==================== EMAIL TAB ====================
function EmailTab() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; sentCount?: number; message?: string } | null>(null);

  const sendEmail = trpc.admin.sendBulkEmail.useMutation({
    onSuccess: (data) => {
      setResult({ success: true, sentCount: data.sentCount });
      setSubject("");
      setBody("");
    },
    onError: (err) => {
      setResult({ success: false, message: err.message });
    },
  });

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }
    if (!confirm(`전체 회원에게 홍보 메일을 발송하시겠습니까?\n\n제목: ${subject}`)) return;
    setSending(true);
    setResult(null);
    try {
      await sendEmail.mutateAsync({ subject, body });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-bold mb-4">📧 전체 홍보 메일 발송</h2>
        <p className="text-sm text-muted-foreground mb-4">
          가입된 모든 회원의 이메일로 홍보 메일을 일괄 발송합니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">메일 제목</label>
            <Input
              placeholder="예: 명작무료책방 신간 안내"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">메일 내용</label>
            <textarea
              className="w-full border border-input rounded px-3 py-2 text-sm bg-background resize-y min-h-[200px]"
              placeholder="메일 본문을 작성해주세요..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="gap-2">
            {sending ? (<><Loader2 className="w-4 h-4 animate-spin" />발송 중...</>) : (<><Send className="w-4 h-4" />전체 발송</>)}
          </Button>
        </div>

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result.success ? "bg-green-50 border border-green-200" : "bg-destructive/10 border border-destructive/30"}`}>
            {result.success ? (
              <p className="text-sm text-green-800">✅ {result.sentCount}명에게 메일이 발송되었습니다.</p>
            ) : (
              <p className="text-sm text-destructive">❌ 발송 실패: {result.message}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ==================== DONATION TAB ====================
function DonationTab({ utils }: { utils: ReturnType<typeof trpc.useUtils> }) {
  const { data: donation } = trpc.donation.get.useQuery();
  const updateDonation = trpc.donation.update.useMutation({ onSuccess: () => utils.donation.get.invalidate() });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const startEdit = () => {
    setEditing(true);
    setForm({
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

  const handleSave = async () => {
    await updateDonation.mutateAsync(form);
    setEditing(false);
  };

  return (
    <section className="border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">후원 안내 정보</h2>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Edit className="w-4 h-4 mr-1" /> 수정
          </Button>
        )}
      </div>

      {editing ? (
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
                  value={form[key] || ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <Input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={updateDonation.isPending}><Save className="w-4 h-4 mr-1" /> 저장</Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1" /> 취소</Button>
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
  );
}
