import { SupplierCombobox } from '@/components/it/SupplierCombobox';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { useITProjectBudget } from '@/hooks/useITProjectBudget';
import { useITBudgetOptions, PRESET_CATEGORIES } from '@/hooks/useITBudgetOptions';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { lineAnnualBudget, lineAnnualBudgetRevise } from '@/lib/itBudgetTotals';
import { useITProjects } from '@/hooks/useITProjects';
import {
  BUDGET_LINE_STATUT_CONFIG,
  itManualExpenseAnnualEquivalent,
  MANUAL_EXPENSE_MODE_LABEL,
  MANUAL_EXPENSE_SOURCE_LABEL,
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
import { ITProjectFormDialog } from '@/components/it/ITProjectFormDialog';
import {
  TrendingUp,
  RefreshCw,
  ShoppingCart,
  CheckCircle2,
  Target,
  AlertTriangle,
  TrendingDown,
  List,
  PenLine,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Plus,
  BarChart3,
  Wallet,
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
const MOIS_LABELS = MOIS_LONGS;

function formatBudgetPeriode(l: Pick<ITBudgetLine, 'budget_type' | 'mois_budget'>): string {
  if (l.budget_type === 'mensuel') return 'Mensuel';
  if (l.mois_budget == null) return 'Annuel';
  return `Annuel — ${MOIS_COURTS[l.mois_budget] ?? `M${l.mois_budget}`}`;
}

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

const REALLOC_STATUT_CLASS: Record<'en_attente' | 'valide' | 'rejete', string> = {
  en_attente: 'bg-amber-100 text-amber-800 border-amber-300',
  valide: 'bg-green-100 text-green-800 border-green-300',
  rejete: 'bg-red-100 text-red-800 border-red-300',
};

const REALLOC_STATUT_LABEL: Record<'en_attente' | 'valide' | 'rejete', string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  rejete: 'Rejeté',
};

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
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  );
}

