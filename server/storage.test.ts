import { describe, expect, it } from "vitest";
import { getSupabaseStoragePublicUrl, normalizeStorageKey } from "./storage";

describe("Supabase storage helpers", () => {
  it("normalizes keys without legacy Manus storage paths", () => {
    expect(normalizeStorageKey("/covers/title.png")).toBe("covers/title.png");
  });

  it("builds a Supabase Storage public URL rather than a Manus storage URL", () => {
    expect(getSupabaseStoragePublicUrl("https://example.supabase.co/", "book-covers", "covers/title.png"))
      .toBe("https://example.supabase.co/storage/v1/object/public/book-covers/covers/title.png");
  });
});
