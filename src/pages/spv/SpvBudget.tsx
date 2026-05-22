/**
 * SpvBudget — Suivi des temps & coût RH des affaires SPV (code commençant par 'M').
 *
 * Pendant SPV de la fonctionnalité budget BE, focalisé sur la récupération des
 * temps passés (Lucca) : contrairement au BE, TOUS les salariés du groupe
 * peuvent imputer sur les affaires M. La valorisation RH réutilise le
 * référentiel be_tjm_fonctions (taux par fonction, applicable à tout le monde).
 *
 * Source : vues v_spv_affaire_temps_kpi / v_spv_affaire_temps_par_user.
 */

import { Fragment, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ListChecks, Clock, CalendarDays, Coins, Users, ChevronRight, ChevronDown, Search, Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpvAffairesTemps, useSpvAffaireTempsByUser } from '@/hooks/useSpvAffairesTemps';

const eur = (n: number) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = (n: number, frac = 1) =>
  (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: frac, maximumFractionDigits: frac });

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AffaireUserBreakdown({ codeAffaire }: { codeAffaire: string }) {
  const { data: users = [], isLoading } = useSpvAffaireTempsByUser(codeAffaire);
  if (isLoading) {
    return <div className="p-3"><Skeleton className="h-16 w-full" /></div>;
  }
  if (users.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">Aucun détail.</div>;
  }
  return (
    <div className="bg-muted/30 px-3 py-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-7 text-[11px]">Collaborateur</TableHead>
            <TableHead className="h-7 text-[11px]">Fonction</TableHead>
            <TableHead className="h-7 text-[11px] text-right">Heures</TableHead>
            <TableHead className="h-7 text-[11px] text-right">Jours</TableHead>
            <TableHead className="h-7 text-[11px] text-right">Coût RH</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={`${u.code_affaire}-${u.user_id}`} className="hover:bg-muted/40">
              <TableCell className="py-1 text-xs font-medium">{u.display_name ?? '—'}</TableCell>
              <TableCell className="py-1 text-xs text-muted-foreground">{u.job_title ?? '—'}</TableCell>
              <TableCell className="py-1 text-xs text-right tabular-nums">{num(u.heures)}</TableCell>
              <TableCell className="py-1 text-xs text-right tabular-nums">{num(u.jours)}</TableCell>
              <TableCell className="py-1 text-xs text-right tabular-nums">
                {u.taux_horaire > 0 ? eur(u.cout_rh) : <span className="text-muted-foreground italic">TJM ?</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SpvBudget() {
  const [activeView, setActiveView] = useState('spv');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: affaires = [], isLoading } = useSpvAffairesTemps();

  const filtered = useMemo(() => {
    if (!search.trim()) return affaires;
    const q = search.toLowerCase();
    return affaires.filter((a) => a.code_affaire.toLowerCase().includes(q));
  }, [affaires, search]);

  const totals = useMemo(() => {
    return affaires.reduce(
      (acc, a) => {
        acc.heures += Number(a.heures_declarees) || 0;
        acc.jours += Number(a.jours_declares) || 0;
        acc.cout += Number(a.cout_rh_declare) || 0;
        return acc;
      },
      { heures: 0, jours: 0, cout: 0 },
    );
  }, [affaires]);

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Suivi des temps SPV" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto space-y-4">

            {/* Titre */}
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <Leaf className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-display font-bold leading-none">SPV — Suivi des temps</h1>
              <span className="text-xs text-muted-foreground">affaires « M » · imputation tous services</span>
            </div>

            {/* KPI globaux */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={ListChecks} label="Affaires M" value={String(affaires.length)} color="bg-emerald-100 text-emerald-700" />
              <KpiCard icon={Clock} label="Heures déclarées" value={num(totals.heures, 0)} color="bg-blue-100 text-blue-700" />
              <KpiCard icon={CalendarDays} label="Jours" value={num(totals.jours, 1)} color="bg-violet-100 text-violet-700" />
              <KpiCard icon={Coins} label="Coût RH" value={eur(totals.cout)} color="bg-amber-100 text-amber-700" />
            </div>

            {/* Recherche */}
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher une affaire (M…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Tableau */}
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 w-8" />
                    <TableHead className="h-9 text-xs">Affaire</TableHead>
                    <TableHead className="h-9 text-xs text-right">Heures</TableHead>
                    <TableHead className="h-9 text-xs text-right">Jours</TableHead>
                    <TableHead className="h-9 text-xs text-right">Coût RH</TableHead>
                    <TableHead className="h-9 text-xs text-right">Collab.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="py-2"><Skeleton className="h-6 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Aucune affaire SPV (M) trouvée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((a) => {
                      const isOpen = expanded.has(a.code_affaire);
                      return (
                        <Fragment key={a.code_affaire}>
                          <TableRow
                            className="cursor-pointer hover:bg-emerald-50/50"
                            onClick={() => toggle(a.code_affaire)}
                          >
                            <TableCell className="py-1.5">
                              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="font-mono text-xs">{a.code_affaire}</Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{num(a.heures_declarees)}</TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{num(a.jours_declares)}</TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums font-medium">{eur(a.cout_rh_declare)}</TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Users className="h-3 w-3" />{a.nb_collaborateurs}
                              </span>
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={6} className="p-0">
                                <AffaireUserBreakdown codeAffaire={a.code_affaire} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>

            <p className="text-[11px] text-muted-foreground">
              Coût RH valorisé via le référentiel TJM par fonction. « TJM ? » = fonction sans taux référencé.
              Le volet financier (CA / COGS Divalto) s'activera dès que des mouvements en « M » seront importés.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
