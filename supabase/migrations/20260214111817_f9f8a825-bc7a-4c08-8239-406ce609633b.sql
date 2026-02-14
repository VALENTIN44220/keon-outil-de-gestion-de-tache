
-- Table de mapping Plans Planner <-> Catégories/Processus
CREATE TABLE public.planner_plan_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planner_plan_id TEXT NOT NULL,
  planner_plan_title TEXT NOT NULL,
  planner_group_id TEXT,
  planner_group_name TEXT,
  mapped_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  mapped_process_template_id UUID REFERENCES public.process_templates(id) ON DELETE SET NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_direction TEXT NOT NULL DEFAULT 'both' CHECK (sync_direction IN ('to_planner', 'from_planner', 'both')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, planner_plan_id)
);

-- Table de lien tâches Planner <-> tâches app
CREATE TABLE public.planner_task_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_mapping_id UUID NOT NULL REFERENCES public.planner_plan_mappings(id) ON DELETE CASCADE,
  planner_task_id TEXT NOT NULL,
  local_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  planner_etag TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'conflict', 'pending_push', 'pending_pull')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(planner_task_id),
  UNIQUE(local_task_id)
);

-- Historique des syncs
CREATE TABLE public.planner_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_mapping_id UUID REFERENCES public.planner_plan_mappings(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  tasks_pushed INTEGER NOT NULL DEFAULT 0,
  tasks_pulled INTEGER NOT NULL DEFAULT 0,
  tasks_updated INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planner_plan_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own plan mappings"
  ON public.planner_plan_mappings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own task links"
  ON public.planner_task_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.planner_plan_mappings m
      WHERE m.id = planner_task_links.plan_mapping_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planner_plan_mappings m
      WHERE m.id = planner_task_links.plan_mapping_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own sync logs"
  ON public.planner_sync_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers updated_at
CREATE TRIGGER update_planner_plan_mappings_updated_at
  BEFORE UPDATE ON public.planner_plan_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planner_task_links_updated_at
  BEFORE UPDATE ON public.planner_task_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
