import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseAdmin: () => mocks }));
import { communityRouter } from "./community";
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const date = "2026-11-19T01:00:00.123456+00:00";
function caller(role: "user" | "admin" | null, userId = owner) {
  return communityRouter.createCaller({
    req: {} as any,
    res: {} as any,
    user: role ? ({ id: userId, role } as any) : null,
  });
}
function query(result: any = { data: [], count: 0, error: null }) {
  const q: any = {
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  for (const key of [
    "select",
    "eq",
    "neq",
    "or",
    "in",
    "ilike",
    "order",
    "range",
  ])
    q[key] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => result);
  return q;
}
const post = {
  id,
  user_id: owner,
  category: "private",
  title: "비공개 제목",
  body: "비공개 내용",
  nickname: "독자하나",
  author_is_admin: false,
  is_hidden: false,
  is_pinned: false,
  book_id: null,
  book_title: null,
  created_at: date,
  updated_at: date,
  comment_count: 1,
  answered: true,
  last_reply_at: date,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: id, error: null });
});
describe("community authorization and privacy", () => {
  it("requires login for writes, private lists and personal data", async () => {
    const c = caller(null);
    for (const promise of [
      c.create({
        category: "talk",
        title: "글",
        body: "본문",
        nickname: "독자",
      }),
      c.comment({ id, body: "답변", nickname: "독자" }),
      c.profile({}),
      c.unreadCount({}),
    ])
      await expect(promise).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const q = query();
    mocks.from.mockReturnValue(q);
    await expect(c.list({ mode: "private" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(q.range).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("forbids members from admin operations and notices", async () => {
    const c = caller("user");
    mocks.from.mockReturnValue(query());
    for (const promise of [
      c.create({
        category: "notice",
        title: "공지",
        body: "내용",
        nickname: "독자",
      }),
      c.moderate({ id, isHidden: true }),
      c.moderateComment({ id, isHidden: true }),
      c.list({ mode: "manage" }),
    ])
      await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("filters public lists before exact counts, search and pagination", async () => {
    const q = query();
    mocks.from.mockReturnValue(q);
    await caller(null).list({ search: "a%,b_", page: 2 });
    expect(q.neq).toHaveBeenCalledWith("category", "private");
    expect(q.eq).toHaveBeenCalledWith("is_hidden", false);
    expect(q.range).toHaveBeenCalledWith(20, 39);
    expect(q.ilike).toHaveBeenCalledWith("title", "%a\\%,b\\_%");
    expect(q.or).not.toHaveBeenCalled();
    expect(q.neq.mock.invocationCallOrder[0]).toBeLessThan(
      q.range.mock.invocationCallOrder[0]
    );
  });
  it("uses verified owner rather than a forged viewerKey for private lists", async () => {
    const q = query();
    mocks.from.mockReturnValue(q);
    await caller("user", other).list({ mode: "private", viewerKey: owner });
    expect(q.eq.mock.calls).toContainEqual(["user_id", other]);
    expect(q.eq.mock.calls).not.toContainEqual(["user_id", owner]);
  });
  it("admins can list all private inquiries; mine always means self", async () => {
    const q = query();
    mocks.from.mockReturnValue(q);
    await caller("admin", other).list({ mode: "private" });
    expect(q.eq.mock.calls).not.toContainEqual(["user_id", other]);
    await caller("admin", other).list({ mode: "mine" });
    expect(q.eq).toHaveBeenCalledWith("user_id", other);
  });
  it("denies inaccessible private parents before fetching any comments", async () => {
    const q = query({ data: null, error: null });
    mocks.from.mockReturnValue(q);
    await expect(
      caller("user", other).comments({ id, viewerKey: owner })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(q.or).toHaveBeenCalledWith(
      `and(category.neq.private,is_hidden.eq.false),user_id.eq.${other}`
    );
    expect(mocks.from.mock.calls).toEqual([["community_post_summaries"]]);
    await expect(caller(null).get({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(q.neq).toHaveBeenCalledWith("category", "private");
  });
  it("returns only explicit display fields, never email or author UUID", async () => {
    mocks.from.mockReturnValue(
      query({
        data: { ...post, email: "fixture@example.invalid" },
        error: null,
      })
    );
    const value = await caller("user").get({ id });
    expect(value.body).toBe(post.body);
    expect(value.isMine).toBe(true);
    expect(value).not.toHaveProperty("user_id");
    expect(value).not.toHaveProperty("email");
    expect(JSON.stringify(value)).not.toContain(owner);
    expect(value.updatedAt).toBe(date);
  });
  it("only includes visible, undeleted child comments for ordinary readers", async () => {
    const parent = query({ data: { ...post, category: "talk" }, error: null });
    const child = query({
      data: [{ ...post, id: other, email: "hidden@example.invalid" }],
      count: 1,
      error: null,
    });
    mocks.from.mockReturnValueOnce(parent).mockReturnValueOnce(child);
    const result = await caller(null).comments({ id });
    expect(child.eq.mock.calls).toEqual([
      ["post_id", id],
      ["is_deleted", false],
      ["is_hidden", false],
    ]);
    expect(JSON.stringify(result)).not.toContain("email");
    expect(result.items[0]).not.toHaveProperty("user_id");
  });
  it("computes new replies only from the current member's read receipts", async () => {
    const q = query({ data: [post], count: 1, error: null });
    const reads = query({
      data: [{ post_id: id, last_read_at: date }],
      error: null,
    });
    mocks.from.mockReturnValueOnce(q).mockReturnValueOnce(reads);
    const result = await caller("user").list({ mode: "mine" });
    expect(reads.eq).toHaveBeenCalledWith("user_id", owner);
    expect(result.items[0].hasNewReply).toBe(false);
  });
  it("passes trusted actor, strips role/owner/privacy injection on writes", async () => {
    await caller("user").create({
      category: "private",
      title: "제목",
      body: "내용",
      nickname: "독자",
      user_id: other,
      author_is_admin: true,
    } as any);
    expect(mocks.rpc).toHaveBeenCalledWith("community_write", {
      p_actor: owner,
      p_action: "create_post",
      p_id: null,
      p_payload: {
        category: "private",
        title: "제목",
        body: "내용",
        nickname: "독자",
      },
    });
    await caller("user").edit({
      id,
      title: "수정",
      body: "수정 내용",
      expectedUpdatedAt: date,
      category: "talk",
    } as any);
    expect(mocks.rpc.mock.calls[1][1].p_payload).not.toHaveProperty("category");
    expect(mocks.rpc.mock.calls[1][1].p_payload.expectedUpdatedAt).toBe(date);
  });
  it("rejects invalid input and exposes safe conflicts without DB internals", async () => {
    await expect(
      caller("user").comment({
        id,
        nickname: "email@example.com",
        body: "댓글",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller("user").comment({ id, nickname: "독자", body: "x".repeat(3001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({
      error: { code: "40001", message: "private database details" },
    });
    await expect(
      caller("user").edit({
        id,
        title: "수정",
        body: "내용",
        expectedUpdatedAt: date,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.not.stringContaining("private database"),
    });
  });
});
