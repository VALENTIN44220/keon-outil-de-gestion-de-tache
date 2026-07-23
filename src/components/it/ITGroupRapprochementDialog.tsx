/**
 * ITGroupRapprochementDialog — bilan de rapprochement au niveau d'un GROUPEMENT.
 *
 * Équivalent « groupe » du rapprochement par ligne : montre
 *  - le rapprochement GLOBAL du groupe (Budget / Reforecast / Engagé / Constaté
 *    / Reste / Conso%), agrégé via computeBudgetCanon sur les lignes membres ;
 *  - le détail LIGNE PAR LIGNE (mêmes 4 montants + conso), chaque ligne étant
 *    dépliable pour afficher ses pièces réelles (commandes / factures via
 *    BudgetLineRapprochementPanel + écritures comptables via
 *    BudgetLineSupplierEntriesPanel).
 *
 * Les lignes reçues portent déjà les montants injectés par la page
 * (_cf_amount / _ff_amount / _supplier_ht_amount) → même source de vérité que
 * les KPI / la Synthèse.
 */
import { Fragment, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeBudgetCanon } from '@/lib/itBudgetCanon';
import { BudgetLineRapprochementPanel } from './BudgetLineRapprochementPanel';
import { BudgetLineSupplierEntriesPanel } from './BudgetLineSupplierEntriesPanel';
import type { ITBudgetLineRow } from './budgetColumns';

export interface GroupRapprochementInput {
  label: string;
  rows: ITBudgetLineRow[];
  budYY: string; // suffixe année pour libellés BUD/F
}

interface Props {
  open: boolean;
  onClose: () => void;
  group: GroupRapprochementInput | null;
}

const eur = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const consoTone = (pct: number) =>
  pct > 100 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  : pct > 80 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
  : pct > 0 ? 'text-emerald-700 dark:text-emerald-400'
  : 'text-muted-foreground';

export function ITGroupRapprochementDialog({ open, onClose, group }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const perLine = useMemo(() => (group?.rows ?? []).map((r) => ({
    row: r,
    canon: computeBudgetCanon(r, {
      cf_amount: (r as any)._cf_amount,
      ff_amount: (r as any)._ff_amount,
      supplier_ht_amount: (r as any)._supplier_ht_amount,
    }),
  })), [group]);

  const totals = useMemo(
    () => perLine.reduce(
      (a, { canon }) => ({
        budget_initial: a.budget_initial + canon.budget_initial,
        budget_revise: a.budget_revise + canon.budget_revise,
        engage: a.engage + canon.engage,
        constate: a.constate + canon.constate,
      }),
      { budget_initial: 0, budget_revise: 0, engage: 0, constate: 0 },
    ),
    [perLine],
  );

  const budYY = group?.budYY ?? '';
  const reste = totals.budget_revise - totals.constate;
  const conso = totals.budget_revise > 0 ? (totals.constate / totals.budget_revise) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setExpanded(null); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-emerald-600" />
            Bilan de rapprochement — {group?.label ?? ''}
            <Badge variant="outline" className="text-[10px]">
              {perLine.length} ligne{perLine.length > 1 ? 's' : ''}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Bilan GLOBAL du groupe */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: `BUD${budYY}`, value: totals.budget_initial, tone: 'text-slate-700 dark:text-slate-200' },
            { label: `F${budYY}`, value: totals.budget_revise, tone: 'text-blue-700 dark:text-blue-300' },
            { label: 'Engagé', value: totals.engage, tone: 'text-indigo-700 dark:text-indigo-400' },
            { label: 'Constaté', value: totals.constate, tone: 'text-violet-700 dark:text-violet-400' },
            { label: `Reste F${budYY}`, value: reste, tone: reste < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-400' },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className={cn('text-sm font-bold tabular-nums', c.tone)}>{eur(c.value)}</p>
            </div>
          ))}
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conso</p>
            <p className={cn('text-sm font-bold tabular-nums px-1 rounded inline-block', consoTone(conso))}>{conso.toFixed(0)}%</p>
          </div>
        </div>

        {/* Détail LIGNE PAR LIGNE */}
        <div className="flex-1 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Ligne</TableHead>
                <TableHead className="text-right">BUD{budYY}</TableHead>
                <TableHead className="text-right">F{budYY}</TableHead>
                <TableHead className="text-right">Engagé</TableHead>
                <TableHead className="text-right">Constaté</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="text-right">Conso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perLine.map(({ row, canon }) => {
                const isOpen = expanded === row.id;
                const lReste = canon.budget_revise - canon.constate;
                const lConso = canon.budget_revise > 0 ? (canon.constate / canon.budget_revise) * 100 : 0;
                const label = [row.categorie, row.description || row.fournisseur_prevu].filter(Boolean).join(' · ') || '—';
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                    >
                      <TableCell className="py-2">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="truncate block max-w-[280px]">{label}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{eur(canon.budget_initial)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {(row as any).montant_budget_revise != null ? eur(canon.budget_revise) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-indigo-700 dark:text-indigo-400">{canon.engage ? eur(canon.engage) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-violet-700 dark:text-violet-400">{canon.constate ? eur(canon.constate) : '—'}</TableCell>
                      <TableCell className={cn('text-right tabular-nums text-xs', lReste < 0 && 'text-red-700 dark:text-red-300')}>{eur(lReste)}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn('tabular-nums text-xs px-1 rounded', consoTone(lConso))}>{lConso.toFixed(0)}%</span>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/20 p-4">
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Commandes / factures rapprochées</p>
                              <BudgetLineRapprochementPanel budgetLineId={row.id} fournisseurPrevu={row.fournisseur_prevu ?? null} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Écritures comptables rattachées</p>
                              <BudgetLineSupplierEntriesPanel budgetLineId={row.id} fournisseurPrevu={row.fournisseur_prevu ?? null} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {perLine.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Aucune ligne dans ce groupe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
