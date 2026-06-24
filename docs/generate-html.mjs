/**
 * Génère docs/documentation-keon.html à partir de docs/screenshots/manifest.json
 * Usage : node docs/generate-html.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = path.join(__dirname, 'screenshots');
const OUT_FILE = path.join(__dirname, 'documentation-keon.html');

const manifest = JSON.parse(fs.readFileSync(path.join(SCREENSHOTS, 'manifest.json'), 'utf-8'));

// ── Descriptions détaillées par écran ────────────────────────────────────────

const SCREEN_CONTENT = {

  // ── MON ESPACE ──────────────────────────────────────────────────────────────

  '01_dashboard': {
    intro: `Le tableau de bord est la page d'accueil de chaque utilisateur. Il offre une vue synthétique et personnalisée de l'activité en cours, centrée sur les tâches dont l'utilisateur est responsable.`,
    features: [
      { title: 'Compteurs synthétiques', desc: 'Quatre indicateurs clés : tâches actives, tâches en retard, tâches à faire aujourd\'hui, et tâches en attente de validation par l\'utilisateur.' },
      { title: 'Vues multiples', desc: 'Basculez entre les modes Grille, Kanban, Calendrier et Tableau selon votre préférence. Le mode Tableau est le mode par défaut et offre le plus de colonnes configurables.' },
      { title: 'Filtres et regroupements', desc: 'Filtrez les tâches par statut, priorité, assigné, catégorie ou échéance. Regroupez par processus, projet ou statut pour une meilleure lisibilité.' },
      { title: 'Tâches de l\'équipe', desc: 'L\'onglet "Tâches de l\'équipe" (visible si vous avez les droits de visibilité équipe) permet de voir les tâches de vos collaborateurs depuis la même interface.' },
      { title: 'Analytique', desc: 'L\'onglet Analytique présente des graphiques de répartition et d\'évolution des tâches pour suivre la productivité.' },
      { title: 'Actions en masse', desc: 'Sélectionnez plusieurs tâches pour les clôturer, réassigner ou modifier leur priorité en une seule opération.' },
    ],
    tip: 'Pour retrouver une tâche rapidement, utilisez la barre de recherche globale en haut de page (raccourci clavier : Ctrl+K).',
  },

  '02_requests': {
    intro: `La page Demandes liste toutes les demandes de prestations ouvertes dans le système, tous processus confondus (BE, IT, Innovation, Maintenance, etc.). Elle constitue le point d\'entrée pour suivre les demandes en cours et créer de nouvelles demandes depuis un modèle de processus.`,
    features: [
      { title: 'Vue globale multi-processus', desc: 'Toutes les demandes actives sont visibles dans une liste unifiée, avec leur processus d\'appartenance, leur statut d\'avancement et leur demandeur.' },
      { title: 'Création depuis un modèle', desc: 'Le bouton "Depuis un modèle" permet de lancer un assistant de création de demande en sélectionnant un processus (ex. : ICPE Enregistrement, Onboarding RH, Ticket IT).' },
      { title: 'Filtres par processus', desc: 'Filtrez les demandes par type de processus, statut, période ou demandeur pour retrouver rapidement une demande spécifique.' },
      { title: 'Statut d\'avancement', desc: 'Chaque demande affiche son pourcentage d\'avancement calculé automatiquement à partir des tâches réalisées.' },
    ],
    tip: 'Cliquez sur une demande pour accéder à son détail : tâches associées, documents, historique et commentaires.',
  },

  '03_mes_demandes': {
    intro: `La page Mes demandes est une vue filtrée centrée sur l'utilisateur connecté : elle affiche les demandes qu'il a créées ou dans lesquelles il est impliqué comme demandeur ou responsable.`,
    features: [
      { title: 'Vue personnelle', desc: 'Contrairement à la page Demandes globale, cette vue ne montre que les demandes liées à l\'utilisateur connecté, pour un suivi personnel simplifié.' },
      { title: 'Suivi de l\'avancement', desc: 'Visualisez l\'avancement de chacune de vos demandes et identifiez celles qui sont bloquées ou en attente de votre action.' },
      { title: 'Accès rapide au détail', desc: 'Un clic sur une demande ouvre sa page de détail avec la liste complète des tâches, les documents joints et le fil de discussion.' },
    ],
    tip: 'Cette page est idéale pour un utilisateur non-expert qui veut simplement suivre ses propres demandes sans être submergé par l\'ensemble de l\'activité.',
  },

  '04_workload': {
    intro: `Le plan de charge personnel affiche, semaine par semaine, les tâches assignées à l'utilisateur connecté avec leur charge estimée. Il permet d'anticiper les surcharges et de planifier son travail.`,
    features: [
      { title: 'Vue hebdomadaire', desc: 'Chaque colonne représente une semaine. Les tâches sont positionnées selon leur échéance, avec leur charge en demi-journées.' },
      { title: 'Indicateur de charge', desc: 'Une barre de charge indique le pourcentage d\'occupation pour chaque semaine, avec un code couleur (vert, orange, rouge) selon le niveau de saturation.' },
      { title: 'Granularité temporelle', desc: 'Possibilité de basculer entre une vue mensuelle, bimensuelle ou hebdomadaire selon le niveau de détail souhaité.' },
      { title: 'Navigation temporelle', desc: 'Faites défiler dans le temps pour consulter les semaines passées (réalisé) ou futures (planifié).' },
    ],
    tip: 'Idéal en début de semaine pour organiser les priorités et identifier les éventuels conflits de planning.',
  },

  '05_calendar': {
    intro: `Le calendrier offre une vue temporelle de toutes les tâches et événements de l'utilisateur, sous forme de calendrier mensuel ou hebdomadaire. Il intègre également les événements du calendrier Microsoft 365 de l'utilisateur.`,
    features: [
      { title: 'Vue mensuelle / hebdomadaire', desc: 'Basculez entre les vues mois et semaine pour une granularité différente.' },
      { title: 'Tâches et événements', desc: 'Les tâches Keon et les événements Teams/Outlook sont affichés ensemble dans la même vue pour une planification unifiée.' },
      { title: 'Création rapide', desc: 'Cliquez sur un créneau pour créer rapidement une tâche ou un rappel directement depuis le calendrier.' },
      { title: 'Code couleur par processus', desc: 'Les tâches sont colorées selon leur processus d\'appartenance (BE en vert, IT en bleu, etc.) pour une identification visuelle immédiate.' },
    ],
    tip: 'La synchronisation avec Microsoft 365 permet d\'avoir une vision complète de votre agenda sans changer d\'application.',
  },

  // ── ÉQUIPE ──────────────────────────────────────────────────────────────────

  '06_team_workload': {
    intro: `Le plan de charge équipe est une vue agrégée de la charge de travail de l'ensemble de l'équipe (ou des collaborateurs dont vous avez la visibilité). Il est destiné aux managers et responsables qui doivent piloter la répartition du travail.`,
    features: [
      { title: 'Vue multi-collaborateurs', desc: 'Chaque ligne représente un collaborateur, avec sa charge planifiée semaine par semaine.' },
      { title: 'Détection des surcharges', desc: 'Les indicateurs de charge signalent visuellement les semaines surchargées (rouge) ou sous-occupées pour faciliter le rééquilibrage.' },
      { title: 'Répartition par profil', desc: 'Filtrez par profil métier (Ingénieur, Projeteur, Chef de projet, etc.) pour analyser la charge par type de ressource.' },
      { title: 'Drill-down par collaborateur', desc: 'Cliquez sur un collaborateur pour voir le détail de ses tâches et leur distribution dans le temps.' },
    ],
    tip: 'Accessible uniquement aux utilisateurs disposant du droit "Voir les tâches des collaborateurs" ou "Voir toutes les tâches".',
  },

  // ── BUREAU D'ÉTUDES ─────────────────────────────────────────────────────────

  '07_be_dispatch': {
    intro: `Le Dispatch & Suivi BE est le centre de pilotage opérationnel du Bureau d'Études. Il permet d'affecter les tâches de prestations aux chargés d'études, de suivre l'avancement de chaque étape du workflow, et d'identifier les actions urgentes.`,
    features: [
      { title: 'Création de demandes BE', desc: 'Le bouton "Nouvelle demande" ouvre un assistant en 5 étapes : sélection du projet/affaire, choix des prestations (ex. : ICPE Enregistrement, Permis de Construire), paramétrage des détails, niveau d\'urgence, puis récapitulatif.' },
      { title: 'Affectation des tâches', desc: 'Pour chaque tâche non affectée, sélectionnez un membre de l\'équipe BE et définissez la charge estimée (en demi-journées). Le système affiche la charge courante de chaque membre pour faciliter la répartition.' },
      { title: 'Workflow de validation', desc: 'Chaque tâche suit un cycle : Soumise → Affectée → En cours → À relire → À valider → Clôturée. Les boutons d\'action (▶ Commencer, ✈ Soumettre, ✓ Valider) guident l\'utilisateur à chaque étape.' },
      { title: 'Séquencement des tâches', desc: 'Les tâches d\'une même demande peuvent être séquentielles (une tâche ne peut démarrer qu\'une fois la précédente validée) ou parallèles (groupes parallèles démarrant simultanément).' },
      { title: 'Filtres et tris', desc: 'Filtrez par statut, urgence, projet, affaire, assigné ou période. Un filtre "Non affectées" permet d\'identifier rapidement les tâches en attente d\'attribution.' },
      { title: 'Jalons automatiques', desc: 'Lors de la clôture de certaines tâches clés (ex. : Dépôt de dossier ICPE), des jalons sont automatiquement enregistrés dans la fiche projet correspondante.' },
    ],
    tip: 'Les tâches affichant un bandeau orange à gauche sont "À relire" — elles nécessitent une vérification avant validation.',
  },

  '08_be_projects': {
    intro: `La page Projets BE liste tous les projets du Bureau d'Études synchronisés depuis Divalto. Chaque projet regroupe ses affaires associées et donne accès à une fiche projet complète.`,
    features: [
      { title: 'Synchronisation Divalto', desc: 'Les projets et affaires sont automatiquement synchronisés depuis Divalto via les mouvements comptables. Les données financières (heures, budgets) sont actualisées quotidiennement.' },
      { title: 'Vue liste / carte', desc: 'Affichez les projets en liste détaillée ou en carte visuelle. La liste permet un tri par code projet, nom, responsable ou avancement.' },
      { title: 'Filtres', desc: 'Filtrez par type de projet (ICPE, SPV, Permis de Construire, etc.), par responsable ou par statut (actif, archivé).' },
      { title: 'Accès à la fiche projet', desc: 'Cliquez sur un projet pour accéder à son hub complet : vue d\'ensemble, questionnaire, synthèse Keon, timeline Gantt, budget, temps saisi, discussions et fichiers.' },
    ],
    tip: 'L\'icône de couleur sur chaque projet indique son type. Les projets avec des prestations BE en cours affichent un compteur de tâches actives.',
  },

  '09_be_planning': {
    intro: `Le plan de charge BE est une vue agrégée de la charge des membres de l'équipe Bureau d'Études, basée sur les tâches BE affectées. Il permet au responsable BE de piloter la répartition de la charge à moyen terme.`,
    features: [
      { title: 'Granularité temporelle', desc: 'Passez de la vue mensuelle à la vue bimensuelle ou hebdomadaire selon le niveau de détail souhaité. La vue mensuelle offre une vision long terme, la vue hebdomadaire permet la gestion fine.' },
      { title: 'Charge réelle vs planifiée', desc: 'Comparez la charge planifiée (issues des affectations Keon) avec le temps réellement pointé dans Lucca pour chaque collaborateur.' },
      { title: 'Répartition par affaire', desc: 'Dépliez chaque collaborateur pour voir la répartition de sa charge entre les différentes affaires/projets.' },
      { title: 'Sélecteur de période', desc: 'Choisissez librement la période de début et de fin pour zoomer sur une fenêtre temporelle spécifique, y compris les mois précédents pour analyser le réalisé.' },
    ],
    tip: 'Utilisez la vue bimensuelle pour le pilotage hebdomadaire, et la vue mensuelle pour les réunions de planification mensuelle.',
  },

  '10_be_budget': {
    intro: `Le module Budget BE permet de suivre les budgets alloués et consommés pour l'ensemble des affaires BE. Il croise les données de devis Divalto avec les temps pointés pour mesurer la rentabilité de chaque affaire.`,
    features: [
      { title: 'Vue globale des affaires', desc: 'Tableau récapitulatif de toutes les affaires avec leur budget alloué, heures consommées, écart et taux de consommation.' },
      { title: 'Données Divalto intégrées', desc: 'Les budgets (montants devisés, honoraires) proviennent directement des données Divalto synchronisées. Les heures réelles viennent de Lucca.' },
      { title: 'Filtres par période et projet', desc: 'Filtrez par projet parent, type de prestation ou période pour analyser la rentabilité sur un périmètre donné.' },
      { title: 'Export', desc: 'Exportez les données budgétaires en CSV ou Excel pour alimenter des reportings externes.' },
    ],
    tip: 'Accessible uniquement aux utilisateurs disposant du droit "can_access_be_budget". Typiquement réservé aux responsables BE et à la direction.',
  },

  '11_be_tjm': {
    intro: `Le Référentiel TJM (Taux Journalier Moyen) est un écran d'administration permettant de gérer les tarifs journaliers par profil ou par collaborateur. Ces taux sont utilisés dans les calculs de valorisation des temps pour le budget BE.`,
    features: [
      { title: 'Gestion des TJM par profil', desc: 'Définissez un TJM par profil métier (Ingénieur Senior, Projeteur, Chef de Projet, etc.) qui sert de valeur par défaut pour les calculs budgétaires.' },
      { title: 'TJM individuel', desc: 'Possibilité de définir un TJM spécifique par collaborateur pour surcharger la valeur du profil.' },
      { title: 'Historique des taux', desc: 'Les modifications sont tracées avec la date d\'entrée en vigueur pour assurer la cohérence des calculs sur des périodes passées.' },
    ],
    tip: 'Accessible uniquement aux administrateurs. Toute modification affecte les calculs budgétaires à partir de la date d\'effet configurée.',
  },

  '28a_be_overview': {
    intro: `La fiche projet BE est le hub centralisé d'un projet. Elle regroupe toutes les informations relatives au projet : ses affaires, les jalons clés, l'avancement des prestations, les membres de l'équipe et les indicateurs financiers.`,
    features: [
      { title: 'Vue d\'ensemble du projet', desc: 'Affiche le code projet, le nom, le type (ICPE, SPV, Permis, etc.), le chef de projet, les dates clés et le statut global.' },
      { title: 'Liste des affaires', desc: 'Chaque affaire Divalto rattachée au projet est listée avec son code, sa description, son budget et son avancement en heures.' },
      { title: 'Jalons', desc: 'Les jalons clés (Dépôt de dossier, Obtention d\'autorisation, etc.) sont affichés avec leur date cible et leur date réelle si atteints.' },
      { title: 'Questionnaire projet', desc: 'L\'onglet Questionnaire permet de renseigner des données structurées sur le projet (localisation, type d\'installation, données techniques) selon un formulaire paramétrable.' },
      { title: 'Navigation par onglets', desc: 'La fiche projet est organisée en onglets : Vue d\'ensemble, Questionnaire, Synthèse Keon, Gantt/Timeline, Budget, Temps saisi, Discussions, Fichiers.' },
    ],
    tip: 'Les jalons sont automatiquement renseignés lors de la clôture des tâches BE correspondantes (ex. : clôture de "Dépôt dossier ICPE" → jalon Dépôt mis à jour).',
  },

  '28b_be_timeline': {
    intro: `L'onglet Timeline (Gantt) de la fiche projet BE affiche le planning de l'ensemble des prestations sous forme de diagramme de Gantt. Il permet de visualiser les dépendances et le calendrier prévisionnel.`,
    features: [
      { title: 'Diagramme de Gantt', desc: 'Chaque prestation est représentée par une barre positionnée entre sa date de début prévisionnelle et sa date d\'échéance.' },
      { title: 'Jalons sur la timeline', desc: 'Les jalons clés (Dépôt, Obtention, etc.) sont représentés par des icônes spécifiques sur la ligne temporelle.' },
      { title: 'Navigation temporelle', desc: 'Faites défiler la timeline horizontalement pour consulter les périodes passées et futures.' },
      { title: 'Statuts visuels', desc: 'La couleur de chaque barre indique le statut de la prestation : gris (non démarré), bleu (en cours), vert (clôturé), rouge (en retard).' },
    ],
    tip: 'Utile lors des réunions de suivi pour présenter l\'avancement global du projet à un client ou à la direction.',
  },

  '28c_be_budget': {
    intro: `L'onglet Budget de la fiche projet BE présente le détail financier par affaire : budget alloué, heures consommées, valorisation et écart. Il permet un suivi fin de la rentabilité au niveau de chaque affaire.`,
    features: [
      { title: 'Détail par affaire', desc: 'Chaque affaire est détaillée avec son budget devisé, les heures réelles pointées dans Lucca et la valorisation calculée via le TJM.' },
      { title: 'Indicateurs de rentabilité', desc: 'L\'écart budget / réalisé et le taux de consommation permettent d\'identifier rapidement les affaires dérivantes.' },
      { title: 'Données Divalto en temps réel', desc: 'Les mouvements Divalto (honoraires, débours) sont intégrés pour une vision complète du réalisé financier.' },
    ],
    tip: 'Accessible uniquement si l\'utilisateur a le droit "can_access_be_budget". Idéal pour préparer les revues financières mensuelles.',
  },

  // ── SPV ─────────────────────────────────────────────────────────────────────

  '12_spv': {
    intro: `Le module SPV (Stratégie et Planification) centralise les projets de type développement stratégique. Contrairement aux projets BE opérationnels, les projets SPV ont une dimension plus transverse et font l'objet de questionnaires structurés et de synthèses Keon.`,
    features: [
      { title: 'Liste des projets SPV', desc: 'Vue liste de tous les projets stratégiques avec leur statut, responsable et indicateurs d\'avancement.' },
      { title: 'Fiche projet SPV', desc: 'Chaque projet dispose d\'une fiche avec onglets : Vue d\'ensemble, Questionnaire structuré, Synthèse Keon (analyse automatisée), Timeline, Discussions, Fichiers.' },
      { title: 'Questionnaire structuré', desc: 'Les projets SPV comportent un questionnaire paramétrable permettant de collecter des données selon des piliers définis (technique, économique, environnemental, etc.).' },
      { title: 'Synthèse Keon', desc: 'L\'onglet "Synthèse Keon" génère automatiquement une analyse structurée du projet à partir des réponses au questionnaire, facilitant la prise de décision.' },
    ],
    tip: 'L\'accès SPV est configuré via le droit "can_access_spv". La modification des données questionnaire nécessite en plus le droit "can_edit_spv_data".',
  },

  // ── IT / DIGITAL ─────────────────────────────────────────────────────────────

  '13_it_dispatch': {
    intro: `Le Dispatch IT est le centre de pilotage des demandes et projets informatiques. Il permet de réceptionner les tickets/demandes IT, de les affecter aux membres de l'équipe DSI, et de suivre leur résolution.`,
    features: [
      { title: 'Gestion des demandes IT', desc: 'Réceptionnez et traitez les demandes IT (support, développement, infrastructure) en les affectant à l\'équipe appropriée.' },
      { title: 'Création de demandes', desc: 'Les utilisateurs peuvent soumettre des demandes IT via un formulaire guidé en précisant la nature de la demande, la priorité et la description.' },
      { title: 'Workflow de traitement', desc: 'Les demandes suivent un workflow configurable : Reçue → En analyse → En cours → En recette → Clôturée.' },
      { title: 'Vue par statut et assigné', desc: 'Filtrez les demandes par statut, type, priorité ou membre de l\'équipe IT pour une gestion efficace de la file d\'attente.' },
    ],
    tip: 'Accessible par défaut à tous les utilisateurs pour la soumission. La gestion (affectation, suivi) requiert des droits IT supplémentaires.',
  },

  '14_it_projects': {
    intro: `La page Projets IT liste tous les projets informatiques en cours ou planifiés. Chaque projet dispose d'une fiche complète avec suivi des tâches, governance, timeline, budget et synchronisation avec les outils externes.`,
    features: [
      { title: 'Liste des projets IT', desc: 'Vue d\'ensemble de tous les projets IT avec leur statut, responsable, dates clés et pourcentage d\'avancement.' },
      { title: 'Types de projets configurables', desc: 'Les projets IT peuvent être typés (Infrastructure, Développement, ERP, Intégration, etc.) selon une liste paramétrable par l\'administrateur.' },
      { title: 'Fiche projet IT', desc: 'Chaque projet dispose d\'une fiche avec onglets : Vue d\'ensemble, Gouvernance, Tâches, Timeline, Synchronisation, Discussions, Fichiers, Budget.' },
      { title: 'Synchronisation externe', desc: 'L\'onglet Synchronisation permet de lier le projet Keon à des projets externes (Azure DevOps, Jira, etc.) pour une vue consolidée.' },
    ],
    tip: 'Requiert la double permission : droit d\'écran "can_access_it_projects" ET droit fonctionnel "can_view_it_projects".',
  },

  '15_it_roadmap': {
    intro: `La Feuille de route IT est une vue stratégique qui présente l'ensemble des projets et initiatives IT planifiés sur un horizon temporel (trimestre, semestre, année). Elle sert de support aux comités de pilotage DSI.`,
    features: [
      { title: 'Vue roadmap temporelle', desc: 'Les projets IT sont positionnés sur un axe temporel avec leurs dates de début et de fin prévues, organisés par priorité ou domaine.' },
      { title: 'Onglet Définition', desc: 'Permet de définir les grandes orientations et la stratégie IT, documentées et mises à jour régulièrement.' },
      { title: 'Onglet Suivi', desc: 'Vue de suivi de l\'avancement des initiatives par rapport aux jalons planifiés, avec alertes sur les projets en dérive.' },
      { title: 'Capacité simulée', desc: 'Une deuxième ligne de capacité permet de simuler la charge théorique et de la comparer à la capacité disponible de l\'équipe IT.' },
    ],
    tip: 'Outil de communication idéal pour les présentations à la direction ou aux métiers sur les projets IT en cours et à venir.',
  },

  '16_it_planning': {
    intro: `Le plan de charge IT fonctionne sur le même principe que le plan de charge BE : il affiche la charge de l'équipe IT semaine par semaine, en croisant les tâches affectées et le temps disponible de chaque membre.`,
    features: [
      { title: 'Vue par collaborateur IT', desc: 'Chaque membre de l\'équipe IT est représenté avec sa charge planifiée et son taux d\'occupation par période.' },
      { title: 'Scénarios d\'embauche', desc: 'Simulez l\'impact d\'un recrutement ou d\'un départ sur la capacité de l\'équipe grâce aux scénarios de simulation intégrés.' },
      { title: 'Sous-effectif par profil', desc: 'Identifiez les profils en sous-effectif (ex. : manque de développeurs sur une période) pour anticiper les besoins en ressources.' },
      { title: 'Sous-traitance', desc: 'Intégrez la capacité des sous-traitants dans le plan de charge pour une vision globale incluant les ressources externes.' },
    ],
    tip: 'Les scénarios de simulation permettent de tester l\'impact de recrutements ou de départs sans modifier les données réelles.',
  },

  '17_it_budget': {
    intro: `Le module Budget IT permet de suivre les budgets alloués aux projets et opérations IT, en croisant les coûts prévisionnels avec les dépenses réelles (licences, infrastructure, prestations externes, masse salariale).`,
    features: [
      { title: 'Vue globale IT', desc: 'Tableau récapitulatif de tous les postes budgétaires IT avec leur budget alloué, consommé et solde disponible.' },
      { title: 'Détail par projet', desc: 'Percez dans chaque projet pour voir la ventilation détaillée des coûts par catégorie (personnel, licences, matériel, sous-traitance).' },
      { title: 'Périodicité', desc: 'Consultez les dépenses par mois, trimestre ou année pour aligner le suivi sur les cycles de reporting financier.' },
    ],
    tip: 'Accessible uniquement via le droit "can_access_it_budget". Idéal pour préparer les revues budgétaires DSI.',
  },

  '18_it_carto': {
    intro: `La Cartographie IT est un outil de visualisation du système d'information de l'entreprise. Elle permet de cartographier les applications, leurs interconnexions, les technologies utilisées et les responsabilités associées.`,
    features: [
      { title: 'Vue du SI', desc: 'Visualisez l\'ensemble des applications et systèmes du SI, organisés par domaine fonctionnel (Finance, RH, Production, etc.).' },
      { title: 'Flux et interconnexions', desc: 'Les flux de données entre les applications sont représentés visuellement pour identifier les dépendances et les points critiques.' },
      { title: 'Fiche application', desc: 'Chaque application dispose d\'une fiche détaillée : éditeur, version, responsable technique, contrat de maintenance, criticité.' },
      { title: 'État de santé', desc: 'Un indicateur de santé par application permet de signaler les systèmes obsolètes, en fin de support ou nécessitant une migration.' },
    ],
    tip: 'Outil précieux pour la planification des migrations, les audits de sécurité et la communication avec les métiers sur l\'évolution du SI.',
  },

  // ── QUALITÉ ──────────────────────────────────────────────────────────────────

  '19_smq': {
    intro: `Le module SMQ (Système de Management de la Qualité) permet de déclarer, suivre et traiter les non-conformités internes. Il est accessible par défaut à tous les utilisateurs pour permettre une culture de la remontée d'anomalies.`,
    features: [
      { title: 'Déclaration de non-conformité', desc: 'Tout utilisateur peut déclarer une non-conformité via un formulaire simple : description, gravité, service concerné, pièces jointes.' },
      { title: 'Workflow de traitement', desc: 'Les non-conformités suivent un workflow : Déclarée → Analysée → Action corrective → Vérification → Clôturée.' },
      { title: 'Tableau de bord qualité', desc: 'Vue d\'ensemble des non-conformités par statut, service, période et type, pour identifier les tendances et les zones à risque.' },
      { title: 'Actions correctives', desc: 'Pour chaque non-conformité, des actions correctives peuvent être créées, assignées et suivies jusqu\'à leur vérification d\'efficacité.' },
      { title: 'Gestion des responsables', desc: 'Le droit "can_manage_smq" permet aux responsables qualité de modifier les statuts, assigner les traitements et clôturer les non-conformités.' },
    ],
    tip: 'La déclaration est anonymisable pour encourager les remontées sans crainte. La gestion (traitement, clôture) reste réservée aux responsables qualité.',
  },

  // ── MODULES ──────────────────────────────────────────────────────────────────

  '20_innovation': {
    intro: `Le module Innovation permet de soumettre, évaluer et suivre des idées ou projets innovants. Il offre un cadre structuré pour la gestion du portefeuille d'innovations de l'entreprise.`,
    features: [
      { title: 'Soumission d\'idées', desc: 'Les collaborateurs peuvent soumettre des idées d\'innovation via un formulaire guidé : titre, description, impact attendu, ressources nécessaires.' },
      { title: 'Évaluation et priorisation', desc: 'Les idées soumises sont évaluées par un comité selon des critères configurables (faisabilité, impact, alignement stratégique).' },
      { title: 'Suivi de l\'avancement', desc: 'Les idées retenues sont transformées en projets suivis dans le même module, avec des étapes de maturation définies.' },
      { title: 'Vue liste et détail', desc: 'Liste de toutes les idées avec leur statut (Soumise, En évaluation, Retenue, Rejetée, En cours) et accès au détail complet.' },
    ],
    tip: 'Ce module nécessite le droit "can_access_innovation". Son activation est à la discrétion de l\'administration selon la politique d\'innovation de l\'entreprise.',
  },

  '21_maintenance': {
    intro: `Le module Maintenance permet de gérer les demandes d'intervention sur le matériel ou les équipements. Il couvre la maintenance préventive (planifiée) et curative (dépannage suite à une panne).`,
    features: [
      { title: 'Demandes d\'intervention', desc: 'Les utilisateurs soumettent des demandes de maintenance avec : équipement concerné, nature de la panne, urgence et description.' },
      { title: 'Dispatch des interventions', desc: 'Le responsable maintenance affecte chaque demande à un technicien avec un délai d\'intervention cible.' },
      { title: 'Suivi des interventions', desc: 'Chaque intervention est tracée avec son temps de résolution, les pièces utilisées et un rapport d\'intervention.' },
      { title: 'Historique équipement', desc: 'Consultez l\'historique complet des interventions par équipement pour anticiper les maintenances préventives.' },
    ],
    tip: 'La gestion (affectation, clôture) nécessite le droit "can_manage_maintenance". La soumission de demandes est ouverte aux utilisateurs avec le droit "can_access_maintenance".',
  },

  '22_rh': {
    intro: `Le module RH Mouvements collaborateurs gère les processus d'onboarding (intégration), d'offboarding (départ) et de mobilité interne. Il génère automatiquement les tâches associées à chaque mouvement selon des modèles prédéfinis.`,
    features: [
      { title: 'Types de mouvements', desc: 'Trois types principaux : Onboarding (arrivée), Offboarding (départ), et Mobilité interne (changement de poste). Chaque type déclenche un ensemble de tâches spécifiques.' },
      { title: 'Tâches automatisées', desc: 'Lors de la création d\'un mouvement, un ensemble de tâches est automatiquement généré selon le type et le profil : création de compte IT, remise de matériel, formation, etc.' },
      { title: 'Multi-services', desc: 'Les tâches sont réparties entre les différents services concernés (RH, IT, Logistique, Management) avec les échéances appropriées.' },
      { title: 'Suivi du processus', desc: 'Vue d\'avancement globale de chaque mouvement avec le statut par service pour identifier les retards.' },
    ],
    tip: 'Nécessite le droit "can_access_rh". Ce module est particulièrement utile pour les équipes RH et IT qui doivent coordonner les entrées/sorties.',
  },

  '23_client': {
    intro: `Le module Création client permet de gérer le processus de référencement d'un nouveau client. Il orchestre les étapes nécessaires à l'ouverture d'un compte client : vérifications juridiques, création dans les systèmes, ouverture des accès.`,
    features: [
      { title: 'Processus de création', desc: 'Un formulaire guidé collecte les informations nécessaires : raison sociale, SIRET, contacts, domaine d\'activité, informations bancaires.' },
      { title: 'Vérifications automatiques', desc: 'Des tâches de vérification sont automatiquement créées : vérification juridique, vérification de solvabilité, validation commerciale.' },
      { title: 'Création dans Divalto', desc: 'Une fois les vérifications validées, la création dans Divalto est déclenchée (manuellement ou semi-automatiquement selon la configuration).' },
      { title: 'Traçabilité', desc: 'L\'ensemble du processus est tracé avec les acteurs, les dates et les documents associés pour une auditabilité complète.' },
    ],
    tip: 'Nécessite le droit "can_access_client". Idéal pour formaliser et tracer un processus souvent réalisé de manière informelle.',
  },

  '24_logistique': {
    intro: `Le module Logistique transports gère les demandes de transport et de livraison. Il permet aux équipes terrain de soumettre des besoins logistiques et aux responsables de les planifier et les affecter.`,
    features: [
      { title: 'Demandes de transport', desc: 'Soumettez une demande de transport en précisant : type (livraison, enlèvement, transfert), date souhaitée, adresses, volume/poids estimé.' },
      { title: 'Affectation transporteur', desc: 'Le responsable logistique affecte chaque demande à un transporteur (interne ou externe) avec les instructions de livraison.' },
      { title: 'Suivi en temps réel', desc: 'Suivez le statut de chaque transport : Demandé → Planifié → En transit → Livré → Confirmé.' },
      { title: 'Historique et reporting', desc: 'Consultez l\'historique des transports pour analyser les volumes, les délais et les coûts logistiques.' },
    ],
    tip: 'La gestion des transports (affectation, dispatch) nécessite le droit "can_manage_logistique".',
  },

  '25_sst': {
    intro: `Le module SST (Santé et Sécurité au Travail) permet de déclarer et gérer les situations à risque détectées sur les chantiers ou dans les bureaux. Il s'inscrit dans la démarche prévention des risques professionnels.`,
    features: [
      { title: 'Déclaration de situation à risque', desc: 'Déclarez une situation dangereuse observée : localisation, description du risque, niveau de gravité, photo jointe.' },
      { title: 'Qualification du risque', desc: 'Les situations déclarées sont qualifiées par le responsable SST : type de risque, probabilité, gravité, et action préventive requise.' },
      { title: 'Plan d\'action', desc: 'Des actions correctives ou préventives sont créées, assignées à des responsables avec une date d\'échéance.' },
      { title: 'Tableau de bord SST', desc: 'Vue d\'ensemble des situations par statut, localisation et niveau de risque pour piloter la politique SST.' },
    ],
    tip: 'La déclaration devrait être accessible à tous. Le traitement (qualification, fermeture) est réservé aux responsables SST via le droit "can_access_sst".',
  },

  // ── CONFIGURATION ─────────────────────────────────────────────────────────────

  '26_templates': {
    intro: `La page Modèles de processus permet aux administrateurs et responsables habilités de créer et modifier les processus métier utilisés dans l'application. Un processus définit les étapes, les acteurs et les règles d'un workflow.`,
    features: [
      { title: 'Arborescence des processus', desc: 'Les processus sont organisés en hiérarchie : Processus parent (ex. : Bureau d\'Études) → Sous-processus (ex. : Dossier ICPE Enregistrement) → Étapes (ex. : Étude préliminaire, Dépôt de dossier).' },
      { title: 'Configuration des étapes', desc: 'Pour chaque étape, configurez : nom, durée estimée, acteur responsable, documents attendus, règles de séquencement et groupes parallèles.' },
      { title: 'Modèles de prestations BE', desc: 'Les prestations BE (ICPE, Permis, Agrément, etc.) sont des sous-processus spéciaux avec des paramètres spécifiques : jalons, séquencement strict, assignation par défaut.' },
      { title: 'Visibilité par profil', desc: 'Pour chaque modèle, configurez quels profils de permissions peuvent voir et créer des demandes basées sur ce modèle.' },
      { title: 'Activation / désactivation', desc: 'Un processus peut être activé ou désactivé sans le supprimer, ce qui permet de gérer les processus saisonniers ou en cours de révision.' },
    ],
    tip: 'Nécessite le droit "can_access_templates" et "can_manage_templates". Toute modification d\'un modèle n\'affecte que les nouvelles demandes créées après la modification.',
  },

  // ── ADMINISTRATION ─────────────────────────────────────────────────────────────

  '27_admin': {
    intro: `Le panneau d'administration est réservé aux utilisateurs avec le rôle Administrateur. Il centralise la gestion des utilisateurs, des permissions, des paramètres de l'application et des outils de configuration avancée.`,
    features: [
      { title: 'Gestion des utilisateurs', desc: 'Consultez la liste de tous les utilisateurs, leur profil de permissions, leur rôle (admin/user) et leur statut. Invitez de nouveaux utilisateurs par email.' },
      { title: 'Profils de permissions', desc: 'Créez et gérez des profils de permissions (ex. : "Équipe BE", "Direction", "IT") qui regroupent un ensemble de droits d\'écran et fonctionnels. Assignez ces profils aux utilisateurs.' },
      { title: 'Exceptions individuelles', desc: 'Pour chaque utilisateur, définissez des exceptions qui surchargent les droits de son profil (accorder ou retirer un droit spécifique sans changer le profil).' },
      { title: 'Simulation utilisateur', desc: 'L\'onglet Simulation permet à l\'administrateur d\'endosser temporairement l\'identité d\'un utilisateur pour vérifier ce qu\'il voit et diagnostiquer des problèmes de permissions.' },
      { title: 'Paramètres globaux', desc: 'Configurez les paramètres globaux de l\'application : intégrations (Divalto, Lucca, Microsoft 365), notifications, visibilité des pages par appareil.' },
      { title: 'Visibilité des pages par appareil', desc: 'Paramétrez quels modules sont accessibles depuis mobile, tablette ou desktop pour optimiser l\'expérience selon le contexte d\'usage.' },
    ],
    tip: 'Seuls les utilisateurs ayant le rôle "admin" dans la table user_roles voient ce menu. Un accès non autorisé redirige vers le tableau de bord.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCESS_META = {
  standard: { label: '🟢 Standard',         color: '#16a34a', bg: '#f0fdf4', border: '#86efac', desc: 'Accessible à tous les utilisateurs par défaut' },
  profil:   { label: '🟡 Profil requis',     color: '#d97706', bg: '#fffbeb', border: '#fcd34d', desc: 'Nécessite un profil de permissions activé par l\'administrateur' },
  admin:    { label: '🔴 Admin uniquement',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', desc: 'Réservé aux administrateurs de la plateforme' },
  double:   { label: '🔵 Double permission', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', desc: 'Nécessite à la fois un droit d\'écran et un droit fonctionnel' },
};

const MODULE_COLORS = {
  'Mon Espace':        '#6366f1',
  'Équipe':            '#8b5cf6',
  "Bureau d'Études":   '#059669',
  'SPV':               '#0d9488',
  'IT / Digital':      '#0284c7',
  'Qualité':           '#db2777',
  'Modules':           '#ea580c',
  'Configuration':     '#475569',
  'Administration':    '#dc2626',
};

const MODULE_INTROS = {
  'Mon Espace': `MON ESPACE regroupe les outils personnels de chaque collaborateur : tableau de bord des tâches, suivi des demandes, plan de charge individuel et calendrier. Ces pages sont accessibles par défaut à tous les utilisateurs et constituent le point d'entrée quotidien dans l'application.`,
  'Équipe': `La section ÉQUIPE est destinée aux managers et responsables d'équipe. Elle offre une vision agrégée de la charge de travail des collaborateurs sous leur responsabilité, permettant un pilotage proactif de la répartition des tâches.`,
  "Bureau d'Études": `Le module BUREAU D'ÉTUDES couvre l'intégralité du processus de gestion des prestations d'études techniques (ICPE, Permis de Construire, Agréments, SPV, etc.). De la création d'une demande à la clôture des tâches, en passant par le dispatch, le suivi budgétaire et le plan de charge de l'équipe BE.`,
  'SPV': `Le module SPV (Stratégie et Planification) gère les projets de développement stratégique avec des questionnaires structurés et des synthèses analytiques. Il est distinct du BE opérationnel car il porte sur des projets à dimension stratégique et transverse.`,
  'IT / Digital': `Le module IT / DIGITAL couvre l'ensemble de la gestion du système d'information : tickets et demandes IT, portefeuille de projets informatiques, feuille de route DSI, plan de charge des équipes IT, budget et cartographie du SI.`,
  'Qualité': `Le module QUALITÉ centralise la gestion des non-conformités dans le cadre du SMQ (Système de Management de la Qualité). Il est accessible par défaut à tous les utilisateurs pour encourager la culture de la remontée d'anomalies.`,
  'Modules': `Les MODULES ADDITIONNELS couvrent des processus métier spécifiques qui peuvent être activés selon les besoins de l'organisation : Innovation, Maintenance, RH (mouvements), Création client, Logistique et SST. Chaque module nécessite une activation par l'administrateur.`,
  'Configuration': `La section CONFIGURATION permet aux utilisateurs habilités de gérer les processus et modèles qui structurent l'ensemble des workflows de l'application. C'est ici que sont définis les étapes, les acteurs et les règles de chaque type de demande.`,
  'Administration': `Le panneau d'ADMINISTRATION est exclusivement réservé aux administrateurs. Il centralise la gestion des utilisateurs, des permissions, des paramètres globaux et des intégrations systèmes.`,
};

function imgTag(filename) {
  if (!filename) return '<div class="no-screenshot">📷 Capture non disponible</div>';
  const filePath = path.join(SCREENSHOTS, filename);
  if (!fs.existsSync(filePath)) return `<div class="no-screenshot">📷 Fichier introuvable : ${filename}</div>`;
  const data = fs.readFileSync(filePath);
  const b64 = data.toString('base64');
  const ext = filename.endsWith('.png') ? 'png' : 'jpeg';
  return `<img src="data:image/${ext};base64,${b64}" alt="${filename}" class="screenshot" loading="lazy" />`;
}

function accessBadge(access, size = '') {
  const m = ACCESS_META[access] || ACCESS_META.profil;
  return `<span class="access-badge${size}" style="background:${m.bg};border-color:${m.border};color:${m.color}">${m.label}</span>`;
}

// ── Grouper par module ────────────────────────────────────────────────────────
const modules = {};
for (const item of manifest) {
  if (!modules[item.module]) modules[item.module] = [];
  modules[item.module].push(item);
}

// ── Table des matières ────────────────────────────────────────────────────────
function tocHtml() {
  const staticSections = `
    <div class="toc-section">
      <h4 style="color:#7c3aed">Sources des données</h4>
      <ul>
        <li><a href="#src-architecture">Architecture globale</a></li>
        <li><a href="#src-divalto">Divalto (ERP)</a></li>
        <li><a href="#src-lucca">Lucca (SIRH)</a></li>
        <li><a href="#src-microsoft">Microsoft 365</a></li>
        <li><a href="#src-fabric">Microsoft Fabric</a></li>
        <li><a href="#src-supabase">Tables Supabase</a></li>
      </ul>
    </div>
    <div class="toc-section">
      <h4 style="color:#0284c7">Comptes utilisateurs</h4>
      <ul>
        <li><a href="#usr-creation">Créer un compte</a></li>
        <li><a href="#usr-microsoft-link">Liaison Microsoft 365</a></li>
        <li><a href="#usr-permissions">Rôles &amp; permissions</a></li>
        <li><a href="#usr-status">Statuts &amp; départs</a></li>
        <li><a href="#usr-simulation">Simulation admin</a></li>
      </ul>
    </div>`;

  const moduleSections = Object.entries(modules).map(([mod, items]) => {
    const color = MODULE_COLORS[mod] || '#64748b';
    const links = items.map(item =>
      `<li><a href="#${item.id}">${item.label}</a></li>`
    ).join('\n');
    return `
    <div class="toc-section">
      <h4 style="color:${color}">${mod}</h4>
      <ul>${links}</ul>
    </div>`;
  }).join('');

  return staticSections + moduleSections;
}

// ── Rendu d'un écran ──────────────────────────────────────────────────────────
function screenHtml(item) {
  const meta = ACCESS_META[item.access] || ACCESS_META.profil;
  const content = SCREEN_CONTENT[item.id];

  const featuresHtml = content?.features?.length
    ? `<div class="features-grid">${content.features.map(f =>
        `<div class="feature-card">
          <div class="feature-title">${f.title}</div>
          <div class="feature-desc">${f.desc}</div>
        </div>`
      ).join('')}</div>`
    : '';

  const tipHtml = content?.tip
    ? `<div class="tip-box"><span class="tip-icon">💡</span><span>${content.tip}</span></div>`
    : '';

  return `
  <section id="${item.id}" class="screen-section">
    <div class="screen-header">
      <div class="screen-title-row">
        <h3 class="screen-title">${item.label}</h3>
        <span class="access-badge large" style="background:${meta.bg};border-color:${meta.border};color:${meta.color}">${meta.label}</span>
      </div>
      <div class="screen-meta">
        <span class="url-tag">🔗 ${item.url || ''}</span>
        <span class="access-desc">${meta.desc}</span>
      </div>
    </div>

    ${content?.intro ? `<p class="screen-intro">${content.intro}</p>` : ''}

    <div class="screenshot-container">${imgTag(item.file)}</div>

    ${featuresHtml}
    ${tipHtml}
  </section>`;
}

// ── Corps principal ───────────────────────────────────────────────────────────
function bodyHtml() {
  return Object.entries(modules).map(([mod, items]) => {
    const color = MODULE_COLORS[mod] || '#64748b';
    const moduleIntro = MODULE_INTROS[mod] || '';
    const itemsHtml = items.map(item => screenHtml(item)).join('');

    return `
<div class="module-block" id="module-${mod.replace(/[^a-z0-9]/gi, '-').toLowerCase()}">
  <div class="module-header" style="border-left-color:${color};background:linear-gradient(to right,${color}10,transparent)">
    <h2 style="color:${color}">${mod}</h2>
    <span class="module-count">${items.length} écran${items.length > 1 ? 's' : ''}</span>
  </div>
  ${moduleIntro ? `<p class="module-intro">${moduleIntro}</p>` : ''}
  ${itemsHtml}
</div>`;
  }).join('');
}

// ── Section : Sources de données ─────────────────────────────────────────────
function datasourcesHtml() {
  return `
<div class="special-section" id="section-sources">
  <div class="special-section-header" style="border-left-color:#7c3aed;background:linear-gradient(to right,#7c3aed10,transparent)">
    <h2 style="color:#7c3aed">Sources des données</h2>
    <span class="module-count">Architecture technique</span>
  </div>
  <p class="module-intro">
    Keon Task Manager s'appuie sur <strong>Supabase</strong> comme base de données principale (PostgreSQL hébergé)
    et synchronise des données depuis quatre sources externes : <strong>Divalto</strong> (ERP comptabilité),
    <strong>Lucca</strong> (SIRH), <strong>Microsoft 365</strong> (calendrier, Planner, SharePoint)
    et <strong>Microsoft Fabric</strong> (datalake analytique). Chaque source alimente des tables spécifiques
    via des Edge Functions Supabase ou des notebooks Fabric.
  </p>

  <!-- Architecture globale -->
  <div class="screen-section" id="src-architecture">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Architecture globale des flux de données</h3></div>
    </div>
    <div class="arch-grid">
      <div class="arch-source" style="border-color:#059669">
        <div class="arch-source-title" style="color:#059669">🏭 Divalto (ERP)</div>
        <div class="arch-source-desc">Mouvements analytiques comptables et commerciaux (commandes + factures). Synchronisé via notebook Fabric vers <code>divalto_mouvements_all</code>.</div>
        <div class="arch-source-freq">Fréquence : déclenchement manuel</div>
      </div>
      <div class="arch-source" style="border-color:#0284c7">
        <div class="arch-source-title" style="color:#0284c7">👥 Lucca (SIRH)</div>
        <div class="arch-source-desc">Profils employés, saisies de temps (timesheets), congés. Synchronisé via Edge Function <code>sync-lucca-profiles</code>.</div>
        <div class="arch-source-freq">Fréquence : déclenchement manuel ou planifié</div>
      </div>
      <div class="arch-source" style="border-color:#2563eb">
        <div class="arch-source-title" style="color:#2563eb">🔷 Microsoft 365</div>
        <div class="arch-source-desc">Calendrier Outlook, tâches Planner, fichiers SharePoint. OAuth Azure AD avec refresh automatique des tokens. Edge Function <code>microsoft-graph</code>.</div>
        <div class="arch-source-freq">Fréquence : à la demande + refresh token automatique</div>
      </div>
      <div class="arch-source" style="border-color:#7c3aed">
        <div class="arch-source-title" style="color:#7c3aed">🔮 Microsoft Fabric</div>
        <div class="arch-source-desc">Datalake analytique unifié. Notebook <code>nb_divalto_mouvements_all_sync.ipynb</code> lit les lakehouses <em>mouv_gold</em> et <em>C8_gold</em> et pousse vers Supabase.</div>
        <div class="arch-source-freq">Fréquence : déclenchement manuel via Fabric</div>
      </div>
    </div>
  </div>

  <!-- Divalto -->
  <div class="screen-section" id="src-divalto">
    <div class="screen-header">
      <div class="screen-title-row">
        <h3 class="screen-title">Divalto — ERP comptabilité &amp; gestion commerciale</h3>
        <span class="src-badge" style="background:#f0fdf4;border-color:#86efac;color:#059669">🏭 ERP</span>
      </div>
    </div>
    <p class="screen-intro">
      Divalto est le système de gestion (ERP) de l'entreprise. Il produit les mouvements analytiques (commandes, factures)
      qui permettent à Keon de suivre le budget et la consommation de chaque affaire BE ou projet IT.
      Les données transitent via Microsoft Fabric (lakehouse) avant d'être chargées dans Supabase.
    </p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Table principale : <code>divalto_mouvements_all</code></div>
        <div class="feature-desc">Source unifiée grain-ligne (NASKEO + TerGreen). Contient tous les mouvements comptables et commerciaux. Clé d'idempotence : <code>line_uid</code> (hash du contenu ligne). Champs clés : <code>code_affaire</code>, <code>prefix</code> (CCN/CFN/FCN/FFN), <code>montant_ht</code>, <code>source</code> (gescom/compta), <code>synced_at</code>.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Vue BE : <code>be_divalto_mouvements</code></div>
        <div class="feature-desc">Vue filtrée pour le Bureau d'Études. Types de mouvements : CCN (commande client NASKEO), CFK (commande client TerGreen), FCN (facture client NASKEO), FFK (facture client TerGreen). Axes analytiques : <code>axe_0001</code>, <code>axe_0002</code> → <code>code_affaire</code>.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Mécanisme de synchronisation</div>
        <div class="feature-desc">Notebook Fabric <code>nb_divalto_mouvements_all_sync.ipynb</code> lit les lakehouses <em>mouv_gold</em> (gescom) et <em>C8_gold</em> (compta), calcule le <code>line_uid</code> et effectue un upsert idempotent dans Supabase. Aucune donnée n'est jamais supprimée (historique conservé).</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Vues analytiques calculées</div>
        <div class="feature-desc"><code>v_be_affaire_budget_kpi</code> — budget engagé/constaté par affaire. <code>v_be_project_budget_kpi</code> — agrégation par projet. <code>v_be_groupe_kpi</code> — vue par groupe de projets (5 premiers caractères du code).</div>
      </div>
    </div>
    <div class="tip-box"><span class="tip-icon">⚠️</span><span>La synchronisation Divalto est déclenchée manuellement depuis Microsoft Fabric. Les données affichées dans les modules Budget BE et IT ont donc un décalage d'au maximum quelques jours selon la fréquence des synchronisations.</span></div>
  </div>

  <!-- Lucca -->
  <div class="screen-section" id="src-lucca">
    <div class="screen-header">
      <div class="screen-title-row">
        <h3 class="screen-title">Lucca — SIRH (Saisies de temps &amp; profils RH)</h3>
        <span class="src-badge" style="background:#eff6ff;border-color:#93c5fd;color:#2563eb">👥 SIRH</span>
      </div>
    </div>
    <p class="screen-intro">
      Lucca est le Système d'Information RH (SIRH). Il fournit deux types de données à Keon :
      les profils des collaborateurs (avec leur identifiant Lucca, leur poste, leur service)
      et les saisies de temps (heures déclarées par affaire), qui alimentent les calculs de charge réelle dans les plans de charge BE et IT.
    </p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Profils : <code>profiles.id_lucca</code></div>
        <div class="feature-desc">Chaque collaborateur dans Keon peut avoir un identifiant Lucca (<code>id_lucca</code>). Ce lien est établi lors de la synchronisation des profils via l'Edge Function <code>sync-lucca-profiles</code>. Le service est synchronisé via <code>departments.id_services_lucca</code>.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Saisies de temps : <code>lucca_saisie_temps</code></div>
        <div class="feature-desc">Table des heures déclarées dans Lucca par projet/affaire (<code>code_site</code> = code affaire BE). Champs : <code>user_id</code>, <code>id_lucca</code>, <code>code_site</code>, <code>duree_heures</code>, <code>date_saisie</code>. Utilisée pour calculer le temps réel vs planifié dans les plans de charge.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">TJM par fonction : <code>be_tjm_fonctions</code></div>
        <div class="feature-desc">Table des taux journaliers moyens par fonction BE (Ingénieur, Projeteur, Chargé d'affaires, etc.). Clé : <code>fonction</code>, valeur : <code>taux_horaire</code> (€/h). Hiérarchie du taux effectif : taux automatique (via <code>job_title</code>) > taux manuel (<code>be_fonction</code>) > 0 (non valorisé).</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Vues temps calculées</div>
        <div class="feature-desc"><code>v_be_affaire_temps_kpi</code> — synthèse heures budgetées/planifiées/déclarées par affaire. <code>v_be_affaire_temps_par_user</code> — détail par collaborateur avec taux effectif. <code>v_be_affaire_temps_par_poste</code> — groupement par poste BE.</div>
      </div>
    </div>
    <div class="tip-box"><span class="tip-icon">💡</span><span>La page Administration dispose d'un onglet dédié à la gestion des doublons Lucca (<code>LuccaDuplicatesTab</code>) pour résoudre les conflits entre profils Keon et Lucca lors de la synchronisation.</span></div>
  </div>

  <!-- Microsoft 365 -->
  <div class="screen-section" id="src-microsoft">
    <div class="screen-header">
      <div class="screen-title-row">
        <h3 class="screen-title">Microsoft 365 — Calendrier, Planner &amp; SharePoint</h3>
        <span class="src-badge" style="background:#eff6ff;border-color:#93c5fd;color:#2563eb">🔷 M365</span>
      </div>
    </div>
    <p class="screen-intro">
      L'intégration Microsoft 365 permet à chaque utilisateur de lier son compte Azure AD à son compte Keon.
      Une fois connecté, les événements du calendrier Outlook s'affichent dans le calendrier Keon, les tâches
      Planner peuvent être synchronisées bidirectionnellement, et les fichiers SharePoint sont accessibles depuis les fiches projets.
    </p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Connexion OAuth : <code>user_microsoft_connections</code></div>
        <div class="feature-desc">Stockage sécurisé des tokens Azure AD par utilisateur. Les tokens (<code>access_token</code>, <code>refresh_token</code>) sont chiffrés. Un refresh automatique s'effectue si le token expire dans moins de 5 minutes. Les tokens ne sont jamais exposés côté client (vue publique masquée).</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Calendrier Outlook : <code>outlook_calendar_events</code></div>
        <div class="feature-desc">Cache des événements Outlook de l'utilisateur. Champs : <code>outlook_event_id</code>, <code>subject</code>, <code>start_time</code>, <code>end_time</code>, <code>is_all_day</code>, <code>attendees</code> (JSONB). La plage de synchronisation est configurable (jours passés / futurs).</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Planner : <code>planner_plan_mappings</code> + <code>planner_task_links</code></div>
        <div class="feature-desc">Mapping bidirectionnel entre Plans Planner et processus Keon. Direction configurable : <em>vers Planner</em>, <em>depuis Planner</em>, ou <em>bidirectionnel</em>. Statuts de sync : <code>synced</code>, <code>conflict</code>, <code>pending_push</code>, <code>pending_pull</code>.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">SharePoint : lecture à la demande</div>
        <div class="feature-desc">Les fichiers SharePoint sont lus via l'Edge Function <code>microsoft-graph</code> (action <code>sharepoint-list-files</code>) sans stockage local. Hook <code>useSharepointFiles(sharepointUrl)</code> utilisé dans les fiches projets. Scopes requis : <code>Sites.Read.All</code>, <code>Files.Read.All</code>.</div>
      </div>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Scopes OAuth Azure AD requis</div>
      <table class="data-table">
        <thead><tr><th>Scope</th><th>Usage</th></tr></thead>
        <tbody>
          <tr><td><code>openid profile email</code></td><td>Authentification de base</td></tr>
          <tr><td><code>offline_access</code></td><td>Refresh token (session persistante)</td></tr>
          <tr><td><code>User.Read</code></td><td>Profil utilisateur Azure AD</td></tr>
          <tr><td><code>Calendars.Read / ReadWrite</code></td><td>Lecture/écriture événements Outlook</td></tr>
          <tr><td><code>Tasks.Read / ReadWrite</code></td><td>Lecture/écriture tâches Planner</td></tr>
          <tr><td><code>Group.Read.All</code></td><td>Plans Planner (groupes M365)</td></tr>
          <tr><td><code>Sites.Read.All / Files.Read.All</code></td><td>Fichiers SharePoint</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Fabric -->
  <div class="screen-section" id="src-fabric">
    <div class="screen-header">
      <div class="screen-title-row">
        <h3 class="screen-title">Microsoft Fabric — Datalake analytique</h3>
        <span class="src-badge" style="background:#faf5ff;border-color:#d8b4fe;color:#7c3aed">🔮 Fabric</span>
      </div>
    </div>
    <p class="screen-intro">
      Microsoft Fabric est la plateforme datalake de l'entreprise. Elle joue le rôle d'intermédiaire entre Divalto (ERP)
      et Supabase : les données Divalto sont d'abord chargées dans les lakehouses Fabric, puis un notebook Python
      les pousse vers Supabase via l'API Supabase. Cette architecture découple les systèmes et garantit l'idempotence des syncs.
    </p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Lakehouses sources</div>
        <div class="feature-desc"><strong>mouv_gold</strong> — mouvements Divalto gescom (commandes/factures clients) pour NASKEO + TerGreen. <strong>C8_gold</strong> — mouvements Divalto compta (écritures comptables). Les deux sont consolidés dans <code>divalto_mouvements_all</code>.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Notebook de synchronisation</div>
        <div class="feature-desc"><code>nb_divalto_mouvements_all_sync.ipynb</code> — notebook Python/PySpark qui lit les tables Delta des lakehouses, calcule le <code>line_uid</code> (hash idempotent), et effectue un upsert vers Supabase via l'API REST. Déclenché manuellement depuis l'interface Fabric.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Catalogue des tables : <code>datalake_table_catalog</code></div>
        <div class="feature-desc">Registre interne des tables synchronisées avec leur statut, clé primaire, et date de dernière synchronisation. Utilisé pour le monitoring et la traçabilité des syncs.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Logs de sync : <code>workflow_datalake_sync_logs</code></div>
        <div class="feature-desc">Historique détaillé de chaque synchronisation : direction (app→datalake / datalake→app), tables synchronisées, lignes lues/écrites, durée, statut. Permet d'auditer et de détecter les anomalies de synchronisation.</div>
      </div>
    </div>
  </div>

  <!-- Tables Supabase -->
  <div class="screen-section" id="src-supabase">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Base de données Supabase — Tables principales</h3></div>
    </div>
    <p class="screen-intro">
      Supabase héberge la base de données PostgreSQL de Keon. Les tables sont organisées en tiers fonctionnels.
      Toutes les tables sont protégées par des politiques RLS (Row Level Security) qui garantissent que chaque
      utilisateur ne voit que les données auxquelles il a droit selon son profil de permissions.
    </p>
    <div class="data-table-wrapper">
      <div class="data-table-title">Tier 0 — Authentification &amp; Profils</div>
      <table class="data-table">
        <thead><tr><th>Table</th><th>Rôle</th><th>Champs clés</th></tr></thead>
        <tbody>
          <tr><td><code>auth.users</code></td><td>Comptes Supabase (built-in)</td><td>id (UUID), email, created_at</td></tr>
          <tr><td><code>profiles</code></td><td>Profil utilisateur enrichi</td><td>display_name, job_title, department_id, manager_id, id_lucca, be_poste, status</td></tr>
          <tr><td><code>user_roles</code></td><td>Rôles app (admin/moderator/user)</td><td>user_id (FK), role (app_role enum)</td></tr>
          <tr><td><code>permission_profiles</code></td><td>Profils de permissions (40+ droits)</td><td>name, can_manage_users, can_view_be_projects, can_access_be_budget, qst_pilier_XX_read/write…</td></tr>
        </tbody>
      </table>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Tier 1 — Structure organisationnelle</div>
      <table class="data-table">
        <thead><tr><th>Table</th><th>Rôle</th></tr></thead>
        <tbody>
          <tr><td><code>companies</code></td><td>Sociétés / Filiales (NASKEO, TerGreen…)</td></tr>
          <tr><td><code>departments</code></td><td>Services / Départements (lien Lucca via id_services_lucca)</td></tr>
          <tr><td><code>job_titles</code></td><td>Intitulés de poste</td></tr>
          <tr><td><code>hierarchy_levels</code></td><td>Niveaux hiérarchiques (N, N-1, N-2…)</td></tr>
        </tbody>
      </table>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Tier 2 — Tâches &amp; Processus (Core)</div>
      <table class="data-table">
        <thead><tr><th>Table</th><th>Rôle</th></tr></thead>
        <tbody>
          <tr><td><code>tasks</code></td><td>Tâches individuelles (status, priority, assignee, due_date, be_status)</td></tr>
          <tr><td><code>process_templates</code></td><td>Modèles de processus (ensembles de tâches)</td></tr>
          <tr><td><code>sub_process_templates</code></td><td>Sous-processus par catégorie (prestations BE, tickets IT…) avec order_index</td></tr>
          <tr><td><code>task_comments</code></td><td>Commentaires sur tâches</td></tr>
          <tr><td><code>task_attachments</code></td><td>Pièces jointes</td></tr>
          <tr><td><code>workload_slots</code></td><td>Créneaux de planification (demi-journées)</td></tr>
        </tbody>
      </table>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Tier 3 — Bureau d'Études (BE)</div>
      <table class="data-table">
        <thead><tr><th>Table</th><th>Rôle</th></tr></thead>
        <tbody>
          <tr><td><code>be_projects</code></td><td>Projets BE (code_projet, charge_affaires, ingénieur, projeteur)</td></tr>
          <tr><td><code>be_affaires</code></td><td>Affaires Divalto rattachées aux projets (code_affaire unique)</td></tr>
          <tr><td><code>be_affaire_budget_lines</code></td><td>Lignes budgétaires par affaire (poste, montant, statut)</td></tr>
          <tr><td><code>divalto_mouvements_all</code></td><td>Source unifiée mouvements Divalto (via Fabric)</td></tr>
          <tr><td><code>lucca_saisie_temps</code></td><td>Temps déclarés dans Lucca (heures réelles)</td></tr>
          <tr><td><code>be_tjm_fonctions</code></td><td>Taux journaliers par fonction BE</td></tr>
        </tbody>
      </table>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Tier 4 — Microsoft 365</div>
      <table class="data-table">
        <thead><tr><th>Table</th><th>Rôle</th></tr></thead>
        <tbody>
          <tr><td><code>user_microsoft_connections</code></td><td>Tokens OAuth Azure AD (chiffrés, refresh automatique)</td></tr>
          <tr><td><code>outlook_calendar_events</code></td><td>Cache événements calendrier Outlook</td></tr>
          <tr><td><code>planner_plan_mappings</code></td><td>Mapping Plans Planner ↔ processus Keon</td></tr>
          <tr><td><code>planner_task_links</code></td><td>Lien 1:1 tâches Planner ↔ tâches Keon</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>`;
}

// ── Section : Gestion des comptes utilisateurs ────────────────────────────────
function userManagementHtml() {
  return `
<div class="special-section" id="section-users">
  <div class="special-section-header" style="border-left-color:#0284c7;background:linear-gradient(to right,#0284c710,transparent)">
    <h2 style="color:#0284c7">Gestion des comptes utilisateurs</h2>
    <span class="module-count">Administration</span>
  </div>
  <p class="module-intro">
    La gestion des comptes utilisateurs est centralisée dans le panneau Administration (accessible aux administrateurs uniquement).
    Elle couvre la création de comptes, la configuration des permissions, la liaison avec Microsoft 365 et Lucca,
    et la gestion des rôles. Ce chapitre décrit le processus complet de création et de configuration d'un utilisateur.
  </p>

  <!-- Création de compte -->
  <div class="screen-section" id="usr-creation">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Créer un compte utilisateur</h3></div>
    </div>
    <p class="screen-intro">
      La création d'un compte se fait exclusivement depuis le panneau Administration (chemin : <code>/admin</code> → onglet Utilisateurs).
      Le processus comprend 4 étapes : création du compte Supabase, enrichissement du profil, assignation des permissions, et invitation par email.
    </p>
    <div class="steps-list">
      <div class="step-item">
        <div class="step-num">1</div>
        <div class="step-body">
          <div class="step-title">Créer le compte (bouton "Nouvel utilisateur")</div>
          <div class="step-desc">Remplissez le formulaire de création : <strong>Email</strong> (obligatoire, doit être l'email professionnel Microsoft), <strong>Nom d'affichage</strong>, <strong>Société</strong>, <strong>Service</strong>, <strong>Poste</strong>, <strong>Niveau hiérarchique</strong>, <strong>Manager</strong>. Un compte Supabase est créé et un profil <code>profiles</code> est automatiquement initialisé par trigger.</div>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div class="step-body">
          <div class="step-title">Assigner un profil de permissions</div>
          <div class="step-desc">Sélectionnez un <strong>profil de permissions</strong> dans la liste déroulante (ex. : "Équipe BE", "Direction", "IT"). Ce profil définit l'ensemble des droits d'accès aux modules et fonctionnalités. Si aucun profil prédéfini ne correspond, les droits peuvent être configurés individuellement via des exceptions.</div>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div class="step-body">
          <div class="step-title">Inviter l'utilisateur par email</div>
          <div class="step-desc">Cliquez sur <strong>"Inviter"</strong> pour envoyer un email d'invitation à l'utilisateur. L'email contient un lien de connexion. L'utilisateur clique sur le lien et est redirigé vers la page de connexion Keon où il s'authentifie avec son compte Microsoft 365 (bouton "Continuer avec Microsoft").</div>
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div class="step-body">
          <div class="step-title">Première connexion de l'utilisateur</div>
          <div class="step-desc">L'utilisateur clique sur "Continuer avec Microsoft" sur la page de connexion Keon (<code>/auth</code>). L'OAuth Azure AD s'ouvre — l'utilisateur s'authentifie avec ses identifiants Microsoft professionnels. Après consentement aux scopes, il est redirigé vers <code>/auth/callback</code> puis vers son tableau de bord.</div>
        </div>
      </div>
    </div>
    <div class="tip-box"><span class="tip-icon">💡</span><span>L'invitation bulk est possible : sélectionnez plusieurs utilisateurs dans la liste et cliquez sur "Inviter la sélection" pour envoyer les emails en masse.</span></div>
  </div>

  <!-- Connexion Microsoft -->
  <div class="screen-section" id="usr-microsoft-link">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Liaison compte Microsoft 365</h3></div>
    </div>
    <p class="screen-intro">
      La liaison Microsoft 365 est distincte de l'authentification. L'authentification utilise Azure AD pour la connexion (SSO),
      mais la liaison Microsoft permet en plus d'accéder au calendrier Outlook, aux tâches Planner et aux fichiers SharePoint
      depuis l'intérieur de Keon. Cette liaison doit être activée par l'utilisateur ou l'administrateur.
    </p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Authentification (connexion)</div>
        <div class="feature-desc">Tous les utilisateurs se connectent via le bouton "Continuer avec Microsoft" sur la page <code>/auth</code>. L'authentification utilise OAuth Azure AD (provider <code>azure</code> Supabase). Aucune configuration supplémentaire n'est requise côté utilisateur.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Liaison calendrier / Planner</div>
        <div class="feature-desc">Pour synchroniser le calendrier Outlook et les tâches Planner, l'utilisateur doit lier son compte Microsoft depuis ses paramètres de profil. Cette liaison crée une entrée dans <code>user_microsoft_connections</code> avec les tokens OAuth enrichis (scopes Calendars + Tasks + Sites).</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Liaison depuis l'Admin</div>
        <div class="feature-desc">L'administrateur peut lier le compte Microsoft d'un utilisateur depuis la fiche utilisateur dans l'onglet Utilisateurs → bouton "Lier Microsoft". Il faut renseigner l'email Microsoft de l'utilisateur (<code>user@company.onmicrosoft.com</code>).</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Refresh automatique des tokens</div>
        <div class="feature-desc">Les tokens OAuth expirent toutes les heures. Keon rafraîchit automatiquement le token via l'Edge Function <code>microsoft-graph</code> si l'expiration est imminente (< 5 min). L'utilisateur ne voit jamais d'interruption de service.</div>
      </div>
    </div>
  </div>

  <!-- Rôles et permissions -->
  <div class="screen-section" id="usr-permissions">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Rôles et profils de permissions</h3></div>
    </div>
    <p class="screen-intro">
      Le système de permissions de Keon est à deux niveaux : les <strong>rôles applicatifs</strong> (admin/moderator/user)
      qui définissent le niveau d'accès global, et les <strong>profils de permissions</strong> qui regroupent
      des droits fonctionnels granulaires (40+ droits). Des <strong>exceptions individuelles</strong> permettent
      de surcharger le profil pour un utilisateur spécifique sans créer un nouveau profil.
    </p>
    <div class="data-table-wrapper">
      <div class="data-table-title">Rôles applicatifs (table <code>user_roles</code>)</div>
      <table class="data-table">
        <thead><tr><th>Rôle</th><th>Accès</th><th>Usages typiques</th></tr></thead>
        <tbody>
          <tr><td><code>admin</code></td><td>Accès complet à tous les modules et paramètres</td><td>DSI, responsable applicatif</td></tr>
          <tr><td><code>moderator</code></td><td>Gestion modérée (templates, validations) sans admin</td><td>Responsable de service</td></tr>
          <tr><td><code>user</code></td><td>Utilisateur standard, accès selon profil de permissions</td><td>Tous les collaborateurs</td></tr>
        </tbody>
      </table>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Principaux droits du profil de permissions</div>
      <table class="data-table">
        <thead><tr><th>Droit</th><th>Effet</th></tr></thead>
        <tbody>
          <tr><td><code>can_view_all_tasks</code></td><td>Voir toutes les tâches de l'application</td></tr>
          <tr><td><code>can_view_subordinates_tasks</code></td><td>Voir les tâches de ses collaborateurs directs</td></tr>
          <tr><td><code>can_assign_to_all</code></td><td>Affecter des tâches à n'importe quel utilisateur</td></tr>
          <tr><td><code>can_access_be_dispatch</code></td><td>Accès au Dispatch &amp; Suivi BE</td></tr>
          <tr><td><code>can_access_be_budget</code></td><td>Accès aux données budgétaires BE</td></tr>
          <tr><td><code>can_view_be_projects</code></td><td>Voir la liste des projets BE (droit fonctionnel)</td></tr>
          <tr><td><code>can_access_it_projects</code></td><td>Accès aux projets IT (droit d'écran)</td></tr>
          <tr><td><code>can_view_it_projects</code></td><td>Voir les projets IT (droit fonctionnel — requis en plus du droit d'écran)</td></tr>
          <tr><td><code>can_access_spv</code></td><td>Accès au module SPV</td></tr>
          <tr><td><code>can_manage_users</code></td><td>Créer / modifier / supprimer des utilisateurs</td></tr>
          <tr><td><code>can_manage_templates</code></td><td>Créer et modifier les modèles de processus</td></tr>
          <tr><td><code>qst_pilier_XX_read/write</code></td><td>Accès lecture/écriture aux piliers des questionnaires SPV (7 piliers)</td></tr>
        </tbody>
      </table>
    </div>
    <div class="tip-box"><span class="tip-icon">💡</span><span>Certains modules (IT Projets, SPV) nécessitent une <strong>double permission</strong> : un droit d'écran (peut voir la page) ET un droit fonctionnel (peut voir les données). Si un utilisateur voit la page vide, vérifiez que les deux droits sont activés dans son profil.</span></div>
  </div>

  <!-- Statuts utilisateur -->
  <div class="screen-section" id="usr-status">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Statuts utilisateur &amp; gestion des départs</h3></div>
    </div>
    <div class="data-table-wrapper">
      <div class="data-table-title">Statuts disponibles (<code>profiles.status</code>)</div>
      <table class="data-table">
        <thead><tr><th>Statut</th><th>Label</th><th>Comportement</th><th>Cas d'usage</th></tr></thead>
        <tbody>
          <tr><td><code>active</code></td><td>Actif</td><td>Accès normal, peut recevoir des tâches</td><td>Collaborateur en poste</td></tr>
          <tr><td><code>suspended</code></td><td>Suspendu</td><td>Exclut des nouvelles affectations, conserve l'historique</td><td>Absence longue durée, arrêt maladie</td></tr>
          <tr><td><code>deleted</code></td><td>Parti</td><td>Aucune nouvelle affectation possible, archive logique</td><td>Départ de l'entreprise (offboarding)</td></tr>
          <tr><td><code>external</code></td><td>Externe</td><td>Accès limité aux données propres</td><td>Prestataire, client, partenaire</td></tr>
        </tbody>
      </table>
    </div>
    <div class="tip-box"><span class="tip-icon">⚠️</span><span>La suppression d'un utilisateur est une <strong>suppression logique</strong> (statut "Parti") : le compte reste en base pour préserver l'historique des tâches et commentaires. Aucune donnée n'est physiquement effacée.</span></div>
  </div>

  <!-- Simulation -->
  <div class="screen-section" id="usr-simulation">
    <div class="screen-header">
      <div class="screen-title-row"><h3 class="screen-title">Simulation de vue utilisateur (Admin)</h3></div>
    </div>
    <p class="screen-intro">
      L'onglet Simulation du panneau Administration permet à un administrateur de visualiser l'application
      telle qu'un utilisateur spécifique la voit, sans avoir à se déconnecter et reconnecter avec son compte.
      C'est un outil précieux pour diagnostiquer des problèmes de permissions ou valider une configuration.
    </p>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Accès : <code>/admin</code> → onglet Simulation</div>
        <div class="feature-desc">Sélectionnez un utilisateur dans la liste déroulante. L'interface bascule immédiatement sur la vue de cet utilisateur : seuls les modules et données auxquels il a accès sont visibles.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Quitter la simulation</div>
        <div class="feature-desc">Un bandeau orange s'affiche en bas de l'écran indiquant "Mode simulation — Vous visualisez comme [Nom]". Cliquez sur "Quitter la simulation" pour revenir à votre session administrateur.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Cas d'usage</div>
        <div class="feature-desc">Vérifier qu'un nouvel utilisateur voit bien ses modules, diagnostiquer pourquoi un utilisateur ne voit pas une page, valider une configuration de profil de permissions avant de la déployer à plusieurs utilisateurs.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Liaison Lucca</div>
        <div class="feature-desc">Depuis la fiche utilisateur Admin, un bouton "Lier Lucca" permet de renseigner l'<code>id_lucca</code> du collaborateur. Ce lien est nécessaire pour que ses saisies de temps Lucca apparaissent dans les plans de charge BE et IT.</div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Légende ───────────────────────────────────────────────────────────────────
function legendHtml() {
  return Object.entries(ACCESS_META).map(([key, m]) =>
    `<div class="legend-item" style="background:${m.bg};border:1px solid ${m.border}">
      <span style="color:${m.color};font-weight:700;font-size:0.85rem">${m.label}</span>
      <span class="legend-desc">${m.desc}</span>
    </div>`
  ).join('');
}

// ── Statistiques ──────────────────────────────────────────────────────────────
const screensCount = manifest.filter(i => i.file).length;
const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
const standardCount = manifest.filter(i => i.access === 'standard').length;
const profilCount = manifest.filter(i => i.access === 'profil').length;
const adminCount = manifest.filter(i => i.access === 'admin').length;

// ── HTML complet ──────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Documentation Keon — Guide Utilisateur</title>
<style>
  /* ── Reset & base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; scroll-behavior: smooth; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         color: #1e293b; background: #f8fafc; line-height: 1.6; }
  a { color: inherit; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Layout ── */
  .page { display: flex; min-height: 100vh; }

  /* ── Sidebar ToC ── */
  .toc {
    position: fixed; top: 0; left: 0; width: 270px; height: 100vh;
    overflow-y: auto; background: #0f172a; color: #e2e8f0; padding: 0 0 48px;
    z-index: 100; font-size: 0.78rem;
    scrollbar-width: thin; scrollbar-color: #334155 transparent;
  }
  .toc::-webkit-scrollbar { width: 4px; }
  .toc::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  .toc-logo {
    padding: 20px 18px 16px; border-bottom: 1px solid #1e293b;
    font-size: 1rem; font-weight: 800; color: #f1f5f9; letter-spacing: -0.03em;
    background: linear-gradient(135deg, #1e293b, #0f172a);
    position: sticky; top: 0; z-index: 1;
  }
  .toc-logo span { display: block; font-size: 0.7rem; color: #64748b; font-weight: 400; margin-top: 2px; }
  .toc-section { padding: 10px 16px 2px; }
  .toc-section h4 { font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.1em; margin-bottom: 4px; opacity: 0.9; }
  .toc-section ul { list-style: none; }
  .toc-section li { margin-bottom: 1px; }
  .toc-section a { font-size: 0.75rem; color: #94a3b8; padding: 3px 8px; border-radius: 4px;
                   display: block; transition: all 0.15s; }
  .toc-section a:hover { background: #1e293b; color: #e2e8f0; text-decoration: none; }

  /* ── Main content ── */
  .main { margin-left: 270px; padding: 48px 52px; max-width: 1140px; }

  /* ── Cover ── */
  .cover { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
           border-radius: 16px; padding: 52px 48px; margin-bottom: 48px; color: white;
           border: 1px solid #334155; }
  .cover-logo { font-size: 2.8rem; font-weight: 900; letter-spacing: -0.05em; margin-bottom: 8px; }
  .cover-logo span { color: #38bdf8; }
  .cover-subtitle { font-size: 1.05rem; color: #94a3b8; }
  .cover-desc { margin-top: 16px; font-size: 0.9rem; color: #cbd5e1; max-width: 600px; line-height: 1.6; }
  .cover-meta { display: flex; gap: 16px; margin-top: 32px; flex-wrap: wrap; }
  .cover-stat { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px; padding: 14px 20px; }
  .cover-stat-num { font-size: 1.8rem; font-weight: 700; color: #38bdf8; line-height: 1; }
  .cover-stat-label { font-size: 0.72rem; color: #94a3b8; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

  /* ── Legend ── */
  .legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .legend-item { padding: 14px 16px; border-radius: 10px; display: flex; flex-direction: column; gap: 5px; }
  .legend-desc { font-size: 0.8rem; color: #475569; line-height: 1.4; }

  /* ── Section intro ── */
  .section-intro-box { background: #f1f5f9; border-radius: 10px; padding: 16px 20px;
                       margin-bottom: 32px; border: 1px solid #e2e8f0; }
  .section-intro-box p { font-size: 0.88rem; color: #475569; line-height: 1.6; }

  /* ── Module block ── */
  .module-block { margin-bottom: 64px; }
  .module-header { border-left: 4px solid; padding: 10px 16px; margin-bottom: 12px;
                   display: flex; align-items: baseline; gap: 14px; border-radius: 0 8px 8px 0; }
  .module-header h2 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }
  .module-count { font-size: 0.75rem; color: #94a3b8; background: #f1f5f9; border: 1px solid #e2e8f0;
                  padding: 2px 10px; border-radius: 20px; }
  .module-intro { font-size: 0.9rem; color: #475569; line-height: 1.7; margin-bottom: 28px;
                  padding: 14px 18px; background: white; border-radius: 10px; border: 1px solid #e2e8f0; }

  /* ── Screen section ── */
  .screen-section { background: white; border-radius: 14px; border: 1px solid #e2e8f0;
                    padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .screen-header { margin-bottom: 14px; }
  .screen-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .screen-title { font-size: 1.15rem; font-weight: 700; color: #0f172a; }
  .screen-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .url-tag { font-size: 0.72rem; font-family: 'Courier New', monospace; color: #64748b;
             background: #f8fafc; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px; }
  .access-desc { font-size: 0.78rem; color: #94a3b8; font-style: italic; }
  .screen-intro { font-size: 0.88rem; color: #475569; line-height: 1.7; margin-bottom: 20px;
                  border-left: 3px solid #e2e8f0; padding-left: 14px; }

  /* ── Access badge ── */
  .access-badge { font-size: 0.68rem; font-weight: 600; padding: 3px 10px; border-radius: 20px;
                  border: 1px solid; white-space: nowrap; }
  .access-badge.large { font-size: 0.75rem; padding: 4px 12px; }

  /* ── Screenshot ── */
  .screenshot-container { border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;
                          margin-bottom: 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .screenshot { width: 100%; height: auto; display: block; }
  .no-screenshot { padding: 48px; text-align: center; color: #94a3b8; background: #f8fafc; font-size: 0.9rem; }

  /* ── Features grid ── */
  .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                   gap: 12px; margin-bottom: 16px; }
  .feature-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .feature-title { font-size: 0.82rem; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .feature-desc { font-size: 0.8rem; color: #475569; line-height: 1.5; }

  /* ── Tip box ── */
  .tip-box { display: flex; gap: 10px; align-items: flex-start; background: #fefce8;
             border: 1px solid #fde047; border-radius: 8px; padding: 12px 16px; margin-top: 4px; }
  .tip-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
  .tip-box span:last-child { font-size: 0.82rem; color: #713f12; line-height: 1.5; }

  /* ── Footer ── */
  .footer { text-align: center; color: #94a3b8; font-size: 0.78rem; margin-top: 64px;
            padding: 24px; border-top: 1px solid #e2e8f0; }

  /* ── Special sections (sources, users) ── */
  .special-section { margin-bottom: 64px; }
  .special-section-header { border-left: 4px solid; padding: 10px 16px; margin-bottom: 12px;
                             display: flex; align-items: baseline; gap: 14px; border-radius: 0 8px 8px 0; }
  .special-section-header h2 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }

  /* ── Architecture sources ── */
  .arch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap: 14px; margin-bottom: 24px; }
  .arch-source { border: 2px solid; border-radius: 12px; padding: 16px 18px; }
  .arch-source-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 8px; }
  .arch-source-desc { font-size: 0.8rem; color: #475569; line-height: 1.5; margin-bottom: 8px; }
  .arch-source-freq { font-size: 0.72rem; color: #94a3b8; font-style: italic; }
  .src-badge { font-size: 0.68rem; font-weight: 600; padding: 3px 10px; border-radius: 20px;
               border: 1px solid; white-space: nowrap; }

  /* ── Tables de données ── */
  .data-table-wrapper { margin-bottom: 18px; }
  .data-table-title { font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase;
                      letter-spacing: 0.05em; margin-bottom: 8px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .data-table th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600;
                   color: #374151; border-bottom: 2px solid #e2e8f0; }
  .data-table td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; color: #475569; vertical-align: top; }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:hover td { background: #f8fafc; }
  .data-table code { font-size: 0.75rem; background: #f1f5f9; padding: 1px 5px; border-radius: 3px;
                     color: #0284c7; font-family: 'Courier New', monospace; }

  /* ── Steps ── */
  .steps-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
  .step-item { display: flex; gap: 14px; align-items: flex-start; }
  .step-num { width: 28px; height: 28px; min-width: 28px; background: #0284c7; color: white;
              border-radius: 50%; display: flex; align-items: center; justify-content: center;
              font-size: 0.8rem; font-weight: 700; margin-top: 2px; }
  .step-body { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
  .step-title { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .step-desc { font-size: 0.8rem; color: #475569; line-height: 1.5; }

  /* ── Print ── */
  @media print {
    .toc { display: none; }
    .main { margin-left: 0; padding: 24px 32px; }
    .screen-section { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    .module-block { break-before: page; page-break-before: always; }
    .module-block:first-child { break-before: avoid; page-break-before: avoid; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .features-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ── Sidebar ── -->
  <nav class="toc">
    <div class="toc-logo">
      KEON Task Manager
      <span>Documentation utilisateur · ${today}</span>
    </div>
    ${tocHtml()}
  </nav>

  <!-- ── Contenu ── -->
  <main class="main">

    <!-- Couverture -->
    <div class="cover">
      <div class="cover-logo">KE<span>ON</span></div>
      <div class="cover-subtitle">Documentation utilisateur — Guide des modules et fonctionnalités</div>
      <div class="cover-desc">
        Ce document présente l'ensemble des modules et écrans de la plateforme Keon Task Manager.
        Pour chaque écran, vous trouverez une description fonctionnelle, le détail des fonctionnalités disponibles
        et le niveau d'accès requis.
      </div>
      <div class="cover-meta">
        <div class="cover-stat">
          <div class="cover-stat-num">${Object.keys(modules).length}</div>
          <div class="cover-stat-label">Modules</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-num">${screensCount}</div>
          <div class="cover-stat-label">Écrans documentés</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-num">${standardCount}</div>
          <div class="cover-stat-label">Accès standard</div>
        </div>
        <div class="cover-stat">
          <div class="cover-stat-num">${profilCount + adminCount}</div>
          <div class="cover-stat-label">Accès restreint</div>
        </div>
      </div>
    </div>

    <!-- Légende -->
    <section style="margin-bottom:48px">
      <h2 style="font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:14px;letter-spacing:-0.02em">
        Niveaux d'accès
      </h2>
      <div class="legend">${legendHtml()}</div>
      <p style="font-size:0.82rem;color:#64748b;margin-top:12px;line-height:1.6">
        Les niveaux d'accès sont configurés par l'administrateur depuis le panneau Administration → Permissions.
        Un profil de permissions regroupe un ensemble de droits (écran + fonctionnels) qui peut être assigné
        à un ou plusieurs utilisateurs. Des exceptions individuelles peuvent être accordées sans modifier le profil.
      </p>
    </section>

    <!-- Sources des données -->
    ${datasourcesHtml()}

    <!-- Gestion des comptes utilisateurs -->
    ${userManagementHtml()}

    <!-- Modules -->
    ${bodyHtml()}

    <div class="footer">
      Documentation générée automatiquement le ${today} · Keon Task Manager · Usage interne uniquement
    </div>
  </main>

</div>
</body>
</html>`;

fs.writeFileSync(OUT_FILE, html, 'utf-8');
const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
console.log(`\n✅ Documentation générée → docs/documentation-keon.html (${sizeMB} MB)`);
console.log(`   ${screensCount} screenshots · ${Object.keys(modules).length} modules · ${Object.keys(SCREEN_CONTENT).length} descriptions détaillées\n`);
