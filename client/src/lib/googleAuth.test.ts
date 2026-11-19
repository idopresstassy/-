import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loginLink, loginReturn } from "./authNavigation";
import { authErrorMessage, isEmbeddedBrowser } from "./authMessages";

const state = vi.hoisted(() => ({ sessions: vi.fn(), clients: [] as any[] }));
vi.mock("./supabase", () => ({
  supabaseUrl: "https://project.supabase.co",
  supabasePublicKey: "public-test-key",
  supabase: { auth: { setSession: state.sessions } },
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
import {
  finishGoogleLogin,
  googleLoginEnabled,
  readGoogleDestination,
  startGoogleLogin,
  validGoogleAttempt,
} from "./googleAuth";

const attempt = "abcde123-abcd-abcd-abcd-123456789abc";
class StorageFake {
  getItem(key: string) {
    return (this as any)[key] ?? null;
  }
  setItem(key: string, value: string) {
    (this as any)[key] = value;
  }
  removeItem(key: string) {
    delete (this as any)[key];
  }
}
beforeEach(() => {
  vi.restoreAllMocks();
  state.sessions.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal("localStorage", new StorageFake());
  vi.stubGlobal("crypto", { randomUUID: () => attempt });
  vi.stubGlobal("location", { origin: "https://korealib.com" });
  vi.stubGlobal("navigator", { userAgent: "Chrome" });
  vi.stubGlobal("window", { location: { assign: vi.fn() } });
});

describe("membership navigation", () => {
  it("preserves allowed bookshelf, creative and community destinations", () => {
    expect(loginReturn("/bookshelf")).toBe("/bookshelf");
    expect(loginReturn("/creative")).toBe("/creative");
    expect(loginReturn("/read/90003?untrusted=1")).toBe("/read/90003");
    expect(loginLink("/community/new?book=90003")).toBe(
      "/login?next=%2Fcommunity%2Fnew%3Fbook%3D90003"
    );
  });
  it.each([
    "//evil.example/",
    "https://evil.example",
    "/admin",
    "/login",
    "/auth/callback",
    "/read/0",
    "/bookshelf\\evil",
    "/community/../../admin",
  ])("rejects unsafe redirect %s", next => {
    expect(loginReturn(next)).toBe("/");
  });
  it("does not leak raw authentication errors", () => {
    expect(
      authErrorMessage({ code: "invalid_credentials", message: "secret" })
    ).toContain("비밀번호");
    expect(authErrorMessage({ code: "email_not_confirmed" })).toContain(
      "인증 이메일"
    );
    expect(authErrorMessage({ message: "secret" })).not.toContain("secret");
  });
});

describe("Google availability and PKCE initiation", () => {
  it("keeps the Google button hidden when provider is disabled", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: false } }),
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await googleLoginEnabled()).toBe(false);
    expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: true } }),
    });
    expect(await googleLoginEnabled()).toBe(true);
  });
  it("opens a PKCE flow with a bound attempt and no requested extra Google scopes", async () => {
    const start = vi.fn().mockResolvedValue({
      data: { url: "https://project.supabase.co/auth/v1/authorize" },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOAuth: start },
    } as any);
    await startGoogleLogin("/community/new?book=90003");
    expect(vi.mocked(createClient).mock.calls.at(-1)?.[2]?.auth).toMatchObject({
      flowType: "pkce",
      detectSessionInUrl: false,
      autoRefreshToken: false,
    });
    expect(start.mock.calls[0][0]).toEqual({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
        redirectTo: `https://korealib.com/auth/callback?attempt=${attempt}`,
      },
    });
    expect(
      readGoogleDestination(
        localStorage.getItem(`korealib-google-${attempt}-pending`)
      )
    ).toBe("/community/new?book=90003");
  });
  it("uses the native bridge and a code-only return URI in updated Android apps", async () => {
    const start = vi.fn().mockResolvedValue({
      data: { url: "https://project.supabase.co/auth/v1/authorize" },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOAuth: start },
    } as any);
    vi.stubGlobal("navigator", { userAgent: "Android; wv)" });
    window.MyeongjakAuth = { postMessage: vi.fn() };
    await startGoogleLogin("/bookshelf");
    expect(start.mock.calls[0][0].options.redirectTo).toBe(
      `com.myeongjak.library://auth/callback?attempt=${attempt}`
    );
    expect(window.MyeongjakAuth.postMessage).toHaveBeenCalledOnce();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
  it("never attempts Google sign-in inside old embedded browsers", async () => {
    expect(isEmbeddedBrowser("Android; wv)")).toBe(true);
    expect(isEmbeddedBrowser("KAKAOTALK")).toBe(true);
    vi.stubGlobal("navigator", { userAgent: "Android; wv)" });
    await expect(startGoogleLogin("/")).rejects.toThrow("embedded_browser");
  });
});

