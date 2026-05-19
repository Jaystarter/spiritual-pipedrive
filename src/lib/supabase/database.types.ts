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
          avatar_url: string | null;
          life_status: "student" | "worker" | null;
          assigned_profile_ids: string[];
          sort_order: number;
          baptized_at: string | null;
          last_contacted_at: string | null;
          next_follow_up_at: string | null;
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
          avatar_url?: string | null;
          life_status?: "student" | "worker" | null;
          assigned_profile_ids?: string[];
          sort_order?: number;
          baptized_at?: string | null;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
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
          avatar_url?: string | null;
          life_status?: "student" | "worker" | null;
          assigned_profile_ids?: string[];
          sort_order?: number;
          baptized_at?: string | null;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      person_events: {
        Row: {
          id: string;
          person_id: string;
          event_type:
            | "created"
            | "stage_moved"
            | "details_updated"
            | "assigned"
            | "note_added"
            | "study_logged"
            | "text_reaction"
            | "call_reaction"
            | "archived";
          title: string;
          body: string | null;
          from_stage: StageId | null;
          to_stage: StageId | null;
          actor_profile_id: string | null;
          notification_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          event_type:
            | "created"
            | "stage_moved"
            | "details_updated"
            | "assigned"
            | "note_added"
            | "study_logged"
            | "text_reaction"
            | "call_reaction"
            | "archived";
          title: string;
          body?: string | null;
          from_stage?: StageId | null;
          to_stage?: StageId | null;
          actor_profile_id?: string | null;
          notification_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          person_id?: string;
          event_type?:
            | "created"
            | "stage_moved"
            | "details_updated"
            | "assigned"
            | "note_added"
            | "study_logged"
            | "text_reaction"
            | "call_reaction"
            | "archived";
          title?: string;
          body?: string | null;
          from_stage?: StageId | null;
          to_stage?: StageId | null;
          actor_profile_id?: string | null;
          notification_profile_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "person_events_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      person_studies: {
        Row: {
          id: string;
          person_id: string;
          study_number: number;
          title: string;
          studied_at: string;
          notes: string | null;
          actor_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: string;
          study_number: number;
          title?: string;
          studied_at: string;
          notes?: string | null;
          actor_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          person_id?: string;
          study_number?: number;
          title?: string;
          studied_at?: string;
          notes?: string | null;
          actor_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "person_studies_actor_profile_id_fkey";
            columns: ["actor_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_studies_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          avatar_offset_x: number;
          avatar_offset_y: number;
          avatar_scale: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          avatar_url?: string | null;
          avatar_offset_x?: number;
          avatar_offset_y?: number;
          avatar_scale?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          avatar_url?: string | null;
          avatar_offset_x?: number;
          avatar_offset_y?: number;
          avatar_scale?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      stages: {
        Row: {
          id: StageId;
          label: string;
          short_label: string;
          description: string;
          tone: "amber" | "sky" | "indigo" | "violet" | "emerald" | "green";
          sort_order: number;
          is_hidden: boolean;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: StageId;
          label: string;
          short_label: string;
          description?: string;
          tone?: "amber" | "sky" | "indigo" | "violet" | "emerald" | "green";
          sort_order?: number;
          is_hidden?: boolean;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: StageId;
          label?: string;
          short_label?: string;
          description?: string;
          tone?: "amber" | "sky" | "indigo" | "violet" | "emerald" | "green";
          sort_order?: number;
          is_hidden?: boolean;
          is_system?: boolean;
          created_at?: string;
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
