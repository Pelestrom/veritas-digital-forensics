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
      analyses: {
        Row: {
          anomalies: Json
          completed_at: string | null
          consistency_score: number | null
          created_at: string
          document_profile: string | null
          error_message: string | null
          evidence: Json
          evidence_v2: Json
          file_size: number
          file_type: string
          filename: string
          heatmap: Json | null
          id: string
          mime_type: string | null
          reliability_score: number | null
          scores: Json
          sha256: string | null
          sha512: string | null
          status: Database["public"]["Enums"]["analysis_status"]
          storage_path: string | null
          trust_score: number | null
          updated_at: string
          user_id: string
          verdict: Database["public"]["Enums"]["trust_verdict"]
        }
        Insert: {
          anomalies?: Json
          completed_at?: string | null
          consistency_score?: number | null
          created_at?: string
          document_profile?: string | null
          error_message?: string | null
          evidence?: Json
          evidence_v2?: Json
          file_size: number
          file_type: string
          filename: string
          heatmap?: Json | null
          id?: string
          mime_type?: string | null
          reliability_score?: number | null
          scores?: Json
          sha256?: string | null
          sha512?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          storage_path?: string | null
          trust_score?: number | null
          updated_at?: string
          user_id: string
          verdict?: Database["public"]["Enums"]["trust_verdict"]
        }
        Update: {
          anomalies?: Json
          completed_at?: string | null
          consistency_score?: number | null
          created_at?: string
          document_profile?: string | null
          error_message?: string | null
          evidence?: Json
          evidence_v2?: Json
          file_size?: number
          file_type?: string
          filename?: string
          heatmap?: Json | null
          id?: string
          mime_type?: string | null
          reliability_score?: number | null
          scores?: Json
          sha256?: string | null
          sha512?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          storage_path?: string | null
          trust_score?: number | null
          updated_at?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["trust_verdict"]
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comparisons: {
        Row: {
          candidate_filename: string
          candidate_sha256: string
          created_at: string
          diff: Json
          id: string
          reference_filename: string
          reference_sha256: string
          similarity_score: number
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          candidate_filename: string
          candidate_sha256: string
          created_at?: string
          diff?: Json
          id?: string
          reference_filename: string
          reference_sha256: string
          similarity_score: number
          updated_at?: string
          user_id: string
          verdict: string
        }
        Update: {
          candidate_filename?: string
          candidate_sha256?: string
          created_at?: string
          diff?: Json
          id?: string
          reference_filename?: string
          reference_sha256?: string
          similarity_score?: number
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          organization: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          organization?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reference_collections: {
        Row: {
          country: string | null
          created_at: string
          document_type: string | null
          id: string
          issuer: string | null
          name: string
          notes: string | null
          owner_id: string
          status: string
          template_version: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          issuer?: string | null
          name: string
          notes?: string | null
          owner_id: string
          status?: string
          template_version?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          issuer?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          status?: string
          template_version?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      reference_comparisons: {
        Row: {
          axes: Json
          comparison_verdict: string
          compatibility_status: string
          conformity_score: number | null
          coverage: number | null
          created_at: string
          evidence: Json
          fingerprint_version: string | null
          id: string
          limitations: Json
          owner_id: string
          policy_version: string
          reference_collection_id: string | null
          reference_document_id: string | null
          reliability: number | null
          scores: Json
          target_analysis_id: string | null
          target_filename: string | null
          target_sha256: string | null
        }
        Insert: {
          axes?: Json
          comparison_verdict?: string
          compatibility_status?: string
          conformity_score?: number | null
          coverage?: number | null
          created_at?: string
          evidence?: Json
          fingerprint_version?: string | null
          id?: string
          limitations?: Json
          owner_id: string
          policy_version?: string
          reference_collection_id?: string | null
          reference_document_id?: string | null
          reliability?: number | null
          scores?: Json
          target_analysis_id?: string | null
          target_filename?: string | null
          target_sha256?: string | null
        }
        Update: {
          axes?: Json
          comparison_verdict?: string
          compatibility_status?: string
          conformity_score?: number | null
          coverage?: number | null
          created_at?: string
          evidence?: Json
          fingerprint_version?: string | null
          id?: string
          limitations?: Json
          owner_id?: string
          policy_version?: string
          reference_collection_id?: string | null
          reference_document_id?: string | null
          reliability?: number | null
          scores?: Json
          target_analysis_id?: string | null
          target_filename?: string | null
          target_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_comparisons_reference_collection_id_fkey"
            columns: ["reference_collection_id"]
            isOneToOne: false
            referencedRelation: "reference_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_comparisons_reference_document_id_fkey"
            columns: ["reference_document_id"]
            isOneToOne: false
            referencedRelation: "reference_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_documents: {
        Row: {
          analysis_id: string | null
          category: string | null
          collection_id: string | null
          country: string | null
          created_at: string
          document_type: string | null
          engine_version: string | null
          file_size: number
          fingerprint_version: string | null
          id: string
          is_favorite: boolean
          issuer: string | null
          last_used_at: string | null
          mime_type: string | null
          name: string
          notes: string | null
          original_filename: string
          owner_id: string
          page_count: number | null
          sha256: string
          storage_path: string
          structural_fingerprint: Json
          template_series: string | null
          template_version: string | null
          trust_status: string
          updated_at: string
          usage_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          analysis_id?: string | null
          category?: string | null
          collection_id?: string | null
          country?: string | null
          created_at?: string
          document_type?: string | null
          engine_version?: string | null
          file_size: number
          fingerprint_version?: string | null
          id?: string
          is_favorite?: boolean
          issuer?: string | null
          last_used_at?: string | null
          mime_type?: string | null
          name: string
          notes?: string | null
          original_filename: string
          owner_id: string
          page_count?: number | null
          sha256: string
          storage_path: string
          structural_fingerprint?: Json
          template_series?: string | null
          template_version?: string | null
          trust_status?: string
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          analysis_id?: string | null
          category?: string | null
          collection_id?: string | null
          country?: string | null
          created_at?: string
          document_type?: string | null
          engine_version?: string | null
          file_size?: number
          fingerprint_version?: string | null
          id?: string
          is_favorite?: boolean
          issuer?: string | null
          last_used_at?: string | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          original_filename?: string
          owner_id?: string
          page_count?: number | null
          sha256?: string
          storage_path?: string
          structural_fingerprint?: Json
          template_series?: string | null
          template_version?: string | null
          trust_status?: string
          updated_at?: string
          usage_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "reference_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          _action: string
          _metadata?: Json
          _resource_id?: string
          _resource_type?: string
        }
        Returns: string
      }
    }
    Enums: {
      analysis_status: "pending" | "processing" | "completed" | "failed"
      app_role: "admin" | "analyst" | "user"
      trust_verdict:
        | "authentic"
        | "authentic_probable"
        | "suspect"
        | "manipulated"
        | "falsified"
        | "unknown"
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
  public: {
    Enums: {
      analysis_status: ["pending", "processing", "completed", "failed"],
      app_role: ["admin", "analyst", "user"],
      trust_verdict: [
        "authentic",
        "authentic_probable",
        "suspect",
        "manipulated",
        "falsified",
        "unknown",
      ],
    },
  },
} as const
