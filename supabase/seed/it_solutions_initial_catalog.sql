-- =========================================================================
-- IT Cartographie — Catalogue initial KEON
-- =========================================================================
-- Pré-remplissage des 12 solutions IT identifiées par Valentin (mai 2026).
--
-- Mode d'emploi :
--   1. Vérifier que la migration 20260503120000_it_solutions_cartography.sql
--      a bien été appliquée (table it_solutions présente).
--   2. Coller ce fichier dans le SQL editor Supabase et cliquer Run.
--   3. Le script utilise ON CONFLICT (nom) DO NOTHING via un index unique
--      provisoire pour éviter les doublons en cas de re-run.
--
-- Les owners (initiales CBE, HMO, GJA, AFO, AKA, CMA, RHI, VBE) ne sont pas
-- mappés aux UUID profiles : ils sont conservés en tête du champ
-- `commentaires` pour pouvoir les associer manuellement après coup.
-- =========================================================================

-- Index unique TEMPORAIRE pour permettre l'idempotence (drop à la fin)
CREATE UNIQUE INDEX IF NOT EXISTS uq_it_solutions_nom_seed
  ON public.it_solutions (nom);

INSERT INTO public.it_solutions
  (nom, categorie, type, usage_principal, domaine_metier, visible_dans_schema,
   connecte_datalake, flux_principaux, statut_temporalite, perimetre, criticite, commentaires)
