
-- Table to store bucket-to-subcategory mappings per plan mapping
CREATE TABLE public.planner_bucket_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_mapping_id UUID NOT NULL REFERENCES public.planner_plan_mappings(id) ON DELETE CASCADE,
  planner_bucket_id TEXT NOT NULL,
  planner_bucket_name TEXT NOT NULL,
  mapped_subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(plan_mapping_id, planner_bucket_id)
);

-- Add state filter column to plan_mappings
ALTER TABLE public.planner_plan_mappings
  ADD COLUMN IF NOT EXISTS import_states TEXT[] DEFAULT ARRAY['notStarted','inProgress','completed'];

ALTER TABLE public.planner_bucket_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their bucket mappings"
  ON public.planner_bucket_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.planner_plan_mappings pm
      WHERE pm.id = planner_bucket_mappings.plan_mapping_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planner_plan_mappings pm
      WHERE pm.id = planner_bucket_mappings.plan_mapping_id
        AND pm.user_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.planner_bucket_mappings;
