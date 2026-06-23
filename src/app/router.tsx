import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlaceholderPage } from '@/components/shared/PlaceholderPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { CustomersPage } from '@/features/customers/pages/CustomersPage';
import { WeightTrackingPage } from '@/features/weight-tracking/pages/WeightTrackingPage';
import { ProductsPage } from '@/features/products/pages/ProductsPage';
import { InvoicesPage } from '@/features/billing/pages/InvoicesPage';
import { CreateInvoicePage } from '@/features/billing/pages/CreateInvoicePage';
import { ProtectedRoute, PublicOnlyRoute } from '@/hooks/useProtectedRoute';

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'customers',
            element: <CustomersPage />,
          },
          {
            path: 'weight-tracking',
            element: <WeightTrackingPage />,
          },
          {
            path: 'products',
            element: <ProductsPage />,
          },
          {
            path: 'inventory',
            element: (
              <PlaceholderPage
                title="Inventory"
                description="Track stock levels and inventory movements."
                phase="Phase 3 — Inventory Module"
              />
            ),
          },
          {
            path: 'billing',
            element: <Navigate to="/billing/invoices" replace />,
          },
          {
            path: 'billing/invoices',
            element: <InvoicesPage />,
          },
          {
            path: 'billing/invoices/new',
            element: <CreateInvoicePage />,
          },
          {
            path: 'reports',
            element: (
              <PlaceholderPage
                title="Reports"
                description="Sales, VP, GST, and wellness progress reports."
                phase="Phase 5 — Reports Module"
              />
            ),
          },
          {
            path: 'settings',
            element: (
              <PlaceholderPage
                title="Settings"
                description="Business profile and admin settings."
                phase="Phase 5 — Settings Module"
              />
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
