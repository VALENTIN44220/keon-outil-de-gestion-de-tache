-- ============================================================
-- Fix : idx_trace_request_number doit s'appliquer UNIQUEMENT aux
-- traces de demandes (request rows), pas aux taches enfants.
--
-- Symptome : a la validation d'une demande Maintenance, l'edge
-- function valide-material-request cree une nouvelle task avec
-- parent_request_id = R1. Le trigger insert_task_trace_number_after_insert
-- insere alors une ligne dans request_trace_numbers avec
-- request_number = celui du parent (= deja indexe pour la demande
-- parente). L'index UNIQUE sur request_number (where request_number
-- is not null) refuse cette duplication =>
-- "duplicate key value violates unique constraint idx_trace_request_number".
--
-- Correction : restreindre l'index unique aux lignes ou task_id IS NULL
-- (ie. seulement les traces de demandes), de sorte que plusieurs taches
-- enfants puissent partager le request_number du parent.
-- ============================================================

DROP INDEX IF EXISTS public.idx_trace_request_number;

CREATE UNIQUE INDEX idx_trace_request_number
ON public.request_trace_numbers(request_number)
WHERE request_number IS NOT NULL AND task_id IS NULL;

-- Commentaire pour traceabilite
COMMENT ON INDEX public.idx_trace_request_number IS
  'Unicite du request_number SEULEMENT pour les traces de demandes (task_id IS NULL). Les taches enfants partagent le request_number de leur parent.';
