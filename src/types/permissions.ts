// ─── Screen access keys ───────────────────────────────────────────────────────
export const SCREEN_PERMISSIONS = [
  // Mon espace
  'can_access_dashboard',
  'can_access_requests',
  'can_access_my_requests',
  'can_access_tasks',
  'can_access_process_tracking',
  'can_access_workload',
  'can_access_calendar',
  // Bureau d'Études
  'can_access_projects',
  'can_access_be_dispatch',
  'can_access_be_budget',
  'can_access_be_tjm',
  // SPV
  'can_access_spv',
  // IT / Digital
  'can_access_it_dispatch',
  'can_access_it_projects',
  'can_access_it_budget',
  'can_access_it_cartographie',
  // Autres modules
  'can_access_innovation',
  'can_access_maintenance',
  'can_access_logistique',
  'can_access_smq',
  // Transverse
  'can_access_suppliers',
  'can_access_templates',
  'can_access_team',
  'can_access_analytics',
  'can_access_settings',
] as const;

export type ScreenPermissionKey = typeof SCREEN_PERMISSIONS[number];

// ─── Grouped layout for the admin UI ─────────────────────────────────────────
export const SCREEN_PERMISSION_GROUPS: Array<{
  label: string;
  keys: ScreenPermissionKey[];
}> = [
  {
    label: 'Mon espace',
    keys: [
      'can_access_dashboard',
      'can_access_requests',
      'can_access_my_requests',
      'can_access_tasks',
      'can_access_process_tracking',
      'can_access_workload',
      'can_access_calendar',
    ],
  },
  {
    label: 'Bureau d\'Études',
    keys: [
      'can_access_projects',
      'can_access_be_dispatch',
      'can_access_be_budget',
      'can_access_be_tjm',
    ],
  },
  {
    label: 'SPV',
    keys: ['can_access_spv'],
  },
  {
    label: 'IT / Digital',
    keys: [
      'can_access_it_dispatch',
      'can_access_it_projects',
      'can_access_it_budget',
      'can_access_it_cartographie',
    ],
  },
  {
    label: 'Autres modules',
    keys: [
      'can_access_innovation',
      'can_access_maintenance',
      'can_access_logistique',
      'can_access_smq',
      'can_access_suppliers',
    ],
  },
  {
    label: 'Administration',
    keys: [
      'can_access_templates',
      'can_access_team',
      'can_access_analytics',
      'can_access_settings',
    ],
  },
];

// ─── Task/feature permission keys ─────────────────────────────────────────────
export const FEATURE_PERMISSIONS = [
  'can_manage_users',
  'can_manage_templates',
  'can_view_own_tasks',
  'can_manage_own_tasks',
  'can_view_subordinates_tasks',
  'can_manage_subordinates_tasks',
  'can_assign_to_subordinates',
  'can_view_all_tasks',
  'can_manage_all_tasks',
  'can_assign_to_all',
  'can_view_be_projects',
  'can_create_be_projects',
  'can_edit_be_projects',
  'can_delete_be_projects',
  'can_view_it_projects',
  'can_create_it_projects',
  'can_edit_it_projects',
  'can_delete_it_projects',
  'can_view_suppliers',
  'can_create_suppliers',
  'can_edit_suppliers',
  'can_delete_suppliers',
  // SMQ
  'can_manage_smq',
] as const;

export type FeaturePermissionKey = typeof FEATURE_PERMISSIONS[number];

export type AllPermissionKeys = ScreenPermissionKey | FeaturePermissionKey;

// ─── Screen labels ────────────────────────────────────────────────────────────
export const SCREEN_LABELS: Record<ScreenPermissionKey, string> = {
  can_access_dashboard:        'Tableau de bord',
  can_access_requests:         'Demandes',
  can_access_my_requests:      'Mes demandes',
  can_access_tasks:            'Tâches',
  can_access_process_tracking: 'Suivi processus',
  can_access_workload:         'Plan de charge',
  can_access_calendar:         'Calendrier',
  can_access_projects:         'BE Projets',
  can_access_be_dispatch:      'BE Dispatch & Suivi',
  can_access_be_budget:        'BE Budget',
  can_access_be_tjm:           'BE Référentiel TJM',
  can_access_spv:              'SPV',
  can_access_it_dispatch:      'IT Demandes',
  can_access_it_projects:      'IT Projets',
  can_access_it_budget:        'IT Budget',
  can_access_it_cartographie:  'IT Cartographie',
  can_access_innovation:       'Innovation',
  can_access_maintenance:      'Maintenance',
  can_access_logistique:       'Logistique',
  can_access_smq:              'SMQ — Non-conformités',
  can_access_suppliers:        'Fournisseurs',
  can_access_templates:        'Modèles',
  can_access_team:             'Équipe',
  can_access_analytics:        'Analytique',
  can_access_settings:         'Paramètres',
};

