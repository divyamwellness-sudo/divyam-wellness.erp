import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  Filter,
  FileText,
  IndianRupee,
  Copy,
  Trash2,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';
import { ExportDropdown } from '@/components/shared/ExportDropdown';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { exportToExcel, exportToPdfReport } from '@/lib/export';
import type { ExportColumn, ExportRow } from '@/lib/export';
import {
  deleteQuotation,
  duplicateQuotation,
  getQuotations,
  type QuotationFilters,
} from '@/features/billing/services/quotation.service';
import { getCustomers } from '@/features/customers/services/customer.service';
import type { Quotation, QuotationStatus } from '@/types/database.types';

const statusOptions: Array<{ value: QuotationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

const statusStyles: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-indigo-100 text-indigo-700',
};

const statusLabels: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        statusStyles[status]
      }`}
    >
      {statusLabels[status]}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function QuotationRowActions({
  quotation,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  quotation: Quotation;
  onView: (quotation: Quotation) => void;
  onEdit: (quotation: Quotation) => void;
  onDuplicate: (quotation: Quotation) => void;
  onDelete: (quotation: Quotation) => void;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = quotation.status === 'draft';
  const canDelete = quotation.status === 'draft';

  return (
    <div className="relative inline-block text-left">
      <Button variant="ghost" size="sm" onClick={() => setOpen((prev) => !prev)}>
        <MoreHorizontal className="h-4 w-4" />
        Actions
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onView(quotation);
              }}
            >
              <Eye className="h-4 w-4" />
              View
            </button>
            {canEdit && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setOpen(false);
                  onEdit(quotation);
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onDuplicate(quotation);
              }}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            {canDelete && (
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setOpen(false);
                  onDelete(quotation);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete Draft
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QuotationTable({
  quotations,
  customerLabel,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  quotations: Quotation[];
  customerLabel: (customerId: string) => { name: string; phone: string } | null;
  onView: (quotation: Quotation) => void;
  onEdit: (quotation: Quotation) => void;
  onDuplicate: (quotation: Quotation) => void;
  onDelete: (quotation: Quotation) => void;
}) {
  if (quotations.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-4 text-slate-500">No quotations found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Quotation #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Valid Until
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {quotations.map((quotation) => {
              const customer = customerLabel(quotation.customer_id);
              return (
                <tr key={quotation.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {quotation.quotation_number}
                  </td>
                  <td className="px-6 py-4">
                    {customer ? (
                      <div className="text-sm">
                        <p className="text-slate-900">{customer.name}</p>
                        <p className="text-slate-500">{customer.phone}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <QuotationStatusBadge status={quotation.status} />
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                    {formatCurrency(quotation.total_amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {formatDate(quotation.quotation_date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {formatDate(quotation.valid_until)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <QuotationRowActions
                      quotation={quotation}
                      onView={onView}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QuotationsPage() {
  const navigate = useNavigate();
  const { businessSettings, profile } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<QuotationFilters>({
    status: 'all',
    customerId: '',
    search: '',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: quotationsData, isLoading, error, refetch } = useQuery({
    queryKey: ['quotations', filters],
    queryFn: () => getQuotations(filters),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', { status: 'all' }],
    queryFn: () => getCustomers({ status: 'all' }),
  });

  const quotations = quotationsData?.quotations || [];
  const customers = customersData?.customers || [];

  const customerLabel = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer ? { name: customer.name, phone: customer.phone } : null;
  };

  // --- Export wiring (respects current search + status/customer filters) ---
  const customerNameFor = (customerId: string): string =>
    customers.find((c) => c.id === customerId)?.name ?? '—';

  const quotationExportColumns: ExportColumn[] = [
    { key: 'quotationNumber', header: 'Quotation Number', type: 'text' },
    { key: 'customer', header: 'Customer', type: 'text' },
    { key: 'status', header: 'Status', type: 'text' },
    { key: 'amount', header: 'Amount', type: 'currency' },
    { key: 'validUntil', header: 'Valid Until', type: 'date' },
  ];

  const buildQuotationExportRows = (): ExportRow[] =>
    quotations.map((q) => ({
      quotationNumber: q.quotation_number,
      customer: customerNameFor(q.customer_id),
      status: statusLabels[q.status],
      amount: Number(q.total_amount),
      validUntil: q.valid_until ? formatDate(q.valid_until) : '',
    }));

  const quotationExportBase = {
    title: 'Quotations Report',
    worksheetName: 'Quotations',
    filename: `quotations-${new Date().toISOString().slice(0, 10)}`,
    columns: quotationExportColumns,
    businessSettings,
    generatedBy: profile?.full_name,
  };

  const handleExportQuotationsExcel = () =>
    exportToExcel({ ...quotationExportBase, rows: buildQuotationExportRows() });
  const handleExportQuotationsPdf = () =>
    exportToPdfReport({ ...quotationExportBase, rows: buildQuotationExportRows() });

  const customerFilterOptions = [
    { value: '', label: 'All Customers' },
    ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
  ];

  const isFiltered =
    (filters.status && filters.status !== 'all') ||
    Boolean(filters.customerId) ||
    Boolean(filters.search?.trim()) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  const activeQuotations = quotations.filter((q) => q.status !== 'rejected' && q.status !== 'expired');
  const totalQuotedValue = activeQuotations.reduce(
    (sum, q) => sum + Number(q.total_amount),
    0,
  );
  const draftCount = quotations.filter((q) => q.status === 'draft').length;
  const convertedCount = quotations.filter((q) => q.status === 'converted').length;

  const handleFilterChange = (key: keyof QuotationFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const duplicateMutation = useMutation({
    mutationFn: duplicateQuotation,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setToast(`Duplicated as ${created.quotation_number}`);
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate quotation.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setToast('Draft quotation deleted.');
      setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete quotation.');
    },
  });

  const handleView = (quotation: Quotation) => {
    navigate(`/billing/quotations/${quotation.id}`);
  };

  const handleEdit = (quotation: Quotation) => {
    navigate(`/billing/quotations/${quotation.id}/edit`);
  };

  const handleDuplicate = (quotation: Quotation) => {
    setActionError(null);
    void duplicateMutation.mutateAsync(quotation.id);
  };

  const handleDelete = (quotation: Quotation) => {
    setActionError(null);
    const confirm = window.confirm(
      `Delete draft quotation ${quotation.quotation_number}? This cannot be undone.`,
    );
    if (!confirm) return;
    void deleteMutation.mutateAsync(quotation.id);
  };

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Create and manage customer quotations. Convert accepted quotations into invoices in one click."
        action={
          <div className="flex flex-wrap gap-2">
            <ExportDropdown
              onExportExcel={handleExportQuotationsExcel}
              onExportPdf={handleExportQuotationsPdf}
              disabled={quotations.length === 0}
            />
            <Button onClick={() => navigate('/billing/quotations/new')}>
              <Plus className="h-4 w-4" />
              Create Quotation
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={isFiltered ? 'Filtered Quotations' : 'Total Quotations'}
          value={quotations.length.toLocaleString('en-IN')}
          icon={<FileText className="h-5 w-5 text-brand-600" />}
          accent="bg-brand-50"
        />
        <SummaryCard
          label={isFiltered ? 'Filtered Quoted Value' : 'Total Quoted Value'}
          value={formatCurrency(totalQuotedValue)}
          icon={<IndianRupee className="h-5 w-5 text-green-600" />}
          accent="bg-green-50"
        />
        <SummaryCard
          label="Drafts"
          value={draftCount.toLocaleString('en-IN')}
          icon={<Pencil className="h-5 w-5 text-amber-600" />}
          accent="bg-amber-50"
        />
        <SummaryCard
          label="Converted"
          value={convertedCount.toLocaleString('en-IN')}
          icon={<Copy className="h-5 w-5 text-indigo-600" />}
          accent="bg-indigo-50"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by quotation number..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            label="Status"
            value={filters.status || 'all'}
            onChange={(value) =>
              handleFilterChange('status', value === 'all' ? '' : value)
            }
            options={statusOptions as unknown as Array<{ value: string; label: string }>}
          />

          <Select
            label="Customer"
            value={filters.customerId || ''}
            onChange={(value) => handleFilterChange('customerId', value)}
            options={customerFilterOptions}
          />

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                setFilters({ status: 'all', customerId: '', search: '' })
              }
            >
              <Filter className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            label="From Date"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
          <Input
            label="To Date"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-slate-600">
          Showing {quotations.length} quotations
        </p>
      </div>

      {actionError && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <QueryErrorAlert
          message="Error loading quotations. Please try again."
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading quotations...</p>
        </div>
      )}

      {!isLoading && (
        <QuotationTable
          quotations={quotations}
          customerLabel={customerLabel}
          onView={handleView}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
