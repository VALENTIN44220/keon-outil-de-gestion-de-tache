# CDC — Module `<NOM_MODULE>`

> Template de cahier des charges minimal pour ajouter un nouveau flux
> métier (demande + dashboard de gestion) dans l'app, sur le modèle BE/IT.
>
> **Comment utiliser** : duplique ce fichier en `docs/CDC/<NOM>.md`,
> remplis les `<…>`, raye les sections non applicables.

---

## 1. Identité du module

| Champ | Valeur |
|---|---|
| **Nom métier** | `<ex. Maintenance, RH Onboarding, SMQ Non-conformité>` |
| **Code court** (sidebar, URL) | `<ex. maint, rh, smq>` |
| **Service responsable** (= équipe qui traite) | `<ex. Services Généraux, RH, QHSE>` |
| **Manager du service** (référent escalade) | `<prénom NOM>` |
| **Hub projet/dossier ?** | OUI / NON (cf. BE qui regroupe par dossier ALIX) |
| **Multiples sous-types de demande ?** (= plusieurs « prestations ») | OUI / NON |

---

## 2. Demandeurs autorisés

> Qui peut déposer une demande dans ce module ?

- [ ] Tous les collaborateurs
- [ ] Uniquement certains services : `<liste>`
- [ ] Uniquement les managers
- [ ] Autre : `<préciser>`

---

## 3. Liste des prestations (= sous-types)

> Si le module a plusieurs sous-types (comme IT a SUPPORT DIVALTO / SUPPORT
> PIPEDRIVE / SUPPORT LUCCA…), liste-les ici. Sinon laisse une seule ligne.

| # | Prestation | Description courte | Cible (qui réalise) | Validateur N1 | Validateur N2 | Durée standard |
|---|---|---|---|---|---|---|
| 1 | `<…>` | `<…>` | `<personne ou rôle>` | `<personne ou aucun>` | `<personne ou aucun>` | `<2h / 1j / …>` |
| 2 | `<…>` | `<…>` | `<…>` | `<…>` | `<…>` | `<…>` |

---

## 4. Champs du formulaire de demande

### 4.1 Champs communs à toutes les prestations

> Toujours présents (ex. demandeur, société, urgence, description…)

| Champ | Type | Obligatoire ? | Notes |
|---|---|---|---|
| Demandeur | auto (utilisateur connecté) | OUI | Société + service auto-remplis |
| Date de la demande | auto | OUI | created_at |
| Description | textarea | OUI | |
| Pièces jointes | files | NON | |
| `<champ>` | `<text/select/date/number/files…>` | OUI/NON | `<commentaire>` |

### 4.2 Champs conditionnels (selon prestation)

> Champs qui n'apparaissent que pour certaines prestations.

| Champ | Type | Pour la prestation | Obligatoire ? |
|---|---|---|---|
| `<champ>` | `<type>` | `<prestation>` | OUI/NON |

---

## 5. Workflow / états

> Liste les états dans l'ordre du cycle de vie. Inspire-toi du BE :
> `soumise → affectee → en_cours → a_relire → a_valider → a_deposer → en_instruction → complement_demande → cloturee`.
>
> Pour chaque état : qui peut faire avancer ? qui voit la demande ?

| Statut | Description | Qui agit ? | Statut suivant | Action côté UI |
|---|---|---|---|---|
| `soumise` | Demande créée, en attente d'affectation | Manager du service | `affectee` | Bouton « Affecter » |
| `affectee` | Affectée à un exécutant | Exécutant | `en_cours` | Bouton « Démarrer » |
| `en_cours` | En cours de réalisation | Exécutant | `a_valider` ou `realisee` | Bouton « Soumettre à validation » |
| `a_valider` | Attente validation N1 | Validateur N1 | `validee` ou `complement_demande` | Boutons « Valider » / « Demander complément » |
| `complement_demande` | Manque d'info, retour au demandeur | Demandeur | `en_cours` | Bouton « J'ai répondu » |
| `realisee` / `cloturee` | Terminée | — | (terminal) | — |
| `abandonnee` | Annulée | Demandeur ou manager | (terminal) | — |
| `<autre>` | `<…>` | `<…>` | `<…>` | `<…>` |

---

## 6. Validations

| Niveau | Quand ? | Qui valide ? | Effet si refus |
|---|---|---|---|
| **N1** | Avant clôture | `<personne ou rôle>` | Renvoie en `en_cours` avec commentaire |
| **N2** (optionnel) | Après N1 | `<personne ou rôle>` | Renvoie en N1 |

