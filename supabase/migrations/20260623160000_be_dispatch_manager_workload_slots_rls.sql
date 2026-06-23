-- =========================================================================
-- Managers dispatch BE (Florence, Marion…) : gérer les créneaux de TOUTE
-- l'équipe BE dans le plan de charge (pas seulement leurs N-1).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_be_dispatch_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sub_process_templates spt
    WHERE spt.dispatch_manager_id = public.current_profile_id()
      AND spt.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_be_group_member(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collaborator_group_members m
    WHERE m.group_id = '301ffee1-718f-42af-aec0-545cf4765ffa'
      AND m.user_id = uid
  );
$$;

DROP POLICY IF EXISTS "BE dispatch managers view BE slots" ON public.workload_slots;
CREATE POLICY "BE dispatch managers view BE slots" ON public.workload_slots
  FOR SELECT USING (public.is_be_dispatch_manager() AND public.is_be_group_member(user_id));

DROP POLICY IF EXISTS "BE dispatch managers insert BE slots" ON public.workload_slots;
CREATE POLICY "BE dispatch managers insert BE slots" ON public.workload_slots
  FOR INSERT WITH CHECK (public.is_be_dispatch_manager() AND public.is_be_group_member(user_id));

DROP POLICY IF EXISTS "BE dispatch managers update BE slots" ON public.workload_slots;
CREATE POLICY "BE dispatch managers update BE slots" ON public.workload_slots
  FOR UPDATE USING (public.is_be_dispatch_manager() AND public.is_be_group_member(user_id))
  WITH CHECK (public.is_be_dispatch_manager() AND public.is_be_group_member(user_id));

DROP POLICY IF EXISTS "BE dispatch managers delete BE slots" ON public.workload_slots;
CREATE POLICY "BE dispatch managers delete BE slots" ON public.workload_slots
  FOR DELETE USING (public.is_be_dispatch_manager() AND public.is_be_group_member(user_id));
