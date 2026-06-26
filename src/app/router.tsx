import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { InventoryPage } from '@/features/inventory/pages/InventoryPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { CustomersPage } from '@/features/customers/pages/CustomersPage';
import { CustomerDetailsPage } from '@/features/customers/pages/CustomerDetailsPage';
import { WeightTrackingPage } from '@/features/weight-tracking/pages/WeightTrackingPage';
import { ProductsPage } from '@/features/products/pages/ProductsPage';
import { InvoicesPage } from '@/features/billing/pages/InvoicesPage';
import { CreateInvoicePage } from '@/features/billing/pages/CreateInvoicePage';
import { InvoiceDetailsPage } from '@/features/billing/pages/InvoiceDetailsPage';
import { QuotationsPage } from '@/features/billing/pages/QuotationsPage';
import { CreateQuotationPage } from '@/features/billing/pages/CreateQuotationPage';
import { EditQuotationPage } from '@/features/billing/pages/EditQuotationPage';
import { QuotationDetailsPage } from '@/features/billing/pages/QuotationDetailsPage';
import { PaymentsPage } from '@/features/billing/pages/PaymentsPage';
import { ReportsPage } from '@/features/reports/pages/ReportsPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
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
            path: 'customers/:id',
            element: <CustomerDetailsPage />,
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
            element: <InventoryPage />,
          },
          {
            path: 'billing',
            element: <Navigate to="/billing/invoices" replace />,
          },
          {
            path: 'billing/quotations',
            element: <QuotationsPage />,
          },
          {
            path: 'billing/quotations/new',
            element: <CreateQuotationPage />,
          },
          {
            path: 'billing/quotations/:id',
            element: <QuotationDetailsPage />,
          },
          {
            path: 'billing/quotations/:id/edit',
            element: <EditQuotationPage />,
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
            path: 'billing/invoices/:id',
            element: <InvoiceDetailsPage />,
          },
          {
            path: 'billing/payments',
            element: <PaymentsPage />,
          },
          {
            path: 'reports',
            element: <ReportsPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
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
