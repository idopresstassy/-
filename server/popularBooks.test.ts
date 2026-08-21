import { beforeEach, describe, expect, it, vi } from "vitest";
import { books, bookViews } from "../drizzle/schema";

const queryMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const orderBy = vi.fn(() => ({ limit }));
  const having = vi.fn(() => ({ orderBy }));
  const groupBy = vi.fn(() => ({ having }));
  const leftJoin = vi.fn(() => ({ groupBy }));
  const from = vi.fn(() => ({ leftJoin }));
  const select = vi.fn(() => ({ from }));
  const drizzle = vi.fn(() => ({ select }));
  return { drizzle, select, from, leftJoin, groupBy, having, orderBy, limit };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: queryMocks.drizzle }));

import { getPopularBooks } from "./db";

describe("getPopularBooks", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test";
    vi.clearAllMocks();
    queryMocks.limit.mockResolvedValue([
      { bookId: 1, title: "홍길동전", author: "허균", readerCount: "7" },
    ]);
  });

  it("통합 book_views 테이블을 기준으로 누적 인기 순위를 집계한다", async () => {
    const result = await getPopularBooks(50);

    expect(queryMocks.from).toHaveBeenCalledWith(books);
    expect(queryMocks.leftJoin).toHaveBeenCalledWith(bookViews, expect.anything());
    expect(queryMocks.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      { bookId: 1, title: "홍길동전", author: "허균", readerCount: 7 },
    ]);
  });
});
