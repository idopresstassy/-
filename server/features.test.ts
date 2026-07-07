import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  getBooks: vi.fn().mockImplementation(async (filter?: { genre?: string; search?: string }) => {
    const allBooks = [
      { id: 1, title: "홍길동전", author: "허균", genre: "classic", youtubeUrl: null, googleDriveUrl: null, createdAt: new Date() },
      { id: 2, title: "무정", author: "이광수", genre: "modern", youtubeUrl: "https://youtube.com/test", googleDriveUrl: null, createdAt: new Date() },
      { id: 3, title: "해외소설", author: "외국작가", genre: "foreign", youtubeUrl: null, googleDriveUrl: "https://docs.google.com/document/d/abc123/edit", createdAt: new Date() },
    ];
    let result = allBooks;
    if (filter?.genre) result = result.filter(b => b.genre === filter.genre);
    if (filter?.search) result = result.filter(b => b.title.includes(filter.search!) || b.author.includes(filter.search!));
    return result;
  }),
  getBookById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 1) return { id: 1, title: "홍길동전", author: "허균", genre: "classic", content: "옛날에...", youtubeUrl: null, googleDriveUrl: null, createdAt: new Date() };
    if (id === 3) return { id: 3, title: "해외소설", author: "외국작가", genre: "foreign", content: null, youtubeUrl: null, googleDriveUrl: "https://docs.google.com/document/d/abc123/edit", createdAt: new Date() };
    return null;
  }),
  createBook: vi.fn().mockResolvedValue(3),
  upsertBook: vi.fn().mockResolvedValue({ id: 3, isUpdate: false }),
  getBookByTitleAuthor: vi.fn().mockResolvedValue(undefined),
  updateBook: vi.fn().mockResolvedValue(undefined),
  deleteBook: vi.fn().mockResolvedValue(undefined),
  getDonationInfo: vi.fn().mockResolvedValue({
    id: 1, bankName: "국민은행", accountNumber: "123-456", accountHolder: "홍길동",
    description: "후원 안내", email: "test@test.com", representative: "대표",
    closingMessage: "감사합니다", legalNotice: "법적 고지"
  }),
  upsertDonationInfo: vi.fn().mockResolvedValue(undefined),
  getBookmarksByUser: vi.fn().mockResolvedValue([
    { id: 1, bookId: 1, page: 5, label: "6페이지" }
  ]),
  addBookmark: vi.fn().mockResolvedValue(2),
  removeBookmark: vi.fn().mockResolvedValue(undefined),
  getReadingProgress: vi.fn().mockResolvedValue({ currentPage: 10, totalPages: 50 }),
  upsertReadingProgress: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "user-1", email: "user@test.com", name: "User",
      loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "admin-1", email: "admin@test.com", name: "Admin",
      loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("books router", () => {
  it("lists books publicly", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const books = await caller.books.list({});
    expect(books).toHaveLength(3);
    expect(books[0].title).toBe("홍길동전");
  });

  it("filters books by genre", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const classicBooks = await caller.books.list({ genre: "classic" });
    expect(classicBooks).toHaveLength(1);
    expect(classicBooks[0].genre).toBe("classic");
  });

  it("searches books by title", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const results = await caller.books.list({ search: "홍길동" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("홍길동전");
  });

  it("searches books by author", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const results = await caller.books.list({ search: "이광수" });
    expect(results).toHaveLength(1);
    expect(results[0].author).toBe("이광수");
  });

  it("gets a book by id", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const book = await caller.books.getById({ id: 1 });
    expect(book.title).toBe("홍길동전");
    expect(book.content).toBe("옛날에...");
  });

  it("returns NOT_FOUND for non-existent book", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.books.getById({ id: 999 })).rejects.toThrow();
  });

  it("admin can create a book", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.books.create({
      title: "새 책", author: "작가", genre: "modern", content: "내용",
    });
    expect(result.id).toBe(3);
  });

  it("admin can create a book with googleDriveUrl", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.books.create({
      title: "드라이브 책", author: "작가", genre: "classic",
      googleDriveUrl: "https://docs.google.com/document/d/xyz789/edit",
    });
    expect(result.id).toBe(3);
  });

  it("gets a book with googleDriveUrl", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const book = await caller.books.getById({ id: 3 });
    expect(book.googleDriveUrl).toBe("https://docs.google.com/document/d/abc123/edit");
  });

  it("non-admin cannot create a book", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.books.create({ title: "새 책", author: "작가", genre: "modern", content: "내용" })
    ).rejects.toThrow();
  });

  it("admin can update a book", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.books.update({ id: 1, title: "수정된 제목" });
    expect(result.success).toBe(true);
  });

  it("admin can delete a book", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.books.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("donation router", () => {
  it("gets donation info publicly", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const donation = await caller.donation.get();
    expect(donation?.bankName).toBe("국민은행");
  });

  it("admin can update donation info", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.donation.update({ bankName: "신한은행" });
    expect(result.success).toBe(true);
  });

  it("non-admin cannot update donation info", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.donation.update({ bankName: "신한은행" })).rejects.toThrow();
  });
});

describe("bookmarks router", () => {
  it("authenticated user can list bookmarks", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const bookmarks = await caller.bookmarks.list({ bookId: 1 });
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].page).toBe(5);
  });

  it("authenticated user can add a bookmark", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.bookmarks.add({ bookId: 1, page: 10, label: "11페이지" });
    expect(result.id).toBe(2);
  });

  it("unauthenticated user cannot list bookmarks", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.bookmarks.list({ bookId: 1 })).rejects.toThrow();
  });
});

describe("progress router", () => {
  it("authenticated user can get reading progress", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const progress = await caller.progress.get({ bookId: 1 });
    expect(progress?.currentPage).toBe(10);
  });

  it("authenticated user can save reading progress", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.progress.save({ bookId: 1, currentPage: 15, totalPages: 50 });
    expect(result.success).toBe(true);
  });

  it("unauthenticated user cannot save progress", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.progress.save({ bookId: 1, currentPage: 15, totalPages: 50 })).rejects.toThrow();
  });
});
