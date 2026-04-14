-- Tâches créées sans validation_level_* (ex. generatePendingAssignments) alors que le modèle en définit :
-- recopie depuis task_templates (titre + sous-processus ou processus racine), un seul modèle par (scope, titre).

UPDATE public.tasks AS t
SET
  validation_level_1 = COALESCE(NULLIF(btrim(tt.validation_level_1::text), ''), 'none'),
  validation_level_2 = COALESCE(NULLIF(btrim(tt.validation_level_2::text), ''), 'none'),
  validator_level_1_id = tt.validator_level_1_id,
  validator_level_2_id = tt.validator_level_2_id
FROM (
  SELECT DISTINCT ON (sub_process_template_id, title)
    sub_process_template_id,
    title,
    validation_level_1,
    validation_level_2,
    validator_level_1_id,
    validator_level_2_id
  FROM public.task_templates
  WHERE sub_process_template_id IS NOT NULL
  ORDER BY sub_process_template_id, title, order_index
) AS tt
WHERE t.type = 'task'
  AND t.source_sub_process_template_id = tt.sub_process_template_id
  AND t.title = tt.title
  AND COALESCE(NULLIF(btrim(t.validation_level_1::text), ''), 'none') = 'none'
  AND COALESCE(NULLIF(btrim(t.validation_level_2::text), ''), 'none') = 'none'
  AND (
    COALESCE(NULLIF(btrim(tt.validation_level_1::text), ''), 'none') <> 'none'
    OR COALESCE(NULLIF(btrim(tt.validation_level_2::text), ''), 'none') <> 'none'
  );

UPDATE public.tasks AS t
SET
  validation_level_1 = COALESCE(NULLIF(btrim(tt.validation_level_1::text), ''), 'none'),
  validation_level_2 = COALESCE(NULLIF(btrim(tt.validation_level_2::text), ''), 'none'),
  validator_level_1_id = tt.validator_level_1_id,
  validator_level_2_id = tt.validator_level_2_id
FROM (
  SELECT DISTINCT ON (process_template_id, title)
    process_template_id,
    title,
    validation_level_1,
    validation_level_2,
    validator_level_1_id,
    validator_level_2_id
  FROM public.task_templates
  WHERE sub_process_template_id IS NULL
  ORDER BY process_template_id, title, order_index
) AS tt
WHERE t.type = 'task'
  AND t.source_sub_process_template_id IS NULL
  AND t.source_process_template_id = tt.process_template_id
  AND t.title = tt.title
  AND COALESCE(NULLIF(btrim(t.validation_level_1::text), ''), 'none') = 'none'
  AND COALESCE(NULLIF(btrim(t.validation_level_2::text), ''), 'none') = 'none'
  AND (
    COALESCE(NULLIF(btrim(tt.validation_level_1::text), ''), 'none') <> 'none'
    OR COALESCE(NULLIF(btrim(tt.validation_level_2::text), ''), 'none') <> 'none'
  );
