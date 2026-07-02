-- Seuils paramétrables de classification « à risque » des projets (Params FDR).
-- Un projet est « à risque » si le sous-effectif net d'un profil mobilisé dépasse
-- `seuil_sous_effectif_jours` (déf. 5 j = 25 % d'un ETP) pendant plus de
-- `part_duree_risque` (déf. 0.25 = 25 %) de sa durée build.
ALTER TABLE public.fdr_settings
  ADD COLUMN IF NOT EXISTS seuil_sous_effectif_jours numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS part_duree_risque numeric NOT NULL DEFAULT 0.25;