describe("OAuth callback binding", () => {
  it("requires a live local attempt and a safe return route", () => {
    expect(validGoogleAttempt("../../session")).toBe(false);
    expect(validGoogleAttempt(attempt)).toBe(true);
    expect(() => readGoogleDestination(null)).toThrow();
    expect(() => readGoogleDestination('{"createdAt":1}', 700000)).toThrow();
    expect(() => readGoogleDestination('{"createdAt":100}', 99)).toThrow();
    expect(
      readGoogleDestination('{"createdAt":100,"next":"//evil.example"}', 101)
    ).toBe("/");
  });
  it("exchanges a callback once, passes only Supabase session tokens, then removes temporary credentials", async () => {
    localStorage.setItem(
      `korealib-google-${attempt}-pending`,
      JSON.stringify({ createdAt: Date.now(), next: "/bookshelf" })
    );
    localStorage.setItem(
      `korealib-google-${attempt}-code-verifier`,
      "fixture-verifier"
    );
    localStorage.setItem("existing-member-data", "retain");
    const exchange = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          provider_token: "do-not-copy",
        },
      },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue({
      auth: { exchangeCodeForSession: exchange },
    } as any);
    const search = `?attempt=${attempt}&code=fixture-code-123&sb_flow_id=fixture-flow`;
    expect(
      await Promise.all([finishGoogleLogin(search), finishGoogleLogin(search)])
    ).toEqual(["/bookshelf", "/bookshelf"]);
    expect(exchange).toHaveBeenCalledOnce();
    expect(exchange).toHaveBeenCalledWith("fixture-code-123", {
      flowId: "fixture-flow",
    });
    expect(state.sessions).toHaveBeenCalledOnce();
    expect(state.sessions).toHaveBeenCalledWith({
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
    });
    expect(
      localStorage.getItem(`korealib-google-${attempt}-code-verifier`)
    ).toBeNull();
    expect(localStorage.getItem("existing-member-data")).toBe("retain");
  });
});

describe("rejected Google callbacks", () => {
  it("does not change membership when a callback arrives without an initiating browser", async () => {
    await expect(
      finishGoogleLogin(`?attempt=${attempt}&code=unrequested-code`)
    ).rejects.toThrow();
    expect(state.sessions).not.toHaveBeenCalled();
  });
  it("cleans up a cancelled attempt without creating a session", async () => {
    localStorage.setItem(
      `korealib-google-${attempt}-pending`,
      JSON.stringify({ createdAt: Date.now(), next: "/bookshelf" })
    );
    localStorage.setItem(
      `korealib-google-${attempt}-code-verifier`,
      "fixture-verifier"
    );
    await expect(
      finishGoogleLogin(`?attempt=${attempt}&error=access_denied`)
    ).rejects.toThrow("cancelled");
    expect(state.sessions).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(`korealib-google-${attempt}-pending`)
    ).toBeNull();
  });
  it("never transfers a failed or intercepted code into the existing session", async () => {
    localStorage.setItem(
      `korealib-google-${attempt}-pending`,
      JSON.stringify({ createdAt: Date.now(), next: "/bookshelf" })
    );
    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi
          .fn()
          .mockResolvedValue({
            data: { session: null },
            error: new Error("invalid verifier"),
          }),
      },
    } as any);
    await expect(
      finishGoogleLogin(`?attempt=${attempt}&code=wrong-verifier-code`)
    ).rejects.toThrow("invalid verifier");
    expect(state.sessions).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(`korealib-google-${attempt}-pending`)
    ).toBeNull();
  });
});
