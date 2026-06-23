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
        if (/exceeds amount due/i.test(message)) {
          throw new PaymentServiceError(message, 'OVERPAYMENT');
        }
        if (/cancelled/i.test(message)) {
          throw new PaymentServiceError(message, 'INVOICE_CANCELLED');
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
