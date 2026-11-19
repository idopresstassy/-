import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Eye, EyeOff, Mail, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  SUPABASE_PASSWORD_RESET_ROUTE,
  loginReturn,
} from "@/lib/authNavigation";
import { authErrorMessage, isEmbeddedBrowser } from "@/lib/authMessages";
import { googleLoginEnabled, startGoogleLogin } from "@/lib/googleAuth";

export default function Login() {
  const [, navigate] = useLocation();
  const [next] = useState(() =>
    loginReturn(new URLSearchParams(window.location.search).get("next"))
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const embedded =
    isEmbeddedBrowser(navigator.userAgent) && !window.MyeongjakAuth;
  const guestDestination = next.startsWith("/read/") ? next : "/";

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    googleLoginEnabled(controller.signal)
      .then(setGoogleEnabled)
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate(next, { replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate(next, { replace: true });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [next, navigate]);
  useEffect(() => {
    if (!resendAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    const failed = () => {
      setBusy(false);
      setMessage(
        "Google 로그인 창을 열지 못했습니다. 기본 브라우저를 확인하거나 이메일로 이용해 주세요."
      );
    };
    window.addEventListener("myeongjak-auth-error", failed);
    return () => window.removeEventListener("myeongjak-auth-error", failed);
  }, []);

  function chooseMode(value: "signin" | "signup") {
    setMode(value);
    setMessage("");
    setConfirmationEmail("");
    setPassword("");
    setShowPassword(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const address = email.trim();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email: address, password })
          : await supabase.auth.signUp({ email: address, password });
      if (result.error) {
        setMessage(authErrorMessage(result.error));
        return;
      }
      if (mode === "signup" && !result.data.session) {
        setConfirmationEmail(address);
        setPassword("");
        setResendAt(Date.now() + 60_000);
        return;
      }
      navigate(next, { replace: true });
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || Date.now() < resendAt) return;
    setBusy(true);
    setMessage("");
    setResendAt(Date.now() + 60_000);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
      });
      setMessage(
        error
          ? authErrorMessage(error)
          : "인증 메일을 다시 요청했습니다. 받은편지함과 스팸함을 확인해 주세요."
      );
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await startGoogleLogin(next);
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f5ef] px-4 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-md rounded-3xl border border-stone-200 bg-white px-6 py-7 shadow-sm sm:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900"
        >
          <BookOpen size={20} aria-hidden="true" /> 명작무료책방
        </Link>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-stone-900">
          책은 누구나, 무료로.
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          가입 없이 바로 읽을 수 있어요.
          <br />
          회원이 되면 내 책장과 읽던 위치를 여러 기기에서 이어 볼 수 있습니다.
        </p>
        <Link
          href={guestDestination}
          className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-900 hover:bg-amber-100"
        >
          가입 없이 책 읽기 <ArrowRight size={18} aria-hidden="true" />
        </Link>

        {googleEnabled && !embedded && (
          <div className="mt-6">
            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-400 bg-white px-4 py-3 font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 48 48"
              >
                <path
                  fill="#4285F4"
                  d="M43.6 24.5c0-1.4-.1-2.7-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.6c3.8-3.6 6.1-8.7 6.1-15.1Z"
                />
                <path
                  fill="#34A853"
                  d="M24 44c5.4 0 10-1.8 13.4-4.9l-6.6-5.2c-1.9 1.2-4.2 1.9-6.8 1.9-5.2 0-9.7-3.5-11.3-8.2H5.9v5.3A20 20 0 0 0 24 44Z"
                />
                <path
                  fill="#FBBC05"
                  d="M12.7 27.6a12 12 0 0 1 0-7.2v-5.3H5.9a20 20 0 0 0 0 17.8l6.8-5.3Z"
                />
                <path
                  fill="#EA4335"
                  d="M24 12.2c2.9 0 5.5 1 7.5 2.9l5.6-5.6A19 19 0 0 0 24 4 20 20 0 0 0 5.9 15.1l6.8 5.3c1.6-4.7 6.1-8.2 11.3-8.2Z"
                />
              </svg>
              Google로 시작하기
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-stone-500">
              처음이면 간편 가입, 이미 회원이면 로그인됩니다.
            </p>
          </div>
        )}
        {googleEnabled && embedded && (
          <p className="mt-5 text-sm leading-6 text-stone-600">
            이 앱에서는 이메일로 이용해 주세요. Google 로그인은 Chrome·Safari
            또는 최신 책방 앱에서 사용할 수 있습니다.
          </p>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-stone-500">
          <span className="h-px flex-1 bg-stone-200" />
          이메일로 이용하기
          <span className="h-px flex-1 bg-stone-200" />
        </div>
        <div
          className="grid grid-cols-2 rounded-xl bg-stone-100 p-1"
          role="group"
          aria-label="이메일 이용 방법"
        >
          {(["signin", "signup"] as const).map(value => (
            <button
              key={value}
              type="button"
              disabled={busy}
              aria-pressed={mode === value}
              onClick={() => chooseMode(value)}
              className={`min-h-11 rounded-lg px-2 text-sm font-semibold ${mode === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
            >
              {value === "signin" ? "로그인" : "처음 오셨나요? 가입"}
            </button>
          ))}
        </div>
        {confirmationEmail ? (
          <div className="mt-5" role="status">
            <Mail className="mb-3 text-amber-700" aria-hidden="true" />
            <h2 className="text-lg font-bold text-stone-900">
              인증 메일을 확인해 주세요
            </h2>
            <p className="mt-2 break-words text-sm leading-6 text-stone-600">
              <strong>{confirmationEmail}</strong>의 받은편지함에서 인증 링크를
              눌러 주세요. 메일이 없으면 스팸함도 확인해 주세요.
            </p>
            <button
              type="button"
              onClick={() => chooseMode("signin")}
              className="mt-4 min-h-12 w-full rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white"
            >
              인증 후 로그인하기
            </button>
            <button
              type="button"
              disabled={busy || remaining > 0}
              onClick={resend}
              className="mt-2 min-h-11 w-full text-sm text-amber-800 underline disabled:text-stone-400"
            >
              {remaining > 0
                ? `${remaining}초 후 메일 다시 보내기`
                : "인증 메일 다시 보내기"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseMode("signup")}
              className="min-h-10 w-full text-sm text-stone-500 underline"
            >
              이메일 주소 수정하기
            </button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium text-stone-700">
              이메일
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="이메일 주소를 입력해 주세요"
                className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
              />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              비밀번호
              <span className="relative mt-2 block">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  disabled={busy}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={
                    mode === "signup"
                      ? "8자 이상 입력해 주세요"
                      : "비밀번호를 입력해 주세요"
                  }
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-white py-3 pl-3 pr-14 text-base"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "비밀번호 숨기기" : "비밀번호 보기"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-stone-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </span>
            </label>
            {mode === "signup" && (
              <p className="text-xs leading-5 text-stone-500">
                이메일과 비밀번호만 입력하면 됩니다. 가입 후 인증 메일을 확인해
                주세요.
              </p>
            )}
            <button
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
            >
              {busy && (
                <Loader2
                  className="animate-spin"
                  size={18}
                  aria-hidden="true"
                />
              )}
              {busy
                ? "연결 중…"
                : mode === "signin"
                  ? "이메일로 로그인"
                  : "무료 회원가입"}
            </button>
          </form>
        )}
        {message && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          >
            {message}
          </p>
        )}
        {mode === "signin" && (
          <Link
            href={SUPABASE_PASSWORD_RESET_ROUTE}
            className="mt-3 block py-2 text-center text-sm text-stone-600 underline"
          >
            비밀번호를 잊으셨나요?
          </Link>
        )}
        <p className="mt-5 text-center text-xs leading-5 text-stone-500">
          한 번 로그인하면 이 기기에서 로그인 상태가 유지됩니다.
          <br />
          공용 기기에서는 이용 후 로그아웃해 주세요.
        </p>
        <Link
          href="/privacy"
          className="mt-3 block py-2 text-center text-xs text-stone-500 underline"
        >
          개인정보처리방침
        </Link>
      </section>
    </main>
  );
}
