export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string
          event_action: string
          event_details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          robot_id: string | null
          robot_name: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_action: string
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          robot_id?: string | null
          robot_name?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_action?: string
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          robot_id?: string | null
          robot_name?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_robot_id_fkey"
            columns: ["robot_id"]
            isOneToOne: false
            referencedRelation: "robots"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          map_asset_id: string | null
          map_name: string | null
          name: string
          robot_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          map_asset_id?: string | null
          map_name?: string | null
          name: string
          robot_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          map_asset_id?: string | null
          map_name?: string | null
          name?: string
          robot_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_map_asset_id_fkey"
            columns: ["map_asset_id"]
            isOneToOne: false
            referencedRelation: "mission_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_robot_id_fkey"
            columns: ["robot_id"]
            isOneToOne: false
            referencedRelation: "robots"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_maps: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_height: number | null
          image_path: string
          image_width: number | null
          map_format: string | null
          name: string
          origin_theta: number | null
          origin_x: number
          origin_y: number
          resolution: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_height?: number | null
          image_path: string
          image_width?: number | null
          map_format?: string | null
          name: string
          origin_theta?: number | null
          origin_x?: number
          origin_y?: number
          resolution?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_height?: number | null
          image_path?: string
          image_width?: number | null
          map_format?: string | null
          name?: string
          origin_theta?: number | null
          origin_x?: number
          origin_y?: number
          resolution?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      robots: {
        Row: {
          address: string
          capabilities_cache: Json | null
          connection_config: Json | null
          created_at: string | null
          firmware_version: string | null
          id: string
          is_favorite: boolean | null
          key: string | null
          last_seen_at: string | null
          model_family: string | null
          name: string
          serial_number: string | null
          transport_type: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          capabilities_cache?: Json | null
          connection_config?: Json | null
          created_at?: string | null
          firmware_version?: string | null
          id?: string
          is_favorite?: boolean | null
          key?: string | null
          last_seen_at?: string | null
          model_family?: string | null
          name: string
          serial_number?: string | null
          transport_type?: string | null
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          capabilities_cache?: Json | null
          connection_config?: Json | null
          created_at?: string | null
          firmware_version?: string | null
          id?: string
          is_favorite?: boolean | null
          key?: string | null
          last_seen_at?: string | null
          model_family?: string | null
          name?: string
          serial_number?: string | null
          transport_type?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          audit_logging_enabled: boolean | null
          avatar_url: string | null
          connection_timeout: number | null
          created_at: string
          hide_branding: boolean | null
          id: string
          name: string | null
          speed_mode: string | null
          theme_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_logging_enabled?: boolean | null
          avatar_url?: string | null
          connection_timeout?: number | null
          created_at?: string
          hide_branding?: boolean | null
          id?: string
          name?: string | null
          speed_mode?: string | null
          theme_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_logging_enabled?: boolean | null
          avatar_url?: string | null
          connection_timeout?: number | null
          created_at?: string
          hide_branding?: boolean | null
          id?: string
          name?: string | null
          speed_mode?: string | null
          theme_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waypoints: {
        Row: {
          action_provider: string | null
          action_name: string | null
          action_payload: Json | null
          created_at: string | null
          execution_policy: string | null
          id: string
          is_reached: boolean | null
          mission_id: string
          order_index: number
          reached_at: string | null
          theta: number
          updated_at: string | null
          x: number
          y: number
        }
        Insert: {
          action_provider?: string | null
          action_name?: string | null
          action_payload?: Json | null
          created_at?: string | null
          execution_policy?: string | null
          id?: string
          is_reached?: boolean | null
          mission_id: string
          order_index: number
          reached_at?: string | null
          theta: number
          updated_at?: string | null
          x: number
          y: number
        }
        Update: {
          action_provider?: string | null
          action_name?: string | null
          action_payload?: Json | null
          created_at?: string | null
          execution_policy?: string | null
          id?: string
          is_reached?: boolean | null
          mission_id?: string
          order_index?: number
          reached_at?: string | null
          theta?: number
          updated_at?: string | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "waypoints_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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