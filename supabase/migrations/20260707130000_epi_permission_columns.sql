-- ═══════════════════════════════════════════════════════════════════
-- Ajout colonnes permissions EPI + valeur enum module_code
-- ═══════════════════════════════════════════════════════════════════

-- 1. Ajouter 'epi' à l'enum module_code (si pas déjà présent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'epi'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'module_code')
  ) THEN
    ALTER TYPE module_code ADD VALUE 'epi';
  END IF;
END $$;

-- 2. permission_profiles (profils de droits)
ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS can_access_epi BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_manage_epi BOOLEAN NOT NULL DEFAULT false;

-- 3. user_permission_overrides (surcharges par utilisateur)
ALTER TABLE public.user_permission_overrides
  ADD COLUMN IF NOT EXISTS can_access_epi BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS can_manage_epi BOOLEAN DEFAULT NULL;
