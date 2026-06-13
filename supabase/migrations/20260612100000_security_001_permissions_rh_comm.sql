-- ============================================================================
-- SECURITY 001 — Clés de permission pour les futurs modules RH et Comm
-- Additif et idempotent. NULL sur user_permission_overrides = hérite du profil.
-- ============================================================================

ALTER TABLE public.permission_profiles
  ADD COLUMN IF NOT EXISTS can_access_rh boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_comm boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_permission_overrides
  ADD COLUMN IF NOT EXISTS can_access_rh boolean,
  ADD COLUMN IF NOT EXISTS can_access_comm boolean;

COMMENT ON COLUMN public.permission_profiles.can_access_rh IS
  'Accès au module RH (Onboarding / Offboarding / Mutation / Promotion)';
COMMENT ON COLUMN public.permission_profiles.can_access_comm IS
  'Accès au module Communication (Marketing / Stand)';
