import { describe, expect, it } from "vitest";
import { WEBTOON_SITE_URL } from "./externalLinks";

describe("externalLinks", () => {
  it("opens the current Korea Webtoon destination over HTTPS", () => {
    expect(WEBTOON_SITE_URL).toBe("https://www.koreawebtoon.com/");
  });
});
