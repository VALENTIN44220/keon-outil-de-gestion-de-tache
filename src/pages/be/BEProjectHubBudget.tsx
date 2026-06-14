import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { useBEProjectHubCode } from '@/hooks/useBEProjectHubCode';
import { useBEAffaires } from '@/hooks/useBEAffaires';
import { useBEGroupeKpis } from '@/hooks/useBEGroupeKpi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Building2,
  Loader2,
  Coins,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { useUserRole } from '@/hooks/useUserRole';
import { BEBudgetKpiCards } from '@/components/be/budget/BEBudgetKpiCards';
import { BEAffaireCard } from '@/components/be/budget/BEAffaireCard';
import { BEAffaireDialog } from '@/components/be/budget/BEAffaireDialog';
import { BEGroupeHeader } from '@/components/be/budget/BEGroupeHeader';
import {
  BEAffaireTable,
  BE_AFFAIRE_DEFAULT_COLS,
  BE_AFFAIRE_COLUMNS,
  type BEAffaireColumnKey,
} from '@/components/be/budget/BEAffaireTable';
import {
  BE_AFFAIRE_STATUS_CONFIG,
  type BEAffaire,
  type BEAffaireStatus,
} from '@/types/beAffaire';

type ViewMode = 'cards' | 'table';
const VIEW_MODE_KEY = 'be-budget-view-mode';
const COLS_KEY = 'be-budget-columns';

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'table';
  const v = window.localStorage.getItem(VIEW_MODE_KEY);
  return v === 'cards' || v === 'table' ? v : 'table';
}

function loadColumns(): BEAffaireColumnKey[] {
  if (typeof window === 'undefined') return BE_AFFAIRE_DEFAULT_COLS;
  try {
    const raw = window.localStorage.getItem(COLS_KEY);
    if (!raw) return BE_AFFAIRE_DEFAULT_COLS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return BE_AFFAIRE_DEFAULT_COLS;
    const valid = BE_AFFAIRE_COLUMNS.map((c) => c.key);
    return parsed.filter((k) => valid.includes(k));
  } catch {
    return BE_AFFAIRE_DEFAULT_COLS;
  }
}

