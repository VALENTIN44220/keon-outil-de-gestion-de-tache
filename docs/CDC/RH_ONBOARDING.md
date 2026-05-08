# CDC — Module `RH / Onboarding`

> Pré-rempli depuis `PARAMETRES_APP_DEMANDE_BE.xlsx` (onglet oneboarding).
> À COMPLÉTER : champs marqués `<…>` ou `?`.

---

## 1. Identité du module

| Champ | Valeur |
|---|---|
| **Nom métier** | RH — Cycle de vie collaborateur |
| **Code court** | `rh` (route `/rh/*`) |
| **Service responsable** | RH |
| **Manager du service** | Audrey KABORE (validateur final de toutes les étapes) |
| **Hub projet/dossier ?** | OUI — un « dossier collaborateur » regroupe toutes les étapes du cycle (onboarding → mutations → offboarding) |
| **Multiples sous-types de demande ?** | OUI (4 prestations) |

---

## 2. Demandeurs autorisés

- [x] Managers (déclenchent un onboarding/offboarding/mutation/promotion pour un membre de leur équipe)
- [x] RH (peut tout déclencher)

> **À CONFIRMER** : un collaborateur peut-il déposer une demande pour
> lui-même (ex. promotion) ? ou seulement les managers + RH ?

---

## 3. Liste des prestations (4)

| # | Prestation | Description | Cibles multiples ? | Validateur final |
|---|---|---|---|---|
| 1 | ONBOARDING | Arrivée nouveau collaborateur | OUI (RH, Digital, SG, Comm, Comptabilité, FMS) | Audrey KABORE |
| 2 | OFFBOARDING | Départ collaborateur | OUI (RH, Digital, SG, Comptabilité) | Audrey KABORE |
| 3 | MUTATION | Changement de société/poste/manager interne | OUI (RH, Digital, SG, Comptabilité) | Audrey KABORE |
| 4 | PROMOTION | Évolution de poste interne | OUI (RH, Digital) | Audrey KABORE |

> **Particularité** : chaque prestation déclenche **plusieurs sous-tâches
> en parallèle**, affectées à différents services. C'est l'équivalent du
> `sub_process_templates` du BE.

---

## 4. Champs du formulaire de demande

### 4.1 Champs communs

| Champ | Type | Obligatoire ? | Notes |
|---|---|---|---|
| Demandeur | auto | OUI | |
| Date de la demande | auto | OUI | |
| Prestation | select (parmi les 4) | OUI | Détermine les sous-tâches |
| Description / contexte | textarea | NON | |

### 4.2 Champs « informations collaborateur »

> Communs à toutes les prestations sauf cas spécifiques.

| Champ | Type | Obligatoire | Onboarding | Offboarding | Mutation | Promotion |
|---|---|---|---|---|---|---|
| NOM | text | OUI | ✅ | ✅ | ✅ | ✅ |
| PRENOM | text | OUI | ✅ | ✅ | ✅ | ✅ |
| POSTE | text | OUI | ✅ | ✅ | — | — |
| MANAGER | profile | OUI | ✅ | ✅ | — | — |
| VEHICULE | bool | OUI | ✅ | ✅ | — | — |
| TYPE VEHICULE | text (si oui) | conditionnel | ✅ | ✅ | — | — |
| ORDINATEUR PORTABLE | bool | OUI | ✅ | ✅ | — | — |
| TELEPHONE | bool | OUI | ✅ | ✅ | — | — |
| SOCIETE | select | OUI | ✅ | — | — | — |
| SERVICE | select | OUI | ✅ | — | — | — |
| LIEU DE TRAVAIL | text | OUI | ✅ | ✅ | — | — |
| DATE 1ER JOUR DE CONTRAT | date | OUI | ✅ | — | — | — |
| DATE DERNIER JOUR DE CONTRAT | date | OUI | — | ✅ | — | — |
| DATE MUTATION | date | OUI | — | — | ✅ | — |
| DATE PROMOTION | date | OUI | — | — | — | ✅ |
| ANCIEN POSTE | text | OUI | — | — | ✅ | ✅ |
| NOUVEAU POSTE | text | OUI | — | — | ✅ | ✅ |
| ANCIENNE SOCIETE | select | OUI | — | — | ✅ | ✅ |
| NOUVELLE SOCIETE | select | OUI | — | — | ✅ | ✅ |
| ANCIEN MANAGER | profile | OUI | — | — | ✅ | ✅ |
| NOUVEAU MANAGER | profile | OUI | — | — | ✅ | ✅ |

