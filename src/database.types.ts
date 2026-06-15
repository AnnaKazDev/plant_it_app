export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      action_types: {
        Row: {
          created_at: string | null;
          icon_emoji: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          icon_emoji: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          icon_emoji?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      actions: {
        Row: {
          action_type_id: string | null;
          additional_data: string | null;
          created_at: string | null;
          custom_action_name: string | null;
          date: string;
          id: string;
          plant_id: string;
          updated_at: string | null;
          weather_data: Json | null;
        };
        Insert: {
          action_type_id?: string | null;
          additional_data?: string | null;
          created_at?: string | null;
          custom_action_name?: string | null;
          date: string;
          id?: string;
          plant_id: string;
          updated_at?: string | null;
          weather_data?: Json | null;
        };
        Update: {
          action_type_id?: string | null;
          additional_data?: string | null;
          created_at?: string | null;
          custom_action_name?: string | null;
          date?: string;
          id?: string;
          plant_id?: string;
          updated_at?: string | null;
          weather_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "actions_action_type_id_fkey";
            columns: ["action_type_id"];
            isOneToOne: false;
            referencedRelation: "action_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "actions_plant_id_fkey";
            columns: ["plant_id"];
            isOneToOne: false;
            referencedRelation: "plants";
            referencedColumns: ["id"];
          },
        ];
      };
      photos: {
        Row: {
          action_id: string;
          created_at: string | null;
          id: string;
          order_index: number;
          photo_url: string;
        };
        Insert: {
          action_id: string;
          created_at?: string | null;
          id?: string;
          order_index: number;
          photo_url: string;
        };
        Update: {
          action_id?: string;
          created_at?: string | null;
          id?: string;
          order_index?: number;
          photo_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photos_action_id_fkey";
            columns: ["action_id"];
            isOneToOne: false;
            referencedRelation: "actions";
            referencedColumns: ["id"];
          },
        ];
      };
      plants: {
        Row: {
          created_at: string | null;
          grid_x: number;
          grid_y: number;
          icon_name: string;
          id: string;
          name: string;
          photo_url: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          grid_x: number;
          grid_y: number;
          icon_name?: string;
          id?: string;
          name: string;
          photo_url?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          grid_x?: number;
          grid_y?: number;
          icon_name?: string;
          id?: string;
          name?: string;
          photo_url?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string | null;
          garden_height: number | null;
          garden_name: string | null;
          garden_width: number | null;
          id: string;
          location_city: string | null;
          location_lat: number | null;
          location_lng: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          garden_height?: number | null;
          garden_name?: string | null;
          garden_width?: number | null;
          id: string;
          location_city?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          garden_height?: number | null;
          garden_name?: string | null;
          garden_width?: number | null;
          id?: string;
          location_city?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
