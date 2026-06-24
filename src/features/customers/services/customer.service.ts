import { supabase } from '@/lib/supabase/client';
import type { Customer, CustomerInsert, CustomerUpdate, CustomerType, PricingTier } from '@/types';

export type CustomerFilters = {
  status?: 'active' | 'inactive' | 'all';
  customerType?: CustomerType;
  pricingTier?: PricingTier;
  city?: string;
};

export type CustomerListResponse = {
  customers: Customer[];
  totalCount: number;
};

class CustomerServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CustomerServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };
    
    // Handle specific Postgres error codes
    switch (supabaseError.code) {
      case '23505':
        if (supabaseError.message.includes('customers_phone_unique')) {
          throw new CustomerServiceError(
            'A customer with this phone number already exists.',
            'PHONE_EXISTS',
          );
        }
        if (supabaseError.message.includes('customers_whatsapp_unique')) {
          throw new CustomerServiceError(
            'A customer with this WhatsApp number already exists.',
            'WHATSAPP_EXISTS',
          );
        }
        throw new CustomerServiceError('This customer information already exists.', 'DUPLICATE');
      
      case '23503':
        throw new CustomerServiceError('Invalid reference data provided.', 'FOREIGN_KEY');
      
      case '23514':
        throw new CustomerServiceError('Invalid data format provided.', 'CHECK_VIOLATION');
      
      default:
        throw new CustomerServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new CustomerServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getCustomers(filters: CustomerFilters = {}): Promise<CustomerListResponse> {
  try {
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.customerType) {
      query = query.eq('customer_type', filters.customerType);
    }

    if (filters.pricingTier) {
      query = query.eq('pricing_tier', filters.pricingTier);
    }

    if (filters.city) {
      query = query.eq('city', filters.city);
    }

    const { data, error, count } = await query;

    if (error) {
      handleSupabaseError(error, 'getCustomers');
    }

    return {
      customers: data || [],
      totalCount: count || 0,
    };
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getCustomers');
  }
}

export async function getCustomerById(id: string): Promise<Customer> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new CustomerServiceError('Customer not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'getCustomerById');
    }

    return data;
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getCustomerById');
  }
}

export async function createCustomer(customerData: CustomerInsert): Promise<Customer> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'createCustomer');
    }

    return data;
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'createCustomer');
  }
}

export async function updateCustomer(id: string, customerData: CustomerUpdate): Promise<Customer> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update(customerData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new CustomerServiceError('Customer not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updateCustomer');
    }

    return data;
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateCustomer');
  }
}

export async function deactivateCustomer(id: string): Promise<Customer> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new CustomerServiceError('Customer not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'deactivateCustomer');
    }

    return data;
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'deactivateCustomer');
  }
}

export async function searchCustomers(searchTerm: string): Promise<Customer[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const trimmedTerm = searchTerm.trim();
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${trimmedTerm}%,phone.ilike.%${trimmedTerm}%,whatsapp_number.ilike.%${trimmedTerm}%,email.ilike.%${trimmedTerm}%`)
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(50);

    if (error) {
      handleSupabaseError(error, 'searchCustomers');
    }

    return data || [];
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'searchCustomers');
  }
}