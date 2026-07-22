/**
 * ITPortfolioROI — Synthèse globale ROI de tous les projets IT.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp, Search, AlertCircle, CheckCircle2, Clock, Euro, ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useITTjmReferentiel } from '@/hooks/useITTjmReferentiel';
import type { ITProject, ITProjectRHHorsIT, ITRoiCalc } from '@/types/itProject';
import type { ITProjectLoad } from '@/types/fdr';
import { cn } from '@/lib/utils';
import { STATUT_PORTEFEUILLE_CONFIG, type StatutPortefeuille } from '@/types/fdr';

// ── Formatage ──────────────────────────────────────────────────────────────

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ── Calcul ROI (identique à ITProjectROITab) ───────────────────────────────

function computeRoi(
  project: ITProject,
  loads: ITProjectLoad[],
  tjmMap: Record<string, number>,
  rhHorsIT: ITProjectRHHorsIT[],
): ITRoiCalc {
  const cogs_eur = project.budget_externe_eur ?? 0;
  const duree = project.delai_projete_mois ?? 0;
  // Tâche permanente = charge récurrente → coût ANNUEL (j/mois × 12), pas le cumul
  // sur toute la durée du projet.
  const monthsFactor = project.statut_portefeuille === 'Tâche permanente' ? 12 : duree;
  let rh_it_eur = 0;
  let total_j_build = 0;
  for (const load of loads) {
    const code = (load as any).profil?.code ?? '';
    const tjm = tjmMap[code] ?? 0;
    const jBuild = load.j_mois * monthsFactor;
    total_j_build += jBuild;
    rh_it_eur += jBuild * tjm;
  }
  let gain_annuel_eur = 0;
  for (const rh of rhHorsIT) {
    const joursAn = rh.unite === 'jours_an'
      ? (rh.jours_an ?? 0)
      : (rh.jours_par_spv ?? 0) * (rh.nb_spv ?? 0);
    gain_annuel_eur += joursAn * rh.tjm_interne;
  }
  const bilan_annuel_eur = gain_annuel_eur - cogs_eur - rh_it_eur;
  const investissement = cogs_eur + rh_it_eur;
  const temps_retour_an = gain_annuel_eur > 0 ? investissement / gain_annuel_eur : null;
  return { cogs_eur, rh_it_eur, gain_annuel_eur, bilan_annuel_eur, temps_retour_an, total_j_build };
}

// ── Hooks de chargement en masse ───────────────────────────────────────────

function usePortfolioRoiData() {
  return useQuery({
    queryKey: ['it-portfolio-roi-data'],
    queryFn: async () => {
      const [projectsRes, loadsRes, rhRes] = await Promise.all([
        supabase
          .from('it_projects')
          .select('*, company:companies(id, name)')
          .order('code_projet_digital'),
        supabase
          .from('it_project_load')
          .select('*, profil:fdr_profils(id, code, nom)'),
        supabase
          .from('it_project_rh_hors_it')
          .select('*'),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (loadsRes.error) throw loadsRes.error;
      if (rhRes.error) throw rhRes.error;

      const projects = (projectsRes.data ?? []) as ITProject[];
      const loads = (loadsRes.data ?? []) as ITProjectLoad[];
      const rhHorsIT = (rhRes.data ?? []) as ITProjectRHHorsIT[];

      return { projects, loads, rhHorsIT };
    },
    staleTime: 30_000,
  });
}

// ── Page principale ────────────────────────────────────────────────────────

export default function ITPortfolioROI() {
  const navigate = useNavigate();
  const { data, isLoading } = usePortfolioRoiData();
  const { data: tjmList = [] } = useITTjmReferentiel();
  const [search, setSearch] = useState('');

  const tjmMap = useMemo(
    () => Object.fromEntries(tjmList.map(t => [t.profil_code, t.tjm_eur])),
    [tjmList],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const { projects, loads, rhHorsIT } = data;

    const loadsByProject: Record<string, ITProjectLoad[]> = {};
    for (const l of loads) {
      if (!loadsByProject[l.it_project_id]) loadsByProject[l.it_project_id] = [];
      loadsByProject[l.it_project_id].push(l);
    }

    const rhByProject: Record<string, ITProjectRHHorsIT[]> = {};
    for (const rh of rhHorsIT) {
      if (!rhByProject[rh.it_project_id]) rhByProject[rh.it_project_id] = [];
      rhByProject[rh.it_project_id].push(rh);
    }

    return projects.map(p => ({
      project: p,
      roi: computeRoi(
        p,
        loadsByProject[p.id] ?? [],
        tjmMap,
        rhByProject[p.id] ?? [],
      ),
    }));
  }, [data, tjmMap]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.project.nom_projet.toLowerCase().includes(q) ||
      r.project.code_projet_digital.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // KPI globaux
  const kpis = useMemo(() => {
    const total_investissement = rows.reduce((s, r) => s + r.roi.cogs_eur + r.roi.rh_it_eur, 0);
    const total_gain = rows.reduce((s, r) => s + r.roi.gain_annuel_eur, 0);
    const total_bilan = rows.reduce((s, r) => s + r.roi.bilan_annuel_eur, 0);
    const with_roi = rows.filter(r => r.roi.gain_annuel_eur > 0).length;
    return { total_investissement, total_gain, total_bilan, with_roi };
  }, [rows]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-7 w-7 text-emerald-500" />
            </div>
            Synthèse ROI — Portefeuille IT
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Vision consolidée de la rentabilité estimée de tous les projets IT.
          </p>
        </div>

        {/* KPI globaux */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Investissement total" value={eur(kpis.total_investissement)} color="text-blue-600" />
            <KpiCard label="Gain annuel total (ETP)" value={eur(kpis.total_gain)} color="text-emerald-600" />
            <KpiCard
              label="BILAN annuel total"
              value={eur(kpis.total_bilan)}
              color={kpis.total_bilan >= 0 ? 'text-emerald-600' : 'text-red-600'}
            />
            <KpiCard
              label="Projets avec ROI renseigné"
              value={`${kpis.with_roi} / ${rows.length}`}
              color="text-muted-foreground"
            />
          </div>
        )}

        {/* Tableau */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Détail par projet</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un projet…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Projet</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">COGS (ST)</TableHead>
                      <TableHead className="text-right">RH IT</TableHead>
                      <TableHead className="text-right">Gain / an</TableHead>
                      <TableHead className="text-right">BILAN / an</TableHead>
                      <TableHead className="text-right">Retour</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                          Aucun projet trouvé.
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(({ project: p, roi }) => {
                      const statusCfg = STATUT_PORTEFEUILLE_CONFIG[(p.statut_portefeuille as StatutPortefeuille) ?? 'Idée']
                        || STATUT_PORTEFEUILLE_CONFIG['Idée'];
                      const hasRoi = roi.gain_annuel_eur > 0 || roi.rh_it_eur > 0;
                      return (
                        <TableRow
                          key={p.id}
                          className={cn('cursor-pointer hover:bg-muted/40', !hasRoi && 'opacity-50')}
                          onClick={() => navigate(`/it/projects/${p.code_projet_digital}/roi`)}
                        >
                          <TableCell>
                            <div className="font-medium text-sm">{p.nom_projet}</div>
                            <div className="text-xs text-muted-foreground font-mono">{p.code_projet_digital}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(statusCfg.className, 'border text-xs')}>
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {roi.cogs_eur > 0 ? eur(roi.cogs_eur) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {roi.rh_it_eur > 0 ? eur(roi.rh_it_eur) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm text-emerald-600 font-medium">
                            {roi.gain_annuel_eur > 0 ? eur(roi.gain_annuel_eur) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums text-sm font-semibold',
                            !hasRoi ? 'text-muted-foreground'
                              : roi.bilan_annuel_eur >= 0 ? 'text-emerald-600' : 'text-red-600'
                          )}>
                            {hasRoi ? eur(roi.bilan_annuel_eur) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {roi.temps_retour_an != null ? (
                              <span className={cn(
                                roi.temps_retour_an <= 2 ? 'text-emerald-600'
                                  : roi.temps_retour_an <= 4 ? 'text-amber-600' : 'text-red-600',
                              )}>
                                {roi.temps_retour_an.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} an
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-4 bg-background space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-bold tabular-nums', color)}>{value}</div>
    </div>
  );
}
