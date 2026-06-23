/**
 * useBECapacityMatrix — matrice de plan de charge du Bureau d'Études.
 * Par collaborateur BE × mois :
 *   - capacité  = jours ouvrés − fériés − congés
 *   - réel      = temps Lucca déclaré (lucca_saisie_temps) / 8
 *   - projeté   = tâches BE ouvertes, effort = duration_hours ou, à défaut,
 *                 le référentiel sub_process_templates.default_duration_hours / 8
 *   - écart     = capacité − projeté
 *
 * + détail par affaire/projet (projeté tâches + réel Lucca) pour chaque
 *   collaborateur, pour expansion dans l'UI.
 *
 * 100 % client-side à partir de tables existantes (aucune migration).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- tables BE/Lucca hors types générés Supabase */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfMonth, endOfMonth, addMonths, eachDayOfInterval, isWeekend, format, parseISO,
} from 'date-fns';

const sb = supabase as any;
const BE_GROUP_ID = '301ffee1-718f-42af-aec0-545cf4765ffa';
const HORIZON_MONTHS = 12;

export interface BECapacityCell { capacity: number; reel: number; projete: number; ecart: number; }
/** Détail d'une affaire/projet pour un collaborateur (projeté + réel par mois). */
export interface BEDetailRow {
  key: string;
  code: string;          // code affaire / site
  projet: string;        // nom du projet
  byYm: Record<string, { projete: number; reel: number }>;
  totalProjete: number;
  totalReel: number;
}
export interface BECapacityRow {
  user_id: string;
  name: string;
  poste: string | null;
  cells: Record<string, BECapacityCell>;
  detail: BEDetailRow[];
}
export interface BECapacityMatrix {
  months: { ym: string; label: string }[];
  rows: BECapacityRow[];
}

const ym = (d: Date) => format(d, 'yyyy-MM');
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

