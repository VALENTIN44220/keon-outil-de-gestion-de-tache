import { useMemo, useState } from 'react';
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
import { Plus, Search, Building2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/extractErrorMessage';
import { BEBudgetKpiCards } from '@/components/be/budget/BEBudgetKpiCards';
import { BEAffaireCard } from '@/components/be/budget/BEAffaireCard';
import { BEAffaireDialog } from '@/components/be/budget/BEAffaireDialog';
import { BEAffaireDetailSheet } from '@/components/be/budget/BEAffaireDetailSheet';
import { BEGroupeHeader } from '@/components/be/budget/BEGroupeHeader';
import type { BEAffaire } from '@/types/beAffaire';

export default function BEProjectHubBudget() {
  const code = useBEProjectHubCode();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const {
    affaires,
    kpisByAffaireId,
    isLoading: affairesLoading,
    deleteAffaire,
  } = useBEAffaires(project?.id);
  const { byCode: groupeKpiByCode } = useBEGroupeKpis(project?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAffaire, setEditingAffaire] = useState<BEAffaire | null>(null);
  const [selectedAffaire, setSelectedAffaire] = useState<BEAffaire | null>(null);
  const [deletingAffaire, setDeletingAffaire] = useState<BEAffaire | null>(null);

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

  const filteredAffaires = useMemo(() => {
    if (!searchQuery.trim()) return affaires;
    const q = searchQuery.trim().toLowerCase();
    return affaires.filter(
      (a) =>
        a.code_affaire.toLowerCase().includes(q) ||
        (a.libelle ?? '').toLowerCase().includes(q),
    );
  }, [affaires, searchQuery]);

  // Groupement des affaires par prefixe 5 chars (= "affaire globale")
  const groupedAffaires = useMemo(() => {
    const groups = new Map<string, typeof affaires>();
    for (const a of filteredAffaires) {
      const code = a.code_affaire ?? '';
      const groupCode = code.length >= 5 ? code.substring(0, 5).toUpperCase() : code.toUpperCase();
      if (!groups.has(groupCode)) groups.set(groupCode, []);
      groups.get(groupCode)!.push(a);
    }
    // Tri : par code_groupe alpha
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code_groupe, affaires]) => ({ code_groupe, affaires }));
  }, [filteredAffaires]);

  // Code projet attendu (chars 2-5 d'un code_affaire). Priorite :
  //  1. project.code_projet si exactement 4 chars (cas standard ex. 'VINZ')
  //  2. Chars 2-5 de la 1re affaire existante (fallback)
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
          <CardContent className="p-3 flex items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une affaire (code, libellé)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nouvelle affaire
            </Button>
          </CardContent>
        </Card>

        {/* Affaires grid */}
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
                {searchQuery ? 'Aucune affaire trouvée' : 'Aucune affaire pour ce projet'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? 'Modifiez votre recherche.'
                  : 'Créez la première affaire pour commencer le suivi budgétaire.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Créer une affaire
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
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
                      onSelect={() => setSelectedAffaire(a)}
                      onEdit={() => setEditingAffaire(a)}
                      onDelete={() => setDeletingAffaire(a)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
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

      <BEAffaireDetailSheet
        affaire={selectedAffaire}
        onOpenChange={(o) => !o && setSelectedAffaire(null)}
        onEditAffaire={(a) => {
          setSelectedAffaire(null);
          setEditingAffaire(a);
        }}
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
