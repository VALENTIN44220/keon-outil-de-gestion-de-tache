/**
 * Templates — page « Processus ».
 *
 * Vue unifiée des « types de demande » regroupés par domaine métier.
 *
 * Détail d'implémentation gommé pour l'utilisateur :
 *  - BE : 1 process_template + N sub_process_templates (les prestations)
 *  - IT, Innovation, RH, etc. : N process_templates indépendants
 *
 * Dans les deux cas, on présente le résultat comme une liste de « prestations »
 * sous chaque catégorie. Le bouton « Configurer » route vers la bonne page
 * d'édition selon le type sous-jacent :
 *  - sub_process_template BE → /templates/be-prestation/:id
 *  - autre sub_process_template → /templates/subprocess/:id
 *  - process_template standalone → /templates/process/:id
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
  Trash2, Eye, Lock, Building2, Briefcase, Workflow,
  Monitor, Lightbulb, Wrench, Truck, Users as UsersIcon, ShoppingCart,
  Megaphone, ShieldCheck, TrendingUp, Calculator, Settings2, Wand2, GitBranch,
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

// ─── Catégories métier ─────────────────────────────────────────────────────
type CategoryKey =
  | 'be' | 'it' | 'innovation' | 'maintenance' | 'logistique'
  | 'rh' | 'achat' | 'comm' | 'qse' | 'commercial' | 'compta' | 'other';

interface Category {
  key: CategoryKey;
  label: string;
  icon: any;
  iconClass: string;
  match: (name: string, id?: string) => boolean;
}

// Premier match l'emporte. Ordre = ordre d'affichage.
const CATEGORIES: Category[] = [
  { key: 'be',          label: "Bureau d'Études",          icon: Workflow,     iconClass: 'bg-amber-100 text-amber-600',
    match: (name, id) => id === BE_PROCESS_ID || /^BUREAU D[ '’]ETUDES/i.test(name) },
  { key: 'it',          label: 'IT / Digital',              icon: Monitor,      iconClass: 'bg-blue-100 text-blue-600',
    match: (name) => /^IT\b|^SUPPORT IT|^Intelligence/i.test(name) },
  { key: 'innovation',  label: 'Innovation',                icon: Lightbulb,    iconClass: 'bg-violet-100 text-violet-600',
    match: (name) => /^Innovation/i.test(name) },
  { key: 'maintenance', label: 'Maintenance',               icon: Wrench,       iconClass: 'bg-orange-100 text-orange-600',
    match: (name) => /^Maintenance|^SERVICE MAINTENANCE/i.test(name) },
  { key: 'logistique',  label: 'Logistique / Transport',    icon: Truck,        iconClass: 'bg-sky-100 text-sky-600',
    match: (name) => /^Logistique|^TRANSPORT/i.test(name) },
  { key: 'rh',          label: 'Ressources Humaines',       icon: UsersIcon,    iconClass: 'bg-pink-100 text-pink-600',
    match: (name) => /^RH\b|^RESSOURCES HUMAINES|^ONBOARDING/i.test(name) },
  { key: 'achat',       label: 'Achats / Fournisseurs',     icon: ShoppingCart, iconClass: 'bg-emerald-100 text-emerald-600',
    match: (name) => /^SERVICE ACHAT|ACHAT/i.test(name) },
  { key: 'comm',        label: 'Communication / Marketing', icon: Megaphone,    iconClass: 'bg-rose-100 text-rose-600',
    match: (name) => /^Comm[ -]|^SERVICE MARKETING/i.test(name) },
  { key: 'qse',         label: 'QSE / Qualité',             icon: ShieldCheck,  iconClass: 'bg-green-100 text-green-600',
    match: (name) => /QUALIT|SMQ|REGLEMENT/i.test(name) },
  { key: 'commercial',  label: 'Commercial',                icon: TrendingUp,   iconClass: 'bg-cyan-100 text-cyan-600',
    match: (name) => /^COMMERCIAL/i.test(name) },
  { key: 'compta',      label: 'Comptabilité / Finance',    icon: Calculator,   iconClass: 'bg-slate-100 text-slate-600',
    match: (name) => /^COMPTABILIT/i.test(name) },
  { key: 'other',       label: 'Autres',                    icon: Layers,       iconClass: 'bg-zinc-100 text-zinc-600',
    match: () => true },
];

function categoryOf(name: string, id?: string): Category {
  return CATEGORIES.find(c => c.match(name, id))!;
}

// Nettoie le préfixe redondant (« IT - Reporting Power BI » → « Reporting Power BI »
// dans la catégorie « IT / Digital »)
function stripCategoryPrefix(name: string, catKey: CategoryKey): string {
  const PREFIX: Partial<Record<CategoryKey, RegExp>> = {
    it:          /^(IT|SUPPORT IT\/DIGITAL)\s*[-–—]\s*/i,
    innovation:  /^Innovation\s*[-–—]\s*/i,
    maintenance: /^Maintenance\s*[-–—]\s*/i,
    logistique:  /^Logistique\s*[-–—]\s*/i,
    rh:          /^RH\s*[-–—]\s*/i,
    comm:        /^Comm\s*[-–—]\s*/i,
  };
  const re = PREFIX[catKey];
  return re ? name.replace(re, '').trim() || name : name;
}

