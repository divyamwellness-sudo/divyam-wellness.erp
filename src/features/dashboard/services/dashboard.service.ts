import { supabase } from '@/lib/supabase/client';
import { toLocalDateInputValue } from '@/lib/utils/format';
import { getTotalStockValuation } from '@/features/inventory/services/inventory.service';
import type { Customer, Invoice, Payment } from '@/types/database.types';

export type DashboardStats = {
  todaysRevenue: number;
  outstandingDue: number;
  totalCustomers: number;
  totalInvoices: number;
  totalVp: number;
  totalStockValuation: number;
};

export type DashboardInvoice = Invoice & {
  customer?: Pick<Customer, 'name' | 'phone'>;
};

export type DashboardPayment = Payment & {
  invoice_number?: string;
};

export type DashboardData = {
  stats: DashboardStats;
  recentInvoices: DashboardInvoice[];
  recentPayments: DashboardPayment[];
};

class DashboardServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'DashboardServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };
    throw new DashboardServiceError(
      `Database error in ${context}: ${supabaseError.message}`,
      supabaseError.code,
      supabaseError.details,
    );
  }

  throw new DashboardServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

function sumField(rows: Array<Record<string, unknown>>, field: string): number {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

function todayDateString(): string {
  return toLocalDateInputValue();
}

async function getTotalStockValuationSafe(): Promise<number> {
  try {
    return await getTotalStockValuation();
  } catch {
    return 0;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const today = todayDateString();

    const [
      todaysPaymentsResult,
      activeInvoicesResult,
      customersCountResult,
      invoicesCountResult,
      recentInvoicesResult,
      recentPaymentsResult,
      totalStockValuation,
    ] = await Promise.all([
      supabase.from('payments').select('amount').eq('payment_date', today),
      supabase.from('invoices').select('due_amount, total_vp').neq('status', 'cancelled'),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('invoices').select('*', { count: 'exact', head: true }),
      supabase
        .from('invoices')
        .select('*, customer:customers(name, phone)')
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('payments')
        .select('*, invoice:invoices(invoice_number)')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      getTotalStockValuationSafe(),
    ]);

    if (todaysPaymentsResult.error) handleSupabaseError(todaysPaymentsResult.error, 'getDashboardData');
    if (activeInvoicesResult.error) handleSupabaseError(activeInvoicesResult.error, 'getDashboardData');
    if (customersCountResult.error) handleSupabaseError(customersCountResult.error, 'getDashboardData');
    if (invoicesCountResult.error) handleSupabaseError(invoicesCountResult.error, 'getDashboardData');
    if (recentInvoicesResult.error) handleSupabaseError(recentInvoicesResult.error, 'getDashboardData');
    if (recentPaymentsResult.error) handleSupabaseError(recentPaymentsResult.error, 'getDashboardData');

    const activeInvoices = activeInvoicesResult.data ?? [];

    const recentInvoices = (recentInvoicesResult.data ?? []).map((row) => {
      const { customer, ...invoice } = row as Invoice & {
        customer: Pick<Customer, 'name' | 'phone'> | null;
      };
      return {
        ...invoice,
        customer: customer ?? undefined,
      };
    });

    const recentPayments = (recentPaymentsResult.data ?? []).map((row) => {
      const { invoice, ...payment } = row as Payment & {
        invoice: { invoice_number: string } | null;
      };
      return {
        ...payment,
        invoice_number: invoice?.invoice_number,
      };
    });

    return {
      stats: {
        todaysRevenue: sumField(todaysPaymentsResult.data ?? [], 'amount'),
        outstandingDue: sumField(activeInvoices, 'due_amount'),
        totalCustomers: customersCountResult.count ?? 0,
        totalInvoices: invoicesCountResult.count ?? 0,
        totalVp: sumField(activeInvoices, 'total_vp'),
        totalStockValuation,
      },
      recentInvoices,
      recentPayments,
    };
  } catch (error) {
    if (error instanceof DashboardServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getDashboardData');
  }
}
