/**
 * Shared constants and types for the Innovation module
 */

export const INNOVATION_PROCESS_ID = 'a1b2c3d4-0000-4000-a000-000000000001';

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  todo: { label: 'Soumise', color: 'hsl(210 80% 55%)' },
  'in-progress': { label: 'En instruction', color: 'hsl(40 90% 50%)' },
  pending_validation_1: { label: 'En validation', color: 'hsl(270 60% 55%)' },
  validated: { label: 'Validée', color: 'hsl(140 60% 45%)' },
  refused: { label: 'Refusée', color: 'hsl(0 70% 50%)' },
  done: { label: 'Terminée', color: 'hsl(140 70% 40%)' },
  cancelled: { label: 'Annulée', color: 'hsl(0 0% 60%)' },
};

export const GROUPING_FIELDS = [
  { value: 'status', label: 'Statut' },
  { value: 'entite_concernee', label: 'Entité' },
  { value: 'code_projet', label: 'Code projet' },
  { value: 'usage_inno', label: 'Usage' },
  { value: 'requester_name', label: 'Demandeur' },
] as const;

export type GroupingField = typeof GROUPING_FIELDS[number]['value'];

export interface InnoRequest {
  id: string;
  title: string;
  status: string;
  priority: string;
  request_number: string | null;
  created_at: string;
  updated_at: string;
  requester_name: string;
  // Custom field values (flattened)
  nom_projet: string;
  code_projet: string;
  descriptif: string;
  commentaire_demande: string;
  entite_concernee: string;
  usage_inno: string;
  etiquettes: string;
  sponsor: string;
}

export interface InnoFilters {
  search: string;
  status: string;
  entite: string;
  codeProjet: string;
  usage: string;
  dateFrom?: Date;
  dateTo?: Date;
}