const VISIBILITY_META: Record<string, { label: string; icon: any; className: string }> = {
  public:              { label: 'Public',     icon: Eye,        className: 'bg-slate-100 text-slate-600' },
  internal_company:    { label: 'Sociétés',   icon: Building2,  className: 'bg-blue-100 text-blue-700' },
  internal_department: { label: 'Services',   icon: Briefcase,  className: 'bg-indigo-100 text-indigo-700' },
  private:             { label: 'Restreint',  icon: Lock,       className: 'bg-amber-100 text-amber-700' },
};

// ─── Modèle unifié « DemandType » exposé à l'UI ────────────────────────────
interface DemandType {
  id: string;
  /** 'subprocess' = prestation BE (sub_process_template),
   *  'process'    = process_template standalone (IT, Innovation, etc.),
   *  'external'   = lien vers un module dédié (ex: SMQ) */
  source: 'subprocess' | 'process' | 'external';
  /** Catégorie à laquelle l'entrée appartient. Optionnel : si renseigné, on
   *  force la catégorisation (utilisé pour les entrées externes). */
  forcedCategory?: CategoryKey;
  /** Route à ouvrir au clic « Configurer » (uniquement pour source='external') */
  externalRoute?: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  stepCount: number;
  isMandatory?: boolean;
  canManage: boolean;
  /** Source originale pour les opérations (édition / suppression) */
  raw: any;
}

