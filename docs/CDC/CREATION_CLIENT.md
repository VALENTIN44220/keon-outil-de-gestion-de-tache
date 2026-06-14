# CDC — Module `Création client / affaire`

> Rétro-documenté le 2026-06-13 depuis le flux Power Automate
> `Créationclient_*.zip` (def d8c665ef-…) + la liste SharePoint
> `DEMANDE_CREATION_CLIENT_AFFAIRE.csv`. Spec de référence pour bâtir le
> module dans l'app (pattern demande + approbations séquentielles).

## 1. Identité
| Champ | Valeur |
|---|---|
| Nom métier | Création client (et affaire associée) |
| Code court | `client` (route `/client/*`) — à confirmer |
| Déclencheur | Demande déposée (toutes filiales / commerciaux) |

## 2. Formulaire (champs de la liste SharePoint)
| Champ | Type | Obligatoire | Valeurs |
|---|---|---|---|
| DEMANDEUR | user | OUI | auto |
| NOM DU CLIENT (raison sociale) | text | — | nom K-BIS |
| ADRESSE DU SIEGE | note | — | |
| N° SIRET DU SIEGE | text | — | |
| N° TVA | text | — | |
| CONTACT FACTURATION | text | — | |
| DEVISE (si ≠ EUR) | text | — | |
| NAF DU SIEGE | text | — | |
| PARC / HORS PARC | choice | — | HP (hors parc KEON) / NA / nsk (parc Naskeo) / TG (parc Ter'Green) |
| ORIGINE | choice | OUI | APPEL / APPORT / BAO / BE-AMO / AMO / INCONNUE / INTERNE / PUBLI / SALON / AUTRES |
| COMMERCIAL | user | — | |
| CODE SITE | text | OUI | |
| CODE AFFAIRE A CREER | text | — | **si renseigné → déclenche l'étape 3 (création affaire)** |
| CODE PROSPECT | text | — | |
| PROSPECT (oui/non) | choice | — | Oui / Non |
| Pièces jointes | files | — | K-BIS, etc. |

## 3. Workflow — 3 approbations SÉQUENTIELLES

| # | Étape | Approbateurs | Réponses | Sortie |
|---|---|---|---|---|
| 1 | **Contrôle CRM** | Hugues MOLTO, Valentin BERTRAND, Diane MANGIN | `CONTROLE CRM OK` / `REFUS CONTROLE CRM` | si OK → étape 2, sinon fin (refusée) |
| 2 | **Contrôle Compta** (si CRM OK) | Mélanie SAEZ, Corinne BEUTIER, Shnorh DEMIRDJI | `CLIENT CREE` / `REFUS` | le valideur **saisit le CODE CLIENT en commentaire** ; si CLIENT CREE → étape 3 (si code affaire demandé), sinon fin |
| 3 | **Création affaire** (si Compta OK ET « code affaire à créer » renseigné) | Sophea TIM (Naskeo) | `AFFAIRE CREE` / `REFUS` | le valideur **saisit le CODE AFFAIRE en commentaire** ; fin |

- Notifications par email à chaque étape ; réassignation autorisée (enableReassignment).
- Le titre des approbations : « DEMANDE CREATION CLIENT - <NOM CLIENT> - <ÉTAPE> ».

## 4. Implémentation app proposée (à valider)
Pattern = process_template « Création client » + 3 **sous-processus séquentiels**
(order_index 0/1/2, `start_mode` enchaîné comme le BE), chacun en affectation
**groupe** (les 3 groupes d'approbateurs) :
- Groupe « Contrôle CRM » (Hugues, Valentin, Diane)
- Groupe « Contrôle Compta client » (Mélanie, Corinne, Shnorh)
- Affaire : Sophea Tim (personne)

Chaque étape = une tâche d'approbation (valider/refuser) ; le code client /
code affaire saisis via un champ ou le commentaire de validation.

### À trancher avant de coder
- [ ] Code court / route (`/client/dispatch` + `/client/new` ?) et permission `can_access_client` ?
- [ ] Étape 3 conditionnelle : on ne spawn la tâche affaire que si « code affaire à créer » est rempli (logique à mettre dans le trigger ou à l'app).
- [ ] Où stocker le CODE CLIENT et le CODE AFFAIRE retournés ? (champ dédié sur la demande, alimenté à la validation de l'étape 2/3.)
- [ ] Sophea Tim, Shnorh Demirdji : vérifier qu'ils ont un profil dans l'app.
