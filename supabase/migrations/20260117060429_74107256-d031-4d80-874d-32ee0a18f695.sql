-- Create collaborator_groups table
CREATE TABLE public.collaborator_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collaborator_group_members junction table
CREATE TABLE public.collaborator_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.collaborator_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Add group assignment fields to task_templates
ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES public.collaborator_groups(id) ON DELETE SET NULL;

-- Add group assignment fields to sub_process_templates
ALTER TABLE public.sub_process_templates 
ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES public.collaborator_groups(id) ON DELETE SET NULL;

-- Add group_assignee_ids to tasks table for multi-assignment
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS group_assignee_ids UUID[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.collaborator_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for collaborator_groups
CREATE POLICY "Users can view groups in their company" ON public.collaborator_groups
  FOR SELECT USING (
    company_id IS NULL OR 
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage all groups" ON public.collaborator_groups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p 
            JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id 
            WHERE p.id = auth.uid() AND pp.can_manage_users = true)
  );

-- RLS policies for collaborator_group_members
CREATE POLICY "Users can view group members" ON public.collaborator_group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.collaborator_groups g 
            WHERE g.id = group_id AND (g.company_id IS NULL OR 
            g.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())))
  );

CREATE POLICY "Admins can manage group members" ON public.collaborator_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p 
            JOIN public.permission_profiles pp ON p.permission_profile_id = pp.id 
            WHERE p.id = auth.uid() AND pp.can_manage_users = true)
  );

-- Trigger for updated_at
CREATE TRIGGER update_collaborator_groups_updated_at
  BEFORE UPDATE ON public.collaborator_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();