import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Reader from "./pages/Reader";
import Admin from "./pages/Admin";
import Creative from "./pages/Creative";
import CreativeAdmin from "./pages/CreativeAdmin";
import Bookshelf from "./pages/Bookshelf";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { BRAND_LOGO_URL } from "@/lib/brand";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/read/:id"} component={Reader} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/creative"} component={Creative} />
      <Route path={"/admin/creative"} component={CreativeAdmin} />
      <Route path={"/bookshelf"} component={Bookshelf} />
      <Route path={"/login"} component={Login} />
      <Route path={"/reset-password"} component={ResetPassword} />
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

// PWA Install Prompt Component
function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if user dismissed before (show again after 7 days)
    const dismissed = localStorage.getItem('pwa_dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // iOS detection
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS guide after 3 seconds
      setTimeout(() => setShowBanner(true), 3000);
    }

    // Listen for beforeinstallprompt (Chrome, Edge, Samsung Internet)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem('pwa_dismissed', new Date().toISOString());
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 bg-card border-t border-border shadow-lg animate-in slide-in-from-bottom duration-300">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img
            src={BRAND_LOGO_URL}
            alt="명작무료책방"
            className="w-12 h-12 rounded-xl shadow-sm flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground">바탕화면에 앱 추가하기</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              브라우저 없이 바로 명작무료책방을 열 수 있습니다
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              닫기
            </button>
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              설치
            </button>
          </div>
        </div>
      </div>

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-end justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-4">
              <img
                src={BRAND_LOGO_URL}
                alt="명작무료책방"
                className="w-16 h-16 rounded-xl shadow-sm mx-auto mb-3"
              />
              <h3 className="font-bold text-lg">홈 화면에 추가하기</h3>
              <p className="text-sm text-muted-foreground mt-1">아래 순서대로 진행해주세요</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <p>하단의 <strong>공유 버튼</strong> (□↑)을 누르세요</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <p>메뉴에서 <strong>"홈 화면에 추가"</strong>를 선택하세요</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <p><strong>"추가"</strong>를 눌러 완료하세요</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-full mt-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <VisitTracker />
          <PWAInstallPrompt />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
