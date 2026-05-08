# CDC — Module `IT/Digital`

> Pré-rempli depuis `PARAMETRES_APP_DEMANDE_BE.xlsx` (onglet ITDIGITAL).
> À COMPLÉTER : champs marqués `<…>` ou `?`.

---

## 1. Identité du module

| Champ | Valeur |
|---|---|
| **Nom métier** | IT / Digital |
| **Code court** | `it` (route `/it/*`) |
| **Service responsable** | Service Digital / IT |
| **Manager du service** | `<Hugues MOLTO ou Valentin BERTRAND ?>` |
| **Hub projet/dossier ?** | NON (pas de notion de dossier global comme BE) — **à confirmer** |
| **Multiples sous-types de demande ?** | OUI (7 prestations) |

---

## 2. Demandeurs autorisés

- [x] Tous les collaborateurs

---

## 3. Liste des prestations (7)

| # | Prestation | Cible (qui réalise) | Validateur N1 | Validateur N2 | Durée |
|---|---|---|---|---|---|
| 1 | OUVERTURE DOSSIER SHAREPOINT | RANJIT | NON | NON | 2h |
| 2 | SUPPORT DIVALTO | HUGUES ou VALENTIN | NON | NON | 2h |
| 3 | SUPPORT PIPEDRIVE | HUGUES | NON | NON | 2h |
| 4 | SUPPORT LUCCA | SERVICE RH | NON | NON | 2h |
| 5 | REPORTING POWER BI | HUGUES | NON | NON | 8h |
| 6 | DEMANDE D'INTERVENTION IT | RANJIT | NON | NON | 2h |
| 7 | SUPPORT MATERIEL BUREAUTIQUE | RANJIT | NON | NON | 2h |

> **Note** : aucune validation N1/N2 n'est définie dans l'Excel actuel.
> À CONFIRMER : doit-on ajouter une validation manager du demandeur avant
> clôture ? ou clôture directe par la cible ?

---

## 4. Champs du formulaire de demande

### 4.1 Champs communs à toutes les prestations

| Champ | Type | Obligatoire ? | Notes |
|---|---|---|---|
| Demandeur | auto | OUI | Société + service auto |
| Date de la demande | auto | OUI | |
| Prestation | select (parmi les 7) | OUI | |
| Description | textarea | OUI | |
| Pièces jointes | files | NON | |

### 4.2 Champs conditionnels (selon prestation)

| Champ | Type | Pour la prestation | Obligatoire ? |
|---|---|---|---|
| NOM DU DOSSIER SHAREPOINT | text | OUVERTURE DOSSIER SHAREPOINT | OUI |
| EMAIL EXTERNE ET INTERNE ACCES | text (multi) | OUVERTURE DOSSIER SHAREPOINT | OUI |
| N° DE TICKET ITP | text | SUPPORT DIVALTO | NON |
| N° DE TICKET BLC | text | SUPPORT PIPEDRIVE | NON |
| CHAMP COMPLEMENTAIRE PAR LA CIBLE | textarea | toutes (rempli par exécutant) | NON |

> **À COMPLÉTER** : y a-t-il d'autres champs spécifiques à
> SUPPORT LUCCA, REPORTING POWER BI, DEMANDE D'INTERVENTION IT,
> SUPPORT MATERIEL BUREAUTIQUE ?

---

## 5. Workflow / états

> **Règle pivot** : « Affectation de la cible = AUTOMATIQUE » dans
> l'Excel. Donc dès qu'une demande est soumise pour une prestation
> donnée, elle s'auto-affecte à la cible définie sans étape manuelle.

| Statut | Description | Qui agit ? | Statut suivant | Action côté UI |
|---|---|---|---|---|
| `soumise` | Demande créée par le demandeur | (auto) | `affectee` | — (auto-bascule) |
| `affectee` | Auto-affectée à la cible (RANJIT, HUGUES…) | Cible | `en_cours` | Bouton « Démarrer » |
| `en_cours` | En cours de traitement par la cible | Cible | `en_attente_complement_demandeur` / `en_attente_retour_externe` / `realisee` | Boutons d'action |
| `en_attente_complement_demandeur` | Manque info, balle au demandeur | Demandeur | `en_cours` | Bouton « J'ai répondu » |
| `en_attente_retour_externe` | Attente d'un tiers (éditeur logiciel, fournisseur…) | Cible | `en_cours` ou `realisee` | Bouton « Retour reçu » |
| `realisee` | Demande terminée | — | (terminal) | — |
| `abandonnee` | Annulée | Demandeur ou cible | (terminal) | — |

