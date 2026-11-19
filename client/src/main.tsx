import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { registerServiceWorker } from "@/hooks/useOfflineCache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { supabase } from "./lib/supabase";
import "./index.css";

const queryClient = new QueryClient();

// Private posts and account details must not survive an account switch in
// memory. Query keys also include the account ID to isolate in-flight results.
let previousAccount: string | null | undefined;
supabase.auth.onAuthStateChange((_event, session) => {
  const account = session?.user.id ?? null;
  if (previousAccount !== undefined && previousAccount !== account) {
    const filter = { predicate: (query: { queryKey: readonly unknown[] }) => {
      const path = query.queryKey[0];
      return Array.isArray(path) && (path[0] === "community" || path[0] === "auth");
    } };
    void queryClient.cancelQueries(filter);
    queryClient.removeQueries(filter);
  }
  previousAccount = account;
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const { data } = await supabase.auth.getSession();
        return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

// Register Service Worker for offline caching
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
