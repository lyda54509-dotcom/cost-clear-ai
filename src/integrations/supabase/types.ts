export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          recipient_email: string | null
          recipient_whatsapp: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          recipient_email?: string | null
          recipient_whatsapp?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          recipient_email?: string | null
          recipient_whatsapp?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          notes: string | null
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          ai_summary: string | null
          business_id: string
          created_at: string
          created_by: string | null
          gross_profit: number
          id: string
          net_profit: number
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["report_period"]
          sent_at: string | null
          top_items: Json | null
          total_cogs: number
          total_expenses: number
          total_revenue: number
        }
        Insert: {
          ai_summary?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          gross_profit?: number
          id?: string
          net_profit?: number
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["report_period"]
          sent_at?: string | null
          top_items?: Json | null
          total_cogs?: number
          total_expenses?: number
          total_revenue?: number
        }
        Update: {
          ai_summary?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          gross_profit?: number
          id?: string
          net_profit?: number
          period_end?: string
          period_start?: string
          period_type?: Database["public"]["Enums"]["report_period"]
          sent_at?: string | null
          top_items?: Json | null
          total_cogs?: number
          total_expenses?: number
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_entries: {
        Row: {
          business_id: string
          buying_price: number
          created_at: string
          entered_by: string | null
          entry_date: string
          id: string
          item_name: string
          quantity: number
          selling_price: number
        }
        Insert: {
          business_id: string
          buying_price: number
          created_at?: string
          entered_by?: string | null
          entry_date?: string
          id?: string
          item_name: string
          quantity: number
          selling_price: number
        }
        Update: {
          business_id?: string
          buying_price?: number
          created_at?: string
          entered_by?: string | null
          entry_date?: string
          id?: string
          item_name?: string
          quantity?: number
          selling_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          business_id: string
          created_at: string
          extracted_data: Json | null
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          reconciliation_note: string | null
          reconciliation_status: string | null
          upload_date: string
          upload_type: Database["public"]["Enums"]["upload_type"]
          uploaded_by: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          extracted_data?: Json | null
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          reconciliation_note?: string | null
          reconciliation_status?: string | null
          upload_date?: string
          upload_type?: Database["public"]["Enums"]["upload_type"]
          uploaded_by?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          extracted_data?: Json | null
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          reconciliation_note?: string | null
          reconciliation_status?: string | null
          upload_date?: string
          upload_type?: Database["public"]["Enums"]["upload_type"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _business: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _business: string; _user: string }; Returns: boolean }
      is_member: {
        Args: { _business: string; _user: string }
        Returns: boolean
      }
      my_business_id: { Args: { _user: string }; Returns: string }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
      report_period: "daily" | "monthly" | "annual"
      upload_type: "receipt" | "mpesa_statement"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff"],
      report_period: ["daily", "monthly", "annual"],
      upload_type: ["receipt", "mpesa_statement"],
    },
  },
} as const
