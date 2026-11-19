import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabasePublicKey } from "./supabase";
import { loginReturn } from "./authNavigation";
import { isEmbeddedBrowser } from "./authMessages";

declare global {
  interface Window {
    MyeongjakAuth?: { postMessage(message: string): void };
  }
}

export const GOOGLE_CALLBACK = "/auth/callback";
export const NATIVE_CALLBACK = "com.myeongjak.library://auth/callback";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX = "korealib-google-";
const MAX_AGE = 10 * 60_000;

export function validGoogleAttempt(value: string | null) {
  return !!value && UUID.test(value);
}
export function readGoogleDestination(raw: string | null, now = Date.now()) {
  if (!raw) throw new Error("expired");
  const pending = JSON.parse(raw);
  if (
    !Number.isFinite(pending.createdAt) ||
    now < pending.createdAt ||
    now - pending.createdAt > MAX_AGE
  )
    throw new Error("expired");
  return loginReturn(typeof pending.next === "string" ? pending.next : null);
}

function clearAttempt(attempt: string) {
  const prefix = `${PREFIX}${attempt}`;
  Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .forEach(key => localStorage.removeItem(key));
}

// A separate PKCE client preserves existing email confirmation/recovery behavior.
// Each attempt has its own verifier; an intercepted app link cannot establish a session.
function oauthClient(attempt: string) {
  return createClient(supabaseUrl, supabasePublicKey, {
    auth: {
      flowType: "pkce",
      storageKey: `${PREFIX}${attempt}`,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function googleLoginEnabled(
  signal?: AbortSignal
): Promise<boolean> {
  if (!supabaseUrl || !supabasePublicKey) return false;
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabasePublicKey },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("settings unavailable");
  const settings = await response.json();
  return settings.external?.google === true;
}

export async function startGoogleLogin(next: string) {
  if (isEmbeddedBrowser(navigator.userAgent) && !window.MyeongjakAuth)
    throw new Error("embedded_browser");
  const attempt = crypto.randomUUID();
  const redirect = new URL(
    window.MyeongjakAuth
      ? NATIVE_CALLBACK
      : `${location.origin}${GOOGLE_CALLBACK}`
  );
  redirect.searchParams.set("attempt", attempt);
  try {
    // Remove expired abandoned attempts, never a different active login attempt.
    for (const key of Object.keys(localStorage).filter(
      key => key.startsWith(PREFIX) && key.endsWith("-pending")
    )) {
      try {
        readGoogleDestination(localStorage.getItem(key));
      } catch {
        clearAttempt(key.slice(PREFIX.length, -"-pending".length));
      }
    }
    localStorage.setItem(
      `${PREFIX}${attempt}-pending`,
      JSON.stringify({ next: loginReturn(next), createdAt: Date.now() })
    );
    const { data, error } = await oauthClient(attempt).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect.href, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error("missing redirect");
    if (window.MyeongjakAuth) window.MyeongjakAuth.postMessage(data.url);
    else window.location.assign(data.url);
  } catch (error) {
    clearAttempt(attempt);
    throw error;
  }
}

// Deduplicate React effects while the one-use code is being exchanged.
let completion: { search: string; promise: Promise<string> } | undefined;
export function finishGoogleLogin(search: string) {
  if (completion?.search !== search)
    completion = { search, promise: completeGoogleLogin(search) };
  return completion.promise;
}
async function completeGoogleLogin(search: string) {
  const params = new URLSearchParams(search);
  const attempt = params.get("attempt");
  if (!attempt || !validGoogleAttempt(attempt)) throw new Error("expired");
  try {
    const next = readGoogleDestination(
      localStorage.getItem(`${PREFIX}${attempt}-pending`)
    );
    if (params.has("error")) throw new Error("cancelled");
    const code = params.get("code");
    if (!code || !/^[A-Za-z0-9_-]{10,2048}$/.test(code))
      throw new Error("invalid code");
    const flowId = params.get("sb_flow_id");
    const { data, error } = await oauthClient(
      attempt
    ).auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error || !data.session) throw error ?? new Error("missing session");
    const result = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (result.error) throw result.error;
    return next;
  } finally {
    clearAttempt(attempt);
  }
}
