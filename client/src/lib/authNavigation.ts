/** Render 배포에서는 Manus OAuth가 아닌 Supabase 이메일 로그인 화면을 사용합니다. */
export const SUPABASE_LOGIN_ROUTE = "/login";
export const SUPABASE_PASSWORD_RESET_ROUTE = "/reset-password";

/** 앱 내 브라우저 여부와 관계없이 이메일 로그인 화면을 사용합니다. */
export function getSupabaseLoginRoute(_userAgent?: string) {
  return SUPABASE_LOGIN_ROUTE;
}

/** Only return to known community routes after login; never accept an origin. */
export function communityLoginReturn(next: string | null) {
  if (!next || /[\\\r\n]/.test(next)) return "/";
  try {
    const url = new URL(next, "https://korealib.com");
    if (!next.startsWith("/community") || url.origin !== "https://korealib.com") return "/";
    if (!/^\/community(?:\/(?:new|[0-9a-f-]{36}))?$/.test(url.pathname)) return "/";
    return url.pathname + url.search;
  } catch { return "/"; }
}
