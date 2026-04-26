import { useMemo, useState } from 'react';
import { LayoutGrid, Map as MapIcon, Network, Plus, Search } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useITSolutions } from '@/hooks/useITSolutions';
import { ITSolutionFormDialog } from '@/components/it/ITSolutionFormDialog';
import { ITSolutionDetailDialog } from '@/components/it/ITSolutionDetailDialog';
import { ITCartographieGraph } from '@/components/it/ITCartographieGraph';
import {
  CRITICITE_CONFIG,
  DATALAKE_CONFIG,
  type ITSolution,
} from '@/types/itSolution';

export default function ITCartographie() {
  const { solutions, links, solutionLinks, isLoading } = useITSolutions();
  const [view, setView] = useState<'cards' | 'graph'>('cards');
  const [search, setSearch] = useState('');
  const [filterCriticite, setFilterCriticite] = useState<string>('__all__');
  const [filterDatalake, setFilterDatalake] = useState<string>('__all__');
  const [selected, setSelected] = useState<ITSolution | null>(null);
  const [editing, setEditing] = useState<ITSolution | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const linkCountBySolution = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.solution_id, (m.get(l.solution_id) ?? 0) + 1);
    return m;
  }, [links]);

  const filteredSolutions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return solutions.filter((s) => {
      if (q && !(`${s.nom} ${s.categorie ?? ''} ${s.type ?? ''} ${s.usage_principal ?? ''}`.toLowerCase().includes(q))) {
        return false;
      }
      if (filterCriticite !== '__all__' && (s.criticite ?? '') !== filterCriticite) return false;
      if (filterDatalake !== '__all__' && (s.connecte_datalake ?? '') !== filterDatalake) return false;
      return true;
    });
  }, [solutions, search, filterCriticite, filterDatalake]);

  const groupedByCategorie = useMemo(() => {
    const map = new Map<string, ITSolution[]>();
    for (const s of filteredSolutions) {
      const key = s.categorie?.trim() || 'Sans catégorie';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSolutions]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <header className="px-6 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapIcon className="h-7 w-7 text-violet-600" />
              Cartographie IT
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Catalogue des solutions IT en place chez KEON et leurs projets associés.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as 'cards' | 'graph')}>
              <TabsList>
                <TabsTrigger value="cards" className="gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </TabsTrigger>
                <TabsTrigger value="graph" className="gap-1.5">
                  <Network className="h-3.5 w-3.5" />
                  Graphe
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button type="button" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle solution
            </Button>
          </div>
        </header>

        <div className={cn(
          'px-6 py-3 border-b bg-muted/30 flex flex-wrap gap-3 items-center',
          view === 'graph' && 'hidden'
        )}>
          <div className="relative flex-1 min-w-[240px] max-w-[420px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, catégorie, usage..."
              className="pl-8"
            />
          </div>
          <Select value={filterCriticite} onValueChange={setFilterCriticite}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Criticité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes criticités</SelectItem>
              {Object.entries(CRITICITE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDatalake} onValueChange={setFilterDatalake}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Datalake" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous statuts datalake</SelectItem>
              {Object.entries(DATALAKE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredSolutions.length} solution{filteredSolutions.length > 1 ? 's' : ''}
          </span>
        </div>

        {view === 'graph' ? (
          <div className="flex-1 min-h-[480px]">
            <ITCartographieGraph
              solutions={solutions}
              links={solutionLinks}
              onSelectSolution={(s) => setSelected(s)}
            />
          </div>
        ) : (
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : groupedByCategorie.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
              <MapIcon className="h-12 w-12 opacity-40 mb-3" />
              <p className="text-sm font-medium text-foreground max-w-md">
                {solutions.length === 0
                  ? 'Aucune solution cataloguée pour le moment — démarrez avec « Nouvelle solution ».'
                  : 'Aucun résultat avec ces filtres.'}
              </p>
            </div>
          ) : (
            groupedByCategorie.map(([categorie, items]) => (
              <section key={categorie} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold tracking-tight">{categorie}</h2>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((s) => {
                    const criticite = s.criticite ? CRITICITE_CONFIG[s.criticite] : null;
                    const datalake = s.connecte_datalake ? DATALAKE_CONFIG[s.connecte_datalake] : null;
                    const nbProjets = linkCountBySolution.get(s.id) ?? 0;
                    return (
                      <Card
                        key={s.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelected(s)}
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate">{s.nom}</p>
                              {s.type && (
                                <p className="text-[11px] text-muted-foreground">{s.type}</p>
                              )}
                            </div>
                            {criticite && (
                              <Badge variant="outline" className={cn('shrink-0 border text-[10px]', criticite.className)}>
                                {criticite.label}
                              </Badge>
                            )}
                          </div>
                          {s.usage_principal && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{s.usage_principal}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              {datalake && (
                                <Badge variant="outline" className={cn('border text-[10px]', datalake.className)}>
                                  {datalake.label}
                                </Badge>
                              )}
                              {s.perimetre && (
                                <Badge variant="outline" className="text-[10px]">{s.perimetre}</Badge>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {nbProjets} projet{nbProjets > 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {s.statut_temporalite && (
                            <p className="text-[10px] text-muted-foreground italic line-clamp-1 pt-1">
                              {s.statut_temporalite}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
        )}
      </div>

      <ITSolutionDetailDialog
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        solution={selected}
        onEdit={(s) => {
          setSelected(null);
          setEditing(s);
          setFormOpen(true);
        }}
      />

      <ITSolutionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        solution={editing}
        onSaved={() => { /* React Query invalide tout via le hook */ }}
      />
    </Layout>
  );
}
