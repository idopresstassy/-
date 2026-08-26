import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseDb", () => ({
  getTotalUserCount: vi.fn().mockResolvedValue(25),
  getTodayVisitorCount: vi.fn().mockResolvedValue(8),
  getPopularBooks: vi.fn().mockResolvedValue([
    { bookId: 1, readerCount: 15, title: "홍길동전", author: "허균" },
    { bookId: 2, readerCount: 10, title: "춘향전", author: "작자미상" },
  ]),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: "00000000-0000-4000-8000-000000000001", openId: "user1", name: "김철수", email: "kim@test.com", role: "admin", createdAt: new Date(), lastSignedIn: new Date() },
    { id: "00000000-0000-4000-8000-000000000002", openId: "user2", name: "이영희", email: "lee@test.com", role: "user", createdAt: new Date(), lastSignedIn: new Date() },
  ]),
  getUserReadingHistory: vi.fn().mockResolvedValue({
    reading: [{ bookId: 1, currentPage: 5, totalPages: 20, updatedAt: new Date(), title: "홍길동전", author: "허균" }],
    completed: [{ bookId: 2, currentPage: 19, totalPages: 20, updatedAt: new Date(), title: "춘향전", author: "작자미상" }],
  }),
  getAllUserEmails: vi.fn().mockResolvedValue([{ email: "kim@test.com", name: "김철수" }, { email: "lee@test.com", name: "이영희" }]),
  recordVisit: vi.fn().mockResolvedValue(undefined),
}));

describe("Supabase administrator data", () => {
  it("returns dashboard counts and popular books", async () => {
    const db = await import("./supabaseDb");
    expect(await db.getTotalUserCount()).toBe(25);
    expect(await db.getTodayVisitorCount()).toBe(8);
    expect(await db.getPopularBooks(10)).toHaveLength(2);
  });

  it("returns users and their reading history by UUID", async () => {
    const db = await import("./supabaseDb");
    expect(await db.getAllUsers()).toHaveLength(2);
    const history = await db.getUserReadingHistory("00000000-0000-4000-8000-000000000001");
    expect(history.reading[0].title).toBe("홍길동전");
    expect(history.completed[0].title).toBe("춘향전");
  });

  it("records both signed-in and anonymous visits", async () => {
    const db = await import("./supabaseDb");
    const userId = "00000000-0000-4000-8000-000000000001";
    await db.recordVisit(userId, "session123");
    await db.recordVisit(undefined, "anon-session");
    expect(db.recordVisit).toHaveBeenCalledWith(userId, "session123");
    expect(db.recordVisit).toHaveBeenCalledWith(undefined, "anon-session");
  });
});
