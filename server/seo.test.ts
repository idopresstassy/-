import { describe, expect, it } from "vitest";
import { buildSitemap } from "./seo";

describe("buildSitemap", () => {
  it("uses only canonical public read URLs and escapes the base URL", () => {
    const sitemap = buildSitemap("https://korealib.com/", [
      { id: 12, updatedAt: new Date("2026-08-27T10:00:00.000Z") },
    ]);

    expect(sitemap).toContain("https://korealib.com/");
    expect(sitemap).toContain("https://korealib.com/read/12");
    expect(sitemap).toContain("<lastmod>2026-08-27</lastmod>");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/login");
  });
});
