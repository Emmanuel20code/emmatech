import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./pages/app/_components/AppLayout.tsx";
import Dashboard from "./pages/app/Dashboard.tsx";
import Routers from "./pages/app/Routers.tsx";
import Onboarding from "./pages/app/Onboarding.tsx";
import Packages from "./pages/app/Packages.tsx";
import Subscribers from "./pages/app/Subscribers.tsx";
import CaptivePortal from "./pages/app/CaptivePortal.tsx";
import Pppoe from "./pages/app/Pppoe.tsx";
import Analytics from "./pages/app/Analytics.tsx";
import Settings from "./pages/app/Settings.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* App routes with layout */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="routers" element={<Routers />} />
            <Route path="packages" element={<Packages />} />
            <Route path="subscribers" element={<Subscribers />} />
            <Route path="captive-portal" element={<CaptivePortal />} />
            <Route path="pppoe" element={<Pppoe />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
