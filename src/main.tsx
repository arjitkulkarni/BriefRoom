import { MotionConfig } from 'motion/react';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import './styles/globals.css';
import { PageLoader } from './components/feedback/states';
import { TooltipProvider } from './components/ui/overlay';
import { ThemeProvider, useTheme } from './hooks/use-theme';
import Landing from './features/landing/landing-page';

// Route-level code splitting: the Nexconn SDK and heavy workspace code load only where needed.
const StartShop = lazy(() => import('./features/shops/start-shop-page'));
const ShopPage = lazy(() => import('./features/shops/public-shop-page'));
const Dashboard = lazy(() => import('./features/dashboard/dashboard-page'));
const Workspace = lazy(() => import('./features/workspace/workspace-page'));
const WorkOrder = lazy(() => import('./features/approvals/work-order-page'));
const DesignSystem = lazy(() => import('./pages/design-system-page'));
const Stats = lazy(() => import('./pages/stats-page'));
const Demo = lazy(() => import('./features/demo/demo-page'));
const NotFound = lazy(() => import('./pages/not-found-page'));
// Isolated motion-design preview (not linked from the product).
const MotionLab = lazy(() => import('./features/motion-lab/motion-lab-page'));

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />;
}

// StrictMode is safe: the Nexconn client guards initialise/connect with module-level singletons.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* One reduced-motion policy for the whole app: transforms and layout animation off, opacity kept. */}
      <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/start" element={<StartShop />} />
              <Route path="/seller/:shopId" element={<Dashboard />} />
              <Route path="/shop/:shopId" element={<ShopPage />} />
              <Route path="/o/:orderId" element={<Workspace />} />
              <Route path="/o/:orderId/work-order" element={<WorkOrder />} />
              <Route path="/design-system" element={<DesignSystem />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/motion-lab" element={<MotionLab />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <ThemedToaster />
      </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>,
);
