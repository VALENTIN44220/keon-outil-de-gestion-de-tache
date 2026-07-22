-- Ajoute salaire_annuel_charge à v_it_rh_cout : salaire chargé sur 12 mois PLEINS,
-- à 100% (sans proratisation des mois de présence, sans quotité/coefficient).
-- Sert de référence face à cout_charge_annuel ("Charges RH annuelle" dans l'UI,
-- qui tient compte des mois et du coefficient). Appliqué en prod le 2026-07-22.
-- Colonne ajoutée EN FIN (CREATE OR REPLACE VIEW ne permet pas de réordonner).
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
  coefficient, tjm_profil_code,
  -- 12 mois pleins, 100% (Q1 = 3 mois jan-mar, Q2-Q4 = 9 mois avr-déc), chargé.
  (
    (salaire_q1 + anciennete_q1 + bonus_q1) / 12.0 * 3
    + (salaire_q2_q4 + anciennete_q2_q4 + bonus_q2_q4) / 12.0 * 9
  ) * (1 + COALESCE(charges_pct, 0)) AS salaire_annuel_charge
FROM it_rh_lines l;
