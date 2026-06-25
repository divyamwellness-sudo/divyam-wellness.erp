export type Gender = 'male' | 'female' | 'other';

export type CustomerGoal =
  | 'weight_loss'
  | 'weight_gain'
  | 'maintenance'
  | 'muscle_gain'
  | 'general_wellness';

export type CustomerType = 'pc' | 'coach';

export type PricingTier = 'MRP' | '15' | '25' | '35' | '42' | '50';

export type CustomerStatus = 'active' | 'inactive';

export const TIERS_BY_CUSTOMER_TYPE: Record<CustomerType, PricingTier[]> = {
  pc: ['MRP', '15', '25', '35'],
  coach: ['MRP', '25', '35', '42', '50'],
};

export type ProductCategory =
  | 'shakes'
  | 'protein'
  | 'tea_energy'
  | 'supplements'
  | 'vitamins'
  | 'skincare'
  | 'accessories'
  | 'other';

export type InvoiceStatus = 'created' | 'partial' | 'paid' | 'cancelled';

export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'card';

export type PaymentStatus = 'POSTED' | 'REVERSED';

/**
 * Maps a pricing tier to the product price column that holds its price.
 * Single source of truth shared by the catalog UI and the future Billing module.
 * Because price is keyed by tier value alone, PC and Coach automatically share
 * the price for tiers 25 and 35.
 */
export const PRICE_FIELD_BY_TIER: Record<
  PricingTier,
  'mrp_price' | 'price_15' | 'price_25' | 'price_35' | 'price_42' | 'price_50'