export function useBECapacityMatrix() {
  const [matrix, setMatrix] = useState<BECapacityMatrix>({ months: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const first = startOfMonth(new Date());
      const monthsDates = Array.from({ length: HORIZON_MONTHS }, (_, i) => addMonths(first, i));
      const months = monthsDates.map((d) => ({ ym: ym(d), label: format(d, 'MMM yy') }));
      const horizonStart = first;
      const horizonEnd = endOfMonth(monthsDates[monthsDates.length - 1]);
      const monthYms = months.map((m) => m.ym);
      const currentYm = months[0].ym;

      // 1) Staff BE (membres du groupe BE) + profils.
      const { data: members } = await sb.from('collaborator_group_members').select('user_id').eq('group_id', BE_GROUP_ID);
      const ids: string[] = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
      if (ids.length === 0) { setMatrix({ months, rows: [] }); return; }
      const { data: profs } = await sb.from('profiles').select('id, display_name, be_poste').in('id', ids);
      const profById = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));

      // 2) Fériés + congés.
      const { data: hol } = await sb.from('holidays').select('date')
        .gte('date', dayKey(horizonStart)).lte('date', dayKey(horizonEnd));
      const holidaySet = new Set<string>((hol ?? []).map((h: any) => String(h.date).slice(0, 10)));
      const { data: leaves } = await sb.from('user_leaves').select('user_id, start_date, end_date, status')
        .in('user_id', ids).neq('status', 'cancelled')
        .lte('start_date', dayKey(horizonEnd)).gte('end_date', dayKey(horizonStart));

      // 3) Temps réel Lucca (avec code_site pour le détail).
      const { data: temps } = await sb.from('lucca_saisie_temps').select('user_id, date_saisie, duree_heures, code_site')
        .in('user_id', ids).gte('date_saisie', dayKey(horizonStart)).lte('date_saisie', dayKey(horizonEnd));

      // 4) Tâches BE ouvertes (charge projetée) avec affaire/projet.
      const { data: tasks } = await sb.from('tasks')
        .select('assignee_id, due_date, duration_hours, source_sub_process_template_id, be_affaire_id, be_project_id')
        .eq('module_code', 'be')
        .in('assignee_id', ids)
        .not('be_status', 'in', '("cloturee")')
        .not('status', 'in', '("cancelled","done","validated")');

      // Référentiel durée par prestation (fallback).
      const spIds = Array.from(new Set((tasks ?? []).map((t: any) => t.source_sub_process_template_id).filter(Boolean)));
      const defaultHoursBySp = new Map<string, number>();
      if (spIds.length > 0) {
        const { data: sps } = await sb.from('sub_process_templates').select('id, default_duration_hours').in('id', spIds);
        for (const s of sps ?? []) defaultHoursBySp.set(s.id, Number(s.default_duration_hours) || 0);
      }

      // 5) Référentiel affaires/projets pour résoudre les libellés du détail.
      const { data: affaires } = await sb.from('be_affaires').select('id, code_affaire, be_project_id, libelle');
      const { data: projects } = await sb.from('be_projects').select('id, nom_projet, code_projet');
      const projById = new Map<string, any>((projects ?? []).map((p: any) => [p.id, p]));
      const affById = new Map<string, any>((affaires ?? []).map((a: any) => [a.id, a]));
      const affByCode = new Map<string, any>((affaires ?? []).map((a: any) => [String(a.code_affaire), a]));

      const resolveDetail = (code: string): { projet: string } => {
        const aff = affByCode.get(code);
        if (aff) {
          const proj = aff.be_project_id ? projById.get(aff.be_project_id) : null;
          return { projet: proj?.nom_projet ?? aff.libelle ?? code };
        }
        return { projet: code };
      };

      // ── Capacité par mois (jours ouvrés − fériés).
      const openDaysByMonth = new Map<string, number>();
      for (const d of monthsDates) {
        const days = eachDayOfInterval({ start: startOfMonth(d), end: endOfMonth(d) });
        const open = days.filter((day) => !isWeekend(day) && !holidaySet.has(dayKey(day))).length;
        openDaysByMonth.set(ym(d), open);
      }
      // Congés (jours ouvrés) par user × mois.
      const leaveDaysByUserMonth = new Map<string, number>();
      for (const lv of leaves ?? []) {
        const s = parseISO(String(lv.start_date).slice(0, 10));
        const e = parseISO(String(lv.end_date).slice(0, 10));
        const range = eachDayOfInterval({ start: s < horizonStart ? horizonStart : s, end: e > horizonEnd ? horizonEnd : e });
        for (const day of range) {
          if (isWeekend(day) || holidaySet.has(dayKey(day))) continue;
          const k = `${lv.user_id}|${ym(day)}`;
          leaveDaysByUserMonth.set(k, (leaveDaysByUserMonth.get(k) ?? 0) + 1);
        }
      }

      // ── Détail par user → key (affaire/projet) → mois → {projete, reel}
      type Acc = Map<string, Map<string, { projete: number; reel: number; code: string }>>;
      const detailAcc: Map<string, Acc> = new Map();
      const ensure = (uid: string, key: string, m: string, code: string) => {
        let byKey = detailAcc.get(uid);
        if (!byKey) { byKey = new Map(); detailAcc.set(uid, byKey); }
        let byYm = byKey.get(key);
        if (!byYm) { byYm = new Map(); byKey.set(key, byYm); }
        let cell = byYm.get(m);
        if (!cell) { cell = { projete: 0, reel: 0, code }; byYm.set(m, cell); }
        return cell;
      };

      // Réel par user × mois (+ détail par code_site).
      const reelByUserMonth = new Map<string, number>();
      for (const t of temps ?? []) {
        const m = String(t.date_saisie).slice(0, 7);
        if (!monthYms.includes(m)) continue;
        const j = (Number(t.duree_heures) || 0) / 8;
        reelByUserMonth.set(`${t.user_id}|${m}`, (reelByUserMonth.get(`${t.user_id}|${m}`) ?? 0) + j);
        const code = String(t.code_site ?? '').trim() || '—';
        ensure(t.user_id, code, m, code).reel += j;
      }

      // Projeté par user × mois (+ détail par affaire/projet). Sans échéance / en retard → mois courant.
      const projByUserMonth = new Map<string, number>();
      for (const t of tasks ?? []) {
        if (!t.assignee_id) continue;
        const effortH = (Number(t.duration_hours) || 0) || defaultHoursBySp.get(t.source_sub_process_template_id) || 0;
        if (effortH <= 0) continue;
        let m = t.due_date ? String(t.due_date).slice(0, 7) : currentYm;
        if (!monthYms.includes(m)) m = currentYm;
        const j = effortH / 8;
        projByUserMonth.set(`${t.assignee_id}|${m}`, (projByUserMonth.get(`${t.assignee_id}|${m}`) ?? 0) + j);
        const aff = t.be_affaire_id ? affById.get(t.be_affaire_id) : null;
        const code = aff ? String(aff.code_affaire) : (t.be_project_id ? `P:${t.be_project_id}` : '—');
        ensure(t.assignee_id, code, m, aff ? String(aff.code_affaire) : '—').projete += j;
      }

      const rows: BECapacityRow[] = ids.map((uid) => {
        const p = profById.get(uid);
        const cells: Record<string, BECapacityCell> = {};
        for (const m of months) {
          const capacity = Math.max(0, (openDaysByMonth.get(m.ym) ?? 0) - (leaveDaysByUserMonth.get(`${uid}|${m.ym}`) ?? 0));
          const reel = reelByUserMonth.get(`${uid}|${m.ym}`) ?? 0;
          const projete = projByUserMonth.get(`${uid}|${m.ym}`) ?? 0;
          cells[m.ym] = { capacity, reel, projete, ecart: capacity - projete };
        }
        // Détail
        const detail: BEDetailRow[] = [];
        const byKey = detailAcc.get(uid);
        if (byKey) {
          for (const [key, byYm] of byKey) {
            const code = [...byYm.values()][0]?.code ?? key;
            const projetKey = key.startsWith('P:') ? key.slice(2) : null;
            const projet = projetKey
              ? (projById.get(projetKey)?.nom_projet ?? code)
              : resolveDetail(code).projet;
            const row: BEDetailRow = { key, code: code === '—' ? '—' : code, projet, byYm: {}, totalProjete: 0, totalReel: 0 };
            for (const [m, v] of byYm) {
              row.byYm[m] = { projete: v.projete, reel: v.reel };
              row.totalProjete += v.projete;
              row.totalReel += v.reel;
            }
            detail.push(row);
          }
          detail.sort((a, b) => (b.totalProjete + b.totalReel) - (a.totalProjete + a.totalReel));
        }
        return { user_id: uid, name: p?.display_name ?? '—', poste: p?.be_poste ?? null, cells, detail };
      }).filter((r) => r.name !== '—' || Object.values(r.cells).some((c) => c.reel > 0 || c.projete > 0))
        .sort((a, b) => a.name.localeCompare(b.name));

      setMatrix({ months, rows });
    } catch (e) {
      console.error('[useBECapacityMatrix]', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { matrix, isLoading, refetch: fetch };
}
