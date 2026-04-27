import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { TemplateCustomField } from '@/types/customField';

export const SECONDARY_ECHEANCE_PAIR_KEY = 'secondary_echeance_pair' as const;

export type SecondaryEcheancePairRole = 'due_date' | 'service';

export interface SecondaryEcheancePairMeta {
  role: SecondaryEcheancePairRole;
  partner_field_id: string;
}

export function parseSecondaryEcheancePair(
  field: Pick<TemplateCustomField, 'validation_params'>
): SecondaryEcheancePairMeta | null {
  const raw = field.validation_params?.[SECONDARY_ECHEANCE_PAIR_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const role = (raw as { role?: string }).role;
  const partner_field_id = (raw as { partner_field_id?: string }).partner_field_id;
  if (role !== 'due_date' && role !== 'service') return null;
  if (!partner_field_id || typeof partner_field_id !== 'string') return null;
  return { role, partner_field_id };
}

export function getSecondaryEcheancePartnerFieldId(
  field: Pick<TemplateCustomField, 'validation_params'>
): string | null {
  return parseSecondaryEcheancePair(field)?.partner_field_id ?? null;
}

/** IDs to remove when deleting a field that may be half of a secondary pair. */
export function idsToDeleteIncludingSecondaryEcheancePartner(
  field: Pick<TemplateCustomField, 'id' | 'validation_params'>
): string[] {
  const partner = getSecondaryEcheancePartnerFieldId(field);
  if (partner && partner !== field.id) {
    return [field.id, partner];
  }
  return [field.id];
}

/**
 * Inserts "Service secondaire" (department_search) and "Échéance secondaire" (date),
 * same row, linked via validation_params.
 */
export async function insertSecondaryEcheancePair(
  supabase: SupabaseClient<Database>,
  params: {
    created_by: string | null;
    process_template_id: string | null;
    sub_process_template_id: string | null;
    section_id: string | null;
    row_index: number;
    order_index_base: number;
  }
): Promise<{ serviceFieldId: string; dueDateFieldId: string }> {
  const {
    created_by,
    process_template_id,
    sub_process_template_id,
    section_id,
    row_index,
    order_index_base,
  } = params;

  const ts = Date.now();

  const baseShared = {
    is_common: false,
    created_by,
    process_template_id,
    sub_process_template_id,
    section_id,
    row_index,
  };

  const serviceInsert = {
    ...baseShared,
    name: `service_secondaire_${ts}`,
    label: 'Service secondaire',
    field_type: 'department_search' as const,
    description:
      "Service concerné par l'échéance secondaire (distinct du service demandeur / cible principal).",
    is_required: true,
    column_span: 1,
    column_index: 0,
    order_index: order_index_base,
    validation_params: null as Record<string, unknown> | null,
  };

  const { data: svc, error: errSvc } = await supabase
    .from('template_custom_fields')
    .insert(serviceInsert)
    .select('id')
    .single();

  if (errSvc) throw errSvc;
  if (!svc?.id) throw new Error("Échec de la création du champ « Service secondaire »");

  const dueInsert = {
    ...baseShared,
    name: `echeance_secondaire_${ts}`,
    label: 'Échéance secondaire',
    field_type: 'date' as const,
    description: 'Date limite pour la réalisation par le service secondaire sélectionné.',
    is_required: true,
    column_span: 1,
    column_index: 1,
    order_index: order_index_base + 1,
    validation_params: {
      [SECONDARY_ECHEANCE_PAIR_KEY]: {
        role: 'due_date' as const,
        partner_field_id: svc.id,
      },
    },
  };

  const { data: due, error: errDue } = await supabase
    .from('template_custom_fields')
    .insert(dueInsert)
    .select('id')
    .single();

  if (errDue) {
    await supabase.from('template_custom_fields').delete().eq('id', svc.id);
    throw errDue;
  }
  if (!due?.id) {
    await supabase.from('template_custom_fields').delete().eq('id', svc.id);
    throw new Error("Échec de la création du champ « Échéance secondaire »");
  }

  const { error: errUpd } = await supabase
    .from('template_custom_fields')
    .update({
      validation_params: {
        [SECONDARY_ECHEANCE_PAIR_KEY]: {
          role: 'service' as const,
          partner_field_id: due.id,
        },
      },
    })
    .eq('id', svc.id);

  if (errUpd) {
    await supabase.from('template_custom_fields').delete().in('id', [svc.id, due.id]);
    throw errUpd;
  }

  return { serviceFieldId: svc.id, dueDateFieldId: due.id };
}
