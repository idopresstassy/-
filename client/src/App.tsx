import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Reader from "./pages/Reader";
import Admin from "./pages/Admin";
import Bookshelf from "./pages/Bookshelf";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/read/:id"} component={Reader} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/bookshelf"} component={Bookshelf} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function VisitTracker() {
  const recordVisit = trpc.visit.record.useMutation();
  const recorded = useRef(false);
  useEffect(() => {
    if (!recorded.current) {
      recorded.current = true;
      // localStorage에 세션 ID를 저장하여 동일 브라우저에서 중복 방문 방지
      const today = new Date().toISOString().slice(0, 10);
      const visitKey = `visit_${today}`;
      if (!localStorage.getItem(visitKey)) {
        recordVisit.mutate();
        localStorage.setItem(visitKey, "1");
      }
    }
  }, []);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <VisitTracker />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
