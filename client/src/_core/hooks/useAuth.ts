import { getLoginUrl } from "@/const";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(session),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const state = useMemo(() => {
    localStorage.setItem(
      "korealib-user-info",
      JSON.stringify(meQuery.data ?? null)
    );
    return {
      user: meQuery.data ?? null,
      loading: loading || (Boolean(session) && meQuery.isLoading),
      error: null,
      isAuthenticated: Boolean(session?.user),
    };
  }, [
    session, loading, meQuery.data, meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading || (Boolean(session) && meQuery.isLoading)) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    loading, session, meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => supabase.auth.getSession().then(({ data }) => setSession(data.session)),
    logout,
  };
}
