import { Fragment, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Wallet,
  Receipt,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Loader2,
  Clock,
  CalendarDays,
  CalendarCheck,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import {
  BEAffaire,
  BEAffaireBudgetLine,
  BE_AFFAIRE_STATUS_CONFIG,
  BE_BUDGET_LINE_STATUT_CONFIG,
} from '@/types/beAffaire';
import { useBEAffaireBudget } from '@/hooks/useBEAffaireBudget';
import { useBEAffaireTemps } from '@/hooks/useBEAffaireTemps';
import { BEBudgetLineDialog } from './BEBudgetLineDialog';
import { BEBudgetRapprochementPanel } from './BEBudgetRapprochementPanel';
import { BETempsBudgetDialog } from './BETempsBudgetDialog';
import { BE_POSTE_ICON, BE_POSTE_LABEL } from '@/types/beTemps';

const eur = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface BEAffaireDetailSheetProps {
  affaire: BEAffaire | null;
  onOpenChange: (open: boolean) => void;
  onEditAffaire: (affaire: BEAffaire) => void;
}

export function BEAffaireDetailSheet({
  affaire,
  onOpenChange,
  onEditAffaire,
}: BEAffaireDetailSheetProps) {
  const open = !!affaire;
  const affaireId = affaire?.id;
  const codeAffaire = affaire?.code_affaire ?? null;

  const { lines, linesLoading, kpis, deleteLine } = useBEAffaireBudget(affaireId);
  const { budgetLines: tempsBudgetLines, kpi: tempsKpi } = useBEAffaireTemps(affaireId);

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BEAffaireBudgetLine | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);
  const [tempsDialogOpen, setTempsDialogOpen] = useState(false);

  const handleEdit = (line: BEAffaireBudgetLine) => {
    setEditingLine(line);
    setLineDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingLine(null);
    setLineDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingLineId) return;
    try {
      await deleteLine.mutateAsync(deletingLineId);
      toast({ title: 'Ligne supprimée' });
      if (expandedLineId === deletingLineId) setExpandedLineId(null);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: extractErrorMessage(e),
        variant: 'destructive',
      });
    } finally {
      setDeletingLineId(null);
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedLineId((prev) => (prev === id ? null : id));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto"
        >
          {affaire && (
            <>
              <SheetHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {affaire.code_affaire}
                      </code>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border',
                          BE_AFFAIRE_STATUS_CONFIG[affaire.status].className,
                        )}
                      >
                        {BE_AFFAIRE_STATUS_CONFIG[affaire.status].label}
                      </Badge>
                    </div>
                    <SheetTitle className="text-lg">
                      {affaire.libelle || 'Affaire sans libellé'}
                    </SheetTitle>
                    {affaire.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {affaire.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => onEditAffaire(affaire)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </Button>
                </div>

                {/* KPIs CA / COGS / Marge */}
                <div className="grid grid-cols-3 gap-2">
                  <KpiMini
                    label="CA Constaté"
                    value={eur(kpis.ca_constate)}
                    icon={Receipt}
                    accent="text-indigo-600"
                    hint={kpis.ca_engage > 0 ? `Engagé ${eur(kpis.ca_engage)}` : undefined}
                  />
                  <KpiMini
                    label="COGS Constaté"
                    value={eur(kpis.cogs_constate)}
                    icon={ReceiptText}
                    accent="text-amber-600"
                    hint={kpis.cogs_engage > 0 ? `Engagé ${eur(kpis.cogs_engage)}` : undefined}
                  />
                  <KpiMini
                    label={kpis.marge_constatee < 0 ? 'Marge négative' : 'Marge Constatée'}
                    value={eur(kpis.marge_constatee)}
                    icon={kpis.marge_constatee < 0 ? TrendingDown : TrendingUp}
                    accent={kpis.marge_constatee < 0 ? 'text-red-600' : 'text-emerald-600'}
                    hint={
                      kpis.ca_constate > 0
                        ? `${Math.round((kpis.marge_constatee / kpis.ca_constate) * 100)}% du CA`
                        : undefined
                    }
                  />
                </div>
                {kpis.budget_initial > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    Budget prévisionnel saisi : <span className="font-semibold tabular-nums text-foreground">{eur(kpis.budget_revise || kpis.budget_initial)}</span>
                  </div>
                )}
              </SheetHeader>

              {/* Section Temps & RH */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Temps & RH
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTempsDialogOpen(true)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Saisir le budget temps
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <KpiMini
                    label="Budgété"
                    value={`${(tempsKpi?.jours_budgetes ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`}
                    icon={CalendarDays}
                    accent="text-slate-600"
                    hint={tempsKpi?.cout_rh_budgete ? eur(tempsKpi.cout_rh_budgete) : undefined}
                  />
                  <KpiMini
                    label="Planifié"
                    value={`${(tempsKpi?.jours_planifies ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`}
                    icon={CalendarCheck}
                    accent="text-blue-600"
                    hint={tempsKpi?.cout_rh_planifie ? eur(tempsKpi.cout_rh_planifie) : undefined}
                  />
                  <KpiMini
                    label="Déclaré"
                    value={`${(tempsKpi?.jours_declares ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`}
                    icon={Clock}
                    accent="text-emerald-600"
                    hint={
                      tempsKpi?.heures_declarees
                        ? `${tempsKpi.heures_declarees.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} h`
                        : undefined
                    }
                  />
                  <KpiMini
                    label="Coût RH déclaré"
                    value={eur(tempsKpi?.cout_rh_declare ?? 0)}
                    icon={Coins}
                    accent="text-amber-600"
                  />
                </div>

                {tempsBudgetLines.length > 0 && (
                  <div className="rounded-lg border bg-muted/10 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 px-1">
                      Ventilation budget temps par poste
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                      {tempsBudgetLines.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between text-xs px-1 py-0.5"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{BE_POSTE_ICON[b.poste]}</span>
                            <span className="text-muted-foreground">{BE_POSTE_LABEL[b.poste]}</span>
                          </span>
                          <span className="font-semibold tabular-nums">
                            {b.jours_budgetes.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lignes budgetaires */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Lignes budgétaires
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {lines.length}
                    </Badge>
                  </h3>
                  <Button size="sm" onClick={handleAddNew} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter une ligne
                  </Button>
                </div>

                {linesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : lines.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
                    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Aucune ligne budgétaire pour cette affaire.
                    <br />
                    Ajoutez-en une pour commencer le rapprochement Divalto.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Poste</TableHead>
                          <TableHead className="text-right">Budget HT</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => {
                          const expanded = expandedLineId === line.id;
                          const statutCfg = BE_BUDGET_LINE_STATUT_CONFIG[line.statut];
                          const budget = line.montant_budget_revise ?? line.montant_budget;

                          return (
                            <Fragment key={line.id}>
                              <TableRow className="hover:bg-muted/30">
                                <TableCell className="p-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleExpand(line.id)}
                                    title={expanded ? 'Fermer' : 'Voir le rapprochement'}
                                  >
                                    {expanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell
                                  className="cursor-pointer"
                                  onClick={() => toggleExpand(line.id)}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{line.poste}</span>
                                    {line.fournisseur_prevu && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {line.fournisseur_prevu}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                  {eur(budget)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[10px] border', statutCfg.className)}
                                  >
                                    {statutCfg.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(line);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingLineId(line.id);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {expanded && (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={5} className="bg-muted/20 p-4">
                                    <BEBudgetRapprochementPanel
                                      budgetLineId={line.id}
                                      codeAffaire={codeAffaire}
                                    />
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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {affaireId && (
        <BEBudgetLineDialog
          open={lineDialogOpen}
          onOpenChange={setLineDialogOpen}
          affaireId={affaireId}
          line={editingLine}
        />
      )}

      {affaireId && codeAffaire && (
        <BETempsBudgetDialog
          open={tempsDialogOpen}
          onOpenChange={setTempsDialogOpen}
          affaireId={affaireId}
          codeAffaire={codeAffaire}
        />
      )}

      <AlertDialog
        open={!!deletingLineId}
        onOpenChange={(o) => !o && setDeletingLineId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la ligne ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les liens vers les pièces Divalto seront aussi supprimés
              (les pièces elles-mêmes restent intactes).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteLine.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface KpiMiniProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  hint?: string;
}

function KpiMini({ label, value, icon: Icon, accent, hint }: KpiMiniProps) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
        <Icon className={cn('h-3 w-3', accent)} />
        {label}
      </div>
      <p className="text-sm font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}
