/**
 * FdrScenarioMatrix — vue de synthèse « Comparatif scénarios » (Feuille de route).
 *
 * Matrice projet × scénario. Pour chaque cellule :
 *   - le projet est-il pris en compte dans la FDR (inclusion) ;
 *   - si oui, son mois de démarrage (kickoff effectif du scénario) ;
 *   - s'il y a de la sous-traitance / externalisation (ST).
 *
 * La colonne du scénario ACTIF (marquée *) est éditable : cocher l'inclusion,
 * activer/couper la ST — ces changements alimentent l'override local du scénario
 * (même état que le Gantt) et se sauvegardent avec « Mettre à jour ». Les autres
 * colonnes sont en lecture seule (valeurs enregistrées de chaque scénario).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toYM } from '@/lib/fdr/calculationEngine';
import type { FdrRoadmapProject } from '@/hooks/useFdrProjects';
import type { ProjectOverride } from '@/hooks/useFdrHireScenarios';

const REAL = '__real__';
const NEW_SCENARIO = '__new__';

interface Col {
  key: string;
  nom: string;
  ovMap: Map<string, ProjectOverride>;
  editable: boolean;
}

interface FdrScenarioMatrixProps {
  /** Projets réels visibles (déjà filtrés), servant de base à chaque colonne. */
  projects: FdrRoadmapProject[];
  scenarios: { id: string; nom: string; project_overrides: ProjectOverride[] }[];
  activeSel: string;                 // REAL | NEW_SCENARIO | id de scénario
  activeName: string;                // nom saisi pour le scénario courant
  activeOverrides: ProjectOverride[];// overrides locaux (brouillon) du scénario actif
  onSetOverride: (id: string, patch: Partial<ProjectOverride>) => void;
  onToggleRealFdr: (p: FdrRoadmapProject) => void;
}

function fmtStart(ym: string | null): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  return `${m}/${y.slice(2)}`;
}

export function FdrScenarioMatrix({
  projects, scenarios, activeSel, activeName, activeOverrides, onSetOverride, onToggleRealFdr,
}: FdrScenarioMatrixProps) {
  const [open, setOpen] = useState(false);

  const activeMap = useMemo(
    () => new Map(activeOverrides.map(o => [o.it_project_id, o])),
    [activeOverrides],
  );

  const columns = useMemo<Col[]>(() => {
    const cols: Col[] = [
      { key: REAL, nom: 'Réel', ovMap: new Map(), editable: activeSel === REAL },
    ];
    if (activeSel === NEW_SCENARIO) {
      cols.push({ key: NEW_SCENARIO, nom: `${activeName.trim() || 'Scénario courant'} *`, ovMap: activeMap, editable: true });
    }
    for (const s of scenarios) {
      const isActive = s.id === activeSel;
      cols.push({
        key: s.id,
        nom: isActive ? `${s.nom} *` : s.nom,
        ovMap: isActive ? activeMap : new Map(s.project_overrides.map(o => [o.it_project_id, o])),
        editable: isActive,
      });
    }
    return cols;
  }, [scenarios, activeSel, activeName, activeMap]);

  const eff = (p: FdrRoadmapProject, ovMap: Map<string, ProjectOverride>) => {
    const o = ovMap.get(p.id);
    const inclRaw = o?.sur_feuille_de_route !== undefined ? o.sur_feuille_de_route : p.sur_feuille_de_route;
    const included = !!inclRaw && p.statut_portefeuille !== 'Abandonné';
    const startYm = toYM(o?.date_kickoff !== undefined ? o.date_kickoff : p.date_kickoff);
    const st = o?.externe !== undefined ? !!o.externe : !!p.externe;
    return { inclRaw: !!inclRaw, included, startYm, st };
  };

  const toggleInc = (col: Col, p: FdrRoadmapProject, curRaw: boolean) => {
    if (col.key === REAL) { onToggleRealFdr(p); return; }
    onSetOverride(p.id, { sur_feuille_de_route: !curRaw });
  };
  const toggleSt = (col: Col, p: FdrRoadmapProject, curSt: boolean) => {
    if (col.key === REAL) return; // ST du réel : à éditer dans la fiche projet
    onSetOverride(p.id, { externe: !curSt, pct_reduction_si_externe: p.pct_reduction_si_externe || 1 });
  };

  return (
    <Card className="border-violet-200/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Table2 className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium">Comparatif scénarios — inclusion / démarrage / ST</span>
        <Badge variant="outline" className="ml-2 text-[10px]">
          {projects.length} projet(s) · {columns.length} colonne(s)
        </Badge>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Colonne active (*) éditable · les autres en lecture seule
        </span>
      </button>

      {open && (
        <CardContent className="p-0 overflow-auto max-h-[60vh]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b">
                <th className="text-left px-3 py-2 sticky left-0 bg-background font-medium min-w-[220px]">
                  Projet ({projects.length})
                </th>
                {columns.map(c => (
                  <th
                    key={c.key}
                    className={cn(
                      'text-left px-3 py-2 border-l font-medium min-w-[150px]',
                      c.editable && 'bg-violet-50 text-violet-800',
                    )}
                    title={c.editable ? 'Colonne active — éditable' : 'Lecture seule'}
                  >
                    {c.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b hover:bg-muted/20">
                  <td
                    className="px-3 py-1.5 sticky left-0 bg-background truncate max-w-[260px]"
                    title={`${p.code} — ${p.nom}`}
                  >
                    {p.nom}
                  </td>
                  {columns.map(c => {
                    const e = eff(p, c.ovMap);
                    return (
                      <td
                        key={c.key}
                        className={cn('px-3 py-1.5 border-l align-top', c.editable && 'bg-violet-50/40')}
                      >
                        {c.editable ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="flex items-center gap-1 cursor-pointer" title="Pris en compte dans la FDR">
                              <Checkbox
                                checked={e.included}
                                onCheckedChange={() => toggleInc(c, p, e.inclRaw)}
                                className="h-3.5 w-3.5"
                              />
                              <span className={cn('tabular-nums', !e.included && 'text-muted-foreground line-through')}>
                                {e.included ? fmtStart(e.startYm) : 'hors'}
                              </span>
                            </label>
                            {e.included && c.key !== REAL && (
                              <label className="flex items-center gap-1 cursor-pointer text-[11px]" title="Externalisation / sous-traitance">
                                <Checkbox
                                  checked={e.st}
                                  onCheckedChange={() => toggleSt(c, p, e.st)}
                                  className="h-3.5 w-3.5"
                                />
                                <span className={cn(e.st ? 'text-amber-700 font-medium' : 'text-muted-foreground')}>ST</span>
                              </label>
                            )}
                            {e.included && c.key === REAL && e.st && (
                              <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">ST</Badge>
                            )}
                          </div>
                        ) : e.included ? (
                          <span className="flex items-center gap-1.5">
                            <span className="tabular-nums">{fmtStart(e.startYm)}</span>
                            {e.st && <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">ST</Badge>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">✗ hors FDR</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                    Aucun projet (vérifiez les filtres).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      )}
    </Card>
  );
}
