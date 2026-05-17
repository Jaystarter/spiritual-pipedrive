import type { StageId } from "@/lib/stages";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      people: {
        Row: {
          id: string;
          name: string;
          stage: StageId;
          phone: string | null;
          teacher: string | null;
          notes: string | null;
          sort_order: number;
          baptized_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          stage?: StageId;
          phone?: string | null;
          teacher?: string | null;
          notes?: string | null;
          sort_order?: number;
          baptized_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          stage?: StageId;
          phone?: string | null;
          teacher?: string | null;
          notes?: string | null;
          sort_order?: number;
          baptized_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      study_stage: StageId;
    };
    CompositeTypes: Record<string, never>;
  };
};
