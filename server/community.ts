import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { getSupabaseAdmin, type AppUser } from "./supabase";
import {
  communityListInput,
  communityViewerInput,
  createPostInput,
  nicknameSchema,
  postFields,
  postIdInput,
  commentBody,
  type CommunityListInput,
  type CommunityPost,
  type CommunityDetail,
  type CommunityComment,
} from "../shared/community";

type Viewer = Pick<AppUser, "id" | "role"> | null;
const PAGE_SIZE = 20;
const summaryColumns =
  "id,user_id,title,category,nickname,author_is_admin,is_hidden,is_pinned,book_id,book_title,created_at,updated_at,comment_count,answered,last_reply_at";
const missing = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: "글을 찾을 수 없거나 볼 수 없는 글입니다.",
  });
function check(error: any) {
  if (!error) return;
  if (error.code === "P0001")
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  if (error.code === "40001")
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "다른 곳에서 글이 변경되었습니다. 내용을 복사해 둔 뒤 다시 열어 주세요.",
    });
  console.error("Community database error", error.code || "unknown");
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "독자마당을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  });
}
// Tables are not exposed to anon/authenticated. Every read through the server
// applies these scopes before pagination, counts, body or comment retrieval.
export function scopePosts(
  query: any,
  viewer: Viewer,
  mode: CommunityListInput["mode"]
) {
  if (mode === "manage") {
    if (viewer?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return query;
  }
  if (mode === "mine" || mode === "private") {
    if (!viewer)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      });
    if (mode === "mine") return query.eq("user_id", viewer.id);
    query = query.eq("category", "private");
    return viewer.role === "admin" ? query : query.eq("user_id", viewer.id);
  }
  return query.neq("category", "private").eq("is_hidden", false);
}
function summary(row: any, viewer: Viewer, lastRead?: string): CommunityPost {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    nickname: row.nickname,
    authorIsAdmin: row.author_is_admin,
    isMine: row.user_id === viewer?.id,
    isHidden: row.is_hidden,
    isPinned: row.is_pinned,
    bookId: row.book_id ? Number(row.book_id) : null,
    bookTitle: row.book_title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: Number(row.comment_count),
    answered: row.answered,
    lastReplyAt: row.last_reply_at,
    hasNewReply:
      row.user_id === viewer?.id &&
      !!row.last_reply_at &&
      (!lastRead || new Date(row.last_reply_at) > new Date(lastRead)),
  };
}
export async function listPosts(
  input: CommunityListInput,
  viewer: Viewer
): Promise<{ items: CommunityPost[]; total: number; pageSize: number }> {
  let query = scopePosts(
    getSupabaseAdmin()
      .from("community_post_summaries")
      .select(summaryColumns, { count: "exact" }),
    viewer,
    input.mode
  );
  if (input.category) query = query.eq("category", input.category);
  // A single ilike argument avoids PostgREST OR-filter interpolation.
  if (input.search)
    query = query.ilike(
      "title",
      `%${input.search.replace(/[\\%_]/g, "\\$&")}%`
    );
  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((input.page - 1) * PAGE_SIZE, input.page * PAGE_SIZE - 1);
  check(error);
  const ownIds = (data ?? [])
    .filter((row: any) => row.user_id === viewer?.id)
    .map((row: any) => row.id);
  let reads: Record<string, string> = {};
  if (viewer && ownIds.length) {
    const result = await getSupabaseAdmin()
      .from("community_reads")
      .select("post_id,last_read_at")
      .eq("user_id", viewer.id)
      .in("post_id", ownIds);
    check(result.error);
    reads = Object.fromEntries(
      (result.data ?? []).map((r: any) => [r.post_id, r.last_read_at])
    );
  }
  return {
    items: (data ?? []).map((row: any) => summary(row, viewer, reads[row.id])),
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}
export async function getPost(
  id: string,
  viewer: Viewer
): Promise<CommunityDetail> {
  let query = getSupabaseAdmin()
    .from("community_post_summaries")
    .select(`${summaryColumns},body`)
    .eq("id", id);
  if (viewer?.role !== "admin") {
    if (viewer)
      query = query.or(
        `and(category.neq.private,is_hidden.eq.false),user_id.eq.${viewer.id}`
      );
    else query = query.neq("category", "private").eq("is_hidden", false);
  }
  const { data, error } = await query.maybeSingle();
  check(error);
  if (!data) throw missing();
  return { ...summary(data, viewer), body: data.body };
}
async function write(
  viewer: NonNullable<Viewer>,
  action: string,
  id: string | null,
  payload: Record<string, unknown>
) {
  const { data, error } = await getSupabaseAdmin().rpc("community_write", {
    p_actor: viewer.id,
    p_action: action,
    p_id: id,
    p_payload: payload,
  });
  check(error);
  return { id: data as string };
}

export const communityRouter = router({
  list: publicProcedure
    .input(communityListInput)
    .query(({ input, ctx }) => listPosts(input, ctx.user)),
  get: publicProcedure
    .input(postIdInput.merge(communityViewerInput))
    .query(({ input, ctx }) => getPost(input.id, ctx.user)),
  comments: publicProcedure
    .input(
      postIdInput
        .merge(communityViewerInput)
        .extend({ page: z.number().int().min(1).max(5000).default(1) })
    )
    .query(async ({ input, ctx }) => {
      await getPost(input.id, ctx.user); // Must succeed before any child query.
      let query = getSupabaseAdmin()
        .from("community_comments")
        .select(
          "id,user_id,body,nickname,author_is_admin,is_hidden,created_at,updated_at",
          { count: "exact" }
        )
        .eq("post_id", input.id)
        .eq("is_deleted", false);
      if (ctx.user?.role !== "admin") query = query.eq("is_hidden", false);
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range((input.page - 1) * 30, input.page * 30 - 1);
      check(error);
      return {
        items: (data ?? []).map(
          (row: any): CommunityComment => ({
            id: row.id,
            body: row.body,
            nickname: row.nickname,
            authorIsAdmin: row.author_is_admin,
            isMine: row.user_id === ctx.user?.id,
            isHidden: row.is_hidden,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })
        ),
        total: count ?? 0,
        pageSize: 30,
      };
    }),
  profile: protectedProcedure
    .input(communityViewerInput)
    .query(async ({ ctx }) => {
      const { data, error } = await getSupabaseAdmin()
        .from("community_members")
        .select("nickname")
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      check(error);
      return { nickname: data?.nickname ?? "" };
    }),
  unreadCount: protectedProcedure
    .input(communityViewerInput)
    .query(async ({ ctx }) => {
      const { data, error } = await getSupabaseAdmin().rpc(
        "community_unread_count",
        { p_actor: ctx.user.id }
      );
      check(error);
      return Number(data ?? 0);
    }),
  create: protectedProcedure
    .input(createPostInput)
    .mutation(({ input, ctx }) => {
      if (input.category === "notice" && ctx.user.role !== "admin")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "공지사항은 관리자만 작성할 수 있습니다.",
        });
      return write(ctx.user, "create_post", null, input);
    }),
  edit: protectedProcedure
    .input(
      postIdInput
        .merge(postFields)
        .extend({ expectedUpdatedAt: z.string().datetime({ offset: true }) })
    )
    .mutation(({ input: { id, ...payload }, ctx }) =>
      write(ctx.user, "update_post", id, payload)
    ),
  remove: protectedProcedure
    .input(postIdInput)
    .mutation(({ input, ctx }) => write(ctx.user, "delete_post", input.id, {})),
  comment: protectedProcedure
    .input(postIdInput.extend({ body: commentBody, nickname: nicknameSchema }))
    .mutation(({ input: { id, ...payload }, ctx }) =>
      write(ctx.user, "create_comment", id, payload)
    ),
  editComment: protectedProcedure
    .input(
      postIdInput.extend({
        body: commentBody,
        expectedUpdatedAt: z.string().datetime({ offset: true }),
      })
    )
    .mutation(({ input: { id, ...payload }, ctx }) =>
      write(ctx.user, "update_comment", id, payload)
    ),
  removeComment: protectedProcedure
    .input(postIdInput)
    .mutation(({ input, ctx }) =>
      write(ctx.user, "delete_comment", input.id, {})
    ),
  markRead: protectedProcedure
    .input(
      postIdInput.extend({ through: z.string().datetime({ offset: true }) })
    )
    .mutation(({ input, ctx }) =>
      write(ctx.user, "mark_read", input.id, { through: input.through })
    ),
  moderate: adminProcedure
    .input(
      postIdInput.extend({
        isHidden: z.boolean().optional(),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(({ input: { id, ...payload }, ctx }) =>
      write(ctx.user, "moderate_post", id, payload)
    ),
  moderateComment: adminProcedure
    .input(postIdInput.extend({ isHidden: z.boolean() }))
    .mutation(({ input: { id, ...payload }, ctx }) =>
      write(ctx.user, "moderate_comment", id, payload)
    ),
});