// Entrées « externes » injectées dans la liste : modules métier dédiés
// qui ont leur propre page de gestion (hors process_templates DB).
const EXTERNAL_ENTRIES: DemandType[] = [
  {
    id: 'smq-module',
    source: 'external',
    forcedCategory: 'qse',
    externalRoute: '/smq',
    name: 'Non-Conformités (Module SMQ)',
    description: 'Gestion des NC via le module dédié — déclaration, dispatch, actions correctives/préventives, jalons',
    visibility: 'public',
    createdAt: '2026-05-13',
    stepCount: 0,
    canManage: false,
    raw: null,
  },
];

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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const { processes, isLoading, addProcess, updateProcess, deleteProcess } = useProcessTemplates();
  const { subProcesses, deleteSubProcess, refetch: refetchSubProcesses } = useAllSubProcessTemplates();

  // ─── Construction de la liste unifiée des « types de demande » ──────────
  const demandTypes = useMemo((): DemandType[] => {
    const list: DemandType[] = [];

    // a) Prestations BE (sub_process_templates rattachés au process BE)
    for (const sp of subProcesses) {
      if (sp.process_template_id !== BE_PROCESS_ID) continue;
      list.push({
        id: sp.id,
        source: 'subprocess',
        name: sp.name,
        description: sp.description ?? null,
        visibility: sp.visibility_level ?? 'public',
        createdAt: (sp as any).created_at ?? new Date().toISOString(),
        stepCount: sp.task_templates?.length ?? 0,
        isMandatory: (sp as any).is_mandatory ?? false,
        canManage: true,
        raw: sp,
      });
    }

    // 0) Entrées externes (ex : module SMQ)
    list.push(...EXTERNAL_ENTRIES);

    // b) Process templates standalone (TOUS sauf BE)
    for (const p of processes) {
      if (p.id === BE_PROCESS_ID) continue;
      // Compte les sous-processus liés à ce process (autre IT/Comm etc.)
      const subs = subProcesses.filter(sp => sp.process_template_id === p.id);
      const ownSteps = subs.reduce((acc, sp) => acc + (sp.task_templates?.length ?? 0), 0);
      list.push({
        id: p.id,
        source: 'process',
        name: p.name,
        description: p.description ?? null,
        visibility: p.visibility_level ?? 'public',
        createdAt: p.created_at,
        stepCount: subs.length || ownSteps,
        canManage: Boolean(p.can_manage),
        raw: p,
      });
    }
    return list;
  }, [processes, subProcesses]);

  // ─── Filtrage + groupement par catégorie ────────────────────────────────
  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const map = new Map<CategoryKey, DemandType[]>();
    for (const cat of CATEGORIES) map.set(cat.key, []);

    for (const d of demandTypes) {
      if (visibilityFilter !== 'all' && d.visibility !== visibilityFilter) continue;
      if (q && !d.name.toLowerCase().includes(q) && !(d.description ?? '').toLowerCase().includes(q)) continue;
      // forcedCategory (entrées externes) → priorité
      // subprocess (prestations BE) → toujours 'be'
      // sinon → détection par nom
      const catKey: CategoryKey =
        d.forcedCategory ??
        (d.source === 'subprocess' ? 'be' : categoryOf(d.name, d.source === 'process' ? d.id : undefined).key);
      map.get(catKey)!.push(d);
    }

    // Tri alphabétique dans chaque catégorie
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return CATEGORIES
      .map(cat => ({ cat, items: map.get(cat.key) ?? [] }))
      .filter(g => g.items.length > 0);
  }, [demandTypes, searchQuery, visibilityFilter]);

  const totalShown = grouped.reduce((acc, g) => acc + g.items.length, 0);

  const toggleCategory = (key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const openConfigure = (d: DemandType) => {
    if (d.source === 'external' && d.externalRoute) {
      navigate(d.externalRoute);
    } else if (d.source === 'subprocess') {
      navigate(`/templates/be-prestation/${d.id}`);
    } else {
      navigate(`/templates/process/${d.id}`);
    }
  };

  const handleDelete = async (d: DemandType) => {
    if (d.source === 'external') return; // pas de suppression possible
    if (d.source === 'subprocess') {
      await deleteSubProcess(d.id);
      refetchSubProcesses();
      toast.success('Prestation supprimée');
    } else {
      setDeletingProcess(d.raw as ProcessWithTasks);
    }
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

            {/* ── Barre filtres ────────────────────────────────────────── */}
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
                {totalShown} type{totalShown > 1 ? 's' : ''} de demande
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
                    ? 'Aucun type de demande ne correspond à la recherche'
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
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left',
                          !isCollapsed && 'border-b',
                        )}
                      >
                        {isCollapsed
                          ? <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground/60 shrink-0" />}
                        <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', cat.iconClass)}>
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold flex-1">{cat.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {items.length} demande{items.length > 1 ? 's' : ''}
                        </Badge>
                      </button>

                      {/* Liste plate des « types de demande » */}
                      {!isCollapsed && (
                        <ul className="divide-y">
                          {items.map((d) => (
                            <DemandTypeRow
                              key={`${d.source}-${d.id}`}
                              demand={d}
                              displayName={stripCategoryPrefix(d.name, cat.key)}
                              isBE={cat.key === 'be'}
                              onConfigure={() => openConfigure(d)}
                              onDelete={() => handleDelete(d)}
                            />
                          ))}
                        </ul>
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
// Ligne d'un type de demande (BE prestation OU process standalone)
// Visuellement identiques.
// ════════════════════════════════════════════════════════════════════════
function DemandTypeRow({
  demand, displayName, isBE, onConfigure, onDelete,
}: {
  demand: DemandType;
  displayName: string;
  isBE: boolean;
  onConfigure: () => void;
  onDelete: () => void;
}) {
  const visMeta = VISIBILITY_META[demand.visibility] ?? VISIBILITY_META.public;
  const VIcon = visMeta.icon;
  const isExternal = demand.source === 'external';

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onConfigure}
        onKeyDown={(e) => { if (e.key === 'Enter') onConfigure(); }}
        className={cn(
          'w-full flex items-center gap-3 p-3 transition-colors text-left cursor-pointer',
          isExternal ? 'hover:bg-violet-50/60 bg-violet-50/20' : 'hover:bg-muted/30',
        )}
      >
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
          isExternal ? 'bg-violet-100' : 'bg-muted/60',
        )}>
          {isExternal
            ? <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />
            : isBE
              ? <Wand2 className="h-3.5 w-3.5 text-amber-500" />
              : <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{displayName}</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1 border-0', visMeta.className)}>
              <VIcon className="h-2.5 w-2.5" />
              {visMeta.label}
            </Badge>
            {demand.isMandatory && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obligatoire</Badge>
            )}
          </div>
          {demand.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {demand.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span>
              {demand.stepCount} étape{demand.stepCount > 1 ? 's' : ''}
            </span>
            <span>· créé le {format(parseISO(demand.createdAt), 'dd MMM yyyy', { locale: fr })}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant={isExternal ? 'default' : 'outline'}
            size="sm"
            className={cn('h-8 text-xs gap-1.5', isExternal && 'bg-violet-600 hover:bg-violet-700')}
            onClick={onConfigure}
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isExternal ? 'Ouvrir le module' : 'Configurer'}</span>
          </Button>
          {demand.canManage && (
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
                  {demand.source === 'subprocess' ? 'Supprimer' : 'Supprimer / Archiver'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </li>
  );
}
