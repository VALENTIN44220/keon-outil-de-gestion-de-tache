import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { parseSecondaryEcheancePair } from '@/lib/secondaryEcheancePair';

function toDateYmd(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  const head = s.includes('T') ? s.split('T')[0]! : s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  return head;
}

function toDepartmentId(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return s;
  }
  return null;
}

type FieldRow = {
  id: string;
  field_type: string;
  validation_params: Record<string, unknown> | null;
};

/**
 * Lit service secondaire + échéance secondaire dans les valeurs de formulaire,
 * d'après les champs modèle du processus / sous-processus marqués par le couple.
 */
export async function resolveSecondaryEcheanceLaneFromForm(
  supabase: SupabaseClient<Database>,
  options: {
    processTemplateId: string;
    subProcessTemplateId?: string | null;
    customFieldValues?: Record<string, unknown> | null;
  }
): Promise<{ departmentId: string; dueDateYmd: string } | null> {
  const { processTemplateId, subProcessTemplateId, customFieldValues } = options;
  if (!customFieldValues || Object.keys(customFieldValues).length === 0) return null;

  const { data: processLevel, error: e1 } = await supabase
    .from('template_custom_fields')
    .select('id, field_type, validation_params')
    .eq('process_template_id', processTemplateId)
    .is('sub_process_template_id', null);

  if (e1) {
    console.warn('[secondaryEcheance] lecture champs process', e1);
  }

  let rows: FieldRow[] = [...(processLevel || [])];

  if (subProcessTemplateId) {
    const { data: subLevel, error: e2 } = await supabase
      .from('template_custom_fields')
      .select('id, field_type, validation_params')
      .eq('sub_process_template_id', subProcessTemplateId);

    if (e2) {
      console.warn('[secondaryEcheance] lecture champs sous-processus', e2);
    } else if (subLevel?.length) {
      const seen = new Set(rows.map((r) => r.id));
      for (const r of subLevel) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          rows.push(r);
        }
      }
    }
  }

  let dueFieldId: string | null = null;
  let serviceFieldId: string | null = null;

  for (const row of rows) {
    const meta = parseSecondaryEcheancePair(row);
    if (meta?.role === 'due_date') {
      dueFieldId = row.id;
      serviceFieldId = meta.partner_field_id;
      break;
    }
  }

  if (!dueFieldId || !serviceFieldId) return null;

  const dueYmd = toDateYmd(customFieldValues[dueFieldId]);
  const deptId = toDepartmentId(customFieldValues[serviceFieldId]);

  if (!dueYmd || !deptId) return null;

  return { departmentId: deptId, dueDateYmd: dueYmd };
}
