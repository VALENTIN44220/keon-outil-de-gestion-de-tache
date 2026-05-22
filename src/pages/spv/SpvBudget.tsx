/**
 * SpvBudget — Suivi budgétaire des affaires SPV (montage de projet, code 'M').
 *
 * Pendant SPV de la fonctionnalité budget BE :
 *  - CA (ventes : commandes CCN engagées / factures FCN constatées)
 *  - COGS (achats : commandes CFN / factures FFN) depuis Divalto
 *  - Marge brute = CA constaté − COGS constaté
 *  - Coût RH (temps Lucca, TOUS salariés, valorisé via be_tjm_fonctions)
 *  - Marge directe = marge brute − coût RH
 *  - Lignes de budget manuelles par affaire
 *
 * Source : vues v_spv_affaire_budget_kpi / v_spv_affaire_temps_par_user +
 * table spv_affaire_budget_lines.
 */

import { Fragment, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ListChecks, Coins, Users, ChevronRight, ChevronDown, Search, Leaf,
  Receipt, ReceiptText, TrendingUp, TrendingDown, Plus, Trash2, Wallet, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useSpvAffairesBudgetKpi, useSpvAffaireTempsByUser, useSpvBudgetLines,
  type SpvAffaireBudgetKpi,
} from '@/hooks/useSpvAffairesTemps';

const eur = (n: number) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = (n: number, frac = 1) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: frac, maximumFractionDigits: frac });