> = {
  MRP: 'mrp_price',
  '15': 'price_15',
  '25': 'price_25',
  '35': 'price_35',
  '42': 'price_42',
  '50': 'price_50',
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_settings: {
        Row: {
          id: string;
          business_name: string;
          phone: string | null;
          whatsapp_number: string | null;
          email: string | null;
          address: string | null;
          gstin: string | null;
          logo_url: string | null;
          invoice_prefix: string;
          next_invoice_number: number;
          currency: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name?: string;
          phone?: string | null;
          whatsapp_number?: string | null;
          email?: string | null;
          address?: string | null;
          gstin?: string | null;
          logo_url?: string | null;
          invoice_prefix?: string;
          next_invoice_number?: number;
          currency?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          phone?: string | null;
          whatsapp_number?: string | null;
          email?: string | null;
          address?: string | null;
          gstin?: string | null;
          logo_url?: string | null;
          invoice_prefix?: string;
          next_invoice_number?: number;
          currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          whatsapp_number: string | null;
          email: string | null;
          gender: Gender | null;
          date_of_birth: string | null;
          city: string | null;
          address: string | null;
          joining_date: string;
          height_cm: number | null;
          starting_weight: number | null;
          current_weight: number | null;
          target_weight: number | null;
          goal: CustomerGoal | null;
          customer_type: CustomerType;
          pricing_tier: PricingTier;
          notes: string | null;
          status: CustomerStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          whatsapp_number?: string | null;
          email?: string | null;
          gender?: Gender | null;
          date_of_birth?: string | null;
          city?: string | null;
          address?: string | null;
          joining_date?: string;
          height_cm?: number | null;
          starting_weight?: number | null;
          current_weight?: number | null;
          target_weight?: number | null;
          goal?: CustomerGoal | null;
          customer_type?: CustomerType;
          pricing_tier?: PricingTier;
          notes?: string | null;
          status?: CustomerStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          whatsapp_number?: string | null;
          email?: string | null;
          gender?: Gender | null;
          date_of_birth?: string | null;
          city?: string | null;
          address?: string | null;
          joining_date?: string;
          height_cm?: number | null;
          starting_weight?: number | null;
          current_weight?: number | null;
          target_weight?: number | null;
          goal?: CustomerGoal | null;
          customer_type?: CustomerType;
          pricing_tier?: PricingTier;
          notes?: string | null;
          status?: CustomerStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      weight_logs: {
        Row: {
          id: string;
          customer_id: string;
          weight_kg: number;
          body_fat_percentage: number | null;
          bmi: number | null;
          visceral_fat: number | null;
          muscle_mass: number | null;
          bmr: number | null;
          metabolic_age: number | null;
          tsf: number | null;
          recorded_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          weight_kg: number;
          body_fat_percentage?: number | null;
          bmi?: number | null;
          visceral_fat?: number | null;
          muscle_mass?: number | null;
          bmr?: number | null;
          metabolic_age?: number | null;
          tsf?: number | null;
          recorded_date: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          weight_kg?: number;
          body_fat_percentage?: number | null;
          bmi?: number | null;
          visceral_fat?: number | null;
          muscle_mass?: number | null;
          bmr?: number | null;
          metabolic_age?: number | null;
          tsf?: number | null;
          recorded_date?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weight_logs_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'weight_logs_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          name: string;
          sku: string;
          category: ProductCategory;
          mrp_price: number;
          price_15: number;
          price_25: number;
          price_35: number;
          price_42: number;
          price_50: number;
          volume_points: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sku: string;
          category?: ProductCategory;
          mrp_price: number;
          price_15?: number;
          price_25?: number;
          price_35?: number;
          price_42?: number;
          price_50?: number;
          volume_points?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sku?: string;
          category?: ProductCategory;
          mrp_price?: number;
          price_15?: number;
          price_25?: number;
          price_35?: number;
          price_42?: number;
          price_50?: number;
          volume_points?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_locations: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          is_active: boolean;
          is_default: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          is_active?: boolean;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string | null;
          is_active?: boolean;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          customer_id: string;
          customer_type: CustomerType;
          pricing_tier: PricingTier;
          subtotal: number;
          total_vp: number;
          tax_amount: number;
          total_amount: number;
          paid_amount: number;
          due_amount: number;
          status: InvoiceStatus;
          invoice_date: string;
          due_date: string;
          notes: string | null;
          stock_location_id: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number?: string;
          customer_id: string;
          customer_type: CustomerType;
          pricing_tier: PricingTier;
          subtotal?: number;
          total_vp?: number;
          tax_amount?: number;
          total_amount?: number;
          paid_amount?: number;
          due_amount?: number;
          status?: InvoiceStatus;
          invoice_date?: string;
          due_date?: string;
          notes?: string | null;
          stock_location_id: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          customer_id?: string;
          customer_type?: CustomerType;
          pricing_tier?: PricingTier;
          subtotal?: number;
          total_vp?: number;
          tax_amount?: number;
          total_amount?: number;
          paid_amount?: number;
          due_amount?: number;
          status?: InvoiceStatus;
          invoice_date?: string;
          due_date?: string;
          notes?: string | null;
          stock_location_id?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_stock_location_id_fkey';
            columns: ['stock_location_id'];
            referencedRelation: 'stock_locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          product_id: string | null;
          product_name: string;
          product_sku: string;
          unit_price: number;
          unit_vp: number;
          quantity: number;
          line_total: number;
          line_vp: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          product_id?: string | null;
          product_name: string;
          product_sku: string;
          unit_price: number;
          unit_vp?: number;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_sku?: string;
          unit_price?: number;
          unit_vp?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_items_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_reversals: {
        Row: {
          id: string;
          payment_id: string;
          invoice_id: string;
          amount: number;
          payment_method: string;
          payment_date: string;
          reference_num: string | null;
          reversed_at: string;
          reversed_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          payment_id: string;
          invoice_id: string;
          amount: number;
          payment_method: string;
          payment_date: string;
          reference_num?: string | null;
          reversed_at?: string;
          reversed_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          payment_id?: string;
          invoice_id?: string;
          amount?: number;
          payment_method?: string;
          payment_date?: string;
          reference_num?: string | null;
          reversed_at?: string;
          reversed_by?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_reversals_payment_id_fkey';
            columns: ['payment_id'];
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_reversals_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date: string;
          reference_num: string | null;
          notes: string | null;
          status: PaymentStatus;
          reversed_at: string | null;
          reversed_by: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date?: string;
          reference_num?: string | null;
          notes?: string | null;
          status?: PaymentStatus;
          reversed_at?: string | null;
          reversed_by?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          amount?: number;
          payment_method?: PaymentMethod;
          payment_date?: string;
          reference_num?: string | null;
          notes?: string | null;
          status?: PaymentStatus;
          reversed_at?: string | null;
          reversed_by?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_invoice_id_fkey';
            columns: ['invoice_id'];
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type BusinessSettings = Database['public']['Tables']['business_settings']['Row'];
export type BusinessSettingsUpdate = Database['public']['Tables']['business_settings']['Update'];

export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type WeightLogInsert = Database['public']['Tables']['weight_logs']['Insert'];
export type WeightLogUpdate = Database['public']['Tables']['weight_logs']['Update'];

export type Product = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];

export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceInsert = Database['public']['Tables']['invoices']['Insert'];
export type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];
export type InvoiceItemInsert = Database['public']['Tables']['invoice_items']['Insert'];
export type InvoiceItemUpdate = Database['public']['Tables']['invoice_items']['Update'];

export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export type PaymentReversal = Database['public']['Tables']['payment_reversals']['Row'];

/** Resolves the price of a product for a given pricing tier. */
export function resolveProductPrice(product: Product, tier: PricingTier): number {
  return product[PRICE_FIELD_BY_TIER[tier]];
}