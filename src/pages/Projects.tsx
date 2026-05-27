/**
 * Projects — Vue d'accueil des projets Bureau d'Études.
 *
 * Affiche :
 *  - Filtres multicritères (statut projet, présence d'affaires, statut des affaires)
 *  - Tri (code, nom, nb d'affaires, date de création)
 *  - Liste des projets avec statut et affaires associées dépliables
 *
 * (La vue budget est disponible dans /be/budget)
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useBEProjects } from '@/hooks/useBEProjects';
import { supabase } from '@/integrations/supabase/client';
import { NewBERequestDialog } from '@/components/be/NewBERequestDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  FolderOpen,
  Loader2,
  Search,
  ExternalLink,
  Filter,
  ArrowDown,
  ArrowUp,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BEAffaire, BEAffaireStatus } from '@/types/beAffaire';
import {
  BE_AFFAIRE_STATUS_CONFIG,
  extractActiviteFromAffaire as activiteFromCode,
} from '@/types/beAffaire';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sb = supabase as any;

const STATUS_COLOR: Record<string, string> = {
  active:  '#10b981',
  on_hold: '#f59e0b',
  closed:  '#6b7280',
};

const STATUS_LABEL: Record<string, string> = {
  active:  'Actif',
  on_hold: 'En attente',
  closed:  'Clôturé',
};

const PROJECT_STATUSES: { value: string; label: string }[] = [
  { value: 'active',  label: 'Actif' },
  { value: 'on_hold', label: 'En attente' },
  { value: 'closed',  label: 'Clôturé' },
];

const AFFAIRE_STATUSES: BEAffaireStatus[] = [
  'ouverte',
  'en_cours',
  'suspendue',
  'cloturee',
  'annulee',
];

type HasAffairesFilter = 'all' | 'with' | 'without';
type SortKey = 'code' | 'name' | 'nb_affaires' | 'created_at';
type SortDir = 'asc' | 'desc';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Projects() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

  // Filters
  const [filterProjectStatus, setFilterProjectStatus] = useState<Set<string>>(new Set());
  const [filterHasAffaires, setFilterHasAffaires] = useState<HasAffairesFilter>('all');
  const [filterAffaireStatus, setFilterAffaireStatus] = useState<Set<BEAffaireStatus>>(new Set());
  const [filterActivite, setFilterActivite] = useState<Set<string>>(new Set());

  // Sort
  const [sortBy, setSortBy] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { projects, isLoading } = useBEProjects();

  // Fetch all affaires (lightweight — no KPIs)
  const { data: allAffaires = [] } = useQuery<
    Pick<BEAffaire, 'id' | 'be_project_id' | 'code_affaire' | 'libelle' | 'status'>[]
  >({
    queryKey: ['all-be-affaires-projects-page'],
    queryFn: async () => {
      const { data } = await sb
        .from('be_affaires')
        .select('id, be_project_id, code_affaire, libelle, status')
        .order('code_affaire');
      return data ?? [];
    },
  });

  // Group affaires by project id
  const affairesByProject = useMemo(() => {
    const map = new Map<string, typeof allAffaires>();
    for (const a of allAffaires) {
      if (!map.has(a.be_project_id)) map.set(a.be_project_id, []);
      map.get(a.be_project_id)!.push(a);
    }
    return map;
  }, [allAffaires]);

  // Liste des activités disponibles (3 dernières lettres des codes affaires),
  // dérivée dynamiquement des affaires chargées : pas de valeurs codées en dur.
  const availableActivites = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAffaires) {
      const act = activiteFromCode(a.code_affaire);
      if (act) set.add(act);
    }
    return [...set].sort();
  }, [allAffaires]);

  // Apply filters + sort
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.code_projet.toLowerCase().includes(q) ||
          (p.nom_projet ?? '').toLowerCase().includes(q),
      );
    }

    // Project status
    if (filterProjectStatus.size > 0) {
      result = result.filter((p) => filterProjectStatus.has(p.status));
    }

    // Has affaires + affaire status
    result = result.filter((p) => {
      const affs = affairesByProject.get(p.id) ?? [];

      if (filterHasAffaires === 'with' && affs.length === 0) return false;
      if (filterHasAffaires === 'without' && affs.length > 0) return false;

      if (filterAffaireStatus.size > 0) {
        if (!affs.some((a) => filterAffaireStatus.has(a.status as BEAffaireStatus))) return false;
      }

      if (filterActivite.size > 0) {
        if (!affs.some((a) => {
          const act = activiteFromCode(a.code_affaire);
          return act !== null && filterActivite.has(act);
        })) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'code':
          cmp = a.code_projet.localeCompare(b.code_projet);
          break;
        case 'name':
          cmp = (a.nom_projet ?? '').localeCompare(b.nom_projet ?? '');
          break;
        case 'nb_affaires':
          cmp =
            (affairesByProject.get(a.id)?.length ?? 0) -
            (affairesByProject.get(b.id)?.length ?? 0);
          break;
        case 'created_at':
          cmp =
            new Date(a.created_at ?? 0).getTime() -
            new Date(b.created_at ?? 0).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [
    projects,
    affairesByProject,
    search,
    filterProjectStatus,
    filterHasAffaires,
    filterAffaireStatus,
    filterActivite,
    sortBy,
    sortDir,
  ]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleProjectStatus = (status: string) =>
    setFilterProjectStatus((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  const toggleAffaireStatus = (status: BEAffaireStatus) =>
    setFilterAffaireStatus((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  const toggleActivite = (activite: string) =>
    setFilterActivite((prev) => {
      const next = new Set(prev);
      if (next.has(activite)) next.delete(activite);
      else next.add(activite);
      return next;
    });

  const resetFilters = () => {
    setFilterProjectStatus(new Set());
    setFilterHasAffaires('all');
    setFilterAffaireStatus(new Set());
    setFilterActivite(new Set());
    setSearch('');
  };

  const activeFilterCount =
    filterProjectStatus.size +
    (filterHasAffaires !== 'all' ? 1 : 0) +
    filterAffaireStatus.size +
    filterActivite.size +
    (search.trim() ? 1 : 0);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView="projects" onViewChange={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Projets" />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <div className="space-y-4">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Projets BE</h3>
              <Badge variant="secondary">
                {filteredProjects.length}/{projects.length}
              </Badge>
              <Button
                size="sm"
                className="ml-auto gap-2"
                onClick={() => setIsNewRequestOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Nouvelle demande
              </Button>
            </div>

            {/* ── Toolbar : recherche + filtres + tri ───────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher par code ou nom..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Filters popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-2">
                    <Filter className="h-4 w-4" />
                    Filtres
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    {/* Project status */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Statut du projet</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PROJECT_STATUSES.map((s) => {
                          const active = filterProjectStatus.has(s.value);
                          const color = STATUS_COLOR[s.value];
                          return (
                            <button
                              key={s.value}
                              onClick={() => toggleProjectStatus(s.value)}
                              className={cn(
                                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                                active
                                  ? 'border-current'
                                  : 'border-border hover:border-muted-foreground/50',
                              )}
                              style={{
                                backgroundColor: active ? color + '20' : 'transparent',
                                color: active ? color : undefined,
                              }}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Has affaires */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Affaires associées</Label>
                      <div className="flex gap-1.5">
                        {(
                          [
                            { v: 'all',     label: 'Toutes' },
                            { v: 'with',    label: 'Avec affaires' },
                            { v: 'without', label: 'Sans affaire' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.v}
                            onClick={() => setFilterHasAffaires(opt.v)}
                            className={cn(
                              'flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors',
                              filterHasAffaires === opt.v
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border hover:border-muted-foreground/50',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Affaire status (multi) */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        Statut des affaires
                        <span className="text-muted-foreground font-normal ml-1">
                          (au moins une correspondante)
                        </span>
                      </Label>
                      <div className="space-y-1.5">
                        {AFFAIRE_STATUSES.map((status) => {
                          const sc = BE_AFFAIRE_STATUS_CONFIG[status];
                          const checked = filterAffaireStatus.has(status);
                          return (
                            <div key={status} className="flex items-center gap-2">
                              <Checkbox
                                id={`affstatus-${status}`}
                                checked={checked}
                                onCheckedChange={() => toggleAffaireStatus(status)}
                              />
                              <label
                                htmlFor={`affstatus-${status}`}
                                className="flex items-center gap-2 cursor-pointer flex-1"
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] px-1.5 h-4 border',
                                    sc.className,
                                  )}
                                >
                                  {sc.label}
                                </Badge>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Activité (3 dernières lettres du code affaire) */}
                    {availableActivites.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">
                          Activité
                          <span className="text-muted-foreground font-normal ml-1">
                            (au moins une affaire correspondante)
                          </span>
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableActivites.map((act) => {
                            const active = filterActivite.has(act);
                            return (
                              <button
                                key={act}
                                onClick={() => toggleActivite(act)}
                                className={cn(
                                  'text-xs font-mono px-2.5 py-1 rounded-full border transition-colors',
                                  active
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border hover:border-muted-foreground/50',
                                )}
                              >
                                {act}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-2"
                        onClick={resetFilters}
                      >
                        <X className="h-3.5 w-3.5" />
                        Réinitialiser
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="w-[160px] h-10">
                  <SelectValue placeholder="Trier par..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code">Code projet</SelectItem>
                  <SelectItem value="name">Nom</SelectItem>
                  <SelectItem value="nb_affaires">Nb affaires</SelectItem>
                  <SelectItem value="created_at">Date création</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                title={sortDir === 'asc' ? 'Croissant' : 'Décroissant'}
              >
                {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </Button>
            </div>

            {/* ── Active filters chips (résumé visuel) ──────────────────── */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Filtres :</span>
                {[...filterProjectStatus].map((s) => (
                  <Badge
                    key={`ps-${s}`}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-secondary/80"
                    onClick={() => toggleProjectStatus(s)}
                  >
                    {STATUS_LABEL[s] ?? s}
                    <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
                {filterHasAffaires !== 'all' && (
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-secondary/80"
                    onClick={() => setFilterHasAffaires('all')}
                  >
                    {filterHasAffaires === 'with' ? 'Avec affaires' : 'Sans affaire'}
                    <X className="h-2.5 w-2.5" />
                  </Badge>
                )}
                {[...filterAffaireStatus].map((s) => (
                  <Badge
                    key={`as-${s}`}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-secondary/80"
                    onClick={() => toggleAffaireStatus(s)}
                  >
                    Aff. {BE_AFFAIRE_STATUS_CONFIG[s].label}
                    <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
                {[...filterActivite].map((act) => (
                  <Badge
                    key={`act-${act}`}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-secondary/80 font-mono"
                    onClick={() => toggleActivite(act)}
                  >
                    {act}
                    <X className="h-2.5 w-2.5" />
                  </Badge>
                ))}
              </div>
            )}

            {/* ── Liste des projets ─────────────────────────────────────── */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Aucun projet ne correspond aux filtres
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((project) => {
                  const affaires = affairesByProject.get(project.id) ?? [];
                  const isExpanded = expanded.has(project.id);
                  const color = STATUS_COLOR[project.status] || STATUS_COLOR.active;
                  const hasGps = !!project.gps_coordinates;

                  return (
                    <div
                      key={project.id}
                      className="border rounded-lg overflow-hidden bg-card"
                    >
                      {/* Project header row */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {/* Expand toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => toggleExpand(project.id)}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                        </Button>

                        {/* Project name (navigate to overview) */}
                        <button
                          className="flex-1 text-left flex items-center gap-2 min-w-0"
                          onClick={() =>
                            navigate(`/be/projects/${project.code_projet}/overview`)
                          }
                        >
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] px-1.5 shrink-0"
                          >
                            {project.code_projet}
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {project.nom_projet}
                          </span>
                        </button>

                        {/* Meta chips */}
                        <div className="flex items-center gap-2 shrink-0">
                          {hasGps && (
                            <MapPin
                              className="h-3 w-3 text-muted-foreground/50"
                              aria-label="Géolocalisé"
                            />
                          )}
                          {project.region && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                              {project.region}
                            </span>
                          )}
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: color + '20', color }}
                          >
                            {STATUS_LABEL[project.status] ?? project.status}
                          </span>
                          {affaires.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {affaires.length} affaire{affaires.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title="Ouvrir le projet"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/be/projects/${project.code_projet}/overview`);
                            }}
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                          </Button>
                        </div>
                      </div>

                      {/* Affaires (expanded) */}
                      {isExpanded && (
                        <div className="border-t divide-y bg-muted/10">
                          {affaires.length === 0 ? (
                            <p className="px-6 py-2 text-xs text-muted-foreground italic">
                              Aucune affaire pour ce projet
                            </p>
                          ) : (
                            affaires.map((affaire) => {
                              const sc = BE_AFFAIRE_STATUS_CONFIG[affaire.status as BEAffaireStatus];
                              return (
                                <button
                                  key={affaire.id}
                                  className="w-full text-left flex items-center gap-2 px-6 py-2 hover:bg-muted/20 transition-colors"
                                  onClick={() =>
                                    navigate(
                                      `/be/projects/${project.code_projet}/budget/${affaire.code_affaire}`,
                                    )
                                  }
                                >
                                  <span className="font-mono text-[11px] text-muted-foreground w-24 shrink-0">
                                    {affaire.code_affaire}
                                  </span>
                                  <span className="text-xs flex-1 truncate">
                                    {affaire.libelle ?? '—'}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] px-1.5 h-4 shrink-0 border',
                                      sc.className,
                                    )}
                                  >
                                    {sc.label}
                                  </Badge>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialog : nouvelle demande BE (accessible aux non-managers) */}
      <NewBERequestDialog
        open={isNewRequestOpen}
        onOpenChange={setIsNewRequestOpen}
        onCreated={() => {
          // Rafraîchir la liste des affaires pour refléter immédiatement le lien
          // éventuel demande → affaire (si la demande crée/lie une affaire).
          qc.invalidateQueries({ queryKey: ['all-be-affaires-projects-page'] });
        }}
      />
    </div>
  );
}
