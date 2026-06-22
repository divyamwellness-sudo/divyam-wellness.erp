import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { formatDate } from '@/lib/utils/format';
import { Package, Receipt, Scale, Users } from 'lucide-react';

const statCards = [
  {
    label: 'Customers',
    value: '—',
    icon: Users,
    description: 'Coming in Phase 2',
  },
  {
    label: 'Products',
    value: '—',
    icon: Package,
    description: 'Coming in Phase 3',
  },
  {
    label: 'Invoices',
    value: '—',
    icon: Receipt,
    description: 'Coming in Phase 4',
  },
  {
    label: 'Weight Logs',
    value: '—',
    icon: Scale,
    description: 'Coming in Phase 2',
  },
];

export function DashboardPage() {
  const { profile, businessSettings } = useAuth();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}. Here is your business overview.`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
                </div>
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{card.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Business Profile</h2>
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-500">Business Name</dt>
              <dd className="font-medium text-slate-900">
                {businessSettings?.business_name ?? 'Divyam Wellness'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-500">Invoice Prefix</dt>
              <dd className="font-medium text-slate-900">
                {businessSettings?.invoice_prefix ?? 'DW'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-500">Currency</dt>
              <dd className="font-medium text-slate-900">
                {businessSettings?.currency ?? 'INR'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-500">Last Updated</dt>
              <dd className="font-medium text-slate-900">
                {businessSettings?.updated_at
                  ? formatDate(businessSettings.updated_at)
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Getting Started</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-semibold text-brand-600">1.</span>
              Phase 1 complete — authentication and dashboard are live.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-brand-600">2.</span>
              Next: add customers and weight tracking.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-brand-600">3.</span>
              Then products, inventory, billing, and reports.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
