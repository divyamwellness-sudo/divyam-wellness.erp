import { supabase } from '@/lib/supabase/client';
import type { Customer, Invoice, Payment } from '@/types/database.types';
import type {
  CustomerReportRow,
  CustomerReportSummary,
  DueReportRow,
  DueReportSummary,
  PaymentReportRow,
  PaymentReportSummary,
  ReportDateRange,
  SalesReportRow,
  SalesReportSummary,
} from '@/features/reports/types';

class ReportsServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ReportsServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };
    throw new ReportsServiceError(
      `Database error in ${context}: ${supabaseError.message}`,
      supabaseError.code,
      supabaseError.details,
    );
  }

  throw new ReportsServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

function daysOutstanding(invoiceDate: string): number {
  const start = new Date(invoiceDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export async function getSalesReport(
  range: ReportDateRange,
): Promise<{ rows: SalesReportRow[]; summary: SalesReportSummary }> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_date, invoice_number, total_amount, status, customer:customers(name)')
      .gte('invoice_date', range.dateFrom)
      .lte('invoice_date', range.dateTo)
      .order('invoice_date', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'getSalesReport');
    }

    const rows: SalesReportRow[] = (data ?? []).map((row) => {
      const invoice = row as Invoice & { customer: { name: string } | null };
      return {
        date: invoice.invoice_date,
        invoiceNumber: invoice.invoice_number,
        customer: invoice.customer?.name ?? '—',
        totalAmount: Number(invoice.total_amount),
        status: invoice.status,
        invoiceId: invoice.id,
      };
    });

    const activeRows = rows.filter((row) => row.status !== 'cancelled');

    return {
      rows,
      summary: {
        count: activeRows.length,
        totalAmount: activeRows.reduce((sum, row) => sum + row.totalAmount, 0),
      },
    };
  } catch (error) {
    if (error instanceof ReportsServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getSalesReport');
  }
}

export async function getDueReport(
  _range: ReportDateRange,
): Promise<{ rows: DueReportRow[]; summary: DueReportSummary }> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_date, invoice_number, due_amount, customer:customers(name, phone)')
      .gt('due_amount', 0)
      .neq('status', 'cancelled')
      .order('due_amount', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'getDueReport');
    }

    const rows: DueReportRow[] = (data ?? []).map((row) => {
      const invoice = row as Invoice & { customer: Pick<Customer, 'name' | 'phone'> | null };
      return {
        customer: invoice.customer?.name ?? '—',
        customerPhone: invoice.customer?.phone ?? '—',
        invoiceNumber: invoice.invoice_number,
        dueAmount: Number(invoice.due_amount),
        invoiceDate: invoice.invoice_date,
        daysOutstanding: daysOutstanding(invoice.invoice_date),
        invoiceId: invoice.id,
      };
    });

    return {
      rows,
      summary: {
        count: rows.length,
        totalDue: rows.reduce((sum, row) => sum + row.dueAmount, 0),
      },
    };
  } catch (error) {
    if (error instanceof ReportsServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getDueReport');
  }
}

export async function getPaymentReport(
  range: ReportDateRange,
): Promise<{ rows: PaymentReportRow[]; summary: PaymentReportSummary }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('id, payment_date, amount, payment_method, reference_num, invoice_id, status, invoice:invoices(invoice_number)')
      .eq('status', 'POSTED')
      .gte('payment_date', range.dateFrom)
      .lte('payment_date', range.dateTo)
      .order('payment_date', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'getPaymentReport');
    }

    const rows: PaymentReportRow[] = (data ?? []).map((row) => {
      const payment = row as Payment & { invoice: { invoice_number: string } | null };
      return {
        paymentId: payment.id,
        date: payment.payment_date,
        invoiceNumber: payment.invoice?.invoice_number ?? '—',
        paymentMethod: payment.payment_method,
        amount: Number(payment.amount),
        reference: payment.reference_num ?? '—',
        invoiceId: payment.invoice_id,
      };
    });

    return {
      rows,
      summary: {
        count: rows.length,
        totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      },
    };
  } catch (error) {
    if (error instanceof ReportsServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getPaymentReport');
  }
}

export async function getCustomerReport(
  range: ReportDateRange,
): Promise<{ rows: CustomerReportRow[]; summary: CustomerReportSummary }> {
  try {
    const [customersResult, invoicesResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, name, customer_type, current_weight, phone')
        .eq('status', 'active'),
      supabase
        .from('invoices')
        .select('customer_id, total_amount, total_vp')
        .neq('status', 'cancelled')
        .gte('invoice_date', range.dateFrom)
        .lte('invoice_date', range.dateTo),
    ]);

    if (customersResult.error) {
      handleSupabaseError(customersResult.error, 'getCustomerReport');
    }
    if (invoicesResult.error) {
      handleSupabaseError(invoicesResult.error, 'getCustomerReport');
    }

    const customerMap = new Map(
      (customersResult.data as Customer[]).map((customer) => [customer.id, customer]),
    );

    const aggregates = new Map<
      string,
      { totalInvoices: number; totalSpend: number; totalVp: number }
    >();

    for (const row of invoicesResult.data ?? []) {
      const invoice = row as Pick<Invoice, 'customer_id' | 'total_amount' | 'total_vp'>;
      const existing = aggregates.get(invoice.customer_id) ?? {
        totalInvoices: 0,
        totalSpend: 0,
        totalVp: 0,
      };
      existing.totalInvoices += 1;
      existing.totalSpend += Number(invoice.total_amount);
      existing.totalVp += Number(invoice.total_vp);
      aggregates.set(invoice.customer_id, existing);
    }

    const rows: CustomerReportRow[] = [];

    for (const [customerId, stats] of aggregates) {
      const customer = customerMap.get(customerId);
      if (!customer) continue;

      rows.push({
        customerId,
        customerName: customer.name,
        customerType: customer.customer_type,
        currentWeight: customer.current_weight,
        totalInvoices: stats.totalInvoices,
        totalSpend: stats.totalSpend,
        totalVp: stats.totalVp,
      });
    }

    rows.sort((a, b) => b.totalSpend - a.totalSpend);

    return {
      rows,
      summary: {
        count: rows.length,
        totalInvoices: rows.reduce((sum, row) => sum + row.totalInvoices, 0),
        totalSpend: rows.reduce((sum, row) => sum + row.totalSpend, 0),
        totalVp: rows.reduce((sum, row) => sum + row.totalVp, 0),
      },
    };
  } catch (error) {
    if (error instanceof ReportsServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getCustomerReport');
  }
}
