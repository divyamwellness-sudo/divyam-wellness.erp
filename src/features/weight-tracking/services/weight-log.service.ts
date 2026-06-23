import { supabase } from '@/lib/supabase/client';
import type { WeightLog, WeightLogInsert, WeightLogUpdate } from '@/types';

class WeightLogServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'WeightLogServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };
    
    // Handle specific Postgres error codes
    switch (supabaseError.code) {
      case '23505':
        if (supabaseError.message.includes('weight_logs_customer_date_unique')) {
          throw new WeightLogServiceError(
            'A weight log already exists for this customer on this date.',
            'DUPLICATE_DATE',
          );
        }
        throw new WeightLogServiceError('This weight log entry already exists.', 'DUPLICATE');
      
      case '23503':
        if (supabaseError.message.includes('weight_logs_customer_id_fkey')) {
          throw new WeightLogServiceError('Customer not found.', 'CUSTOMER_NOT_FOUND');
        }
        throw new WeightLogServiceError('Invalid reference data provided.', 'FOREIGN_KEY');
      
      case '23514':
        throw new WeightLogServiceError('Invalid data format provided.', 'CHECK_VIOLATION');
      
      default:
        throw new WeightLogServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new WeightLogServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getWeightLogs(customerId: string): Promise<WeightLog[]> {
  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_date', { ascending: true });

    if (error) {
      handleSupabaseError(error, 'getWeightLogs');
    }

    return data || [];
  } catch (error) {
    if (error instanceof WeightLogServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getWeightLogs');
  }
}

export async function addWeightLog(weightLogData: WeightLogInsert): Promise<WeightLog> {
  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .insert(weightLogData)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'addWeightLog');
    }

    return data;
  } catch (error) {
    if (error instanceof WeightLogServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'addWeightLog');
  }
}

export async function updateWeightLog(id: string, weightLogData: WeightLogUpdate): Promise<WeightLog> {
  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .update(weightLogData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new WeightLogServiceError('Weight log not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updateWeightLog');
    }

    return data;
  } catch (error) {
    if (error instanceof WeightLogServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateWeightLog');
  }
}

export async function deleteWeightLog(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('weight_logs')
      .delete()
      .eq('id', id);

    if (error) {
      handleSupabaseError(error, 'deleteWeightLog');
    }
  } catch (error) {
    if (error instanceof WeightLogServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'deleteWeightLog');
  }
}

export async function getLatestWeight(customerId: string): Promise<WeightLog | null> {
  try {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      handleSupabaseError(error, 'getLatestWeight');
    }

    return data;
  } catch (error) {
    if (error instanceof WeightLogServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getLatestWeight');
  }
}