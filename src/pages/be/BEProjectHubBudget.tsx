import { useMemo, useState } from 'react';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { useBEProjectHubCode } from '@/hooks/useBEProjectHubCode';
import { useBEAffaires } from '@/hooks/useBEAffaires';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Building2 } from 'lucide-react';
import { BEBudgetKpiCards } from '@/components/be/budget/BEBudgetKpiCards';
import { BEAffaireCard } from '@/components/be/budget/BEAffaireCard';
import { BEAffaireDialog } from '@/components/be/budget/BEAffaireDialog';
import { BEAffaireDetailSheet } from '@/components/be/budget/BEAffaireDetailSheet';
import type { BEAffaire } from '@/types/beAffaire';

export default function BEProjectHubBudget() {
  const code = useBEProjectHubCode();
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { affaires, kpisByAffaireId, isLoading: affairesLoading } = useBEAffaires(project?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAffaire, setEditingAffaire] = useState<BEAffaire | null>(null);
  const [selectedAffaire, setSelectedAffaire] = useState<BEAffaire | null>(null);

  // KPIs projet = somme des affaires
  const projectKpis = useMemo(() => {
    let budget = 0;
    let engage = 0;
    let constate = 0;
    for (const a of affaires) {
      const k = kpisByAffaireId.get(a.id);
      engage += k?.engage_montant_brut ?? 0;
      constate += k?.constate_montant_brut ?? 0;
    }
    return { budget, engage, constate };
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

  // Code projet attendu (chars 2-5 de tout code_affaire de ce projet)
  // Heuristique : on prend les 4 chars de la 1re affaire si dispo,
  // sinon on tente de deriver depuis project.code_projet (ex: 'NSK_PROJ-DOLE-...').
  const expectedProjectCode = useMemo(() => {
    if (affaires[0]?.code_affaire && affaires[0].code_affaire.length >= 5) {
      return affaires[0].code_affaire.substring(1, 5).toUpperCase();
    }
    return null;
  }, [affaires]);

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
          budget={projectKpis.budget}
          engage={projectKpis.engage}
          constate={projectKpis.constate}
          nbAffaires={affaires.length}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAffaires.map((a) => (
              <BEAffaireCard
                key={a.id}
                affaire={a}
                kpi={kpisByAffaireId.get(a.id)}
                onSelect={() => setSelectedAffaire(a)}
                onEdit={() => setEditingAffaire(a)}
              />
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
      />
      <BEAffaireDialog
        open={!!editingAffaire}
        onOpenChange={(o) => !o && setEditingAffaire(null)}
        beProjectId={project.id}
        expectedProjectCode={expectedProjectCode}
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
    </BEProjectHubLayout>
  );
}
