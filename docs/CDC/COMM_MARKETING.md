# CDC — Module `Comm / Marketing`

> Rétro-documenté le 2026-06-12 depuis les listes SharePoint réelles
> (`KEON_COM-MKTG_DEMANDES.csv` + `KEON_COM-MKTG_STAND.csv`).
> Statut : module **en pause** (décision 2026-06-12) — ce CDC sert de base
> si la phase est relancée. À VALIDER avec le service Comm avant tout dev.

---

## 1. Identité du module

| Champ | Valeur |
|---|---|
| **Nom métier** | Communication & Marketing |
| **Code court** | `comm` (route `/comm/*`) |
| **Service responsable** | Communication et Marketing (dept `894745be-…`) |
| **Prestations** | 2 : Demande Com/Marketing générique + Réservation stand nomade |
| **Process IDs réservés** | `…1401` (Marketing) / `…1402` (Stand) — supprimés de la base, à re-seeder |

---

## 2. Prestation 1 — Demande Com/Marketing (liste DEMANDES)

### Champs du formulaire actuel (SharePoint)

| Champ | Type | Obligatoire | Valeurs |
|---|---|---|---|
| FILIALE | choice | OUI | KEON, KEON.CO, KEON.BIO, TERGREEN, NASKEO, SYCOMORE, TEIKEI, CAPCOO, GO PEI, AUTRES |
| DEMANDEUR | user | OUI | |
| NOM DU PROJET | text | non | |
| TYPE DE DEMANDE | choice | non | SALON, INAUGURATION, CAMPAGNE, DIGITAL, PRINT, GOODIES, ÉVÈNEMENT, RÉSEAUX SOCIAUX, LOGOS, VIDÉO |
| OBJECTIF | note | non | |
| CIBLE | note | non | |
| DESCRIPTION DU BESOIN | note | non | |
| CONTRAINTES | note | non | |
| DATE DEMANDE | date | non | |
| DATE DE RENDU SOUHAITEE | date | non | |

### Champs de pilotage (côté Comm)

| Champ | Type | Valeurs |
|---|---|---|
| ATTRIBUTION | user | membre de l'équipe Comm |
| PRIORITE | choice | PAS DE PRIORITE, PRIORITE MOYENNE, PRIORITE HAUTE, EN RETARD, STAND-BY |
| DATE DE RENDU FIXEE | date | |
| DESCRIPTION/COMMENTAIRES | note | journal de suivi libre (très utilisé) |
| **ETAT AVANCEMENT PROD** | choice | BRIEF → CONCEPTION → CREATION → PRODUCTION → RECETTE → LIVRAISON → TERMINE |
| ETAT AVANCEMENT FINANCE | choice | BDC-OK, FACTURE-OK, PAIEMENT-OK, LITIGE |
| Dates par étape | date ×7 | DATE DE BRIEF / CONCEPTION / CREATION / PRODUCTION / RECETTE / TERMINEE / LIVRAISON |

> **Lecture des données réelles** : la liste sert surtout de kanban de production
> pour l'équipe Comm (3 attributaires : Diane, Chloé, Géraldine), avec un
> journal libre par projet. Le workflow cible = statuts PROD (7 états)
> + suivi finance séparé. Beaucoup de lignes sans dates ni priorité →
> prévoir des valeurs par défaut souples.

## 3. Prestation 2 — Réservation stand nomade (liste STAND)

| Champ | Type | Obligatoire | Valeurs / notes |
|---|---|---|---|
| NOM DU SALON | choice + saisie libre | OUI | ~22 salons prédéfinis (INNOV-AGRI, ENERGAïA, FOIRE DE CHALONS…) |
| DATE DE LA DEMANDE | date | OUI | défaut = aujourd'hui |
| DATE DEBUT / FIN DE SALON | date ×2 | OUI | |
| RESPONSABLE SALON | user | OUI | |
| Mode de récupération du stand | choice | OUI | A ENVOYER / A RECUPERER A BGN |
| ADRESSE D'ENVOI DU STAND | location | si « A ENVOYER » | |
| DATE RECEPTION STAND SOUHAITEE | date | OUI | |
| COLLABORATEUR QUI VA RECUPERER LE STAND | user | si « A RECUPERER A BGN » | |
| DATE DE RECEPTION A BGN | date | non | |
| COLLABORATEUR RESPONSABLE DU RETOUR | user | OUI | |
| MODE DE RETOUR DU STAND | choice | OUI | TRANSPORTEUR / DEPOT BGN |
| KIT OPERATIONNEL | bool | OUI | machine à café, ecocups… (défaut oui) — inventaire piloté par le responsable salon à chaque fin de salon |
| GOODIES — STYLO / SEAUX | nombre ×2 | OUI | quantités souhaitées |
| PLAQUETTES ×6 | nombre ×6 | OUI | GROUPE KEON, GUIDE PRATIQUE, METHA & BIODECHETS, TERGREEN, NSK MONOMETHA, NASKEO |
| REMARQUES PARTICULIERES | note | non | |

## 4. À trancher avec le service Comm avant dev

- [ ] Qui peut déposer ? (toutes filiales a priori — contrairement au RH)
- [ ] Les 7 états PROD deviennent-ils les `request_states` du flux, ou
      mappe-t-on sur le pattern standard tâches/validations ?
- [ ] Sous-tâches auto à la création ? (le flux actuel n'en crée pas pour
      DEMANDES — c'est de l'attribution manuelle ; STAND pourrait en générer :
      préparation kit, plaquettes, transport aller, transport retour, inventaire)
- [ ] Liste des salons : table de référence administrable ou saisie libre ?
- [ ] Suivi finance (BDC/facture/paiement) : dans ce module ou lié au budget ?
