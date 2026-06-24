import { supabase } from '@/lib/supabase/client';
import {
  resolveProductPrice,
  type Customer,
  type Product,
  type PricingTier,
  type Invoice,
  type InvoiceInsert,
  type InvoiceUpdate,
  type InvoiceItem,
  type InvoiceItemInsert,
  type Payment,
} from '@/types/database.types';

export type InvoiceFilters = {
  status?: 'created' | 'partial' | 'paid' | 'cancelled' | 'all';
  customerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type InvoiceListResponse = {
  invoices: Invoice[];
  totalCount: number;
};

export type InvoiceWithDetails = Invoice & {
  items: InvoiceItem[];
  payments: Payment[];
  customer?: Customer;
  stock_location?: { id: string; name: string };
};

export type CreateInvoiceRequest = {
  customer_id: string;
  stock_location_id: string;
  items: Array<{ product_id: string; quantity: number }>;
  invoice_date?: string;
  due_date?: string;
  tax_amount?: number;
  notes?: string | null;
};

class InvoiceServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'InvoiceServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };

    switch (supabaseError.code) {
      case '23505':
        throw new InvoiceServiceError('This invoice already exists.', 'DUPLICATE');

      case '23503':
        throw new InvoiceServiceError(
          'Invalid reference: the customer or product does not exist.',
          'FOREIGN_KEY',
        );

      case '23514':
        throw new InvoiceServiceError('Invalid data: a value violates a database constraint.', 'CHECK_VIOLATION');

      case 'P0001': {
        const message = supabaseError.message || 'Operation rejected by a business rule.';
        if (/INSUFFICIENT_STOCK/i.test(message)) {
          throw new InvoiceServiceError(
            message.replace(/^INSUFFICIENT_STOCK:\s*/i, ''),
            'INSUFFICIENT_STOCK',
          );
        }
        if (/exceeds amount due/i.test(message)) {
          throw new InvoiceServiceError(message, 'OVERPAYMENT');
        }
        if (/cancelled/i.test(message)) {
          throw new InvoiceServiceError(message, 'INVOICE_CANCELLED');
        }
        throw new InvoiceServiceError(message, 'BUSINESS_RULE');
      }

      default:
        throw new InvoiceServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new InvoiceServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getInvoices(filters: InvoiceFilters = {}): Promise<InvoiceListResponse> {
  try {
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters.dateFrom) {
      query = query.gte('invoice_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('invoice_date', filters.dateTo);
    }

    if (filters.search && filters.search.trim()) {
      query = query.ilike('invoice_number', `%${filters.search.trim()}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      handleSupabaseError(error, 'getInvoices');
    }

    return {
      invoices: data || [],
      totalCount: count || 0,
    };
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getInvoices');
  }
}

export async function getInvoiceById(id: string): Promise<InvoiceWithDetails> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*), payments(*), customer:customers(*), stock_location:stock_locations(id, name)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new InvoiceServiceError('Invoice not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'getInvoiceById');
    }

    const row = data as unknown as Invoice & {
      items: InvoiceItem[] | null;
      payments: Payment[] | null;
      customer: Customer | null;
      stock_location: { id: string; name: string } | null;
    };

    const { items, payments, customer, stock_location, ...invoice } = row;

    return {
      ...invoice,
      items: items ?? [],
      payments: payments ?? [],
      customer: customer ?? undefined,
      stock_location: stock_location ?? undefined,
    };
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getInvoiceById');
  }
}

export async function createInvoice(request: CreateInvoiceRequest): Promise<InvoiceWithDetails> {
  try {
    if (!request.items || request.items.length === 0) {
      throw new InvoiceServiceError('An invoice must contain at least one item.', 'NO_ITEMS');
    }

    // 1. Snapshot membership data from the customer.
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', request.customer_id)
      .single();

    if (customerError) {
      if (customerError.code === 'PGRST116') {
        throw new InvoiceServiceError('Customer not found.', 'NOT_FOUND');
      }
      handleSupabaseError(customerError, 'createInvoice');
    }

    const customer = customerData as Customer;
    const tier: PricingTier = customer.pricing_tier;

    // 2. Load every referenced product in one query.
    const productIds = [...new Set(request.items.map((item) => item.product_id))];
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (productsError) {
      handleSupabaseError(productsError, 'createInvoice');
    }

    const productMap = new Map((productsData as Product[]).map((product) => [product.id, product]));

    // 3. Validate: products must exist and be active.
    for (const id of productIds) {
      const product = productMap.get(id);
      if (!product) {
        throw new InvoiceServiceError(`Product ${id} not found.`, 'NOT_FOUND');
      }
      if (!product.is_active) {
        throw new InvoiceServiceError(
          `Product "${product.name}" is inactive and cannot be invoiced.`,
          'PRODUCT_INACTIVE',
        );
      }
    }

    // 4. Insert the invoice header (number/totals/status are DB-managed).
    const invoiceInsert: InvoiceInsert = {
      customer_id: request.customer_id,
      stock_location_id: request.stock_location_id,
      customer_type: customer.customer_type,
      pricing_tier: tier,
      tax_amount: request.tax_amount ?? 0,
      invoice_date: request.invoice_date,
      due_date: request.due_date,
      notes: request.notes ?? null,
    };

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceInsert)
      .select()
      .single();

    if (invoiceError) {
      handleSupabaseError(invoiceError, 'createInvoice');
    }

    const invoiceId = (invoiceData as Invoice).id;

    // 5. Insert line items with full product snapshots.
    const itemsInsert: InvoiceItemInsert[] = request.items.map((item) => {
      const product = productMap.get(item.product_id) as Product;
      return {
        invoice_id: invoiceId,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        unit_price: resolveProductPrice(product, tier),
        unit_vp: product.volume_points,
        quantity: item.quantity,
      };
    });

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemsInsert);

    if (itemsError) {
      // Best-effort rollback: remove the header so we never persist an empty invoice.
      await supabase.from('invoices').delete().eq('id', invoiceId);
      handleSupabaseError(itemsError, 'createInvoice');
    }

    // 6. Triggers have recomputed totals; return the full record.
    return await getInvoiceById(invoiceId);
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'createInvoice');
  }
}

export async function updateInvoice(id: string, data: InvoiceUpdate): Promise<Invoice> {
  try {
    const { data: updated, error } = await supabase
      .from('invoices')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new InvoiceServiceError('Invoice not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updateInvoice');
    }

    // Tax changes do not fire the item/payment sync triggers, so recompute now
    // to immediately refresh total_amount, due_amount and status.
    if (data.tax_amount !== undefined) {
      const { error: rpcError } = await (
        supabase.rpc as unknown as (
          fn: 'recompute_invoice',
          args: { p_invoice_id: string },
        ) => Promise<{ error: { code?: string; message?: string } | null }>
      )('recompute_invoice', { p_invoice_id: id });

      if (rpcError) {
        handleSupabaseError(rpcError, 'updateInvoice');
      }

      const { data: fresh, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        handleSupabaseError(fetchError, 'updateInvoice');
      }

      return fresh as Invoice;
    }

    return updated as Invoice;
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateInvoice');
  }
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new InvoiceServiceError('Invoice not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'cancelInvoice');
    }

    return data as Invoice;
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'cancelInvoice');
  }
}

export async function addInvoiceItem(
  invoiceId: string,
  productId: string,
  quantity: number,
): Promise<InvoiceItem> {
  try {
    // The line price is resolved against the invoice's snapshotted tier.
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('pricing_tier')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      if (invoiceError.code === 'PGRST116') {
        throw new InvoiceServiceError('Invoice not found.', 'NOT_FOUND');
      }
      handleSupabaseError(invoiceError, 'addInvoiceItem');
    }

    const tier = (invoiceData as { pricing_tier: PricingTier }).pricing_tier;

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError) {
      if (productError.code === 'PGRST116') {
        throw new InvoiceServiceError('Product not found.', 'NOT_FOUND');
      }
      handleSupabaseError(productError, 'addInvoiceItem');
    }

    const product = productData as Product;

    if (!product.is_active) {
      throw new InvoiceServiceError(
        `Product "${product.name}" is inactive and cannot be invoiced.`,
        'PRODUCT_INACTIVE',
      );
    }

    const itemInsert: InvoiceItemInsert = {
      invoice_id: invoiceId,
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      unit_price: resolveProductPrice(product, tier),
      unit_vp: product.volume_points,
      quantity,
    };

    const { data, error } = await supabase
      .from('invoice_items')
      .insert(itemInsert)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'addInvoiceItem');
    }

    return data as InvoiceItem;
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'addInvoiceItem');
  }
}

export async function updateInvoiceItem(itemId: string, quantity: number): Promise<InvoiceItem> {
  try {
    const { data, error } = await supabase
      .from('invoice_items')
      .update({ quantity })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new InvoiceServiceError('Invoice item not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updateInvoiceItem');
    }

    return data as InvoiceItem;
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateInvoiceItem');
  }
}

export async function removeInvoiceItem(itemId: string): Promise<void> {
  try {
    const { error } = await supabase.from('invoice_items').delete().eq('id', itemId);

    if (error) {
      handleSupabaseError(error, 'removeInvoiceItem');
    }
  } catch (error) {
    if (error instanceof InvoiceServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'removeInvoiceItem');
  }
}
