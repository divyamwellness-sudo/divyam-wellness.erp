import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ExportDropdown } from '@/components/shared/ExportDropdown';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { exportToExcel, exportToPdfReport } from '@/lib/export';
import type { ExportColumn, ExportRow } from '@/lib/export';
import {
  getDefaultReportDateRange,
  ReportDateFilter,
} from '@/features/reports/components/ReportDateFilter';
import { ReportTable, type ReportColumn } from '@/features/reports/components/ReportTable';
import {
  getCustomerReport,
  getDueReport,
  getPaymentReport,
  getSalesReport,
} from '@/features/reports/services/reports.service';
import type {
  CustomerReportRow,
  DueReportRow,
  PaymentReportRow,
  ReportType,
  SalesReportRow,
} from '@/features/reports/types';
import type { CustomerType, InvoiceStatus, PaymentMethod } from '@/types/database.types';

const reportTabs: Array<{ id: ReportType; label: string }> = [
  { id: 'sales', label: 'Sales' },
  { id: 'due', label: 'Due' },
  { id: 'payments', label: 'Payments' },
  { id: 'customers', label: 'Customers' },
];

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

function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        type === 'coach' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
      }`}
    >
      {type === 'coach' ? 'Coach' : 'PC'}
    </span>
  );
}

function SummaryStrip({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm"
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="text-sm font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { businessSettings, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportType>('sales');
  const [dateRange, setDateRange] = useState(getDefaultReportDateRange);

  const rangeValid = dateRange.dateFrom <= dateRange.dateTo;

  const salesQuery = useQuery({
    queryKey: ['reports', 'sales', dateRange],
    queryFn: () => getSalesReport(dateRange),
    enabled: rangeValid && activeTab === 'sales',
  });

  const dueQuery = useQuery({
    queryKey: ['reports', 'due'],
    queryFn: () => getDueReport(dateRange),
    enabled: activeTab === 'due',
  });

  const paymentsQuery = useQuery({
    queryKey: ['reports', 'payments', dateRange],
    queryFn: () => getPaymentReport(dateRange),
    enabled: rangeValid && activeTab === 'payments',
  });

  const customersQuery = useQuery({
    queryKey: ['reports', 'customers', dateRange],
    queryFn: () => getCustomerReport(dateRange),
    enabled: rangeValid && activeTab === 'customers',
  });

  const activeQuery =
    activeTab === 'sales'
      ? salesQuery
      : activeTab === 'due'
        ? dueQuery
        : activeTab === 'payments'
          ? paymentsQuery
          : customersQuery;

  const salesColumns = useMemo<ReportColumn<SalesReportRow>[]>(
    () => [
      { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
      { key: 'invoiceNumber', header: 'Invoice #', render: (row) => row.invoiceNumber },
      { key: 'customer', header: 'Customer', render: (row) => row.customer },
      {
        key: 'totalAmount',
        header: 'Total Amount',
        align: 'right',
        render: (row) => formatCurrency(row.totalAmount),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyles[row.status]}`}>
            {statusLabels[row.status]}
          </span>
        ),
      },
    ],
    [],
  );

  const dueColumns = useMemo<ReportColumn<DueReportRow>[]>(
    () => [
      { key: 'customer', header: 'Customer', render: (row) => row.customer },
      { key: 'customerPhone', header: 'Phone', render: (row) => row.customerPhone },
      { key: 'invoiceNumber', header: 'Invoice #', render: (row) => row.invoiceNumber },
      {
        key: 'dueAmount',
        header: 'Due Amount',
        align: 'right',
        render: (row) => <span className="font-medium text-red-600">{formatCurrency(row.dueAmount)}</span>,
      },
      { key: 'invoiceDate', header: 'Invoice Date', render: (row) => formatDate(row.invoiceDate) },
      {
        key: 'daysOutstanding',
        header: 'Days Outstanding',
        align: 'right',
        render: (row) => `${row.daysOutstanding} days`,
      },
    ],
    [],
  );

  const paymentColumns = useMemo<ReportColumn<PaymentReportRow>[]>(
    () => [
      { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
      { key: 'invoiceNumber', header: 'Invoice #', render: (row) => row.invoiceNumber },
      {
        key: 'paymentMethod',
        header: 'Method',
        render: (row) => paymentMethodLabels[row.paymentMethod] ?? row.paymentMethod,
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        render: (row) => <span className="font-medium text-green-700">{formatCurrency(row.amount)}</span>,
      },
      { key: 'reference', header: 'Reference', render: (row) => row.reference },
    ],
    [],
  );

  const customerColumns = useMemo<ReportColumn<CustomerReportRow>[]>(
    () => [
      { key: 'customerName', header: 'Customer', render: (row) => row.customerName },
      {
        key: 'customerType',
        header: 'Type',
        render: (row) => <CustomerTypeBadge type={row.customerType} />,
      },
      {
        key: 'currentWeight',
        header: 'Current Weight',
        align: 'right',
        render: (row) => (row.currentWeight != null ? `${row.currentWeight} kg` : '—'),
      },
      {
        key: 'totalInvoices',
        header: 'Total Invoices',
        align: 'right',
        render: (row) => row.totalInvoices,
      },
      {
        key: 'totalSpend',
        header: 'Total Spend',
        align: 'right',
        render: (row) => formatCurrency(row.totalSpend),
      },
      {
        key: 'totalVp',
        header: 'Total VP',
        align: 'right',
        render: (row) => <span className="font-medium text-orange-600">{formatVP(row.totalVp)}</span>,
      },
    ],
    [],
  );

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  // --- Export wiring (respects active tab + current date range; exports
  // exactly the rows currently rendered in the report table) ---
  const reportExportConfig = useMemo<{
    title: string;
    worksheetName: string;
    columns: ExportColumn[];
    rows: ExportRow[];
    orientation?: 'portrait' | 'landscape';
  } | null>(() => {
    if (activeTab === 'sales' && salesQuery.data) {
      return {
        title: 'Sales Report',
        worksheetName: 'Sales',
        orientation: 'landscape',
        columns: [
          { key: 'date', header: 'Date', type: 'date' },
          { key: 'invoiceNumber', header: 'Invoice Number', type: 'text' },
          { key: 'customer', header: 'Customer', type: 'text' },
          { key: 'totalAmount', header: 'Total Amount', type: 'currency' },
          { key: 'status', header: 'Status', type: 'text' },
        ],
        rows: salesQuery.data.rows.map((row) => ({
          date: formatDate(row.date),
          invoiceNumber: row.invoiceNumber,
          customer: row.customer,
          totalAmount: Number(row.totalAmount),
          status: statusLabels[row.status],
        })),
      };
    }
    if (activeTab === 'due' && dueQuery.data) {
      return {
        title: 'Outstanding Due Report',
        worksheetName: 'Due',
        orientation: 'landscape',
        columns: [
          { key: 'customer', header: 'Customer', type: 'text' },
          { key: 'phone', header: 'Phone', type: 'text' },
          { key: 'invoiceNumber', header: 'Invoice Number', type: 'text' },
          { key: 'dueAmount', header: 'Due Amount', type: 'currency' },
          { key: 'invoiceDate', header: 'Invoice Date', type: 'date' },
          { key: 'daysOutstanding', header: 'Days Outstanding', type: 'number' },
        ],
        rows: dueQuery.data.rows.map((row) => ({
          customer: row.customer,
          phone: row.customerPhone,
          invoiceNumber: row.invoiceNumber,
          dueAmount: Number(row.dueAmount),
          invoiceDate: formatDate(row.invoiceDate),
          daysOutstanding: row.daysOutstanding,
        })),
      };
    }
    if (activeTab === 'payments' && paymentsQuery.data) {
      return {
        title: 'Payments Report',
        worksheetName: 'Payments',
        columns: [
          { key: 'date', header: 'Date', type: 'date' },
          { key: 'invoiceNumber', header: 'Invoice Number', type: 'text' },
          { key: 'method', header: 'Payment Method', type: 'text' },
          { key: 'amount', header: 'Amount', type: 'currency' },
          { key: 'reference', header: 'Reference', type: 'text' },
        ],
        rows: paymentsQuery.data.rows.map((row) => ({
          date: formatDate(row.date),
          invoiceNumber: row.invoiceNumber,
          method: paymentMethodLabels[row.paymentMethod] ?? row.paymentMethod,
          amount: Number(row.amount),
          reference: row.reference,
        })),
      };
    }
    if (activeTab === 'customers' && customersQuery.data) {
      return {
        title: 'Customer Activity Report',
        worksheetName: 'Customers',
        orientation: 'landscape',
        columns: [
          { key: 'customerName', header: 'Customer Name', type: 'text' },
          { key: 'type', header: 'Type', type: 'text' },
          { key: 'currentWeight', header: 'Current Weight (kg)', type: 'number' },
          { key: 'totalInvoices', header: 'Total Invoices', type: 'number' },
          { key: 'totalSpend', header: 'Total Spend', type: 'currency' },
          { key: 'totalVp', header: 'Total VP', type: 'number' },
        ],
        rows: customersQuery.data.rows.map((row) => ({
          customerName: row.customerName,
          type: row.customerType === 'coach' ? 'Coach' : 'PC',
          currentWeight: row.currentWeight ?? '',
          totalInvoices: row.totalInvoices,
          totalSpend: Number(row.totalSpend),
          totalVp: Number(row.totalVp),
        })),
      };
    }
    return null;
  }, [
    activeTab,
    dateRange,
    salesQuery.data,
    dueQuery.data,
    paymentsQuery.data,
    customersQuery.data,
  ]);

  const handleExportReportExcel = () => {
    if (!reportExportConfig) return;
    void exportToExcel({
      title: reportExportConfig.title,
      worksheetName: reportExportConfig.worksheetName,
      filename: `${activeTab}-report-${dateRange.dateFrom}-to-${dateRange.dateTo}`,
      columns: reportExportConfig.columns,
      rows: reportExportConfig.rows,
      businessSettings,
      generatedBy: profile?.full_name,
      orientation: reportExportConfig.orientation,
    });
  };

  const handleExportReportPdf = () => {
    if (!reportExportConfig) return;
    void exportToPdfReport({
      title: reportExportConfig.title,
      subtitle: `Period: ${formatDate(dateRange.dateFrom)} – ${formatDate(dateRange.dateTo)}`,
      worksheetName: reportExportConfig.worksheetName,
      filename: `${activeTab}-report-${dateRange.dateFrom}-to-${dateRange.dateTo}`,
      columns: reportExportConfig.columns,
      rows: reportExportConfig.rows,
      businessSettings,
      generatedBy: profile?.full_name,
      orientation: reportExportConfig.orientation,
    });
  };

  const getActiveRowCount = (): number => {
    if (activeTab === 'sales') return salesQuery.data?.rows.length ?? 0;
    if (activeTab === 'due') return dueQuery.data?.rows.length ?? 0;
    if (activeTab === 'payments') return paymentsQuery.data?.rows.length ?? 0;
    return customersQuery.data?.rows.length ?? 0;
  };

  const exportDisabled = !rangeValid || activeQuery.isLoading || getActiveRowCount() === 0;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Sales, payments, outstanding dues, and customer activity."
        action={
          <ExportDropdown
            onExportExcel={handleExportReportExcel}
            onExportPdf={handleExportReportPdf}
            disabled={exportDisabled}
          />
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {reportTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <ReportDateFilter
          dateFrom={dateRange.dateFrom}
          dateTo={dateRange.dateTo}
          onChange={handleDateChange}
          onReset={() => setDateRange(getDefaultReportDateRange())}
        />
      </div>

      {!rangeValid && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          The start date must be on or before the end date.
        </div>
      )}

      {activeQuery.error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>Failed to load report. Please try again.</p>
          <Button variant="secondary" size="sm" onClick={() => activeQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {activeQuery.isLoading && rangeValid && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading report...</p>
        </div>
      )}

      {!activeQuery.isLoading && rangeValid && activeTab === 'sales' && salesQuery.data && (
        <>
          <SummaryStrip
            items={[
              { label: 'Invoices', value: salesQuery.data.summary.count.toString() },
              { label: 'Total Sales', value: formatCurrency(salesQuery.data.summary.totalAmount) },
            ]}
          />
          <ReportTable
            columns={salesColumns}
            rows={salesQuery.data.rows}
            emptyMessage="No sales found for this date range."
            rowKey={(row) => row.invoiceId}
            onRowClick={(row) => navigate(`/billing/invoices/${row.invoiceId}`)}
          />
        </>
      )}

      {!activeQuery.isLoading && activeTab === 'due' && dueQuery.data && (
        <>
          <SummaryStrip
            items={[
              { label: 'Invoices with Balance Due', value: dueQuery.data.summary.count.toString() },
              { label: 'Total Outstanding Due', value: formatCurrency(dueQuery.data.summary.totalDue) },
            ]}
          />
          <ReportTable
            columns={dueColumns}
            rows={dueQuery.data.rows}
            emptyMessage="No outstanding dues."
            rowKey={(row) => row.invoiceId}
            onRowClick={(row) => navigate(`/billing/invoices/${row.invoiceId}`)}
          />
        </>
      )}

      {!activeQuery.isLoading && rangeValid && activeTab === 'payments' && paymentsQuery.data && (
        <>
          <SummaryStrip
            items={[
              { label: 'Payments', value: paymentsQuery.data.summary.count.toString() },
              { label: 'Total Collected', value: formatCurrency(paymentsQuery.data.summary.totalAmount) },
            ]}
          />
          <ReportTable
            columns={paymentColumns}
            rows={paymentsQuery.data.rows}
            emptyMessage="No payments found for this date range."
            rowKey={(row) => row.paymentId}
            onRowClick={(row) => navigate(`/billing/invoices/${row.invoiceId}`)}
          />
        </>
      )}

      {!activeQuery.isLoading && rangeValid && activeTab === 'customers' && customersQuery.data && (
        <>
          <SummaryStrip
            items={[
              { label: 'Customers with Activity', value: customersQuery.data.summary.count.toString() },
              { label: 'Invoices in Period', value: customersQuery.data.summary.totalInvoices.toString() },
              { label: 'Spend in Period', value: formatCurrency(customersQuery.data.summary.totalSpend) },
              { label: 'VP in Period', value: formatVP(customersQuery.data.summary.totalVp) },
            ]}
          />
          <ReportTable
            columns={customerColumns}
            rows={customersQuery.data.rows}
            emptyMessage="No customers with invoice activity in this date range."
            rowKey={(row) => row.customerId}
          />
        </>
      )}
    </div>
  );
}
