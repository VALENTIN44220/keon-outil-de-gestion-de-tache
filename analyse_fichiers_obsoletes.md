# Analyse des fichiers potentiellement obsolètes

**Date :** 18 mars 2026  
**Projet :** KEON Task Manager

---

## 🔴 Fichiers obsolètes (aucune référence trouvée dans le code)

| # | Chemin | Fichier | Raison |
|---|--------|---------|--------|
| 1 | `src/components/suppliers/` | `SupplierDetailDrawer.tsx.backup` | Fichier `.backup` — contient du HTML statique (ancien build), pas du TSX. Aucun import. |
| 2 | `src/` | `App.css` | Fichier CSS Vite par défaut (logo-spin, .card, .read-the-docs). **Aucun import** nulle part dans le projet. |
| 3 | `src/assets/` | `reference-kanban.avif` | Image non référencée dans aucun fichier `.ts` / `.tsx`. |
| 4 | `public/` | `placeholder.svg` | Fichier SVG par défaut Lovable. Aucune référence dans le code source. |
| 5 | `public/` | `favicon.ico` | Seul `favicon.png` est utilisé dans `index.html`. Le `.ico` n'est référencé nulle part. |
| 6 | `src/` | `tailwind.config.lov.json` | Fichier interne Lovable. Aucun import dans le code applicatif. |

---

## 🟠 Fichiers de documentation/migration (usage ponctuel terminé)

| # | Chemin | Fichier | Raison |
|---|--------|---------|--------|
| 7 | `/` | `SWITCHOVER_TODO.md` | Checklist de migration Supabase ancien→nouveau. Non référencé dans le code. Utile uniquement pendant la migration. |
| 8 | `/` | `MIGRATION_REPORT.md` | Rapport de migration Supabase. Non référencé dans le code. Documentation ponctuelle. |

---

## 🟠 Scripts utilitaires (usage ponctuel)

| # | Chemin | Fichier | Raison |
|---|--------|---------|--------|
| 9 | `scripts/` | `import_csv_via_supabase_api.mjs` | Script d'import CSV pour migration. Non référencé dans le code front. Utile uniquement pendant la migration. |
| 10 | `scripts/` | `generate_schema_sql_from_migrations.sh` | Script utilitaire pour générer du SQL à partir des migrations. Non référencé dans le code front. |

---

## 🟡 Fichiers internes / cache Supabase

| # | Chemin | Fichier | Raison |
|---|--------|---------|--------|
| 11 | `supabase/.temp/` | `storage-migration` | Fichier temporaire Supabase CLI. |
| 12 | `supabase/.temp/` | `cli-latest`, `gotrue-version`, `pooler-url`, `postgres-version`, `project-ref`, `rest-version`, `storage-version` | Fichiers cache internes Supabase CLI. Peuvent être régénérés. |

---

## 🟡 Page de développement (potentiellement à retirer en production)

| # | Chemin | Fichier | Raison |
|---|--------|---------|--------|
| 13 | `src/pages/` | `DesignSystem.tsx` | Page de démonstration du design system. Accessible via `/design-system`. Utile en dev, probablement pas en production. |

---

## ✅ Fichiers vérifiés et utilisés (non obsolètes)

Les fichiers suivants ont été vérifiés et sont **activement utilisés** :

- `src/assets/keon-logo.jpg` → utilisé dans Sidebar, PageHeader, DesignSystem
- `src/assets/keon-task-logo.png` → utilisé dans Header, AdminHeader
- `src/contexts/SimulationContext.tsx` → utilisé dans 14+ fichiers
- `src/lib/workflowCoherenceChecks.ts` → utilisé dans WorkflowConfigTab, WfCoherencePanel
- `src/lib/workflowAssignmentRules.ts` → utilisé dans 8+ fichiers
- `src/lib/standardWorkflowTemplate.ts` → utilisé dans WorkflowConfigTab, WfStandardModePanel
- `src/utils/interventionBEPreset.ts` → utilisé dans useWorkflowRegeneration
- `src/utils/planningDateUtils.ts` → utilisé dans WeekPlanningGrid, PlanningCalendarGrid
- `public/favicon.png` → référencé dans index.html

---

## Résumé

| Catégorie | Nombre |
|-----------|--------|
| 🔴 Obsolètes (suppression recommandée) | 6 |
| 🟠 Documentation/scripts de migration (à archiver) | 4 |
| 🟡 Fichiers temporaires/cache | 8 |
| 🟡 Page dev uniquement | 1 |
| **Total fichiers potentiellement obsolètes** | **19** |
