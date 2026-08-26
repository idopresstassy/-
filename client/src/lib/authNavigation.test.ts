import { describe, expect, it } from "vitest";
import { SUPABASE_LOGIN_ROUTE } from "./authNavigation";

describe("authNavigation", () => {
  it("routes library login to the Supabase login screen", () => {
    expect(SUPABASE_LOGIN_ROUTE).toBe("/login");
  });
});
