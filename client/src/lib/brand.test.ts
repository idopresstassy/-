import { describe, expect, it } from "vitest";
import { BRAND_LOGO_URL } from "./brand";

describe("brand asset", () => {
  it("uses a public logo URL instead of the legacy Manus storage route", () => {
    expect(BRAND_LOGO_URL).toMatch(/^https:\/\//);
    expect(BRAND_LOGO_URL).not.toContain("/manus-storage/");
  });
});
