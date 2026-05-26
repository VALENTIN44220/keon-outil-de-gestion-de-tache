-- ============================================================================
-- BE 018 — Les managers BE peuvent gérer les PJ/liens des tâches BE
-- ============================================================================
-- Symptôme : un manager BE (dispatch) ne pouvait pas enregistrer un lien/PJ
-- sur une demande qu'il n'a pas créée (policy INSERT task_attachments limitée
-- au créateur/assigné). Pendant de be_017 côté pièces jointes.
-- ============================================================================

CREATE POLICY "BE managers manage BE attachments"
ON public.task_attachments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.source_process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
        OR t.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.sub_process_templates spt
    WHERE spt.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
      AND spt.dispatch_manager_id = public.current_profile_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.source_process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
        OR t.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.sub_process_templates spt
    WHERE spt.process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
      AND spt.dispatch_manager_id = public.current_profile_id()
  )
);
