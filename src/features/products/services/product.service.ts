import { supabase } from '@/lib/supabase/client';
import type { Product, ProductInsert, ProductUpdate, ProductCategory } from '@/types';

export type ProductFilters = {
  status?: 'active' | 'inactive' | 'all';
  category?: ProductCategory;
};

export type ProductListResponse = {
  products: Product[];
  totalCount: number;
};

class ProductServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ProductServiceError';
  }
}

function handleSupabaseError(error: unknown, context: string): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const supabaseError = error as { code: string; message: string; details?: unknown };

    switch (supabaseError.code) {
      case '23505':
        if (supabaseError.message.includes('products_sku_unique')) {
          throw new ProductServiceError('A product with this SKU already exists.', 'SKU_EXISTS');
        }
        throw new ProductServiceError('This product already exists.', 'DUPLICATE');

      case '23514':
        throw new ProductServiceError('Invalid data format provided.', 'CHECK_VIOLATION');

      default:
        throw new ProductServiceError(
          `Database error in ${context}: ${supabaseError.message}`,
          supabaseError.code,
          supabaseError.details,
        );
    }
  }

  throw new ProductServiceError(`Unexpected error in ${context}: ${String(error)}`);
}

export async function getProducts(filters: ProductFilters = {}): Promise<ProductListResponse> {
  try {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true });

    if (filters.status === 'active') {
      query = query.eq('is_active', true);
    } else if (filters.status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error, count } = await query;

    if (error) {
      handleSupabaseError(error, 'getProducts');
    }

    return {
      products: data || [],
      totalCount: count || 0,
    };
  } catch (error) {
    if (error instanceof ProductServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getProducts');
  }
}

export async function getProductById(id: string): Promise<Product> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ProductServiceError('Product not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'getProductById');
    }

    return data;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'getProductById');
  }
}

export async function createProduct(productData: ProductInsert): Promise<Product> {
  try {
    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'createProduct');
    }

    return data;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'createProduct');
  }
}

export async function updateProduct(id: string, productData: ProductUpdate): Promise<Product> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ProductServiceError('Product not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'updateProduct');
    }

    return data;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'updateProduct');
  }
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<Product> {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ProductServiceError('Product not found.', 'NOT_FOUND');
      }
      handleSupabaseError(error, 'toggleProductActive');
    }

    return data;
  } catch (error) {
    if (error instanceof ProductServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'toggleProductActive');
  }
}

export async function searchProducts(searchTerm: string): Promise<Product[]> {
  try {
    if (!searchTerm.trim()) {
      return [];
    }

    const trimmedTerm = searchTerm.trim();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${trimmedTerm}%,sku.ilike.%${trimmedTerm}%`)
      .order('name', { ascending: true })
      .limit(50);

    if (error) {
      handleSupabaseError(error, 'searchProducts');
    }

    return data || [];
  } catch (error) {
    if (error instanceof ProductServiceError) {
      throw error;
    }
    handleSupabaseError(error, 'searchProducts');
  }
}
