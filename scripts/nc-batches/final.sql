INSERT INTO nc_declarations (
  date_constat, processus_code, status, title, societe_code,
  code_projet, identification, metier_code, fournisseur_nom,
  description_problem, apparition_ailleurs, causes_racines,
  actions_correctives, actions_preventives, efficacite_action,
  date_cloture_souhaitee, declarant_id, pilote_id, created_at
)
SELECT
  i.date_constat, i.processus_code, i.status, i.title, i.societe_code,
  i.code_projet, i.identification, i.metier_code, i.fournisseur_nom,
  i.description_problem, i.apparition_ailleurs, i.causes_racines,
  i.actions_correctives, i.actions_preventives, i.efficacite_action,
  i.date_cloture_souhaitee,
  (SELECT p.id FROM profiles p WHERE LOWER(p.lovable_email) = LOWER(i.declarant_email) OR LOWER(p.secondary_email) = LOWER(i.declarant_email) LIMIT 1),
  (SELECT p.id FROM profiles p WHERE LOWER(p.lovable_email) = LOWER(i.pilote_email) OR LOWER(p.secondary_email) = LOWER(i.pilote_email) LIMIT 1),
  COALESCE(i.date_constat::timestamptz, now())
FROM public._nc_staging i;

DROP TABLE public._nc_staging;