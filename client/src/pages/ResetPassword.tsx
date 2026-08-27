import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { SUPABASE_LOGIN_ROUTE } from "@/lib/authNavigation";
import { getPasswordResetRedirect } from "@/lib/supabaseAuth";

type Screen = "request" | "update";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [screen, setScreen] = useState<Screen>(() =>
    window.location.hash.includes("type=recovery") || new URLSearchParams(window.location.search).has("code")
      ? "update"
      : "request",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setScreen("update");
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirect(window.location.origin),
    });
    setBusy(false);
    setMessage(error ? error.message : "비밀번호 재설정 링크를 이메일로 보냈습니다. 메일의 링크를 열어 새 비밀번호를 설정해 주세요.");
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("새 비밀번호가 서로 다릅니다.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage("재설정 링크가 만료되었거나 올바르지 않습니다. 다시 재설정을 요청해 주세요.");
      return;
    }
    setMessage("새 비밀번호가 저장되었습니다. 잠시 후 로그인 화면으로 이동합니다.");
    window.setTimeout(() => navigate(SUPABASE_LOGIN_ROUTE), 1400);
  }

  return (
    <main className="min-h-screen bg-[#f8f5ef] flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <p className="text-sm tracking-[0.2em] text-amber-700">KOREALIB</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">{screen === "request" ? "비밀번호 재설정" : "새 비밀번호 설정"}</h1>
        <p className="mt-2 text-sm text-stone-600">{screen === "request" ? "가입한 이메일로 안전한 재설정 링크를 보내드립니다." : "새로운 비밀번호를 입력해 주세요."}</p>

        {screen === "request" ? (
          <form className="mt-6 space-y-4" onSubmit={requestReset}>
            <label className="block text-sm font-medium text-stone-700">이메일<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
            {message && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{message}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-stone-900 px-4 py-2.5 font-medium text-white disabled:opacity-60">{busy ? "보내는 중…" : "재설정 이메일 보내기"}</button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={updatePassword}>
            <label className="block text-sm font-medium text-stone-700">새 비밀번호<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium text-stone-700">새 비밀번호 확인<input type="password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
            {message && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{message}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-stone-900 px-4 py-2.5 font-medium text-white disabled:opacity-60">{busy ? "저장 중…" : "새 비밀번호 저장"}</button>
          </form>
        )}

        <button className="mt-4 text-sm text-amber-800 underline" onClick={() => navigate(SUPABASE_LOGIN_ROUTE)}>로그인으로 돌아가기</button>
      </section>
    </main>
  );
}
