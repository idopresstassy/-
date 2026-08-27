import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { SUPABASE_PASSWORD_RESET_ROUTE } from "@/lib/authNavigation";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("인증 이메일을 보냈습니다. 이메일 확인 후 로그인해 주세요.");
      return;
    }
    navigate("/");
  }

  return (
    <main className="min-h-screen bg-[#f8f5ef] flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
        <p className="text-sm tracking-[0.2em] text-amber-700">KOREALIB</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">명작무료책방 로그인</h1>
        <p className="mt-2 text-sm text-stone-600">읽기 진행도, 책갈피, 내 책장을 저장할 수 있습니다.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-stone-700">이메일<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
          <label className="block text-sm font-medium text-stone-700">비밀번호<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" /></label>
          {message && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-stone-900 px-4 py-2.5 font-medium text-white disabled:opacity-60">{busy ? "처리 중…" : mode === "signin" ? "로그인" : "회원가입"}</button>
        </form>
        <button className="mt-4 text-sm text-amber-800 underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
          {mode === "signin" ? "처음 방문하셨나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
        {mode === "signin" && <button className="mt-3 block text-sm text-stone-600 underline" onClick={() => navigate(SUPABASE_PASSWORD_RESET_ROUTE)}>비밀번호를 잊으셨나요?</button>}
      </section>
    </main>
  );
}
