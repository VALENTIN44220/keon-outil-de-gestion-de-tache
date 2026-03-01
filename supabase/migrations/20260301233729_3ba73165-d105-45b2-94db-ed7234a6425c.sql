
-- Add fou_key column as a single TEXT unique column for upsert conflict resolution
ALTER TABLE public.fou_resultat
  ADD COLUMN IF NOT EXISTS fou_key TEXT;

-- Populate fou_key from existing data
UPDATE public.fou_resultat
SET fou_key = tiers || '|' || ref || '|' || dos || '|' || COALESCE(annee_cmd,'') || '|' || COALESCE(mois_cmd,'') || '|' || COALESCE(annee_fac,'') || '|' || COALESCE(mois_fac,'');

-- Make it NOT NULL and UNIQUE
ALTER TABLE public.fou_resultat
  ALTER COLUMN fou_key SET NOT NULL;

ALTER TABLE public.fou_resultat
  ADD CONSTRAINT fou_resultat_fou_key_unique UNIQUE (fou_key);
