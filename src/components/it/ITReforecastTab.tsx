/**
 * ITReforecastTab — onglet de reforecast budgétaire IT.
 *
 * Affiche toutes les lignes du périmètre (entité + année + type) avec :
 *  - Budget initial (figé : montant_budget × 12 ou montant_annuel)
 *  - Budget révisé (montant_budget_revise) éditable inline
 *  - Δ (delta) initial → révisé en € et en %
 *
 * Permet :
 *  - Édition rapide du montant révisé d'une ligne (clic → input)
 *  - Filtrage : toutes les lignes / uniquement celles révisées
 *  - Bouton "Ajouter une ligne reforecast" → ouvre le dialog parent
 *  - Total Initial vs Révisé en bas de tableau
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Save, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { lineAnnualBudget, lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { ITBudgetLine } from '@/types/itProject';

interface Props {
  lines: ITBudgetLine[];
  onAddLine: () => void;
  onRefresh: () => void;
}

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const fmtEurPrecise = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function ITReforecastTab({ lines, onAddLine, onRefresh }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterModified, setFilterModified] = useState(false);

  // Tri : modifiees d'abord, puis par categorie/description
  const sortedLines = useMemo(() => {
    const arr = [...lines];
    arr.sort((a, b) => {
      const aMod = a.montant_budget_revise != null && a.montant_budget_revise !== a.montant_budget;
      const bMod = b.montant_budget_revise != null && b.montant_budget_revise !== b.montant_budget;
      if (aMod !== bMod) return aMod ? -1 : 1;
      return (a.categorie ?? '').localeCompare(b.categorie ?? '') ||
             (a.description ?? '').localeCompare(b.description ?? '');
    });
    return arr;
  }, [lines]);

  const filtered = useMemo(() => {
    if (!filterModified) return sortedLines;
    return sortedLines.filter(l =>
      l.montant_budget_revise != null && Number(l.montant_budget_revise) !== Number(l.montant_budget)
    );
  }, [sortedLines, filterModified]);

  const totals = useMemo(() => {
    const initial = lines.reduce((s, l) => s + lineAnnualBudget(l), 0);
    const revise = lines.reduce((s, l) => s + lineAnnualBudgetRevise(l), 0);
    return { initial, revise, delta: revise - initial };
  }, [lines]);

  const startEdit = (line: ITBudgetLine) => {
    const current = line.montant_budget_revise ?? line.montant_budget ?? 0;
    setEditingId(line.id);
    setEditValue(String(current));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (line: ITBudgetLine) => {
    const valueNum = Number(String(editValue).replace(',', '.'));
    if (!Number.isFinite(valueNum)) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Pour mensuel : montant saisi est le montant mensuel
      // Pour mensuel_variable : montant saisi est le total annuel (on ne change pas les mois indiv)
      // Pour annuel : montant saisi est annuel
      const updates: Partial<ITBudgetLine> = {
        montant_budget_revise: valueNum,
      };
      const { error } = await supabase.from('it_budget_lines').update(updates).eq('id', line.id);
      if (error) throw error;
      toast({ title: 'Budget révisé enregistré' });
      cancelEdit();
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetRevise = async (line: ITBudgetLine) => {
    if (!confirm('Annuler la révision (revenir au budget initial) ?')) return;
    const { error } = await supabase
      .from('it_budget_lines')
      .update({ montant_budget_revise: null })
      .eq('id', line.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Révision annulée' });
      onRefresh();
    }
  };

  const renderDelta = (initial: number, revise: number) => {
    const delta = revise - initial;
    const pct = initial !== 0 ? (delta / initial) * 100 : 0;
    if (Math.abs(delta) < 0.01) return <span className="text-muted-foreground/60">—</span>;
    const isPos = delta > 0;
    const Icon = isPos ? TrendingUp : TrendingDown;
    return (
      <div className={`flex items-center justify-end gap-1 text-xs font-medium ${isPos ? 'text-amber-700' : 'text-emerald-700'}`}>
        <Icon className="h-3 w-3" />
        <span>{isPos ? '+' : ''}{fmtEur(delta)}</span>
        <span className="text-[10px] text-muted-foreground">({isPos ? '+' : ''}{pct.toFixed(1)} %)</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Budget reforecast</h2>
          <p className="text-xs text-muted-foreground">
            Mets à jour le budget révisé en cours d'exercice. Les écarts s'affichent en temps réel.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="filter-modified" checked={filterModified} onCheckedChange={setFilterModified} />
            <Label htmlFor="filter-modified" className="text-xs cursor-pointer">
              Uniquement les lignes révisées
            </Label>
          </div>
          <Button size="sm" onClick={onAddLine}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter une ligne
          </Button>
        </div>
      </div>

      {/* KPI bandeau */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-900/40">
          <p className="text-[11px] uppercase text-muted-foreground">Budget initial</p>
          <p className="text-xl font-bold tabular-nums">{fmtEur(totals.initial)}</p>
        </div>
        <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
          <p className="text-[11px] uppercase text-blue-700">Budget révisé</p>
          <p className="text-xl font-bold tabular-nums text-blue-800 dark:text-blue-300">{fmtEur(totals.revise)}</p>
        </div>
        <div className={`rounded-lg border p-3 ${
          Math.abs(totals.delta) < 1
            ? 'bg-muted/30'
            : totals.delta > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
        }`}>
          <p className="text-[11px] uppercase text-muted-foreground">Δ Reforecast</p>
          <p className={`text-xl font-bold tabular-nums ${
            Math.abs(totals.delta) < 1 ? '' : totals.delta > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            {totals.delta > 0 ? '+' : ''}{fmtEur(totals.delta)}
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Description</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Budget initial</TableHead>
              <TableHead className="text-right">Budget révisé</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  {filterModified ? 'Aucune ligne révisée pour le moment.' : 'Aucune ligne budgétaire.'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((line) => {
              const initial = lineAnnualBudget(line);
              const revise = lineAnnualBudgetRevise(line);
              const isEditing = editingId === line.id;
              const isModified = line.montant_budget_revise != null && Number(line.montant_budget_revise) !== Number(line.montant_budget);
              return (
                <TableRow key={line.id} className={isModified ? 'bg-amber-50/40' : ''}>
                  <TableCell className="text-sm">
                    {line.description ?? <span className="italic text-muted-foreground">{line.sous_categorie ?? '—'}</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{line.categorie ?? '—'}</div>
                    {line.sous_categorie && line.description && (
                      <div className="text-[10px]">{line.sous_categorie}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {line.budget_type === 'mensuel' ? 'Mensuel'
                        : line.budget_type === 'mensuel_variable' ? 'Mensuel var.'
                        : 'Annuel'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{fmtEurPrecise(initial)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          autoFocus
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveEdit(line);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="h-7 w-32 text-right text-xs"
                          disabled={saving}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(line)} disabled={saving}>
                          <Save className="h-3 w-3 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(line)}
                        className={`hover:bg-accent rounded px-2 py-0.5 ${isModified ? 'font-semibold text-blue-700' : ''}`}
                        title="Cliquer pour modifier le budget révisé"
                      >
                        {fmtEurPrecise(revise)}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderDelta(initial, revise)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!isEditing && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(line)} title="Modifier">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                      {isModified && !isEditing && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => resetRevise(line)} title="Annuler la révision">
                          <Minus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