> **À COMPLÉTER** : numéro SS, RIB (sensible), niveau, tickets resto, mutuelle, CP restants… ?

---

## 5. Sous-tâches par prestation

> Quand on crée une demande, le système génère automatiquement N
> sous-tâches selon la prestation choisie. Chaque sous-tâche est affectée
> à un service avec validateur final = Audrey KABORE.

### 5.1 ONBOARDING (≈18 sous-tâches)

| Sous-tâche | Service cible | Affectation | Validateur N1 |
|---|---|---|---|
| Appliquer droits réseaux | Digital | RANJIT | Audrey KABORE |
| Info SPV si besoin | Digital | RANJIT | Audrey KABORE |
| Créer mot de passe Vaultwarden | Digital | RANJIT | Audrey KABORE |
| Droits AD | Digital | RANJIT | Audrey KABORE |
| Création utilisateur Divalto + droits | Digital | RANJIT | Audrey KABORE |
| Compte Mail | Digital | RANJIT | Audrey KABORE |
| Compte Office | Digital | RANJIT | Audrey KABORE |
| Compte Scanner | Digital | RANJIT | Audrey KABORE |
| Dossiers utilisateur réseau P + Commun | Digital | RANJIT | Audrey KABORE |
| Mise en place MFA | Digital | RANJIT | Audrey KABORE |
| PC : Acrobat / Divalto / VPN / Office 365 / Teams + KEON GROUP / OneDrive / Supremo | Digital | RANJIT | Audrey KABORE |
| Outlook : partage agenda | Digital | RANJIT | Audrey KABORE |
| Pipedrive : ajouter user sur Entra | Digital | RANJIT | Audrey KABORE |
| Contrat de travail | RH | service RH | Audrey KABORE |
| DPAE | RH | service RH | Audrey KABORE |
| Fiche SILAE / LUCCA | RH | service RH | Audrey KABORE |
| Droits AD (côté RH) | RH | service RH | Audrey KABORE |
| Intégration RH | RH | service RH | Audrey KABORE |
| Visite médicale | RH | service RH | Audrey KABORE |
| Formation interne si besoin | RH | service RH | Audrey KABORE |
| Téléphone si oui | Services Généraux | Jennifer / Luisa / Elodie | Audrey KABORE |
| Véhicule si oui | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Badge Vinci | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Carte Total | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Clé des locaux | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Préparation attestation de remise matériel | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Créer compte Letsignit | Comm/Marketing | Claire / Géraldine / Diane | Audrey KABORE |
| Circuit ventes (devis, commande, BL) si besoin | Digital | Hugues / Valentin | Audrey KABORE |
| Circuit achats (commande, BL) si besoin | Digital | Hugues / Valentin | Audrey KABORE |
| Logistique si besoin | Digital | Hugues / Valentin | Audrey KABORE |
| Comptabilité (factures, TVA, règlements) si besoin | Digital | Hugues / Valentin | Audrey KABORE |
| Pipedrive : créer utilisateur si besoin | Digital | Hugues / Valentin | Audrey KABORE |
| Formation | Réglementaire / FMS | Florence MARTIN-SISTERON | Audrey KABORE |
| Création compte Yooz | Comptabilité | Mélanie / Corinne | Audrey KABORE |

### 5.2 OFFBOARDING

