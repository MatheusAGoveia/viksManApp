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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      appointment_events: {
        Row: {
          actor_id: string | null
          appointment_id: string
          created_at: string
          event: string
          id: number
          new_data: Json | null
          previous_data: Json | null
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          created_at?: string
          event: string
          id?: never
          new_data?: Json | null
          previous_data?: Json | null
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          created_at?: string
          event?: string
          id?: never
          new_data?: Json | null
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_payments: {
        Row: {
          amount_cents: number
          appointment_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string
          paid_at: string | null
          payer_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          payer_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          payer_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          barber_id: string
          booked_via: string
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string
          club_discount_cents: number
          created_at: string
          ends_at: string
          gratuity_cents: number
          id: string
          notes: string | null
          party_size: number
          payment_status: string
          service_id: string
          starts_at: string
          status: string
          unit_id: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          barber_id: string
          booked_via?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id: string
          club_discount_cents?: number
          created_at?: string
          ends_at: string
          gratuity_cents?: number
          id?: string
          notes?: string | null
          party_size?: number
          payment_status?: string
          service_id: string
          starts_at: string
          status?: string
          unit_id: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          barber_id?: string
          booked_via?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string
          club_discount_cents?: number
          created_at?: string
          ends_at?: string
          gratuity_cents?: number
          id?: string
          notes?: string | null
          party_size?: number
          payment_status?: string
          service_id?: string
          starts_at?: string
          status?: string
          unit_id?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string
          duration_override_minutes: number | null
          price_override_cents: number | null
          service_id: string
        }
        Insert: {
          barber_id: string
          duration_override_minutes?: number | null
          price_override_cents?: number | null
          service_id: string
        }
        Update: {
          barber_id?: string
          duration_override_minutes?: number | null
          price_override_cents?: number | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean
          bio: string | null
          color: string
          created_at: string
          id: string
          name: string
          profile_id: string | null
          slug: string
          sort_order: number
          specialties: string[]
          unit_id: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          profile_id?: string | null
          slug: string
          sort_order?: number
          specialties?: string[]
          unit_id: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          profile_id?: string | null
          slug?: string
          sort_order?: number
          specialties?: string[]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barbers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      client_style_profiles: {
        Row: {
          allergies: string | null
          barber_notes: string | null
          client_id: string
          clipper_guard: string | null
          fade_height: string | null
          finish: string | null
          preferred_beard: string | null
          preferred_cut: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          barber_notes?: string | null
          client_id: string
          clipper_guard?: string | null
          fade_height?: string | null
          finish?: string | null
          preferred_beard?: string | null
          preferred_cut?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          barber_notes?: string | null
          client_id?: string
          clipper_guard?: string | null
          fade_height?: string | null
          finish?: string | null
          preferred_beard?: string | null
          preferred_cut?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_style_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          appointment_id: string
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          appointment_id: string
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          appointment_id?: string
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string | null
          id: string
          marketing_consent: boolean
          phone: string | null
          preferred_barber_id: string | null
          prefers_silent_service: boolean
          role: string
          updated_at: string
          viks_club_status: string
          viks_points_balance: number
          whatsapp_consent: boolean
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          marketing_consent?: boolean
          phone?: string | null
          preferred_barber_id?: string | null
          prefers_silent_service?: boolean
          role?: string
          updated_at?: string
          viks_club_status?: string
          viks_points_balance?: number
          whatsapp_consent?: boolean
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          marketing_consent?: boolean
          phone?: string | null
          preferred_barber_id?: string | null
          prefers_silent_service?: boolean
          role?: string
          updated_at?: string
          viks_club_status?: string
          viks_points_balance?: number
          whatsapp_consent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_preferred_barber_fk"
            columns: ["preferred_barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          name: string
          price_cents: number
          slug: string
          sort_order: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      promotion_deliveries: {
        Row: {
          attempts: number
          client_id: string
          created_at: string
          id: string
          last_error: string | null
          phone: string
          promotion_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          client_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          phone: string
          promotion_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          client_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          phone?: string
          promotion_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_deliveries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_deliveries_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          audience: string
          created_at: string
          created_by: string
          discount_label: string | null
          ends_at: string
          id: string
          message: string
          send_at: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by: string
          discount_label?: string | null
          ends_at: string
          id?: string
          message: string
          send_at: string
          starts_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string
          discount_label?: string | null
          ends_at?: string
          id?: string
          message?: string
          send_at?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          active: boolean
          expo_push_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          expo_push_token: string
          id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          expo_push_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_blocks: {
        Row: {
          barber_id: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          kind: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          kind?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          kind?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price_cents: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          active: boolean
          address: string
          allow_walk_ins: boolean
          cancellation_hours: number
          city: string
          created_at: string
          default_buffer_minutes: number
          id: string
          max_booking_days: number
          min_booking_notice_minutes: number
          name: string
          phone: string | null
          pix_key: string | null
          slug: string
          state: string
          timezone: string
        }
        Insert: {
          active?: boolean
          address: string
          allow_walk_ins?: boolean
          cancellation_hours?: number
          city: string
          created_at?: string
          default_buffer_minutes?: number
          id?: string
          max_booking_days?: number
          min_booking_notice_minutes?: number
          name: string
          phone?: string | null
          pix_key?: string | null
          slug: string
          state: string
          timezone?: string
        }
        Update: {
          active?: boolean
          address?: string
          allow_walk_ins?: boolean
          cancellation_hours?: number
          city?: string
          created_at?: string
          default_buffer_minutes?: number
          id?: string
          max_booking_days?: number
          min_booking_notice_minutes?: number
          name?: string
          phone?: string | null
          pix_key?: string | null
          slug?: string
          state?: string
          timezone?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          active: boolean
          barber_id: string
          closes_at: string
          id: string
          opens_at: string
          slot_interval_minutes: number
          weekday: number
        }
        Insert: {
          active?: boolean
          barber_id: string
          closes_at: string
          id?: string
          opens_at: string
          slot_interval_minutes?: number
          weekday: number
        }
        Update: {
          active?: boolean
          barber_id?: string
          closes_at?: string
          id?: string
          opens_at?: string
          slot_interval_minutes?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      viks_club_plans: {
        Row: {
          active: boolean
          allow_self_cancel: boolean
          allow_self_pause: boolean
          allowed_days: string[]
          barber_id: string | null
          billing_period: string
          created_at: string
          description: string | null
          featured: boolean
          id: string
          name: string
          price: number
          price_cents: number
          refund_on_cancel: boolean
          self_service_enabled: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_self_cancel?: boolean
          allow_self_pause?: boolean
          allowed_days?: string[]
          barber_id?: string | null
          billing_period?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          name: string
          price?: number
          price_cents?: number
          refund_on_cancel?: boolean
          self_service_enabled?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_self_cancel?: boolean
          allow_self_pause?: boolean
          allowed_days?: string[]
          barber_id?: string | null
          billing_period?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          name?: string
          price?: number
          price_cents?: number
          refund_on_cancel?: boolean
          self_service_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      viks_club_plan_benefits: {
        Row: {
          active: boolean
          benefit_type: string
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          plan_id: string
          quantity: number
          service_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefit_type?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          plan_id: string
          quantity?: number
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefit_type?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          plan_id?: string
          quantity?: number
          service_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      viks_club_subscriptions: {
        Row: {
          barber_id: string | null
          canceled_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          current_period_end: string
          current_period_start: string
          id: string
          paused_at: string | null
          plan_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          barber_id?: string | null
          canceled_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          current_period_end: string
          current_period_start?: string
          id?: string
          paused_at?: string | null
          plan_id: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          barber_id?: string | null
          canceled_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          paused_at?: string | null
          plan_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      viks_club_subscription_benefits: {
        Row: {
          benefit_type: string
          created_at: string
          discount_percent: number | null
          id: string
          period_end: string
          period_start: string
          plan_benefit_id: string | null
          quantity_granted: number
          quantity_used: number
          service_id: string | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          benefit_type?: string
          created_at?: string
          discount_percent?: number | null
          id?: string
          period_end: string
          period_start: string
          plan_benefit_id?: string | null
          quantity_granted?: number
          quantity_used?: number
          service_id?: string | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          benefit_type?: string
          created_at?: string
          discount_percent?: number | null
          id?: string
          period_end?: string
          period_start?: string
          plan_benefit_id?: string | null
          quantity_granted?: number
          quantity_used?: number
          service_id?: string | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      viks_club_benefit_usage: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          discount_cents_applied: number
          id: string
          notes: string | null
          quantity: number
          subscription_benefit_id: string
          used_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          discount_cents_applied?: number
          id?: string
          notes?: string | null
          quantity?: number
          subscription_benefit_id: string
          used_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          discount_cents_applied?: number
          id?: string
          notes?: string | null
          quantity?: number
          subscription_benefit_id?: string
          used_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          points: number
          reason: string
          type: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          points: number
          reason: string
          type: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          points?: number
          reason?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      self_subscribe_viks_club: {
        Args: { p_plan_id: string; p_barber_id?: string | null }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      create_viks_club_appointment: {
        Args: {
          p_subscription_benefit_id: string
          p_unit_slug: string
          p_service_slug: string
          p_barber_slug: string
          p_starts_at: string
          p_notes?: string | null
        }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      activate_viks_club_subscription: {
        Args: { p_client_id: string; p_plan_id: string; p_cycles?: number; p_barber_id?: string | null }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      renew_viks_club_subscription: {
        Args: { p_subscription_id: string; p_cycles?: number }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      update_viks_club_subscription_status: {
        Args: { p_subscription_id: string; p_new_status: string }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      consume_viks_club_benefit: {
        Args: { p_subscription_benefit_id: string; p_appointment_id?: string | null; p_quantity?: number; p_notes?: string | null }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      void_viks_club_benefit_usage: {
        Args: { p_usage_id: string; p_reason?: string | null }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      calculate_appointment_totals: {
        Args: { p_appointment_id: string }
        Returns: undefined
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      manage_loyalty_points: {
        Args: { p_client_id: string; p_type: string; p_points: number; p_reason: string; p_appointment_id?: string | null }
        Returns: Json
        SetofOptions: { from: "*"; to: "*"; isOneToOne: false; isSetofReturn: false }
      }
      activate_due_promotions: {
        Args: { p_limit?: number }
        Returns: {
          audience: string
          created_at: string
          created_by: string
          discount_label: string | null
          ends_at: string
          id: string
          message: string
          send_at: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "promotions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: {
          barber_id: string
          booked_via: string
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          ends_at: string
          gratuity_cents: number
          id: string
          notes: string | null
          party_size: number
          payment_status: string
          service_id: string
          starts_at: string
          status: string
          unit_id: string
          unit_price_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_notification_jobs: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_promotion_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          client_id: string
          created_at: string
          id: string
          last_error: string | null
          phone: string
          promotion_id: string
          sent_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "promotion_deliveries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_appointment: {
        Args: {
          p_barber_slug: string
          p_booked_via?: string
          p_gratuity_cents?: number
          p_notes?: string
          p_party_size?: number
          p_service_slug: string
          p_starts_at: string
          p_unit_slug: string
        }
        Returns: {
          barber_id: string
          booked_via: string
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          ends_at: string
          gratuity_cents: number
          id: string
          notes: string | null
          party_size: number
          payment_status: string
          service_id: string
          starts_at: string
          status: string
          unit_id: string
          unit_price_cents: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_available_slots: {
        Args: {
          p_barber_slug?: string
          p_day: string
          p_party_size?: number
          p_service_slug: string
          p_unit_slug: string
        }
        Returns: {
          barber_name: string
          barber_slug: string
          starts_at: string
        }[]
      }
      get_next_available_slot: {
        Args: {
          p_barber_slug?: string
          p_party_size?: number
          p_service_slug: string
          p_unit_slug: string
        }
        Returns: {
          barber_name: string
          barber_slug: string
          starts_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
