import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { useITBudgetGlobal, useITBudgetLineMonths, type ITBudgetLineMonth } from '@/hooks/useITProjectBudget';
import { useITBudgetEngageConstate } from '@/hooks/useITBudgetEngageConstate';
import { BudgetLineRapprochementPanel } from '@/components/it/BudgetLineRapprochementPanel';
import { BulkRapprochementDialog } from '@/components/it/BulkRapprochementDialog';
import { supabase } from '@/integrations/supabase/client';
import { SupplierCombobox } from '@/components/it/SupplierCombobox';
import { ITProjectCombobox } from '@/components/it/ITProjectCombobox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useITBudgetOptions, PRESET_CATEGORIES } from '@/hooks/useITBudgetOptions';
import {
  BUDGET_LINE_STATUT_CONFIG,
  IT_BUDGET_ANNEES,
  type BudgetLineStatut,
  type BudgetType,
  type ITBudgetLine,
  type ITManualExpense,
  type TypeDepense,
} from '@/types/itProject';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { BudgetLinesBulkActionsBar } from '@/components/it/BudgetLinesBulkActionsBar';
import { BudgetColumnsManager } from '@/components/it/BudgetColumnsManager';
import { IT_BUDGET_COLUMNS, type ITBudgetLineRow } from '@/components/it/budgetColumns';
import { useITBudgetPreferences } from '@/hooks/useITBudgetPreferences';
import { EntityCombobox } from '@/components/it/EntityCombobox';
import { useCompanies } from '@/hooks/useCompanies';
import { useITProjects } from '@/hooks/useITProjects';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ShoppingCart,
  CheckCircle2,
  Target,
  AlertTriangle,
  List,
  PenLine,
  PieChart as PieChartIcon,
  Pencil,
  Trash2,
  Plus,
  BarChart2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const EUR_OPTS = { style: 'currency' as const, currency: 'EUR' as const };
function eur(n: number) {
  return n.toLocaleString('fr-FR', EUR_OPTS);
}

const MOIS_COURTS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const MOIS_LONGS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function formatBudgetPeriode(l: Pick<ITBudgetLine, 'budget_type' | 'mois_budget'>): string {
  if (l.budget_type === 'mensuel') return 'Mensuel';
  if (l.mois_budget == null) return 'Annuel';
  return `Annuel — ${MOIS_COURTS[l.mois_budget] ?? `M${l.mois_budget}`}`;
}

type LineExtra = ITBudgetLine & { entite?: string | null; annee?: number | null };
type ExpenseExtra = ITManualExpense & { entite?: string | null; annee?: number | null };

const BUDGET_LINE_STATUTS = Object.keys(BUDGET_LINE_STATUT_CONFIG) as BudgetLineStatut[];

const TYPE_PREVISION_LABEL: Record<ITManualExpense['type_prevision'], string> = {
  depense_prevue: 'Dépense prévue',
  provision: 'Provision',
  refacturation: 'Refacturation',
  correction: 'Correction',
  exceptionnel: 'Exceptionnel',
};

const TYPE_PREVISION_CLASS: Record<ITManualExpense['type_prevision'], string> = {
  depense_prevue: 'bg-blue-100 text-blue-800 border-blue-300',
  provision: 'bg-amber-100 text-amber-800 border-amber-300',
  refacturation: 'bg-violet-100 text-violet-800 border-violet-300',
  correction: 'bg-orange-100 text-orange-800 border-orange-300',
  exceptionnel: 'bg-red-100 text-red-800 border-red-300',
};

const EXPENSE_STATUT_CLASS: Record<ITManualExpense['statut'], string> = {
  en_attente: 'bg-slate-100 text-slate-700 border-slate-300',
  confirme: 'bg-green-100 text-green-800 border-green-300',
  annule: 'bg-red-100 text-red-800 border-red-300',
};

const EXPENSE_STATUT_LABEL: Record<ITManualExpense['statut'], string> = {
  en_attente: 'En attente',
  confirme: 'Confirmé',
  annule: 'Annulé',
};