export default function ITProjectHubBudget() {
  const { code: codeFromParams } = useParams<{ code: string }>();
  const codeFromHub = useITProjectHubCode();
  const code = codeFromParams?.trim() || codeFromHub;

  const { data: project, isLoading, refetch } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);
  const {
    lines,
    linesLoading,
    addLine,
    updateLine,
    deleteLine,
    expenses,
    expensesLoading,
    addExpense,
    updateExpense,
    deleteExpense,
    reallocations,
    kpis,
  } = useITProjectBudget(project?.id);
  const { projects: allProjects = [] } = useITProjects();

  const projectLabelById = useMemo(
    () =>
      new Map(
        allProjects.map((p) => [
          p.id,
          p.code_projet_digital ? `${p.code_projet_digital} — ${p.nom_projet}` : p.nom_projet,
        ]),
      ),
    [allProjects],
  );

  const expenseAnneeDefault = useMemo(() => {
    for (const l of lines) {
      const y = (l as { annee?: number }).annee ?? l.exercice;
      if (typeof y === 'number' && y > 0) return y;
    }
    return new Date().getFullYear();
  }, [lines]);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [filterTypeDepense, setFilterTypeDepense] = useState<string>('__all__');
  const [filterMois, setFilterMois] = useState<string>('__all__');

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ITBudgetLine | null>(null);
  const [lineSaving, setLineSaving] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ITManualExpense | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

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

  const [expTypePrevision, setExpTypePrevision] = useState<ITManualExpense['type_prevision']>('depense_prevue');
  const [expFournisseur, setExpFournisseur] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expDatePrevue, setExpDatePrevue] = useState('');
  const [expMontant, setExpMontant] = useState('');
  const [expStatut, setExpStatut] = useState<ITManualExpense['statut']>('en_attente');
  const [expCommentaire, setExpCommentaire] = useState('');
  const [expItProjectId, setExpItProjectId] = useState<string>('');
  const [expSourceDepense, setExpSourceDepense] = useState<'divalto' | 'note_de_frais' | 'autre'>('divalto');
  const [expModeDecaissement, setExpModeDecaissement] = useState<'annuel' | 'mensuel'>('annuel');
  const [expMoisApplicables, setExpMoisApplicables] = useState<number[]>([]);
  const [expCategorieSelect, setExpCategorieSelect] = useState<string>(PRESET_CATEGORIES[0]);
  const [expSousCategorie, setExpSousCategorie] = useState('');
  const [expTypeDepense, setExpTypeDepense] = useState<TypeDepense>('Opex');
  const [expNatureDepense, setExpNatureDepense] = useState('');
  const [expFournisseurPrevu, setExpFournisseurPrevu] = useState('');

  const expSousCategorieOptions = useMemo(() => {
    const base = getSousCategorieOptions(expCategorieSelect);
    if (expSousCategorie && !base.includes(expSousCategorie)) base.push(expSousCategorie);
    return base;
  }, [expCategorieSelect, expSousCategorie, getSousCategorieOptions]);

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

  const expCategorieOptions = useMemo(() => {
    const base = [...categorieOptions];
    if (expCategorieSelect && !base.includes(expCategorieSelect)) base.push(expCategorieSelect);
    return base;
  }, [categorieOptions, expCategorieSelect]);

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
  }, []);

  const openAddLine = () => {
    setEditingLine(null);
    resetLineForm();
    setLineDialogOpen(true);
  };

  const openEditLine = (line: ITBudgetLine) => {
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
    setExpItProjectId(project?.id ?? '');
    setExpSourceDepense('divalto');
    setExpModeDecaissement('annuel');
    setExpMoisApplicables([]);
    setExpCategorieSelect(PRESET_CATEGORIES[0]);
    setExpSousCategorie('');
    setExpTypeDepense('Opex');
    setExpNatureDepense('');
    setExpFournisseurPrevu('');
  }, [project?.id]);

  const openAddExpense = () => {
    setEditingExpense(null);
    resetExpenseForm();
    setExpenseDialogOpen(true);
  };

  const openEditExpense = (exp: ITManualExpense) => {
    setEditingExpense(exp);
    setExpTypePrevision(exp.type_prevision);
    setExpFournisseur(exp.fournisseur ?? '');
    setExpFournisseurPrevu(exp.fournisseur_prevu ?? exp.fournisseur ?? '');
    setExpDescription(exp.description ?? '');
    setExpDatePrevue(exp.date_prevue ? exp.date_prevue.slice(0, 10) : '');
    setExpMontant(String(exp.montant_prevu ?? ''));
    setExpStatut(exp.statut);
    setExpCommentaire(exp.commentaire ?? '');
    setExpItProjectId(exp.it_project_id ?? project?.id ?? '');
    const src = exp.source_depense;
    setExpSourceDepense(src === 'note_de_frais' || src === 'autre' ? src : 'divalto');
    const mode = exp.mode_decaissement;
    setExpModeDecaissement(mode === 'mensuel' ? 'mensuel' : 'annuel');
    setExpMoisApplicables(exp.mois_applicables ?? []);
    setExpCategorieSelect(exp.categorie?.trim() || PRESET_CATEGORIES[0]);
    setExpSousCategorie(exp.sous_categorie ?? '');
    setExpTypeDepense((exp.type_depense as TypeDepense) || 'Opex');
    setExpNatureDepense(exp.nature_depense ?? '');
    setExpenseDialogOpen(true);
  };

  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      if (filterTypeDepense !== '__all__' && (l.type_depense || '') !== filterTypeDepense) return false;
      if (filterMois !== '__all__') {
        const m = Number(filterMois);
        if (l.budget_type === 'annuel' && l.mois_budget !== m) return false;
      }
      return true;
    });
  }, [lines, filterTypeDepense, filterMois]);

  const chartRows = useMemo(() => {
    const map = new Map<string, { categorie: string; budget_initial: number; budget_revise: number }>();
    for (const l of lines) {
      const key = (l.categorie?.trim() || 'Sans catégorie');
      const cur = map.get(key) || { categorie: key, budget_initial: 0, budget_revise: 0 };
      cur.budget_initial += lineAnnualBudget(l);
      cur.budget_revise += lineAnnualBudgetRevise(l);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.categorie.localeCompare(b.categorie, 'fr'));
  }, [lines]);

  const lineLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      m.set(l.id, l.categorie || l.description || l.sous_categorie || l.id.slice(0, 8));
    }
    return m;
  }, [lines]);

  const progressValue = Math.min(100, Math.max(0, kpis.taux_consommation));

  const submitLine = async () => {
    if (!project?.id) return;
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
    setLineSaving(true);
    try {
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

      if (editingLine) {
        await updateLine.mutateAsync({
          id: editingLine.id,
          updates: {
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
          },
        });
        toast({ title: 'Ligne budgétaire mise à jour' });
      } else {
        const payload: Omit<ITBudgetLine, 'id' | 'created_at' | 'updated_at'> = {
          it_project_id: project.id,
          exercice: new Date().getFullYear(),
          version: '1',
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
          mode_saisie: 'manuel',
          commentaire: lineCommentaire || null,
          external_key: null,
        };
        await addLine.mutateAsync(payload);
        toast({ title: 'Ligne budgétaire créée' });
      }
      setLineDialogOpen(false);
      setEditingLine(null);
    } catch (e: unknown) {
      const msg = extractErrorMessage(e);
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
      const msg = extractErrorMessage(e);
      toast({ title: 'Suppression impossible', description: msg, variant: 'destructive' });
    } finally {
      setDeleteLineId(null);
    }
  };

  const submitExpense = async () => {
    if (!project?.id) return;
    const montant = Number(expMontant.replace(',', '.'));
    if (!Number.isFinite(montant)) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }
    if (expModeDecaissement === 'mensuel' && expMoisApplicables.length === 0) {
      toast({ title: 'Mois requis', description: 'Sélectionnez au moins un mois applicable.', variant: 'destructive' });
      return;
    }
    setExpenseSaving(true);
    try {
      const itPid = expItProjectId.trim() || null;
      if (editingExpense) {
        await updateExpense.mutateAsync({
          id: editingExpense.id,
          updates: {
            it_project_id: itPid,
            source_depense: expSourceDepense,
            mode_decaissement: expModeDecaissement,
            mois_applicables: expMoisApplicables.length ? expMoisApplicables : null,
            categorie: expCategorieSelect || null,
            sous_categorie: expSousCategorie || null,
            type_depense: expTypeDepense || null,
            nature_depense: expNatureDepense || null,
            fournisseur_prevu: expFournisseurPrevu || null,
            type_prevision: expTypePrevision,
            fournisseur: expFournisseur || expFournisseurPrevu || null,
            description: expDescription || null,
            date_prevue: expDatePrevue || null,
            montant_prevu: montant,
            statut: expStatut,
            commentaire: expCommentaire || null,
          },
        });
        toast({ title: 'Dépense mise à jour' });
      } else {
        const payload: Omit<ITManualExpense, 'id' | 'created_at' | 'updated_at'> = {
          it_project_id: itPid,
          it_budget_line_id: null,
          source_depense: expSourceDepense,
          mode_decaissement: expModeDecaissement,
          mois_applicables: expMoisApplicables.length ? expMoisApplicables : null,
          categorie: expCategorieSelect || null,
          sous_categorie: expSousCategorie || null,
          type_depense: expTypeDepense || null,
          nature_depense: expNatureDepense || null,
          fournisseur_prevu: expFournisseurPrevu || null,
          type_prevision: expTypePrevision,
          fournisseur: expFournisseur || expFournisseurPrevu || null,
          description: expDescription || null,
          date_prevue: expDatePrevue || null,
          montant_prevu: montant,
          statut: expStatut,
          commentaire: expCommentaire || null,
          annee: expenseAnneeDefault,
          entite: null,
        };
        await addExpense.mutateAsync(payload);
        toast({
          title: 'Dépense créée',
          description: !itPid
            ? 'Sans projet lié : retrouvez-la dans le Budget IT global.'
            : undefined,
        });
      }
      setExpenseDialogOpen(false);
      setEditingExpense(null);
    } catch (e: unknown) {
      const msg = extractErrorMessage(e);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setExpenseSaving(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      await deleteExpense.mutateAsync(deleteExpenseId);
      toast({ title: 'Dépense supprimée' });
    } catch (e: unknown) {
      const msg = extractErrorMessage(e);
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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Projet non trouvé</div>
      </Layout>
    );
  }

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
        <ITProjectHubHeader
          project={project}
          stats={stats}
          onEditProject={() => setShowEditDialog(true)}
        />

        {linesLoading ? (
          <BudgetPageSkeleton />
        ) : (
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* KPI cards */}
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:bg-slate-950/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Budget initial</span>
                  <TrendingUp className="h-4 w-4 text-slate-600 shrink-0" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {eur(kpis.budget_initial)}
                </p>
              </div>
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:bg-blue-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Budget révisé</span>
                  <RefreshCw className="h-4 w-4 text-blue-600 shrink-0" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-blue-800 dark:text-blue-200">
                  {eur(kpis.budget_revise)}
                </p>
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
                <p className="mt-2 text-xl font-bold tabular-nums text-indigo-800 dark:text-indigo-200">
                  {eur(kpis.engage)}
                </p>
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
                <p className="mt-2 text-xl font-bold tabular-nums text-violet-800 dark:text-violet-200">
                  {eur(kpis.constate)}
                </p>
              </div>
              <div className="flex flex-1 min-w-[160px] max-w-[220px] flex-col rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:bg-amber-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Forecast fin d&apos;année</span>
                  <Target className="h-4 w-4 text-amber-600 shrink-0" />
                </div>
                <p className="mt-2 text-xl font-bold tabular-nums text-amber-900 dark:text-amber-100">
                  {eur(kpis.forecast_fin_annee)}
                </p>
              </div>
              {depassementCard}
            </div>

            {/* Progress */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium">Taux de consommation budgétaire</span>
                  <span className="text-xs text-muted-foreground sm:text-right">
                    {kpis.taux_consommation}% — Constaté {eur(kpis.constate)} / Budget révisé {eur(kpis.budget_revise)}
                  </span>
                </div>
                <Progress value={progressValue} className="h-3" />
                <p className="text-[11px] text-muted-foreground">
                  ℹ Engagé et Constaté seront alimentés depuis Divalto (Phase 2)
                </p>
              </CardContent>
            </Card>

            <Tabs defaultValue="lines" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="lines" className="gap-2">
                  <List className="h-4 w-4" />
                  Lignes budgétaires
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-2">
                  <PenLine className="h-4 w-4" />
                  Dépenses manuelles
                </TabsTrigger>
                <TabsTrigger value="realloc" className="gap-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  Réaffectations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lines" className="space-y-4 mt-4">
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
                  <Button onClick={openAddLine} className="gap-2 ml-auto">
                    <Plus className="h-4 w-4" />
                    + Ajouter une ligne
                  </Button>
                </div>

                {filteredLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
                    <Wallet className="h-12 w-12 opacity-40 mb-3" />
                    <p className="text-sm font-medium text-foreground max-w-md">
                      Aucune ligne budgétaire — commencez par en ajouter une
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Catégorie</TableHead>
                          <TableHead>Sous-catégorie</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Périodicité</TableHead>
                          <TableHead className="text-right">Budget initial</TableHead>
                          <TableHead className="text-right">Budget révisé</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLines.map((l) => {
                          const st = BUDGET_LINE_STATUT_CONFIG[l.statut];
                          return (
                            <TableRow key={l.id}>
                              <TableCell className="font-medium">{l.categorie ?? '—'}</TableCell>
                              <TableCell>{l.sous_categorie ?? '—'}</TableCell>
                              <TableCell>{l.fournisseur_prevu ?? '—'}</TableCell>
                              <TableCell>{l.type_depense ?? '—'}</TableCell>
                              <TableCell>{formatBudgetPeriode(l)}</TableCell>
                              <TableCell className="text-right tabular-nums">{eur(lineAnnualBudget(l))}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {eur(lineAnnualBudgetRevise(l))}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn('border', st.className)}>
                                  {st.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="expenses" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground rounded-md border border-blue-200/60 bg-blue-50/40 px-3 py-2 dark:bg-blue-950/20">
                  Les dépenses Divalto (CFK commandes / FFK factures) seront connectées en Phase 2
                </p>
                <Button onClick={openAddExpense} className="gap-2">
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
                          <TableHead>Projet IT</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Décaissement</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Fournisseur</TableHead>
                          <TableHead>Date prévue</TableHead>
                          <TableHead className="text-right">Montant saisi</TableHead>
                          <TableHead className="text-right">Total année</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((e) => {
                          const projetLabel = e.it_project_id
                            ? (projectLabelById.get(e.it_project_id) ?? `${e.it_project_id.slice(0, 8)}…`)
                            : '—';
                          const srcKey = e.source_depense ?? 'divalto';
                          const modeKey = e.mode_decaissement ?? 'annuel';
                          return (
                          <TableRow key={e.id}>
                            <TableCell>{e.description ?? '—'}</TableCell>
                            <TableCell className="max-w-[10rem] truncate" title={projetLabel}>
                              {projetLabel}
                            </TableCell>
                            <TableCell>{MANUAL_EXPENSE_SOURCE_LABEL[srcKey] ?? srcKey}</TableCell>
                            <TableCell>{MANUAL_EXPENSE_MODE_LABEL[modeKey] ?? modeKey}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn('border', TYPE_PREVISION_CLASS[e.type_prevision])}
                              >
                                {TYPE_PREVISION_LABEL[e.type_prevision]}
                              </Badge>
                            </TableCell>
                            <TableCell>{e.fournisseur ?? e.fournisseur_prevu ?? '—'}</TableCell>
                            <TableCell>
                              {e.date_prevue
                                ? format(new Date(e.date_prevue), 'dd/MM/yyyy', { locale: fr })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{eur(e.montant_prevu ?? 0)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {eur(itManualExpenseAnnualEquivalent(e))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('border', EXPENSE_STATUT_CLASS[e.statut])}>
                                {EXPENSE_STATUT_LABEL[e.statut]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditExpense(e)}
                                  aria-label="Éditer"
                                >
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
                {expensesLoading && (
                  <p className="text-xs text-muted-foreground">Chargement des dépenses…</p>
                )}
              </TabsContent>

              <TabsContent value="realloc" className="space-y-4 mt-4">
                {reallocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl">
                    Aucune réaffectation budgétaire enregistrée
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>De</TableHead>
                          <TableHead>Vers</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reallocations.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              {r.from_budget_line_id
                                ? lineLabelById.get(r.from_budget_line_id) ?? r.from_budget_line_id.slice(0, 8)
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {r.to_budget_line_id
                                ? lineLabelById.get(r.to_budget_line_id) ?? r.to_budget_line_id.slice(0, 8)
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{eur(r.montant)}</TableCell>
                            <TableCell>{r.motif ?? '—'}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn('border', REALLOC_STATUT_CLASS[r.statut_validation])}
                              >
                                {REALLOC_STATUT_LABEL[r.statut_validation]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {r.created_at
                                ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Chart */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-4">Répartition par catégorie</h3>
                {chartRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed rounded-lg">
                    <BarChart3 className="h-10 w-10 opacity-40 mb-2" />
                    <p className="text-sm">Aucune donnée à afficher</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="categorie" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
                      <RechartsTooltip
                        formatter={(value: number) => eur(value)}
                        labelFormatter={(l) => String(l)}
                      />
                      <Legend />
                      <Bar dataKey="budget_initial" name="Budget initial" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="budget_revise" name="Budget révisé" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <ITProjectFormDialog
        open={showEditDialog}
        project={project}
        onClose={() => setShowEditDialog(false)}
        onSaved={refetch}
      />

      <Dialog open={lineDialogOpen} onOpenChange={(o) => { if (!o) { setLineDialogOpen(false); setEditingLine(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Modifier la ligne budgétaire' : 'Nouvelle ligne budgétaire'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
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
                <Select value={lineBudgetType} onValueChange={(v) => setLineBudgetType(v as BudgetType)}>
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
              <Input
                type="number"
                step="0.01"
                value={lineMontantRevise}
                onChange={(e) => setLineMontantRevise(e.target.value)}
              />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLineDialogOpen(false); setEditingLine(null); }}>
              Annuler
            </Button>
            <Button onClick={submitLine} disabled={lineSaving}>
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
            <div className="space-y-2">
              <Label>Projet IT (optionnel)</Label>
              <Select value={expItProjectId || '__none__'} onValueChange={(v) => setExpItProjectId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="— Aucun —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {allProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code_projet_digital ? `${p.code_projet_digital} — ${p.nom_projet}` : p.nom_projet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={expSourceDepense} onValueChange={(v) => setExpSourceDepense(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="divalto">Divalto</SelectItem>
                    <SelectItem value="note_de_frais">Note de frais</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Décaissement</Label>
                <Select value={expModeDecaissement} onValueChange={(v) => setExpModeDecaissement(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annuel">Annuel</SelectItem>
                    <SelectItem value="mensuel">Mensuel (montant / mois)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mois applicables</Label>
              <div className="flex flex-wrap gap-2">
                {MOIS_LABELS.map((label, i) => {
                  const month = i + 1;
                  const checked = expMoisApplicables.includes(month);
                  return (
                    <label key={label} className="flex items-center gap-2 text-xs rounded-md border px-2 py-1 cursor-pointer select-none">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                          setExpMoisApplicables((prev) => {
                            const next = new Set(prev);
                            if (next.has(month)) next.delete(month);
                            else next.add(month);
                            return Array.from(next).sort((a, b) => a - b);
                          });
                        }}
                        aria-label={label}
                      />
                      <span>{label.slice(0, 3)}</span>
                    </label>
                  );
                })}
              </div>
              {expModeDecaissement === 'mensuel' && (
                <p className="text-[11px] text-muted-foreground">
                  Total annuel estimé : {eur((Number(expMontant.replace(',', '.')) || 0) * (expMoisApplicables.length || 0))}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={expCategorieSelect}
                onValueChange={(v) => {
                  setExpCategorieSelect(v);
                  setExpSousCategorie('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expCategorieOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <Select value={expSousCategorie || '__none__'} onValueChange={(v) => setExpSousCategorie(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sous-catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {expSousCategorieOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type de prévision</Label>
              <Select
                value={expTypePrevision}
                onValueChange={(v) => setExpTypePrevision(v as ITManualExpense['type_prevision'])}
              >
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
              <Label>Type de dépense</Label>
              <Select value={expTypeDepense} onValueChange={(v) => setExpTypeDepense(v as TypeDepense)}>
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
              <Input value={expNatureDepense} onChange={(e) => setExpNatureDepense(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fournisseur prévu</Label>
              <SupplierCombobox
                value={expFournisseurPrevu ?? ''}
                onValueChange={(v) => setExpFournisseurPrevu(v)}
                placeholder="— Aucun —"
              />
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
            <Button variant="outline" onClick={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}>
              Annuler
            </Button>
            <Button onClick={submitExpense} disabled={expenseSaving}>
              {expenseSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLineId} onOpenChange={() => setDeleteLineId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La ligne budgétaire sera définitivement supprimée.
            </AlertDialogDescription>
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
    </Layout>
  );
}
