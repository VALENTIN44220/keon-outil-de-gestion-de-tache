/**
 * Types & référentiels du module « Situations à risque » (COPIL SST).
 * Reproduit la liste SharePoint « REMONTEES DES SITUATIONS A RISQUES ».
 */

export const SST_TYPES = [
  'Accident avec AT',
  'Accident sans AT',
  'Presque accident',
  'Situation à risque',
  "Axe d'amélioration",
  'Action COPIL SST',
  'Incident site',
] as const;

export const SST_SOCIETES = [
  'KEON', 'NASKEO', 'SYCOMORE', 'TERGREEN', 'KEON.BIO', 'TEIKEI',
  'AUNIS BIOGAZ', 'DOLE BIOGAZ', 'CERES', 'LES 3 DÔMES', 'AKENE 45', 'ELEMANTERRE', 'Autre',
] as const;

export const SST_SERVICES = [
  'Réalisation', 'Exploitation', 'Maintenance', 'Commerce', 'Approvisionnement',
  'Laboratoire', 'Logistique/pièce', 'Sous-traitance', 'Tous les services', 'Autres service KEON',
] as const;

export const SST_LIEUX = ['Route', 'Site', 'Agence'] as const;
export const SST_ARBRE_CAUSES = ['A FAIRE', 'PLANIFIER', 'REALISE', 'NC'] as const;
export const SST_ETATS = ['A TRAITER', 'EN COURS', 'VALIDE'] as const;

/** Couleur de pastille par type de situation (calqué sur SharePoint). */
export const SST_TYPE_COLORS: Record<string, string> = {
  'Accident avec AT': 'bg-blue-100 text-blue-800 border-blue-300',
  'Accident sans AT': 'bg-amber-100 text-amber-800 border-amber-300',
  'Presque accident': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Situation à risque': 'bg-orange-100 text-orange-800 border-orange-300',
  "Axe d'amélioration": 'bg-rose-100 text-rose-800 border-rose-300',
  'Action COPIL SST': 'bg-green-100 text-green-800 border-green-300',
  'Incident site': 'bg-red-100 text-red-800 border-red-300',
};

export const SST_ETAT_COLORS: Record<string, string> = {
  'A TRAITER': 'bg-red-100 text-red-800 border-red-300',
  'EN COURS': 'bg-amber-100 text-amber-800 border-amber-300',
  'VALIDE': 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

export interface SituationRisque {
  id: string;
  date_evenement: string;
  type_situation: string;
  titre: string | null;
  societe: string | null;
  service: string | null;
  projet: string | null;
  lieu_environnement: string | null;
  circonstances: string | null;
  lesions: string | null;
  victime_keon_id: string | null;
  victime_externe: string | null;
  temoin_id: string | null;
  action: string | null;
  arbre_causes: string | null;
  etat_avancement: string;
  validation_codir: string | null;
  declarant_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