function ExpandedMonths({ lineId }: { lineId: string }) {
  const { data: months = [], isLoading, updateMonth } = useITBudgetLineMonths(lineId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refCmd, setRefCmd] = useState('');
  const [refFac, setRefFac] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [statut, setStatut] = useState<ITBudgetLineMonth['statut_rapprochement']>('non_rapproche');

  const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  const STATUT_RAPPR_CONFIG = {
    non_rapproche: { label: 'Non rapproché', className: 'bg-slate-100 text-slate-600 border-slate-300' },
    commande_liee: { label: 'Commande liée', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    facture_liee: { label: 'Facture liée', className: 'bg-violet-100 text-violet-700 border-violet-300' },
    solde: { label: 'Soldé', className: 'bg-green-100 text-green-700 border-green-300' },
  };

  const openEdit = (m: ITBudgetLineMonth) => {
    setEditingId(m.id);
    setRefCmd(m.ref_commande_divalto ?? '');
    setRefFac(m.ref_facture_divalto ?? '');
    setPdfUrl(m.pdf_url ?? '');
    setStatut(m.statut_rapprochement);
  };

  const saveEdit = async (id: string) => {
    await updateMonth.mutateAsync({
      id,
      updates: {
        ref_commande_divalto: refCmd || null,
        ref_facture_divalto: refFac || null,
        pdf_url: pdfUrl || null,
        statut_rapprochement: statut,
      },
    });
    setEditingId(null);
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Chargement...</div>;

  return (
    <div className="px-4 pb-4 bg-muted/30">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2 font-medium text-muted-foreground">Mois</th>
            <th className="text-right py-2 px-2 font-medium text-muted-foreground">Montant</th>
            <th className="py-2 px-2 font-medium text-muted-foreground">Réf. Commande</th>
            <th className="py-2 px-2 font-medium text-muted-foreground">Réf. Facture</th>
            <th className="py-2 px-2 font-medium text-muted-foreground">PJ Facture</th>
            <th className="py-2 px-2 font-medium text-muted-foreground">Statut</th>
            <th className="py-2 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-1.5 px-2 font-medium">{MOIS_LABELS[m.mois - 1]}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(m.montant_budget ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </td>
              {editingId === m.id ? (
                <>
                  <td className="py-1 px-2"><Input className="h-7 text-xs" value={refCmd} onChange={(e) => setRefCmd(e.target.value)} placeholder="CFK-..." /></td>
                  <td className="py-1 px-2"><Input className="h-7 text-xs" value={refFac} onChange={(e) => setRefFac(e.target.value)} placeholder="FFK-..." /></td>
                  <td className="py-1 px-2"><Input className="h-7 text-xs" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://..." /></td>
                  <td className="py-1 px-2">
                    <Select value={statut} onValueChange={(v) => setStatut(v as ITBudgetLineMonth['statut_rapprochement'])}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUT_RAPPR_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1 px-2">
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveEdit(m.id)}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}>✕</Button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-1.5 px-2 text-muted-foreground">{m.ref_commande_divalto ?? '—'}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{m.ref_facture_divalto ?? '—'}</td>
                  <td className="py-1.5 px-2">
                    {m.pdf_url
                      ? <a href={m.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate max-w-[120px] block">Voir PJ</a>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="py-1.5 px-2">
                    <Badge variant="outline" className={cn('border text-[10px]', STATUT_RAPPR_CONFIG[m.statut_rapprochement].className)}>
                      {STATUT_RAPPR_CONFIG[m.statut_rapprochement].label}
                    </Badge>
                  </td>
                  <td className="py-1.5 px-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(m)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BudgetPageSkeleton() {
  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 animate-pulse">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 flex-1 min-w-[160px] max-w-[220px] rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}

export default function ITBudgetGlobal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { prefs, isLoaded: prefsLoaded, updateColumns, updateFilters } = useITBudgetPreferences();
  const { data: companiesList = [] } = useCompanies();

  const filters = useMemo(
    () => ({
      annee: prefs.filters_config.annee ?? new Date().getFullYear(),
      entite: prefs.filters_config.entite ?? '',
      type_depense: prefs.filters_config.type_depense ?? '',
      categorie: prefs.filters_config.categorie ?? '',
    }),
    [prefs.filters_config]
  );

  const setFilter = useCallback(
    <K extends keyof typeof prefs.filters_config>(key: K, value: (typeof prefs.filters_config)[K]) => {
      updateFilters({ ...prefs.filters_config, [key]: value });
    },
    [prefs.filters_config, updateFilters]
  );

  const [activeTab, setActiveTab] = useState<'synthese' | 'lignes' | 'depenses'>('synthese');

  const {
    lines,
    linesLoading,
    addLine,
    updateLine,
    deleteLine,
    bulkUpdateLines,
    bulkDeleteLines,
    bulkDuplicateLines,
    addExpense,
    expenses,
    expensesLoading,
    kpis,
    byType,
    byCategorie,
    byEntite,
    byFournisseur,
    bySousCategorie,
  } = useITBudgetGlobal(filters);
  const { data: engageConstateData } = useITBudgetEngageConstate({
    annee: filters.annee,
    entite: filters.entite,
  });
  const engageGlobal   = engageConstateData?.totalEngage   ?? 0;
  const constateGlobal = engageConstateData?.totalConstate ?? 0;

  // Résolution des noms de projets IT pour la synthèse
  const { projects: allProjects = [] } = useITProjects();

  const projectNameMap = useMemo(
    () => new Map(allProjects.map((p) => [p.id, p.nom_projet])),
    [allProjects]
  );

  const byProjet = useMemo(() => {
    return Array.from(
      lines.reduce((map, l) => {
        if (!l.it_project_id) return map;
        const key = l.it_project_id;
        const label = projectNameMap.get(key) ?? `Projet ${key.slice(0, 8)}…`;
        const cur = map.get(key) || { projet_id: key, projet: label, budget: 0 };
        cur.budget += (l as any).montant_budget_revise ?? l.montant_budget ?? 0;
        map.set(key, cur);
        return map;
      }, new Map<string, { projet_id: string; projet: string; budget: number }>())
    ).map(([, v]) => v)
      .sort((a, b) => b.budget - a.budget);
  }, [lines, projectNameMap]);

  const [filterTypeDepense, setFilterTypeDepense] = useState<string>('__all__');
  const [filterMois, setFilterMois] = useState<string>('__all__');

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ITBudgetLine | null>(null);
  const [lineSaving, setLineSaving] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ITManualExpense | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const toggleLineSelection = useCallback((id: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback((allSelected: boolean, visibleIds: string[]) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedLineIds(new Set()), []);

  useEffect(() => {
    setSelectedLineIds((prev) => {
      const existingIds = new Set(lines.map((l) => l.id));
      const filtered = new Set<string>();
      prev.forEach((id) => {
        if (existingIds.has(id)) filtered.add(id);
      });
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [lines]);

  const anneeOptions = useMemo(() => {
    const years = new Set<number>();
    lines.forEach((l) => {
      const y = (l as any).annee ?? l.exercice;
      if (typeof y === 'number') years.add(y);
    });
    const current = new Date().getFullYear();
    [current - 1, current, current + 1, current + 2].forEach((y) => years.add(y));
    return Array.from(years).sort((a, b) => a - b);
  }, [lines]);

  const entiteOptions = useMemo(() => companiesList.map((c) => c.name), [companiesList]);

  const {
    categorieOptions,
    getSousCategorieOptions,
    natureDepenseOptions,
    addOption,
  } = useITBudgetOptions();

  const [lineCategorieSelect, setLineCategorieSelect] = useState<string>(PRESET_CATEGORIES[0]);
  const [lineSousCategorie, setLineSousCategorie] = useState('');
  const [lineFournisseur, setLineFournisseur] = useState('');
  const [lineTypeDepense, setLineTypeDepense] = useState<TypeDepense>('Opex');
  const [lineNatureDepense, setLineNatureDepense] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [lineBudgetType, setLineBudgetType] = useState<BudgetType>('mensuel');
  const [lineMoisDecaissement, setLineMoisDecaissement] = useState<string>('1');
  const [lineMontantBudget, setLineMontantBudget] = useState('');
  const [lineMontantRevise, setLineMontantRevise] = useState('');
  const [lineStatut, setLineStatut] = useState<BudgetLineStatut>('brouillon');
  const [lineCommentaire, setLineCommentaire] = useState('');
  const [lineEntite, setLineEntite] = useState<string>('');
  const [lineAnnee, setLineAnnee] = useState<string>('2026');
  const [lineItProjectId, setLineItProjectId] = useState('');
  const [bulkRapprochementOpen, setBulkRapprochementOpen] = useState(false);

  const [expTypePrevision, setExpTypePrevision] = useState<ITManualExpense['type_prevision']>('depense_prevue');
  const [expFournisseur, setExpFournisseur] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expDatePrevue, setExpDatePrevue] = useState('');
  const [expMontant, setExpMontant] = useState('');
  const [expStatut, setExpStatut] = useState<ITManualExpense['statut']>('en_attente');
  const [expCommentaire, setExpCommentaire] = useState('');
  const [expEntite, setExpEntite] = useState<string>('');
  const [expAnnee, setExpAnnee] = useState<string>('2026');
  const [expItProjectId, setExpItProjectId] = useState('');

  const lineSousCategorieOptions = useMemo(() => {
    const base = getSousCategorieOptions(lineCategorieSelect);
    if (lineSousCategorie && !base.includes(lineSousCategorie)) base.push(lineSousCategorie);
    return base;
  }, [lineCategorieSelect, lineSousCategorie, getSousCategorieOptions]);

  const lineNatureDepenseOptions = useMemo(() => {
    const base = [...natureDepenseOptions];
    if (lineNatureDepense && !base.includes(lineNatureDepense)) base.push(lineNatureDepense);
    return base;
  }, [natureDepenseOptions, lineNatureDepense]);

  const lineCategorieOptions = useMemo(() => {
    const base = [...categorieOptions];
    if (lineCategorieSelect && !base.includes(lineCategorieSelect)) base.push(lineCategorieSelect);
    return base;
  }, [categorieOptions, lineCategorieSelect]);

  const resetLineForm = useCallback(() => {
    setLineCategorieSelect(PRESET_CATEGORIES[0]);
    setLineSousCategorie('');
    setLineFournisseur('');
    setLineTypeDepense('Opex');
    setLineNatureDepense('');
    setLineDescription('');
    setLineBudgetType('mensuel');
    setLineMoisDecaissement('1');
    setLineMontantBudget('');
    setLineMontantRevise('');
    setLineStatut('brouillon');
    setLineCommentaire('');
    setLineEntite('');
    setLineAnnee(String(filters.annee));
    setLineItProjectId('');
  }, [filters.annee]);

  const openAddLine = () => {
    setEditingLine(null);
    resetLineForm();
    setLineDialogOpen(true);
  };

  const openEditLine = (line: ITBudgetLine) => {
    const lx = line as LineExtra;
    setEditingLine(line);
    const cat = line.categorie?.trim() || '';
    setLineCategorieSelect(cat || PRESET_CATEGORIES[0]);
    setLineSousCategorie(line.sous_categorie ?? '');
    setLineFournisseur(line.fournisseur_prevu ?? '');
    setLineTypeDepense((line.type_depense as TypeDepense) || 'Opex');
    setLineNatureDepense(line.nature_depense ?? '');
    setLineDescription(line.description ?? '');
    setLineBudgetType((line.budget_type as BudgetType) ?? 'mensuel');
    setLineMoisDecaissement(line.mois_budget != null ? String(line.mois_budget) : '1');
    setLineMontantBudget(String(line.montant_budget ?? ''));
    setLineMontantRevise(line.montant_budget_revise != null ? String(line.montant_budget_revise) : '');
    setLineStatut(line.statut);
    setLineCommentaire(line.commentaire ?? '');
    setLineEntite((lx.entite as string) || '');
    setLineAnnee(String(lx.annee ?? line.exercice ?? filters.annee));
    setLineItProjectId(line.it_project_id ?? '');
    setLineDialogOpen(true);
  };

  const resetExpenseForm = useCallback(() => {
    setExpTypePrevision('depense_prevue');
    setExpFournisseur('');
    setExpDescription('');
    setExpDatePrevue('');
    setExpMontant('');
    setExpStatut('en_attente');
    setExpCommentaire('');
    setExpEntite('');
    setExpAnnee(String(filters.annee));
    setExpItProjectId('');
  }, [filters.annee]);

  const openAddExpense = () => {
    setEditingExpense(null);
    resetExpenseForm();
    setExpenseDialogOpen(true);
  };

  const openEditExpense = (exp: ITManualExpense) => {
    const ex = exp as ExpenseExtra;
    setEditingExpense(exp);
    setExpTypePrevision(exp.type_prevision);
    setExpFournisseur(exp.fournisseur ?? '');
    setExpDescription(exp.description ?? '');
    setExpDatePrevue(exp.date_prevue ? exp.date_prevue.slice(0, 10) : '');
    setExpMontant(String(exp.montant_prevu ?? ''));
    setExpStatut(exp.statut);
    setExpCommentaire(exp.commentaire ?? '');
    setExpEntite((ex.entite as string) || '');
    setExpAnnee(String(ex.annee ?? filters.annee));
    setExpItProjectId(exp.it_project_id ?? '');
    setExpenseDialogOpen(true);
  };

  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      if (filterTypeDepense !== '__all__' && (l.type_depense || '') !== filterTypeDepense) return false;
      if (filterMois !== '__all__') {
        const m = Number(filterMois);
        // Un budget mensuel couvre tous les mois ; un budget annuel n'apparaît
        // que pour son mois de décaissement.
        if (l.budget_type === 'annuel' && l.mois_budget !== m) return false;
      }
      return true;
    });
  }, [lines, filterTypeDepense, filterMois]);

  const filteredLineRows = useMemo(
    () =>
      filteredLines.map((l) => ({
        ...(l as ITBudgetLineRow),
        projet_it_label: l.it_project_id
          ? projectNameMap.get(l.it_project_id) ?? null
          : null,
      })) as ITBudgetLineRow[],
    [filteredLines, projectNameMap]
  );

  const manuel_prevu = useMemo(
    () => expenses.filter((e) => e.statut !== 'annule').reduce((s, e) => s + (e.montant_prevu ?? 0), 0),
    [expenses]
  );

  const revisionsDelta = kpis.budget_revise - kpis.budget_initial;
  const budgetReviseGlobal = kpis.budget_revise;

  const typeCardStyle: Record<string, { border: string; bg: string }> = {
    Opex: { border: 'border-blue-200', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
    Capex: { border: 'border-amber-200', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
    RH: { border: 'border-green-200', bg: 'bg-green-50/50 dark:bg-green-950/20' },
    Amortissement: { border: 'border-slate-200', bg: 'bg-slate-50/60 dark:bg-slate-950/30' },
  };

  const progressValue = Math.min(100, Math.max(0, kpis.taux_consommation));

  const hasActiveFilters = !!(filters.entite || filters.type_depense || filters.categorie.trim());

  const resetFilters = () => {
    updateFilters({
      ...prefs.filters_config,
      entite: '',
      type_depense: '',
      categorie: '',
    });
  };

  const submitLine = async () => {
    const montant = Number(lineMontantBudget.replace(',', '.'));
    if (!Number.isFinite(montant)) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    const reviseRaw = lineMontantRevise.trim();
    const montantRevise = reviseRaw === '' ? null : Number(reviseRaw.replace(',', '.'));
    if (reviseRaw !== '' && !Number.isFinite(montantRevise)) {
      toast({ title: 'Budget révisé invalide', variant: 'destructive' });
      return;
    }
    const mois =
      lineBudgetType === 'annuel' ? Number(lineMoisDecaissement) : null;
    if (lineBudgetType === 'annuel' && (!Number.isFinite(mois) || (mois as number) < 1 || (mois as number) > 12)) {
      toast({ title: 'Mois de décaissement invalide', variant: 'destructive' });
      return;
    }
    const lineAnneeNum = Number(lineAnnee);
    if (!Number.isFinite(lineAnneeNum)) {
      toast({ title: 'Année invalide', variant: 'destructive' });
      return;
    }

    setLineSaving(true);
    try {
      // Persister les valeurs personnalisées (fire-and-forget) pour qu'elles
      // apparaissent dans les dropdowns des autres utilisateurs.
      if (lineCategorieSelect && !categorieOptions.includes(lineCategorieSelect)) {
        addOption.mutate({ option_type: 'categorie', value: lineCategorieSelect });
      }
      if (
        lineSousCategorie &&
        !getSousCategorieOptions(lineCategorieSelect).includes(lineSousCategorie)
      ) {
        addOption.mutate({
          option_type: 'sous_categorie',
          value: lineSousCategorie,
          parent_value: lineCategorieSelect,
        });
      }
      if (lineNatureDepense && !natureDepenseOptions.includes(lineNatureDepense)) {
        addOption.mutate({ option_type: 'nature_depense', value: lineNatureDepense });
      }

      const baseUpdates = {
        categorie: lineCategorieSelect || null,
        sous_categorie: lineSousCategorie || null,
        fournisseur_prevu: lineFournisseur || null,
        type_depense: lineTypeDepense,
        nature_depense: lineNatureDepense || null,
        description: lineDescription || null,
        budget_type: lineBudgetType,
        mois_budget: mois,
        montant_budget: montant,
        montant_budget_revise: montantRevise,
        statut: lineStatut,
        commentaire: lineCommentaire || null,
        exercice: lineAnneeNum,
        entite: lineEntite,
        annee: lineAnneeNum,
      } as Record<string, unknown>;

      if (editingLine) {
        const updates: Record<string, unknown> = { ...baseUpdates };
        if (lineItProjectId.trim()) updates.it_project_id = lineItProjectId.trim();
        await updateLine.mutateAsync({
          id: editingLine.id,
          updates: updates as Partial<ITBudgetLine>,
        });
        toast({ title: 'Ligne budgétaire mise à jour' });
      } else {
        const payload: Record<string, unknown> = {
          ...baseUpdates,
          version: '1',
          mode_saisie: 'manuel',
          external_key: null,
        };
        if (lineItProjectId.trim()) payload.it_project_id = lineItProjectId.trim();
        await addLine.mutateAsync(payload as Omit<ITBudgetLine, 'id' | 'created_at' | 'updated_at'>);
        toast({ title: 'Ligne budgétaire créée' });
      }
      setLineDialogOpen(false);
      setEditingLine(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setLineSaving(false);
    }
  };

  const confirmDeleteLine = async () => {
    if (!deleteLineId) return;
    try {
      await deleteLine.mutateAsync(deleteLineId);
      toast({ title: 'Ligne supprimée' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Suppression impossible', description: msg, variant: 'destructive' });
    } finally {
      setDeleteLineId(null);
    }
  };

  const submitExpense = async () => {
    const montant = Number(expMontant.replace(',', '.'));
    if (!Number.isFinite(montant)) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    const expAnneeNum = Number(expAnnee);
    if (!Number.isFinite(expAnneeNum)) {
      toast({ title: 'Année invalide', variant: 'destructive' });
      return;
    }
    const pid = expItProjectId.trim();
    if (!pid) {
      toast({ title: 'Référence projet requise', description: 'Saisissez un it_project_id (texte ou UUID).', variant: 'destructive' });
      return;
    }

    setExpenseSaving(true);
    try {
      const base = {
        type_prevision: expTypePrevision,
        fournisseur: expFournisseur || null,
        description: expDescription || null,
        date_prevue: expDatePrevue || null,
        montant_prevu: montant,
        statut: expStatut,
        commentaire: expCommentaire || null,
        entite: expEntite,
        annee: expAnneeNum,
        it_project_id: pid,
      };

      if (editingExpense) {
        const { error } = await supabase.from('it_manual_expenses').update(base).eq('id', editingExpense.id);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['it-budget-global-expenses'] });
        toast({ title: 'Dépense mise à jour' });
      } else {
        const payload = {
          it_project_id: pid,
          it_budget_line_id: null as string | null,
          type_prevision: expTypePrevision,
          fournisseur: expFournisseur || null,
          description: expDescription || null,
          date_prevue: expDatePrevue || null,
          montant_prevu: montant,
          statut: expStatut,
          commentaire: expCommentaire || null,
          entite: expEntite,
          annee: expAnneeNum,
        } as Omit<ITManualExpense, 'id' | 'created_at' | 'updated_at'>;
        await addExpense.mutateAsync(payload);
        toast({ title: 'Dépense créée' });
      }
      setExpenseDialogOpen(false);
      setEditingExpense(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setExpenseSaving(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      const { error } = await supabase.from('it_manual_expenses').delete().eq('id', deleteExpenseId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['it-budget-global-expenses'] });
      toast({ title: 'Dépense supprimée' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast({ title: 'Suppression impossible', description: msg, variant: 'destructive' });
    } finally {
      setDeleteExpenseId(null);
    }
  };

  useEffect(() => {
    if (!lineDialogOpen) return;
    if (editingLine) return;
    resetLineForm();
  }, [lineDialogOpen, editingLine, resetLineForm]);

  const depassementCard =
    kpis.depassement > 0 ? (
      <div
        className={cn(
          'flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border p-4 shadow-sm',
          'border-red-200 bg-red-50/40 dark:bg-red-950/20'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Dépassement</span>
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        </div>
        <p className="mt-2 text-xl font-bold tabular-nums text-red-600">{eur(kpis.depassement)}</p>
      </div>
    ) : (
      <div
        className={cn(
          'flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border p-4 shadow-sm',
          'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Économie potentielle</span>
          <TrendingDown className="h-4 w-4 text-emerald-600 shrink-0" />
        </div>
        <p className="mt-2 text-xl font-bold tabular-nums text-emerald-600">{eur(kpis.montant_reaffectable)}</p>
      </div>
    );

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <header className="px-6 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="h-7 w-7 text-violet-600" />
              Suivi budgétaire IT
            </h1>
              <p className="text-sm text-muted-foreground mt-1">
              Vision consolidée tous projets — Exercice {filters.annee}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Année</Label>
            <Select value={String(filters.annee)} onValueChange={(v) => setFilter('annee', Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IT_BUDGET_ANNEES.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap gap-3 items-center">
          <EntityCombobox
            value={prefs.filters_config.entite ?? 'all'}
            onValueChange={(v) =>
              updateFilters({
                ...prefs.filters_config,
                entite: v === 'all' ? undefined : v,
              })
            }
            allowAll
            triggerClassName="w-[200px]"
          />
          <Select value={filters.type_depense || '__all__'} onValueChange={(v) => setFilter('type_depense', v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les types</SelectItem>
              <SelectItem value="Opex">Opex</SelectItem>
              <SelectItem value="Capex">Capex</SelectItem>
              <SelectItem value="RH">RH</SelectItem>
              <SelectItem value="Amortissement">Amortissement</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="max-w-xs"
            placeholder="Filtrer par catégorie..."
            value={filters.categorie}
            onChange={(e) => setFilter('categorie', e.target.value)}
          />
          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={resetFilters}>
              <X className="h-4 w-4" />
              Réinitialiser
            </Button>
          )}
          <Button type="button" className="gap-2 ml-auto" onClick={openAddLine}>
            <Plus className="h-4 w-4" />
            + Nouvelle ligne budgétaire
          </Button>
        </div>

        {linesLoading || !prefsLoaded ? (
          <BudgetPageSkeleton />
        ) : (
          <div className="flex-1 overflow-auto p-6 space-y-6">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:bg-slate-950/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Budget initial</span>
                  <TrendingUp className="h-4 w-4 text-slate-600 shrink-0" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{eur(kpis.budget_initial)}</p>
              </div>
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:bg-blue-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Budget révisé</span>
                  <RefreshCw className="h-4 w-4 text-blue-600 shrink-0" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-blue-800 dark:text-blue-200">{eur(kpis.budget_revise)}</p>
              </div>
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm dark:bg-indigo-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Engagé</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                      Phase 2
                    </Badge>
                    <ShoppingCart className="h-4 w-4 text-indigo-600 shrink-0" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-indigo-800 dark:text-indigo-200">{eur(engageGlobal)}</p>
              </div>
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm dark:bg-violet-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Constaté</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                      Phase 2
                    </Badge>
                    <CheckCircle2 className="h-4 w-4 text-violet-600 shrink-0" />
                  </div>
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-violet-800 dark:text-violet-200">{eur(constateGlobal)}</p>
              </div>
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:bg-amber-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Forecast fin d&apos;année</span>
                  <Target className="h-4 w-4 text-amber-600 shrink-0" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-amber-900 dark:text-amber-100">{eur(kpis.forecast_fin_annee)}</p>
              </div>
              {depassementCard}
            </div>

            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium">Taux de consommation budgétaire</span>
                  <span className="text-xs text-muted-foreground sm:text-right">
                    {kpis.taux_consommation}% — Constaté {eur(constateGlobal)} / Budget révisé {eur(kpis.budget_revise)}
                  </span>
                </div>
                <Progress value={progressValue} className="h-3" />
                <p className="text-[11px] text-muted-foreground">
                  ℹ Engagé et Constaté seront alimentés depuis Divalto (Phase 2)
                </p>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="synthese" className="gap-2">
                  <PieChartIcon className="h-4 w-4" />
                  Synthèse
                </TabsTrigger>
                <TabsTrigger value="lignes" className="gap-2">
                  <List className="h-4 w-4" />
                  Lignes budgétaires
                </TabsTrigger>
                <TabsTrigger value="depenses" className="gap-2">
                  <PenLine className="h-4 w-4" />
                  Dépenses manuelles
                </TabsTrigger>
              </TabsList>

              <TabsContent value="synthese" className="space-y-6 mt-4">

                {/* KPI Cards + Taux — inchangé, déjà au-dessus des tabs */}

                {/* --- Ligne 1 : Type + Sous-catégorie --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Répartition par type */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold mb-3">Répartition par type de dépense</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {byType.map((row) => {
                          const st = typeCardStyle[row.type] ?? typeCardStyle.Opex;
                          const pct = budgetReviseGlobal > 0
                            ? Math.min(100, Math.round((row.budget_revise / budgetReviseGlobal) * 100))
                            : 0;
                          return (
                            <div key={row.type} className={cn('rounded-xl border p-3 shadow-sm', st.border, st.bg)}>
                              <p className="text-xs font-medium text-muted-foreground">{row.type}</p>
                              <p className="mt-1 text-base font-bold tabular-nums">{eur(row.budget_revise)}</p>
                              <Progress value={pct} className="h-1.5 mt-2" />
                              <p className="text-[10px] text-muted-foreground mt-1">{pct}% du total</p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Budget par sous-catégorie */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4" />
                        Budget par sous-catégorie
                      </h3>
                      {bySousCategorie.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <p className="text-sm">Aucune donnée</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            layout="vertical"
                            data={bySousCategorie}
                            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => eur(Number(v))} />
                            <YAxis type="category" dataKey="sous_categorie" width={120} tick={{ fontSize: 10 }} />
                            <RechartsTooltip formatter={(value: number) => eur(value)} />
                            <Bar dataKey="budget_revise" name="Budget révisé" fill="#6366f1" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* --- Ligne 2 : Catégorie + Entité --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Budget par catégorie */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4" />
                        Budget par catégorie
                      </h3>
                      {byCategorie.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <p className="text-sm">Aucune donnée</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={byCategorie} margin={{ top: 4, right: 8, left: 0, bottom: 32 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="categorie" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <RechartsTooltip formatter={(value: number) => eur(value)} />
                            <Legend />
                            <Bar dataKey="budget_initial" name="Initial" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="budget_revise" name="Révisé" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Budget par entité */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold mb-4">Budget par entité</h3>
                      {byEntite.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <p className="text-sm">Aucune donnée</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart layout="vertical" data={byEntite} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => eur(Number(v))} />
                            <YAxis type="category" dataKey="entite" width={100} tick={{ fontSize: 10 }} />
                            <RechartsTooltip formatter={(value: number) => eur(value)} />
                            <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* --- Ligne 3 : Fournisseur + Projet IT --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Top 10 fournisseurs */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold mb-4">Top 10 fournisseurs</h3>
                      {byFournisseur.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <p className="text-sm">Aucune donnée</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            layout="vertical"
                            data={byFournisseur}
                            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => eur(Number(v))} />
                            <YAxis type="category" dataKey="fournisseur" width={130} tick={{ fontSize: 10 }} />
                            <RechartsTooltip formatter={(value: number) => eur(value)} />
                            <Bar dataKey="budget" name="Budget révisé" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Budget par projet IT */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold mb-4">Budget par projet IT</h3>
                      {byProjet.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <p className="text-sm">Aucune ligne rattachée à un projet IT</p>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            layout="vertical"
                            data={byProjet}
                            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => eur(Number(v))} />
                            <YAxis type="category" dataKey="projet" width={140} tick={{ fontSize: 10 }} />
                            <RechartsTooltip formatter={(value: number) => eur(value)} />
                            <Bar dataKey="budget" name="Budget révisé" fill="#10b981" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* --- Waterfall récapitulatif (pleine largeur) --- */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-sm font-semibold mb-4">Waterfall (récapitulatif)</h3>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Budget initial</TableCell>
                          <TableCell className="text-right tabular-nums">{eur(kpis.budget_initial)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Révisions</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {revisionsDelta >= 0 ? '+' : ''}{eur(revisionsDelta)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Budget révisé</TableCell>
                          <TableCell className="text-right tabular-nums">{eur(kpis.budget_revise)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Dépenses manuelles prévues</TableCell>
                          <TableCell className="text-right tabular-nums">{eur(manuel_prevu)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Forecast fin d&apos;année</TableCell>
                          <TableCell className="text-right tabular-nums">{eur(kpis.forecast_fin_annee)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Écart au budget</TableCell>
                          <TableCell className={cn(
                            'text-right tabular-nums font-semibold',
                            kpis.ecart_budget > 0 ? 'text-red-600' : 'text-emerald-600'
                          )}>
                            {eur(kpis.ecart_budget)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

              </TabsContent>

              <TabsContent value="lignes" className="space-y-4 mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={filterTypeDepense} onValueChange={setFilterTypeDepense}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous</SelectItem>
                      <SelectItem value="Opex">Opex</SelectItem>
                      <SelectItem value="Capex">Capex</SelectItem>
                      <SelectItem value="RH">RH</SelectItem>
                      <SelectItem value="Amortissement">Amortissement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterMois} onValueChange={setFilterMois}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Mois" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous les mois</SelectItem>
                      {[
                        'Janvier',
                        'Février',
                        'Mars',
                        'Avril',
                        'Mai',
                        'Juin',
                        'Juillet',
                        'Août',
                        'Septembre',
                        'Octobre',
                        'Novembre',
                        'Décembre',
                      ].map((label, i) => (
                        <SelectItem key={label} value={String(i + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <BudgetColumnsManager config={prefs.columns_config} onChange={updateColumns} />
                  <Button type="button" onClick={openAddLine} className="gap-2 ml-auto">
                    <Plus className="h-4 w-4" />
                    + Ajouter une ligne
                  </Button>
                </div>

                {filteredLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
                    <BarChart2 className="h-12 w-12 opacity-40 mb-3" />
                    <p className="text-sm font-medium text-foreground max-w-md">
                      Aucune ligne budgétaire — commencez par en ajouter une
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <BudgetLinesBulkActionsBar
                      selectedIds={Array.from(selectedLineIds)}
                      allLines={lines as any}
                      onClearSelection={clearSelection}
                      onBulkUpdate={async (updates) => {
                        await bulkUpdateLines.mutateAsync({
                          ids: Array.from(selectedLineIds),
                          updates,
                        });
                      }}
                      onBulkDelete={async () => {
                        await bulkDeleteLines.mutateAsync(Array.from(selectedLineIds));
                        clearSelection();
                      }}
                      onBulkDuplicate={async () => {
                        await bulkDuplicateLines.mutateAsync(Array.from(selectedLineIds));
                        clearSelection();
                      }}
                      onBulkRapprocher={() => setBulkRapprochementOpen(true)}
                      entiteOptions={entiteOptions}
                      anneeOptions={anneeOptions}
                    />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            {(() => {
                              const visibleIds = filteredLines.map((l) => l.id);
                              const allSelected =
                                visibleIds.length > 0 && visibleIds.every((id) => selectedLineIds.has(id));
                              const someSelected = visibleIds.some((id) => selectedLineIds.has(id));
                              return (
                                <Checkbox
                                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                  onCheckedChange={() => toggleAllVisible(allSelected, visibleIds)}
                                  aria-label="Tout sélectionner"
                                />
                              );
                            })()}
                          </TableHead>
                          {prefs.columns_config.order.map((key) => {
                            const col = IT_BUDGET_COLUMNS.find((c) => c.key === key);
                            if (!col) return null;
                            return (
                              <TableHead key={key} className={cn(col.align === 'right' && 'text-right', col.className)}>
                                {col.label}
                              </TableHead>
                            );
                          })}
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLineRows.map((l) => {
                          const line = l;
                          return (
                            <Fragment key={l.id}>
                              <TableRow
                                className={cn('cursor-pointer', selectedLineIds.has(l.id) && 'bg-primary/5')}
                                onClick={() => setExpandedLineId(expandedLineId === l.id ? null : l.id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()} className="w-[40px]">
                                  <Checkbox
                                    checked={selectedLineIds.has(l.id)}
                                    onCheckedChange={() => toggleLineSelection(l.id)}
                                    aria-label={`Sélectionner ligne ${l.categorie ?? ''}`}
                                  />
                                </TableCell>
                                {prefs.columns_config.order.map((key) => {
                                  const col = IT_BUDGET_COLUMNS.find((c) => c.key === key);
                                  if (!col) return null;
                                  return (
                                    <TableCell
                                      key={key}
                                      className={cn(col.align === 'right' && 'text-right', col.className)}
                                    >
                                      {col.render(line, { eur, formatBudgetPeriode })}
                                    </TableCell>
                                  );
                                })}
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-1">
                                    {(() => {
                                      const ec = engageConstateData?.rows.find(r => r.budget_line_id === l.id);
                                      const hasLinks = (ec?.nb_commandes ?? 0) + (ec?.nb_factures ?? 0) > 0;
                                      return hasLinks ? (
                                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600 mr-1">
                                          Lié
                                        </Badge>
                                      ) : null;
                                    })()}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => openEditLine(l)}
                                      aria-label="Éditer"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => setDeleteLineId(l.id)}
                                      aria-label="Supprimer"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expandedLineId === l.id && (
                                <TableRow>
                                  <TableCell colSpan={prefs.columns_config.order.length + 2} className="p-0">
                                    <ExpandedMonths lineId={l.id} />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="depenses" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground rounded-md border border-blue-200/60 bg-blue-50/40 px-3 py-2 dark:bg-blue-950/20">
                  Les dépenses Divalto (CFK commandes / FFK factures) seront connectées en Phase 2
                </p>
                <Button type="button" onClick={openAddExpense} className="gap-2">
                  <Plus className="h-4 w-4" />
                  + Ajouter une dépense
                </Button>
                {expenses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center text-muted-foreground text-sm">
                    Aucune dépense manuelle
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Entité</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date prévue</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((e) => {
                          const ex = e as ExpenseExtra;
                          return (
                            <TableRow key={e.id}>
                              <TableCell>{e.description ?? '—'}</TableCell>
                              <TableCell>{ex.entite ?? '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn('border', TYPE_PREVISION_CLASS[e.type_prevision])}>
                                  {TYPE_PREVISION_LABEL[e.type_prevision]}
                                </Badge>
                              </TableCell>
                              <TableCell>{e.fournisseur ?? '—'}</TableCell>
                              <TableCell>
                                {e.date_prevue ? format(new Date(e.date_prevue), 'dd/MM/yyyy', { locale: fr }) : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{eur(e.montant_prevu ?? 0)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn('border', EXPENSE_STATUT_CLASS[e.statut])}>
                                  {EXPENSE_STATUT_LABEL[e.statut]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditExpense(e)} aria-label="Éditer">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => setDeleteExpenseId(e.id)}
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {expensesLoading && <p className="text-xs text-muted-foreground">Chargement des dépenses…</p>}
              </TabsContent>
            </Tabs>

            <div className="pt-2">
              <Button type="button" variant="link" className="text-sm px-0" onClick={() => navigate('/it/projects')}>
                ← Retour aux projets IT
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={lineDialogOpen} onOpenChange={(o) => { if (!o) { setLineDialogOpen(false); setEditingLine(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Modifier la ligne budgétaire' : 'Nouvelle ligne budgétaire'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="rapprochement">Rapprochement Divalto</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-3 py-2 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Entité *</Label>
                <EntityCombobox
                  value={lineEntite ?? ''}
                  onValueChange={(v) => setLineEntite(v)}
                  placeholder="Sélectionner une entité"
                  allowEmpty
                />
              </div>
              <div className="space-y-2">
                <Label>Année</Label>
                <Select value={lineAnnee} onValueChange={setLineAnnee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_BUDGET_ANNEES.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Projet IT (optionnel)</Label>
              <ITProjectCombobox
                value={lineItProjectId}
                onValueChange={setLineItProjectId}
                allowEmpty
                placeholder="— Aucun projet —"
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <SearchableSelect
                value={lineCategorieSelect}
                onValueChange={(v) => {
                  setLineCategorieSelect(v);
                  setLineSousCategorie('');
                }}
                options={lineCategorieOptions.map((c) => ({ value: c, label: c }))}
                allowCustom
                customPlaceholder="Ajouter une nouvelle catégorie"
                searchPlaceholder="Rechercher ou saisir une catégorie..."
              />
            </div>
            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <SearchableSelect
                value={lineSousCategorie}
                onValueChange={setLineSousCategorie}
                options={lineSousCategorieOptions.map((o) => ({ value: o, label: o }))}
                allowCustom
                customPlaceholder="Ajouter une nouvelle sous-catégorie"
                searchPlaceholder="Rechercher ou saisir une sous-catégorie..."
                placeholder="— Sous-catégorie —"
              />
            </div>
            <div className="space-y-2">
              <Label>Fournisseur prévu</Label>
              <SupplierCombobox
                value={lineFournisseur ?? ''}
                onValueChange={(v) => setLineFournisseur(v)}
                placeholder="— Aucun —"
              />
            </div>
            <div className="space-y-2">
              <Label>Type de dépense</Label>
              <Select value={lineTypeDepense} onValueChange={(v) => setLineTypeDepense(v as TypeDepense)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Opex">Opex</SelectItem>
                  <SelectItem value="Capex">Capex</SelectItem>
                  <SelectItem value="RH">RH</SelectItem>
                  <SelectItem value="Amortissement">Amortissement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nature de dépense</Label>
              <SearchableSelect
                value={lineNatureDepense}
                onValueChange={setLineNatureDepense}
                options={lineNatureDepenseOptions.map((o) => ({ value: o, label: o }))}
                allowCustom
                customPlaceholder="Ajouter une nouvelle nature de dépense"
                searchPlaceholder="Rechercher ou saisir une nature..."
                placeholder="— Nature de dépense —"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={lineDescription} onChange={(e) => setLineDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type de budget</Label>
                <Select
                  value={lineBudgetType}
                  onValueChange={(v) => setLineBudgetType(v as BudgetType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensuel">Mensuel (même montant/mois)</SelectItem>
                    <SelectItem value="annuel">Annuel (décaissement unique)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {lineBudgetType === 'annuel' && (
                <div className="space-y-2">
                  <Label>Mois de décaissement prévu</Label>
                  <Select value={lineMoisDecaissement} onValueChange={setLineMoisDecaissement}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOIS_LONGS.map((label, i) => (
                        <SelectItem key={label} value={String(i + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                {lineBudgetType === 'mensuel'
                  ? 'Montant mensuel (requis)'
                  : 'Montant annuel (requis)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                required
                value={lineMontantBudget}
                onChange={(e) => setLineMontantBudget(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {lineBudgetType === 'mensuel'
                  ? 'Ce montant sera appliqué à chaque mois de l’année.'
                  : 'Montant total décaissé sur le mois sélectionné.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Budget révisé (optionnel)</Label>
              <Input type="number" step="0.01" value={lineMontantRevise} onChange={(e) => setLineMontantRevise(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={lineStatut} onValueChange={(v) => setLineStatut(v as BudgetLineStatut)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_LINE_STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {BUDGET_LINE_STATUT_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commentaire</Label>
              <Textarea rows={3} value={lineCommentaire} onChange={(e) => setLineCommentaire(e.target.value)} />
            </div>
            </TabsContent>
            <TabsContent value="rapprochement" className="py-2 mt-2">
              <BudgetLineRapprochementPanel
                budgetLineId={editingLine?.id ?? null}
                fournisseurPrevu={lineFournisseur || null}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setLineDialogOpen(false); setEditingLine(null); }}>
              Annuler
            </Button>
            <Button type="button" onClick={submitLine} disabled={lineSaving}>
              {lineSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseDialogOpen} onOpenChange={(o) => { if (!o) { setExpenseDialogOpen(false); setEditingExpense(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense manuelle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Entité</Label>
                <EntityCombobox value={expEntite ?? ''} onValueChange={(v) => setExpEntite(v)} allowEmpty />
              </div>
              <div className="space-y-2">
                <Label>Année</Label>
                <Select value={expAnnee} onValueChange={setExpAnnee}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_BUDGET_ANNEES.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Référence projet (it_project_id)</Label>
              <Input
                placeholder="UUID ou texte brut selon votre schéma"
                value={expItProjectId}
                onChange={(e) => setExpItProjectId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de prévision</Label>
              <Select value={expTypePrevision} onValueChange={(v) => setExpTypePrevision(v as ITManualExpense['type_prevision'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_PREVISION_LABEL) as ITManualExpense['type_prevision'][]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TYPE_PREVISION_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fournisseur</Label>
              <Input value={expFournisseur} onChange={(e) => setExpFournisseur(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={expDescription} onChange={(e) => setExpDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date prévue</Label>
              <Input type="date" value={expDatePrevue} onChange={(e) => setExpDatePrevue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Montant prévu (requis)</Label>
              <Input type="number" step="0.01" value={expMontant} onChange={(e) => setExpMontant(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={expStatut} onValueChange={(v) => setExpStatut(v as ITManualExpense['statut'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="confirme">Confirmé</SelectItem>
                  <SelectItem value="annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commentaire</Label>
              <Textarea rows={3} value={expCommentaire} onChange={(e) => setExpCommentaire(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}>
              Annuler
            </Button>
            <Button type="button" onClick={submitExpense} disabled={expenseSaving}>
              {expenseSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLineId} onOpenChange={() => setDeleteLineId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={confirmDeleteLine}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>La dépense manuelle sera supprimée définitivement.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={confirmDeleteExpense}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkRapprochementDialog
        open={bulkRapprochementOpen}
        onOpenChange={setBulkRapprochementOpen}
        selectedIds={Array.from(selectedLineIds)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['it-budget-commandes-liees'] });
          queryClient.invalidateQueries({ queryKey: ['it-budget-factures-liees'] });
          queryClient.invalidateQueries({ queryKey: ['it-budget-engage-constate'] });
          clearSelection();
        }}
      />
    </Layout>
  );
}
