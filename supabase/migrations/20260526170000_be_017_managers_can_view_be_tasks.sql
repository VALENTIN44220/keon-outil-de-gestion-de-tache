-- ============================================================================
-- BE 017 — Les managers BE peuvent VOIR les tâches BE (RLS SELECT)
-- ============================================================================
-- Symptôme : une demande BE 'soumise' (non encore affectée) n'apparaît pas
-- dans Dispatch & Suivi pour le dispatch manager (ex. Marion), et le clic sur
-- la notif « Nouvelle demande à dispatcher » atterrit sur un écran vide.
--
-- Cause : la policy SELECT de public.tasks repose sur can_access_task(id). Pour
-- une tâche 'soumise' (assignee_id NULL, pas de target_department, et
-- process_tracking_access vide pour BE), AUCUN chemin n'autorise un dispatch
-- manager à la lire. Seuls les admins (et la simulation via admin) voyaient
-- donc le dispatch — pas les vrais managers BE.
--
-- Correctif : policy SELECT permissive, pendant exact de la policy UPDATE
-- « BE managers can update BE tasks » (migration be_managers_can_update_be_tasks).
-- Tout utilisateur qui est dispatch_manager d'au moins une étape BE peut LIRE
-- toutes les tâches/demandes BE (source_process_template_id = BE ou
-- process_template_id = BE). Additive (OR avec l'existant), aucun impact sur
-- les autres modules.
-- ============================================================================

CREATE POLICY "BE managers can view BE tasks"
ON public.tasks
FOR SELECT
USING (
  (
    source_process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
    OR process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
  )
  AND EXISTS (
    SELECT 1 FROM public.sub_process_templates spt
    WHERE spt.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
      AND spt.dispatch_manager_id = public.current_profile_id()
  )
);
