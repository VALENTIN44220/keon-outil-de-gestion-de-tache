export interface Company {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  company_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  company?: Company;
}

export interface JobTitle {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
}

export interface HierarchyLevel {
  id: string;
  name: string;
  level: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PermissionProfile {
  id: string;
  name: string;
  description: string | null;
  can_manage_users: boolean;
  can_manage_templates: boolean;
  // Permissions sur ses propres tâches
  can_view_own_tasks: boolean;
  can_manage_own_tasks: boolean;
  // Permissions sur les subordonnés hiérarchiques (managers)
  can_view_subordinates_tasks: boolean;
  can_manage_subordinates_tasks: boolean;
  can_assign_to_subordinates: boolean;
  // Permissions globales (admin)
  can_view_all_tasks: boolean;
  can_manage_all_tasks: boolean;
  can_assign_to_all: boolean;
  // Permissions projets BE
  can_view_be_projects: boolean;
  can_create_be_projects: boolean;
  can_edit_be_projects: boolean;
  can_delete_be_projects: boolean;
  created_at: string;
  updated_at: string;
}

export type AppRole = 'admin' | 'moderator' | 'user';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  company_id: string | null;
  department_id: string | null;
  job_title_id: string | null;
  hierarchy_level_id: string | null;
  permission_profile_id: string | null;
  manager_id: string | null;
  must_change_password: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: Company;
  department?: Department;
  job_title?: JobTitle;
  hierarchy_level?: HierarchyLevel;
  permission_profile?: PermissionProfile;
  manager?: UserProfile;
  subordinates?: UserProfile[];
}
