import { supabase } from '@/lib/supabase/client';
import type { Payment, PaymentInsert, PaymentUpdate, PaymentMethod } from '@/types/database.types';

export type AddPaymentRequest = {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date?: string;
  reference_num?: string | null;
  notes?: string | null;
};

class PaymentServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };

    switch (supabaseError.code) {
      case '23505':
        throw new PaymentServiceError('This payment already exists.', 'DUPLICATE');

      case '23503':
        throw new PaymentServiceError('Invalid reference: the invoice does not exist.', 'FOREIGN_KEY');

      case '23514':
        throw new PaymentServiceError('Invalid data: a value violates a database constraint.', 'CHECK_VIOLATION');

      case 'P0001': {
        const message = supabaseError.message || 'Operation rejected by a business rule.';
        if (/ALREADY_REVERSED/i.test(message)) {
          throw new PaymentServiceError(
            message.replace(/^ALREADY_REVERSED:\s*/, ''),
            'ALREADY_REVERSED',
          );
        }
        if (/exceeds amount due/i.test(message)) {
          throw new PaymentServiceError(message, 'OVERPAYMENT');
        }
        if (/cancelled/i.test(message)) {
          throw new PaymentServiceError(message, 'INVOICE_CANCELLED');
        }
        if (/cannot modify a reversed payment/i.test(message)) {
          throw new PaymentServiceError(message, 'PAYMENT_REVERSED');
        }
        if (/cannot be deleted/i.test(message)) {
          throw new PaymentServiceError(message, 'DELETE_NOT_ALLOWED');
        }
        throw new PaymentServiceError(message, 'BUSINESS_RULE');
      }

      default:
        throw new PaymentServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new PaymentServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getPayments(invoiceId?: string): Promise<Payment[]> {
  try {
    let query = supabase
      .from('payments')
      .select('*')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error, 'getPayments');
    }

    return data || [];
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getPayments');
  }
}

export async function addPayment(request: AddPaymentRequest): Promise<Payment> {
  try {
    const paymentInsert: PaymentInsert = {
      invoice_id: request.invoice_id,
      amount: request.amount,
      payment_method: request.payment_method,
      payment_date: request.payment_date,
      reference_num: request.reference_num ?? null,
      notes: request.notes ?? null,
    };

    const { data, error } = await supabase
      .from('payments')
      .insert(paymentInsert)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'addPayment');
    }

    return data as Payment;
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'addPayment');
  }
}

export async function updatePayment(id: string, data: PaymentUpdate): Promise<Payment> {
  try {
    const { data: updated, error } = await supabase
      .from('payments')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new PaymentServiceError('Payment not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updatePayment');
    }

    return updated as Payment;
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updatePayment');
  }
}

export async function reversePayment(
  paymentId: string,
  notes?: string | null,
): Promise<string> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: 'reverse_payment',
        args: { p_payment_id: string; p_notes: string | null },
      ) => Promise<{ data: string | null; error: { message: string; code?: string } | null }>
    )('reverse_payment', {
      p_payment_id: paymentId,
      p_notes: notes ?? null,
    });

    if (error) {
      handleSupabaseError(error, 'reversePayment');
    }

    if (!data) {
      throw new PaymentServiceError('Payment reversal did not return an audit id.', 'NO_DATA');
    }

    return data;
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'reversePayment');
  }
}

export async function deletePayment(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('payments').delete().eq('id', id);

    if (error) {
      handleSupabaseError(error, 'deletePayment');
    }
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'deletePayment');
  }
}

// ===========================================================================
// Payment ledger — cross-invoice view of POSTED payments.
// Reversed payments are excluded (the Invoice Details page shows full history).
// ===========================================================================

export type PaymentLedgerFilters = {
  search?: string;
  customerId?: string;
  paymentMethod?: PaymentMethod | 'all';
  dateFrom?: string;
  dateTo?: string;
};

export type PaymentLedgerRow = {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_num: string | null;
  notes: string | null;
  status: 'POSTED' | 'REVERSED';
  created_at: string;
  invoice_id: string;
  invoice_number: string;
  invoice_total: number;
  invoice_paid: number;
  invoice_due: number;
  invoice_status: 'created' | 'partial' | 'paid' | 'cancelled';
  customer_id: string;
  customer_name: string;
  customer_phone: string;
};

export type PaymentLedgerResponse = {
  payments: PaymentLedgerRow[];
  totalCount: number;
};

