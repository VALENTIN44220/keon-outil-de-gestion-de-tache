-- ============================================================
-- MIGRATION 004 : Simplification assignment_type
-- ============================================================
-- Normalise les valeurs d'assignment_type vers le nouveau
-- référentiel à 4 valeurs. Migration douce : les valeurs
-- inconnues sont conservées en 'fixed_user' par défaut.
-- ============================================================

BEGIN;

-- Mapping des anciennes valeurs vers les nouvelles
UPDATE sub_process_templates
SET assignment_type = CASE
  WHEN assignment_type = 'user'             THEN 'fixed_user'
  WHEN assignment_type = 'role'             THEN 'fixed_role'
  WHEN assignment_type = 'group'            THEN 'team'
  WHEN assignment_type = 'manager'          THEN 'manager_dispatch'
  WHEN assignment_type = 'requester'        THEN 'fixed_user'  -- cas rare
  WHEN assignment_type = 'fixed_user'       THEN 'fixed_user'  -- déjà migré
  WHEN assignment_type = 'fixed_role'       THEN 'fixed_role'
  WHEN assignment_type = 'team'             THEN 'team'
  WHEN assignment_type = 'manager_dispatch' THEN 'manager_dispatch'
  ELSE 'fixed_user'  -- valeur inconnue → fallback safe
END
WHERE assignment_type IS NOT NULL;

-- Ajout contrainte CHECK après migration
-- (désactiver si d'autres valeurs legacy existent encore)
ALTER TABLE sub_process_templates
  DROP CONSTRAINT IF EXISTS chk_assignment_type;

ALTER TABLE sub_process_templates
  ADD CONSTRAINT chk_assignment_type
    CHECK (assignment_type IN (
      'fixed_user',
      'fixed_role',
      'team',
      'manager_dispatch'
    ));

-- Vérification — doit retourner 0 ligne
-- SELECT id, name, assignment_type FROM sub_process_templates
-- WHERE assignment_type NOT IN ('fixed_user','fixed_role','team','manager_dispatch');

COMMIT;
