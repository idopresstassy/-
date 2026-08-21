import { describe, it, expect, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getTotalUserCount: vi.fn().mockResolvedValue(25),
  getTodayVisitorCount: vi.fn().mockResolvedValue(8),
  getPopularBooks: vi.fn().mockResolvedValue([
    { bookId: 1, readerCount: 15, title: "홍길동전", author: "허균" },
    { bookId: 2, readerCount: 10, title: "춘향전", author: "작자미상" },
  ]),
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, openId: "user1", name: "김철수", email: "kim@test.com", role: "admin", createdAt: new Date(), lastSignedIn: new Date() },
    { id: 2, openId: "user2", name: "이영희", email: "lee@test.com", role: "user", createdAt: new Date(), lastSignedIn: new Date() },
  ]),
  getUserReadingHistory: vi.fn().mockResolvedValue({
    reading: [{ bookId: 1, currentPage: 5, totalPages: 20, updatedAt: new Date(), title: "홍길동전", author: "허균" }],
    completed: [{ bookId: 2, currentPage: 19, totalPages: 20, updatedAt: new Date(), title: "춘향전", author: "작자미상" }],
  }),
  getAllUserEmails: vi.fn().mockResolvedValue([
    { email: "kim@test.com", name: "김철수" },
    { email: "lee@test.com", name: "이영희" },
  ]),
  recordVisit: vi.fn().mockResolvedValue(undefined),
}));

describe("Admin Statistics API", () => {
  it("should return total user count", async () => {
    const db = await import("./db");
    const count = await db.getTotalUserCount();
    expect(count).toBe(25);
  });

  it("should return today visitor count", async () => {
    const db = await import("./db");
    const count = await db.getTodayVisitorCount();
    expect(count).toBe(8);
  });

  it("should return popular books list", async () => {
    const db = await import("./db");
    const books = await db.getPopularBooks(10);
    expect(books).toHaveLength(2);
    expect(books[0].title).toBe("홍길동전");
    expect(books[0].readerCount).toBe(15);
  });
});

describe("Admin User Management", () => {
  it("should return all users", async () => {
    const db = await import("./db");
    const users = await db.getAllUsers();
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe("김철수");
    expect(users[0].role).toBe("admin");
  });

  it("should return user reading history with reading/completed separation", async () => {
    const db = await import("./db");
    const history = await db.getUserReadingHistory(1);
    expect(history.reading).toHaveLength(1);
    expect(history.reading[0].title).toBe("홍길동전");
    expect(history.reading[0].currentPage).toBe(5);
    expect(history.completed).toHaveLength(1);
    expect(history.completed[0].title).toBe("춘향전");
  });

  it("should return all user emails for bulk email", async () => {
    const db = await import("./db");
    const emails = await db.getAllUserEmails();
    expect(emails).toHaveLength(2);
    expect(emails[0].email).toBe("kim@test.com");
  });
});

describe("Visit Tracking", () => {
  it("should record a visit", async () => {
    const db = await import("./db");
    await db.recordVisit(1, "session123");
    expect(db.recordVisit).toHaveBeenCalledWith(1, "session123");
  });

  it("should record anonymous visit", async () => {
    const db = await import("./db");
    await db.recordVisit(undefined, "anon-session");
    expect(db.recordVisit).toHaveBeenCalledWith(undefined, "anon-session");
  });
});
