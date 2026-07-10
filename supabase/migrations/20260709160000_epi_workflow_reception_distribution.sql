-- Workflow EPI enrichi : réception → distribution → dotation affectée + historisation.
--
-- Contexte : le module EPI stocke le statut de la demande sur tasks.status et le
-- statut des articles sur epi_demande_lignes.statut. La contrainte
-- tasks_status_check n'autorisait PAS 'commandee'/'attribuee' → l'UPDATE échouait
-- silencieusement et la demande restait bloquée en 'in-progress' alors que les
-- lignes passaient bien en 'commandee'.
--
-- Nouveau pipeline demande :
--   todo → in-progress → en_attente_reception → receptionnee → dotation_affectee → done
--                                                                          (+ cancelled)

-- 1. tasks.status : ajouter les statuts EPI manquants (liste complète existante + ajouts).
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY[
  'todo','in-progress','in_progress','done','to_assign','pending-validation',
  'pending_validation_1','pending_validation_2','validated','refused','review','cancelled',
  'soumise','affectee','en_cours','a_relire','a_valider','a_deposer','en_instruction',
  'complement_demande','cloturee','en_attente_complement_demandeur','en_attente_retour_externe',
  'realisee','en_attente_retour_ticket_itp','en_attente_retour_ticket_blc','en_attente_chiffrage',
  'planifiee','en_enlevement','en_livraison','livree','abandonnee','preparation_codir',
  'arbitrage_codir','mise_en_oeuvre','refusee_codir','standby','devis_a_chiffrer','devis_a_valider',
  -- Ajouts EPI
  'commandee','attribuee','en_attente_reception','receptionnee','dotation_affectee'
]::text[]));

-- 2. epi_demande_lignes.statut : ajouter 'receptionnee'.
ALTER TABLE public.epi_demande_lignes DROP CONSTRAINT IF EXISTS epi_demande_lignes_statut_check;
ALTER TABLE public.epi_demande_lignes ADD CONSTRAINT epi_demande_lignes_statut_check CHECK (
  statut = ANY (ARRAY['en_attente','validee','commandee','receptionnee','attribuee','annulee']::text[])
);

-- 3. Historisation des étapes du workflow EPI.
CREATE TABLE IF NOT EXISTS public.epi_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  note         text,
  changed_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epi_status_history_request ON public.epi_status_history(request_id);

ALTER TABLE public.epi_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view EPI status history" ON public.epi_status_history;
CREATE POLICY "Users can view EPI status history"
  ON public.epi_status_history FOR SELECT
  USING (can_access_task(request_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authorized users can insert EPI status history" ON public.epi_status_history;
CREATE POLICY "Authorized users can insert EPI status history"
  ON public.epi_status_history FOR INSERT
  WITH CHECK (can_access_task(request_id) OR has_role(auth.uid(), 'admin'::app_role));
