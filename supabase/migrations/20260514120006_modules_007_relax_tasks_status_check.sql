-- ============================================================
-- MODULES 007 — Relax la contrainte tasks_status_check
-- ============================================================
-- Avec l arrivee des modules IT, Logistique, RH, Innovation, Comm,
-- chaque module a ses propres statuts metier (planifiee, en_enlevement,
-- en_attente_complement_demandeur, realisee, etc.). La contrainte CHECK
-- statique etait trop restrictive et bloquait les changements de statut.
--
-- On la remplace par une liste etendue qui inclut les statuts les plus
-- courants. L application reste responsable de la coherence par module
-- (chaque page de dispatch propose uniquement les statuts pertinents).
-- ============================================================

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
CHECK (status = ANY (ARRAY[
  -- Standard
  'todo'::text,
  'in-progress'::text,
  'in_progress'::text,
  'done'::text,
  'to_assign'::text,
  'pending-validation'::text,
  'pending_validation_1'::text,
  'pending_validation_2'::text,
  'validated'::text,
  'refused'::text,
  'review'::text,
  'cancelled'::text,
  -- BE
  'soumise'::text,
  'affectee'::text,
  'en_cours'::text,
  'a_relire'::text,
  'a_valider'::text,
  'a_deposer'::text,
  'en_instruction'::text,
  'complement_demande'::text,
  'cloturee'::text,
  -- IT
  'en_attente_complement_demandeur'::text,
  'en_attente_retour_externe'::text,
  'realisee'::text,
  -- Logistique
  'planifiee'::text,
  'en_enlevement'::text,
  'en_livraison'::text,
  'livree'::text,
  'abandonnee'::text,
  -- Innovation
  'preparation_codir'::text,
  'arbitrage_codir'::text,
  'mise_en_oeuvre'::text,
  'refusee_codir'::text,
  'standby'::text
]));