---

## 6. Validations

| Niveau | Quand ? | Qui valide ? | Effet si refus |
|---|---|---|---|
| **N1** | `<À DÉCIDER : auto-clôture ou validation par le demandeur ?>` | — | — |
| **N2** | NON | — | — |

> Excel dit N1=NON, N2=NON. Mais en pratique, faut-il que le demandeur
> confirme « ok résolu » avant que ça passe en `realisee` ? **À TRANCHER**.

---

## 7. Notifications

| Événement | Destinataire(s) | Canal | Message |
|---|---|---|---|
| Demande soumise | La cible (RANJIT/HUGUES/…) | in-app | « Nouvelle demande IT `<prestation>` de `<demandeur>` » |
| Démarrage | Demandeur | in-app | « Votre demande IT est prise en charge » |
| Complément demandé | Demandeur | in-app | « Votre demande IT attend des informations » |
| Réponse du demandeur | Cible | in-app | « `<demandeur>` a répondu à sa demande IT » |
| Réalisée | Demandeur + manager demandeur | in-app | « Votre demande IT est terminée » |
| Commentaire | (déjà géré par BE-010) | in-app | — |

---

## 8. Dashboard de gestion

### 8.1 KPIs

| # | KPI |
|---|---|
| 1 | Total demandes actives |
| 2 | En retard (durée standard dépassée) |
| 3 | À traiter (statut `affectee`) |
| 4 | En attente de complément |
| 5 | Réalisées ce mois |

### 8.2 Filtres avancés

- [x] Recherche libre
- [x] Statut
- [x] Prestation (les 7)
- [x] Demandeur
- [x] Cible/assigné
- [x] En retard

### 8.3 Colonnes du tableau

| Colonne | Source | Visible par défaut ? |
|---|---|---|
| N° / Titre | task.title | OUI |
| Prestation | task.sub_process_template_id (libellé) | OUI |
| Statut | task.be_status (réutilisé) ou nouveau enum `it_status` | OUI |
| Demandeur | requester_id | OUI |
| Cible | assignee_id | OUI |
| Date demande | created_at | OUI |
| Durée prévue | duration_hours | OUI |
| Société demandeur | profile.company | NON |

---

## 9. Permissions & rôles

| Action | Demandeur | Cible | Manager IT | Admin |
|---|---|---|---|---|
| Créer une demande | ✅ | ✅ | ✅ | ✅ |
| Voir ses demandes | ✅ | ✅ | ✅ | ✅ |
| Voir TOUTES | ❌ | ❌ (sauf les siennes assignées) | ✅ | ✅ |
| Réaffecter | ❌ | ❌ | ✅ | ✅ |
| Annuler la demande | ✅ (la sienne) | ❌ | ✅ | ✅ |

---

## 10. Hub projet / dossier

> NON applicable au module IT (chaque demande est indépendante).
> À CONFIRMER si on veut quand même grouper par société ou par mois.

---

## 11. Intégrations externes

| Outil | Pour quoi ? | Sens | Statut |
|---|---|---|---|
| Pipedrive | n° de ticket BLC | écriture (lien retour) | à faire |
| Divalto | n° de ticket ITP | écriture (lien retour) | à faire |
| SharePoint | création dossier | déclencheur | à faire |

---

## 12. Points en suspens / questions

- [ ] **Reset à zéro** : on supprime toutes les anciennes données IT existantes en prod ? Quels critères pour identifier les bonnes vs anciennes ?
- [ ] **Validation finale** : la prestation se clôt automatiquement par la cible, ou le demandeur doit confirmer « ok résolu » ?
- [ ] **Champs additionnels** par prestation (LUCCA, POWER BI, INTERVENTION, MATERIEL) — à lister
- [ ] **SLA / durées** : 2h pour la plupart, 8h pour Power BI — c'est juste indicatif (plan de charge) ou un vrai SLA avec alerte si dépassé ?
- [ ] **Hub** : grouper par société du demandeur ? par mois ? ou pas de hub ?

---

## 13. Décisions techniques (à remplir par dev)

- Tables : `<…>` (probablement réutiliser `tasks` avec `type='task'`, `target_department_id` = service IT, et un `sub_process_template_id` par prestation)
- Migrations : `<numéros>`
- Routes front : `/it/dispatch`, `/it/projects/<id>` ?
- Hooks : `<…>`
