import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import Landing from './pages/Landing';
import StartShop from './pages/StartShop';
import Dashboard from './pages/Dashboard';
import ShopPage from './pages/ShopPage';
import Room from './pages/Room';
import WorkOrder from './pages/WorkOrder';
import Stats from './pages/Stats';
import NotFound from './pages/NotFound';

// No StrictMode: its dev double-mount would connect/initialize Nexconn Chat UI twice.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/start" element={<StartShop />} />
      <Route path="/seller/:shopId" element={<Dashboard />} />
      <Route path="/shop/:shopId" element={<ShopPage />} />
      <Route path="/o/:orderId" element={<Room />} />
      <Route path="/o/:orderId/work-order" element={<WorkOrder />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>,
);
