-- =========================================================================
-- Lien du référentiel TJM IT/DIGITAL vers le référentiel TJM BE.
-- On peut désormais, pour chaque profil FDR, choisir une fonction du
-- référentiel BE (be_tjm_fonctions, taux horaire) plutôt que de saisir le
-- TJM €/j à la main. Le TJM €/j stocké (tjm_eur) reste la valeur consommée
-- par le calcul ROI : il est dérivé = taux_horaire × 8 h au moment du choix,
-- et reste surchargeable manuellement (be_fonction = NULL).
-- =========================================================================
ALTER TABLE public.it_tjm_referentiel
  ADD COLUMN IF NOT EXISTS be_fonction text;

COMMENT ON COLUMN public.it_tjm_referentiel.be_fonction IS
  'Fonction du référentiel TJM BE (be_tjm_fonctions) dont dérive le TJM €/j. NULL = TJM saisi manuellement.';
