import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCatalogState, saveCatalogState } from "./catalogState";

describe("catalogue return state", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("restores applied search and category after the reader unmounts Home", () => {
    const state = { search: "메밀꽃", searchInput: "메밀꽃", genre: "modern" as const };
    saveCatalogState(state);
    expect(readCatalogState("")).toMatchObject(state);
  });
  it("preserves draft input without applying it as a search", () => {
    saveCatalogState({ search: "채만식", searchInput: "탁류", genre: "creative", creativeGenre: "fantasy" });
    expect(readCatalogState("")).toMatchObject({ search: "채만식", searchInput: "탁류", creativeGenre: "fantasy" });
  });
  it("allows explicit category navigation to override stored filters", () => {
    saveCatalogState({ search: "탁류", searchInput: "탁류", genre: "modern" });
    expect(readCatalogState("?genre=creative")).toEqual({ search: "", searchInput: "", genre: "creative" });
  });
  it("keeps search when returning to the same explicit category", () => {
    saveCatalogState({ search: "숲", searchInput: "숲", genre: "creative" });
    expect(readCatalogState("?genre=creative").search).toBe("숲");
  });
  it("persists clearing the search", () => {
    saveCatalogState({ search: "탁류", searchInput: "탁류" });
    saveCatalogState({ search: "", searchInput: "" });
    expect(readCatalogState("").search).toBe("");
  });
  it("does not crash with blocked or malformed storage", () => {
    sessionStorage.setItem("korealib:catalog-state:v1", "bad json");
    expect(readCatalogState("")).toEqual({ search: "", searchInput: "" });
    vi.stubGlobal("sessionStorage", { getItem() { throw Error(); }, setItem() { throw Error(); } });
    expect(readCatalogState("")).toEqual({ search: "", searchInput: "" });
    expect(() => saveCatalogState({ search: "", searchInput: "" })).not.toThrow();
  });
});
