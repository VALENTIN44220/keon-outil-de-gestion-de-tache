/**
 * distributeBESlots — répartit `totalHours` heures de travail prévu en
 * `workload_slots` (demi-journées de 4h) sur les jours ouvrés de
 * [startDate, dueDate].
 *
 * Utilisé lors de l'affectation d'une tâche BE pour matérialiser
 * automatiquement la charge sur le plan de charge.
 *
 * Stratégie V1 :
 * - Replace : on supprime d'abord les slots existants (task_id, user_id) avant
 *   d'insérer (idempotent).
 * - Jours ouvrés = lun-ven (pas de gestion congés/fériés en V1, le module
 *   Workload les gère côté affichage et n'empêche pas la pose).
 * - Si `startDate` est passée → on démarre à aujourd'hui.
 * - Si `dueDate` est manquante → fenêtre de `nbHalfDays` demi-journées
 *   consécutives à partir du début (pas de borne supérieure).
 * - Si la fenêtre est trop courte pour absorber `totalHours`, on pose ce qui
 *   tient et on retourne le nombre d'heures réellement posées.
 *
 * @returns { hoursPlaced, slotsCreated, truncated }
 */
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, isAfter, max as maxDate } from 'date-fns';

const sb = supabase as any;

const SLOT_HOURS = 4;
const HALF_DAYS: ('morning' | 'afternoon')[] = ['morning', 'afternoon'];

export interface DistributeBESlotsInput {
  taskId: string;
  userId: string;
  /** ISO yyyy-MM-dd ou Date. */
  startDate?: string | Date | null;
  /** ISO yyyy-MM-dd ou Date. */
  dueDate?: string | Date | null;
  totalHours: number;
}

export interface DistributeBESlotsResult {
  hoursPlaced: number;
  slotsCreated: number;
  /** true si la fenêtre était trop courte et qu'on n'a pas pu poser toutes les heures. */
  truncated: boolean;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // ISO yyyy-MM-dd → minuit local (évite shift UTC)
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isWeekend(d: Date) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

export async function distributeBESlots(
  input: DistributeBESlotsInput,
): Promise<DistributeBESlotsResult> {
  const { taskId, userId, totalHours } = input;

  if (!totalHours || totalHours <= 0) {
    return { hoursPlaced: 0, slotsCreated: 0, truncated: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rawStart = toDate(input.startDate) ?? today;
  const start = maxDate([rawStart, today]); // pas de slots dans le passé
  const due = toDate(input.dueDate); // peut être null

  const nbHalfDaysNeeded = Math.ceil(totalHours / SLOT_HOURS);

  // 1. Construit la liste des demi-journées candidates (jours ouvrés)
  const candidates: { date: string; halfDay: 'morning' | 'afternoon' }[] = [];
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  // Garde-fou : 6 mois max si pas de dueDate
  const hardCap = addDays(start, 180);

  while (
    candidates.length < nbHalfDaysNeeded &&
    !isAfter(cursor, hardCap) &&
    (!due || !isAfter(cursor, due))
  ) {
    if (!isWeekend(cursor)) {
      for (const hd of HALF_DAYS) {
        candidates.push({ date: format(cursor, 'yyyy-MM-dd'), halfDay: hd });
        if (candidates.length >= nbHalfDaysNeeded) break;
      }
    }
    cursor = addDays(cursor, 1);
  }

  const truncated = candidates.length < nbHalfDaysNeeded;

  // 2. Supprime les slots préexistants pour cette (task, user) pour rester idempotent
  await sb
    .from('workload_slots')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId);

  if (candidates.length === 0) {
    return { hoursPlaced: 0, slotsCreated: 0, truncated };
  }

  // 3. Insère les slots — la dernière ligne peut porter un duration_hours réduit
  //    si totalHours n'est pas un multiple de 4 (ex. 6h → 4h + 2h).
  let remaining = totalHours;
  const rows = candidates.map(({ date, halfDay }) => {
    const dur = Math.min(SLOT_HOURS, remaining);
    remaining -= dur;
    return {
      task_id: taskId,
      user_id: userId,
      date,
      half_day: halfDay,
      duration_hours: dur,
    };
  });

  const { error: insErr } = await sb.from('workload_slots').insert(rows);
  if (insErr) {
    console.error('[distributeBESlots] insert error', insErr);
    throw insErr;
  }

  const hoursPlaced = rows.reduce((s, r) => s + r.duration_hours, 0);
  return { hoursPlaced, slotsCreated: rows.length, truncated };
}

/**
 * Supprime les slots associés à une (task, user) — utilisé lors d'un
 * désassignement.
 */
export async function clearBETaskSlots(taskId: string, userId: string) {
  await sb
    .from('workload_slots')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId);
}
