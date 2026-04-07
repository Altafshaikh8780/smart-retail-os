import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { PageLoader } from "./components/PageLoader";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./lib/AuthContext";
import { PERMISSIONS } from "./lib/permissions";

const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Products = lazy(() => import("./pages/Products").then(m => ({ default: m.Products })));
const ProductDetail = lazy(() => import("./pages/ProductDetail").then(m => ({ default: m.ProductDetail })));
const Inventory = lazy(() => import("./pages/Inventory").then(m => ({ default: m.Inventory })));
const IMEITracking = lazy(() => import("./pages/IMEITracking").then(m => ({ default: m.IMEITracking })));
const Orders = lazy(() => import("./pages/Orders").then(m => ({ default: m.Orders })));
const Customers = lazy(() => import("./pages/Customers").then(m => ({ default: m.Customers })));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail").then(m => ({ default: m.CustomerDetail })));
const Employees = lazy(() => import("./pages/Employees").then(m => ({ default: m.Employees })));
const Returns = lazy(() => import("./pages/Returns").then(m => ({ default: m.Returns })));
const Invoices = lazy(() => import("./pages/Invoices").then(m => ({ default: m.Invoices })));
const RestockAI = lazy(() => import("./pages/RestockAI").then(m => ({ default: m.RestockAI })));
const Analytics = lazy(() => import("./pages/Analytics").then(m => ({ default: m.Analytics })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const EmployeeDetails = lazy(() => import("./pages/EmployeeDetails").then(m => ({ default: m.EmployeeDetails })));
const SecondHand = lazy(() => import("./pages/SecondHand").then(m => ({ default: m.SecondHand })));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage").then(m => ({ default: m.PlaceholderPage })));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PRODUCTS}><Products /></ProtectedRoute>} />
            <Route path="products/:id" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PRODUCTS}><ProductDetail /></ProtectedRoute>} />
            
            <Route path="inventory" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_INVENTORY}><Inventory /></ProtectedRoute>} />
            <Route path="second-hand" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_PRODUCTS}><SecondHand /></ProtectedRoute>} />
            <Route path="imei-tracking" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_IMEI}><IMEITracking /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ORDERS}><Orders /></ProtectedRoute>} />
            <Route path="customers" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_CUSTOMERS}><Customers /></ProtectedRoute>} />
            
            <Route path="customers/:id" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_CUSTOMERS}><CustomerDetail /></ProtectedRoute>} />
            
            {/* Admin-only views */}
            <Route path="employees" element={<ProtectedRoute adminOnly><Employees /></ProtectedRoute>} />
            <Route path="employees/:id" element={<ProtectedRoute adminOnly><EmployeeDetails /></ProtectedRoute>} />
            <Route path="returns" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_RETURNS}><Returns /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_INVOICES}><Invoices /></ProtectedRoute>} />
            
            {/* Analytics + Admin Settings */}
            <Route path="analytics" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_ANALYTICS}><Analytics /></ProtectedRoute>} />
            <Route path="restock-ai" element={<ProtectedRoute requiredPermission={PERMISSIONS.VIEW_RESTOCK_AI}><RestockAI /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
            <Route path="*" element={<PlaceholderPage title="404 Not Found" />} />
          </Route>
        </Routes>
      </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
