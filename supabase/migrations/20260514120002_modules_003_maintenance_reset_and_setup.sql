-- ============================================================
-- MODULES 003 — Reset + setup du module Maintenance
-- ============================================================
-- Conformement au choix utilisateur : on ne garde pas l historique
-- des demandes Maintenance. On supprime tout et on demarre proprement
-- avec le nouveau pattern (module_code='maintenance').
--
-- Le schema demande_materiel reste : il porte la granularite ligne par
-- ligne (1 demande N articles) qu il faut conserver. Seules les donnees
-- sont videes.
-- ============================================================

-- ========== RESET DES DONNEES ==========

-- Lignes d articles
DELETE FROM public.demande_materiel;

-- Taches liees au module Maintenance (anciennes demandes via process_template)
DELETE FROM public.task_status_transitions
WHERE task_id IN (
  SELECT id FROM public.tasks
  WHERE source_process_template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'  -- ancien process Maintenance
     OR module_code = 'maintenance'
);

DELETE FROM public.task_comments
WHERE task_id IN (
  SELECT id FROM public.tasks
  WHERE source_process_template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
     OR module_code = 'maintenance'
);

DELETE FROM public.workload_slots
WHERE task_id IN (
  SELECT id FROM public.tasks
  WHERE source_process_template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
     OR module_code = 'maintenance'
);

DELETE FROM public.tasks
WHERE source_process_template_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
   OR module_code = 'maintenance';

-- ========== INDEX & PERMISSIONS ==========

-- Index pour filtrer rapidement les demandes Maintenance
CREATE INDEX IF NOT EXISTS idx_tasks_module_maintenance
  ON public.tasks (created_at DESC)
  WHERE module_code = 'maintenance';

-- Lien demande_materiel <-> request_id assure (pas de demande orpheline)
ALTER TABLE public.demande_materiel
  DROP CONSTRAINT IF EXISTS demande_materiel_request_id_fkey;

ALTER TABLE public.demande_materiel
  ADD CONSTRAINT demande_materiel_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- ========== VUE DE CONSOLIDATION ==========
-- Vue pratique pour l ecran Dispatch : 1 ligne par demande avec
-- agregat des articles (count + sum quantite).
DROP VIEW IF EXISTS public.maintenance_requests_overview;
CREATE OR REPLACE VIEW public.maintenance_requests_overview AS
SELECT
  t.id AS task_id,
  t.title,
  t.status,
  t.assignee_id,
  t.requester_id,
  t.created_at,
  t.updated_at,
  t.due_date,
  t.module_data,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'id', dm.id,
        'ref', dm.ref,
        'des', dm.des,
        'quantite', dm.quantite,
        'etat_commande', dm.etat_commande
      ) ORDER BY dm.created_at)
      FROM public.demande_materiel dm
      WHERE dm.request_id = t.id
    ),
    '[]'::json
  ) AS lignes,
  (SELECT COUNT(*) FROM public.demande_materiel WHERE request_id = t.id) AS nb_lignes,
  (SELECT COALESCE(SUM(quantite), 0) FROM public.demande_materiel WHERE request_id = t.id) AS qte_totale,
  (
    -- Agreget l etat le plus avance pour donner un statut global
    SELECT etat_commande
    FROM public.demande_materiel
    WHERE request_id = t.id
    ORDER BY array_position(
      ARRAY['Commande distribuee','Commande livree','AR recu','Bon de commande envoye','Demande de devis','En attente validation'],
      etat_commande
    )
    LIMIT 1
  ) AS etat_global
FROM public.tasks t
WHERE t.module_code = 'maintenance';

GRANT SELECT ON public.maintenance_requests_overview TO authenticated;

COMMENT ON VIEW public.maintenance_requests_overview IS
  'Vue agregee pour le dashboard Maintenance : 1 ligne par demande avec ses lignes JSON + etat global.';
