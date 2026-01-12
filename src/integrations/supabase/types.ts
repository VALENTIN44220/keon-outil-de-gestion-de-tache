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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assignment_rules: {
        Row: {
          auto_assign: boolean | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          requires_validation: boolean | null
          subcategory_id: string | null
          target_assignee_id: string | null
          target_department_id: string | null
          updated_at: string
        }
        Insert: {
          auto_assign?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          requires_validation?: boolean | null
          subcategory_id?: string | null
          target_assignee_id?: string | null
          target_department_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_assign?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          requires_validation?: boolean | null
          subcategory_id?: string | null
          target_assignee_id?: string | null
          target_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_target_assignee_id_fkey"
            columns: ["target_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_rules_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hierarchy_levels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_titles: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_titles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          can_assign_to_all: boolean
          can_assign_to_subordinates: boolean
          can_manage_all_tasks: boolean
          can_manage_own_tasks: boolean
          can_manage_subordinates_tasks: boolean
          can_manage_templates: boolean
          can_manage_users: boolean
          can_view_all_tasks: boolean
          can_view_own_tasks: boolean
          can_view_subordinates_tasks: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          can_assign_to_all?: boolean
          can_assign_to_subordinates?: boolean
          can_manage_all_tasks?: boolean
          can_manage_own_tasks?: boolean
          can_manage_subordinates_tasks?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_tasks?: boolean
          can_view_own_tasks?: boolean
          can_view_subordinates_tasks?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          can_assign_to_all?: boolean
          can_assign_to_subordinates?: boolean
          can_manage_all_tasks?: boolean
          can_manage_own_tasks?: boolean
          can_manage_subordinates_tasks?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_tasks?: boolean
          can_view_own_tasks?: boolean
          can_view_subordinates_tasks?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      process_templates: {
        Row: {
          company: string | null
          created_at: string
          department: string | null
          description: string | null
          id: string
          is_shared: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          company_id: string | null
          created_at: string
          department: string | null
          department_id: string | null
          display_name: string | null
          hierarchy_level_id: string | null
          id: string
          is_private: boolean
          job_title: string | null
          job_title_id: string | null
          manager_id: string | null
          must_change_password: boolean
          permission_profile_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          display_name?: string | null
          hierarchy_level_id?: string | null
          id?: string
          is_private?: boolean
          job_title?: string | null
          job_title_id?: string | null
          manager_id?: string | null
          must_change_password?: boolean
          permission_profile_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          display_name?: string | null
          hierarchy_level_id?: string | null
          id?: string
          is_private?: boolean
          job_title?: string | null
          job_title_id?: string | null
          manager_id?: string | null
          must_change_password?: boolean
          permission_profile_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_hierarchy_level_id_fkey"
            columns: ["hierarchy_level_id"]
            isOneToOne: false
            referencedRelation: "hierarchy_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          default_process_template_id: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          default_process_template_id?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          default_process_template_id?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcategories_default_process_template_id_fkey"
            columns: ["default_process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          id: string
          name: string
          task_id: string
          type: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          task_id: string
          type?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          task_id?: string
          type?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          order_index: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          order_index?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          order_index?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_checklists: {
        Row: {
          created_at: string
          id: string
          order_index: number
          task_template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          task_template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          task_template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_checklists_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          default_duration_days: number | null
          description: string | null
          id: string
          is_shared: boolean
          order_index: number | null
          priority: string
          process_template_id: string | null
          requires_validation: boolean | null
          subcategory_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          default_duration_days?: number | null
          description?: string | null
          id?: string
          is_shared?: boolean
          order_index?: number | null
          priority?: string
          process_template_id?: string | null
          requires_validation?: boolean | null
          subcategory_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          default_duration_days?: number | null
          description?: string | null
          id?: string
          is_shared?: boolean
          order_index?: number | null
          priority?: string
          process_template_id?: string | null
          requires_validation?: boolean | null
          subcategory_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_validation_levels: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          level: number
          status: string
          task_id: string
          validated_at: string | null
          validator_department_id: string | null
          validator_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          level?: number
          status?: string
          task_id: string
          validated_at?: string | null
          validator_department_id?: string | null
          validator_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          level?: number
          status?: string
          task_id?: string
          validated_at?: string | null
          validator_department_id?: string | null
          validator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_validation_levels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_validation_levels_validator_department_id_fkey"
            columns: ["validator_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_validation_levels_validator_id_fkey"
            columns: ["validator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          category: string | null
          category_id: string | null
          created_at: string
          current_validation_level: number | null
          description: string | null
          due_date: string | null
          id: string
          is_assignment_task: boolean
          parent_request_id: string | null
          priority: string
          reporter_id: string | null
          requester_id: string | null
          requires_validation: boolean | null
          source_process_template_id: string | null
          status: string
          subcategory_id: string | null
          target_department_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_comment: string | null
          validation_requested_at: string | null
          validator_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          current_validation_level?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_assignment_task?: boolean
          parent_request_id?: string | null
          priority?: string
          reporter_id?: string | null
          requester_id?: string | null
          requires_validation?: boolean | null
          source_process_template_id?: string | null
          status?: string
          subcategory_id?: string | null
          target_department_id?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_comment?: string | null
          validation_requested_at?: string | null
          validator_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          current_validation_level?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_assignment_task?: boolean
          parent_request_id?: string | null
          priority?: string
          reporter_id?: string | null
          requester_id?: string | null
          requires_validation?: boolean | null
          source_process_template_id?: string | null
          status?: string
          subcategory_id?: string | null
          target_department_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_comment?: string | null
          validation_requested_at?: string | null
          validator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_process_template_id_fkey"
            columns: ["source_process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_validator_id_fkey"
            columns: ["validator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_validation_levels: {
        Row: {
          created_at: string
          id: string
          level: number
          task_template_id: string
          validator_department_id: string | null
          validator_profile_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          task_template_id: string
          validator_department_id?: string | null
          validator_profile_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          task_template_id?: string
          validator_department_id?: string | null
          validator_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_validation_levels_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_validation_levels_validator_department_id_fkey"
            columns: ["validator_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_validation_levels_validator_profile_id_fkey"
            columns: ["validator_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      can_access_task: { Args: { _task_id: string }; Returns: boolean }
      can_assign_tasks: { Args: never; Returns: boolean }
      current_company_id: { Args: never; Returns: string }
      current_department_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
