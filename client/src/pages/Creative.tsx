import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Loader2, PenLine, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseLoginRoute } from "@/lib/authNavigation";
import { trpc } from "@/lib/trpc";
import {
  CREATIVE_GENRES,
  CREATIVE_GENRE_LABELS,
  type CreativeGenre,
} from "@shared/creative";

const emptyForm = {
  title: "",
  authorName: "",
  genre: "short_story" as CreativeGenre,
  description: "",
  content: "",
  rightsConfirmed: false,
};

export default function Creative() {
  const { user, isAuthenticated, loading } = useAuth();
  const [preview, setPreview] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [draftSaved, setDraftSaved] = useState(false);
  const draftKey = user ? `korealib-creative-draft:${user.id}` : null;
  const [, navigate] = useLocation();
  const [form, setForm] = useState(emptyForm);
  useEffect(() => {
    setForm(emptyForm);
    setEditingId(undefined);
    setPreview(false);
    setDraftSaved(false);
  }, [user?.id]);
  useEffect(() => {
    if (!form.title && !form.content) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form.title, form.content]);
  const utils = trpc.useUtils();
  const {
    data: submissions,
    isLoading: submissionsLoading,
    isError: submissionsError,
    refetch: refetchSubmissions,
  } = trpc.creative.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const submit = trpc.creative.submit.useMutation({
    onSuccess: async () => {
      setForm(emptyForm);
      setEditingId(undefined);
      setPreview(false);
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }
      setDraftSaved(false);
      await utils.creative.mine.invalidate();
      toast.success("원고를 접수했습니다. 관리자 검수 후 공개됩니다.");
    },
    onError: error =>
      toast.error(error.message || "원고를 접수하지 못했습니다."),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.rightsConfirmed) {
      toast.error("직접 작성했거나 게시 권한이 있는 원고인지 확인해 주세요.");
      return;
    }
    submit.mutate({
      submissionId: editingId,
      ...form,
      description: form.description.trim() || undefined,
      rightsConfirmed: true,
    });
  };

  const saveDraft = () => {
    if (!draftKey) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form: { ...form, rightsConfirmed: false }, editingId })
      );
      setDraftSaved(true);
      toast.success("이 기기에 임시 저장했습니다.");
    } catch {
      toast.error(
        "임시 저장하지 못했습니다. 원고를 따로 복사해 보관해 주세요."
      );
    }
  };
  const loadDraft = () => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) {
        toast.info("저장된 원고가 없습니다.");
        return;
      }
      if (form.title || form.content) {
        if (!window.confirm("현재 입력한 내용을 저장된 원고로 바꿀까요?"))
          return;
      }
      const draft = JSON.parse(saved);
      if (
        typeof draft.form?.title !== "string" ||
        typeof draft.form?.content !== "string" ||
        !CREATIVE_GENRES.some(g => g.value === draft.form?.genre)
      )
        throw new Error();
      setForm({ ...emptyForm, ...draft.form, rightsConfirmed: false });
      setEditingId(
        typeof draft.editingId === "number" ? draft.editingId : undefined
      );
      setDraftSaved(true);
      setPreview(false);
    } catch {
      toast.error("저장된 원고를 불러오지 못했습니다.");
    }
  };
  const editRejected = async (id: number) => {
    if (
      (form.title || form.content) &&
      !window.confirm(
        "입력 중인 내용을 수정 요청 원고로 바꿀까요? 먼저 임시 저장할 수 있습니다."
      )
    )
      return;
    try {
      const item = await utils.creative.rejected.fetch({ id });
      setForm({
        title: item.title,
        authorName: item.authorName,
        genre: item.genre,
        description: item.description || "",
        content: item.content,
        rightsConfirmed: false,
      });
      setEditingId(id);
      setPreview(false);
      setDraftSaved(false);
      document
        .getElementById("creative-editor")
        ?.scrollIntoView({ behavior: "smooth" });
    } catch {
      toast.error("원고를 불러오지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> 책방으로 돌아가기
          </Link>
          <span className="flex items-center gap-2 font-semibold">
            <PenLine className="h-4 w-4" /> 내 작품 올리기 · 관리
          </span>
        </div>
      </header>

      <div className="container max-w-3xl px-4 py-8">
        <section className="mb-8 rounded-xl border border-border bg-card p-5 md:p-6">
          <h1 className="mb-2 text-2xl font-bold font-serif">
            내 이야기를 독자에게 전하세요
          </h1>
          <Link
            href="/?genre=creative"
            className="my-3 inline-block font-medium text-primary underline"
          >
            공개된 창작 작품 읽기 →
          </Link>
          <p className="text-sm leading-6 text-muted-foreground">
            회원가입 후 로그인하면 원고를 제출할 수 있습니다. 작품 제목과
            작가명, 장르, 본문을 작성한 뒤 ‘검수 신청’을 눌러주세요.
          </p>
        </section>

        <section className="mb-6 rounded-xl border border-border bg-secondary/30 p-5">
          <h2 className="mb-2 font-semibold">원고 등록 안내</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
            <li>
              직접 쓴 글 또는 게시 권한을 가진 글만 등록해 주세요. 다른 사람의
              저작물을 허락 없이 올릴 수 없습니다.
            </li>
            <li>
              지나치게 폭력적이거나 노골적인 성적 표현, 혐오·차별·불법 내용을
              담은 글은 승인되지 않을 수 있습니다.
            </li>
            <li>
              제출한 글은 바로 공개되지 않습니다. 관리자가 검수한 뒤 승인하면
              ‘창작’ 메뉴에 공개됩니다.
            </li>
            <li>
              제출 후에는 아래 ‘내 원고 검수 상태’에서 검수 결과와 의견을 확인할
              수 있습니다.
            </li>
          </ul>
        </section>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !isAuthenticated ? (
          <section className="rounded-xl border border-border bg-card p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold">로그인이 필요합니다</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              원고 접수와 검수 상태 확인을 위해 먼저 로그인해 주세요.
            </p>
            <Button
              onClick={() =>
                navigate(getSupabaseLoginRoute(navigator.userAgent))
              }
            >
              회원가입 · 로그인
            </Button>
          </section>
        ) : (
          <>
            <form
              id="creative-editor"
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-border bg-card p-5 md:p-6"
            >
              <fieldset
                disabled={submit.isPending}
                className="space-y-4 min-w-0"
              >
                <h2 className="text-lg font-bold">
                  {editingId ? "수정 요청 원고 고치기" : "새 작품 작성"}
                </h2>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "수정 중인 내용을 닫고 새 작품을 쓸까요? 필요한 원고는 먼저 임시 저장해 주세요."
                        )
                      )
                        return;
                      setEditingId(undefined);
                      setForm(emptyForm);
                      setPreview(false);
                    }}
                  >
                    새 작품 작성으로 돌아가기
                  </Button>
                )}
                <p className="text-sm text-muted-foreground">
                  1. 원고 작성 → 2. 미리보기 → 3. 승인 신청
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={saveDraft}>
                    임시 저장
                  </Button>
                  <Button type="button" variant="outline" onClick={loadDraft}>
                    저장한 글 불러오기
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  임시 저장은 이 기기와 브라우저에서만 사용할 수 있습니다. 공용
                  기기에서는 사용하지 마세요.
                  {draftSaved
                    ? " 최근 원고를 저장했습니다. 이후 고친 내용은 다시 저장해 주세요."
                    : ""}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    작품 제목
                    <Input
                      required
                      maxLength={200}
                      value={form.title}
                      onChange={e =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder="작품 제목을 적어주세요"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    작가명
                    <Input
                      required
                      maxLength={120}
                      value={form.authorName}
                      onChange={e =>
                        setForm({ ...form, authorName: e.target.value })
                      }
                      placeholder="책방에 표시할 이름"
                    />
                  </label>
                </div>

                <label className="block space-y-2 text-sm font-medium">
                  작품 장르
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.genre}
                    onChange={e =>
                      setForm({
                        ...form,
                        genre: e.target.value as CreativeGenre,
                      })
                    }
                  >
                    {CREATIVE_GENRES.map(item => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-medium">
                  작품 소개{" "}
                  <span className="font-normal text-muted-foreground">
                    (선택)
                  </span>
                  <textarea
                    className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                    maxLength={2000}
                    value={form.description}
                    onChange={e =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="독자에게 소개할 내용을 적어주세요"
                  />
                </label>

                <label className="block space-y-2 text-sm font-medium">
                  원고 본문
                  <textarea
                    required
                    minLength={20}
                    maxLength={500000}
                    className="min-h-80 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6"
                    value={form.content}
                    onChange={e =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder="여기에 작품 내용을 붙여 넣어주세요"
                  />
                  <span className="block text-right text-xs font-normal text-muted-foreground">
                    {form.content.length.toLocaleString()} / 500,000자
                  </span>
                </label>

                <label className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-sm leading-5">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.rightsConfirmed}
                    onChange={e =>
                      setForm({ ...form, rightsConfirmed: e.target.checked })
                    }
                  />
                  <span>
                    이 원고는 제가 직접 작성했거나 게시할 권한이 있으며,
                    명작무료책방에 검수와 공개를 요청합니다.
                  </span>
                </label>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? "미리보기 닫기" : "독자 화면 미리보기"}
                </Button>
                {preview && (
                  <article
                    className="rounded-lg border p-5"
                    aria-label="원고 미리보기"
                  >
                    <h2 className="text-2xl font-bold break-words">
                      {form.title || "작품 제목"}
                    </h2>
                    <p className="my-2">
                      {form.authorName || "작가명"} ·{" "}
                      {CREATIVE_GENRE_LABELS[form.genre]}
                    </p>
                    <p className="mb-4 whitespace-pre-wrap break-words">
                      {form.description}
                    </p>
                    <div className="whitespace-pre-wrap break-words text-base leading-8">
                      {form.content || "작성한 본문이 여기에 표시됩니다."}
                    </div>
                  </article>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    disabled={
                      submit.isPending || form.content.trim().length < 20
                    }
                  >
                    {submit.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {editingId ? "수정 후 다시 승인 신청" : "관리자 승인 신청"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    검수 대기 원고는 회원당 최대 5편까지 접수할 수 있습니다.
                  </span>
                </div>
              </fieldset>
            </form>

            <section className="mt-8">
              <h2 className="mb-3 text-lg font-bold">내 작품 관리</h2>
              {submissionsError ? (
                <div role="alert" className="rounded border p-4">
                  내 작품을 불러오지 못했습니다.{" "}
                  <Button
                    variant="outline"
                    onClick={() => refetchSubmissions()}
                  >
                    다시 불러오기
                  </Button>
                </div>
              ) : submissionsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  불러오는 중...
                </div>
              ) : submissions?.length ? (
                <div className="space-y-3">
                  {submissions.map(item => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{item.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {CREATIVE_GENRE_LABELS[item.genre]} ·{" "}
                            {item.createdAt.toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${item.status === "approved" ? "bg-green-100 text-green-800" : item.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}
                        >
                          {item.status === "approved"
                            ? "공개됨"
                            : item.status === "rejected"
                              ? "수정 요청"
                              : "검토 중"}
                        </span>
                      </div>
                      {item.status === "rejected" && (
                        <Button
                          className="mt-3"
                          size="sm"
                          variant="outline"
                          onClick={() => editRejected(item.id)}
                        >
                          고쳐서 다시 신청
                        </Button>
                      )}
                      {item.status === "approved" && item.publishedBookId && (
                        <Link
                          href={`/read/${item.publishedBookId}`}
                          className="mt-3 block text-sm underline"
                        >
                          게시한 작품 읽기
                        </Link>
                      )}
                      {item.reviewNote && (
                        <p className="mt-3 rounded bg-secondary/50 p-3 text-sm">
                          검수 의견: {item.reviewNote}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  제출한 원고가 아직 없습니다.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
