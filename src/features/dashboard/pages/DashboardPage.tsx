import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Receipt,
  IndianRupee,
  AlertCircle,
  Award,
  ArrowRight,
  Package,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getDashboardData } from '@/features/dashboard/services/dashboard.service';
import type { InvoiceStatus, PaymentMethod } from '@/types/database.types';

const statusStyles: Record<InvoiceStatus, string> = {
  created: 'bg-slate-100 text-slate-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<InvoiceStatus, string> = {
  created: 'Created',
  partial: 'Partial',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const paymentMethodLabels: Record<PaymentMethod | 'other', string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatVP(value: number): string {
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} VP`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  valueClassName = 'text-slate-900',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${valueClassName}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardData,
  });

  const stats = data?.stats;
  const recentInvoices = data?.recentInvoices ?? [];
  const recentPayments = data?.recentPayments ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}. Here is your business overview.`}
      />

      {error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>Failed to load dashboard data. Please try again.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading dashboard...</p>
        </div>
      )}

      {!isLoading && stats && (
        <>
          {/* Summary Cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <SummaryCard
              label="Today's Revenue"
              value={formatCurrency(stats.todaysRevenue)}
              icon={<IndianRupee className="h-5 w-5 text-green-600" />}
              accent="bg-green-50"
              valueClassName="text-green-700"
            />
            <SummaryCard
              label="Outstanding Due"
              value={formatCurrency(stats.outstandingDue)}
              icon={<AlertCircle className="h-5 w-5 text-red-600" />}
              accent="bg-red-50"
              valueClassName={stats.outstandingDue > 0 ? 'text-red-600' : 'text-slate-900'}
            />
            <SummaryCard
              label="Total Customers"
              value={stats.totalCustomers.toLocaleString('en-IN')}
              icon={<Users className="h-5 w-5 text-brand-600" />}
              accent="bg-brand-50"
            />
            <SummaryCard
              label="Total Invoices"
              value={stats.totalInvoices.toLocaleString('en-IN')}
              icon={<Receipt className="h-5 w-5 text-blue-600" />}
              accent="bg-blue-50"
            />
            <SummaryCard
              label="Total VP"
              value={formatVP(stats.totalVp)}
              icon={<Award className="h-5 w-5 text-orange-600" />}
              accent="bg-orange-50"
              valueClassName="text-orange-600"
            />
            <SummaryCard
              label="Stock Valuation"
              value={formatCurrency(stats.totalStockValuation)}
              icon={<Package className="h-5 w-5 text-teal-600" />}
              accent="bg-teal-50"
              valueClassName="text-teal-700"
            />
          </div>

          {/* Recent Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Invoices */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/billing/invoices')}>
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {recentInvoices.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No invoices yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Invoice #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                          Total
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                          Due
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {recentInvoices.map((invoice) => {
                        const due = Number(invoice.due_amount);
                        const hasDue = due > 0 && invoice.status !== 'cancelled';

                        return (
                          <tr
                            key={invoice.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => navigate(`/billing/invoices/${invoice.id}`)}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              {invoice.invoice_number}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {invoice.customer?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              <InvoiceStatusBadge status={invoice.status} />
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-900">
                              {formatCurrency(Number(invoice.total_amount))}
                            </td>
                            <td
                              className={`px-4 py-3 text-right text-sm font-medium ${
                                hasDue ? 'text-red-600' : 'text-slate-400'
                              }`}
                            >
                              {formatCurrency(due)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Recent Payments */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Recent Payments</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/billing/invoices')}>
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {recentPayments.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No payments recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Invoice #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Method
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {recentPayments.map((payment) => (
                        <tr
                          key={payment.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => navigate(`/billing/invoices/${payment.invoice_id}`)}
                        >
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {formatDate(payment.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {payment.invoice_number ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {paymentMethodLabels[payment.payment_method as PaymentMethod] ??
                              payment.payment_method}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-green-700">
                            {formatCurrency(Number(payment.amount))}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {payment.reference_num || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
