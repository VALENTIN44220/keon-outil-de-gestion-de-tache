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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _planner_real_ids: {
        Row: {
          pid: string
        }
        Insert: {
          pid: string
        }
        Update: {
          pid?: string
        }
        Relationships: []
      }
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
      be_affaire_budget_lines: {
        Row: {
          be_affaire_id: string
          commentaire: string | null
          created_at: string
          created_by: string | null
          description: string | null
          exercice: number | null
          fournisseur_prevu: string | null
          id: string
          montant_budget: number
          montant_budget_revise: number | null
          poste: string
          statut: string
          type_depense: string | null
          updated_at: string
        }
        Insert: {
          be_affaire_id: string
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          exercice?: number | null
          fournisseur_prevu?: string | null
          id?: string
          montant_budget: number
          montant_budget_revise?: number | null
          poste: string
          statut?: string
          type_depense?: string | null
          updated_at?: string
        }
        Update: {
          be_affaire_id?: string
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          exercice?: number | null
          fournisseur_prevu?: string | null
          id?: string
          montant_budget?: number
          montant_budget_revise?: number | null
          poste?: string
          statut?: string
          type_depense?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_affaire_budget_lines_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "be_affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaire_budget_lines_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_budget_kpi"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_budget_lines_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_kpi"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_budget_lines_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_par_poste"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_budget_lines_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_par_user"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_budget_lines_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_temps_detail_mensuel"
            referencedColumns: ["be_affaire_id"]
          },
        ]
      }
      be_affaire_temps_budget: {
        Row: {
          be_affaire_id: string
          commentaire: string | null
          created_at: string
          created_by: string | null
          id: string
          jours_budgetes: number
          poste: string
          updated_at: string
        }
        Insert: {
          be_affaire_id: string
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jours_budgetes: number
          poste: string
          updated_at?: string
        }
        Update: {
          be_affaire_id?: string
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jours_budgetes?: number
          poste?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_affaire_temps_budget_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "be_affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaire_temps_budget_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_budget_kpi"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_temps_budget_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_kpi"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_temps_budget_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_par_poste"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_temps_budget_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_par_user"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "be_affaire_temps_budget_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_temps_detail_mensuel"
            referencedColumns: ["be_affaire_id"]
          },
        ]
      }
      be_affaires: {
        Row: {
          be_project_id: string
          code_affaire: string
          created_at: string
          created_by: string | null
          date_cloture: string | null
          date_ouverture: string | null
          description: string | null
          id: string
          libelle: string | null
          source_creation: string
          source_request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          be_project_id: string
          code_affaire: string
          created_at?: string
          created_by?: string | null
          date_cloture?: string | null
          date_ouverture?: string | null
          description?: string | null
          id?: string
          libelle?: string | null
          source_creation?: string
          source_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          be_project_id?: string
          code_affaire?: string
          created_at?: string
          created_by?: string | null
          date_cloture?: string | null
          date_ouverture?: string | null
          description?: string | null
          id?: string
          libelle?: string | null
          source_creation?: string
          source_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_affaires_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "be_affaires_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "be_affaires_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      be_budget_line_commandes: {
        Row: {
          budget_line_id: string
          created_at: string
          created_by: string | null
          id: string
          numero_piece: string
        }
        Insert: {
          budget_line_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          numero_piece: string
        }
        Update: {
          budget_line_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          numero_piece?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_budget_line_commandes_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "be_affaire_budget_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      be_budget_line_factures: {
        Row: {
          budget_line_id: string
          created_at: string
          created_by: string | null
          id: string
          numero_piece: string
        }
        Insert: {
          budget_line_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          numero_piece: string
        }
        Update: {
          budget_line_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          numero_piece?: string
        }
        Relationships: [
          {
            foreignKeyName: "be_budget_line_factures_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "be_affaire_budget_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      be_divalto_mouvements: {
        Row: {
          axe_0001: string | null
          axe_0002: string | null
          code_affaire: string | null
          compte_general: string | null
          created_at: string
          date_piece: string | null
          devise: string | null
          exercice: number | null
          fabric_synced_at: string
          id: string
          libelle: string | null
          montant_ht: number | null
          montant_tva: number | null
          nom_tiers: string | null
          numero_piece: string
          prefpino: string
          raw: Json | null
          source: string
          tiers_code: string | null
          type_mouv: string
          updated_at: string
        }
        Insert: {
          axe_0001?: string | null
          axe_0002?: string | null
          code_affaire?: string | null
          compte_general?: string | null
          created_at?: string
          date_piece?: string | null
          devise?: string | null
          exercice?: number | null
          fabric_synced_at?: string
          id?: string
          libelle?: string | null
          montant_ht?: number | null
          montant_tva?: number | null
          nom_tiers?: string | null
          numero_piece: string
          prefpino: string
          raw?: Json | null
          source: string
          tiers_code?: string | null
          type_mouv: string
          updated_at?: string
        }
        Update: {
          axe_0001?: string | null
          axe_0002?: string | null
          code_affaire?: string | null
          compte_general?: string | null
          created_at?: string
          date_piece?: string | null
          devise?: string | null
          exercice?: number | null
          fabric_synced_at?: string
          id?: string
          libelle?: string | null
          montant_ht?: number | null
          montant_tva?: number | null
          nom_tiers?: string | null
          numero_piece?: string
          prefpino?: string
          raw?: Json | null
          source?: string
          tiers_code?: string | null
          type_mouv?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "be_project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
      be_tjm_fonctions: {
        Row: {
          created_at: string
          description: string | null
          fonction: string
          taux_horaire: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          fonction: string
          taux_horaire: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          fonction?: string
          taux_horaire?: number
          updated_at?: string
          updated_by?: string | null
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
      fou_resultat: {
        Row: {
          annee: number | null
          annee_cmd: string | null
          annee_fac: string | null
          ca_commande: number | null
          ca_facture: number | null
          dos: string
          ecart_cmd_fac: number | null
          fou_key: string
          id: number
          mois: number | null
          mois_cmd: string | null
          mois_fac: string | null
          ref: string
          synced_at: string | null
          tiers: string
          type_date: string | null
        }
        Insert: {
          annee?: number | null
          annee_cmd?: string | null
          annee_fac?: string | null
          ca_commande?: number | null
          ca_facture?: number | null
          dos: string
          ecart_cmd_fac?: number | null
          fou_key: string
          id?: number
          mois?: number | null
          mois_cmd?: string | null
          mois_fac?: string | null
          ref: string
          synced_at?: string | null
          tiers: string
          type_date?: string | null
        }
        Update: {
          annee?: number | null
          annee_cmd?: string | null
          annee_fac?: string | null
          ca_commande?: number | null
          ca_facture?: number | null
          dos?: string
          ecart_cmd_fac?: number | null
          fou_key?: string
          id?: number
          mois?: number | null
          mois_cmd?: string | null
          mois_fac?: string | null
          ref?: string
          synced_at?: string | null
          tiers?: string
          type_date?: string | null
        }
        Relationships: []
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
      inno_code_projet_options: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      inno_demandes: {
        Row: {
          audit_log: Json | null
          capex_investissement: number | null
          challenge_inno: string | null
          code_projet: string
          commentaire_demande: string | null
          commentaire_projet: string | null
          commentaires_financiers: string | null
          created_at: string
          date_debut: string | null
          date_fin_previsionnelle: string | null
          demandeur_id: string
          descriptif: string
          difficulte_complexite: number | null
          ebitda_retour_financier: number | null
          entite_concernee: string
          etat_projet: string | null
          etiquettes: string[] | null
          gain_attendu: string | null
          id: string
          livrable_final: string | null
          niveau_strategique: number | null
          nom_projet: string
          partenaires_identifies: string | null
          priorisation_urgence: string | null
          responsable_projet_id: string | null
          roi: number | null
          service_porteur_id: string | null
          sous_theme: string | null
          sponsor: string | null
          statut_demande: string
          temps_caracteristique: string | null
          theme: string | null
          updated_at: string
          usage: string
        }
        Insert: {
          audit_log?: Json | null
          capex_investissement?: number | null
          challenge_inno?: string | null
          code_projet: string
          commentaire_demande?: string | null
          commentaire_projet?: string | null
          commentaires_financiers?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin_previsionnelle?: string | null
          demandeur_id: string
          descriptif: string
          difficulte_complexite?: number | null
          ebitda_retour_financier?: number | null
          entite_concernee: string
          etat_projet?: string | null
          etiquettes?: string[] | null
          gain_attendu?: string | null
          id?: string
          livrable_final?: string | null
          niveau_strategique?: number | null
          nom_projet: string
          partenaires_identifies?: string | null
          priorisation_urgence?: string | null
          responsable_projet_id?: string | null
          roi?: number | null
          service_porteur_id?: string | null
          sous_theme?: string | null
          sponsor?: string | null
          statut_demande?: string
          temps_caracteristique?: string | null
          theme?: string | null
          updated_at?: string
          usage: string
        }
        Update: {
          audit_log?: Json | null
          capex_investissement?: number | null
          challenge_inno?: string | null
          code_projet?: string
          commentaire_demande?: string | null
          commentaire_projet?: string | null
          commentaires_financiers?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin_previsionnelle?: string | null
          demandeur_id?: string
          descriptif?: string
          difficulte_complexite?: number | null
          ebitda_retour_financier?: number | null
          entite_concernee?: string
          etat_projet?: string | null
          etiquettes?: string[] | null
          gain_attendu?: string | null
          id?: string
          livrable_final?: string | null
          niveau_strategique?: number | null
          nom_projet?: string
          partenaires_identifies?: string | null
          priorisation_urgence?: string | null
          responsable_projet_id?: string | null
          roi?: number | null
          service_porteur_id?: string | null
          sous_theme?: string | null
          sponsor?: string | null
          statut_demande?: string
          temps_caracteristique?: string | null
          theme?: string | null
          updated_at?: string
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "inno_demandes_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inno_demandes_responsable_projet_id_fkey"
            columns: ["responsable_projet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inno_demandes_service_porteur_id_fkey"
            columns: ["service_porteur_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      inno_etiquette_suggestions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      inno_usage_options: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      it_budget_line_commandes: {
        Row: {
          budget_line_id: string
          created_at: string | null
          fullcdno: string
          id: string
        }
        Insert: {
          budget_line_id: string
          created_at?: string | null
          fullcdno: string
          id?: string
        }
        Update: {
          budget_line_id?: string
          created_at?: string | null
          fullcdno?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_budget_line_commandes_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "it_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_line_commandes_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "v_it_budget_engage_constate"
            referencedColumns: ["budget_line_id"]
          },
          {
            foreignKeyName: "it_budget_line_commandes_fullcdno_fkey"
            columns: ["fullcdno"]
            isOneToOne: false
            referencedRelation: "it_divalto_commandes"
            referencedColumns: ["fullcdno"]
          },
        ]
      }
      it_budget_line_factures: {
        Row: {
          budget_line_id: string
          created_at: string | null
          fullcdno_fac: string
          id: string
        }
        Insert: {
          budget_line_id: string
          created_at?: string | null
          fullcdno_fac: string
          id?: string
        }
        Update: {
          budget_line_id?: string
          created_at?: string | null
          fullcdno_fac?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_budget_line_factures_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "it_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_line_factures_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "v_it_budget_engage_constate"
            referencedColumns: ["budget_line_id"]
          },
        ]
      }
      it_budget_line_months: {
        Row: {
          budget_line_id: string
          commentaire: string | null
          created_at: string | null
          id: string
          lucca_ndf_id: string | null
          mois: number
          montant_budget: number
          montant_budget_revise: number | null
          montant_revise: number | null
          pdf_url: string | null
          ref_commande_divalto: string | null
          ref_facture_divalto: string | null
          statut_rapprochement: string
          updated_at: string | null
        }
        Insert: {
          budget_line_id: string
          commentaire?: string | null
          created_at?: string | null
          id?: string
          lucca_ndf_id?: string | null
          mois: number
          montant_budget?: number
          montant_budget_revise?: number | null
          montant_revise?: number | null
          pdf_url?: string | null
          ref_commande_divalto?: string | null
          ref_facture_divalto?: string | null
          statut_rapprochement?: string
          updated_at?: string | null
        }
        Update: {
          budget_line_id?: string
          commentaire?: string | null
          created_at?: string | null
          id?: string
          lucca_ndf_id?: string | null
          mois?: number
          montant_budget?: number
          montant_budget_revise?: number | null
          montant_revise?: number | null
          pdf_url?: string | null
          ref_commande_divalto?: string | null
          ref_facture_divalto?: string | null
          statut_rapprochement?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_budget_line_months_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "it_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_line_months_budget_line_id_fkey"
            columns: ["budget_line_id"]
            isOneToOne: false
            referencedRelation: "v_it_budget_engage_constate"
            referencedColumns: ["budget_line_id"]
          },
          {
            foreignKeyName: "it_budget_line_months_lucca_ndf_id_fkey"
            columns: ["lucca_ndf_id"]
            isOneToOne: false
            referencedRelation: "lucca_notes_frais"
            referencedColumns: ["id"]
          },
        ]
      }
      it_budget_lines: {
        Row: {
          annee: number
          budget_type: string
          budget_type_revise: string | null
          categorie: string | null
          commentaire: string | null
          created_at: string | null
          description: string | null
          entite: string | null
          exercice: number
          external_key: string | null
          fournisseur_prevu: string | null
          id: string
          is_reforecast: boolean
          it_project_id: string | null
          mode_saisie: string | null
          mois_applicables: number[] | null
          mois_budget: number | null
          mois_budget_revise: number | null
          montant_annuel: number | null
          montant_budget: number
          montant_budget_revise: number | null
          nature_depense: string | null
          paiement_via_ndf: boolean
          rapprochement_group_id: string | null
          source_depense: string
          sous_categorie: string | null
          statut: string
          type_depense: string | null
          updated_at: string | null
          version: string
        }
        Insert: {
          annee?: number
          budget_type?: string
          budget_type_revise?: string | null
          categorie?: string | null
          commentaire?: string | null
          created_at?: string | null
          description?: string | null
          entite?: string | null
          exercice?: number
          external_key?: string | null
          fournisseur_prevu?: string | null
          id?: string
          is_reforecast?: boolean
          it_project_id?: string | null
          mode_saisie?: string | null
          mois_applicables?: number[] | null
          mois_budget?: number | null
          mois_budget_revise?: number | null
          montant_annuel?: number | null
          montant_budget?: number
          montant_budget_revise?: number | null
          nature_depense?: string | null
          paiement_via_ndf?: boolean
          rapprochement_group_id?: string | null
          source_depense?: string
          sous_categorie?: string | null
          statut?: string
          type_depense?: string | null
          updated_at?: string | null
          version?: string
        }
        Update: {
          annee?: number
          budget_type?: string
          budget_type_revise?: string | null
          categorie?: string | null
          commentaire?: string | null
          created_at?: string | null
          description?: string | null
          entite?: string | null
          exercice?: number
          external_key?: string | null
          fournisseur_prevu?: string | null
          id?: string
          is_reforecast?: boolean
          it_project_id?: string | null
          mode_saisie?: string | null
          mois_applicables?: number[] | null
          mois_budget?: number | null
          mois_budget_revise?: number | null
          montant_annuel?: number | null
          montant_budget?: number
          montant_budget_revise?: number | null
          nature_depense?: string | null
          paiement_via_ndf?: boolean
          rapprochement_group_id?: string | null
          source_depense?: string
          sous_categorie?: string | null
          statut?: string
          type_depense?: string | null
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_budget_lines_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_lines_rapprochement_group_id_fkey"
            columns: ["rapprochement_group_id"]
            isOneToOne: false
            referencedRelation: "it_budget_rapprochement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      it_budget_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          option_type: string
          parent_value: string | null
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          option_type: string
          parent_value?: string | null
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          option_type?: string
          parent_value?: string | null
          value?: string
        }
        Relationships: []
      }
      it_budget_rapprochement_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entite: string | null
          exercice: number | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entite?: string | null
          exercice?: number | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entite?: string | null
          exercice?: number | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
      it_budget_reallocations: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          from_budget_line_id: string | null
          id: string
          it_project_id: string
          montant: number
          motif: string | null
          statut_validation: string | null
          to_budget_line_id: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          from_budget_line_id?: string | null
          id?: string
          it_project_id: string
          montant: number
          motif?: string | null
          statut_validation?: string | null
          to_budget_line_id?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          from_budget_line_id?: string | null
          id?: string
          it_project_id?: string
          montant?: number
          motif?: string | null
          statut_validation?: string | null
          to_budget_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_budget_reallocations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_reallocations_from_budget_line_id_fkey"
            columns: ["from_budget_line_id"]
            isOneToOne: false
            referencedRelation: "it_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_reallocations_from_budget_line_id_fkey"
            columns: ["from_budget_line_id"]
            isOneToOne: false
            referencedRelation: "v_it_budget_engage_constate"
            referencedColumns: ["budget_line_id"]
          },
          {
            foreignKeyName: "it_budget_reallocations_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_reallocations_to_budget_line_id_fkey"
            columns: ["to_budget_line_id"]
            isOneToOne: false
            referencedRelation: "it_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_budget_reallocations_to_budget_line_id_fkey"
            columns: ["to_budget_line_id"]
            isOneToOne: false
            referencedRelation: "v_it_budget_engage_constate"
            referencedColumns: ["budget_line_id"]
          },
        ]
      }
      it_budget_user_preferences: {
        Row: {
          columns_config: Json
          created_at: string
          filters_config: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          columns_config?: Json
          created_at?: string
          filters_config?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          columns_config?: Json
          created_at?: string
          filters_config?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      it_divalto_commandes: {
        Row: {
          axe_0001: string | null
          axe_0002: string | null
          date_commande: string | null
          date_facture: string | null
          description: string | null
          dos: string | null
          fullcdno: string
          fullfano: string | null
          id: string
          montant_ht: number | null
          nomfournisseur: string | null
          projet: string | null
          source_system: string | null
          synced_at: string | null
          tiers: string | null
        }
        Insert: {
          axe_0001?: string | null
          axe_0002?: string | null
          date_commande?: string | null
          date_facture?: string | null
          description?: string | null
          dos?: string | null
          fullcdno: string
          fullfano?: string | null
          id?: string
          montant_ht?: number | null
          nomfournisseur?: string | null
          projet?: string | null
          source_system?: string | null
          synced_at?: string | null
          tiers?: string | null
        }
        Update: {
          axe_0001?: string | null
          axe_0002?: string | null
          date_commande?: string | null
          date_facture?: string | null
          description?: string | null
          dos?: string | null
          fullcdno?: string
          fullfano?: string | null
          id?: string
          montant_ht?: number | null
          nomfournisseur?: string | null
          projet?: string | null
          source_system?: string | null
          synced_at?: string | null
          tiers?: string | null
        }
        Relationships: []
      }
      it_divalto_factures: {
        Row: {
          axe_0001: string | null
          date_facture: string | null
          dos: string | null
          fullcdno_lie: string | null
          id: string
          libelle: string | null
          montant_ht: number | null
          nomfournisseur: string | null
          projet: string | null
          reference: string
          source: string
          source_system: string | null
          synced_at: string | null
          tiers: string | null
        }
        Insert: {
          axe_0001?: string | null
          date_facture?: string | null
          dos?: string | null
          fullcdno_lie?: string | null
          id?: string
          libelle?: string | null
          montant_ht?: number | null
          nomfournisseur?: string | null
          projet?: string | null
          reference: string
          source: string
          source_system?: string | null
          synced_at?: string | null
          tiers?: string | null
        }
        Update: {
          axe_0001?: string | null
          date_facture?: string | null
          dos?: string | null
          fullcdno_lie?: string | null
          id?: string
          libelle?: string | null
          montant_ht?: number | null
          nomfournisseur?: string | null
          projet?: string | null
          reference?: string
          source?: string
          source_system?: string | null
          synced_at?: string | null
          tiers?: string | null
        }
        Relationships: []
      }
      it_manual_expenses: {
        Row: {
          annee: number
          categorie: string | null
          commentaire: string | null
          created_at: string | null
          date_prevue: string | null
          description: string | null
          entite: string | null
          fournisseur: string | null
          fournisseur_prevu: string | null
          id: string
          it_budget_line_id: string | null
          it_project_id: string | null
          mode_decaissement: string
          mois_applicables: number[] | null
          montant_prevu: number
          nature_depense: string | null
          source_depense: string
          sous_categorie: string | null
          statut: string | null
          type_depense: string | null
          type_prevision: string | null
          updated_at: string | null
        }
        Insert: {
          annee?: number
          categorie?: string | null
          commentaire?: string | null
          created_at?: string | null
          date_prevue?: string | null
          description?: string | null
          entite?: string | null
          fournisseur?: string | null
          fournisseur_prevu?: string | null
          id?: string
          it_budget_line_id?: string | null
          it_project_id?: string | null
          mode_decaissement?: string
          mois_applicables?: number[] | null
          montant_prevu?: number
          nature_depense?: string | null
          source_depense?: string
          sous_categorie?: string | null
          statut?: string | null
          type_depense?: string | null
          type_prevision?: string | null
          updated_at?: string | null
        }
        Update: {
          annee?: number
          categorie?: string | null
          commentaire?: string | null
          created_at?: string | null
          date_prevue?: string | null
          description?: string | null
          entite?: string | null
          fournisseur?: string | null
          fournisseur_prevu?: string | null
          id?: string
          it_budget_line_id?: string | null
          it_project_id?: string | null
          mode_decaissement?: string
          mois_applicables?: number[] | null
          montant_prevu?: number
          nature_depense?: string | null
          source_depense?: string
          sous_categorie?: string | null
          statut?: string | null
          type_depense?: string | null
          type_prevision?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_manual_expenses_it_budget_line_id_fkey"
            columns: ["it_budget_line_id"]
            isOneToOne: false
            referencedRelation: "it_budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_manual_expenses_it_budget_line_id_fkey"
            columns: ["it_budget_line_id"]
            isOneToOne: false
            referencedRelation: "v_it_budget_engage_constate"
            referencedColumns: ["budget_line_id"]
          },
          {
            foreignKeyName: "it_manual_expenses_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      it_milestone_calendar_links: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          it_project_milestone_id: string
          location: string | null
          organizer_email: string | null
          outlook_event_id: string
          start_time: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          it_project_milestone_id: string
          location?: string | null
          organizer_email?: string | null
          outlook_event_id: string
          start_time: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          it_project_milestone_id?: string
          location?: string | null
          organizer_email?: string | null
          outlook_event_id?: string
          start_time?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_milestone_calendar_links_it_project_milestone_id_fkey"
            columns: ["it_project_milestone_id"]
            isOneToOne: false
            referencedRelation: "it_project_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      it_project_fdr_validation: {
        Row: {
          commentaire: string | null
          created_at: string
          date_validation: string | null
          etape: number | null
          etape_label: string | null
          id: string
          it_project_id: string | null
          statut: string
          updated_at: string
          valideur_id: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date_validation?: string | null
          etape?: number | null
          etape_label?: string | null
          id?: string
          it_project_id?: string | null
          statut?: string
          updated_at?: string
          valideur_id?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date_validation?: string | null
          etape?: number | null
          etape_label?: string | null
          id?: string
          it_project_id?: string | null
          statut?: string
          updated_at?: string
          valideur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_project_fdr_validation_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      it_project_milestones: {
        Row: {
          created_at: string
          date_prevue: string | null
          date_reelle: string | null
          description: string | null
          id: string
          it_project_id: string | null
          ordre: number | null
          phase: string | null
          statut: string
          titre: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_prevue?: string | null
          date_reelle?: string | null
          description?: string | null
          id?: string
          it_project_id?: string | null
          ordre?: number | null
          phase?: string | null
          statut?: string
          titre?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_prevue?: string | null
          date_reelle?: string | null
          description?: string | null
          id?: string
          it_project_id?: string | null
          ordre?: number | null
          phase?: string | null
          statut?: string
          titre?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_project_milestones_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      it_project_phase_progress: {
        Row: {
          advancement_mode: string
          created_at: string | null
          id: string
          it_project_id: string
          manual_progress: number | null
          phase: string
          updated_at: string | null
        }
        Insert: {
          advancement_mode?: string
          created_at?: string | null
          id?: string
          it_project_id: string
          manual_progress?: number | null
          phase: string
          updated_at?: string | null
        }
        Update: {
          advancement_mode?: string
          created_at?: string | null
          id?: string
          it_project_id?: string
          manual_progress?: number | null
          phase?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_project_phase_progress_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      it_projects: {
        Row: {
          budget_consomme: number | null
          budget_previsionnel: number | null
          chef_projet_id: string | null
          chef_projet_it_id: string | null
          chef_projet_metier_id: string | null
          code_projet_digital: string
          company_id: string | null
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin_prevue: string | null
          date_fin_reelle: string | null
          description: string | null
          directeur_id: string | null
          etape_validation_fdr: number | null
          fdr_commentaires: string | null
          fdr_description: string | null
          fdr_priorite: string | null
          fdr_type: string | null
          groupe_service_id: string | null
          id: string
          loop_workspace_id: string | null
          loop_workspace_url: string | null
          membres_ids: string[] | null
          nom_projet: string
          phase_courante: string | null
          phases_actives: Json
          pilier: string | null
          priorite: string | null
          progress: number | null
          responsable_it_id: string | null
          sponsor_id: string | null
          statut: string
          statut_fdr: string | null
          teams_channel_id: string | null
          teams_channel_url: string | null
          type_projet: string | null
          updated_at: string
        }
        Insert: {
          budget_consomme?: number | null
          budget_previsionnel?: number | null
          chef_projet_id?: string | null
          chef_projet_it_id?: string | null
          chef_projet_metier_id?: string | null
          code_projet_digital: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin_prevue?: string | null
          date_fin_reelle?: string | null
          description?: string | null
          directeur_id?: string | null
          etape_validation_fdr?: number | null
          fdr_commentaires?: string | null
          fdr_description?: string | null
          fdr_priorite?: string | null
          fdr_type?: string | null
          groupe_service_id?: string | null
          id?: string
          loop_workspace_id?: string | null
          loop_workspace_url?: string | null
          membres_ids?: string[] | null
          nom_projet: string
          phase_courante?: string | null
          phases_actives?: Json
          pilier?: string | null
          priorite?: string | null
          progress?: number | null
          responsable_it_id?: string | null
          sponsor_id?: string | null
          statut?: string
          statut_fdr?: string | null
          teams_channel_id?: string | null
          teams_channel_url?: string | null
          type_projet?: string | null
          updated_at?: string
        }
        Update: {
          budget_consomme?: number | null
          budget_previsionnel?: number | null
          chef_projet_id?: string | null
          chef_projet_it_id?: string | null
          chef_projet_metier_id?: string | null
          code_projet_digital?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin_prevue?: string | null
          date_fin_reelle?: string | null
          description?: string | null
          directeur_id?: string | null
          etape_validation_fdr?: number | null
          fdr_commentaires?: string | null
          fdr_description?: string | null
          fdr_priorite?: string | null
          fdr_type?: string | null
          groupe_service_id?: string | null
          id?: string
          loop_workspace_id?: string | null
          loop_workspace_url?: string | null
          membres_ids?: string[] | null
          nom_projet?: string
          phase_courante?: string | null
          phases_actives?: Json
          pilier?: string | null
          priorite?: string | null
          progress?: number | null
          responsable_it_id?: string | null
          sponsor_id?: string | null
          statut?: string
          statut_fdr?: string | null
          teams_channel_id?: string | null
          teams_channel_url?: string | null
          type_projet?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_projects_chef_projet_id_fkey"
            columns: ["chef_projet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_chef_projet_it_id_fkey"
            columns: ["chef_projet_it_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_chef_projet_metier_id_fkey"
            columns: ["chef_projet_metier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_directeur_id_fkey"
            columns: ["directeur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_groupe_service_id_fkey"
            columns: ["groupe_service_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_responsable_it_id_fkey"
            columns: ["responsable_it_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_projects_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      it_rh_lines: {
        Row: {
          anciennete_q1: number
          anciennete_q2_q4: number
          annee: number
          bonus_q1: number
          bonus_q2_q4: number
          charges_pct: number
          commentaire: string | null
          created_at: string
          fonction: string | null
          id: string
          metier: string | null
          mois_01: number
          mois_02: number
          mois_03: number
          mois_04: number
          mois_05: number
          mois_06: number
          mois_07: number
          mois_08: number
          mois_09: number
          mois_10: number
          mois_11: number
          mois_12: number
          profile_id: string | null
          salaire_q1: number
          salaire_q2_q4: number
          salarie: string
          updated_at: string
        }
        Insert: {
          anciennete_q1?: number
          anciennete_q2_q4?: number
          annee: number
          bonus_q1?: number
          bonus_q2_q4?: number
          charges_pct?: number
          commentaire?: string | null
          created_at?: string
          fonction?: string | null
          id?: string
          metier?: string | null
          mois_01?: number
          mois_02?: number
          mois_03?: number
          mois_04?: number
          mois_05?: number
          mois_06?: number
          mois_07?: number
          mois_08?: number
          mois_09?: number
          mois_10?: number
          mois_11?: number
          mois_12?: number
          profile_id?: string | null
          salaire_q1?: number
          salaire_q2_q4?: number
          salarie: string
          updated_at?: string
        }
        Update: {
          anciennete_q1?: number
          anciennete_q2_q4?: number
          annee?: number
          bonus_q1?: number
          bonus_q2_q4?: number
          charges_pct?: number
          commentaire?: string | null
          created_at?: string
          fonction?: string | null
          id?: string
          metier?: string | null
          mois_01?: number
          mois_02?: number
          mois_03?: number
          mois_04?: number
          mois_05?: number
          mois_06?: number
          mois_07?: number
          mois_08?: number
          mois_09?: number
          mois_10?: number
          mois_11?: number
          mois_12?: number
          profile_id?: string | null
          salaire_q1?: number
          salaire_q2_q4?: number
          salarie?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_rh_lines_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      it_solution_links: {
        Row: {
          created_at: string
          created_by: string | null
          criticite: string | null
          date_mise_en_service: string | null
          description: string | null
          direction: string
          etat_flux: string | null
          frequence: string | null
          id: string
          protocole: string | null
          source_solution_id: string
          target_solution_id: string
          type_flux: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criticite?: string | null
          date_mise_en_service?: string | null
          description?: string | null
          direction?: string
          etat_flux?: string | null
          frequence?: string | null
          id?: string
          protocole?: string | null
          source_solution_id: string
          target_solution_id: string
          type_flux?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criticite?: string | null
          date_mise_en_service?: string | null
          description?: string | null
          direction?: string
          etat_flux?: string | null
          frequence?: string | null
          id?: string
          protocole?: string | null
          source_solution_id?: string
          target_solution_id?: string
          type_flux?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "it_solution_links_source_solution_id_fkey"
            columns: ["source_solution_id"]
            isOneToOne: false
            referencedRelation: "it_solutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_solution_links_target_solution_id_fkey"
            columns: ["target_solution_id"]
            isOneToOne: false
            referencedRelation: "it_solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      it_solution_projects: {
        Row: {
          commentaire: string | null
          created_at: string
          created_by: string | null
          project_id: string
          solution_id: string
          type_lien: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          project_id: string
          solution_id: string
          type_lien?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          created_by?: string | null
          project_id?: string
          solution_id?: string
          type_lien?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_solution_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_solution_projects_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "it_solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      it_solutions: {
        Row: {
          categorie: string | null
          commentaires: string | null
          connecte_datalake: string | null
          created_at: string
          created_by: string | null
          criticite: string | null
          domaine_metier: string | null
          flux_principaux: string | null
          height: number | null
          id: string
          logo_url: string | null
          nom: string
          owner_it_id: string | null
          owner_metier_id: string | null
          perimetre: string | null
          position_x: number | null
          position_y: number | null
          statut_temporalite: string | null
          type: string | null
          updated_at: string
          usage_principal: string | null
          visible_dans_schema: boolean
          width: number | null
        }
        Insert: {
          categorie?: string | null
          commentaires?: string | null
          connecte_datalake?: string | null
          created_at?: string
          created_by?: string | null
          criticite?: string | null
          domaine_metier?: string | null
          flux_principaux?: string | null
          height?: number | null
          id?: string
          logo_url?: string | null
          nom: string
          owner_it_id?: string | null
          owner_metier_id?: string | null
          perimetre?: string | null
          position_x?: number | null
          position_y?: number | null
          statut_temporalite?: string | null
          type?: string | null
          updated_at?: string
          usage_principal?: string | null
          visible_dans_schema?: boolean
          width?: number | null
        }
        Update: {
          categorie?: string | null
          commentaires?: string | null
          connecte_datalake?: string | null
          created_at?: string
          created_by?: string | null
          criticite?: string | null
          domaine_metier?: string | null
          flux_principaux?: string | null
          height?: number | null
          id?: string
          logo_url?: string | null
          nom?: string
          owner_it_id?: string | null
          owner_metier_id?: string | null
          perimetre?: string | null
          position_x?: number | null
          position_y?: number | null
          statut_temporalite?: string | null
          type?: string | null
          updated_at?: string
          usage_principal?: string | null
          visible_dans_schema?: boolean
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "it_solutions_owner_it_id_fkey"
            columns: ["owner_it_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "it_solutions_owner_metier_id_fkey"
            columns: ["owner_metier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      lucca_notes_frais: {
        Row: {
          annee: number | null
          axe_1: string | null
          axe_2: string | null
          c8_id: string | null
          categorie: string | null
          compte_general: string | null
          created_at: string
          date_depense: string
          display_name_extracted: string | null
          dos: string | null
          external_id: string
          fabric_synced_at: string
          id: string
          id_lucca: number | null
          journal: string | null
          libelle_ecriture: string | null
          montant_ht: number | null
          numero: string | null
          raw: Json | null
          sens: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          annee?: number | null
          axe_1?: string | null
          axe_2?: string | null
          c8_id?: string | null
          categorie?: string | null
          compte_general?: string | null
          created_at?: string
          date_depense: string
          display_name_extracted?: string | null
          dos?: string | null
          external_id: string
          fabric_synced_at?: string
          id?: string
          id_lucca?: number | null
          journal?: string | null
          libelle_ecriture?: string | null
          montant_ht?: number | null
          numero?: string | null
          raw?: Json | null
          sens?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          annee?: number | null
          axe_1?: string | null
          axe_2?: string | null
          c8_id?: string | null
          categorie?: string | null
          compte_general?: string | null
          created_at?: string
          date_depense?: string
          display_name_extracted?: string | null
          dos?: string | null
          external_id?: string
          fabric_synced_at?: string
          id?: string
          id_lucca?: number | null
          journal?: string | null
          libelle_ecriture?: string | null
          montant_ht?: number | null
          numero?: string | null
          raw?: Json | null
          sens?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lucca_notes_frais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lucca_saisie_temps: {
        Row: {
          code_site: string
          created_at: string
          date_saisie: string
          duree_heures: number
          external_id: string
          fabric_synced_at: string
          id: string
          id_lucca: number
          libelle: string | null
          raw: Json | null
          type_temps: string | null
          updated_at: string
          user_id: string | null
          validated_by_lucca: boolean | null
        }
        Insert: {
          code_site: string
          created_at?: string
          date_saisie: string
          duree_heures: number
          external_id: string
          fabric_synced_at?: string
          id?: string
          id_lucca: number
          libelle?: string | null
          raw?: Json | null
          type_temps?: string | null
          updated_at?: string
          user_id?: string | null
          validated_by_lucca?: boolean | null
        }
        Update: {
          code_site?: string
          created_at?: string
          date_saisie?: string
          duree_heures?: number
          external_id?: string
          fabric_synced_at?: string
          id?: string
          id_lucca?: number
          libelle?: string | null
          raw?: Json | null
          type_temps?: string | null
          updated_at?: string
          user_id?: string | null
          validated_by_lucca?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lucca_saisie_temps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_actions: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string
          linked_task_id: string | null
          nc_id: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          linked_task_id?: string | null
          nc_id: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          linked_task_id?: string | null
          nc_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_actions_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_actions_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "nc_actions_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "nc_actions_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_actions_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nc_declarations"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_attachments: {
        Row: {
          created_at: string
          id: string
          name: string
          nc_id: string
          type: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nc_id: string
          type?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nc_id?: string
          type?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_attachments_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nc_declarations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_declarations: {
        Row: {
          actions_correctives: string | null
          actions_preventives: string | null
          apparition_ailleurs: string | null
          causes_racines: string | null
          cloturee_at: string | null
          code_projet: string | null
          created_at: string
          date_cloture_souhaitee: string | null
          date_constat: string
          declarant_id: string | null
          deleted_at: string | null
          description_problem: string | null
          efficacite_action: string | null
          fournisseur_nom: string | null
          id: string
          identification: string | null
          metier_code: string | null
          nc_number: string | null
          pilote_id: string | null
          processus_code: string | null
          societe_code: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actions_correctives?: string | null
          actions_preventives?: string | null
          apparition_ailleurs?: string | null
          causes_racines?: string | null
          cloturee_at?: string | null
          code_projet?: string | null
          created_at?: string
          date_cloture_souhaitee?: string | null
          date_constat?: string
          declarant_id?: string | null
          deleted_at?: string | null
          description_problem?: string | null
          efficacite_action?: string | null
          fournisseur_nom?: string | null
          id?: string
          identification?: string | null
          metier_code?: string | null
          nc_number?: string | null
          pilote_id?: string | null
          processus_code?: string | null
          societe_code?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actions_correctives?: string | null
          actions_preventives?: string | null
          apparition_ailleurs?: string | null
          causes_racines?: string | null
          cloturee_at?: string | null
          code_projet?: string | null
          created_at?: string
          date_cloture_souhaitee?: string | null
          date_constat?: string
          declarant_id?: string | null
          deleted_at?: string | null
          description_problem?: string | null
          efficacite_action?: string | null
          fournisseur_nom?: string | null
          id?: string
          identification?: string | null
          metier_code?: string | null
          nc_number?: string | null
          pilote_id?: string | null
          processus_code?: string | null
          societe_code?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_declarations_declarant_id_fkey"
            columns: ["declarant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_declarations_pilote_id_fkey"
            columns: ["pilote_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_process_pilots: {
        Row: {
          pilote_id: string | null
          processus_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          pilote_id?: string | null
          processus_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          pilote_id?: string | null
          processus_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_process_pilots_pilote_id_fkey"
            columns: ["pilote_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_process_pilots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          comment: string | null
          from_status: string | null
          id: string
          nc_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          from_status?: string | null
          id?: string
          nc_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          from_status?: string | null
          id?: string
          nc_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_status_history_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nc_declarations"
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
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
      permission_profile_page_access: {
        Row: {
          access_level: Database["public"]["Enums"]["page_access_level"]
          created_at: string
          id: string
          page_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["page_access_level"]
          created_at?: string
          id?: string
          page_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["page_access_level"]
          created_at?: string
          id?: string
          page_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profile_page_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
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
          can_access_be_budget: boolean
          can_access_be_dispatch: boolean
          can_access_be_tjm: boolean
          can_access_calendar: boolean
          can_access_dashboard: boolean
          can_access_innovation: boolean
          can_access_it_budget: boolean
          can_access_it_cartographie: boolean
          can_access_it_dispatch: boolean
          can_access_it_projects: boolean
          can_access_logistique: boolean
          can_access_maintenance: boolean
          can_access_my_requests: boolean
          can_access_process_tracking: boolean
          can_access_projects: boolean
          can_access_requests: boolean
          can_access_settings: boolean
          can_access_spv: boolean
          can_access_suppliers: boolean
          can_access_tasks: boolean
          can_access_team: boolean
          can_access_templates: boolean
          can_access_workload: boolean
          can_assign_to_all: boolean
          can_assign_to_subordinates: boolean
          can_create_be_projects: boolean | null
          can_create_it_projects: boolean
          can_create_suppliers: boolean
          can_delete_be_projects: boolean | null
          can_delete_it_projects: boolean
          can_delete_suppliers: boolean
          can_edit_be_projects: boolean | null
          can_edit_it_projects: boolean
          can_edit_suppliers: boolean
          can_manage_all_tasks: boolean
          can_manage_own_tasks: boolean
          can_manage_subordinates_tasks: boolean
          can_manage_templates: boolean
          can_manage_users: boolean
          can_view_all_tasks: boolean
          can_view_be_projects: boolean | null
          can_view_it_projects: boolean
          can_view_own_tasks: boolean
          can_view_subordinates_tasks: boolean
          can_view_suppliers: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          qst_pilier_00_read: boolean | null
          qst_pilier_00_write: boolean | null
          qst_pilier_02_read: boolean | null
          qst_pilier_02_write: boolean | null
          qst_pilier_04_read: boolean | null
          qst_pilier_04_write: boolean | null
          qst_pilier_05_read: boolean | null
          qst_pilier_05_write: boolean | null
          qst_pilier_06_read: boolean | null
          qst_pilier_06_write: boolean | null
          qst_pilier_07_read: boolean | null
          qst_pilier_07_write: boolean | null
          updated_at: string
        }
        Insert: {
          can_access_analytics?: boolean
          can_access_be_budget?: boolean
          can_access_be_dispatch?: boolean
          can_access_be_tjm?: boolean
          can_access_calendar?: boolean
          can_access_dashboard?: boolean
          can_access_innovation?: boolean
          can_access_it_budget?: boolean
          can_access_it_cartographie?: boolean
          can_access_it_dispatch?: boolean
          can_access_it_projects?: boolean
          can_access_logistique?: boolean
          can_access_maintenance?: boolean
          can_access_my_requests?: boolean
          can_access_process_tracking?: boolean
          can_access_projects?: boolean
          can_access_requests?: boolean
          can_access_settings?: boolean
          can_access_spv?: boolean
          can_access_suppliers?: boolean
          can_access_tasks?: boolean
          can_access_team?: boolean
          can_access_templates?: boolean
          can_access_workload?: boolean
          can_assign_to_all?: boolean
          can_assign_to_subordinates?: boolean
          can_create_be_projects?: boolean | null
          can_create_it_projects?: boolean
          can_create_suppliers?: boolean
          can_delete_be_projects?: boolean | null
          can_delete_it_projects?: boolean
          can_delete_suppliers?: boolean
          can_edit_be_projects?: boolean | null
          can_edit_it_projects?: boolean
          can_edit_suppliers?: boolean
          can_manage_all_tasks?: boolean
          can_manage_own_tasks?: boolean
          can_manage_subordinates_tasks?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_tasks?: boolean
          can_view_be_projects?: boolean | null
          can_view_it_projects?: boolean
          can_view_own_tasks?: boolean
          can_view_subordinates_tasks?: boolean
          can_view_suppliers?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          qst_pilier_00_read?: boolean | null
          qst_pilier_00_write?: boolean | null
          qst_pilier_02_read?: boolean | null
          qst_pilier_02_write?: boolean | null
          qst_pilier_04_read?: boolean | null
          qst_pilier_04_write?: boolean | null
          qst_pilier_05_read?: boolean | null
          qst_pilier_05_write?: boolean | null
          qst_pilier_06_read?: boolean | null
          qst_pilier_06_write?: boolean | null
          qst_pilier_07_read?: boolean | null
          qst_pilier_07_write?: boolean | null
          updated_at?: string
        }
        Update: {
          can_access_analytics?: boolean
          can_access_be_budget?: boolean
          can_access_be_dispatch?: boolean
          can_access_be_tjm?: boolean
          can_access_calendar?: boolean
          can_access_dashboard?: boolean
          can_access_innovation?: boolean
          can_access_it_budget?: boolean
          can_access_it_cartographie?: boolean
          can_access_it_dispatch?: boolean
          can_access_it_projects?: boolean
          can_access_logistique?: boolean
          can_access_maintenance?: boolean
          can_access_my_requests?: boolean
          can_access_process_tracking?: boolean
          can_access_projects?: boolean
          can_access_requests?: boolean
          can_access_settings?: boolean
          can_access_spv?: boolean
          can_access_suppliers?: boolean
          can_access_tasks?: boolean
          can_access_team?: boolean
          can_access_templates?: boolean
          can_access_workload?: boolean
          can_assign_to_all?: boolean
          can_assign_to_subordinates?: boolean
          can_create_be_projects?: boolean | null
          can_create_it_projects?: boolean
          can_create_suppliers?: boolean
          can_delete_be_projects?: boolean | null
          can_delete_it_projects?: boolean
          can_delete_suppliers?: boolean
          can_edit_be_projects?: boolean | null
          can_edit_it_projects?: boolean
          can_edit_suppliers?: boolean
          can_manage_all_tasks?: boolean
          can_manage_own_tasks?: boolean
          can_manage_subordinates_tasks?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_tasks?: boolean
          can_view_be_projects?: boolean | null
          can_view_it_projects?: boolean
          can_view_own_tasks?: boolean
          can_view_subordinates_tasks?: boolean
          can_view_suppliers?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          qst_pilier_00_read?: boolean | null
          qst_pilier_00_write?: boolean | null
          qst_pilier_02_read?: boolean | null
          qst_pilier_02_write?: boolean | null
          qst_pilier_04_read?: boolean | null
          qst_pilier_04_write?: boolean | null
          qst_pilier_05_read?: boolean | null
          qst_pilier_05_write?: boolean | null
          qst_pilier_06_read?: boolean | null
          qst_pilier_06_write?: boolean | null
          qst_pilier_07_read?: boolean | null
          qst_pilier_07_write?: boolean | null
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
          target_default_assignee_profile_id: string | null
          target_module_code: Database["public"]["Enums"]["module_code"] | null
          target_task_type: string | null
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
          target_default_assignee_profile_id?: string | null
          target_module_code?: Database["public"]["Enums"]["module_code"] | null
          target_task_type?: string | null
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
          target_default_assignee_profile_id?: string | null
          target_module_code?: Database["public"]["Enums"]["module_code"] | null
          target_task_type?: string | null
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
      process_table_output_mappings: {
        Row: {
          created_at: string
          field_mappings: Json
          id: string
          is_active: boolean
          process_template_id: string | null
          static_mappings: Json
          sub_process_template_id: string | null
          target_table: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_mappings?: Json
          id?: string
          is_active?: boolean
          process_template_id?: string | null
          static_mappings?: Json
          sub_process_template_id?: string | null
          target_table: string
          trigger_event?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_mappings?: Json
          id?: string
          is_active?: boolean
          process_template_id?: string | null
          static_mappings?: Json
          sub_process_template_id?: string | null
          target_table?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_table_output_mappings_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_table_output_mappings_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "process_table_output_mappings_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
        ]
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
      process_template_visible_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          process_template_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          process_template_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_visible_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_visible_groups_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      process_template_visible_users: {
        Row: {
          created_at: string
          id: string
          process_template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          process_template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          process_template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_template_visible_users_process_template_id_fkey"
            columns: ["process_template_id"]
            isOneToOne: false
            referencedRelation: "process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_template_visible_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          subprocess_selection_mode: string | null
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
          subprocess_selection_mode?: string | null
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
          subprocess_selection_mode?: string | null
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
          be_fonction: string | null
          be_poste: string | null
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
          suppliers_list_column_order: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          be_fonction?: string | null
          be_poste?: string | null
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
          suppliers_list_column_order?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          be_fonction?: string | null
          be_poste?: string | null
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
          suppliers_list_column_order?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_be_fonction_fkey"
            columns: ["be_fonction"]
            isOneToOne: false
            referencedRelation: "be_tjm_fonctions"
            referencedColumns: ["fonction"]
          },
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
      project_field_values: {
        Row: {
          created_at: string
          field_def_id: string
          id: string
          project_id: string
          updated_at: string
          updated_by: string | null
          valeur: string | null
          valeur_evaluation: string | null
          valeur_jsonb: Json | null
        }
        Insert: {
          created_at?: string
          field_def_id: string
          id?: string
          project_id: string
          updated_at?: string
          updated_by?: string | null
          valeur?: string | null
          valeur_evaluation?: string | null
          valeur_jsonb?: Json | null
        }
        Update: {
          created_at?: string
          field_def_id?: string
          id?: string
          project_id?: string
          updated_at?: string
          updated_by?: string | null
          valeur?: string | null
          valeur_evaluation?: string | null
          valeur_jsonb?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_field_values_field_def_id_fkey"
            columns: ["field_def_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_field_values_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_field_values_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "project_field_values_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "project_field_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_questionnaire: {
        Row: {
          champ_id: string
          code_divalto: string
          created_at: string | null
          id: string
          note: string | null
          pilier_code: string
          project_id: string
          question: string | null
          row_id: string | null
          section: string
          sous_section: string | null
          type_champ: string | null
          updated_at: string | null
          updated_by: string | null
          valeur: string | null
          valeur_evaluation: string | null
          valeurs_possibles: string | null
        }
        Insert: {
          champ_id: string
          code_divalto: string
          created_at?: string | null
          id?: string
          note?: string | null
          pilier_code: string
          project_id: string
          question?: string | null
          row_id?: string | null
          section: string
          sous_section?: string | null
          type_champ?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valeur?: string | null
          valeur_evaluation?: string | null
          valeurs_possibles?: string | null
        }
        Update: {
          champ_id?: string
          code_divalto?: string
          created_at?: string | null
          id?: string
          note?: string | null
          pilier_code?: string
          project_id?: string
          question?: string | null
          row_id?: string | null
          section?: string
          sous_section?: string | null
          type_champ?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valeur?: string | null
          valeur_evaluation?: string | null
          valeurs_possibles?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_questionnaire_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_questionnaire_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "project_questionnaire_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "project_questionnaire_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      questionnaire_field_definitions: {
        Row: {
          champ_id: string
          created_at: string
          created_by: string | null
          has_evaluation_risque: boolean
          id: string
          is_active: boolean
          is_builtin: boolean
          label: string
          note: string | null
          options: string[] | null
          order_index: number
          pilier_code: string
          required: boolean
          section: string
          sous_section: string | null
          spreadsheet_template: Json | null
          type_champ: string
        }
        Insert: {
          champ_id: string
          created_at?: string
          created_by?: string | null
          has_evaluation_risque?: boolean
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          label: string
          note?: string | null
          options?: string[] | null
          order_index?: number
          pilier_code: string
          required?: boolean
          section: string
          sous_section?: string | null
          spreadsheet_template?: Json | null
          type_champ: string
        }
        Update: {
          champ_id?: string
          created_at?: string
          created_by?: string | null
          has_evaluation_risque?: boolean
          id?: string
          is_active?: boolean
          is_builtin?: boolean
          label?: string
          note?: string | null
          options?: string[] | null
          order_index?: number
          pilier_code?: string
          required?: boolean
          section?: string
          sous_section?: string | null
          spreadsheet_template?: Json | null
          type_champ?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_field_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
      saisie_temps: {
        Row: {
          code_projet: string
          created_at: string
          id: string
          id_lucca: string
          mail_lovable: string | null
          saisie_key: string
          updated_at: string
          work_day: string
          work_hour: number | null
        }
        Insert: {
          code_projet: string
          created_at?: string
          id?: string
          id_lucca: string
          mail_lovable?: string | null
          saisie_key: string
          updated_at?: string
          work_day: string
          work_hour?: number | null
        }
        Update: {
          code_projet?: string
          created_at?: string
          id?: string
          id_lucca?: string
          mail_lovable?: string | null
          saisie_key?: string
          updated_at?: string
          work_day?: string
          work_hour?: number | null
        }
        Relationships: []
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
      service_group_labels: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          service_group_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          service_group_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          service_group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_group_labels_service_group_id_fkey"
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
          permission_profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permission_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permission_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_groups_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_process_step_fields: {
        Row: {
          alert_delay_days: number | null
          alert_enabled: boolean
          alert_message: string | null
          alert_target: string | null
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          order_index: number
          sub_process_template_id: string
          updated_at: string
        }
        Insert: {
          alert_delay_days?: number | null
          alert_enabled?: boolean
          alert_message?: string | null
          alert_target?: string | null
          created_at?: string
          field_key: string
          field_label: string
          field_type: string
          id?: string
          is_required?: boolean
          order_index?: number
          sub_process_template_id: string
          updated_at?: string
        }
        Update: {
          alert_delay_days?: number | null
          alert_enabled?: boolean
          alert_message?: string | null
          alert_target?: string | null
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          order_index?: number
          sub_process_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_process_step_fields_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "sub_process_step_fields_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
        ]
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
      sub_process_template_visible_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          sub_process_template_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          sub_process_template_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          sub_process_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_process_template_visible_group_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_group_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_process_template_visible_users: {
        Row: {
          created_at: string
          id: string
          sub_process_template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sub_process_template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sub_process_template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_process_template_visible_users_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_users_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "sub_process_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_template_visible_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_process_templates: {
        Row: {
          assignment_type: string
          be_category: string | null
          created_at: string
          creator_company_id: string | null
          creator_department_id: string | null
          default_duration_hours: number | null
          description: string | null
          dispatch_manager_id: string | null
          fallback_assignment_type: string | null
          fallback_target_assignee_id: string | null
          fallback_target_department_id: string | null
          fallback_target_group_id: string | null
          fallback_target_job_title_id: string | null
          form_schema: Json | null
          id: string
          is_mandatory: boolean
          is_shared: boolean
          name: string
          order_index: number
          parallel_group: number | null
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
          user_id: string | null
          validation_config: Json | null
          validation_level_1_type: string | null
          validation_level_1_user_id: string | null
          validation_level_2_type: string | null
          validation_level_2_user_id: string | null
          visibility_level: Database["public"]["Enums"]["template_visibility"]
          watcher_config: Json | null
        }
        Insert: {
          assignment_type?: string
          be_category?: string | null
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          default_duration_hours?: number | null
          description?: string | null
          dispatch_manager_id?: string | null
          fallback_assignment_type?: string | null
          fallback_target_assignee_id?: string | null
          fallback_target_department_id?: string | null
          fallback_target_group_id?: string | null
          fallback_target_job_title_id?: string | null
          form_schema?: Json | null
          id?: string
          is_mandatory?: boolean
          is_shared?: boolean
          name: string
          order_index?: number
          parallel_group?: number | null
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
          user_id?: string | null
          validation_config?: Json | null
          validation_level_1_type?: string | null
          validation_level_1_user_id?: string | null
          validation_level_2_type?: string | null
          validation_level_2_user_id?: string | null
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
          watcher_config?: Json | null
        }
        Update: {
          assignment_type?: string
          be_category?: string | null
          created_at?: string
          creator_company_id?: string | null
          creator_department_id?: string | null
          default_duration_hours?: number | null
          description?: string | null
          dispatch_manager_id?: string | null
          fallback_assignment_type?: string | null
          fallback_target_assignee_id?: string | null
          fallback_target_department_id?: string | null
          fallback_target_group_id?: string | null
          fallback_target_job_title_id?: string | null
          form_schema?: Json | null
          id?: string
          is_mandatory?: boolean
          is_shared?: boolean
          name?: string
          order_index?: number
          parallel_group?: number | null
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
          user_id?: string | null
          validation_config?: Json | null
          validation_level_1_type?: string | null
          validation_level_1_user_id?: string | null
          validation_level_2_type?: string | null
          validation_level_2_user_id?: string | null
          visibility_level?: Database["public"]["Enums"]["template_visibility"]
          watcher_config?: Json | null
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
            foreignKeyName: "sub_process_templates_dispatch_manager_id_fkey"
            columns: ["dispatch_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_fallback_target_assignee_id_fkey"
            columns: ["fallback_target_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_fallback_target_department_id_fkey"
            columns: ["fallback_target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_fallback_target_group_id_fkey"
            columns: ["fallback_target_group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_fallback_target_job_title_id_fkey"
            columns: ["fallback_target_job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
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
          {
            foreignKeyName: "sub_process_templates_validation_level_1_user_id_fkey"
            columns: ["validation_level_1_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_process_templates_validation_level_2_user_id_fkey"
            columns: ["validation_level_2_user_id"]
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
      supplier_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          storage_path: string
          supplier_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          storage_path: string
          supplier_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          storage_path?: string
          supplier_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_attachments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_purchase_enrichment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_attachments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_ca_realise"
            referencedColumns: ["supplier_id"]
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
          ca_estime: number | null
          categorie: string | null
          commentaires: string | null
          commentaires_date_contrat: string | null
          commentaires_type_de_contrat: string | null
          completeness_score: number | null
          created_at: string | null
          date_premiere_signature: string | null
          delai_de_paiement: string | null
          delais_de_paiement_commentaires: string | null
          description: string | null
          echeances_de_paiement: string | null
          entite: string | null
          evolution_tarif_2026: string | null
          exclusivite_non_sollicitation: string | null
          famille: string | null
          famille_source_initiale: string | null
          garanties_bancaire_et_equipement: string | null
          id: string
          incoterm: string | null
          nom_commercial: string | null
          nom_contact: string | null
          nomfournisseur: string | null
          penalites: string | null
          poste: string | null
          remise: string | null
          rfa: string | null
          segment: string | null
          siret: string | null
          site_web: string | null
          sous_segment: string | null
          status: string | null
          telephone: string | null
          tiers: string
          transport: string | null
          tva: string | null
          type_de_contrat: string | null
          updated_at: string | null
          updated_by: string | null
          validite_du_contrat: string | null
          validite_prix: string | null
        }
        Insert: {
          adresse_mail?: string | null
          avenants?: string | null
          ca_estime?: number | null
          categorie?: string | null
          commentaires?: string | null
          commentaires_date_contrat?: string | null
          commentaires_type_de_contrat?: string | null
          completeness_score?: number | null
          created_at?: string | null
          date_premiere_signature?: string | null
          delai_de_paiement?: string | null
          delais_de_paiement_commentaires?: string | null
          description?: string | null
          echeances_de_paiement?: string | null
          entite?: string | null
          evolution_tarif_2026?: string | null
          exclusivite_non_sollicitation?: string | null
          famille?: string | null
          famille_source_initiale?: string | null
          garanties_bancaire_et_equipement?: string | null
          id?: string
          incoterm?: string | null
          nom_commercial?: string | null
          nom_contact?: string | null
          nomfournisseur?: string | null
          penalites?: string | null
          poste?: string | null
          remise?: string | null
          rfa?: string | null
          segment?: string | null
          siret?: string | null
          site_web?: string | null
          sous_segment?: string | null
          status?: string | null
          telephone?: string | null
          tiers: string
          transport?: string | null
          tva?: string | null
          type_de_contrat?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validite_du_contrat?: string | null
          validite_prix?: string | null
        }
        Update: {
          adresse_mail?: string | null
          avenants?: string | null
          ca_estime?: number | null
          categorie?: string | null
          commentaires?: string | null
          commentaires_date_contrat?: string | null
          commentaires_type_de_contrat?: string | null
          completeness_score?: number | null
          created_at?: string | null
          date_premiere_signature?: string | null
          delai_de_paiement?: string | null
          delais_de_paiement_commentaires?: string | null
          description?: string | null
          echeances_de_paiement?: string | null
          entite?: string | null
          evolution_tarif_2026?: string | null
          exclusivite_non_sollicitation?: string | null
          famille?: string | null
          famille_source_initiale?: string | null
          garanties_bancaire_et_equipement?: string | null
          id?: string
          incoterm?: string | null
          nom_commercial?: string | null
          nom_contact?: string | null
          nomfournisseur?: string | null
          penalites?: string | null
          poste?: string | null
          remise?: string | null
          rfa?: string | null
          segment?: string | null
          siret?: string | null
          site_web?: string | null
          sous_segment?: string | null
          status?: string | null
          telephone?: string | null
          tiers?: string
          transport?: string | null
          tva?: string | null
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
      supplier_waiting_approval: {
        Row: {
          adresse_mail: string | null
          avenants: string | null
          ca_estime: number | null
          categorie: string | null
          commentaires: string | null
          commentaires_date_contrat: string | null
          commentaires_type_de_contrat: string | null
          completeness_score: number | null
          created_at: string | null
          date_premiere_signature: string | null
          delai_de_paiement: string | null
          delais_de_paiement_commentaires: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          deletion_reason: string | null
          description: string | null
          echeances_de_paiement: string | null
          entite: string | null
          evolution_tarif_2026: string | null
          exclusivite_non_sollicitation: string | null
          famille: string | null
          famille_source_initiale: string | null
          garanties_bancaire_et_equipement: string | null
          id: string
          incoterm: string | null
          line_index: string
          nom_contact: string | null
          nomfournisseur: string | null
          pays: string | null
          penalites: string | null
          poste: string | null
          rejected_at: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          remise: string | null
          rfa: string | null
          segment: string | null
          siret: string | null
          site_web: string | null
          sous_segment: string | null
          status: string | null
          submitted_by_user_id: string | null
          telephone: string | null
          tiers: string | null
          transport: string | null
          tva: string | null
          type_de_contrat: string | null
          updated_at: string | null
          updated_by: string | null
          validated_by_achats_at: string | null
          validated_by_achats_user_id: string | null
          validated_by_compta_at: string | null
          validated_by_compta_user_id: string | null
          validite_du_contrat: string | null
          validite_prix: string | null
        }
        Insert: {
          adresse_mail?: string | null
          avenants?: string | null
          ca_estime?: number | null
          categorie?: string | null
          commentaires?: string | null
          commentaires_date_contrat?: string | null
          commentaires_type_de_contrat?: string | null
          completeness_score?: number | null
          created_at?: string | null
          date_premiere_signature?: string | null
          delai_de_paiement?: string | null
          delais_de_paiement_commentaires?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          echeances_de_paiement?: string | null
          entite?: string | null
          evolution_tarif_2026?: string | null
          exclusivite_non_sollicitation?: string | null
          famille?: string | null
          famille_source_initiale?: string | null
          garanties_bancaire_et_equipement?: string | null
          id?: string
          incoterm?: string | null
          line_index: string
          nom_contact?: string | null
          nomfournisseur?: string | null
          pays?: string | null
          penalites?: string | null
          poste?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          remise?: string | null
          rfa?: string | null
          segment?: string | null
          siret?: string | null
          site_web?: string | null
          sous_segment?: string | null
          status?: string | null
          submitted_by_user_id?: string | null
          telephone?: string | null
          tiers?: string | null
          transport?: string | null
          tva?: string | null
          type_de_contrat?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validated_by_achats_at?: string | null
          validated_by_achats_user_id?: string | null
          validated_by_compta_at?: string | null
          validated_by_compta_user_id?: string | null
          validite_du_contrat?: string | null
          validite_prix?: string | null
        }
        Update: {
          adresse_mail?: string | null
          avenants?: string | null
          ca_estime?: number | null
          categorie?: string | null
          commentaires?: string | null
          commentaires_date_contrat?: string | null
          commentaires_type_de_contrat?: string | null
          completeness_score?: number | null
          created_at?: string | null
          date_premiere_signature?: string | null
          delai_de_paiement?: string | null
          delais_de_paiement_commentaires?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          deletion_reason?: string | null
          description?: string | null
          echeances_de_paiement?: string | null
          entite?: string | null
          evolution_tarif_2026?: string | null
          exclusivite_non_sollicitation?: string | null
          famille?: string | null
          famille_source_initiale?: string | null
          garanties_bancaire_et_equipement?: string | null
          id?: string
          incoterm?: string | null
          line_index?: string
          nom_contact?: string | null
          nomfournisseur?: string | null
          pays?: string | null
          penalites?: string | null
          poste?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          remise?: string | null
          rfa?: string | null
          segment?: string | null
          siret?: string | null
          site_web?: string | null
          sous_segment?: string | null
          status?: string | null
          submitted_by_user_id?: string | null
          telephone?: string | null
          tiers?: string | null
          transport?: string | null
          tva?: string | null
          type_de_contrat?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validated_by_achats_at?: string | null
          validated_by_achats_user_id?: string | null
          validated_by_compta_at?: string | null
          validated_by_compta_user_id?: string | null
          validite_du_contrat?: string | null
          validite_prix?: string | null
        }
        Relationships: []
      }
      supplier_waiting_approval_attachments: {
        Row: {
          attachment_kind: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          storage_path: string
          uploaded_by: string | null
          waiting_approval_id: string
        }
        Insert: {
          attachment_kind: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          storage_path: string
          uploaded_by?: string | null
          waiting_approval_id: string
        }
        Update: {
          attachment_kind?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          storage_path?: string
          uploaded_by?: string | null
          waiting_approval_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_waiting_approval_attachments_waiting_approval_id_fkey"
            columns: ["waiting_approval_id"]
            isOneToOne: false
            referencedRelation: "supplier_waiting_approval"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_waiting_field_reviews: {
        Row: {
          comment: string
          created_at: string | null
          created_by: string | null
          field_key: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          waiting_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          created_by?: string | null
          field_key: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          waiting_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          created_by?: string | null
          field_key?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          waiting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_waiting_field_reviews_waiting_id_fkey"
            columns: ["waiting_id"]
            isOneToOne: false
            referencedRelation: "supplier_waiting_approval"
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
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
      task_labels: {
        Row: {
          created_at: string
          id: string
          label_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "service_group_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "task_labels_task_id_fkey"
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
      task_step_field_values: {
        Row: {
          created_at: string
          id: string
          step_field_id: string
          task_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          step_field_id: string
          task_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          step_field_id?: string
          task_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_step_field_values_step_field_id_fkey"
            columns: ["step_field_id"]
            isOneToOne: false
            referencedRelation: "sub_process_step_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_step_field_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_step_field_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "task_step_field_values_task_id_fkey"
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
      task_template_visible_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          task_template_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          task_template_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          task_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_visible_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "collaborator_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_visible_groups_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_visible_users: {
        Row: {
          created_at: string
          id: string
          task_template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_visible_users_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_template_visible_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          default_duration_unit: string
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
          default_duration_unit?: string
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
          default_duration_unit?: string
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
          allows_reassignment: boolean
          assignee_id: string | null
          be_affaire_id: string | null
          be_label_id: string | null
          be_project_id: string | null
          be_status: string | null
          be_status_dates: Json | null
          be_urgency: string | null
          category: string | null
          category_id: string | null
          created_at: string
          current_validation_level: number | null
          date_demande: string | null
          date_fermeture: string | null
          date_lancement: string | null
          depends_on_task_id: string | null
          description: string | null
          document_url: string | null
          due_date: string | null
          duration_hours: number | null
          group_assignee_ids: string[] | null
          id: string
          is_assignment_task: boolean
          is_dependency_locked: boolean | null
          is_locked_for_validation: boolean | null
          it_project_id: string | null
          it_project_phase: string | null
          module_code: Database["public"]["Enums"]["module_code"] | null
          module_data: Json | null
          original_assignee_id: string | null
          parent_complement_id: string | null
          parent_request_id: string | null
          parent_sub_process_run_id: string | null
          planner_labels: string[] | null
          priority: string
          process_template_id: string | null
          rbe_validated_at: string | null
          rbe_validation_comment: string | null
          rbe_validation_status: string | null
          rbe_validator_id: string | null
          reassignment_stakeholder_id: string | null
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
          status_dates: Json | null
          sub_process_template_id: string | null
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
          allows_reassignment?: boolean
          assignee_id?: string | null
          be_affaire_id?: string | null
          be_label_id?: string | null
          be_project_id?: string | null
          be_status?: string | null
          be_status_dates?: Json | null
          be_urgency?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          current_validation_level?: number | null
          date_demande?: string | null
          date_fermeture?: string | null
          date_lancement?: string | null
          depends_on_task_id?: string | null
          description?: string | null
          document_url?: string | null
          due_date?: string | null
          duration_hours?: number | null
          group_assignee_ids?: string[] | null
          id?: string
          is_assignment_task?: boolean
          is_dependency_locked?: boolean | null
          is_locked_for_validation?: boolean | null
          it_project_id?: string | null
          it_project_phase?: string | null
          module_code?: Database["public"]["Enums"]["module_code"] | null
          module_data?: Json | null
          original_assignee_id?: string | null
          parent_complement_id?: string | null
          parent_request_id?: string | null
          parent_sub_process_run_id?: string | null
          planner_labels?: string[] | null
          priority?: string
          process_template_id?: string | null
          rbe_validated_at?: string | null
          rbe_validation_comment?: string | null
          rbe_validation_status?: string | null
          rbe_validator_id?: string | null
          reassignment_stakeholder_id?: string | null
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
          status_dates?: Json | null
          sub_process_template_id?: string | null
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
          allows_reassignment?: boolean
          assignee_id?: string | null
          be_affaire_id?: string | null
          be_label_id?: string | null
          be_project_id?: string | null
          be_status?: string | null
          be_status_dates?: Json | null
          be_urgency?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          current_validation_level?: number | null
          date_demande?: string | null
          date_fermeture?: string | null
          date_lancement?: string | null
          depends_on_task_id?: string | null
          description?: string | null
          document_url?: string | null
          due_date?: string | null
          duration_hours?: number | null
          group_assignee_ids?: string[] | null
          id?: string
          is_assignment_task?: boolean
          is_dependency_locked?: boolean | null
          is_locked_for_validation?: boolean | null
          it_project_id?: string | null
          it_project_phase?: string | null
          module_code?: Database["public"]["Enums"]["module_code"] | null
          module_data?: Json | null
          original_assignee_id?: string | null
          parent_complement_id?: string | null
          parent_request_id?: string | null
          parent_sub_process_run_id?: string | null
          planner_labels?: string[] | null
          priority?: string
          process_template_id?: string | null
          rbe_validated_at?: string | null
          rbe_validation_comment?: string | null
          rbe_validation_status?: string | null
          rbe_validator_id?: string | null
          reassignment_stakeholder_id?: string | null
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
          status_dates?: Json | null
          sub_process_template_id?: string | null
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
            foreignKeyName: "tasks_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "be_affaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_budget_kpi"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "tasks_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_kpi"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "tasks_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_par_poste"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "tasks_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_affaire_temps_par_user"
            referencedColumns: ["be_affaire_id"]
          },
          {
            foreignKeyName: "tasks_be_affaire_id_fkey"
            columns: ["be_affaire_id"]
            isOneToOne: false
            referencedRelation: "v_be_temps_detail_mensuel"
            referencedColumns: ["be_affaire_id"]
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
            foreignKeyName: "tasks_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "tasks_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
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
            foreignKeyName: "tasks_parent_complement_id_fkey"
            columns: ["parent_complement_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "tasks_parent_complement_id_fkey"
            columns: ["parent_complement_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["request_id"]
          },
          {
            foreignKeyName: "tasks_parent_complement_id_fkey"
            columns: ["parent_complement_id"]
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
            foreignKeyName: "tasks_reassignment_stakeholder_id_fkey"
            columns: ["reassignment_stakeholder_id"]
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
            foreignKeyName: "tasks_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
            isOneToOne: false
            referencedRelation: "request_progress_view"
            referencedColumns: ["sub_process_template_id"]
          },
          {
            foreignKeyName: "tasks_sub_process_template_id_fkey"
            columns: ["sub_process_template_id"]
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
          is_agent_field: boolean
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
          is_agent_field?: boolean
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
          is_agent_field?: boolean
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
          is_global: boolean
          name: string
          process_template_id: string | null
          updated_at: string
          user_id: string
          visible_columns: Json | null
        }
        Insert: {
          context_type?: string
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_global?: boolean
          name: string
          process_template_id?: string | null
          updated_at?: string
          user_id: string
          visible_columns?: Json | null
        }
        Update: {
          context_type?: string
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          is_global?: boolean
          name?: string
          process_template_id?: string | null
          updated_at?: string
          user_id?: string
          visible_columns?: Json | null
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
          calendar_sync_future_days: number
          calendar_sync_past_days: number
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
          calendar_sync_future_days?: number
          calendar_sync_past_days?: number
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
          calendar_sync_future_days?: number
          calendar_sync_past_days?: number
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
          can_access_be_budget: boolean | null
          can_access_be_dispatch: boolean | null
          can_access_be_tjm: boolean | null
          can_access_calendar: boolean | null
          can_access_dashboard: boolean | null
          can_access_innovation: boolean | null
          can_access_it_budget: boolean | null
          can_access_it_cartographie: boolean | null
          can_access_it_dispatch: boolean | null
          can_access_it_projects: boolean | null
          can_access_logistique: boolean | null
          can_access_maintenance: boolean | null
          can_access_my_requests: boolean | null
          can_access_process_tracking: boolean | null
          can_access_projects: boolean | null
          can_access_requests: boolean | null
          can_access_settings: boolean | null
          can_access_spv: boolean | null
          can_access_suppliers: boolean | null
          can_access_tasks: boolean | null
          can_access_team: boolean | null
          can_access_templates: boolean | null
          can_access_workload: boolean | null
          can_assign_to_all: boolean | null
          can_assign_to_subordinates: boolean | null
          can_create_be_projects: boolean | null
          can_create_suppliers: boolean | null
          can_delete_be_projects: boolean | null
          can_delete_suppliers: boolean | null
          can_edit_be_projects: boolean | null
          can_edit_suppliers: boolean | null
          can_manage_all_tasks: boolean | null
          can_manage_own_tasks: boolean | null
          can_manage_subordinates_tasks: boolean | null
          can_manage_templates: boolean | null
          can_manage_users: boolean | null
          can_view_all_tasks: boolean | null
          can_view_be_projects: boolean | null
          can_view_own_tasks: boolean | null
          can_view_subordinates_tasks: boolean | null
          can_view_suppliers: boolean | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access_analytics?: boolean | null
          can_access_be_budget?: boolean | null
          can_access_be_dispatch?: boolean | null
          can_access_be_tjm?: boolean | null
          can_access_calendar?: boolean | null
          can_access_dashboard?: boolean | null
          can_access_innovation?: boolean | null
          can_access_it_budget?: boolean | null
          can_access_it_cartographie?: boolean | null
          can_access_it_dispatch?: boolean | null
          can_access_it_projects?: boolean | null
          can_access_logistique?: boolean | null
          can_access_maintenance?: boolean | null
          can_access_my_requests?: boolean | null
          can_access_process_tracking?: boolean | null
          can_access_projects?: boolean | null
          can_access_requests?: boolean | null
          can_access_settings?: boolean | null
          can_access_spv?: boolean | null
          can_access_suppliers?: boolean | null
          can_access_tasks?: boolean | null
          can_access_team?: boolean | null
          can_access_templates?: boolean | null
          can_access_workload?: boolean | null
          can_assign_to_all?: boolean | null
          can_assign_to_subordinates?: boolean | null
          can_create_be_projects?: boolean | null
          can_create_suppliers?: boolean | null
          can_delete_be_projects?: boolean | null
          can_delete_suppliers?: boolean | null
          can_edit_be_projects?: boolean | null
          can_edit_suppliers?: boolean | null
          can_manage_all_tasks?: boolean | null
          can_manage_own_tasks?: boolean | null
          can_manage_subordinates_tasks?: boolean | null
          can_manage_templates?: boolean | null
          can_manage_users?: boolean | null
          can_view_all_tasks?: boolean | null
          can_view_be_projects?: boolean | null
          can_view_own_tasks?: boolean | null
          can_view_subordinates_tasks?: boolean | null
          can_view_suppliers?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access_analytics?: boolean | null
          can_access_be_budget?: boolean | null
          can_access_be_dispatch?: boolean | null
          can_access_be_tjm?: boolean | null
          can_access_calendar?: boolean | null
          can_access_dashboard?: boolean | null
          can_access_innovation?: boolean | null
          can_access_it_budget?: boolean | null
          can_access_it_cartographie?: boolean | null
          can_access_it_dispatch?: boolean | null
          can_access_it_projects?: boolean | null
          can_access_logistique?: boolean | null
          can_access_maintenance?: boolean | null
          can_access_my_requests?: boolean | null
          can_access_process_tracking?: boolean | null
          can_access_projects?: boolean | null
          can_access_requests?: boolean | null
          can_access_settings?: boolean | null
          can_access_spv?: boolean | null
          can_access_suppliers?: boolean | null
          can_access_tasks?: boolean | null
          can_access_team?: boolean | null
          can_access_templates?: boolean | null
          can_access_workload?: boolean | null
          can_assign_to_all?: boolean | null
          can_assign_to_subordinates?: boolean | null
          can_create_be_projects?: boolean | null
          can_create_suppliers?: boolean | null
          can_delete_be_projects?: boolean | null
          can_delete_suppliers?: boolean | null
          can_edit_be_projects?: boolean | null
          can_edit_suppliers?: boolean | null
          can_manage_all_tasks?: boolean | null
          can_manage_own_tasks?: boolean | null
          can_manage_subordinates_tasks?: boolean | null
          can_manage_templates?: boolean | null
          can_manage_users?: boolean | null
          can_view_all_tasks?: boolean | null
          can_view_be_projects?: boolean | null
          can_view_own_tasks?: boolean | null
          can_view_subordinates_tasks?: boolean | null
          can_view_suppliers?: boolean | null
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
      workload_slots: {
        Row: {
          created_at: string
          date: string
          duration_hours: number
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
          duration_hours?: number
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
          duration_hours?: number
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
            referencedRelation: "maintenance_requests_overview"
            referencedColumns: ["task_id"]
          },
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
      maintenance_requests_overview: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          due_date: string | null
          etat_global: string | null
          lignes: Json | null
          module_data: Json | null
          nb_lignes: number | null
          qte_totale: number | null
          requester_id: string | null
          status: string | null
          task_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          due_date?: string | null
          etat_global?: never
          lignes?: never
          module_data?: Json | null
          nb_lignes?: never
          qte_totale?: never
          requester_id?: string | null
          status?: string | null
          task_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          due_date?: string | null
          etat_global?: never
          lignes?: never
          module_data?: Json | null
          nb_lignes?: never
          qte_totale?: never
          requester_id?: string | null
          status?: string | null
          task_id?: string | null
          title?: string | null
          updated_at?: string | null
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
            foreignKeyName: "tasks_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      v_be_affaire_budget_kpi: {
        Row: {
          affaire_libelle: string | null
          affaire_status: string | null
          be_affaire_id: string | null
          be_project_id: string | null
          ca_constate_brut: number | null
          ca_engage_brut: number | null
          code_affaire: string | null
          cogs_constate_brut: number | null
          cogs_engage_brut: number | null
          constate_montant_brut: number | null
          cout_rh_declare: number | null
          engage_montant_brut: number | null
          jours_declares: number | null
          marge_brute_brut: number | null
          marge_constatee_brut: number | null
          marge_directe_brut: number | null
          nb_commandes: number | null
          nb_factures: number | null
        }
        Relationships: [
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
        ]
      }
      v_be_affaire_temps_kpi: {
        Row: {
          be_affaire_id: string | null
          be_project_id: string | null
          code_affaire: string | null
          cout_rh_budgete: number | null
          cout_rh_declare: number | null
          cout_rh_planifie: number | null
          heures_declarees: number | null
          heures_planifiees: number | null
          jours_budgetes: number | null
          jours_declares: number | null
          jours_planifies: number | null
        }
        Relationships: [
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
        ]
      }
      v_be_affaire_temps_par_poste: {
        Row: {
          be_affaire_id: string | null
          code_affaire: string | null
          cout_rh: number | null
          heures: number | null
          jours: number | null
          nb_collaborateurs: number | null
          nb_saisies: number | null
          poste: string | null
        }
        Relationships: []
      }
      v_be_affaire_temps_par_user: {
        Row: {
          be_affaire_id: string | null
          be_fonction: string | null
          code_affaire: string | null
          cout_rh: number | null
          derniere_saisie: string | null
          display_name: string | null
          heures: number | null
          id_lucca: number | null
          job_title: string | null
          jours: number | null
          nb_saisies: number | null
          premiere_saisie: string | null
          source_taux: string | null
          taux_horaire_effectif: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lucca_saisie_temps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_be_fonction_fkey"
            columns: ["be_fonction"]
            isOneToOne: false
            referencedRelation: "be_tjm_fonctions"
            referencedColumns: ["fonction"]
          },
        ]
      }
      v_be_divalto_affaires_to_import: {
        Row: {
          categorie: string | null
          code_affaire: string | null
          code_projet_parent: string | null
          dernier_mouvement: string | null
          libelle_principal: string | null
          montant_total: number | null
          nb_pieces: number | null
          parent_project_exists: boolean | null
          premier_mouvement: string | null
        }
        Relationships: []
      }
      v_be_groupe_kpi: {
        Row: {
          be_project_id: string | null
          ca_constate_brut: number | null
          ca_engage_brut: number | null
          code_groupe: string | null
          cogs_constate_brut: number | null
          cogs_engage_brut: number | null
          cout_rh_budgete: number | null
          cout_rh_declare: number | null
          heures_declarees: number | null
          jours_budgetes: number | null
          jours_declares: number | null
          marge_brute_brut: number | null
          marge_constatee_brut: number | null
          marge_directe_brut: number | null
          nb_activites_divalto: number | null
          nb_collaborateurs: number | null
          nb_commandes: number | null
          nb_factures: number | null
        }
        Relationships: [
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
        ]
      }
      v_be_project_budget_kpi: {
        Row: {
          be_project_id: string | null
          ca_constate_brut: number | null
          ca_engage_brut: number | null
          code_projet: string | null
          cogs_constate_brut: number | null
          cogs_engage_brut: number | null
          constate_montant_brut: number | null
          engage_montant_brut: number | null
          marge_brute_brut: number | null
          marge_constatee_brut: number | null
          marge_directe_brut: number | null
          nb_affaires: number | null
          nb_commandes: number | null
          nb_factures: number | null
        }
        Relationships: []
      }
      v_be_project_synthese_kpi: {
        Row: {
          be_project_id: string | null
          ca_constate_brut: number | null
          ca_engage_brut: number | null
          code_projet: string | null
          cogs_constate_brut: number | null
          cogs_engage_brut: number | null
          cout_rh_budgete: number | null
          cout_rh_declare: number | null
          cout_rh_planifie: number | null
          jours_budgetes: number | null
          jours_declares: number | null
          jours_planifies: number | null
          marge_brute_brut: number | null
          marge_constatee_brut: number | null
          marge_directe_brut: number | null
          nb_affaires: number | null
          nb_commandes: number | null
          nb_factures: number | null
          nom_projet: string | null
          status: string | null
        }
        Relationships: []
      }
      v_be_temps_detail_mensuel: {
        Row: {
          affaire_libelle: string | null
          be_affaire_id: string | null
          be_project_id: string | null
          code_affaire: string | null
          cout_rh: number | null
          heures: number | null
          jours: number | null
          mois: string | null
          nb_saisies: number | null
          poste: string | null
          user_display_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "be_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_budget_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "be_affaires_be_project_id_fkey"
            columns: ["be_project_id"]
            isOneToOne: false
            referencedRelation: "v_be_project_synthese_kpi"
            referencedColumns: ["be_project_id"]
          },
          {
            foreignKeyName: "lucca_saisie_temps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_it_budget_engage_constate: {
        Row: {
          annee: number | null
          budget_line_id: string | null
          categorie: string | null
          constate: number | null
          engage: number | null
          entite: string | null
          fournisseur_prevu: string | null
          it_project_id: string | null
          nb_commandes: number | null
          nb_factures: number | null
        }
        Relationships: [
          {
            foreignKeyName: "it_budget_lines_it_project_id_fkey"
            columns: ["it_project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_it_rh_cout: {
        Row: {
          annee: number | null
          charges_pct: number | null
          commentaire: string | null
          cout_brut_annuel: number | null
          cout_charge_annuel: number | null
          created_at: string | null
          fonction: string | null
          id: string | null
          metier: string | null
          profile_id: string | null
          salarie: string | null
          updated_at: string | null
        }
        Insert: {
          annee?: number | null
          charges_pct?: number | null
          commentaire?: string | null
          cout_brut_annuel?: never
          cout_charge_annuel?: never
          created_at?: string | null
          fonction?: string | null
          id?: string | null
          metier?: string | null
          profile_id?: string | null
          salarie?: string | null
          updated_at?: string | null
        }
        Update: {
          annee?: number | null
          charges_pct?: number | null
          commentaire?: string | null
          cout_brut_annuel?: never
          cout_charge_annuel?: never
          created_at?: string | null
          fonction?: string | null
          id?: string | null
          metier?: string | null
          profile_id?: string | null
          salarie?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_rh_lines_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_supplier_ca_realise: {
        Row: {
          ca_realise_annee_courante: number | null
          ca_realise_annee_precedente: number | null
          ca_realise_total: number | null
          derniere_facture_at: string | null
          nb_factures_annee_courante: number | null
          nb_factures_total: number | null
          nomfournisseur: string | null
          supplier_id: string | null
          tiers: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_supplier_waiting_validation: {
        Args: { p_waiting_ids: string[] }
        Returns: undefined
      }
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
      current_profile_global_task_read: { Args: never; Returns: boolean }
      current_profile_id: { Args: never; Returns: string }
      current_profile_team_task_hierarchy_mutate: {
        Args: never
        Returns: boolean
      }
      current_profile_team_task_hierarchy_read: {
        Args: never
        Returns: boolean
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
          status: string
          user_id: string
        }[]
      }
      get_fou_resultat_aggregated: {
        Args: {
          p_dos?: string[]
          p_months?: string[]
          p_tiers?: string
          p_type_dates?: string[]
          p_years?: string[]
        }
        Returns: {
          annee: string
          ca_commande: number
          ca_facture: number
          dos: string
          ecart_cmd_fac: number
          mois: string
          tiers: string
          type_date: string
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
      get_public_tables_info: {
        Args: never
        Returns: {
          row_count: number
          table_name: string
        }[]
      }
      get_table_columns_info: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
        }[]
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
      is_app_admin: { Args: never; Returns: boolean }
      is_chat_admin: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_inno_admin: { Args: never; Returns: boolean }
      merge_it_projects: {
        Args: { master_id: string; source_ids: string[] }
        Returns: string
      }
      next_entity_number: {
        Args: { p_entity_type: string; p_project_code: string }
        Returns: string
      }
      profile_is_manager_ancestor_of: {
        Args: {
          _assignee_profile_id: string
          _potential_manager_profile_id: string
        }
        Returns: boolean
      }
      promote_supplier_waiting_to_enrichment: {
        Args: { p_waiting_ids: string[] }
        Returns: {
          attachments: Json
          enrichment_id: string
          former_waiting_id: string
        }[]
      }
      register_supplier_famille_from_demand: {
        Args: { p_famille: string }
        Returns: undefined
      }
      reject_supplier_waiting: {
        Args: { p_reason: string; p_waiting_id: string }
        Returns: undefined
      }
      sync_divalto_suppliers_to_enrichment: {
        Args: never
        Returns: {
          inserted_count: number
          name_updated_count: number
          total_distinct_divalto: number
        }[]
      }
      transfer_azure_identity: {
        Args: {
          p_from_user_id: string
          p_microsoft_email: string
          p_to_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "inno_admin" | "codir"
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
        | "multi_email"
      datalake_sync_direction: "app_to_datalake" | "datalake_to_app"
      datalake_sync_mode: "full" | "incremental"
      datalake_upsert_strategy: "insert_only" | "upsert" | "overwrite"
      module_code:
        | "be"
        | "it"
        | "rh"
        | "maintenance"
        | "logistique"
        | "comm"
        | "innovation"
        | "smq"
      notification_channel: "in_app" | "email" | "teams"
      page_access_level: "none" | "read" | "write"
      template_visibility:
        | "private"
        | "internal_department"
        | "internal_company"
        | "public"
        | "internal_group"
        | "internal_users"
      validation_instance_status:
        | "pending"
        | "approved"
        | "rejected"
        | "expired"
        | "skipped"
      validation_type: "none" | "manager" | "requester" | "free"
      wf_action_type: "db_insert" | "db_update" | "create_task" | "set_field"
      wf_assignment_type:
        | "user"
        | "manager"
        | "requester"
        | "group"
        | "department"
        | "job_title"
      wf_instance_status:
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
        | "paused"
      wf_step_type:
        | "start"
        | "end"
        | "validation"
        | "execution"
        | "assignment"
        | "automatic"
        | "subprocess"
        | "notification"
        | "task_generation"
        | "request_creation"
        | "status_change"
      wf_validation_mode: "none" | "simple" | "n_of_m" | "sequence"
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
      app_role: ["admin", "moderator", "user", "inno_admin", "codir"],
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
        "multi_email",
      ],
      datalake_sync_direction: ["app_to_datalake", "datalake_to_app"],
      datalake_sync_mode: ["full", "incremental"],
      datalake_upsert_strategy: ["insert_only", "upsert", "overwrite"],
      module_code: [
        "be",
        "it",
        "rh",
        "maintenance",
        "logistique",
        "comm",
        "innovation",
        "smq",
      ],
      notification_channel: ["in_app", "email", "teams"],
      page_access_level: ["none", "read", "write"],
      template_visibility: [
        "private",
        "internal_department",
        "internal_company",
        "public",
        "internal_group",
        "internal_users",
      ],
      validation_instance_status: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "skipped",
      ],
      validation_type: ["none", "manager", "requester", "free"],
      wf_action_type: ["db_insert", "db_update", "create_task", "set_field"],
      wf_assignment_type: [
        "user",
        "manager",
        "requester",
        "group",
        "department",
        "job_title",
      ],
      wf_instance_status: [
        "running",
        "completed",
        "failed",
        "cancelled",
        "paused",
      ],
      wf_step_type: [
        "start",
        "end",
        "validation",
        "execution",
        "assignment",
        "automatic",
        "subprocess",
        "notification",
        "task_generation",
        "request_creation",
        "status_change",
      ],
      wf_validation_mode: ["none", "simple", "n_of_m", "sequence"],
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
A new version of Supabase CLI is available: v2.98.2 (currently installed v2.95.4)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
