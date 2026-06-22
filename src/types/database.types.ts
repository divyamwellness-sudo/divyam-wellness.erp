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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type BusinessSettings = Database['public']['Tables']['business_settings']['Row'];