VALUES
  (
    'ERP (DIVALTO)',
    'ERP',
    'Progiciel',
    'Gestion ERP',
    'Finance / exploitation / achats / gestion',
    TRUE,
    'oui',
    'Échanges avec TMS TEIKEI ; échanges avec Datalake',
    '06/2026 visible sur le schéma',
    'Groupe / à préciser',
    'forte',
    'Owner métier : CBE | Owner IT : HMO\nConfirmer les modules réellement utilisés et les flux exacts'
  ),
  (
    'TMS TEIKEI',
    'TMS',
    'Progiciel',
    'Gestion transport / logistique',
    'Logistique / transport',
    TRUE,
    'indirect',
    'Échanges avec ERP (DIVALTO) ; échanges avec QUADRO',
    '06/2026 et 07/2026 visibles',
    'À préciser',
    'forte',
    'Owner métier : GJA | Owner IT : VBE/HMO\nCriticité métier : Moyenne à forte\nConfirmer si le Datalake est alimenté directement ou non'
  ),
  (
    'QUADRO',
    'Application métier',
    'SaaS',
    'ERP SPV',
    'Énergie / exploitation',
    TRUE,
    'indirect',
    'Reçoit des flux du TMS ; alimente ou échange avec Datalake ; lien avec module KIONECT',
    '01/2026 visible',
    'À préciser',
    NULL,
    'Owner métier : AFO | Owner IT : VBE/HMO\nCriticité : à évaluer\nLe rôle exact de QUADRO est à documenter'
  ),
  (
    'Données externes (GRDF, GRT, ENEDIS)',
    'Sources externes',
    'Données / interfaces externes',
    'Alimentation de données externes',
    'Énergie / exploitation',
    TRUE,
    'oui',
    'Flux bidirectionnels ou entrants vers Datalake visibles',
    'En place depuis fin 2025',
    'SPV / exploitation / à préciser',
    'forte',
    'Owner métier : AFO | Owner IT : VBE/HMO\nCriticité : Moyenne à forte\nDistinguer chaque source si besoin dans la future base'
  ),
  (
    'Datalake',
    'Plateforme data',
    'Plateforme interne',
    'Centralisation et échanges de données',
    'Data / reporting / intégration SI',
    TRUE,
    'na',
    'Connecté à ERP, données externes, Lucca, Lucanet, app interne, reporting, module KIONECT, QUADRO',
    '04/2026 et 05/2026 visibles autour de certains flux',
    'Groupe',
    'tres_forte',
    'Owner métier : VBE/HMO | Owner IT : VBE/HMO\nC''est le hub central de la cartographie'
  ),
  (
    'Module KIONECT',
    'Module métier',
    'Module spécifique',
    'Mise en place sur SPV majo (+ certaines mino)',
    'Exploitation / métier SPV',
    TRUE,
    'oui',
    'Échanges avec Datalake ; lien vers automates ; lien avec QUADRO',
    '05/2026 visible ; mention « mise en place »',
    'SPV majeurs + certaines mines / à confirmer',
    'forte',
    'Owner métier : AFO | Owner IT : VBE/HMO\nConfirmer le périmètre exact de KIONECT'
  ),
  (
    'Automate NASKEO',
    'Automatisme industriel',
    'Système industriel',
    'Pilotage / supervision terrain',
    'Exploitation industrielle',
    TRUE,
    'indirect',
    'Lien avec module KIONECT',
    'Pas de date explicite sur le bloc',
    'Sites Naskeo concernés',
    'forte',
    'Owner métier : AFO | Owner IT : VBE/HMO\nProbablement à traiter séparément des apps bureautiques / SaaS'
  ),
  (
    'Automate épurateur + pont bascule',
    'Automatisme industriel',
    'Système industriel',
    'Pilotage d''équipements terrain',
    'Exploitation industrielle',
    TRUE,
    'indirect',
    'Lien avec AUTOMATE NASKEO',
    'Pas de date explicite visible',
    'Sites concernés',
    'forte',
    'Owner métier : AFO | Owner IT : VBE/HMO\nÀ séparer éventuellement en deux solutions distinctes plus tard'
  ),
  (
    'Lucca',
    'SIRH',
    'SaaS',
    'RH / temps / gestion collaborateurs',
    'RH',
    TRUE,
    'oui',
    'Échange avec Datalake',
    'Pas de date lisible sur le bloc',
    'Groupe / à préciser',
    'moyenne',
    'Owner métier : AKA | Owner IT : HMO\nConfirmer les modules Lucca utilisés'
  ),
  (
    'Lucanet',
    'Finance / consolidation / reporting',
    'SaaS',
    'Consolidation / finance / pilotage',
    'Finance / contrôle de gestion',
    TRUE,
    'oui',
    'Échange avec Datalake ; lien avec Reporting',
    '03/2026 et 05/2026 visibles autour des flux',
    'Groupe / finance',
    'forte',
    'Owner métier : CMA | Owner IT : VBE/HMO\nConfirmer le rôle exact : consolidation, budget, reporting, etc.'
  ),
  (
    'App interne gestion des tâches',
    'Application interne',
    'Développement interne',
    'Gestion des tâches',
    'Organisation / projets / opérations',
    TRUE,
    'oui',
    'Échange avec Datalake',
    'Pas de date visible',
    'Groupe / certaines équipes',
    'moyenne',
    'Owner métier : MULTIPLES | Owner IT : RHI/VBE\nProbablement une future brique importante dans la cartographie'
  ),
  (
    'Reporting',
    'BI / Reporting',
    'Outil de reporting',
    'Production de reportings',
    'Pilotage / exploitation / finance',
    TRUE,
    'oui',
    'Alimenté par Datalake ; lien avec Lucanet',
    'Reporting prod OK ; reporting bio 12/2026 ; reporting mensuel CDG en test ; reporting 3 niveaux 03/2026',
    'Groupe / métiers',
    'forte',
    'Owner métier : MULTIPLES | Owner IT : VBE/HMO\nIl faudrait peut-être éclater en plusieurs objets : plateforme BI + livrables de reporting'
  )
ON CONFLICT (nom) DO NOTHING;

-- Suppression de l'index unique provisoire (la table ne le requiert pas)
DROP INDEX IF EXISTS public.uq_it_solutions_nom_seed;

-- Vérification rapide : compter les solutions inserées
SELECT COUNT(*) AS nb_solutions FROM public.it_solutions;
