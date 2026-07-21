-- Module Juridique — ajoute la valeur 'juridique' à l'enum module_code.
--
-- MVP : le module Juridique réutilise tasks (type='request', module_code='juridique')
-- + module_data (jsonb). Aucune table nouvelle. Cette valeur d'enum est le SEUL
-- pré-requis DB pour créer des demandes juridiques.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase (les migrations du repo ne sont pas
-- appliquées automatiquement). Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'juridique'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'module_code')
  ) THEN
    ALTER TYPE module_code ADD VALUE 'juridique';
  END IF;
END $$;
