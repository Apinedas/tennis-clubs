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
          course_id: string | null
          court_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          guest_name: string | null
          id: string
          notes: string | null
          payment_proof_path: string | null
          payment_rejection_note: string | null
          payment_reviewed_at: string | null
          payment_reviewed_by: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          person_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          type: Database["public"]["Enums"]["booking_type"] | null
        }
        Insert: {
          club_id: string
          coach_id?: string | null
          course_id?: string | null
          court_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          guest_name?: string | null
          id?: string
          notes?: string | null
          payment_proof_path?: string | null
          payment_rejection_note?: string | null
          payment_reviewed_at?: string | null
          payment_reviewed_by?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          person_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          type?: Database["public"]["Enums"]["booking_type"] | null
        }
        Update: {
          club_id?: string
          coach_id?: string | null
          course_id?: string | null
          court_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          guest_name?: string | null
          id?: string
          notes?: string | null
          payment_proof_path?: string | null
          payment_rejection_note?: string | null
          payment_reviewed_at?: string | null
          payment_reviewed_by?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
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
            foreignKeyName: "booking_course_fk"
            columns: ["course_id", "club_id"]
            isOneToOne: false
            referencedRelation: "course"
            referencedColumns: ["id", "club_id"]
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
            foreignKeyName: "booking_payment_reviewed_by_fkey"
            columns: ["payment_reviewed_by"]
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
      booking_policy: {
        Row: {
          accept_guests: boolean
          cancellation_hours: number
          club_id: string
          max_advance_days: number
          min_advance_hours: number
          self_cancel_allowed: boolean
          slot_minutes: number
        }
        Insert: {
          accept_guests?: boolean
          cancellation_hours?: number
          club_id: string
          max_advance_days?: number
          min_advance_hours?: number
          self_cancel_allowed?: boolean
          slot_minutes?: number
        }
        Update: {
          accept_guests?: boolean
          cancellation_hours?: number
          club_id?: string
          max_advance_days?: number
          min_advance_hours?: number
          self_cancel_allowed?: boolean
          slot_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_policy_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
        ]
      }
      club: {
        Row: {
          address: string | null
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
          address?: string | null
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
          address?: string | null
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
      course: {
        Row: {
          active: boolean
          assistant_coach_id: string | null
          capacity: number
          club_id: string
          court_id: string
          created_at: string
          end_date: string
          end_time: string
          head_coach_id: string
          id: string
          level: string | null
          name: string
          rate_id: string | null
          start_date: string
          start_time: string
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          assistant_coach_id?: string | null
          capacity: number
          club_id: string
          court_id: string
          created_at?: string
          end_date: string
          end_time: string
          head_coach_id: string
          id?: string
          level?: string | null
          name: string
          rate_id?: string | null
          start_date: string
          start_time: string
          weekdays: number[]
        }
        Update: {
          active?: boolean
          assistant_coach_id?: string | null
          capacity?: number
          club_id?: string
          court_id?: string
          created_at?: string
          end_date?: string
          end_time?: string
          head_coach_id?: string
          id?: string
          level?: string | null
          name?: string
          rate_id?: string | null
          start_date?: string
          start_time?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "course_assistant_coach_fk"
            columns: ["assistant_coach_id", "club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
          {
            foreignKeyName: "course_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_court_fk"
            columns: ["court_id", "club_id"]
            isOneToOne: false
            referencedRelation: "court"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "course_head_coach_fk"
            columns: ["head_coach_id", "club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
          {
            foreignKeyName: "course_rate_fk"
            columns: ["rate_id", "club_id"]
            isOneToOne: false
            referencedRelation: "rate"
            referencedColumns: ["id", "club_id"]
          },
        ]
      }
      course_attendance: {
        Row: {
          club_id: string
          course_id: string
          id: string
          marked_at: string | null
          marked_by: string | null
          person_id: string
          present: boolean
          session_booking_id: string
        }
        Insert: {
          club_id: string
          course_id: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          person_id: string
          present?: boolean
          session_booking_id: string
        }
        Update: {
          club_id?: string
          course_id?: string
          id?: string
          marked_at?: string | null
          marked_by?: string | null
          person_id?: string
          present?: boolean
          session_booking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_attendance_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_course_fk"
            columns: ["course_id", "club_id"]
            isOneToOne: false
            referencedRelation: "course"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "course_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_person_fk"
            columns: ["person_id", "club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
          {
            foreignKeyName: "course_attendance_session_booking_id_fkey"
            columns: ["session_booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollment: {
        Row: {
          club_id: string
          course_id: string
          created_at: string
          id: string
          person_id: string
          requested_by: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
        }
        Insert: {
          club_id: string
          course_id: string
          created_at?: string
          id?: string
          person_id: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Update: {
          club_id?: string
          course_id?: string
          created_at?: string
          id?: string
          person_id?: string
          requested_by?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollment_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollment_course_fk"
            columns: ["course_id", "club_id"]
            isOneToOne: false
            referencedRelation: "course"
            referencedColumns: ["id", "club_id"]
          },
          {
            foreignKeyName: "course_enrollment_person_fk"
            columns: ["person_id", "club_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["person_id", "club_id"]
          },
          {
            foreignKeyName: "course_enrollment_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollment_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      court: {
        Row: {
          active: boolean
          club_id: string
          covered: boolean
          has_lighting: boolean
          id: string
          name: string
          notes: string | null
          surface: Database["public"]["Enums"]["court_surface"]
        }
        Insert: {
          active?: boolean
          club_id: string
          covered?: boolean
          has_lighting?: boolean
          id?: string
          name: string
          notes?: string | null
          surface: Database["public"]["Enums"]["court_surface"]
        }
        Update: {
          active?: boolean
          club_id?: string
          covered?: boolean
          has_lighting?: boolean
          id?: string
          name?: string
          notes?: string | null
          surface?: Database["public"]["Enums"]["court_surface"]
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
          title: string | null
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          member_number?: string | null
          person_id: string
          roles: Database["public"]["Enums"]["club_role"][]
          title?: string | null
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          member_number?: string | null
          person_id?: string
          roles?: Database["public"]["Enums"]["club_role"][]
          title?: string | null
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
          active: boolean
          category: Database["public"]["Enums"]["rate_category"] | null
          club_id: string
          court_id: string | null
          end_time: string
          id: string
          name: string
          price_amount: number
          service: Database["public"]["Enums"]["booking_type"] | null
          start_time: string
          surface: Database["public"]["Enums"]["court_surface"] | null
          weekdays: number[]
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["rate_category"] | null
          club_id: string
          court_id?: string | null
          end_time: string
          id?: string
          name: string
          price_amount: number
          service?: Database["public"]["Enums"]["booking_type"] | null
          start_time: string
          surface?: Database["public"]["Enums"]["court_surface"] | null
          weekdays?: number[]
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["rate_category"] | null
          club_id?: string
          court_id?: string | null
          end_time?: string
          id?: string
          name?: string
          price_amount?: number
          service?: Database["public"]["Enums"]["booking_type"] | null
          start_time?: string
          surface?: Database["public"]["Enums"]["court_surface"] | null
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
      accept_lesson_request: { Args: { p_id: string }; Returns: undefined }
      access_token_hook: { Args: { event: Json }; Returns: Json }
      cancel_booking: { Args: { p_id: string }; Returns: undefined }
      court_usage_heatmap: {
        Args: { p_club: string; p_end: string; p_start: string }
        Returns: {
          bookings_count: number
          hour: number
          weekday: number
        }[]
      }
      court_usage_report: {
        Args: { p_club: string; p_end: string; p_start: string }
        Returns: {
          cancelled_count: number
          confirmed_count: number
          court_id: string
          court_name: string
          hours_reserved: number
          surface: Database["public"]["Enums"]["court_surface"]
        }[]
      }
      create_course: {
        Args: {
          p_assistant_coach_id: string
          p_capacity: number
          p_club: string
          p_court_id: string
          p_end_date: string
          p_end_time: string
          p_head_coach_id: string
          p_level: string
          p_name: string
          p_rate_id: string
          p_start_date: string
          p_start_time: string
          p_weekdays: number[]
        }
        Returns: string
      }
      enroll_member: {
        Args: { p_course_id: string; p_person_id: string }
        Returns: undefined
      }
      join_club: { Args: { p_slug: string }; Returns: string }
      list_club_coaches: {
        Args: { p_club: string }
        Returns: {
          full_name: string
          person_id: string
        }[]
      }
      list_club_courses: {
        Args: { p_club: string }
        Returns: {
          active: boolean
          assistant_coach_id: string
          capacity: number
          court_id: string
          court_name: string
          end_date: string
          end_time: string
          enrolled_count: number
          head_coach_id: string
          head_coach_name: string
          id: string
          level: string
          name: string
          price_amount: number
          rate_id: string
          start_date: string
          start_time: string
          weekdays: number[]
        }[]
      }
      list_club_members: {
        Args: { p_club: string }
        Returns: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          member_number: string
          person_id: string
          phone: string
          roles: Database["public"]["Enums"]["club_role"][]
          title: string
        }[]
      }
      list_course_roster: {
        Args: { p_course_id: string }
        Returns: {
          enrollment_id: string
          full_name: string
          person_id: string
          review_note: string
          status: Database["public"]["Enums"]["enrollment_status"]
        }[]
      }
      list_course_sessions: {
        Args: { p_course_id: string }
        Returns: {
          ends_at: string
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      list_my_lessons: {
        Args: { p_club: string }
        Returns: {
          counterpart_name: string
          court_name: string
          ends_at: string
          id: string
          notes: string
          payment_proof_path: string
          payment_rejection_note: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          viewer_role: Database["public"]["Enums"]["club_role"]
        }[]
      }
      list_occupied_windows: {
        Args: {
          p_club: string
          p_coach_id?: string
          p_court_ids?: string[]
          p_end: string
          p_start: string
        }
        Returns: {
          coach_id: string
          court_id: string
          ends_at: string
          starts_at: string
        }[]
      }
      list_pending_enrollments: {
        Args: { p_club: string }
        Returns: {
          course_id: string
          course_name: string
          id: string
          person_id: string
          person_name: string
          status: Database["public"]["Enums"]["enrollment_status"]
        }[]
      }
      list_pending_payments: {
        Args: { p_club: string }
        Returns: {
          court_name: string
          ends_at: string
          guest_name: string
          id: string
          payment_proof_path: string
          person_name: string
          starts_at: string
          type: Database["public"]["Enums"]["booking_type"]
        }[]
      }
      mark_attendance: {
        Args: {
          p_person_id: string
          p_present: boolean
          p_session_booking_id: string
        }
        Returns: undefined
      }
      mark_booking_paid: { Args: { p_id: string }; Returns: undefined }
      public_club: {
        Args: { p_slug: string }
        Returns: {
          address: string
          brand_color: string
          contact_email: string
          contact_phone: string
          logo_url: string
          name: string
          open_registration: boolean
        }[]
      }
      public_club_coaches: {
        Args: { p_slug: string }
        Returns: {
          full_name: string
          title: string
        }[]
      }
      public_club_courts: {
        Args: { p_slug: string }
        Returns: {
          covered: boolean
          name: string
          surface: Database["public"]["Enums"]["court_surface"]
        }[]
      }
      public_club_rates: {
        Args: { p_slug: string }
        Returns: {
          category: Database["public"]["Enums"]["rate_category"]
          name: string
          price_amount: number
        }[]
      }
      reject_payment_proof: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      remove_enrollment: { Args: { p_id: string }; Returns: undefined }
      request_enrollment: { Args: { p_course_id: string }; Returns: undefined }
      request_unenroll: { Args: { p_id: string }; Returns: undefined }
      review_enrollment: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      submit_payment_proof: {
        Args: { p_id: string; p_path: string }
        Returns: undefined
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
      booking_status: "confirmed" | "cancelled" | "blocked" | "pending"
      booking_type: "singles" | "doubles" | "lesson" | "course"
      club_module_name:
        | "bookings"
        | "lessons"
        | "dynamic_pricing"
        | "tournaments"
        | "courses"
      club_role: "admin" | "coach" | "student"
      court_surface: "clay" | "hard" | "grass" | "carpet" | "other"
      enrollment_status:
        | "pending"
        | "active"
        | "pending_cancellation"
        | "cancelled"
      payment_status: "unpaid" | "pending_review" | "paid"
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
      booking_status: ["confirmed", "cancelled", "blocked", "pending"],
      booking_type: ["singles", "doubles", "lesson", "course"],
      club_module_name: [
        "bookings",
        "lessons",
        "dynamic_pricing",
        "tournaments",
        "courses",
      ],
      club_role: ["admin", "coach", "student"],
      court_surface: ["clay", "hard", "grass", "carpet", "other"],
      enrollment_status: [
        "pending",
        "active",
        "pending_cancellation",
        "cancelled",
      ],
      payment_status: ["unpaid", "pending_review", "paid"],
      rate_category: ["member", "non_member"],
    },
  },
} as const
