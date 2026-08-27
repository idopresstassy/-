import { describe, expect, it } from "vitest";
import { getSupabaseLoginRoute, SUPABASE_LOGIN_ROUTE, SUPABASE_PASSWORD_RESET_ROUTE } from "./authNavigation";
import { getPasswordResetRedirect } from "./supabaseAuth";

describe("authNavigation", () => {
  it("routes library login to the Supabase login screen", () => {
    expect(SUPABASE_LOGIN_ROUTE).toBe("/login");
    expect(getSupabaseLoginRoute("NAVER(inapp)")).toBe("/login");
    expect(getSupabaseLoginRoute("KAKAOTALK")).toBe("/login");
  });

  it("uses the current site domain for password recovery links", () => {
    expect(SUPABASE_PASSWORD_RESET_ROUTE).toBe("/reset-password");
    expect(getPasswordResetRedirect("https://korealib.com")).toBe("https://korealib.com/reset-password");
  });
});
