import { supabase } from '@/lib/supabase/client';
import {
  resolveProductPrice,
  type Customer,
  type Product,
  type PricingTier,
  type Quotation,
  type QuotationInsert,
  type QuotationUpdate,
  type QuotationItem,
  type QuotationItemInsert,
  type QuotationStatus,
} from '@/types/database.types';

export type QuotationFilters = {
  status?: QuotationStatus | 'all';
  customerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type QuotationListResponse = {
  quotations: Quotation[];
  totalCount: number;
};

export type QuotationWithDetails = Quotation & {
  items: QuotationItem[];
  customer?: Customer;
  stock_location?: { id: string; name: string };
  converted_invoice?: { id: string; invoice_number: string } | null;
};

export type CreateQuotationRequest = {
  customer_id: string;
  stock_location_id: string;
  items: Array<{ product_id: string; quantity: number }>;
  quotation_date?: string;
  valid_until?: string;
  tax_amount?: number;
  notes?: string | null;
  terms?: string | null;
};

export type UpdateQuotationRequest = {
  customer_id?: string;
  stock_location_id?: string;
  quotation_date?: string;
  valid_until?: string;
  tax_amount?: number;
  notes?: string | null;
  terms?: string | null;
  items?: Array<{ product_id: string; quantity: number }>;
};

export type ConvertQuotationResult = {
  invoice_id: string;
};

class QuotationServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'QuotationServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };

    switch (supabaseError.code) {
      case '23505':
        throw new QuotationServiceError('This quotation already exists.', 'DUPLICATE');

      case '23503':
        throw new QuotationServiceError(
          'Invalid reference: the customer or product does not exist.',
          'FOREIGN_KEY',
        );

      case '23514':
        throw new QuotationServiceError(
          'Invalid data: a value violates a database constraint.',
          'CHECK_VIOLATION',
        );

      case 'P0001': {
        const message = supabaseError.message || 'Operation rejected by a business rule.';
        if (/not a draft/i.test(message)) {
          throw new QuotationServiceError(message, 'NOT_DRAFT');
        }
        if (/already converted/i.test(message)) {
          throw new QuotationServiceError(message, 'ALREADY_CONVERTED');
        }
        if (/no items/i.test(message)) {
          throw new QuotationServiceError(message, 'NO_ITEMS');
        }
        if (/cannot change status/i.test(message)) {
          throw new QuotationServiceError(message, 'CONVERTED_LOCKED');
        }
        throw new QuotationServiceError(message, 'BUSINESS_RULE');
      }

      case 'PGRST116':
        throw new QuotationServiceError('Quotation not found.', 'NOT_FOUND');

      default:
        throw new QuotationServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new QuotationServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getQuotations(
  filters: QuotationFilters = {},
): Promise<QuotationListResponse> {
  try {
    let query = supabase
      .from('quotations')
      .select('*', { count: 'exact' })
      .order('quotation_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters.dateFrom) {
      query = query.gte('quotation_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('quotation_date', filters.dateTo);
    }

    if (filters.search && filters.search.trim()) {
      query = query.ilike('quotation_number', `%${filters.search.trim()}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      handleSupabaseError(error, 'getQuotations');
    }

    return {
      quotations: data || [],
      totalCount: count || 0,
    };
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getQuotations');
  }
}

export async function getQuotationById(id: string): Promise<QuotationWithDetails> {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select(
        '*, items:quotation_items(*), customer:customers(*), stock_location:stock_locations(id, name), converted_invoice:invoices(id, invoice_number)',
      )
      .eq('id', id)
      .single();

    if (error) {
      handleSupabaseError(error, 'getQuotationById');
    }

    const row = data as unknown as Quotation & {
      items: QuotationItem[] | null;
      customer: Customer | null;
      stock_location: { id: string; name: string } | null;
      converted_invoice: { id: string; invoice_number: string } | null;
    };

    const { items, customer, stock_location, converted_invoice, ...quotation } = row;

    return {
      ...quotation,
      items: items ?? [],
      customer: customer ?? undefined,
      stock_location: stock_location ?? undefined,
      converted_invoice: converted_invoice ?? null,
    };
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getQuotationById');
  }
}

export async function createQuotation(
  request: CreateQuotationRequest,
): Promise<QuotationWithDetails> {
  try {
    if (!request.items || request.items.length === 0) {
      throw new QuotationServiceError('A quotation must contain at least one item.', 'NO_ITEMS');
    }

    // 1. Snapshot membership data from the customer.
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', request.customer_id)
      .single();

    if (customerError) {
      handleSupabaseError(customerError, 'createQuotation');
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
      handleSupabaseError(productsError, 'createQuotation');
    }

    const productMap = new Map((productsData as Product[]).map((product) => [product.id, product]));

    // 3. Validate: products must exist. Active check is soft — quotations may quote
    //    products that are about to be retired; conversion will re-validate.
    for (const id of productIds) {
      const product = productMap.get(id);
      if (!product) {
        throw new QuotationServiceError(`Product ${id} not found.`, 'NOT_FOUND');
      }
    }

    // 4. Insert the quotation header (number/totals/status are DB-managed).
    const quotationInsert: QuotationInsert = {
      customer_id: request.customer_id,
      stock_location_id: request.stock_location_id,
      customer_type: customer.customer_type,
      pricing_tier: tier,
      tax_amount: request.tax_amount ?? 0,
      quotation_date: request.quotation_date,
      valid_until: request.valid_until,
      notes: request.notes ?? null,
      terms: request.terms ?? null,
    };

    const { data: quotationData, error: quotationError } = await supabase
      .from('quotations')
      .insert(quotationInsert)
      .select()
      .single();

    if (quotationError) {
      handleSupabaseError(quotationError, 'createQuotation');
    }

    const quotationId = (quotationData as Quotation).id;

    // 5. Insert line items with full product snapshots.
    const itemsInsert: QuotationItemInsert[] = request.items.map((item) => {
      const product = productMap.get(item.product_id) as Product;
      return {
        quotation_id: quotationId,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        unit_price: resolveProductPrice(product, tier),
        unit_vp: product.volume_points,
        quantity: item.quantity,
      };
    });

    const { error: itemsError } = await supabase.from('quotation_items').insert(itemsInsert);

    if (itemsError) {
      // Best-effort rollback: remove the header so we never persist an empty quotation.
      await supabase.from('quotations').delete().eq('id', quotationId);
      handleSupabaseError(itemsError, 'createQuotation');
    }

    // 6. Triggers have recomputed totals; return the full record.
    return await getQuotationById(quotationId);
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'createQuotation');
  }
}

export async function updateQuotation(
  id: string,
  request: UpdateQuotationRequest,
): Promise<QuotationWithDetails> {
  try {
    // Re-fetch the existing quotation so we can preserve membership snapshot
    // when the customer hasn't changed, and re-snapshot when it has.
    const existing = await getQuotationById(id);

    if (existing.status !== 'draft') {
      throw new QuotationServiceError(
        'Only draft quotations can be edited.',
        'NOT_DRAFT',
      );
    }

    const customerId = request.customer_id ?? existing.customer_id;
    const stockLocationId = request.stock_location_id ?? existing.stock_location_id;

    let customerType = existing.customer_type;
    let pricingTier = existing.pricing_tier;

    if (request.customer_id && request.customer_id !== existing.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', request.customer_id)
        .single();

      if (customerError) {
        handleSupabaseError(customerError, 'updateQuotation');
      }

      const customer = customerData as Customer;
      customerType = customer.customer_type;
      pricingTier = customer.pricing_tier;
    }

    const updatePayload: QuotationUpdate = {
      customer_id: customerId,
      stock_location_id: stockLocationId,
      customer_type: customerType,
      pricing_tier: pricingTier,
      quotation_date: request.quotation_date,
      valid_until: request.valid_until,
      tax_amount: request.tax_amount,
      notes: request.notes ?? null,
      terms: request.terms ?? null,
    };

    const { error: updateError } = await supabase
      .from('quotations')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      handleSupabaseError(updateError, 'updateQuotation');
    }

    // Replace line items when provided.
    if (request.items) {
      if (request.items.length === 0) {
        throw new QuotationServiceError(
          'A quotation must contain at least one item.',
          'NO_ITEMS',
        );
      }

      // Resolve product snapshots against the (possibly new) pricing tier.
      const productIds = [...new Set(request.items.map((item) => item.product_id))];
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (productsError) {
        handleSupabaseError(productsError, 'updateQuotation');
      }

      const productMap = new Map(
        (productsData as Product[]).map((product) => [product.id, product]),
      );

      for (const productId of productIds) {
        if (!productMap.has(productId)) {
          throw new QuotationServiceError(`Product ${productId} not found.`, 'NOT_FOUND');
        }
      }

      // Wipe existing items (allowed by RLS while status = draft) and re-insert.
      const { error: deleteError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', id);

      if (deleteError) {
        handleSupabaseError(deleteError, 'updateQuotation');
      }

      const itemsInsert: QuotationItemInsert[] = request.items.map((item) => {
        const product = productMap.get(item.product_id) as Product;
        return {
          quotation_id: id,
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit_price: resolveProductPrice(product, pricingTier),
          unit_vp: product.volume_points,
          quantity: item.quantity,
        };
      });

      const { error: itemsError } = await supabase
        .from('quotation_items')
        .insert(itemsInsert);

      if (itemsError) {
        handleSupabaseError(itemsError, 'updateQuotation');
      }
    }

    return await getQuotationById(id);
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateQuotation');
  }
}

export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus,
): Promise<Quotation> {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'updateQuotationStatus');
    }

    return data as Quotation;
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateQuotationStatus');
  }
}

export async function duplicateQuotation(id: string): Promise<QuotationWithDetails> {
  try {
    const source = await getQuotationById(id);

    if (source.items.length === 0) {
      throw new QuotationServiceError(
        'Cannot duplicate a quotation with no items.',
        'NO_ITEMS',
      );
    }

    // Re-resolve product snapshots so the duplicate reflects current catalog data
    // (price/VP may have changed since the original was created).
    const productIds = [...new Set(source.items.map((item) => item.product_id).filter(Boolean))] as string[];
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (productsError) {
      handleSupabaseError(productsError, 'duplicateQuotation');
    }

    const productMap = new Map((productsData as Product[]).map((product) => [product.id, product]));

    const duplicate: CreateQuotationRequest = {
      customer_id: source.customer_id,
      stock_location_id: source.stock_location_id,
      items: source.items
        .map((item) => {
          // Skip items whose product has been deleted (product_id becomes NULL
          // via ON DELETE SET NULL). The rest are re-resolved against the
          // current catalog so the duplicate reflects up-to-date prices/VP.
          if (!item.product_id) return null;
          const product = productMap.get(item.product_id);
          if (!product) return null;
          return {
            product_id: product.id,
            quantity: item.quantity,
          };
        })
        .filter((item): item is { product_id: string; quantity: number } => item !== null),
      tax_amount: Number(source.tax_amount),
      notes: source.notes,
      terms: source.terms,
      valid_until: undefined, // fresh 30-day window from server default
    };

    if (duplicate.items.length === 0) {
      throw new QuotationServiceError(
        'All products on this quotation have been deleted and cannot be duplicated.',
        'NO_ITEMS',
      );
    }

    return await createQuotation(duplicate);
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'duplicateQuotation');
  }
}

export async function convertQuotationToInvoice(
  id: string,
): Promise<ConvertQuotationResult> {
  try {
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: 'convert_quotation_to_invoice',
        args: { p_quotation_id: string },
      ) => Promise<{
        data: string | null;
        error: { code?: string; message?: string; details?: unknown } | null;
      }>
    )('convert_quotation_to_invoice', { p_quotation_id: id });

    if (error) {
      handleSupabaseError(error, 'convertQuotationToInvoice');
    }

    if (!data) {
      throw new QuotationServiceError(
        'Conversion failed: no invoice id returned.',
        'CONVERSION_FAILED',
      );
    }

    return { invoice_id: data };
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'convertQuotationToInvoice');
  }
}

export async function deleteQuotation(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('quotations').delete().eq('id', id);

    if (error) {
      handleSupabaseError(error, 'deleteQuotation');
    }
  } catch (error) {
    if (error instanceof QuotationServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'deleteQuotation');
  }
}

export { QuotationServiceError };
