-- =========================================================================
-- Fix RLS : affectation d'une tâche BE impossible
--   « new row violates row-level security policy
--     "tasks_update_must_remain_accessible" for table "tasks" »
--
-- La policy RESTRICTIVE anti-lockout exige que la ligne reste « accessible »
-- après update via WITH CHECK (admin OR can_access_task(id)). Or can_access_task()
-- ne connaît pas le cas « manager dispatch BE » : cet accès est porté uniquement
-- par les policies dédiées « BE managers can view/update BE tasks ». Résultat :
-- quand un manager BE affecte une tâche BE à un collaborateur hors de sa portée
-- can_access_task, le WITH CHECK échoue alors qu'elle reste visible/éditable
-- pour lui via les policies BE.
--
-- Correctif : le WITH CHECK reflète la visibilité réelle = il accepte aussi le
-- cas manager dispatch BE (même condition que les policies BE existantes ; aucune
-- exposition nouvelle). BE_PROCESS_ID = bd75a3b0-c918-4b43-befe-739b83f7461a.
-- =========================================================================
ALTER POLICY "tasks_update_must_remain_accessible" ON public.tasks
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR can_access_task(id)
    OR (
      (
        source_process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'::uuid
        OR process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'::uuid
      )
      AND EXISTS (
        SELECT 1 FROM public.sub_process_templates spt
        WHERE spt.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'::uuid
          AND spt.dispatch_manager_id = current_profile_id()
      )
    )
  );
