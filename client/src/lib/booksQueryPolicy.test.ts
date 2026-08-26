import { describe, expect, it } from "vitest";
import { booksQueryOptions, getBookCountLabel, shouldShowEmptyBooks } from "./booksQueryPolicy";

describe("booksQueryPolicy", () => {
  it("retries a delayed book-list request three times", () => {
    expect(booksQueryOptions.retry).toBe(3);
    expect(booksQueryOptions.retryDelay(0)).toBe(1000);
    expect(booksQueryOptions.retryDelay(3)).toBe(8000);
  });

  it("does not render an empty-library state when the request failed", () => {
    expect(shouldShowEmptyBooks(undefined, true)).toBe(false);
    expect(shouldShowEmptyBooks([], true)).toBe(false);
    expect(shouldShowEmptyBooks([], false)).toBe(true);
    expect(shouldShowEmptyBooks([{ id: 1 }], false)).toBe(false);
  });

  it("does not label a failed or pending request as zero books", () => {
    expect(getBookCountLabel(undefined, true)).toBe("불러오기 실패");
    expect(getBookCountLabel(undefined, false)).toBe("불러오는 중");
    expect(getBookCountLabel([], false)).toBe("0");
    expect(getBookCountLabel([{ id: 1 }], false)).toBe("1");
  });
});
