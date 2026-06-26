import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Scale,
  Package,
  Warehouse,
  Receipt,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  ChevronDown,
} from 'lucide-react';

export type NavSubItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  end?: boolean;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  end?: boolean;
  children?: NavSubItem[];
};

export const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Weight Tracking', href: '/weight-tracking', icon: Scale },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Inventory', href: '/inventory', icon: Warehouse },
  {
    label: 'Billing',
    href: '/billing',
    icon: Receipt,
    children: [
      { label: 'Quotations', href: '/billing/quotations', icon: FileText },
      { label: 'Invoices', href: '/billing/invoices', icon: Receipt },
      { label: 'Payments', href: '/billing/payments', icon: CreditCard },
    ],
  },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** Icon used for the collapsible caret on parent items with children. */
export const NavCaretIcon = ChevronDown;
