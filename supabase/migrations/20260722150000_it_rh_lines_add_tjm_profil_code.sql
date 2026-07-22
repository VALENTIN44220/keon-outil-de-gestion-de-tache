-- RH budget IT : permettre d'appliquer sur une ligne un profil de salaire issu
-- du référentiel TJM (it_tjm_referentiel), distinct de la personne (ex : stagiaire
-- projeté salarié). Le coût annuel est dérivé du TJM ; cette colonne mémorise le
-- profil appliqué. Appliquée en prod le 2026-07-22.
ALTER TABLE public.it_rh_lines ADD COLUMN IF NOT EXISTS tjm_profil_code text;
