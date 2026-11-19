import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  MessageSquare,
  Pin,
  PenLine,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND_LOGO_URL } from "@/lib/brand";
import {
  COMMUNITY_CATEGORIES,
  categoryLabel,
  createPostInput,
  postFields,
  nicknameSchema,
  commentBody,
  type CommunityCategory,
  type CommunityComment,
  type CommunityDetail,
  type CommunityListInput,
} from "@shared/community";

const areaClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-7 disabled:opacity-60";
const dateLabel = (date: string) =>
  new Date(date).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const loginLink = () =>
  `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-900"
    >
      <p>{message}</p>
      {retry && (
        <Button className="mt-3" variant="outline" onClick={retry}>
          다시 불러오기
        </Button>
      )}
    </div>
  );
}
function Busy() {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 py-12 text-muted-foreground"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      불러오는 중...
    </p>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm font-medium text-primary">
      {children}
    </span>
  );
}
function Author({ name, admin }: { name: string; admin: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {name}
      {admin && <Badge>관리자</Badge>}
    </span>
  );
}
function Pager({
  page,
  total,
  size,
  change,
}: {
  page: number;
  total: number;
  size: number;
  change: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <nav
      aria-label="게시판 페이지"
      className="flex items-center justify-center gap-4 py-5"
    >
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
        aria-label="이전 목록"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        disabled={page >= pages}
        onClick={() => change(page + 1)}
        aria-label="다음 목록"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-serif text-xl font-bold"
          >
            <img src={BRAND_LOGO_URL} className="h-9 w-9" alt="" />
            명작무료책방
          </Link>
          <Link
            href="/community"
            className="flex items-center gap-2 text-base font-medium"
          >
            <MessageSquare className="h-5 w-5" />
            독자마당
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-4xl px-4 py-6 text-sm text-muted-foreground">
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
        <span className="mx-2">·</span>
        <a href="mailto:idopublishingcompan@gmail.com" className="underline">
          이메일 문의
        </a>
      </footer>
    </div>
  );
}
function LoginPrompt() {
  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      <p className="mb-4">
        글과 댓글 작성, 비공개 문의는 로그인 후 이용하실 수 있습니다.
      </p>
      <Link href={loginLink()}>
        <Button>로그인·회원가입</Button>
      </Link>
    </div>
  );
}
function useCommunityRefresh() {
  const utils = trpc.useUtils();
  return () => {
    void utils.community
      .invalidate()
      .catch(() =>
        toast.warning("저장은 완료했습니다. 화면을 새로고침해 주세요.")
      );
  };
}

export function CommunityNav() {
  const { user } = useAuth();
  const unread = trpc.community.unreadCount.useQuery(
    { viewerKey: user?.id ?? "guest" },
    { enabled: !!user, retry: false, refetchInterval: 60000 }
  );
  return (
    <Link href="/community">
      <Button variant="ghost" size="sm">
        <MessageSquare className="mr-1 h-4 w-4" />
        독자마당
        {!!user && !!unread.data && (
          <span
            className="ml-1 rounded-full bg-primary px-2 text-xs text-primary-foreground"
            aria-label={`새 답변 ${unread.data}개`}
          >
            {unread.data}
          </span>
        )}
      </Button>
    </Link>
  );
}
export default function CommunityPage() {
  return (
    <Shell>
      <CommunityBoard />
    </Shell>
  );
}
export function CommunityBoard({ manage = false }: { manage?: boolean }) {
  const { user, loading } = useAuth();
  const initialMine =
    new URLSearchParams(window.location.search).get("mode") === "mine";
  const [mode, setMode] = useState<CommunityListInput["mode"]>(
    manage ? "manage" : initialMine ? "mine" : "public"
  );
  const [category, setCategory] = useState<CommunityCategory | undefined>();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [page, setPage] = useState(1);
  const needsLogin = mode !== "public" && !user;
  const input = {
    mode,
    category,
    search,
    page,
    viewerKey: user?.id ?? "guest",
  };
  const list = trpc.community.list.useQuery(input, {
    enabled: !loading && !needsLogin,
    retry: false,
  });
  const unread = trpc.community.unreadCount.useQuery(
    { viewerKey: user?.id ?? "guest" },
    { enabled: !!user, retry: false, refetchInterval: 60000 }
  );
  function filter(
    nextMode: CommunityListInput["mode"],
    nextCategory?: CommunityCategory
  ) {
    setMode(nextMode);
    setCategory(nextCategory);
    setPage(1);
  }
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">
            함께 읽는 책방
          </p>
          <h1 className="font-serif text-3xl font-bold">
            {manage ? "독자마당 관리" : "독자마당"}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            책 이야기를 나누고, 궁금한 점과 바라는 점을 남겨 주세요.
          </p>
          {manage && (
            <p className="mt-2 text-sm text-muted-foreground">
              글을 열어 답변하거나 숨길 수 있습니다. 비공개 문의와 숨긴 글도
              여기에 표시됩니다.
            </p>
          )}
        </div>
        <Link href={user ? "/community/new" : "/login?next=%2Fcommunity%2Fnew"}>
          <Button className="gap-2">
            <PenLine className="h-4 w-4" />
            글쓰기
          </Button>
        </Link>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="독자마당 분류">
        <Button
          variant={
            !category && mode === (manage ? "manage" : "public")
              ? "default"
              : "outline"
          }
          onClick={() => filter(manage ? "manage" : "public")}
        >
          전체
        </Button>
        {COMMUNITY_CATEGORIES.map(c => (
          <Button
            key={c.value}
            variant={category === c.value ? "default" : "outline"}
            onClick={() =>
              filter(
                c.value === "private"
                  ? "private"
                  : manage
                    ? "manage"
                    : "public",
                c.value
              )
            }
          >
            {c.value === "private" && <LockKeyhole className="mr-1 h-4 w-4" />}
            {c.label}
          </Button>
        ))}
        <Button
          variant={mode === "mine" ? "default" : "outline"}
          onClick={() => filter("mine")}
        >
          내가 쓴 글
          {!!user && !!unread.data && (
            <span className="ml-2 font-bold">새 답변 {unread.data}</span>
          )}
        </Button>
      </div>
      {mode === "private" && (
        <p className="rounded-xl bg-secondary p-4 text-base">
          {user?.role === "admin"
            ? "모든 회원의 비공개 문의를 확인하고 답변할 수 있습니다."
            : "내가 쓴 비공개 문의만 표시됩니다. 제목·본문·댓글은 작성자와 관리자만 볼 수 있습니다."}
        </p>
      )}
      {loading ? (
        <Busy />
      ) : needsLogin ? (
        <LoginPrompt />
      ) : (
        <>
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              setSearch(draftSearch.trim());
              setPage(1);
            }}
          >
            <Input
              aria-label="글 제목 검색"
              placeholder="글 제목으로 검색"
              maxLength={100}
              value={draftSearch}
              onChange={e => setDraftSearch(e.target.value)}
            />
            <Button type="submit" variant="outline" aria-label="검색">
              <Search className="h-5 w-5" />
            </Button>
          </form>
          {list.isLoading ? (
            <Busy />
          ) : list.isError ? (
            <ErrorBox
              message={list.error.message}
              retry={() => void list.refetch()}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                총 {list.data?.total ?? 0}개 글 · 최신 글부터 표시
              </p>
              {!list.data?.items.length ? (
                <div className="rounded-xl border bg-card px-6 py-12 text-center">
                  <MessageSquare className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">
                    {search
                      ? "검색 결과가 없습니다."
                      : "아직 등록된 글이 없습니다."}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    {search
                      ? "다른 제목으로 검색해 주세요."
                      : "첫 이야기를 남겨 주세요. 책방에서 함께 읽겠습니다."}
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-xl border bg-card">
                  {list.data.items.map(post => (
                    <Link
                      key={post.id}
                      href={`/community/${post.id}`}
                      className="block p-5 transition-colors hover:bg-secondary/40 focus-visible:outline-primary"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge>{categoryLabel(post.category)}</Badge>
                        {post.isPinned && (
                          <Badge>
                            <Pin className="h-3 w-3" />
                            고정
                          </Badge>
                        )}
                        {post.isHidden && <Badge>숨김</Badge>}
                        {post.hasNewReply && (
                          <span className="text-sm font-bold text-orange-700">
                            새 답변
                          </span>
                        )}
                        {(post.category === "request" ||
                          post.category === "private") && (
                          <span className="text-sm text-muted-foreground">
                            {post.answered ? "관리자 답변 있음" : "답변 대기"}
                          </span>
                        )}
                      </div>
                      <h2 className="break-words text-lg font-semibold">
                        {post.title}
                      </h2>
                      {post.bookTitle && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          관련 도서: {post.bookTitle}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <Author
                          name={post.nickname}
                          admin={post.authorIsAdmin}
                        />
                        <time>{dateLabel(post.createdAt)}</time>
                        <span>댓글 {post.commentCount}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Pager
                page={page}
                total={list.data?.total ?? 0}
                size={20}
                change={setPage}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

export function CommunityNewPage() {
  const { user, loading } = useAuth();
  return (
    <Shell>
      {loading ? (
        <Busy />
      ) : !user ? (
        <LoginPrompt />
      ) : (
        <PostEditor key={user.id} />
      )}
    </Shell>
  );
}
function PostEditor({
  original,
  onCancel,
  onSaved,
}: {
  original?: CommunityDetail;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const refresh = useCommunityRefresh();
  const bookParam = Number(
    new URLSearchParams(window.location.search).get("book")
  );
  const bookId =
    original?.bookId ??
    (Number.isSafeInteger(bookParam) && bookParam > 0 ? bookParam : undefined);
  const book = trpc.books.getById.useQuery(
    { id: bookId || 0 },
    { enabled: !original && !!bookId, retry: false }
  );
  const profile = trpc.community.profile.useQuery(
    { viewerKey: user?.id },
    { enabled: !!user, retry: false }
  );
  const [nickname, setNickname] = useState("");
  const [category, setCategory] = useState<CommunityCategory>(
    original?.category ?? (bookId ? "request" : "talk")
  );
  const [title, setTitle] = useState(original?.title ?? "");
  const [body, setBody] = useState(original?.body ?? "");
  const [error, setError] = useState("");
  const seeded = useRef(!!original);
  useEffect(() => {
    if (profile.data?.nickname) setNickname(n => n || profile.data!.nickname);
  }, [profile.data]);
  useEffect(() => {
    if (!seeded.current && book.data) {
      seeded.current = true;
      setTitle(t => t || `[${book.data!.title}] 문의`);
    }
  }, [book.data]);
  const dirty =
    title !== (original?.title ?? "") || body !== (original?.body ?? "");
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const success = ({ id }: { id: string }) => {
    refresh();
    toast.success(
      original ? "수정 내용을 저장했습니다." : "글을 등록했습니다."
    );
    if (onSaved) onSaved();
    else navigate(`/community/${id}`);
  };
  const create = trpc.community.create.useMutation({
    onSuccess: success,
    onError: e => setError(e.message),
  });
  const edit = trpc.community.edit.useMutation({
    onSuccess: success,
    onError: e => setError(e.message),
  });
  const busy = create.isPending || edit.isPending;
  const cancel = () => {
    if (
      busy ||
      (dirty && !window.confirm("작성한 내용이 저장되지 않습니다. 나갈까요?"))
    )
      return;
    if (onCancel) onCancel();
    else navigate("/community");
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (original) {
      const result = postFields.safeParse({ title, body });
      if (!result.success) {
        setError(result.error.issues[0].message);
        return;
      }
      edit.mutate({
        id: original.id,
        ...result.data,
        expectedUpdatedAt: original.updatedAt,
      });
    } else {
      const result = createPostInput.safeParse({
        title,
        body,
        category,
        nickname: user?.role === "admin" ? "책방지기" : nickname,
        bookId,
      });
      if (!result.success) {
        setError(result.error.issues[0].message);
        return;
      }
      create.mutate(result.data);
    }
  };
  return (
    <section>
      <Button variant="ghost" onClick={cancel} disabled={busy}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        {original ? "수정 취소" : "독자마당"}
      </Button>
      <h1 className="mb-6 mt-4 text-2xl font-bold">
        {original ? "글 수정" : "독자마당 글쓰기"}
      </h1>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          {!original && (
            <div>
              <label
                htmlFor="community-category"
                className="mb-2 block font-medium"
              >
                글 분류
              </label>
              <select
                id="community-category"
                value={category}
                onChange={e => setCategory(e.target.value as CommunityCategory)}
                className={areaClass}
              >
                {COMMUNITY_CATEGORIES.filter(
                  c => c.value !== "notice" || user?.role === "admin"
                ).map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="rounded-xl bg-secondary p-4 text-base leading-7">
            {category === "private"
              ? "비공개 문의입니다. 작성자와 책방 관리자만 제목·내용·댓글을 볼 수 있습니다."
              : "이 글과 댓글은 누구나 볼 수 있습니다. 개인정보가 필요한 내용은 비공개 문의로 남겨 주세요."}
            {original && (
              <span className="block text-sm">
                글의 공개 범위는 수정되지 않습니다.
              </span>
            )}
          </p>
          {(bookId || original?.bookTitle) && (
            <p className="flex items-center gap-2 rounded-lg border p-3">
              <BookOpen className="h-5 w-5" />
              관련 도서:{" "}
              {original?.bookTitle || book.data?.title || "불러오는 중..."}
            </p>
          )}
          {!original && book.isError && (
            <ErrorBox
              message="관련 도서를 확인하지 못했습니다."
              retry={() => void book.refetch()}
            />
          )}
          {!original && user?.role !== "admin" && (
            <div>
              <label
                htmlFor="community-nickname"
                className="mb-2 block font-medium"
              >
                닉네임
              </label>
              <Input
                id="community-nickname"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                minLength={2}
                maxLength={20}
                required
                placeholder="다른 독자에게 표시할 이름"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                2~20자 · 이메일 대신 닉네임으로 표시됩니다.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="community-title" className="mb-2 block font-medium">
              제목
            </label>
            <Input
              id="community-title"
              required
              maxLength={200}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="community-body" className="mb-2 block font-medium">
              내용
            </label>
            <textarea
              id="community-body"
              rows={12}
              required
              maxLength={20000}
              value={body}
              onChange={e => setBody(e.target.value)}
              className={areaClass}
              placeholder="책 이야기나 궁금한 점을 편하게 남겨 주세요. 오류 문의에는 문제가 생긴 상황을 함께 적어 주세요."
            />
            <p className="mt-1 text-right text-sm text-muted-foreground">
              {body.length.toLocaleString()} / 20,000자
            </p>
          </div>
        </fieldset>
        <p className="text-sm leading-6 text-muted-foreground">
          서로 존중하는 대화를 부탁드립니다. 욕설·비방·광고·음란성 글은 관리자가
          숨길 수 있습니다.
        </p>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={cancel}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={busy || (!original && !!bookId && !book.data)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy
              ? "저장 중..."
              : original
                ? "수정 내용 저장"
                : category === "private"
                  ? "비공개 문의 등록"
                  : "글 등록"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function CommunityPostPage() {
  const [, params] = useRoute("/community/:id");
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const id = params?.id ?? "";
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const refresh = useCommunityRefresh();
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(1);
  const post = trpc.community.get.useQuery(
    { id, viewerKey: user?.id ?? "guest" },
    { enabled: valid && !loading, retry: false }
  );
  const comments = trpc.community.comments.useQuery(
    { id, page, viewerKey: user?.id ?? "guest" },
    { enabled: !!post.data && !loading, retry: false }
  );
  const markRead = trpc.community.markRead.useMutation({ onSuccess: refresh });
  const marked = useRef("");
  useEffect(() => {
    if (
      !post.data?.isMine ||
      !post.data.lastReplyAt ||
      page !== 1 ||
      !comments.data ||
      comments.isFetching ||
      post.data.isHidden
    )
      return;
    const key = `${user?.id}:${id}:${post.data.lastReplyAt}`;
    if (marked.current === key) return;
    marked.current = key;
    markRead.mutate({ id, through: post.data.lastReplyAt });
  }, [post.data, comments.data, comments.isFetching, id, page, user?.id]);
  const moderate = trpc.community.moderate.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("게시 상태를 변경했습니다.");
    },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.community.remove.useMutation({
    onSuccess: () => {
      refresh();
      navigate("/community?mode=mine");
      toast.success("글을 삭제했습니다.");
    },
    onError: e => toast.error(e.message),
  });
  const item = post.data;
  return (
    <Shell>
      <div className="mb-6 flex flex-wrap justify-between gap-3">
        <Link
          href="/community"
          className="inline-flex items-center gap-1 text-base"
        >
          <ChevronLeft className="h-4 w-4" />
          독자마당 목록
        </Link>
        {user?.role === "admin" && (
          <Link href="/admin?tab=community" className="text-base underline">
            관리자로 돌아가기
          </Link>
        )}
      </div>
      {loading || post.isLoading ? (
        <Busy />
      ) : !valid || post.isError || !item ? (
        <>
          <ErrorBox
            message={post.error?.message || "글을 찾을 수 없습니다."}
            retry={valid ? () => void post.refetch() : undefined}
          />
          {!user && (
            <div className="mt-4">
              <LoginPrompt />
            </div>
          )}
        </>
      ) : editing ? (
        <PostEditor
          key={`${item.id}:${user?.id}`}
          original={item}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          {item.category === "private" && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-secondary p-4">
              <LockKeyhole className="h-5 w-5 shrink-0" />
              비공개 문의 · 작성자와 관리자만 볼 수 있습니다.
            </p>
          )}
          {item.isHidden && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
            >
              관리자가 숨긴 글입니다. 다른 독자에게 표시되지 않으며 새 댓글을
              작성할 수 없습니다.
            </p>
          )}
          <article className="rounded-xl border bg-card p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge>{categoryLabel(item.category)}</Badge>
              {item.isPinned && (
                <Badge>
                  <Pin className="h-3 w-3" />
                  고정 공지
                </Badge>
              )}
            </div>
            <h1 className="break-words text-2xl font-bold leading-normal">
              {item.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Author name={item.nickname} admin={item.authorIsAdmin} />
              <time>{dateLabel(item.createdAt)}</time>
              {item.updatedAt !== item.createdAt && <span>수정됨</span>}
            </div>
            {item.bookTitle && (
              <div className="mt-5 rounded-lg bg-secondary/50 p-3">
                관련 도서:{" "}
                {item.bookId ? (
                  <Link href={`/read/${item.bookId}`} className="underline">
                    {item.bookTitle}
                  </Link>
                ) : (
                  item.bookTitle
                )}
              </div>
            )}
            <p className="mt-6 whitespace-pre-wrap break-words text-base leading-8">
              {item.body}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
              {item.isMine && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={item.isHidden || remove.isPending}
                    onClick={() => setEditing(true)}
                  >
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "이 글과 댓글을 삭제할까요? 삭제하면 복구할 수 없습니다."
                        )
                      )
                        remove.mutate({ id });
                    }}
                  >
                    내 글 삭제
                  </Button>
                </>
              )}
              {user?.role === "admin" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={moderate.isPending}
                    onClick={() =>
                      moderate.mutate({ id, isHidden: !item.isHidden })
                    }
                  >
                    {item.isHidden ? "숨김 해제" : "글 숨기기"}
                  </Button>
                  {item.category === "notice" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={moderate.isPending}
                      onClick={() =>
                        moderate.mutate({ id, isPinned: !item.isPinned })
                      }
                    >
                      {item.isPinned ? "고정 해제" : "공지 상단 고정"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </article>
          <section className="mt-8 space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-xl font-bold">
                댓글 {comments.data?.total ?? item.commentCount}
              </h2>
              <p className="text-sm text-muted-foreground">
                최신 댓글부터 표시합니다.
              </p>
            </div>
            {!user ? (
              <LoginPrompt />
            ) : (
              !item.isHidden && (
                <CommentComposer
                  key={user.id}
                  id={id}
                  afterSaved={() => {
                    setPage(1);
                    refresh();
                  }}
                />
              )
            )}
            {comments.isLoading ? (
              <Busy />
            ) : comments.isError ? (
              <ErrorBox
                message={comments.error.message}
                retry={() => void comments.refetch()}
              />
            ) : (
              <>
                {!comments.data?.items.length && (
                  <p className="py-5 text-center text-muted-foreground">
                    아직 댓글이 없습니다.
                  </p>
                )}
                {comments.data?.items.map(comment => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    postHidden={item.isHidden}
                    isAdmin={user?.role === "admin"}
                    refresh={refresh}
                  />
                ))}
                {(comments.data?.total ?? 0) > 30 && (
                  <Pager
                    page={page}
                    total={comments.data!.total}
                    size={30}
                    change={setPage}
                  />
                )}
              </>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
function CommentComposer({
  id,
  afterSaved,
}: {
  id: string;
  afterSaved: () => void;
}) {
  const { user } = useAuth();
  const profile = trpc.community.profile.useQuery(
    { viewerKey: user?.id },
    { enabled: !!user, retry: false }
  );
  const [nickname, setNickname] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (profile.data?.nickname) setNickname(n => n || profile.data!.nickname);
  }, [profile.data]);
  const save = trpc.community.comment.useMutation({
    onSuccess: () => {
      setBody("");
      setError("");
      afterSaved();
      toast.success("댓글을 등록했습니다.");
    },
    onError: e => setError(e.message),
  });
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={e => {
        e.preventDefault();
        if (save.isPending) return;
        const nick = nicknameSchema.safeParse(
          user?.role === "admin" ? "책방지기" : nickname
        );
        const content = commentBody.safeParse(body);
        if (!nick.success || !content.success) {
          setError(
            !nick.success
              ? nick.error.issues[0].message
              : !content.success
                ? content.error.issues[0].message
                : ""
          );
          return;
        }
        setError("");
        save.mutate({ id, nickname: nick.data, body: content.data });
      }}
    >
      {user?.role !== "admin" && (
        <div>
          <label
            htmlFor="comment-nickname"
            className="mb-1 block text-sm font-medium"
          >
            닉네임
          </label>
          <Input
            id="comment-nickname"
            required
            minLength={2}
            maxLength={20}
            value={nickname}
            disabled={save.isPending}
            onChange={e => setNickname(e.target.value)}
            placeholder="다른 독자에게 표시할 이름"
          />
        </div>
      )}
      <label htmlFor="comment-body" className="block font-medium">
        {user?.role === "admin" ? "관리자 답변" : "댓글 쓰기"}
      </label>
      <textarea
        id="comment-body"
        className={areaClass}
        rows={4}
        required
        maxLength={3000}
        value={body}
        disabled={save.isPending}
        onChange={e => setBody(e.target.value)}
        placeholder="따뜻한 댓글을 남겨 주세요."
      />
      {error && <ErrorBox message={error} />}
      <div className="flex justify-end">
        <Button disabled={save.isPending} type="submit">
          {save.isPending
            ? "등록 중..."
            : user?.role === "admin"
              ? "답변 등록"
              : "댓글 등록"}
        </Button>
      </div>
    </form>
  );
}
function CommentCard({
  comment,
  postHidden,
  isAdmin,
  refresh,
}: {
  comment: CommunityComment;
  postHidden: boolean;
  isAdmin: boolean;
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [version, setVersion] = useState(comment.updatedAt);
  const edit = trpc.community.editComment.useMutation({
    onSuccess: () => {
      setEditing(false);
      refresh();
    },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.community.removeComment.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const moderate = trpc.community.moderateComment.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const busy = edit.isPending || remove.isPending || moderate.isPending;
  return (
    <article
      className={`rounded-xl border p-5 ${comment.isHidden ? "border-amber-300 bg-amber-50" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <Author name={comment.nickname} admin={comment.authorIsAdmin} />
        <time>{dateLabel(comment.createdAt)}</time>
      </div>
      {comment.isHidden && (
        <p className="mt-2 text-sm font-medium text-amber-800">
          숨긴 댓글 · 관리자에게만 표시
        </p>
      )}
      {editing ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={e => {
            e.preventDefault();
            if (busy) return;
            edit.mutate({ id: comment.id, body, expectedUpdatedAt: version });
          }}
        >
          <textarea
            aria-label="댓글 수정 내용"
            className={areaClass}
            rows={4}
            value={body}
            required
            maxLength={3000}
            disabled={busy}
            onChange={e => setBody(e.target.value)}
          />
          {edit.error && <ErrorBox message={edit.error.message} />}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  body !== comment.body &&
                  !window.confirm("댓글 수정을 취소할까요?")
                )
                  return;
                setEditing(false);
              }}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy}>
              댓글 저장
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">
          {comment.body}
        </p>
      )}
      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {comment.isMine && (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || comment.isHidden || postHidden}
                onClick={() => {
                  setBody(comment.body);
                  setVersion(comment.updatedAt);
                  setEditing(true);
                }}
              >
                댓글 수정
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "이 댓글을 삭제할까요? 삭제하면 복구할 수 없습니다."
                    )
                  )
                    remove.mutate({ id: comment.id });
                }}
              >
                댓글 삭제
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                moderate.mutate({ id: comment.id, isHidden: !comment.isHidden })
              }
            >
              {comment.isHidden ? "댓글 숨김 해제" : "댓글 숨기기"}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
