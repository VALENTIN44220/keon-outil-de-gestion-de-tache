
-- ============================================================
-- Innovation Requests Module — Step 1: Enum extension
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inno_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'codir';