type LedgerQueryRow = {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_num: string | null;
  notes: string | null;
  status: 'POSTED' | 'REVERSED';
  created_at: string;
  invoice: {
    id: string;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    status: 'created' | 'partial' | 'paid' | 'cancelled';
    customer_id: string;
    customer: { id: string; name: string; phone: string } | null;
  } | null;
};

const ledgerSelect = `
  *,
  invoice:invoices(
    id,
    invoice_number,
    total_amount,
    paid_amount,
    due_amount,
    status,
    customer_id,
    customer:customers(id, name, phone)
  )
`;

function mapLedgerRow(row: LedgerQueryRow): PaymentLedgerRow {
  const invoice = row.invoice;
  return {
    id: row.id,
    amount: Number(row.amount),
    payment_method: row.payment_method,
    payment_date: row.payment_date,
    reference_num: row.reference_num,
    notes: row.notes,
    status: row.status,
    created_at: row.created_at,
    invoice_id: invoice?.id ?? '',
    invoice_number: invoice?.invoice_number ?? '—',
    invoice_total: Number(invoice?.total_amount ?? 0),
    invoice_paid: Number(invoice?.paid_amount ?? 0),
    invoice_due: Number(invoice?.due_amount ?? 0),
    invoice_status: invoice?.status ?? 'created',
    customer_id: invoice?.customer_id ?? invoice?.customer?.id ?? '',
    customer_name: invoice?.customer?.name ?? '—',
    customer_phone: invoice?.customer?.phone ?? '—',
  };
}

export async function getPaymentLedger(
  filters: PaymentLedgerFilters = {},
): Promise<PaymentLedgerResponse> {
  try {
    let query = supabase
      .from('payments')
      .select(ledgerSelect)
      // Only POSTED payments belong on the operational ledger.
      .eq('status', 'POSTED')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      query = query.eq('payment_method', filters.paymentMethod);
    }

    if (filters.dateFrom) {
      query = query.gte('payment_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('payment_date', filters.dateTo);
    }

    if (filters.customerId) {
      // Filter through the joined invoice -> customer relationship.
      query = query.eq('invoice.customer_id', filters.customerId);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error, 'getPaymentLedger');
    }

    let rows = ((data ?? []) as unknown as LedgerQueryRow[]).map(mapLedgerRow);

    // Client-side text search across customer name, invoice number, amount
    // and outstanding due. Supabase cannot OR-search across joined columns +
    // numeric equality in a single ilike, so we filter in memory after fetch.
    const search = filters.search?.trim();
    if (search) {
      const numericQuery = Number(search.replace(/[^0-9.]/g, ''));
      const lower = search.toLowerCase();
      rows = rows.filter((row) => {
        if (row.customer_name.toLowerCase().includes(lower)) return true;
        if (row.invoice_number.toLowerCase().includes(lower)) return true;
        if (numericQuery > 0) {
          if (Math.abs(row.amount - numericQuery) < 0.001) return true;
          if (Math.abs(row.invoice_total - numericQuery) < 0.001) return true;
          if (Math.abs(row.invoice_due - numericQuery) < 0.001) return true;
        }
        return false;
      });
    }

    return {
      payments: rows,
      totalCount: rows.length,
    };
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getPaymentLedger');
  }
}

// ===========================================================================
// Collectable invoices — created/partial invoices for a customer, used by the
// Record Payment modal's invoice picker. Paid/cancelled are never shown.
// ===========================================================================

export type CollectableInvoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: 'created' | 'partial';
  customer_id: string;
  customer_name: string;
};

export async function getCollectableInvoices(
  customerId: string,
): Promise<CollectableInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        invoice_date,
        total_amount,
        paid_amount,
        due_amount,
        status,
        customer_id,
        customer:customers(id, name)
      `,
      )
      .eq('customer_id', customerId)
      .in('status', ['created', 'partial'])
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'getCollectableInvoices');
    }

    return ((data ?? []) as unknown as Array<{
      id: string;
      invoice_number: string;
      invoice_date: string;
      total_amount: number;
      paid_amount: number;
      due_amount: number;
      status: 'created' | 'partial';
      customer_id: string;
      customer: { id: string; name: string } | null;
    }>).map((row) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      invoice_date: row.invoice_date,
      total_amount: Number(row.total_amount),
      paid_amount: Number(row.paid_amount),
      due_amount: Number(row.due_amount),
      status: row.status,
      customer_id: row.customer_id,
      customer_name: row.customer?.name ?? '—',
    }));
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getCollectableInvoices');
  }
}
