-- Quotité d'affectation IT sur une ligne RH (ex : Bruno 30% sur l'IT).
-- Multiplie le coût RH (brut et chargé). Appliquée en prod le 2026-07-22.
ALTER TABLE public.it_rh_lines ADD COLUMN IF NOT EXISTS coefficient numeric NOT NULL DEFAULT 1;

-- Recalcule la vue en appliquant le coefficient (on conserve l'ordre des colonnes
-- existantes — CREATE OR REPLACE VIEW ne permet pas de le changer — et on ajoute
-- coefficient/tjm_profil_code en fin). security_invoker conservé (accès budget).
CREATE OR REPLACE VIEW public.v_it_rh_cout WITH (security_invoker = true) AS
SELECT
  id, annee, metier, fonction, salarie, profile_id, charges_pct,
  (
    (salaire_q1 + anciennete_q1 + bonus_q1) / 12.0
      * (COALESCE(mois_01,0) + COALESCE(mois_02,0) + COALESCE(mois_03,0))
    + (salaire_q2_q4 + anciennete_q2_q4 + bonus_q2_q4) / 12.0
      * (COALESCE(mois_04,0) + COALESCE(mois_05,0) + COALESCE(mois_06,0) + COALESCE(mois_07,0)
         + COALESCE(mois_08,0) + COALESCE(mois_09,0) + COALESCE(mois_10,0) + COALESCE(mois_11,0) + COALESCE(mois_12,0))
  ) * COALESCE(coefficient, 1) AS cout_brut_annuel,
  (
    (
      (salaire_q1 + anciennete_q1 + bonus_q1) / 12.0
        * (COALESCE(mois_01,0) + COALESCE(mois_02,0) + COALESCE(mois_03,0))
      + (salaire_q2_q4 + anciennete_q2_q4 + bonus_q2_q4) / 12.0
        * (COALESCE(mois_04,0) + COALESCE(mois_05,0) + COALESCE(mois_06,0) + COALESCE(mois_07,0)
           + COALESCE(mois_08,0) + COALESCE(mois_09,0) + COALESCE(mois_10,0) + COALESCE(mois_11,0) + COALESCE(mois_12,0))
    ) * COALESCE(coefficient, 1)
  ) * (1 + COALESCE(charges_pct, 0)) AS cout_charge_annuel,
  commentaire, created_at, updated_at,
  coefficient, tjm_profil_code
FROM it_rh_lines l;
