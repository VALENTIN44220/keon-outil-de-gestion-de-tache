-- ============================================================
-- VÉRIFICATION POST-MIGRATION
-- Exécuter après tous les scripts pour valider l'état final.
-- ============================================================

-- 1. Tables wf_* supprimées (doit retourner 0 lignes)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'wf_%'
  OR table_name LIKE 'workflow_%';

-- 2. Nouvelles colonnes BE sur tasks
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN (
    'be_status', 'be_affaire_id', 'be_project_id',
    'be_urgency', 'parent_complement_id'
  );

-- 3. Table sub_process_step_fields créée
SELECT COUNT(*) AS nb_fields FROM sub_process_step_fields;

-- 4. Table task_step_field_values créée
SELECT COUNT(*) AS nb_field_values FROM task_step_field_values;

-- 5. Nouvelles colonnes BE sur sub_process_templates
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'sub_process_templates'
  AND column_name IN (
    'be_category', 'dispatch_manager_id',
    'validation_level_1_type', 'validation_level_1_user_id',
    'validation_level_2_type', 'validation_level_2_user_id'
  );

-- 6. Prestations BE insérées (doit retourner ~50 lignes)
SELECT be_category, COUNT(*) AS nb_etapes
FROM sub_process_templates
WHERE process_template_id = 'bd75a3b0-c918-4b43-befe-739b83f7461a'
GROUP BY be_category;

-- 7. Alertes insérées (doit retourner ~10 lignes)
SELECT spt.name AS etape, ssf.field_key, ssf.alert_delay_days, ssf.alert_message
FROM sub_process_step_fields ssf
JOIN sub_process_templates spt ON spt.id = ssf.sub_process_template_id
WHERE ssf.alert_enabled = true
ORDER BY spt.name;

-- 8. assignment_type normalisé (doit retourner 0 lignes hors des 4 valeurs)
SELECT id, name, assignment_type
FROM sub_process_templates
WHERE assignment_type NOT IN (
  'fixed_user', 'fixed_role', 'team', 'manager_dispatch'
)
AND assignment_type IS NOT NULL;

-- 9. Tâches actives intactes (contrôle de non-régression)
SELECT status, COUNT(*) AS nb
FROM tasks
WHERE status NOT IN ('done', 'validated', 'cancelled', 'refused')
GROUP BY status
ORDER BY nb DESC;