---

## 7. Notifications

> Le système BE-010 envoie déjà automatiquement une notif à l'assigné +
> manager + demandeur sur chaque commentaire. Liste ici les notifs
> **supplémentaires** propres à ce module.

| Événement | Destinataire(s) | Canal | Message type |
|---|---|---|---|
| Demande soumise | Manager du service | in-app | « Nouvelle demande `<type>` de `<demandeur>` » |
| Affectation | Exécutant | in-app | « `<demande>` vous a été affectée » |
| Validation N1 demandée | Validateur N1 | in-app | « `<demande>` attend votre validation » |
| Refus / complément demandé | Demandeur | in-app | « `<demande>` nécessite des compléments » |
| Clôture | Demandeur | in-app | « `<demande>` est terminée » |
| `<autre>` | `<…>` | `<…>` | `<…>` |

---

## 8. Dashboard de gestion (équivalent BEDispatchView)

### 8.1 KPIs (cartes en haut)

| # | KPI | Formule | Couleur |
|---|---|---|---|
| 1 | Total actives | count(status NOT IN terminaux) | neutre |
| 2 | En retard | count(due_date < today AND active) | rouge |
| 3 | À valider | count(status='a_valider') | ambre |
| 4 | Non assignées | count(assignee IS NULL AND active) | violet |
| 5 | `<KPI métier>` | `<…>` | `<…>` |

### 8.2 Filtres avancés

- [x] Recherche libre (titre / numéro)
- [x] Statut
- [x] Demandeur
- [x] Assigné
- [x] En retard (toggle)
- [ ] `<filtre métier>` : `<…>`

### 8.3 Colonnes du tableau

| # | Colonne | Source | Tri ? | Visible par défaut ? |
|---|---|---|---|---|
| 1 | N° / Titre | task.title | OUI | OUI |
| 2 | Statut | task.status (badge) | OUI | OUI |
| 3 | Demandeur | profiles.requester_id | OUI | OUI |
| 4 | Assigné | profiles.assignee_id | OUI | OUI |
| 5 | Date demande | task.created_at | OUI | OUI |
| 6 | Échéance | task.due_date | OUI | OUI |
| 7 | Durée | task.duration_hours (formaté h/j) | NON | OUI |
| 8 | `<colonne métier>` | `<…>` | OUI/NON | OUI/NON |

---

## 9. Permissions & rôles

| Action | Demandeur | Exécutant | Manager service | Admin | Autre |
|---|---|---|---|---|---|
| Créer une demande | ✅ | ✅ | ✅ | ✅ | |
| Voir ses propres demandes | ✅ | ✅ | ✅ | ✅ | |
| Voir TOUTES les demandes du module | ❌ | ❌ | ✅ | ✅ | |
| Affecter une demande | ❌ | ❌ | ✅ | ✅ | |
| Réaffecter | ❌ | ❌ | ✅ | ✅ | |
| Annuler la demande | ✅ (la sienne) | ❌ | ✅ | ✅ | |
| Valider N1 | ❌ | ❌ | ✅ ou rôle dédié | ✅ | |

---

## 10. Hub projet / dossier (si applicable)

> À remplir UNIQUEMENT si le module groupe les demandes par
> projet/dossier (cas BE avec ALIX). Sinon raye toute la section.

- **Concept** : `<ex. dossier client, projet R&D, audit qualité>`
- **Onglets du hub** : Fiche / Timeline / Budget / Temps / Discussions / Fichiers / `<autres>`
- **Code projet** : généré automatiquement ? format ? `<ex. ALIX-2026-001>`

---

## 11. Intégrations externes

| Outil | Pour quoi ? | Sens | Statut |
|---|---|---|---|
| Lucca | `<ex. import RH>` | lecture / écriture | à faire / fait |
| Yooz | `<…>` | lecture / écriture | `<…>` |
| Pipedrive | `<…>` | `<…>` | `<…>` |
| `<autre>` | `<…>` | `<…>` | `<…>` |

---

## 12. Points en suspens / questions

> Tout ce qui n'est pas tranché.

- [ ] `<question>`
- [ ] `<question>`

---

## 13. Décisions techniques (rempli par dev)

> Section que je remplirai pendant l'implémentation : tables Supabase
> créées, migrations, composants React, routes…

- Tables : `<…>`
- Migrations : `<numéros>`
- Routes front : `<…>`
- Hooks : `<…>`
