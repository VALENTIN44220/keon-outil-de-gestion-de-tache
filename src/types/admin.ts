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
  can_manage_tasks: boolean;
  can_manage_templates: boolean;
  can_view_all_tasks: boolean;
  can_assign_tasks: boolean;
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
