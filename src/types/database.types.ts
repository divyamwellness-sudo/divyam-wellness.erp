export type Gender = 'male' | 'female' | 'other';

export type CustomerGoal =
  | 'weight_loss'
  | 'weight_gain'
  | 'maintenance'
  | 'muscle_gain'
  | 'general_wellness';

export type PricingTier = 'MRP' | '25' | '35' | '42' | '50';

export type CustomerStatus = 'active' | 'inactive';

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
          email: string | null;
          address: string | null;
          gstin: string | null;
          invoice_prefix: string;
          next_invoice_number: number;
          currency: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          gstin?: string | null;
          invoice_prefix?: string;
          next_invoice_number?: number;
          currency?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          gstin?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type BusinessSettings = Database['public']['Tables']['business_settings']['Row'];

export type Customer = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type WeightLogInsert = Database['public']['Tables']['weight_logs']['Insert'];
export type WeightLogUpdate = Database['public']['Tables']['weight_logs']['Update'];