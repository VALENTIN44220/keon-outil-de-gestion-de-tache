/**
 * BEPlanning — Plan de charge du Bureau d'Études (heatmap collaborateur × mois).
 * Capacité (jours ouvrés − congés) vs charge projetée (tâches BE × durée /
 * référentiel prestation), avec le temps réel Lucca en contexte.
 */
import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBECapacityMatrix } from '@/hooks/useBECapacityMatrix';

const POSTE_LABELS: Record<string, string> = {
  charge_affaires: 'Chargé d\'affaires',
  ingenieur_etudes: 'Ingénieur études',
  ingenieur_realisation: 'Ingénieur réalisation',
  projeteur: 'Projeteur',
  developpeur: 'Développeur',
  autre: 'Autre',
};

const num = (n: number) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('fr-FR');

/** Couleur de cellule selon l'écart capacité − projeté (en jours). */
function cellClass(ecart: number): string {
  if (ecart > 5) return 'bg-emerald-100 text-emerald-900';
  if (ecart > 2) return 'bg-emerald-50 text-emerald-800';
  if (ecart >= 0) return 'bg-amber-50 text-amber-800';
  if (ecart > -3) return 'bg-red-100 text-red-800';
  if (ecart > -6) return 'bg-red-200 text-red-900';
  return 'bg-red-300 text-red-950';
}

export default function BEPlanning() {
  const [activeView, setActiveView] = useState('be-planning');
  const { matrix, isLoading } = useBECapacityMatrix();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Plan de charge BE" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700"><BarChart2 className="h-5 w-5" /></div>
              <div>
                <h1 className="text-xl font-display font-bold leading-none">Plan de charge — Bureau d'Études</h1>
                <p className="text-sm text-muted-foreground">Capacité (jours ouvrés − congés) vs charge projetée des missions BE</p>
              </div>
            </div>

            {/* Légende */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="font-medium">Écart capacité − projeté :</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> marge</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 inline-block" /> tendu</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> surcharge</span>
              <span className="ml-2">· chaque cellule : <strong>projeté j</strong> (gros) · réel Lucca j (petit)</span>
            </div>

            <Card className="overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                {isLoading ? (
                  <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : matrix.rows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Aucun collaborateur BE avec charge sur la période.</div>
                ) : (
                  <TooltipProvider>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground sticky left-0 bg-muted/40 z-10 min-w-[200px]">Collaborateur</th>
                          {matrix.months.map((m) => (
                            <th key={m.ym} className="px-2 py-2 font-medium text-xs text-muted-foreground text-center min-w-[84px] capitalize">{m.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.rows.map((r) => (
                          <tr key={r.user_id} className="border-b">
                            <td className="px-3 py-1.5 sticky left-0 bg-background z-10">
                              <div className="font-medium text-sm leading-tight">{r.name}</div>
                              {r.poste && <div className="text-[10px] text-muted-foreground">{POSTE_LABELS[r.poste] ?? r.poste}</div>}
                            </td>
                            {matrix.months.map((m) => {
                              const c = r.cells[m.ym];
                              if (!c) return <td key={m.ym} />;
                              return (
                                <td key={m.ym} className="px-1 py-1 text-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn('rounded-md py-1 px-1 cursor-default', cellClass(c.ecart))}>
                                        <div className="text-sm font-semibold tabular-nums leading-none">{num(c.projete)}</div>
                                        {c.reel > 0 && <div className="text-[9px] opacity-70 tabular-nums mt-0.5">réel {num(c.reel)}</div>}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      <div>Capacité : <strong>{num(c.capacity)} j</strong></div>
                                      <div>Projeté : {num(c.projete)} j</div>
                                      <div>Réel (Lucca) : {num(c.reel)} j</div>
                                      <div className={c.ecart < 0 ? 'text-red-400' : 'text-emerald-400'}>Écart : {num(c.ecart)} j</div>
                                    </TooltipContent>
                                  </Tooltip>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              <strong>Capacité</strong> = jours ouvrés du mois − fériés − congés (<code>user_leaves</code>).
              <strong> Projeté</strong> = tâches BE ouvertes assignées, effort = <code>duration_hours</code> ou, à défaut,
              le référentiel <code>default_duration_hours</code> de la prestation, réparti sur le mois d'échéance (sans échéance / en retard → mois courant).
              <strong> Réel</strong> = temps Lucca déclaré (<code>lucca_saisie_temps</code>).
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
