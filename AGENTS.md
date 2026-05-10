# Migration BE — Instructions Codex

## Contexte
Refactoring du système de gestion de tâches d'une application React/TypeScript sur Supabase.
Objectif : simplifier l'architecture en supprimant le moteur workflow inutilisé et en ajoutant
les extensions nécessaires au flux Bureau d'Études (BE).

## Prérequis
- Accès Supabase CLI ou SQL Editor
- Variables d'environnement : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

## Ordre d'exécution des scripts

```
1. supabase/migrations/001_drop_wf_tables.sql
2. supabase/migrations/002_extend_tasks_be.sql
3. supabase/migrations/003_create_step_fields.sql
4. supabase/migrations/004_clean_sub_process_templates.sql
5. supabase/seeds/001_be_sub_process_templates.sql
```

## Règles importantes
- Toujours exécuter dans l'ordre numéroté
- Tester sur environnement de staging avant production
- Le script 001 est IRRÉVERSIBLE — vérifier l'audit avant exécution
- Les scripts 002-004 sont additifs (pas de suppression de données existantes)
- Le seed 001 utilise INSERT ... ON CONFLICT DO NOTHING (idempotent)

## Variables à remplacer dans les seeds
Avant d'exécuter 001_be_sub_process_templates.sql, remplacer :
- `<FLORENCE_USER_ID>`           → 17e506f2-8b1e-46e5-8641-84de7025c999 ✅
- `<MARION_USER_ID>`             → 23c7a2c7-14aa-48cf-9dd0-c06c91f5c947 ✅
- `<GERMAIN_USER_ID>`            → 58e64899-0f72-4cd1-a553-f45ebdb1a771 ✅
- `<BE_PROCESS_ID>`              → bd75a3b0-c918-4b43-befe-739b83f7461a ✅
- `<GUILLAUME_PROJETEUR_USER_ID>` → 4e4254bd-fd71-4933-a314-96826ce0a968 ✅ MORICEAU Guillaume

Pour récupérer les UUIDs :
```sql
SELECT id, display_name, job_title FROM profiles
WHERE display_name ILIKE '%florence%'
   OR display_name ILIKE '%marion%'
   OR display_name ILIKE '%guillaume%'
   OR display_name ILIKE '%germain%';
```
