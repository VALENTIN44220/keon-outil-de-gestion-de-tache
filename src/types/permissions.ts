// Screen access keys
export const SCREEN_PERMISSIONS = [
  'can_access_dashboard',
  'can_access_requests',
  'can_access_templates',
  'can_access_workload',
  'can_access_calendar',
  'can_access_projects',
  'can_access_team',
] as const;

export type ScreenPermissionKey = typeof SCREEN_PERMISSIONS[number];

// Task/feature permission keys
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
] as const;

export type FeaturePermissionKey = typeof FEATURE_PERMISSIONS[number];

export type AllPermissionKeys = ScreenPermissionKey | FeaturePermissionKey;

// Screen labels for UI
export const SCREEN_LABELS: Record<ScreenPermissionKey, string> = {
  can_access_dashboard: 'Tableau de bord',
  can_access_requests: 'Demandes',
  can_access_templates: 'Modèles',
  can_access_workload: 'Plan de charge',
  can_access_calendar: 'Calendrier',
  can_access_projects: 'Projets',
  can_access_team: 'Équipe',
};

// User permission overrides (null = use profile default)
export interface UserPermissionOverride {
  id: string;
  user_id: string;
  // Screen access
  can_access_dashboard: boolean | null;
  can_access_requests: boolean | null;
  can_access_templates: boolean | null;
  can_access_workload: boolean | null;
  can_access_calendar: boolean | null;
  can_access_projects: boolean | null;
  can_access_team: boolean | null;
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
  created_at: string;
  updated_at: string;
}

// Process template visibility per profile
export interface PermissionProfileProcessTemplate {
  id: string;
  permission_profile_id: string;
  process_template_id: string;
  created_at: string;
}

// User-specific process template override
export interface UserProcessTemplateOverride {
  id: string;
  user_id: string;
  process_template_id: string;
  is_visible: boolean;
  created_at: string;
}

// Computed effective permissions (after applying overrides)
export interface EffectivePermissions {
  // Screen access
  can_access_dashboard: boolean;
  can_access_requests: boolean;
  can_access_templates: boolean;
  can_access_workload: boolean;
  can_access_calendar: boolean;
  can_access_projects: boolean;
  can_access_team: boolean;
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
  // Visible process templates
  visibleProcessTemplateIds: string[];
}
