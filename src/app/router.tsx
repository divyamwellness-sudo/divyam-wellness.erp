import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PlaceholderPage } from '@/components/shared/PlaceholderPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
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
            element: (
              <PlaceholderPage
                title="Customers"
                description="Manage customer profiles, wellness goals, and pricing tiers."
                phase="Phase 2 — Customers Module"
              />
            ),
          },
          {
            path: 'weight-tracking',
            element: (
              <PlaceholderPage
                title="Weight Tracking"
                description="Log and monitor customer weight progress over time."
                phase="Phase 2 — Weight Tracking Module"
              />
            ),
          },
          {
            path: 'products',
            element: (
              <PlaceholderPage
                title="Products"
                description="Manage Herbalife products with VP, GST, MRP, and tier pricing."
                phase="Phase 3 — Products Module"
              />
            ),
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
            element: (
              <PlaceholderPage
                title="Billing"
                description="Create invoices with automatic tier-based pricing."
                phase="Phase 4 — Billing Module"
              />
            ),
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
