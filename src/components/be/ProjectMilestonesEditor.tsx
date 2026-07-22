/**
 * ProjectMilestonesEditor — édition des dates de jalons d'un projet, basée sur
 * le référentiel be_milestone_types (donc SYNCHRONISÉE avec la Synthèse jalons).
 *
 * Chaque type de jalon a un champ date : une date saisie = jalon réalisé
 * (date_reelle) via upsert dans be_project_milestones (type_code). Les 4 dates
 * natives de be_projects (OS, clôtures) sont affichées et surchargées par un
 * jalon si édité. Régime-aware : jalons ICPE non pertinents marqués « n/a ».
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface MType { code: string; label: string; category: string; ordre: number; }

const ICPE_TYPES = ['icpe_depot', 'icpe_completude', 'icpe_arrete', 'icpe_purge'];
const ICPE_BY_REGIME: Record<string, string[]> = {
  declaration:    ['icpe_depot', 'icpe_completude', 'icpe_purge'],
  enregistrement: ['icpe_depot', 'icpe_completude', 'icpe_arrete', 'icpe_purge'],
  autorisation:   ['icpe_depot', 'icpe_arrete', 'icpe_purge'],
};
function regimeKey(r: string | null): string | null {
  if (!r) return null;
  const s = r.toLowerCase();
  if (s.startsWith('déc') || s.startsWith('dec')) return 'declaration';
  if (s.startsWith('enreg')) return 'enregistrement';
  if (s.startsWith('autor')) return 'autorisation';
  return null;
}
function isApplicable(regime: string | null, code: string): boolean {
  if (!ICPE_TYPES.includes(code)) return true;
  const k = regimeKey(regime);
  if (!k) return true;
  return ICPE_BY_REGIME[k].includes(code);
}

const NATIVE_MAP: Record<string, string> = {
  os_etude: 'date_os_etude',
  os_travaux: 'date_os_travaux',
  cloture_bancaire: 'date_cloture_bancaire',
  cloture_juridique: 'date_cloture_juridique',
};
const CAT_LABELS: Record<string, string> = { reglementaire: 'Réglementaire', projet: 'Projet' };

export function ProjectMilestonesEditor({ projectId, regimeIcpe }: {
  projectId: string;
  regimeIcpe: string | null;
}) {
  const [types, setTypes] = useState<MType[]>([]);
  const [dates, setDates] = useState<Record<string, { date: string; prevu: boolean } | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = supabase as any;
    const [t, m, p] = await Promise.all([
      sb.from('be_milestone_types').select('code,label,category,ordre').eq('is_active', true).order('ordre'),
      sb.from('be_project_milestones').select('type_code,date_prevue,date_reelle').eq('be_project_id', projectId),
      sb.from('be_projects').select('date_os_etude,date_os_travaux,date_cloture_bancaire,date_cloture_juridique').eq('id', projectId).maybeSingle(),
    ]);
    setTypes((t.data ?? []) as MType[]);
    const map: Record<string, { date: string; prevu: boolean } | undefined> = {};
    const proj = p.data ?? {};
    for (const [code, col] of Object.entries(NATIVE_MAP)) {
      if (proj[col]) map[code] = { date: String(proj[col]).slice(0, 10), prevu: false };
    }
    for (const row of (m.data ?? [])) {
      if (!row.type_code) continue;
      const d = row.date_reelle ?? row.date_prevue;
      if (!d) continue;
      const prevu = !row.date_reelle;
      const prev = map[row.type_code];
      if (!prev || (prev.prevu && !prevu)) map[row.type_code] = { date: String(d).slice(0, 10), prevu };
    }
    setDates(map);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const setDate = async (t: MType, value: string) => {
    setSavingCode(t.code);
    try {
      const sb = supabase as any;
      const { data: existing } = await sb.from('be_project_milestones')
        .select('id,source_task_id')
        .eq('be_project_id', projectId).eq('type_code', t.code).eq('is_auto_delayed', false)
        .maybeSingle();
      if (!value) {
        if (existing?.id) {
          if (existing.source_task_id) {
            await sb.from('be_project_milestones').update({ date_reelle: null, statut: 'en_cours' }).eq('id', existing.id);
          } else {
            await sb.from('be_project_milestones').delete().eq('id', existing.id);
          }
        }
      } else if (existing?.id) {
        await sb.from('be_project_milestones')
          .update({ date_reelle: value, statut: 'termine', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await sb.from('be_project_milestones').insert({
          be_project_id: projectId, type_code: t.code, titre: t.label,
          date_reelle: value, statut: 'termine', source_task_id: null, is_auto_delayed: false, ordre: t.ordre,
        });
      }
      toast.success(value ? `${t.label} : ${value}` : `${t.label} effacé`);
      await load();
    } catch (e: any) {
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setSavingCode(null);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<string, MType[]>();
    for (const t of types) { if (!g.has(t.category)) g.set(t.category, []); g.get(t.category)!.push(t); }
    return [...g.entries()];
  }, [types]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des jalons…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([cat, list]) => (
        <div key={cat}>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">{CAT_LABELS[cat] ?? cat}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {list.map(t => {
              const applicable = isApplicable(regimeIcpe, t.code);
              const cell = dates[t.code];
              return (
                <div key={t.code} className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm', !applicable && 'text-muted-foreground/40')}>{t.label}</span>
                  {applicable ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="date"
                        value={cell?.date ?? ''}
                        onChange={(e) => void setDate(t, e.target.value)}
                        disabled={savingCode === t.code}
                        className={cn('h-8 w-[150px] text-xs',
                          cell && !cell.prevu && 'border-emerald-300 bg-emerald-50/40',
                          cell && cell.prevu && 'border-amber-300 bg-amber-50/40')}
                      />
                      {savingCode === t.code && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40 w-[150px] text-center" title="Non applicable pour ce régime ICPE">n/a</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Une date saisie = jalon réalisé (date réelle). Synchronisé avec la Synthèse jalons.
      </p>
    </div>
  );
}
