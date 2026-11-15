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

import { readFileSync } from "node:fs";

describe("public HTML accessibility and catalogue description", () => {
  const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
  it("does not restrict mobile zoom", () => {
    expect(html).not.toMatch(/maximum-scale\s*=|user-scalable\s*=\s*no/);
  });
  it("does not publish a stale hardcoded book count", () => {
    const description = html.match(/name="description" content="([^"]+)"/)?.[1];
    expect(description).toContain("명작무료책방");
    expect(description).not.toMatch(/\d+권/);
  });
});
