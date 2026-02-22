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
      admin_table_lookup_configs: {
        Row: {
          created_at: string
          description: string | null
          display_column: string
          filter_column: string | null
          filter_value: string | null
          id: string
          is_active: boolean
          label: string
          order_index: number
          table_name: string
          updated_at: string
          value_column: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_column: string
          filter_column?: string | null
          filter_value?: string | null
          id?: string
          is_active?: boolean
          label: string
          order_index?: number
          table_name: string
          updated_at?: string
          value_column: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_column?: string
          filter_column?: string | null
          filter_value?: string | null
          id?: string
          is_active?: boolean
          label?: string
          order_index?: number
          table_name?: string
          updated_at?: string
          value_column?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          art_id: number
          created_at: string
          des: string | null
          id: string
          prix_moy: number | null
          qte: number | null
          ref: string | null
          updated_at: string
        }
        Insert: {
          art_id: number
          created_at?: string
          des?: string | null
          id?: string
          prix_moy?: number | null
          qte?: number | null
          ref?: string | null
          updated_at?: string
        }
        Update: {
          art_id?: number
          created_at?: string
          des?: string | null
          id?: string
          prix_moy?: number | null
          qte?: number | null
          ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      be_project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_project_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      be_projects: {
        Row: {
          actionnariat: string | null
          adresse_site: string | null
          adresse_societe: string | null
          charge_affaires_id: string | null
          code_divalto: string | null
          code_projet: string
          created_at: string
          created_by: string | null
          date_cloture_bancaire: string | null
          date_cloture_juridique: string | null
          date_os_etude: string | null
          date_os_travaux: string | null
          departement: string | null
          description: string | null
          developpeur_id: string | null
          gps_coordinates: string | null
          id: string
          ingenieur_etudes_id: string | null
          ingenieur_realisation_id: string | null
          nom_projet: string
          pays: string | null
          pays_site: string | null
          projeteur_id: string | null
          regime_icpe: string | null
          region: string | null
          siret: string | null
          status: string
          typologie: string | null
          updated_at: string
        }
        Insert: {
          actionnariat?: string | null
          adresse_site?: string | null
          adresse_societe?: string | null
          charge_affaires_id?: string | null
          code_divalto?: string | null
          code_projet: string
          created_at?: string
          created_by?: string | null
          date_cloture_bancaire?: string | null
          date_cloture_juridique?: string | null
          date_os_etude?: string | null
          date_os_travaux?: string | null
          departement?: string | null
          description?: string | null
          developpeur_id?: string | null
          gps_coordinates?: string | null
          id?: string
          ingenieur_etudes_id?: string | null
          ingenieur_realisation_id?: string | null
          nom_projet: string
          pays?: string | null
          pays_site?: string | null
          projeteur_id?: string | null
          regime_icpe?: string | null
          region?: string | null
          siret?: string | null
          status?: string
          typologie?: string | null
          updated_at?: string
        }
        Update: {
          actionnariat?: string | null
          adresse_site?: string | null
          adresse_societe?: string | null
          charge_affaires_id?: string | null
          code_divalto?: string | null
          code_projet?: string
          created_at?: string
          created_by?: string | null
          date_cloture_bancaire?: string | null
          date_cloture_juridique?: string | null
          date_os_etude?: string | null
          date_os_travaux?: string | null
          departement?: string | null
          description?: string | null
          developpeur_id?: string | null
          gps_coordinates?: string | null
          id?: string
          ingenieur_etudes_id?: string | null
          ingenieur_realisation_id?: string | null
          nom_projet?: string
          pays?: string | null
          pays_site?: string | null
          projeteur_id?: string | null
          regime_icpe?: string | null
          region?: string | null
          siret?: string | null
          status?: string
          typologie?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_projects_charge_affaires_id_fkey"
            columns: ["charge_affaires_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_projects_developpeur_id_fkey"
            columns: ["developpeur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_projects_ingenieur_etudes_id_fkey"
            columns: ["ingenieur_etudes_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_projects_ingenieur_realisation_id_fkey"
            columns: ["ingenieur_realisation_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_projects_projeteur_id_fkey"
            columns: ["projeteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      be_request_details: {
        Row: {
          code_affaire: string | null
          created_at: string
          demande_ie: string | null
          demande_projeteur: string | null
          facturable: string | null
          id: string
          montant_prestation: number | null
          num_cmde_divalto: string | null
          num_devis_divalto: string | null
          phase: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          code_affaire?: string | null
          created_at?: string
          demande_ie?: string | null
          demande_projeteur?: string | null
          facturable?: string | null
          id?: string
          montant_prestation?: number | null
          num_cmde_divalto?: string | null
          num_devis_divalto?: string | null
          phase?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          code_affaire?: string | null
          created_at?: string
          demande_ie?: string | null
          demande_projeteur?: string | null
          facturable?: string | null
          id?: string
          montant_prestation?: number | null
          num_cmde_divalto?: string | null
          num_devis_divalto?: string | null
          phase?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_request_details_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "be_request_details_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      be_request_sub_processes: {
        Row: {
          created_at: string
          id: string
          sub_process_template_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sub_process_template_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sub_process_template_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_request_sub_processes_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "be_request_sub_processes_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_request_sub_processes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "be_request_sub_processes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      be_task_labels: {
        Row: {
          code: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
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
      chat_attachments: {
        Row: {
          conversation_id: string
          created_at: string
          file_name: string
          id: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          uploader_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          file_name: string
          id?: string
          message_id: string
          mime_type: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          uploader_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string
          mime_type?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          scope_id: string | null
          scope_type: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          scope_id?: string | null
          scope_type?: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          scope_id?: string | null
          scope_type?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          message_type: string
          reply_to_message_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          reply_to_message_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          reply_to_message_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_groups: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_groups_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      datalake_table_catalog: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          last_sync_at: string | null
          primary_key_column: string
          sync_enabled: boolean
          table_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          last_sync_at?: string | null
          primary_key_column?: string
          sync_enabled?: boolean
          table_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          last_sync_at?: string | null
          primary_key_column?: string
          sync_enabled?: boolean
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      demande_materiel: {
        Row: {
          article_id: string | null
          created_at: string
          demandeur_id: string | null
          demandeur_nom: string | null
          des: string
          etat_commande: string
          id: string
          quantite: number
          ref: string
          request_id: string
          request_number: string | null
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          demandeur_id?: string | null
          demandeur_nom?: string | null
          des: string
          etat_commande?: string
          id?: string
          quantite?: number
          ref: string
          request_id: string
          request_number?: string | null
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          demandeur_id?: string | null
          demandeur_nom?: string | null
          des?: string
          etat_commande?: string
          id?: string
          quantite?: number
          ref?: string
          request_id?: string
          request_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demande_materiel_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demande_materiel_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "demande_materiel_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          id_services_lucca: string | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          id_services_lucca?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          id_services_lucca?: string | null
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
      form_sections: {
        Row: {
          condition_field_id: string | null
          condition_operator: string | null
          condition_value: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_collapsed_by_default: boolean
          is_collapsible: boolean
          is_common: boolean
          label: string
          name: string
          order_index: number
          process_template_id: string | null
          sub_process_template_id: string | null
          updated_at: string
        }
        Insert: {
          condition_field_id?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_collapsed_by_default?: boolean
          is_collapsible?: boolean
          is_common?: boolean
          label: string
          name: string
          order_index?: number
          process_template_id?: string | null
          sub_process_template_id?: string | null
          updated_at?: string
        }
        Update: {
          condition_field_id?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_collapsed_by_default?: boolean
          is_collapsible?: boolean
          is_common?: boolean
          label?: string
          name?: string
          order_index?: number
          process_template_id?: string | null
          sub_process_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_sections_condition_field_id_fkey"
            columns: ["condition_field_id"]
            isOneToOne: false
            referencedRelation: "template_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_sections_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_sections_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "form_sections_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
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
      holidays: {
        Row: {
          company_id: string | null
          created_at: string
          date: string
          id: string
          is_national: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_national?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_national?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      notification_preferences: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          event_type: string
          frequency: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          event_type: string
          frequency?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          frequency?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      number_counters: {
        Row: {
          entity_type: string
          last_value: number
          project_code: string
          updated_at: string | null
        }
        Insert: {
          entity_type: string
          last_value?: number
          project_code: string
          updated_at?: string | null
        }
        Update: {
          entity_type?: string
          last_value?: number
          project_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      outlook_calendar_events: {
        Row: {
          attendees: Json | null
          color: string | null
          created_at: string
          end_time: string
          id: string
          is_all_day: boolean | null
          location: string | null
          organizer_email: string | null
          outlook_event_id: string
          start_time: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendees?: Json | null
          color?: string | null
          created_at?: string
          end_time: string
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          organizer_email?: string | null
          outlook_event_id: string
          start_time: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendees?: Json | null
          color?: string | null
          created_at?: string
          end_time?: string
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          organizer_email?: string | null
          outlook_event_id?: string
          start_time?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_device_visibility: {
        Row: {
          created_at: string
          id: string
          page_id: string
          page_label: string
          updated_at: string
          visible_on_desktop: boolean
          visible_on_mobile: boolean
          visible_on_tablet: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          page_id: string
          page_label: string
          updated_at?: string
          visible_on_desktop?: boolean
          visible_on_mobile?: boolean
          visible_on_tablet?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          page_id?: string
          page_label?: string
          updated_at?: string
          visible_on_desktop?: boolean
          visible_on_mobile?: boolean
          visible_on_tablet?: boolean
        }
        Relationships: []
      }
      pending_task_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assignee_id: string | null
          created_at: string
          created_task_id: string | null
          id: string
          process_template_id: string | null
          request_id: string
          status: string
          sub_process_template_id: string | null
          task_template_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignee_id?: string | null
          created_at?: string
          created_task_id?: string | null
          id?: string
          process_template_id?: string | null
          request_id: string
          status?: string
          sub_process_template_id?: string | null
          task_template_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignee_id?: string | null
          created_at?: string
          created_task_id?: string | null
          id?: string
          process_template_id?: string | null
          request_id?: string
          status?: string
          sub_process_template_id?: string | null
          task_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_task_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_assignments_created_task_id_fkey"
            columns: ["created_task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "pending_task_assignments_created_task_id_fkey"
            columns: ["created_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_assignments_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "pending_task_assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_assignments_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "pending_task_assignments_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_task_assignments_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profile_process_templates: {
        Row: {
          created_at: string
          id: string
          permission_profile_id: string
          process_template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_profile_id: string
          process_template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_profile_id?: string
          process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profile_process_templates_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_profile_process_templates_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          can_access_analytics: boolean
          can_access_calendar: boolean
          can_access_dashboard: boolean
          can_access_process_tracking: boolean
          can_access_projects: boolean
          can_access_requests: boolean
          can_access_settings: boolean
          can_access_suppliers: boolean
          can_access_tasks: boolean
          can_access_team: boolean
          can_access_templates: boolean
          can_access_workload: boolean
          can_assign_to_all: boolean
          can_assign_to_subordinates: boolean
          can_create_be_projects: boolean | null
          can_delete_be_projects: boolean | null
          can_edit_be_projects: boolean | null
          can_manage_all_tasks: boolean
          can_manage_own_tasks: boolean
          can_manage_subordinates_tasks: boolean
          can_manage_templates: boolean
          can_manage_users: boolean
          can_view_all_tasks: boolean
          can_view_be_projects: boolean | null
          can_view_own_tasks: boolean
          can_view_subordinates_tasks: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          can_access_analytics?: boolean
          can_access_calendar?: boolean
          can_access_dashboard?: boolean
          can_access_process_tracking?: boolean
          can_access_projects?: boolean
          can_access_requests?: boolean
          can_access_settings?: boolean
          can_access_suppliers?: boolean
          can_access_tasks?: boolean
          can_access_team?: boolean
          can_access_templates?: boolean
          can_access_workload?: boolean
          can_assign_to_all?: boolean
          can_assign_to_subordinates?: boolean
          can_create_be_projects?: boolean | null
          can_delete_be_projects?: boolean | null
          can_edit_be_projects?: boolean | null
          can_manage_all_tasks?: boolean
          can_manage_own_tasks?: boolean
          can_manage_subordinates_tasks?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_tasks?: boolean
          can_view_be_projects?: boolean | null
          can_view_own_tasks?: boolean
          can_view_subordinates_tasks?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          can_access_analytics?: boolean
          can_access_calendar?: boolean
          can_access_dashboard?: boolean
          can_access_process_tracking?: boolean
          can_access_projects?: boolean
          can_access_requests?: boolean
          can_access_settings?: boolean
          can_access_suppliers?: boolean
          can_access_tasks?: boolean
          can_access_team?: boolean
          can_access_templates?: boolean
          can_access_workload?: boolean
          can_assign_to_all?: boolean
          can_assign_to_subordinates?: boolean
          can_create_be_projects?: boolean | null
          can_delete_be_projects?: boolean | null
          can_edit_be_projects?: boolean | null
          can_manage_all_tasks?: boolean
          can_manage_own_tasks?: boolean
          can_manage_subordinates_tasks?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_tasks?: boolean
          can_view_be_projects?: boolean | null
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
      planner_bucket_mappings: {
        Row: {
          created_at: string
          id: string
          mapped_subcategory_id: string | null
          plan_mapping_id: string
          planner_bucket_id: string
          planner_bucket_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapped_subcategory_id?: string | null
          plan_mapping_id: string
          planner_bucket_id: string
          planner_bucket_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapped_subcategory_id?: string | null
          plan_mapping_id?: string
          planner_bucket_id?: string
          planner_bucket_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_bucket_mappings_mapped_subcategory_id_fkey"
            columns: ["mapped_subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_bucket_mappings_plan_mapping_id_fkey"
            columns: ["plan_mapping_id"]
            isOneToOne: false
            referencedRelation: "planner_plan_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_plan_mappings: {
        Row: {
          created_at: string
          default_priority: string | null
          default_reporter_id: string | null
          default_requester_id: string | null
          default_status: string | null
          id: string
          import_states: string[] | null
          last_sync_at: string | null
          mapped_category_id: string | null
          mapped_process_template_id: string | null
          planner_group_id: string | null
          planner_group_name: string | null
          planner_plan_id: string
          planner_plan_title: string
          resolve_assignees: boolean
          sync_direction: string
          sync_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_priority?: string | null
          default_reporter_id?: string | null
          default_requester_id?: string | null
          default_status?: string | null
          id?: string
          import_states?: string[] | null
          last_sync_at?: string | null
          mapped_category_id?: string | null
          mapped_process_template_id?: string | null
          planner_group_id?: string | null
          planner_group_name?: string | null
          planner_plan_id: string
          planner_plan_title: string
          resolve_assignees?: boolean
          sync_direction?: string
          sync_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_priority?: string | null
          default_reporter_id?: string | null
          default_requester_id?: string | null
          default_status?: string | null
          id?: string
          import_states?: string[] | null
          last_sync_at?: string | null
          mapped_category_id?: string | null
          mapped_process_template_id?: string | null
          planner_group_id?: string | null
          planner_group_name?: string | null
          planner_plan_id?: string
          planner_plan_title?: string
          resolve_assignees?: boolean
          sync_direction?: string
          sync_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_plan_mappings_default_reporter_id_fkey"
            columns: ["default_reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_plan_mappings_default_requester_id_fkey"
            columns: ["default_requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_plan_mappings_mapped_category_id_fkey"
            columns: ["mapped_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_plan_mappings_mapped_process_template_id_fkey"
            columns: ["mapped_process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_sync_logs: {
        Row: {
          created_at: string
          direction: string
          errors: Json | null
          id: string
          plan_mapping_id: string | null
          status: string
          tasks_pulled: number
          tasks_pushed: number
          tasks_updated: number
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          errors?: Json | null
          id?: string
          plan_mapping_id?: string | null
          status?: string
          tasks_pulled?: number
          tasks_pushed?: number
          tasks_updated?: number
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          errors?: Json | null
          id?: string
          plan_mapping_id?: string | null
          status?: string
          tasks_pulled?: number
          tasks_pushed?: number
          tasks_updated?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_sync_logs_plan_mapping_id_fkey"
            columns: ["plan_mapping_id"]
            isOneToOne: false
            referencedRelation: "planner_plan_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_task_links: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string
          local_task_id: string
          plan_mapping_id: string
          planner_assignee_email: string | null
          planner_assignee_name: string | null
          planner_etag: string | null
          planner_task_id: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string
          local_task_id: string
          plan_mapping_id: string
          planner_assignee_email?: string | null
          planner_assignee_name?: string | null
          planner_etag?: string | null
          planner_task_id: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string
          local_task_id?: string
          plan_mapping_id?: string
          planner_assignee_email?: string | null
          planner_assignee_name?: string | null
          planner_etag?: string | null
          planner_task_id?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_task_links_local_task_id_fkey"
            columns: ["local_task_id"]
            isOneToOne: true
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "planner_task_links_local_task_id_fkey"
            columns: ["local_task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_task_links_plan_mapping_id_fkey"
            columns: ["plan_mapping_id"]
            isOneToOne: false
            referencedRelation: "planner_plan_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      process_dashboard_configs: {
        Row: {
          columns_config: Json
          created_at: string
          filters_config: Json
          id: string
          process_template_id: string
          updated_at: string
          user_id: string
          widgets_config: Json
        }
        Insert: {
          columns_config?: Json
          created_at?: string
          filters_config?: Json
          id?: string
          process_template_id: string
          updated_at?: string
          user_id: string
          widgets_config?: Json
        }
        Update: {
          columns_config?: Json
          created_at?: string
          filters_config?: Json
          id?: string
          process_template_id?: string
          updated_at?: string
          user_id?: string
          widgets_config?: Json
        }
        Relationships: []
      }
      process_template_visible_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          process_template_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          process_template_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_visible_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_visible_companies_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_visible_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          process_template_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          process_template_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_visible_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_visible_departments_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_templates: {
        Row: {
          category_id: string | null
          company: string | null
          created_at: string
          creator_company_id: string | null
          creator_department_id: string | null
          department: string | null
          description: string | null
          form_schema: Json | null
          id: string
          is_shared: boolean
          name: string
          recurrence_delay_days: number | null
          recurrence_enabled: boolean
          recurrence_interval: number | null
          recurrence_next_run_at: string | null
          recurrence_start_date: string | null
          recurrence_unit: string | null
          service_group_id: string | null
          settings: Json | null
          subcategory_id: string | null
          target_company_id: string | null
          target_department_id: string | null
          updated_at: string
          user_id: string
          visibility_level: Database["public"]["Enums"]["template_visibility"]
        }
        Insert: {
          category_id?: string | null
          company?: string | null
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          department?: string | null
          description?: string | null
          form_schema?: Json | null
          id?: string
          is_shared?: boolean
          name: string
          recurrence_delay_days?: number | null
          recurrence_enabled?: boolean
          recurrence_interval?: number | null
          recurrence_next_run_at?: string | null
          recurrence_start_date?: string | null
          recurrence_unit?: string | null
          service_group_id?: string | null
          settings?: Json | null
          subcategory_id?: string | null
          target_company_id?: string | null
          target_department_id?: string | null
          updated_at?: string
          user_id: string
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
        }
        Update: {
          category_id?: string | null
          company?: string | null
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          department?: string | null
          description?: string | null
          form_schema?: Json | null
          id?: string
          is_shared?: boolean
          name?: string
          recurrence_delay_days?: number | null
          recurrence_enabled?: boolean
          recurrence_interval?: number | null
          recurrence_next_run_at?: string | null
          recurrence_start_date?: string | null
          recurrence_unit?: string | null
          service_group_id?: string | null
          settings?: Json | null
          subcategory_id?: string | null
          target_company_id?: string | null
          target_department_id?: string | null
          updated_at?: string
          user_id?: string
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "process_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_creator_company_id_fkey"
            columns: ["creator_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_creator_department_id_fkey"
            columns: ["creator_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_service_group_id_fkey"
            columns: ["service_group_id"]
            isOneToOne: false
            referencedRelation: "service_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_target_company_id_fkey"
            columns: ["target_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_templates_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      process_tracking_access: {
        Row: {
          can_read: boolean
          can_write: boolean
          created_at: string
          id: string
          process_template_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          process_template_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          process_template_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_tracking_access_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_tracking_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          id_lucca: string | null
          is_private: boolean
          job_title: string | null
          job_title_id: string | null
          lovable_email: string | null
          lovable_status: string | null
          manager_id: string | null
          must_change_password: boolean
          permission_profile_id: string | null
          secondary_email: string | null
          status: string
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
          id_lucca?: string | null
          is_private?: boolean
          job_title?: string | null
          job_title_id?: string | null
          lovable_email?: string | null
          lovable_status?: string | null
          manager_id?: string | null
          must_change_password?: boolean
          permission_profile_id?: string | null
          secondary_email?: string | null
          status?: string
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
          id_lucca?: string | null
          is_private?: boolean
          job_title?: string | null
          job_title_id?: string | null
          lovable_email?: string | null
          lovable_status?: string | null
          manager_id?: string | null
          must_change_password?: boolean
          permission_profile_id?: string | null
          secondary_email?: string | null
          status?: string
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
      project_view_configs: {
        Row: {
          column_filters: Json
          column_order: string[]
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string | null
          view_type: string
          visible_columns: string[]
        }
        Insert: {
          column_filters?: Json
          column_order?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string | null
          view_type: string
          visible_columns?: string[]
        }
        Update: {
          column_filters?: Json
          column_order?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string | null
          view_type?: string
          visible_columns?: string[]
        }
        Relationships: []
      }
      recurrence_runs: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          process_template_id: string
          request_id: string | null
          scheduled_at: string
          status: string
          sub_process_template_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          process_template_id: string
          request_id?: string | null
          scheduled_at: string
          status?: string
          sub_process_template_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          process_template_id?: string
          request_id?: string | null
          scheduled_at?: string
          status?: string
          sub_process_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_runs_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_runs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "recurrence_runs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_runs_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "recurrence_runs_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      request_field_values: {
        Row: {
          created_at: string
          field_id: string
          file_url: string | null
          id: string
          task_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          file_url?: string | null
          id?: string
          task_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          file_url?: string | null
          id?: string
          task_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "template_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_field_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "request_field_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      request_sub_processes: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          order_index: number
          request_id: string
          started_at: string | null
          status: string
          sub_process_number: string | null
          sub_process_template_id: string
          updated_at: string
          workflow_run_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          request_id: string
          started_at?: string | null
          status?: string
          sub_process_number?: string | null
          sub_process_template_id: string
          updated_at?: string
          workflow_run_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          request_id?: string
          started_at?: string | null
          status?: string
          sub_process_number?: string | null
          sub_process_template_id?: string
          updated_at?: string
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_sub_processes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "request_sub_processes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_sub_processes_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "request_sub_processes_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_sub_processes_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      request_trace_numbers: {
        Row: {
          created_at: string | null
          id: string
          project_code: string
          request_id: string | null
          request_number: string | null
          sub_process_instance_id: string | null
          sub_process_number: string | null
          task_id: string | null
          task_number: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_code: string
          request_id?: string | null
          request_number?: string | null
          sub_process_instance_id?: string | null
          sub_process_number?: string | null
          task_id?: string | null
          task_number?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_code?: string
          request_id?: string | null
          request_number?: string | null
          sub_process_instance_id?: string | null
          sub_process_number?: string | null
          task_id?: string | null
          task_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_trace_numbers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "request_trace_numbers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_trace_numbers_sub_process_instance_id_fkey"
            columns: ["sub_process_instance_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_run_id"]
          },
          {
            foreignKeyName: "request_trace_numbers_sub_process_instance_id_fkey"
            columns: ["sub_process_instance_id"]
            isOneToOne: false
            referencedRelation: "request_sub_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_trace_numbers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "request_trace_numbers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      service_group_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          service_group_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          service_group_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          service_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_group_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_group_departments_service_group_id_fkey"
            columns: ["service_group_id"]
            isOneToOne: false
            referencedRelation: "service_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      service_groups: {
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
      sub_process_template_visible_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          sub_process_template_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          sub_process_template_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          sub_process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_process_template_visible_compa_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_compa_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_process_template_visible_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          sub_process_template_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          sub_process_template_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          sub_process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_process_template_visible_depar_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_depar_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_process_templates: {
        Row: {
          assignment_type: string
          created_at: string
          creator_company_id: string | null
          creator_department_id: string | null
          description: string | null
          form_schema: Json | null
          id: string
          is_mandatory: boolean
          is_shared: boolean
          name: string
          order_index: number
          process_template_id: string
          recurrence_delay_days: number | null
          recurrence_enabled: boolean
          recurrence_interval: number | null
          recurrence_next_run_at: string | null
          recurrence_start_date: string | null
          recurrence_unit: string | null
          show_quick_launch: boolean
          target_assignee_id: string | null
          target_department_id: string | null
          target_group_id: string | null
          target_job_title_id: string | null
          target_manager_id: string | null
          updated_at: string
          user_id: string
          validation_config: Json | null
          visibility_level: Database["public"]["Enums"]["template_visibility"]
        }
        Insert: {
          assignment_type?: string
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          description?: string | null
          form_schema?: Json | null
          id?: string
          is_mandatory?: boolean
          is_shared?: boolean
          name: string
          order_index?: number
          process_template_id: string
          recurrence_delay_days?: number | null
          recurrence_enabled?: boolean
          recurrence_interval?: number | null
          recurrence_next_run_at?: string | null
          recurrence_start_date?: string | null
          recurrence_unit?: string | null
          show_quick_launch?: boolean
          target_assignee_id?: string | null
          target_department_id?: string | null
          target_group_id?: string | null
          target_job_title_id?: string | null
          target_manager_id?: string | null
          updated_at?: string
          user_id: string
          validation_config?: Json | null
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
        }
        Update: {
          assignment_type?: string
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          description?: string | null
          form_schema?: Json | null
          id?: string
          is_mandatory?: boolean
          is_shared?: boolean
          name?: string
          order_index?: number
          process_template_id?: string
          recurrence_delay_days?: number | null
          recurrence_enabled?: boolean
          recurrence_interval?: number | null
          recurrence_next_run_at?: string | null
          recurrence_start_date?: string | null
          recurrence_unit?: string | null
          show_quick_launch?: boolean
          target_assignee_id?: string | null
          target_department_id?: string | null
          target_group_id?: string | null
          target_job_title_id?: string | null
          target_manager_id?: string | null
          updated_at?: string
          user_id?: string
          validation_config?: Json | null
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "sub_process_templates_creator_company_id_fkey"
            columns: ["creator_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_creator_department_id_fkey"
            columns: ["creator_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_target_assignee_id_fkey"
            columns: ["target_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_target_job_title_id_fkey"
            columns: ["target_job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_target_manager_id_fkey"
            columns: ["target_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      supplier_categorisation: {
        Row: {
          active: boolean
          categorie: string
          catfam_key: string
          famille: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          categorie: string
          catfam_key: string
          famille: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          categorie?: string
          catfam_key?: string
          famille?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_purchase_enrichment: {
        Row: {
          adresse_mail: string | null
          avenants: string | null
          categorie: string | null
          commentaires: string | null
          completeness_score: number | null
          created_at: string | null
          date_premiere_signature: string | null
          delai_de_paiement: string | null
          echeances_de_paiement: string | null
          entite: string | null
          evolution_tarif_2026: string | null
          exclusivite_non_sollicitation: string | null
          famille: string | null
          famille_source_initiale: string | null
          garanties_bancaire_et_equipement: string | null
          id: string
          incoterm: string | null
          nom_contact: string | null
          nomfournisseur: string | null
          penalites: string | null
          poste: string | null
          remise: string | null
          rfa: string | null
          segment: string | null
          sous_segment: string | null
          status: string | null
          telephone: string | null
          tiers: string
          transport: string | null
          type_de_contrat: string | null
          updated_at: string | null
          updated_by: string | null
          validite_du_contrat: string | null
          validite_prix: string | null
        }
        Insert: {
          adresse_mail?: string | null
          avenants?: string | null
          categorie?: string | null
          commentaires?: string | null
          completeness_score?: number | null
          created_at?: string | null
          date_premiere_signature?: string | null
          delai_de_paiement?: string | null
          echeances_de_paiement?: string | null
          entite?: string | null
          evolution_tarif_2026?: string | null
          exclusivite_non_sollicitation?: string | null
          famille?: string | null
          famille_source_initiale?: string | null
          garanties_bancaire_et_equipement?: string | null
          id?: string
          incoterm?: string | null
          nom_contact?: string | null
          nomfournisseur?: string | null
          penalites?: string | null
          poste?: string | null
          remise?: string | null
          rfa?: string | null
          segment?: string | null
          sous_segment?: string | null
          status?: string | null
          telephone?: string | null
          tiers: string
          transport?: string | null
          type_de_contrat?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validite_du_contrat?: string | null
          validite_prix?: string | null
        }
        Update: {
          adresse_mail?: string | null
          avenants?: string | null
          categorie?: string | null
          commentaires?: string | null
          completeness_score?: number | null
          created_at?: string | null
          date_premiere_signature?: string | null
          delai_de_paiement?: string | null
          echeances_de_paiement?: string | null
          entite?: string | null
          evolution_tarif_2026?: string | null
          exclusivite_non_sollicitation?: string | null
          famille?: string | null
          famille_source_initiale?: string | null
          garanties_bancaire_et_equipement?: string | null
          id?: string
          incoterm?: string | null
          nom_contact?: string | null
          nomfournisseur?: string | null
          penalites?: string | null
          poste?: string | null
          remise?: string | null
          rfa?: string | null
          segment?: string | null
          sous_segment?: string | null
          status?: string | null
          telephone?: string | null
          tiers?: string
          transport?: string | null
          type_de_contrat?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validite_du_contrat?: string | null
          validite_prix?: string | null
        }
        Relationships: []
      }
      supplier_purchase_permissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_taxonomy: {
        Row: {
          active: boolean
          categorie: string
          famille: string
          id: string
          segment: string
          sous_segment: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          categorie: string
          famille: string
          id?: string
          segment: string
          sous_segment?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          categorie?: string
          famille?: string
          id?: string
          segment?: string
          sous_segment?: string | null
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
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
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
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
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_transitions: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string
          id: string
          metadata: Json | null
          reason: string | null
          refusal_reason: string | null
          task_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          refusal_reason?: string | null
          task_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          refusal_reason?: string | null
          task_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_transitions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "task_status_transitions_task_id_fkey"
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
      task_template_visible_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          task_template_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          task_template_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          task_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_visible_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_visible_companies_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_visible_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          task_template_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          task_template_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          task_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_visible_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_visible_departments_task_template_id_fkey"
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
          creator_company_id: string | null
          creator_department_id: string | null
          default_duration_days: number | null
          depends_on_task_template_id: string | null
          description: string | null
          id: string
          initial_status: string | null
          is_shared: boolean
          order_index: number | null
          priority: string
          process_template_id: string | null
          requires_validation: boolean | null
          sub_process_template_id: string | null
          subcategory_id: string | null
          target_group_id: string | null
          title: string
          updated_at: string
          user_id: string
          validation_level_1: string | null
          validation_level_2: string | null
          validator_level_1_id: string | null
          validator_level_2_id: string | null
          visibility_level: Database["public"]["Enums"]["template_visibility"]
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          default_duration_days?: number | null
          depends_on_task_template_id?: string | null
          description?: string | null
          id?: string
          initial_status?: string | null
          is_shared?: boolean
          order_index?: number | null
          priority?: string
          process_template_id?: string | null
          requires_validation?: boolean | null
          sub_process_template_id?: string | null
          subcategory_id?: string | null
          target_group_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          validation_level_1?: string | null
          validation_level_2?: string | null
          validator_level_1_id?: string | null
          validator_level_2_id?: string | null
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
        }
        Update: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          default_duration_days?: number | null
          depends_on_task_template_id?: string | null
          description?: string | null
          id?: string
          initial_status?: string | null
          is_shared?: boolean
          order_index?: number | null
          priority?: string
          process_template_id?: string | null
          requires_validation?: boolean | null
          sub_process_template_id?: string | null
          subcategory_id?: string | null
          target_group_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          validation_level_1?: string | null
          validation_level_2?: string | null
          validator_level_1_id?: string | null
          validator_level_2_id?: string | null
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
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
            foreignKeyName: "task_templates_creator_company_id_fkey"
            columns: ["creator_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_creator_department_id_fkey"
            columns: ["creator_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_depends_on_task_template_id_fkey"
            columns: ["depends_on_task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
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
            foreignKeyName: "task_templates_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "task_templates_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_validator_level_1_id_fkey"
            columns: ["validator_level_1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_validator_level_2_id_fkey"
            columns: ["validator_level_2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
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
          be_label_id: string | null
          be_project_id: string | null
          category: string | null
          category_id: string | null
          created_at: string
          current_validation_level: number | null
          depends_on_task_id: string | null
          description: string | null
          due_date: string | null
          group_assignee_ids: string[] | null
          id: string
          is_assignment_task: boolean
          is_dependency_locked: boolean | null
          is_locked_for_validation: boolean | null
          original_assignee_id: string | null
          parent_request_id: string | null
          parent_sub_process_run_id: string | null
          planner_labels: string[] | null
          priority: string
          process_template_id: string | null
          rbe_validated_at: string | null
          rbe_validation_comment: string | null
          rbe_validation_status: string | null
          rbe_validator_id: string | null
          reporter_id: string | null
          request_number: string | null
          request_validated_by_1: string | null
          request_validated_by_2: string | null
          request_validation_1_at: string | null
          request_validation_1_comment: string | null
          request_validation_2_at: string | null
          request_validation_2_comment: string | null
          request_validation_enabled: boolean
          request_validation_refusal_action: string | null
          request_validation_status: string
          request_validator_id_1: string | null
          request_validator_id_2: string | null
          request_validator_type_1: string | null
          request_validator_type_2: string | null
          requester_id: string | null
          requester_validated_at: string | null
          requester_validation_comment: string | null
          requester_validation_status: string | null
          requires_validation: boolean | null
          source_process_template_id: string | null
          source_sub_process_template_id: string | null
          start_date: string | null
          status: string
          subcategory_id: string | null
          target_department_id: string | null
          task_number: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_1_at: string | null
          validation_1_by: string | null
          validation_1_comment: string | null
          validation_1_status: string | null
          validation_2_at: string | null
          validation_2_by: string | null
          validation_2_comment: string | null
          validation_2_status: string | null
          validation_comment: string | null
          validation_level_1: string | null
          validation_level_2: string | null
          validation_requested_at: string | null
          validator_id: string | null
          validator_level_1_id: string | null
          validator_level_2_id: string | null
          workflow_run_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          be_label_id?: string | null
          be_project_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          current_validation_level?: number | null
          depends_on_task_id?: string | null
          description?: string | null
          due_date?: string | null
          group_assignee_ids?: string[] | null
          id?: string
          is_assignment_task?: boolean
          is_dependency_locked?: boolean | null
          is_locked_for_validation?: boolean | null
          original_assignee_id?: string | null
          parent_request_id?: string | null
          parent_sub_process_run_id?: string | null
          planner_labels?: string[] | null
          priority?: string
          process_template_id?: string | null
          rbe_validated_at?: string | null
          rbe_validation_comment?: string | null
          rbe_validation_status?: string | null
          rbe_validator_id?: string | null
          reporter_id?: string | null
          request_number?: string | null
          request_validated_by_1?: string | null
          request_validated_by_2?: string | null
          request_validation_1_at?: string | null
          request_validation_1_comment?: string | null
          request_validation_2_at?: string | null
          request_validation_2_comment?: string | null
          request_validation_enabled?: boolean
          request_validation_refusal_action?: string | null
          request_validation_status?: string
          request_validator_id_1?: string | null
          request_validator_id_2?: string | null
          request_validator_type_1?: string | null
          request_validator_type_2?: string | null
          requester_id?: string | null
          requester_validated_at?: string | null
          requester_validation_comment?: string | null
          requester_validation_status?: string | null
          requires_validation?: boolean | null
          source_process_template_id?: string | null
          source_sub_process_template_id?: string | null
          start_date?: string | null
          status?: string
          subcategory_id?: string | null
          target_department_id?: string | null
          task_number?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_1_at?: string | null
          validation_1_by?: string | null
          validation_1_comment?: string | null
          validation_1_status?: string | null
          validation_2_at?: string | null
          validation_2_by?: string | null
          validation_2_comment?: string | null
          validation_2_status?: string | null
          validation_comment?: string | null
          validation_level_1?: string | null
          validation_level_2?: string | null
          validation_requested_at?: string | null
          validator_id?: string | null
          validator_level_1_id?: string | null
          validator_level_2_id?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          be_label_id?: string | null
          be_project_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          current_validation_level?: number | null
          depends_on_task_id?: string | null
          description?: string | null
          due_date?: string | null
          group_assignee_ids?: string[] | null
          id?: string
          is_assignment_task?: boolean
          is_dependency_locked?: boolean | null
          is_locked_for_validation?: boolean | null
          original_assignee_id?: string | null
          parent_request_id?: string | null
          parent_sub_process_run_id?: string | null
          planner_labels?: string[] | null
          priority?: string
          process_template_id?: string | null
          rbe_validated_at?: string | null
          rbe_validation_comment?: string | null
          rbe_validation_status?: string | null
          rbe_validator_id?: string | null
          reporter_id?: string | null
          request_number?: string | null
          request_validated_by_1?: string | null
          request_validated_by_2?: string | null
          request_validation_1_at?: string | null
          request_validation_1_comment?: string | null
          request_validation_2_at?: string | null
          request_validation_2_comment?: string | null
          request_validation_enabled?: boolean
          request_validation_refusal_action?: string | null
          request_validation_status?: string
          request_validator_id_1?: string | null
          request_validator_id_2?: string | null
          request_validator_type_1?: string | null
          request_validator_type_2?: string | null
          requester_id?: string | null
          requester_validated_at?: string | null
          requester_validation_comment?: string | null
          requester_validation_status?: string | null
          requires_validation?: boolean | null
          source_process_template_id?: string | null
          source_sub_process_template_id?: string | null
          start_date?: string | null
          status?: string
          subcategory_id?: string | null
          target_department_id?: string | null
          task_number?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_1_at?: string | null
          validation_1_by?: string | null
          validation_1_comment?: string | null
          validation_1_status?: string | null
          validation_2_at?: string | null
          validation_2_by?: string | null
          validation_2_comment?: string | null
          validation_2_status?: string | null
          validation_comment?: string | null
          validation_level_1?: string | null
          validation_level_2?: string | null
          validation_requested_at?: string | null
          validator_id?: string | null
          validator_level_1_id?: string | null
          validator_level_2_id?: string | null
          workflow_run_id?: string | null
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
            foreignKeyName: "tasks_be_label_id_fkey"
            columns: ["be_label_id"]
            isOneToOne: false
            referencedRelation: "be_task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
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
            foreignKeyName: "tasks_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "tasks_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_original_assignee_id_fkey"
            columns: ["original_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "tasks_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_sub_process_run_id_fkey"
            columns: ["parent_sub_process_run_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_run_id"]
          },
          {
            foreignKeyName: "tasks_parent_sub_process_run_id_fkey"
            columns: ["parent_sub_process_run_id"]
            isOneToOne: false
            referencedRelation: "request_sub_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_rbe_validator_id_fkey"
            columns: ["rbe_validator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "tasks_source_sub_process_template_id_fkey"
            columns: ["source_sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "tasks_source_sub_process_template_id_fkey"
            columns: ["source_sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
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
            foreignKeyName: "tasks_validation_1_by_fkey"
            columns: ["validation_1_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_validation_2_by_fkey"
            columns: ["validation_2_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_validator_id_fkey"
            columns: ["validator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_validator_level_1_id_fkey"
            columns: ["validator_level_1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_validator_level_2_id_fkey"
            columns: ["validator_level_2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      template_custom_fields: {
        Row: {
          additional_conditions: Json | null
          column_index: number
          column_span: number
          condition_field_id: string | null
          condition_operator: string | null
          condition_value: string | null
          conditions_logic: string | null
          created_at: string
          created_by: string | null
          default_value: string | null
          description: string | null
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_common: boolean
          is_required: boolean
          label: string
          lookup_label_column: string | null
          lookup_table: string | null
          lookup_value_column: string | null
          max_value: number | null
          min_value: number | null
          name: string
          options: Json | null
          order_index: number
          placeholder: string | null
          process_template_id: string | null
          row_index: number | null
          section_id: string | null
          sub_process_template_id: string | null
          updated_at: string
          validation_message: string | null
          validation_params: Json | null
          validation_regex: string | null
          validation_type: string | null
          width_ratio: number | null
        }
        Insert: {
          additional_conditions?: Json | null
          column_index?: number
          column_span?: number
          condition_field_id?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          conditions_logic?: string | null
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          description?: string | null
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_common?: boolean
          is_required?: boolean
          label: string
          lookup_label_column?: string | null
          lookup_table?: string | null
          lookup_value_column?: string | null
          max_value?: number | null
          min_value?: number | null
          name: string
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          process_template_id?: string | null
          row_index?: number | null
          section_id?: string | null
          sub_process_template_id?: string | null
          updated_at?: string
          validation_message?: string | null
          validation_params?: Json | null
          validation_regex?: string | null
          validation_type?: string | null
          width_ratio?: number | null
        }
        Update: {
          additional_conditions?: Json | null
          column_index?: number
          column_span?: number
          condition_field_id?: string | null
          condition_operator?: string | null
          condition_value?: string | null
          conditions_logic?: string | null
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          description?: string | null
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_common?: boolean
          is_required?: boolean
          label?: string
          lookup_label_column?: string | null
          lookup_table?: string | null
          lookup_value_column?: string | null
          max_value?: number | null
          min_value?: number | null
          name?: string
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          process_template_id?: string | null
          row_index?: number | null
          section_id?: string | null
          sub_process_template_id?: string | null
          updated_at?: string
          validation_message?: string | null
          validation_params?: Json | null
          validation_regex?: string | null
          validation_type?: string | null
          width_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_custom_fields_condition_field_id_fkey"
            columns: ["condition_field_id"]
            isOneToOne: false
            referencedRelation: "template_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_custom_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_custom_fields_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_custom_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "form_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_custom_fields_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "template_custom_fields_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
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
      user_dashboard_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_filter_presets: {
        Row: {
          context_type: string
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          process_template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_type?: string
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          process_template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_type?: string
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          process_template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_leaves: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          end_half_day: string | null
          id: string
          id_lucca: string | null
          leave_type: string
          start_date: string
          start_half_day: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          end_half_day?: string | null
          id?: string
          id_lucca?: string | null
          leave_type?: string
          start_date: string
          start_half_day?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          end_half_day?: string | null
          id?: string
          id_lucca?: string | null
          leave_type?: string
          start_date?: string
          start_half_day?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_leaves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_microsoft_connections: {
        Row: {
          access_token: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_calendar_sync_enabled: boolean | null
          is_email_sync_enabled: boolean | null
          last_sync_at: string | null
          profile_id: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_calendar_sync_enabled?: boolean | null
          is_email_sync_enabled?: boolean | null
          last_sync_at?: string | null
          profile_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_calendar_sync_enabled?: boolean | null
          is_email_sync_enabled?: boolean | null
          last_sync_at?: string | null
          profile_id?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_microsoft_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          can_access_analytics: boolean | null
          can_access_calendar: boolean | null
          can_access_dashboard: boolean | null
          can_access_process_tracking: boolean | null
          can_access_projects: boolean | null
          can_access_requests: boolean | null
          can_access_settings: boolean | null
          can_access_suppliers: boolean | null
          can_access_tasks: boolean | null
          can_access_team: boolean | null
          can_access_templates: boolean | null
          can_access_workload: boolean | null
          can_assign_to_all: boolean | null
          can_assign_to_subordinates: boolean | null
          can_create_be_projects: boolean | null
          can_delete_be_projects: boolean | null
          can_edit_be_projects: boolean | null
          can_manage_all_tasks: boolean | null
          can_manage_own_tasks: boolean | null
          can_manage_subordinates_tasks: boolean | null
          can_manage_templates: boolean | null
          can_manage_users: boolean | null
          can_view_all_tasks: boolean | null
          can_view_be_projects: boolean | null
          can_view_own_tasks: boolean | null
          can_view_subordinates_tasks: boolean | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access_analytics?: boolean | null
          can_access_calendar?: boolean | null
          can_access_dashboard?: boolean | null
          can_access_process_tracking?: boolean | null
          can_access_projects?: boolean | null
          can_access_requests?: boolean | null
          can_access_settings?: boolean | null
          can_access_suppliers?: boolean | null
          can_access_tasks?: boolean | null
          can_access_team?: boolean | null
          can_access_templates?: boolean | null
          can_access_workload?: boolean | null
          can_assign_to_all?: boolean | null
          can_assign_to_subordinates?: boolean | null
          can_create_be_projects?: boolean | null
          can_delete_be_projects?: boolean | null
          can_edit_be_projects?: boolean | null
          can_manage_all_tasks?: boolean | null
          can_manage_own_tasks?: boolean | null
          can_manage_subordinates_tasks?: boolean | null
          can_manage_templates?: boolean | null
          can_manage_users?: boolean | null
          can_view_all_tasks?: boolean | null
          can_view_be_projects?: boolean | null
          can_view_own_tasks?: boolean | null
          can_view_subordinates_tasks?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access_analytics?: boolean | null
          can_access_calendar?: boolean | null
          can_access_dashboard?: boolean | null
          can_access_process_tracking?: boolean | null
          can_access_projects?: boolean | null
          can_access_requests?: boolean | null
          can_access_settings?: boolean | null
          can_access_suppliers?: boolean | null
          can_access_tasks?: boolean | null
          can_access_team?: boolean | null
          can_access_templates?: boolean | null
          can_access_workload?: boolean | null
          can_assign_to_all?: boolean | null
          can_assign_to_subordinates?: boolean | null
          can_create_be_projects?: boolean | null
          can_delete_be_projects?: boolean | null
          can_edit_be_projects?: boolean | null
          can_manage_all_tasks?: boolean | null
          can_manage_own_tasks?: boolean | null
          can_manage_subordinates_tasks?: boolean | null
          can_manage_templates?: boolean | null
          can_manage_users?: boolean | null
          can_view_all_tasks?: boolean | null
          can_view_be_projects?: boolean | null
          can_view_own_tasks?: boolean | null
          can_view_subordinates_tasks?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_process_template_overrides: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          process_template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          process_template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          process_template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_process_template_overrides_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_process_template_overrides_user_id_fkey"
            columns: ["user_id"]
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
      widget_layout_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          widgets_config: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
          widgets_config?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          widgets_config?: Json
        }
        Relationships: []
      }
      workflow_autonumber_sequences: {
        Row: {
          created_at: string
          current_value: number
          id: string
          last_reset_at: string
          updated_at: string
          variable_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          last_reset_at?: string
          updated_at?: string
          variable_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          last_reset_at?: string
          updated_at?: string
          variable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_autonumber_sequences_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: true
            referencedRelation: "workflow_variables"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_branch_instances: {
        Row: {
          branch_id: string
          completed_at: string | null
          context_data: Json | null
          created_at: string
          current_node_id: string | null
          fork_node_id: string | null
          id: string
          run_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          completed_at?: string | null
          context_data?: Json | null
          created_at?: string
          current_node_id?: string | null
          fork_node_id?: string | null
          id?: string
          run_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          completed_at?: string | null
          context_data?: Json | null
          created_at?: string
          current_node_id?: string | null
          fork_node_id?: string | null
          id?: string
          run_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_branch_instances_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_branch_instances_fork_node_id_fkey"
            columns: ["fork_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_branch_instances_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_datalake_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          direction: Database["public"]["Enums"]["datalake_sync_direction"]
          duration_ms: number | null
          error_message: string | null
          id: string
          mode: Database["public"]["Enums"]["datalake_sync_mode"]
          node_id: string | null
          rows_read: number | null
          rows_written: number | null
          run_id: string | null
          started_at: string | null
          status: string
          tables_synced: string[]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["datalake_sync_direction"]
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["datalake_sync_mode"]
          node_id?: string | null
          rows_read?: number | null
          rows_written?: number | null
          run_id?: string | null
          started_at?: string | null
          status?: string
          tables_synced?: string[]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["datalake_sync_direction"]
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["datalake_sync_mode"]
          node_id?: string | null
          rows_read?: number | null
          rows_written?: number | null
          run_id?: string | null
          started_at?: string | null
          status?: string
          tables_synced?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_datalake_sync_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_datalake_sync_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_edges: {
        Row: {
          animated: boolean | null
          branch_label: string | null
          condition_expression: Json | null
          created_at: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          style: Json | null
          target_handle: string | null
          target_node_id: string
          workflow_id: string
        }
        Insert: {
          animated?: boolean | null
          branch_label?: string | null
          condition_expression?: Json | null
          created_at?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          style?: Json | null
          target_handle?: string | null
          target_node_id: string
          workflow_id: string
        }
        Update: {
          animated?: boolean | null
          branch_label?: string | null
          condition_expression?: Json | null
          created_at?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          style?: Json | null
          target_handle?: string | null
          target_node_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_edges_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          run_id: string | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          run_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          run_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_execution_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: string
          node_id: string | null
          run_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          node_id?: string | null
          run_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          node_id?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_execution_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_nodes: {
        Row: {
          config: Json
          created_at: string
          height: number | null
          id: string
          label: string
          node_type: Database["public"]["Enums"]["workflow_node_type"]
          position_x: number
          position_y: number
          style: Json | null
          task_template_id: string | null
          updated_at: string
          width: number | null
          workflow_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          height?: number | null
          id?: string
          label: string
          node_type: Database["public"]["Enums"]["workflow_node_type"]
          position_x?: number
          position_y?: number
          style?: Json | null
          task_template_id?: string | null
          updated_at?: string
          width?: number | null
          workflow_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          height?: number | null
          id?: string
          label?: string
          node_type?: Database["public"]["Enums"]["workflow_node_type"]
          position_x?: number
          position_y?: number
          style?: Json | null
          task_template_id?: string | null
          updated_at?: string
          width?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_nodes_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_nodes_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_notifications: {
        Row: {
          action_url: string | null
          body: string
          branch_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error_message: string | null
          id: string
          node_id: string
          recipient_email: string | null
          recipient_id: string | null
          recipient_type: string
          retry_count: number | null
          run_id: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          action_url?: string | null
          body: string
          branch_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          node_id: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_type: string
          retry_count?: number | null
          run_id: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          action_url?: string | null
          body?: string
          branch_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          node_id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_type?: string
          retry_count?: number | null
          run_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_notifications_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_notifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          active_branches: Json | null
          branch_statuses: Json | null
          completed_at: string | null
          completed_branches: Json | null
          context_data: Json | null
          created_at: string
          current_node_id: string | null
          execution_log: Json | null
          id: string
          started_at: string
          started_by: string | null
          status: Database["public"]["Enums"]["workflow_run_status"]
          trigger_entity_id: string
          trigger_entity_type: string
          updated_at: string
          workflow_id: string
          workflow_version: number
        }
        Insert: {
          active_branches?: Json | null
          branch_statuses?: Json | null
          completed_at?: string | null
          completed_branches?: Json | null
          context_data?: Json | null
          created_at?: string
          current_node_id?: string | null
          execution_log?: Json | null
          id?: string
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["workflow_run_status"]
          trigger_entity_id: string
          trigger_entity_type: string
          updated_at?: string
          workflow_id: string
          workflow_version: number
        }
        Update: {
          active_branches?: Json | null
          branch_statuses?: Json | null
          completed_at?: string | null
          completed_branches?: Json | null
          context_data?: Json | null
          created_at?: string
          current_node_id?: string | null
          execution_log?: Json | null
          id?: string
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["workflow_run_status"]
          trigger_entity_id?: string
          trigger_entity_type?: string
          updated_at?: string
          workflow_id?: string
          workflow_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_template_versions: {
        Row: {
          change_notes: string | null
          edges_snapshot: Json
          id: string
          nodes_snapshot: Json
          published_at: string
          published_by: string | null
          settings_snapshot: Json | null
          version: number
          workflow_id: string
        }
        Insert: {
          change_notes?: string | null
          edges_snapshot: Json
          id?: string
          nodes_snapshot: Json
          published_at?: string
          published_by?: string | null
          settings_snapshot?: Json | null
          version: number
          workflow_id: string
        }
        Update: {
          change_notes?: string | null
          edges_snapshot?: Json
          id?: string
          nodes_snapshot?: Json
          published_at?: string
          published_by?: string | null
          settings_snapshot?: Json | null
          version?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_template_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          canvas_settings: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          process_template_id: string | null
          published_at: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          sub_process_template_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          canvas_settings?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          process_template_id?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          sub_process_template_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          canvas_settings?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          process_template_id?: string | null
          published_at?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          sub_process_template_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_templates_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "workflow_templates_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_validation_instances: {
        Row: {
          approver_id: string | null
          approver_role: string | null
          approver_type: string
          branch_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          due_at: string | null
          id: string
          node_id: string
          prerequisite_config: Json | null
          prerequisites_met: boolean | null
          reminded_at: string | null
          reminder_count: number | null
          run_id: string
          status: Database["public"]["Enums"]["validation_instance_status"]
          trigger_mode: string | null
          triggered_at: string | null
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          approver_role?: string | null
          approver_type: string
          branch_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          due_at?: string | null
          id?: string
          node_id: string
          prerequisite_config?: Json | null
          prerequisites_met?: boolean | null
          reminded_at?: string | null
          reminder_count?: number | null
          run_id: string
          status?: Database["public"]["Enums"]["validation_instance_status"]
          trigger_mode?: string | null
          triggered_at?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          approver_role?: string | null
          approver_type?: string
          branch_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          due_at?: string | null
          id?: string
          node_id?: string
          prerequisite_config?: Json | null
          prerequisites_met?: boolean | null
          reminded_at?: string | null
          reminder_count?: number | null
          run_id?: string
          status?: Database["public"]["Enums"]["validation_instance_status"]
          trigger_mode?: string | null
          triggered_at?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_validation_instances_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_validation_instances_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_validation_instances_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_variable_instances: {
        Row: {
          computed_at: string
          created_at: string
          current_value: Json | null
          id: string
          run_id: string
          variable_id: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          current_value?: Json | null
          id?: string
          run_id: string
          variable_id: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          current_value?: Json | null
          id?: string
          run_id?: string
          variable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_variable_instances_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_variable_instances_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "workflow_variables"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_variables: {
        Row: {
          autonumber_padding: number | null
          autonumber_prefix: string | null
          autonumber_reset: string | null
          created_at: string
          datetime_mode: string | null
          default_value: Json | null
          expression: string | null
          id: string
          name: string
          scope: string
          updated_at: string
          variable_type: Database["public"]["Enums"]["workflow_variable_type"]
          workflow_id: string
        }
        Insert: {
          autonumber_padding?: number | null
          autonumber_prefix?: string | null
          autonumber_reset?: string | null
          created_at?: string
          datetime_mode?: string | null
          default_value?: Json | null
          expression?: string | null
          id?: string
          name: string
          scope?: string
          updated_at?: string
          variable_type?: Database["public"]["Enums"]["workflow_variable_type"]
          workflow_id: string
        }
        Update: {
          autonumber_padding?: number | null
          autonumber_prefix?: string | null
          autonumber_reset?: string | null
          created_at?: string
          datetime_mode?: string | null
          default_value?: Json | null
          expression?: string | null
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          variable_type?: Database["public"]["Enums"]["workflow_variable_type"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_variables_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workload_slots: {
        Row: {
          created_at: string
          date: string
          half_day: string
          id: string
          notes: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          half_day: string
          id?: string
          notes?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          half_day?: string
          id?: string
          notes?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workload_slots_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "workload_slots_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      request_progress_view: {
        Row: {
          completed_task_count: number | null
          progress_percent: number | null
          request_created_at: string | null
          request_id: string | null
          request_status: string | null
          request_title: string | null
          sub_process_name: string | null
          sub_process_order: number | null
          sub_process_run_id: string | null
          sub_process_status: string | null
          sub_process_template_id: string | null
          task_count: number | null
        }
        Relationships: []
      }
      user_microsoft_connections_public: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string | null
          is_calendar_sync_enabled: boolean | null
          is_email_sync_enabled: boolean | null
          last_sync_at: string | null
          profile_id: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string | null
          is_calendar_sync_enabled?: boolean | null
          is_email_sync_enabled?: boolean | null
          last_sync_at?: string | null
          profile_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string | null
          is_calendar_sync_enabled?: boolean | null
          is_email_sync_enabled?: boolean | null
          last_sync_at?: string | null
          profile_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_microsoft_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_supplier_completeness: {
        Args: {
          p_adresse_mail: string
          p_categorie: string
          p_delai_de_paiement: string
          p_entite: string
          p_famille: string
          p_incoterm: string
          p_nom_contact: string
          p_segment: string
          p_telephone: string
          p_type_de_contrat: string
        }
        Returns: number
      }
      can_access_task: { Args: { _task_id: string }; Returns: boolean }
      can_assign_tasks: { Args: never; Returns: boolean }
      can_manage_template: { Args: { _creator_id: string }; Returns: boolean }
      can_read_process_tracking: {
        Args: { _process_template_id: string }
        Returns: boolean
      }
      can_view_template:
        | {
            Args: {
              _creator_company_id: string
              _creator_department_id: string
              _creator_id: string
              _visibility: Database["public"]["Enums"]["template_visibility"]
            }
            Returns: boolean
          }
        | {
            Args: {
              _creator_company_id: string
              _creator_department_id: string
              _creator_id: string
              _template_id?: string
              _template_type?: string
              _visibility: Database["public"]["Enums"]["template_visibility"]
            }
            Returns: boolean
          }
      can_write_process_tracking: {
        Args: { _process_template_id: string }
        Returns: boolean
      }
      cancel_request: { Args: { p_request_id: string }; Returns: undefined }
      compute_next_recurrence: {
        Args: { p_current: string; p_interval: number; p_unit: string }
        Returns: string
      }
      create_group_conversation: {
        Args: { _created_by: string; _member_ids: string[]; _title: string }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      current_department_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      emit_workflow_event: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_payload?: Json
          p_run_id?: string
        }
        Returns: string
      }
      find_or_create_dm: {
        Args: { _user_a: string; _user_b: string }
        Returns: string
      }
      find_or_create_request_chat: {
        Args: { _request_id: string; _user_id: string }
        Returns: string
      }
      generate_default_form_schema: {
        Args: { p_process_id: string }
        Returns: Json
      }
      generate_standard_process_access: { Args: never; Returns: Json }
      get_active_workflow: {
        Args: {
          _process_template_id?: string
          _sub_process_template_id?: string
        }
        Returns: string
      }
      get_all_profiles_for_hierarchy: {
        Args: never
        Returns: {
          avatar_url: string
          company: string
          company_id: string
          department: string
          department_id: string
          display_name: string
          hierarchy_level_id: string
          id: string
          job_title: string
          job_title_id: string
          manager_id: string
          permission_profile_id: string
          user_id: string
        }[]
      }
      get_my_company_id: { Args: never; Returns: string }
      get_my_department_id: { Args: never; Returns: string }
      get_my_manager_profile_id: { Args: never; Returns: string }
      get_my_profile_id: { Args: never; Returns: string }
      get_next_autonumber: {
        Args: { p_reset_mode?: string; p_variable_id: string }
        Returns: number
      }
      get_project_code_for_entity: {
        Args: { p_be_project_id?: string; p_parent_request_id?: string }
        Returns: string
      }
      get_total_unread_count: { Args: { _user_id: string }; Returns: number }
      get_unread_count: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_supplier_access: { Args: never; Returns: boolean }
      is_chat_admin: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      next_entity_number: {
        Args: { p_entity_type: string; p_project_code: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      custom_field_type:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "datetime"
        | "email"
        | "phone"
        | "url"
        | "checkbox"
        | "select"
        | "multiselect"
        | "user_search"
        | "department_search"
        | "file"
        | "table_lookup"
        | "repeatable_table"
      datalake_sync_direction: "app_to_datalake" | "datalake_to_app"
      datalake_sync_mode: "full" | "incremental"
      datalake_upsert_strategy: "insert_only" | "upsert" | "overwrite"
      notification_channel: "in_app" | "email" | "teams"
      template_visibility:
        | "private"
        | "internal_department"
        | "internal_company"
        | "public"
      validation_instance_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "skipped"
      validation_type: "none" | "manager" | "requester" | "free"
      workflow_node_type:
        | "start"
        | "end"
        | "task"
        | "validation"
        | "notification"
        | "condition"
        | "sub_process"
        | "fork"
        | "join"
        | "status_change"
        | "assignment"
        | "set_variable"
        | "datalake_sync"
        | "sub_process_standard_direct"
        | "sub_process_standard_manager"
        | "sub_process_standard_validation1"
        | "sub_process_standard_validation2"
      workflow_run_status:
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "paused"
      workflow_status: "draft" | "active" | "inactive" | "archived"
      workflow_variable_type:
        | "text"
        | "boolean"
        | "integer"
        | "decimal"
        | "datetime"
        | "autonumber"
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
      custom_field_type: [
        "text",
        "textarea",
        "number",
        "date",
        "datetime",
        "email",
        "phone",
        "url",
        "checkbox",
        "select",
        "multiselect",
        "user_search",
        "department_search",
        "file",
        "table_lookup",
        "repeatable_table",
      ],
      datalake_sync_direction: ["app_to_datalake", "datalake_to_app"],
      datalake_sync_mode: ["full", "incremental"],
      datalake_upsert_strategy: ["insert_only", "upsert", "overwrite"],
      notification_channel: ["in_app", "email", "teams"],
      template_visibility: [
        "private",
        "internal_department",
        "internal_company",
        "public",
      ],
      validation_instance_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "skipped",
      ],
      validation_type: ["none", "manager", "requester", "free"],
      workflow_node_type: [
        "start",
        "end",
        "task",
        "validation",
        "notification",
        "condition",
        "sub_process",
        "fork",
        "join",
        "status_change",
        "assignment",
        "set_variable",
        "datalake_sync",
        "sub_process_standard_direct",
        "sub_process_standard_manager",
        "sub_process_standard_validation1",
        "sub_process_standard_validation2",
      ],
      workflow_run_status: [
        "running",
        "completed",
        "failed",
        "cancelled",
        "paused",
      ],
      workflow_status: ["draft", "active", "inactive", "archived"],
      workflow_variable_type: [
        "text",
        "boolean",
        "integer",
        "decimal",
        "datetime",
        "autonumber",
      ],
    },
  },
} as const