// ─── User permission overrides (null = use profile default) ───────────────────
export interface UserPermissionOverride {
  id: string;
  user_id: string;
  // Mon espace
  can_access_dashboard: boolean | null;
  can_access_requests: boolean | null;
  can_access_my_requests: boolean | null;
  can_access_tasks: boolean | null;
  can_access_process_tracking: boolean | null;
  can_access_workload: boolean | null;
  can_access_calendar: boolean | null;
  // BE
  can_access_projects: boolean | null;
  can_access_be_dispatch: boolean | null;
  can_access_be_budget: boolean | null;
  can_access_be_tjm: boolean | null;
  // SPV
  can_access_spv: boolean | null;
  // IT
  can_access_it_dispatch: boolean | null;
  can_access_it_projects: boolean | null;
  can_access_it_budget: boolean | null;
  can_access_it_cartographie: boolean | null;
  // Modules
  can_access_innovation: boolean | null;
  can_access_maintenance: boolean | null;
  can_access_logistique: boolean | null;
  can_access_smq: boolean | null;
  can_manage_smq: boolean | null;
  // Transverse
  can_access_suppliers: boolean | null;
  can_access_templates: boolean | null;
  can_access_team: boolean | null;
  can_access_analytics: boolean | null;
  can_access_settings: boolean | null;
  // Task permissions
  can_manage_users: boolean | null;
  can_manage_templates: boolean | null;
  can_view_own_tasks: boolean | null;
  can_manage_own_tasks: boolean | null;
  can_view_subordinates_tasks: boolean | null;
  can_manage_subordinates_tasks: boolean | null;
  can_assign_to_subordinates: boolean | null;
  can_view_all_tasks: boolean | null;
  can_manage_all_tasks: boolean | null;
  can_assign_to_all: boolean | null;
  // BE Projects
  can_view_be_projects: boolean | null;
  can_create_be_projects: boolean | null;
  can_edit_be_projects: boolean | null;
  can_delete_be_projects: boolean | null;
  // IT Projects
  can_view_it_projects: boolean | null;
  can_create_it_projects: boolean | null;
  can_edit_it_projects: boolean | null;
  can_delete_it_projects: boolean | null;
  // Suppliers
  can_view_suppliers: boolean | null;
  can_create_suppliers: boolean | null;
  can_edit_suppliers: boolean | null;
  can_delete_suppliers: boolean | null;
  created_at: string;
  updated_at: string;
}

// ─── Computed effective permissions ───────────────────────────────────────────
export interface EffectivePermissions {
  // Mon espace
  can_access_dashboard: boolean;
  can_access_requests: boolean;
  can_access_my_requests: boolean;
  can_access_tasks: boolean;
  can_access_process_tracking: boolean;
  can_access_workload: boolean;
  can_access_calendar: boolean;
  // BE
  can_access_projects: boolean;
  can_access_be_dispatch: boolean;
  can_access_be_budget: boolean;
  can_access_be_tjm: boolean;
  // SPV
  can_access_spv: boolean;
  // IT
  can_access_it_dispatch: boolean;
  can_access_it_projects: boolean;
  can_access_it_budget: boolean;
  can_access_it_cartographie: boolean;
  // Modules
  can_access_innovation: boolean;
  can_access_maintenance: boolean;
  can_access_logistique: boolean;
  can_access_smq: boolean;
  can_manage_smq: boolean;
  // Transverse
  can_access_suppliers: boolean;
  can_access_templates: boolean;
  can_access_team: boolean;
  can_access_analytics: boolean;
  can_access_settings: boolean;
  // Task permissions
  can_manage_users: boolean;
  can_manage_templates: boolean;
  can_view_own_tasks: boolean;
  can_manage_own_tasks: boolean;
  can_view_subordinates_tasks: boolean;
  can_manage_subordinates_tasks: boolean;
  can_assign_to_subordinates: boolean;
  can_view_all_tasks: boolean;
  can_manage_all_tasks: boolean;
  can_assign_to_all: boolean;
  // BE Projects
  can_view_be_projects: boolean;
  can_create_be_projects: boolean;
  can_edit_be_projects: boolean;
  can_delete_be_projects: boolean;
  // IT Projects
  can_view_it_projects: boolean;
  can_create_it_projects: boolean;
  can_edit_it_projects: boolean;
  can_delete_it_projects: boolean;
  // Suppliers
  can_view_suppliers: boolean;
  can_create_suppliers: boolean;
  can_edit_suppliers: boolean;
  can_delete_suppliers: boolean;
  // Visible process templates
  visibleProcessTemplateIds: string[];
}

// ─── Legacy ───────────────────────────────────────────────────────────────────
export interface PermissionProfileProcessTemplate {
  id: string;
  permission_profile_id: string;
  process_template_id: string;
  created_at: string;
}

export interface UserProcessTemplateOverride {
  id: string;
  user_id: string;
  process_template_id: string;
  is_visible: boolean;
  created_at: string;
}
