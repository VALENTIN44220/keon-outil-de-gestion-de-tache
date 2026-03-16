
-- 3. workflow_validation_instances: drop permissive INSERT and fix SELECT
DROP POLICY IF EXISTS "System can insert validation instances" ON public.workflow_validation_instances;
DROP POLICY IF EXISTS "wf_runtime_instances_select" ON public.workflow_validation_instances;
CREATE POLICY "wf_runtime_instances_select"
  ON public.workflow_validation_instances
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
