-- Update permission_profiles table with hierarchical vs global permissions
ALTER TABLE public.permission_profiles 
  DROP COLUMN can_manage_tasks,
  DROP COLUMN can_view_all_tasks,
  DROP COLUMN can_assign_tasks,
  ADD COLUMN can_view_own_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN can_view_subordinates_tasks boolean NOT NULL DEFAULT false,
  ADD COLUMN can_view_all_tasks boolean NOT NULL DEFAULT false,
  ADD COLUMN can_manage_own_tasks boolean NOT NULL DEFAULT true,
  ADD COLUMN can_manage_subordinates_tasks boolean NOT NULL DEFAULT false,
  ADD COLUMN can_manage_all_tasks boolean NOT NULL DEFAULT false,
  ADD COLUMN can_assign_to_subordinates boolean NOT NULL DEFAULT false,
  ADD COLUMN can_assign_to_all boolean NOT NULL DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.permission_profiles.can_view_own_tasks IS 'Peut voir ses propres tâches';
COMMENT ON COLUMN public.permission_profiles.can_view_subordinates_tasks IS 'Peut voir les tâches des subordonnés hiérarchiques';
COMMENT ON COLUMN public.permission_profiles.can_view_all_tasks IS 'Peut voir toutes les tâches (admin)';
COMMENT ON COLUMN public.permission_profiles.can_manage_own_tasks IS 'Peut gérer ses propres tâches';
COMMENT ON COLUMN public.permission_profiles.can_manage_subordinates_tasks IS 'Peut gérer les tâches des subordonnés hiérarchiques';
COMMENT ON COLUMN public.permission_profiles.can_manage_all_tasks IS 'Peut gérer toutes les tâches (admin)';
COMMENT ON COLUMN public.permission_profiles.can_assign_to_subordinates IS 'Peut assigner des tâches aux subordonnés hiérarchiques';
COMMENT ON COLUMN public.permission_profiles.can_assign_to_all IS 'Peut assigner des tâches à tous (admin)';