import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { finishGoogleLogin } from "@/lib/googleAuth";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const [failed, setFailed] = useState(false);
  const [search] = useState(() => window.location.search);
  useEffect(() => {
    let active = true;
    // Don't leave an authorization code in history or outgoing referrers.
    window.history.replaceState(null, "", "/auth/callback");
    finishGoogleLogin(search)
      .then(next => {
        if (active) navigate(next, { replace: true });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [navigate, search]);
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f5ef] px-5">
      <section
        className="max-w-md rounded-2xl border bg-white p-8 text-center"
        aria-live="polite"
      >
        {failed ? (
          <>
            <h1 className="text-xl font-bold">로그인을 다시 시작해 주세요</h1>
            <p className="my-4 text-stone-600">
              취소되었거나 연결 시간이 지났습니다. 로그인 버튼을 누른 브라우저
              또는 앱에서 다시 시도해 주세요.
            </p>
            <Link
              href="/login"
              className="block rounded-xl bg-stone-900 px-5 py-3 text-white"
            >
              로그인으로 돌아가기
            </Link>
            <Link href="/" className="mt-4 block underline">
              가입 없이 책 읽기
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
            <h1 className="text-xl font-bold">Google 계정을 연결하고 있어요</h1>
            <p className="mt-3 text-stone-600">잠시만 기다려 주세요.</p>
          </>
        )}
      </section>
    </main>
  );
}
