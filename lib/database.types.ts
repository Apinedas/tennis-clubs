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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      booking: {
        Row: {
          club_id: string
          coach_id: string | null
          court_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          guest_name: string | null
          id: string
          notes: string | null
          person_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          type: Database["public"]["Enums"]["booking_type"] | null
        }
        Insert: {
          club_id: string
          coach_id?: string | null
          court_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          guest_name?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["booking_type"] | null
        }
        Update: {
          club_id?: string
          coach_id?: string | null
          court_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          guest_name?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["booking_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_coach_fk"
            columns: ["coach_id", "club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
          {
            foreignKeyName: "booking_court_fk"
            columns: ["court_id", "club_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "booking_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_person_fk"
            columns: ["person_id", "club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
        ]
      }
      club: {
        Row: {
          brand_color: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          id: string
          logo_url: string | null
          name: string
          open_registration: boolean
          slug: string
          timezone: string
        }
        Insert: {
          brand_color?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name: string
          open_registration?: boolean
          slug: string
          timezone?: string
        }
        Update: {
          brand_color?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name?: string
          open_registration?: boolean
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      club_module: {
        Row: {
          active: boolean
          club_id: string
          module: Database["public"]["Enums"]["club_module_name"]
          platform_only: boolean
        }
        Insert: {
          active?: boolean
          club_id: string
          module: Database["public"]["Enums"]["club_module_name"]
          platform_only?: boolean
        }
        Update: {
          active?: boolean
          club_id?: string
          module?: Database["public"]["Enums"]["club_module_name"]
          platform_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "club_module_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
        ]
      }
      court: {
        Row: {
          active: boolean
          club_id: string
          id: string
          name: string
          surface: string | null
        }
        Insert: {
          active?: boolean
          club_id: string
          id?: string
          name: string
          surface?: string | null
        }
        Update: {
          active?: boolean
          club_id?: string
          id?: string
          name?: string
          surface?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation: {
        Row: {
          club_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          roles: Database["public"]["Enums"]["club_role"][]
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          roles: Database["public"]["Enums"]["club_role"][]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          roles?: Database["public"]["Enums"]["club_role"][]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          active: boolean
          club_id: string
          created_at: string
          member_number: string | null
          person_id: string
          roles: Database["public"]["Enums"]["club_role"][]
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          member_number?: string | null
          person_id: string
          roles: Database["public"]["Enums"]["club_role"][]
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          member_number?: string | null
          person_id?: string
          roles?: Database["public"]["Enums"]["club_role"][]
        }
        Relationships: [
          {
            foreignKeyName: "membership_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      person: {
        Row: {
          active_club_id: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          active_club_id?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          active_club_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_active_club_fk"
            columns: ["id", "active_club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
        ]
      }
      platform_admin: {
        Row: {
          created_at: string
          person_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admin_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      rate: {
        Row: {
          category: Database["public"]["Enums"]["rate_category"]
          club_id: string
          court_id: string | null
          end_time: string
          id: string
          name: string
          price_cop: number
          start_time: string
          weekdays: number[]
        }
        Insert: {
          category: Database["public"]["Enums"]["rate_category"]
          club_id: string
          court_id?: string | null
          end_time: string
          id?: string
          name: string
          price_cop: number
          start_time: string
          weekdays?: number[]
        }
        Update: {
          category?: Database["public"]["Enums"]["rate_category"]
          club_id?: string
          court_id?: string | null
          end_time?: string
          id?: string
          name?: string
          price_cop?: number
          start_time?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "rate_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_court_fk"
            columns: ["court_id", "club_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id", "club_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      access_token_hook: { Args: { event: Json }; Returns: Json }
      cancel_booking: { Args: { p_id: string }; Returns: undefined }
      join_club: { Args: { p_slug: string }; Returns: string }
      public_club: {
        Args: { p_slug: string }
        Returns: {
          name: string
          open_registration: boolean
        }[]
      }
      view_invitation: {
        Args: { p_token: string }
        Returns: {
          club_name: string
          email: string
          roles: Database["public"]["Enums"]["club_role"][]
        }[]
      }
    }
    Enums: {
      booking_status: "confirmed" | "cancelled" | "blocked"
      booking_type: "singles" | "doubles" | "lesson"
      club_module_name:
        | "bookings"
        | "lessons"
        | "dynamic_pricing"
        | "tournaments"
      club_role: "admin" | "coach" | "student"
      rate_category: "member" | "non_member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: ["confirmed", "cancelled", "blocked"],
      booking_type: ["singles", "doubles", "lesson"],
      club_module_name: [
        "bookings",
        "lessons",
        "dynamic_pricing",
        "tournaments",
      ],
      club_role: ["admin", "coach", "student"],
      rate_category: ["member", "non_member"],
    },
  },
} as const
