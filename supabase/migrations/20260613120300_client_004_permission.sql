-- CLIENT 004 — Permission d'accès au module Création client.
ALTER TABLE public.permission_profiles ADD COLUMN IF NOT EXISTS can_access_client boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permission_overrides ADD COLUMN IF NOT EXISTS can_access_client boolean;
COMMENT ON COLUMN public.permission_profiles.can_access_client IS 'Accès au module Création client';
