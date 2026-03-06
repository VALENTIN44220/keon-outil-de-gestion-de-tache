import { QUESTIONS } from './questionnaireConfig';

/**
 * Questionnaire select-type fields usable as filters and Kanban grouping options.
 * Each entry maps a champ_id to its display label and known options.
 */
export interface QuestionnaireFilterField {
  champ_id: string;
  label: string;
  shortLabel: string;
  options: string[];
  pilier: string;
}

export const QUESTIONNAIRE_FILTER_FIELDS: QuestionnaireFilterField[] = QUESTIONS
  .filter(q => q.type === 'select' && q.options && q.options.length > 0)
  .map(q => ({
    champ_id: q.champ_id,
    label: q.label,
    shortLabel: q.label.length > 25 ? q.label.substring(0, 22) + '…' : q.label,
    options: q.options!,
    pilier: q.pilier,
  }));

/** Key prefix used in ProjectFiltersState for questionnaire filters */
export const QST_FILTER_PREFIX = 'qst_';

/** Build the filter state key from a champ_id */
export function qstFilterKey(champId: string): string {
  return `${QST_FILTER_PREFIX}${champId}`;
}
