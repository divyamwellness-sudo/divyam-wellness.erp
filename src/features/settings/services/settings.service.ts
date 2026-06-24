import { supabase } from '@/lib/supabase/client';
import type { BusinessSettings, BusinessSettingsUpdate } from '@/types/database.types';

export type UpdateBusinessSettingsRequest = Omit<
  BusinessSettingsUpdate,
  'id' | 'next_invoice_number' | 'updated_at'
>;

class SettingsServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'SettingsServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };

    switch (supabaseError.code) {
      case '23514':
        throw new SettingsServiceError('Invalid data format provided.', 'CHECK_VIOLATION');

      default:
        throw new SettingsServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new SettingsServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  try {
    const { data, error } = await supabase.from('business_settings').select('*').limit(1).maybeSingle();

    if (error) {
      handleSupabaseError(error, 'getBusinessSettings');
    }

    if (!data) {
      throw new SettingsServiceError('Business settings not found.', 'NOT_FOUND');
    }

    return data as BusinessSettings;
  } catch (error) {
    if (error instanceof SettingsServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getBusinessSettings');
  }
}

export async function updateBusinessSettings(
  id: string,
  data: UpdateBusinessSettingsRequest,
): Promise<BusinessSettings> {
  try {
    const { data: updated, error } = await supabase
      .from('business_settings')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new SettingsServiceError('Business settings not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updateBusinessSettings');
    }

    return updated as BusinessSettings;
  } catch (error) {
    if (error instanceof SettingsServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateBusinessSettings');
  }
}
