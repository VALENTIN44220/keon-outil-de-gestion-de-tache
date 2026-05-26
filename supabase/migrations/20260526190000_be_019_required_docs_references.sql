-- ============================================================================
-- BE 019 — Références / titres des documents requis par étape
-- ============================================================================
-- Complément au nombre + description de documents obligatoires : permet de
-- lister les titres/références précis des documents attendus pour une étape.
-- ============================================================================

ALTER TABLE public.sub_process_templates
  ADD COLUMN IF NOT EXISTS required_docs_references text;
