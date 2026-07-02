import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Scale } from 'lucide-react';
import { computeCapacityMatrix } from '@/lib/fdr/calculationEngine';
import { applyHires, applyProjectOverrides } from '@/lib/fdr/planningSimulation';
import type { FdrEngineSettings, FdrProjectInput } from '@/types/fdr';
import type { FdrHireScenario } from '@/hooks/useFdrHireScenarios';
import { cn } from '@/lib/utils';

const COUT_ETP_DEFAULT = 76865; // €/an pour 1 ETP dev/IA interne
const TJM_ST_DEFAULT = 500;     // €/j sous-traitance

interface Metrics {
  picBrut: number;      // pic mensuel de sous-effectif net (j)
  picLisse: number;     // pic après lissage intra-annuel (j)
  cumul: number;        // sous-effectif net cumulé sur l'horizon (j)
  nOver: number;        // nb de mois > seuil
  abandons: number;     // projets retirés (sur_feuille_de_route:false)
  coutAnnuel: number;   // surcoût annuel (embauche + ST)
  renfort: string;      // libellé du renfort
  byYear: Record<string, number>; // pic net brut par année
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function renfortLabel(s: FdrHireScenario): string {
  const parts: string[] = [];
  for (const h of s.hires ?? []) {
    const etp = Number(h.nb_etp) || 0;
    if (!etp) continue;
    const nom = h.profil_code === 'cp_dev_ia_data' ? 'dev/IA'
      : h.profil_code === 'cp_digital' ? 'digital'
      : h.profil_code === 'resp_it' ? 'resp. IT'
      : h.profil_code;
    const etpStr = etp.toLocaleString('fr-FR');
    parts.push(h.kind === 'sous_traitance' ? `ST ${etpStr} ${nom}` : `+${etpStr} ETP ${nom}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function computeMetrics(
  projects: FdrProjectInput[],
  scenario: FdrHireScenario,
  settings: FdrEngineSettings,
  seuil: number,
): Metrics {
  const JP = settings.jours_productifs_mois || 18;
  const adjustedProjects = applyProjectOverrides(projects, scenario.project_overrides ?? []);
  const matrix = computeCapacityMatrix(adjustedProjects, settings);
  const adj = applyHires(matrix, scenario.hires ?? [], JP);

  const byYearCum: Record<string, number> = {};
  const byYear: Record<string, number> = {};
  let cumul = 0, picBrut = 0, nOver = 0;
  for (const row of adj.cascade) {
    const y = row.ym.slice(0, 4);
    const net = row.sous_effectif_net;
    cumul += Math.max(0, net);
    byYearCum[y] = (byYearCum[y] ?? 0) + Math.max(0, net);
    byYear[y] = Math.max(byYear[y] ?? 0, net);
    if (net > seuil) nOver += 1;
    if (net > picBrut) picBrut = net;
  }
  const picLisse = Math.max(0, ...Object.values(byYearCum).map((v) => v / 12));

  const coutEtp = scenario.assumptions?.cout_annuel_etp_embauche ?? COUT_ETP_DEFAULT;
  const tjm = scenario.assumptions?.tjm_st ?? TJM_ST_DEFAULT;
  let coutAnnuel = 0;
  for (const h of scenario.hires ?? []) {
    const etp = Number(h.nb_etp) || 0;
    if (h.kind === 'sous_traitance') coutAnnuel += etp * tjm * JP * 12;
    else coutAnnuel += etp * coutEtp;
  }

  const abandons = (scenario.project_overrides ?? []).filter((o) => o.sur_feuille_de_route === false).length;

  return { picBrut: r1(picBrut), picLisse: r1(picLisse), cumul: r1(cumul), nOver, abandons, coutAnnuel, renfort: renfortLabel(scenario), byYear };
}

interface Props {
  /** Base de projets RÉELS (chaque scénario applique ses propres overrides). */
  projects: FdrProjectInput[];
  scenarios: FdrHireScenario[];
  settings: FdrEngineSettings;
}

/**
 * Bilan comparatif des scénarios : pour chaque scénario enregistré, synthèse
 * du renfort, du surcoût annuel, des projets abandonnés et du sous-effectif
 * (pic brut vs pic après lissage), plus le pic par année.
 * Se recalcule automatiquement : cocher/décocher un projet dans un scénario
 * (via le comparateur) met à jour ce bilan.
 */
export function FdrScenarioBilan({ projects, scenarios, settings }: Props) {
  const [open, setOpen] = useState(true);
  const seuil = settings.seuil_sous_effectif_jours ?? 5;

  const rows = useMemo(() => {
    if (!scenarios.length) return [];
    return scenarios.map((s) => ({ scenario: s, m: computeMetrics(projects, s, settings, seuil) }));
  }, [projects, scenarios, settings, seuil]);

  // Ensemble des années réellement présentes (à partir des byYear calculés)
  const yearCols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const y of Object.keys(r.m.byYear)) set.add(y);
    return [...set].sort();
  }, [rows]);

  const cellColor = (v: number) =>
    v > seuil ? 'text-red-600 font-semibold'
      : v > seuil * 0.5 ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <Card className="border-border/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Scale className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium">Bilan comparatif des scénarios</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          renfort · surcoût · abandons · sous-effectif (pic brut / lissé)
        </span>
      </button>
      {open && (
        <CardContent className="p-3">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Aucun scénario enregistré. Crée un scénario pour alimenter le bilan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/60">
                    <th className="text-left font-medium p-2 sticky left-0 bg-background">Scénario</th>
                    <th className="text-left font-medium p-2 whitespace-nowrap">Renfort</th>
                    <th className="text-right font-medium p-2 whitespace-nowrap">Surcoût / an</th>
                    <th className="text-center font-medium p-2">Abandons</th>
                    <th className="text-right font-medium p-2 whitespace-nowrap">Pic brut</th>
                    <th className="text-right font-medium p-2 whitespace-nowrap">Pic lissé</th>
                    <th className="text-center font-medium p-2 whitespace-nowrap">Mois &gt; {seuil}j</th>
                    {yearCols.map((y) => (
                      <th key={y} className="text-right font-medium p-2">{y}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ scenario, m }) => (
                    <tr key={scenario.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="p-2 font-medium sticky left-0 bg-background max-w-[220px] truncate" title={scenario.nom}>
                        {scenario.nom}
                      </td>
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{m.renfort}</td>
                      <td className="p-2 text-right whitespace-nowrap tabular-nums">
                        {m.coutAnnuel.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                      </td>
                      <td className="p-2 text-center tabular-nums">
                        {m.abandons > 0 ? <span className="text-red-600 font-semibold">{m.abandons}</span> : '—'}
                      </td>
                      <td className={cn('p-2 text-right tabular-nums', cellColor(m.picBrut))}>{m.picBrut} j</td>
                      <td className={cn('p-2 text-right tabular-nums', cellColor(m.picLisse))}>{m.picLisse} j</td>
                      <td className="p-2 text-center tabular-nums text-muted-foreground">{m.nOver}</td>
                      {yearCols.map((y) => {
                        const v = m.byYear[y] ?? 0;
                        return (
                          <td key={y} className={cn('p-2 text-right tabular-nums', cellColor(v))}>
                            {r1(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            <strong>Pic brut</strong> = pic mensuel de sous-effectif net (dates réelles).{' '}
            <strong>Pic lissé</strong> = pic si la charge de chaque année est redistribuée uniformément
            (potentiel de la fonction « distribution mensuelle »).{' '}
            <strong>Abandons</strong> = projets retirés de la feuille de route dans ce scénario.
            Surcoût annuel en année pleine (embauche : {COUT_ETP_DEFAULT.toLocaleString('fr-FR')} €/ETP ;
            ST : {TJM_ST_DEFAULT} €/j). Les colonnes années donnent le pic mensuel de sous-effectif net.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