| Sous-tâche | Service cible | Affectation | Validateur N1 |
|---|---|---|---|
| LAR | RH | service RH | Audrey KABORE |
| STC | RH | service RH | Audrey KABORE |
| Clôture LUCCA | RH | service RH | Audrey KABORE |
| Archives dossier salarié | RH | service RH | Audrey KABORE |
| Récupérer le PC | Digital | RANJIT | Audrey KABORE |
| Nettoyer le PC | Digital | RANJIT | Audrey KABORE |
| Récupérer licence AD360 | Digital | RANJIT | Audrey KABORE |
| Récupérer licence Office | Digital | RANJIT | Audrey KABORE |
| Désactiver compte + placer dans anciens salariés | Digital | RANJIT | Audrey KABORE |
| Supprimer utilisateur dans MFA | Digital | RANJIT | Audrey KABORE |
| Compte Office | Digital | RANJIT | Audrey KABORE |
| Archiver dossiers utilisateur | Digital | RANJIT | Audrey KABORE |
| Supprimer droit Yooz | Digital | RANJIT | Audrey KABORE |
| Récupérer matériel | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Divalto : fermer profil | Digital | Hugues / Valentin | Audrey KABORE |
| Pipedrive : fermer profil | Digital | Hugues / Valentin | Audrey KABORE |
| Récupérer avance permanente | Comptabilité | Mélanie / Corinne | Audrey KABORE |
| Fermeture compte Yooz | Comptabilité | Mélanie / Corinne | Audrey KABORE |

### 5.3 MUTATION

| Sous-tâche | Service cible | Affectation | Validateur N1 |
|---|---|---|---|
| Avenant au contrat | RH | service RH | Audrey KABORE |
| Mise à jour LUCCA | RH | service RH | Audrey KABORE |
| Créer alias nouvelle société | Digital | RANJIT | Audrey KABORE |
| Mettre à jour droits Divalto si nécessaire | Digital | RANJIT | Audrey KABORE |
| Avance frais permanente | Comptabilité | Mélanie / Corinne | Audrey KABORE |
| Bilan NDF | Comptabilité | Mélanie / Corinne | Audrey KABORE |
| Bilan CP | Comptabilité | Mélanie / Corinne | Audrey KABORE |
| Modification compte Yooz | Comptabilité | Mélanie / Corinne | Audrey KABORE |
| Cartes carburant | SG | Jennifer / Luisa / Elodie | Audrey KABORE |
| Badge péage | SG | Jennifer / Luisa / Elodie | Audrey KABORE |

### 5.4 PROMOTION

| Sous-tâche | Service cible | Affectation | Validateur N1 |
|---|---|---|---|
| Avenant au contrat | RH | service RH | Audrey KABORE |
| Mise à jour LUCCA | RH | service RH | Audrey KABORE |
| Mettre à jour droits Divalto si nécessaire | Digital | RANJIT | Audrey KABORE |