export default function BEProjectHubBudget() {
  const code = useBEProjectHubCode();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const {
    affaires,
    kpisByAffaireId,
    isLoading: affairesLoading,
    deleteAffaire,
  } = useBEAffaires(project?.id);
  const { byCode: groupeKpiByCode } = useBEGroupeKpis(project?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BEAffaireStatus | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [columns, setColumns] = useState<BEAffaireColumnKey[]>(loadColumns);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingAffaire, setEditingAffaire] = useState<BEAffaire | null>(null);
  const [deletingAffaire, setDeletingAffaire] = useState<BEAffaire | null>(null);

  const navigateToAffaire = (a: BEAffaire) =>
    navigate(`/be/projects/${code}/budget/${a.code_affaire}`);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* noop */ }
  }, [viewMode]);

  useEffect(() => {
    try { window.localStorage.setItem(COLS_KEY, JSON.stringify(columns)); } catch { /* noop */ }
  }, [columns]);

  // KPIs projet = somme des affaires (CA / COGS / Marge brute + directe + cout RH)
  const projectKpis = useMemo(() => {
    let caEngage = 0;
    let caConstate = 0;
    let cogsConstate = 0;
    let margeBrute = 0;
    let coutRhDeclare = 0;
    let margeDirecte = 0;
    for (const a of affaires) {
      const k = kpisByAffaireId.get(a.id);
      caEngage     += k?.ca_engage_brut       ?? 0;
      caConstate   += k?.ca_constate_brut     ?? 0;
      cogsConstate += k?.cogs_constate_brut   ?? 0;
      const mb = k?.marge_brute_brut ?? k?.marge_constatee_brut
        ?? ((k?.ca_constate_brut ?? 0) - (k?.cogs_constate_brut ?? 0));
      margeBrute    += mb;
      const cr = k?.cout_rh_declare ?? 0;
      coutRhDeclare += cr;
      margeDirecte  += k?.marge_directe_brut ?? (mb - cr);
    }
    return { caEngage, caConstate, cogsConstate, margeBrute, coutRhDeclare, margeDirecte };
  }, [affaires, kpisByAffaireId]);

  // Liste des codes-groupe presents (pour le selecteur)
  const groupCodes = useMemo(() => {
    const set = new Set<string>();
    for (const a of affaires) {
      const c = a.code_affaire ?? '';
      const g = c.length >= 5 ? c.substring(0, 5).toUpperCase() : c.toUpperCase();
      if (g) set.add(g);
    }
    return Array.from(set).sort();
  }, [affaires]);

  const filteredAffaires = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return affaires.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (groupFilter !== 'all') {
        const c = a.code_affaire ?? '';
        const g = c.length >= 5 ? c.substring(0, 5).toUpperCase() : c.toUpperCase();
        if (g !== groupFilter) return false;
      }
      if (q) {
        if (
          !a.code_affaire.toLowerCase().includes(q) &&
          !(a.libelle ?? '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [affaires, searchQuery, statusFilter, groupFilter]);

  // Groupement des affaires par prefixe 5 chars (= "affaire globale")
  const groupedAffaires = useMemo(() => {
    const groups = new Map<string, typeof affaires>();
    for (const a of filteredAffaires) {
      const c = a.code_affaire ?? '';
      const groupCode = c.length >= 5 ? c.substring(0, 5).toUpperCase() : c.toUpperCase();
      if (!groups.has(groupCode)) groups.set(groupCode, []);
      groups.get(groupCode)!.push(a);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code_groupe, affaires]) => ({ code_groupe, affaires }));
  }, [filteredAffaires]);

  const expectedProjectCode = useMemo(() => {
    const cp = project?.code_projet?.trim().toUpperCase() ?? '';
    if (cp.length === 4) return cp;
    if (affaires[0]?.code_affaire && affaires[0].code_affaire.length >= 5) {
      return affaires[0].code_affaire.substring(1, 5).toUpperCase();
    }
    return null;
  }, [project?.code_projet, affaires]);

  const existingAffaireCodes = useMemo(
    () => affaires.map((a) => a.code_affaire),
    [affaires],
  );

  const handleConfirmDelete = async () => {
    if (!deletingAffaire) return;
    try {
      await deleteAffaire.mutateAsync(deletingAffaire.id);
      toast({ title: 'Affaire supprimée' });
      setDeletingAffaire(null);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: extractErrorMessage(e),
        variant: 'destructive',
      });
    }
  };

  if (projectLoading) {
    return (
      <BEProjectHubLayout>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        </div>
      </BEProjectHubLayout>
    );
  }

  if (!project) {
    return (
      <BEProjectHubLayout>
        <div className="text-center py-12 text-muted-foreground">Projet non trouvé</div>
      </BEProjectHubLayout>
    );
  }

  const hasFilters =
    !!searchQuery.trim() || statusFilter !== 'all' || groupFilter !== 'all';

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* KPIs projet */}
        <BEBudgetKpiCards
          nbAffaires={affaires.length}
          caEngage={projectKpis.caEngage}
          caConstate={projectKpis.caConstate}
          cogsConstate={projectKpis.cogsConstate}
          margeBrute={projectKpis.margeBrute}
          coutRhDeclare={projectKpis.coutRhDeclare}
          margeDirecte={projectKpis.margeDirecte}
        />

        {/* Toolbar */}
        <Card className="border-border/50">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (code, libellé)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as BEAffaireStatus | 'all')}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {(Object.keys(BE_AFFAIRE_STATUS_CONFIG) as BEAffaireStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {BE_AFFAIRE_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {groupCodes.length > 1 && (
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Groupe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous groupes</SelectItem>
                  {groupCodes.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-8 px-2', viewMode === 'table' && 'shadow-sm')}
                onClick={() => setViewMode('table')}
                title="Vue tableau"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-8 px-2', viewMode === 'cards' && 'shadow-sm')}
                onClick={() => setViewMode('cards')}
                title="Vue cartes"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>

            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="gap-1.5" title="Gérer le référentiel TJM et les postes BE des collaborateurs">
                <Link to="/be/admin/tjm">
                  <Coins className="h-4 w-4" />
                  Référentiel TJM
                </Link>
              </Button>
            )}
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nouvelle affaire
            </Button>
          </CardContent>
        </Card>

        {/* Liste */}
        {affairesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : filteredAffaires.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="p-3 rounded-full bg-muted inline-block mb-3">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium mb-1">
                {hasFilters ? 'Aucune affaire ne correspond aux filtres' : 'Aucune affaire pour ce projet'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {hasFilters
                  ? 'Modifiez votre recherche ou vos filtres.'
                  : 'Créez la première affaire pour commencer le suivi budgétaire.'}
              </p>
              {!hasFilters && (
                <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Créer une affaire
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="space-y-5">
            {groupedAffaires.map(({ code_groupe, affaires }) => (
              <div key={code_groupe} className="space-y-2">
                <BEGroupeHeader
                  codeGroupe={code_groupe}
                  nbAffaires={affaires.length}
                  kpi={groupeKpiByCode.get(code_groupe)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {affaires.map((a) => (
                    <BEAffaireCard
                      key={a.id}
                      affaire={a}
                      kpi={kpisByAffaireId.get(a.id)}
                      onSelect={() => navigateToAffaire(a)}
                      onEdit={() => setEditingAffaire(a)}
                      onDelete={() => setDeletingAffaire(a)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <BEAffaireTable
            affaires={filteredAffaires}
            kpisByAffaireId={kpisByAffaireId}
            visibleColumns={columns}
            onColumnsChange={setColumns}
            onSelect={navigateToAffaire}
            onEdit={setEditingAffaire}
            onDelete={setDeletingAffaire}
          />
        )}
      </div>

      {/* Dialogs */}
      <BEAffaireDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        beProjectId={project.id}
        expectedProjectCode={expectedProjectCode}
        existingAffaireCodes={existingAffaireCodes}
      />
      <BEAffaireDialog
        open={!!editingAffaire}
        onOpenChange={(o) => !o && setEditingAffaire(null)}
        beProjectId={project.id}
        expectedProjectCode={expectedProjectCode}
        existingAffaireCodes={existingAffaireCodes}
        affaire={editingAffaire}
      />

      {/* Confirmation delete */}
      <AlertDialog
        open={!!deletingAffaire}
        onOpenChange={(o) => !o && setDeletingAffaire(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette affaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingAffaire && (
                <>
                  L'affaire <code className="font-mono font-semibold">{deletingAffaire.code_affaire}</code>
                  {deletingAffaire.libelle ? ` (${deletingAffaire.libelle})` : ''} sera supprimée
                  ainsi que toutes ses lignes budgétaires et leurs liens vers les pièces Divalto.
                  <br />
                  <span className="text-foreground font-medium">Les pièces Divalto elles-mêmes restent intactes.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteAffaire.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BEProjectHubLayout>
  );
}
