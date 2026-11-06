import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2, PenLine, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseLoginRoute } from "@/lib/authNavigation";
import { trpc } from "@/lib/trpc";
import { CREATIVE_GENRES, CREATIVE_GENRE_LABELS, type CreativeGenre } from "@shared/creative";

const emptyForm = {
  title: "",
  authorName: "",
  genre: "short_story" as CreativeGenre,
  description: "",
  content: "",
  rightsConfirmed: false,
};

export default function Creative() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState(emptyForm);
  const utils = trpc.useUtils();
  const { data: submissions, isLoading: submissionsLoading } = trpc.creative.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const submit = trpc.creative.submit.useMutation({
    onSuccess: async () => {
      setForm(emptyForm);
      await utils.creative.mine.invalidate();
      toast.success("원고를 접수했습니다. 관리자 검수 후 공개됩니다.");
    },
    onError: (error) => toast.error(error.message || "원고를 접수하지 못했습니다."),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.rightsConfirmed) {
      toast.error("직접 작성했거나 게시 권한이 있는 원고인지 확인해 주세요.");
      return;
    }
    submit.mutate({ ...form, description: form.description.trim() || undefined, rightsConfirmed: true });
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> 책방으로 돌아가기
          </Link>
          <span className="flex items-center gap-2 font-semibold"><PenLine className="h-4 w-4" /> 창작 원고 제출</span>
        </div>
      </header>

      <div className="container max-w-3xl px-4 py-8">
        <section className="mb-8 rounded-xl border border-border bg-card p-5 md:p-6">
          <h1 className="mb-2 text-2xl font-bold font-serif">여러분의 이야기를 보내주세요</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            로그인한 회원은 원고를 제출할 수 있습니다. 제출한 글은 사장님이 검수하고 승인한 뒤에만 ‘창작’ 메뉴에 공개됩니다.
          </p>
        </section>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !isAuthenticated ? (
          <section className="rounded-xl border border-border bg-card p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold">로그인이 필요합니다</h2>
            <p className="mb-5 text-sm text-muted-foreground">원고 접수와 검수 상태 확인을 위해 먼저 로그인해 주세요.</p>
            <Button onClick={() => navigate(getSupabaseLoginRoute(navigator.userAgent))}>로그인하기</Button>
          </section>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  작품 제목
                  <Input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="작품 제목을 적어주세요" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  작가명
                  <Input required maxLength={120} value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} placeholder="책방에 표시할 이름" />
                </label>
              </div>

              <label className="block space-y-2 text-sm font-medium">
                작품 장르
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value as CreativeGenre })}>
                  {CREATIVE_GENRES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="block space-y-2 text-sm font-medium">
                작품 소개 <span className="font-normal text-muted-foreground">(선택)</span>
                <textarea className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="독자에게 소개할 내용을 적어주세요" />
              </label>

              <label className="block space-y-2 text-sm font-medium">
                원고 본문
                <textarea required minLength={20} maxLength={500000} className="min-h-80 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="여기에 작품 내용을 붙여 넣어주세요" />
                <span className="block text-right text-xs font-normal text-muted-foreground">{form.content.length.toLocaleString()} / 500,000자</span>
              </label>

              <label className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-sm leading-5">
                <input type="checkbox" className="mt-1" checked={form.rightsConfirmed} onChange={(e) => setForm({ ...form, rightsConfirmed: e.target.checked })} />
                <span>이 원고는 제가 직접 작성했거나 게시할 권한이 있으며, 명작무료책방에 검수와 공개를 요청합니다.</span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" disabled={submit.isPending || form.content.trim().length < 20}>
                  {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  검수 신청
                </Button>
                <span className="text-xs text-muted-foreground">검수 대기 원고는 회원당 최대 5편까지 접수할 수 있습니다.</span>
              </div>
            </form>

            <section className="mt-8">
              <h2 className="mb-3 text-lg font-bold">내 원고 검수 상태</h2>
              {submissionsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</div>
              ) : submissions?.length ? (
                <div className="space-y-3">
                  {submissions.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{CREATIVE_GENRE_LABELS[item.genre]} · {item.createdAt.toLocaleDateString("ko-KR")}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.status === "approved" ? "bg-green-100 text-green-800" : item.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                          {item.status === "approved" ? "공개됨" : item.status === "rejected" ? "미승인" : "검수 대기"}
                        </span>
                      </div>
                      {item.reviewNote && <p className="mt-3 rounded bg-secondary/50 p-3 text-sm">검수 의견: {item.reviewNote}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">제출한 원고가 아직 없습니다.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