> **À COMPLÉTER** : durées standards par sous-tâche (vide dans l'Excel),
> ordres / dépendances éventuelles (ex. « Compte Mail » avant
> « Compte Office » ?), parallélisable ou séquentiel ?

---

## 6. Workflow / états

> Même squelette que BE — réutilisable.

| Statut | Description | Qui agit ? | Statut suivant |
|---|---|---|---|
| `soumise` | Demande créée par manager / RH | Audrey KABORE | `affectee` |
| `affectee` | Sous-tâches dispatchées sur les services | Cible de chaque sous-tâche | `en_cours` |
| `en_cours` | Au moins une sous-tâche en cours | Cibles | `a_valider` (par sous-tâche) |
| `a_valider` | Sous-tâche terminée par cible, attente validation | Audrey KABORE | `validee` ou `complement_demande` |
| `validee` | Sous-tâche validée par Audrey | — | (terminal sous-tâche) |
| `complement_demande` | Manque info, retour cible | Cible | `en_cours` |
| `cloturee` | Toutes sous-tâches validées | (auto) | (terminal) |
| `abandonnee` | Annulation (ex. embauche annulée) | RH ou manager | (terminal) |

---

## 7. Validations

| Niveau | Quand ? | Qui valide ? |
|---|---|---|
| **N1** | À chaque sous-tâche terminée | Audrey KABORE |
| **N2** | Clôture finale du dossier (tout est validé) | Audrey KABORE (auto si N1 OK partout) |

---

## 8. Notifications

| Événement | Destinataire | Message |
|---|---|---|
| Onboarding soumis | Audrey + tous les services cibles | « Nouveau dossier ONBOARDING : `<NOM PRENOM>` arrivée le `<date>` » |
| Sous-tâche affectée | Cible | « `<sous-tâche>` à réaliser pour `<NOM PRENOM>` » |
| Sous-tâche réalisée | Audrey | « `<sous-tâche>` terminée par `<exécutant>`, à valider » |
| Complément demandé | Cible | « Audrey demande des compléments sur `<sous-tâche>` » |
| Dossier clôturé | Demandeur + manager du collaborateur | « Dossier `<prestation>` `<NOM PRENOM>` clôturé » |
| J-3 avant arrivée | Tous services impliqués | « `<NOM PRENOM>` arrive dans 3 jours, restent X actions » |

---

## 9. Dashboard de gestion

### 9.1 KPIs

| # | KPI |
|---|---|
| 1 | Dossiers actifs (toutes prestations) |
| 2 | Onboarding en retard (date 1er jour < today + non clôturé) |
| 3 | Sous-tâches à valider |
| 4 | Sous-tâches en retard |
| 5 | Onboarding à venir (J+30) |

### 9.2 Filtres

- [x] Recherche libre (NOM, PRENOM)
- [x] Statut (par prestation et par sous-tâche)
- [x] Prestation (4)
- [x] Service cible
- [x] Manager
- [x] Société
- [x] Date d'arrivée / départ

### 9.3 Vue principale

> Vue type **hub par dossier collaborateur** : on clique sur le dossier
> ALICE DURAND → on voit la liste des sous-tâches groupées par service,
> chacune avec son statut et son validateur.
>
> Inspirée du `BEProjectHub` (onglets : Fiche / Timeline / Discussions / Fichiers).

---

## 10. Permissions & rôles

| Action | Manager | RH | Service cible | Audrey | Admin |
|---|---|---|---|---|---|
| Créer demande | ✅ (équipe) | ✅ | ❌ | ✅ | ✅ |
| Voir TOUS les dossiers | ❌ (équipe seulement) | ✅ | ❌ (sienne) | ✅ | ✅ |
| Voir les données sensibles (RIB, SS) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Affecter sous-tâche | ❌ | ✅ | ❌ | ✅ | ✅ |
| Valider sous-tâche (N1) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Annuler dossier | ❌ | ✅ | ❌ | ✅ | ✅ |

---

## 11. Hub projet / dossier

| Champ | Valeur |
|---|---|
| **Concept** | Dossier collaborateur |
| **Onglets** | Fiche / Cycle (timeline des prestations passées et en cours) / Tâches / Discussions / Fichiers |
| **Code dossier** | `<format ? ex. RH-2026-0001 ou matricule SILAE>` |
| **Visibilité** | Restreinte aux RH + Audrey + manager direct |

---

## 12. Intégrations externes

| Outil | Pour quoi ? | Sens | Statut |
|---|---|---|---|
| Lucca | Source des collaborateurs | lecture | déjà partielle dans l'app |
| SILAE | Fiche paie | écriture (création fiche) | à faire |
| Vaultwarden | Création mot de passe | écriture | à faire |
| AD / Entra | Droits réseau | écriture | à faire |
| Yooz | Compte comptable | écriture | à faire |
| Letsignit | Signature mail | écriture | à faire |

---

## 13. Points en suspens / questions

- [ ] **Reset à zéro** : on supprime toutes les anciennes données RH existantes ?
- [ ] **Confidentialité** : où stocker les pièces sensibles (contrat, RIB, copie CNI) ? Bucket Supabase Storage avec RLS très stricte ?
- [ ] **Ordre des sous-tâches** : parallèles ou séquentielles ? Ex. faut-il que « Contrat de travail » soit signé avant que « Création compte Mail » démarre ?
- [ ] **Durées** : non spécifiées dans l'Excel — à fixer pour le plan de charge
- [ ] **Notification J-3** : déclencher comment ? Cron edge function ?
- [ ] **Pour MUTATION/PROMOTION** : qui peut être demandeur (manager actuel ? manager nouveau ? RH ?)
- [ ] **DELEGATION** : que se passe-t-il si Audrey est absente ? Qui valide à sa place ? RH suppléant ?

---

## 14. Décisions techniques (à remplir par dev)

- Tables : nouvelle table `hr_dossiers` (collaborateur cible) + réutilisation de `tasks` pour les sous-tâches
- `process_templates` à créer : 4 (ONBOARDING, OFFBOARDING, MUTATION, PROMOTION)
- `sub_process_templates` à créer : ≈ 50 (toutes les sous-tâches listées ci-dessus)
- Migrations : `<numéros>`
- Routes : `/rh/dossiers`, `/rh/dossiers/<id>`
- Hooks : `<…>`
