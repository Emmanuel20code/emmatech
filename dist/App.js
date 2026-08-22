"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const react_router_dom_1 = require("react-router-dom");
const default_tsx_1 = require("./components/providers/default.tsx");
const Callback_tsx_1 = __importDefault(require("./pages/auth/Callback.tsx"));
const Index_tsx_1 = __importDefault(require("./pages/Index.tsx"));
const NotFound_tsx_1 = __importDefault(require("./pages/NotFound.tsx"));
const AppLayout_tsx_1 = __importDefault(require("./pages/app/_components/AppLayout.tsx"));
const Dashboard_tsx_1 = __importDefault(require("./pages/app/Dashboard.tsx"));
const Routers_tsx_1 = __importDefault(require("./pages/app/Routers.tsx"));
const Onboarding_tsx_1 = __importDefault(require("./pages/app/Onboarding.tsx"));
const Packages_tsx_1 = __importDefault(require("./pages/app/Packages.tsx"));
const Subscribers_tsx_1 = __importDefault(require("./pages/app/Subscribers.tsx"));
const CaptivePortal_tsx_1 = __importDefault(require("./pages/app/CaptivePortal.tsx"));
const Pppoe_tsx_1 = __importDefault(require("./pages/app/Pppoe.tsx"));
const Analytics_tsx_1 = __importDefault(require("./pages/app/Analytics.tsx"));
const Settings_tsx_1 = __importDefault(require("./pages/app/Settings.tsx"));
function App() {
    return (<default_tsx_1.DefaultProviders>
      <react_router_dom_1.BrowserRouter>
        <react_router_dom_1.Routes>
          <react_router_dom_1.Route path="/" element={<Index_tsx_1.default />}/>
          <react_router_dom_1.Route path="/auth/callback" element={<Callback_tsx_1.default />}/>

          {/* App routes with layout */}
          <react_router_dom_1.Route path="/app" element={<AppLayout_tsx_1.default />}>
            <react_router_dom_1.Route index element={<Dashboard_tsx_1.default />}/>
            <react_router_dom_1.Route path="dashboard" element={<Dashboard_tsx_1.default />}/>
            <react_router_dom_1.Route path="onboarding" element={<Onboarding_tsx_1.default />}/>
            <react_router_dom_1.Route path="routers" element={<Routers_tsx_1.default />}/>
            <react_router_dom_1.Route path="packages" element={<Packages_tsx_1.default />}/>
            <react_router_dom_1.Route path="subscribers" element={<Subscribers_tsx_1.default />}/>
            <react_router_dom_1.Route path="captive-portal" element={<CaptivePortal_tsx_1.default />}/>
            <react_router_dom_1.Route path="pppoe" element={<Pppoe_tsx_1.default />}/>
            <react_router_dom_1.Route path="analytics" element={<Analytics_tsx_1.default />}/>
            <react_router_dom_1.Route path="settings" element={<Settings_tsx_1.default />}/>
          </react_router_dom_1.Route>

          <react_router_dom_1.Route path="*" element={<NotFound_tsx_1.default />}/>
        </react_router_dom_1.Routes>
      </react_router_dom_1.BrowserRouter>
    </default_tsx_1.DefaultProviders>);
}
