import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Scale,
  Package,
  Warehouse,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  end?: boolean;
};

export const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, end: true },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Weight Tracking', href: '/weight-tracking', icon: Scale },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Inventory', href: '/inventory', icon: Warehouse },
  { label: 'Billing', href: '/billing', icon: Receipt },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];
