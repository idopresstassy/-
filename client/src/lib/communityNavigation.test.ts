import { describe, expect, it } from "vitest";
import { communityLoginReturn } from "./authNavigation";
describe("community login return", () => {
  it("preserves a book inquiry destination across login", () => {
    expect(communityLoginReturn("/community/new?book=90003")).toBe(
      "/community/new?book=90003"
    );
    expect(communityLoginReturn("/community?mode=mine")).toBe(
      "/community?mode=mine"
    );
  });
  it.each([
    null,
    "https://evil.example",
    "//evil.example/community",
    "/community/../../admin",
    "/communityevil",
    "/community\\evil",
    "javascript:alert(1)",
  ])("rejects untrusted destinations %s", value => {
    expect(communityLoginReturn(value)).toBe("/");
  });
});