function KpiCard({ icon: Icon, label, value, color, hint }: { icon: any; label: string; value: string; color: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {hint && <p className="text-[10px] text-muted-foreground truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Détail temps par collaborateur ──────────────────────────────────────────
function TempsBreakdown({ codeAffaire }: { codeAffaire: string }) {
  const { data: users = [], isLoading } = useSpvAffaireTempsByUser(codeAffaire);
  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (users.length === 0) return <p className="text-xs text-muted-foreground">Aucune saisie de temps.</p>;
  return (
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
  );
}

// ── Lignes de budget (ajout / suppression) ──────────────────────────────────
function BudgetLines({ spvAffaireId }: { spvAffaireId: string }) {
  const { data: lines = [], isLoading, upsertLine, deleteLine } = useSpvBudgetLines(spvAffaireId);
  const [poste, setPoste] = useState('');
  const [montant, setMontant] = useState('');
  const [fournisseur, setFournisseur] = useState('');

  const handleAdd = () => {
    const m = parseFloat(montant.replace(',', '.'));
    if (!poste.trim() || isNaN(m)) { toast.error('Renseigne un poste et un montant'); return; }
    upsertLine.mutate(
      { spv_affaire_id: spvAffaireId, poste: poste.trim(), montant_budget: m, fournisseur_prevu: fournisseur.trim() || null },
      { onSuccess: () => { setPoste(''); setMontant(''); setFournisseur(''); toast.success('Ligne ajoutée'); } },
    );
  };

  const total = lines.reduce((s, l) => s + (Number(l.montant_budget_revise ?? l.montant_budget) || 0), 0);

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  return (
    <div className="space-y-2">
      {lines.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-7 text-[11px]">Poste</TableHead>
              <TableHead className="h-7 text-[11px]">Fournisseur</TableHead>
              <TableHead className="h-7 text-[11px] text-right">Montant</TableHead>
              <TableHead className="h-7 w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.id} className="hover:bg-muted/40">
                <TableCell className="py-1 text-xs font-medium">{l.poste}</TableCell>
                <TableCell className="py-1 text-xs text-muted-foreground">{l.fournisseur_prevu ?? '—'}</TableCell>
                <TableCell className="py-1 text-xs text-right tabular-nums">{eur(l.montant_budget_revise ?? l.montant_budget)}</TableCell>
                <TableCell className="py-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteLine.mutate(l.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="hover:bg-transparent font-semibold">
              <TableCell className="py-1 text-xs" colSpan={2}>Total budget</TableCell>
              <TableCell className="py-1 text-xs text-right tabular-nums">{eur(total)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      )}
      {/* Ajout rapide */}
      <div className="flex items-end gap-2 flex-wrap">
        <Input placeholder="Poste" value={poste} onChange={e => setPoste(e.target.value)} className="h-8 text-xs w-40" />
        <Input placeholder="Fournisseur" value={fournisseur} onChange={e => setFournisseur(e.target.value)} className="h-8 text-xs w-36" />
        <Input placeholder="Montant €" value={montant} onChange={e => setMontant(e.target.value)} className="h-8 text-xs w-28" />
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAdd} disabled={upsertLine.isPending}>
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>
    </div>
  );
}

export default function SpvBudget() {
  const [activeView, setActiveView] = useState('spv-budget');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Record<string, 'temps' | 'budget'>>({});
  const { data: affaires = [], isLoading } = useSpvAffairesBudgetKpi();

  const filtered = useMemo(() => {
    if (!search.trim()) return affaires;
    const q = search.toLowerCase();
    return affaires.filter((a) => a.code_affaire.toLowerCase().includes(q) || (a.affaire_libelle ?? '').toLowerCase().includes(q));
  }, [affaires, search]);

  const totals = useMemo(() => {
    return affaires.reduce(
      (acc, a) => {
        acc.ca += Number(a.ca_constate_brut) || 0;
        acc.cogs += Number(a.cogs_constate_brut) || 0;
        acc.marge += Number(a.marge_brute) || 0;
        acc.cout_rh += Number(a.cout_rh_declare) || 0;
        acc.marge_directe += Number(a.marge_directe) || 0;
        acc.budget += Number(a.budget_total) || 0;
        return acc;
      },
      { ca: 0, cogs: 0, marge: 0, cout_rh: 0, marge_directe: 0, budget: 0 },
    );
  }, [affaires]);

  const toggle = (id: string) => setExpanded(prev => (prev === id ? null : id));
  const getTab = (id: string) => tab[id] ?? 'temps';

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Budget SPV" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-4">

            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <Leaf className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-display font-bold leading-none">SPV — Budget des affaires</h1>
              <span className="text-xs text-muted-foreground">affaires « M » · imputation tous services</span>
            </div>

            {/* KPI globaux */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <KpiCard icon={ListChecks} label="Affaires M" value={String(affaires.length)} color="bg-emerald-100 text-emerald-700" />
              <KpiCard icon={Receipt} label="CA constaté" value={eur(totals.ca)} color="bg-blue-100 text-blue-700" />
              <KpiCard icon={ReceiptText} label="COGS constaté" value={eur(totals.cogs)} color="bg-orange-100 text-orange-700" />
              <KpiCard icon={TrendingUp} label="Marge brute" value={eur(totals.marge)} color="bg-violet-100 text-violet-700" />
              <KpiCard icon={Coins} label="Coût RH" value={eur(totals.cout_rh)} color="bg-amber-100 text-amber-700" />
              <KpiCard icon={TrendingDown} label="Marge directe" value={eur(totals.marge_directe)} color={totals.marge_directe >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} />
            </div>

            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Rechercher une affaire (M…)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 w-8" />
                    <TableHead className="h-9 text-xs">Affaire</TableHead>
                    <TableHead className="h-9 text-xs text-right">CA constaté</TableHead>
                    <TableHead className="h-9 text-xs text-right">COGS</TableHead>
                    <TableHead className="h-9 text-xs text-right">Marge brute</TableHead>
                    <TableHead className="h-9 text-xs text-right">Coût RH</TableHead>
                    <TableHead className="h-9 text-xs text-right">Marge directe</TableHead>
                    <TableHead className="h-9 text-xs text-right">Jours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={8} className="py-2"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">Aucune affaire SPV (M).</TableCell></TableRow>
                  ) : (
                    filtered.map((a: SpvAffaireBudgetKpi) => {
                      const isOpen = expanded === a.spv_affaire_id;
                      const t = getTab(a.spv_affaire_id);
                      return (
                        <Fragment key={a.spv_affaire_id}>
                          <TableRow className="cursor-pointer hover:bg-emerald-50/50" onClick={() => toggle(a.spv_affaire_id)}>
                            <TableCell className="py-1.5">
                              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="font-mono text-xs">{a.code_affaire}</Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{eur(a.ca_constate_brut)}</TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{eur(a.cogs_constate_brut)}</TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{eur(a.marge_brute)}</TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{eur(a.cout_rh_declare)}</TableCell>
                            <TableCell className={cn('py-1.5 text-right text-sm tabular-nums font-medium', Number(a.marge_directe) < 0 ? 'text-red-600' : 'text-emerald-700')}>
                              {eur(a.marge_directe)}
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-sm tabular-nums">{num(a.jours_declares)}</TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={8} className="p-0">
                                <div className="bg-muted/30 p-3 space-y-3">
                                  {/* sous-onglets */}
                                  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
                                    <Button variant="ghost" size="sm"
                                      onClick={() => setTab(prev => ({ ...prev, [a.spv_affaire_id]: 'temps' }))}
                                      className={cn('h-7 px-3 gap-1.5 text-xs rounded-md', t === 'temps' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}>
                                      <Clock className="h-3.5 w-3.5" /> Temps ({a.nb_factures >= 0 ? '' : ''}{num(a.jours_declares)}j)
                                    </Button>
                                    <Button variant="ghost" size="sm"
                                      onClick={() => setTab(prev => ({ ...prev, [a.spv_affaire_id]: 'budget' }))}
                                      className={cn('h-7 px-3 gap-1.5 text-xs rounded-md', t === 'budget' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}>
                                      <Wallet className="h-3.5 w-3.5" /> Budget ({eur(a.budget_total)})
                                    </Button>
                                  </div>
                                  {t === 'temps'
                                    ? <TempsBreakdown codeAffaire={a.code_affaire} />
                                    : <BudgetLines spvAffaireId={a.spv_affaire_id} />}
                                </div>
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
              CA/COGS/marges issus des mouvements Divalto (CCN/FCN ventes, CFN/FFN achats) liés par code_affaire.
              Coût RH valorisé via le référentiel TJM par fonction (tous salariés). Le CA est à 0 tant qu'aucun
              mouvement Divalto « M » n'est importé ; la structure se renseigne automatiquement à l'arrivée des données.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
