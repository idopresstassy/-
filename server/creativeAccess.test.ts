import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseAdmin: () => mocks }));
import * as db from "./supabaseDb";
import { appRouter } from "./routers";
const userId = "00000000-0000-4000-8000-000000000001";
function caller(role: "admin" | "user" | null) {
  return appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    user: role ? ({ id: userId, role } as any) : null,
  });
}
function query(result: any = { data: [], error: null }) {
  const q: any = {
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  for (const name of ["select", "eq", "order", "update"])
    q[name] = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => result);
  return q;
}
beforeEach(() => vi.clearAllMocks());
describe("creative access boundaries", () => {
  it("anonymous users cannot submit or retrieve rejected originals", async () => {
    await expect(
      caller(null).creative.rejected({ id: 1 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("ordinary members cannot change publication or review manuscripts", async () => {
    await expect(
      caller("user").admin.setCreativeVisibility({
        id: 1,
        isPublic: false,
        note: "사유",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller("user").admin.approveCreativeSubmission({ id: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a nonblank revision reason on the server", async () => {
    await expect(
      caller("admin").admin.rejectCreativeSubmission({ id: 1, note: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("retrieves rejected originals only for their owner", async () => {
    const q = query({ data: null, error: null });
    mocks.from.mockReturnValue(q);
    await expect(db.getOwnRejectedSubmission(9, userId)).rejects.toThrow(
      "본인"
    );
    expect(q.eq.mock.calls).toEqual([
      ["id", 9],
      ["user_id", userId],
      ["status", "rejected"],
    ]);
  });
  it("cannot overwrite published or pending originals on resubmission", async () => {
    const count = query({ count: 0, error: null });
    const q = query({ data: null, error: null });
    mocks.from.mockReturnValueOnce(count).mockReturnValueOnce(q);
    await expect(
      db.resubmitCreativeSubmission(9, {
        userId,
        title: "수정",
        authorName: "작가",
        genre: "fantasy",
        content: "본문",
      })
    ).rejects.toThrow("본인");
    expect(q.eq.mock.calls).toEqual([
      ["id", 9],
      ["user_id", userId],
      ["status", "rejected"],
    ]);
  });
  it("resubmission clears the old review only after ownership/status filtering", async () => {
    const count = query({ count: 0, error: null });
    const q = query({ data: { id: 9 }, error: null });
    mocks.from.mockReturnValueOnce(count).mockReturnValueOnce(q);
    expect(
      await db.resubmitCreativeSubmission(9, {
        userId,
        title: "수정",
        authorName: "작가",
        genre: "fantasy",
        content: "본문",
      })
    ).toBe(9);
    expect(q.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        reviewed_at: null,
        reviewed_by: null,
      })
    );
  });
  it("book lists omit full manuscripts and filter hidden works", async () => {
    const q = query();
    mocks.from.mockReturnValue(q);
    await db.getBooks({ genre: "creative" });
    expect(q.select.mock.calls[0][0].split(",")).not.toContain("content");
    expect(q.eq).toHaveBeenCalledWith("is_public", true);
  });
  it("public direct links cannot read hidden books", async () => {
    const q = query({ data: null, error: null });
    mocks.from.mockReturnValue(q);
    await expect(caller(null).books.getById({ id: 9 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(q.eq).toHaveBeenCalledWith("is_public", true);
  });
  it("admin visibility actions include actor and reason in the atomic RPC", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await caller("admin").admin.setCreativeVisibility({
      id: 9,
      isPublic: false,
      note: "검토 필요",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("set_creative_book_visibility", {
      p_book_id: 9,
      p_is_public: false,
      p_reviewed_by: userId,
      p_note: "검토 필요",
    });
  });
});
