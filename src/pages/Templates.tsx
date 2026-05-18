/**
 * Templates — page « Processus ».
 *
 * Organisation :
 *   1. Les processus sont regroupés par type de demande (BE, IT, Innovation,
 *      Maintenance, Logistique, RH, Achat, Marketing/Comm, QSE,
 *      Commercial, Compta, Autres) → une section collapsible par groupe
 *   2. Clic sur une ligne processus → expand inline pour afficher ses
 *      prestations / sous-processus (sans navigation)
 *   3. Clic sur une prestation → ouvre la page d'édition dédiée
 *      (`/templates/be-prestation/:id` pour BE, `/templates/subprocess/:id`
 *      pour les autres)
 *   4. Bouton « Configurer » sur la ligne processus → onglet complet
 *      Paramètres / Champs / Accès / Notifications
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Loader2, Layers, Plus, FolderOpen, ChevronRight, ChevronDown, MoreVertical,
  Trash2, Eye, Lock, Building2, Briefcase, GitBranch, Workflow,
  Monitor, Lightbulb, Wrench, Truck, Users as UsersIcon, ShoppingCart,
  Megaphone, ShieldCheck, TrendingUp, Calculator, Settings2, Wand2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AddProcessDialog } from '@/components/templates/AddProcessDialog';
import { DeleteProcessDialog } from '@/components/templates/DeleteProcessDialog';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { useAllSubProcessTemplates } from '@/hooks/useAllSubProcessTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

// ─── Catégories (= types de demande) ────────────────────────────────────────
type CategoryKey =
  | 'be' | 'it' | 'innovation' | 'maintenance' | 'logistique'
  | 'rh' | 'achat' | 'comm' | 'qse' | 'commercial' | 'compta' | 'other';

interface Category {
  key: CategoryKey;
  label: string;
  icon: any;
  iconClass: string;
  match: (p: ProcessWithTasks) => boolean;
}

// Ordre = ordre d'affichage. Premier match l'emporte.
const CATEGORIES: Category[] = [
  { key: 'be',          label: "Bureau d'Études",     icon: Workflow,    iconClass: 'bg-amber-100 text-amber-600',
    match: (p) => p.id === BE_PROCESS_ID || /^BUREAU D[ '’]ETUDES/i.test(p.name) },
  { key: 'it',          label: 'IT / Digital',         icon: Monitor,     iconClass: 'bg-blue-100 text-blue-600',
    match: (p) => /^IT\b|^SUPPORT IT|^Intelligence/i.test(p.name) },
  { key: 'innovation',  label: 'Innovation',           icon: Lightbulb,   iconClass: 'bg-violet-100 text-violet-600',
    match: (p) => /^Innovation/i.test(p.name) },
  { key: 'maintenance', label: 'Maintenance',          icon: Wrench,      iconClass: 'bg-orange-100 text-orange-600',
    match: (p) => /^Maintenance|^SERVICE MAINTENANCE/i.test(p.name) },
  { key: 'logistique',  label: 'Logistique / Transport', icon: Truck,    iconClass: 'bg-sky-100 text-sky-600',
    match: (p) => /^Logistique|^TRANSPORT/i.test(p.name) },
  { key: 'rh',          label: 'Ressources Humaines',  icon: UsersIcon,   iconClass: 'bg-pink-100 text-pink-600',
    match: (p) => /^RH\b|^RESSOURCES HUMAINES|^ONBOARDING/i.test(p.name) },
  { key: 'achat',       label: 'Achats / Fournisseurs', icon: ShoppingCart, iconClass: 'bg-emerald-100 text-emerald-600',
    match: (p) => /^SERVICE ACHAT|ACHAT/i.test(p.name) },
  { key: 'comm',        label: 'Communication / Marketing', icon: Megaphone, iconClass: 'bg-rose-100 text-rose-600',
    match: (p) => /^Comm[ -]|^SERVICE MARKETING/i.test(p.name) },
  { key: 'qse',         label: 'QSE / Qualité',        icon: ShieldCheck, iconClass: 'bg-green-100 text-green-600',
    match: (p) => /QUALIT|SMQ|REGLEMENT/i.test(p.name) },
  { key: 'commercial',  label: 'Commercial',           icon: TrendingUp,  iconClass: 'bg-cyan-100 text-cyan-600',
    match: (p) => /^COMMERCIAL/i.test(p.name) },
  { key: 'compta',      label: 'Comptabilité / Finance', icon: Calculator, iconClass: 'bg-slate-100 text-slate-600',
    match: (p) => /^COMPTABILIT/i.test(p.name) },
  { key: 'other',       label: 'Autres',               icon: Layers,      iconClass: 'bg-zinc-100 text-zinc-600',
    match: () => true },
];

function categoryOf(p: ProcessWithTasks): Category {
  return CATEGORIES.find(c => c.match(p))!;
}

const VISIBILITY_META: Record<string, { label: string; icon: any; className: string }> = {
  public:              { label: 'Public',     icon: Eye,        className: 'bg-slate-100 text-slate-600' },
  internal_company:    { label: 'Sociétés',   icon: Building2,  className: 'bg-blue-100 text-blue-700' },
  internal_department: { label: 'Services',   icon: Briefcase,  className: 'bg-indigo-100 text-indigo-700' },
  private:             { label: 'Restreint',  icon: Lock,       className: 'bg-amber-100 text-amber-700' },
};

// ════════════════════════════════════════════════════════════════════════════
export default function Templates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = Boolean(user);

  const [activeView, setActiveView] = useState('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingProcess, setDeletingProcess] = useState<ProcessWithTasks | null>(null);

  // État UI : quels processus sont dépliés (inline prestations)
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  // État UI : quelles catégories sont repliées
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const {
    processes,
    isLoading,
    addProcess,
    updateProcess,
    deleteProcess,
  } = useProcessTemplates();

  const { subProcesses, deleteSubProcess, refetch: refetchSubProcesses } = useAllSubProcessTemplates();

  // Index sub-processes par processus
  const subsByProcess = useMemo(() => {
    const map = new Map<string, typeof subProcesses>();
    for (const sp of subProcesses) {
      if (!sp.process_template_id) continue;
      if (!map.has(sp.process_template_id)) map.set(sp.process_template_id, []);
      map.get(sp.process_template_id)!.push(sp);
    }
    // Tri par order_index
    for (const list of map.values()) {
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
    return map;
  }, [subProcesses]);

  // Filtrage processus
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return processes.filter((p) => {
      if (visibilityFilter !== 'all' && p.visibility_level !== visibilityFilter) return false;
      if (!q) return true;
      const matchProcess = p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      // Élargit le filtre aux prestations : si une presta matche, on garde le processus parent
      const presta = subsByProcess.get(p.id) ?? [];
      const matchPresta = presta.some(sp => sp.name.toLowerCase().includes(q));
      return matchProcess || matchPresta;
    });
  }, [processes, searchQuery, visibilityFilter, subsByProcess]);

  // Regroupement par catégorie
  const grouped = useMemo(() => {
    const map = new Map<CategoryKey, ProcessWithTasks[]>();
    for (const cat of CATEGORIES) map.set(cat.key, []);
    for (const p of filtered) {
      const cat = categoryOf(p);
      map.get(cat.key)!.push(p);
    }
    // Tri alphabétique par catégorie (BE = id fixe en tête)
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.id === BE_PROCESS_ID) return -1;
        if (b.id === BE_PROCESS_ID) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    return CATEGORIES
      .map(cat => ({ cat, items: map.get(cat.key) ?? [] }))
      .filter(g => g.items.length > 0);
  }, [filtered]);

  const toggleProcess = (id: string) => {
    setExpandedProcesses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleArchive = async () => {
    if (!deletingProcess) return;
    await updateProcess(deletingProcess.id, { visibility_level: 'private' });
    toast.success('Processus archivé');
    setDeletingProcess(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProcess) return;
    await deleteProcess(deletingProcess.id);
    setDeletingProcess(null);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Processus"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAddTask={canCreate ? () => setIsAddOpen(true) : undefined}
          addButtonLabel="Nouveau processus"
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-4">

            {/* ── Filtres ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border p-3">
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="Visibilité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes visibilités</SelectItem>
                  {Object.entries(VISIBILITY_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="ml-auto text-sm text-muted-foreground">
                {filtered.length} processus
                {filtered.length !== processes.length && ` sur ${processes.length}`}
                {' · '}{grouped.length} catégorie{grouped.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* ── Contenu ──────────────────────────────────────────────── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border">
                <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  {searchQuery || visibilityFilter !== 'all'
                    ? 'Aucun processus ne correspond à la recherche'
                    : 'Aucun processus pour le moment'}
                </p>
                {canCreate && !searchQuery && visibilityFilter === 'all' && (
                  <Button size="sm" className="mt-3 gap-2" onClick={() => setIsAddOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Créer un processus
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map(({ cat, items }) => {
                  const CatIcon = cat.icon;
                  const isCollapsed = collapsedCategories.has(cat.key);
                  return (
                    <section key={cat.key} className="bg-card rounded-xl border overflow-hidden">
                      {/* En-tête catégorie */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.key)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left border-b"
                      >
                        {isCollapsed
                          ? <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground/60 shrink-0" />}
                        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', cat.iconClass)}>
                          <CatIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-semibold">{cat.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">
                          {items.length}
                        </Badge>
                      </button>

                      {/* Liste des processus */}
                      {!isCollapsed && (
                        <div className="divide-y">
                          {items.map((p) => (
                            <ProcessRow
                              key={p.id}
                              process={p}
                              prestations={subsByProcess.get(p.id) ?? []}
                              expanded={expandedProcesses.has(p.id)}
                              onToggle={() => toggleProcess(p.id)}
                              onConfigure={() => navigate(`/templates/process/${p.id}`)}
                              onDelete={() => setDeletingProcess(p)}
                              onOpenPrestation={(sp) => {
                                const route = p.id === BE_PROCESS_ID
                                  ? `/templates/be-prestation/${sp.id}`
                                  : `/templates/subprocess/${sp.id}`;
                                navigate(route);
                              }}
                              onDeletePrestation={async (sp) => {
                                await deleteSubProcess(sp.id);
                                refetchSubProcesses();
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <AddProcessDialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={addProcess}
      />

      <DeleteProcessDialog
        processId={deletingProcess?.id || null}
        processName={deletingProcess?.name || ''}
        open={!!deletingProcess}
        onClose={() => setDeletingProcess(null)}
        onConfirmDelete={handleConfirmDelete}
        onConfirmArchive={handleArchive}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Ligne d'un processus + section prestations dépliée
// ════════════════════════════════════════════════════════════════════════
function ProcessRow({
  process, prestations, expanded,
  onToggle, onConfigure, onDelete, onOpenPrestation, onDeletePrestation,
}: {
  process: ProcessWithTasks;
  prestations: any[];
  expanded: boolean;
  onToggle: () => void;
  onConfigure: () => void;
  onDelete: () => void;
  onOpenPrestation: (sp: any) => void;
  onDeletePrestation: (sp: any) => void;
}) {
  const isBE = process.id === BE_PROCESS_ID;
  const visMeta = VISIBILITY_META[process.visibility_level ?? 'public'] ?? VISIBILITY_META.public;
  const VIcon = visMeta.icon;
  const prestaLabel = isBE ? 'prestation' : 'sous-processus';

  return (
    <div>
      {/* Ligne principale processus */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{process.name}</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1 border-0', visMeta.className)}>
              <VIcon className="h-2.5 w-2.5" />
              {visMeta.label}
            </Badge>
          </div>
          {process.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {process.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {prestations.length} {prestaLabel}{prestations.length > 1 ? 's' : ''}
            </span>
            <span>· créé le {format(parseISO(process.created_at), 'dd MMM yyyy', { locale: fr })}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onConfigure}
            title="Paramètres / Champs / Accès / Notifications"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Configurer</span>
          </Button>
          {process.can_manage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer / Archiver
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </button>

      {/* Liste des prestations dépliée */}
      {expanded && (
        <div className="bg-muted/20 border-t">
          {prestations.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-12 py-3">
              Aucun{isBE ? 'e' : ''} {prestaLabel} configuré{isBE ? 'e' : ''}. Utilise le bouton « Configurer » pour en ajouter.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {prestations.map((sp) => (
                <li key={sp.id}>
                  <div className="flex items-center gap-3 pl-12 pr-3 py-2 hover:bg-muted/40 transition-colors">
                    {isBE
                      ? <Wand2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      : <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sp.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span>
                          {sp.task_templates?.length ?? 0} étape{(sp.task_templates?.length ?? 0) > 1 ? 's' : ''}
                        </span>
                        {sp.is_mandatory && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0">Obligatoire</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => onOpenPrestation(sp)}
                    >
                      <Settings2 className="h-3 w-3" />
                      Modifier
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                          aria-label="Actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeletePrestation(sp)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
