# Sécurité — Modèle de confiance de l'application

> Dernière revue : 2026-06-12 (audit complet + phase sécurité du plan d'amélioration)

## Authentification & autorisation

- **Auth** : Supabase Auth (email/mot de passe + invitations). Toutes les routes
  applicatives passent par `ProtectedRoute` / `AuthGate` côté client.
- **Rôles** : stockés dans `user_roles` (enum `app_role`), vérifiés en base via la
  fonction `public.has_role()` (`SECURITY DEFINER`). La vérification `isAdmin` côté
  client (`useUserRole`) n'est qu'un confort d'UX : **la protection réelle est
  assurée par les policies RLS**. Un client qui falsifie son rôle localement ne peut
  pas lire/écrire au-delà de ce que RLS autorise.
- **Permissions d'écrans** : `permission_profiles` (profil) + `user_permission_overrides`
  (par utilisateur, NULL = hérite du profil). Source unique des clés côté front :
  `src/types/permissions.ts` (`SCREEN_PERMISSIONS`). La Sidebar filtre via
  `canAccessScreen(permissionKey)`.

## RLS

- RLS est activée sur **toutes** les tables du schéma `public`.
- Les policies génériques `USING (true)` sont toutes restreintes au rôle
  `authenticated` (vérifié le 2026-06-12 via `pg_policies`) : aucun accès anonyme.
- Le rôle `service_role` n'est utilisé que par les scripts Node locaux
  (`scripts/*.cjs|mjs`) et les jobs de sync — jamais côté client.

## Journal d'audit (`admin_audit_log`)

Migration `20260612100001_security_002_admin_audit_log.sql` :

- **Changements de rôles** (`user_roles`) : trigger `trg_log_user_role_changes`.
- **Visibilité des processus** (`process_template_visible_companies` /
  `_departments`) : triggers `trg_log_ptvc_changes` / `trg_log_ptvd_changes`.
- **Simulations utilisateur** (admin se faisant passer pour un autre profil) :
  insert applicatif au démarrage/arrêt (`SimulationContext`).
- Append-only : pas de policy UPDATE/DELETE. Lecture réservée aux admins.

## Secrets

- `.env` est **gitignoré** et n'a jamais contenu de secret dans l'historique git :
  seuls `VITE_SUPABASE_URL` et la clé *publishable* (publique par design) ont été
  commités brièvement (retirés en mars 2026). **Aucune rotation de clés requise.**
- `SUPABASE_SERVICE_ROLE_KEY`, mot de passe DB et secrets Azure ne vivent que dans
  le `.env` local et les secrets d'environnement des jobs. Ne jamais les commiter.

## Points de vigilance restants

- L'export de données admin (CSV, 83 tables) a été **supprimé** (2026-06-12) ; les
  exports passent par les scripts Excel ciblés (`scripts/export_*.cjs`).
- Pour le futur module RH : prévoir des policies RLS spécifiques sur `tasks`
  (confidentialité des demandes RH — visibilité restreinte RH + managers concernés).
