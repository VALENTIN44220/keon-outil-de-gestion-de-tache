/**
 * Templates — page « Processus ».
 *
 * Liste sobre des processus métier. Chaque ligne est cliquable et ouvre
 * la page de configuration du processus (`/templates/process/:id`), qui
 * concentre désormais les prestations + les onglets Champs / Accès /
 * Notifications.
 *
 * Choix UX :
 *  - 1 page = 1 liste (pas de double onglet Processus / Sous-processus :
 *    les sous-processus se gèrent à l'intérieur de leur parent)
 *  - Pas de KPI cards qui prennent toute la hauteur — info en ligne d'entête
 *  - Recherche dans le header de l'app + filtre rapide visibilité
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
  Loader2, Layers, Plus, FolderOpen, ChevronRight, MoreVertical,
  Trash2, Eye, EyeOff, Lock, Building2, Briefcase, GitBranch, Workflow,
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

const VISIBILITY_META: Record<string, { label: string; icon: any; className: string }> = {
  public:              { label: 'Public',     icon: Eye,        className: 'bg-slate-100 text-slate-600' },
  internal_company:    { label: 'Sociétés',   icon: Building2,  className: 'bg-blue-100 text-blue-700' },
  internal_department: { label: 'Services',   icon: Briefcase,  className: 'bg-indigo-100 text-indigo-700' },
  private:             { label: 'Restreint',  icon: Lock,       className: 'bg-amber-100 text-amber-700' },
};

export default function Templates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = Boolean(user);

  const [activeView, setActiveView] = useState('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingProcess, setDeletingProcess] = useState<ProcessWithTasks | null>(null);

  const {
    processes,
    isLoading,
    addProcess,
    updateProcess,
    deleteProcess,
  } = useProcessTemplates();

  // Compteur de sous-processus par processus (pour afficher en ligne sans cliquer)
  const { subProcesses } = useAllSubProcessTemplates();
  const subCountByProcess = useMemo(() => {
    const map = new Map<string, number>();
    for (const sp of subProcesses) {
      if (!sp.process_template_id) continue;
      map.set(sp.process_template_id, (map.get(sp.process_template_id) ?? 0) + 1);
    }
    return map;
  }, [subProcesses]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return processes.filter((p) => {
      if (visibilityFilter !== 'all' && p.visibility_level !== visibilityFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [processes, searchQuery, visibilityFilter]);

  // BE en premier, puis ordre de création
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      if (a.id === BE_PROCESS_ID) return -1;
      if (b.id === BE_PROCESS_ID) return 1;
      return 0;
    }),
    [filtered],
  );

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

            {/* ── Barre filtres + compteur ─────────────────────────────── */}
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
                {sorted.length} processus
                {sorted.length !== processes.length && ` sur ${processes.length}`}
              </span>
            </div>

            {/* ── Liste ────────────────────────────────────────────────── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
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
              <div className="bg-card rounded-xl border divide-y">
                {sorted.map((process) => (
                  <ProcessRow
                    key={process.id}
                    process={process}
                    subCount={subCountByProcess.get(process.id) ?? 0}
                    onOpen={() => navigate(`/templates/process/${process.id}`)}
                    onDelete={() => setDeletingProcess(process)}
                  />
                ))}
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
// Une ligne de processus dans la liste
// ════════════════════════════════════════════════════════════════════════
function ProcessRow({
  process, subCount, onOpen, onDelete,
}: {
  process: ProcessWithTasks;
  subCount: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isBE = process.id === BE_PROCESS_ID;
  const visMeta = VISIBILITY_META[process.visibility_level ?? 'public'] ?? VISIBILITY_META.public;
  const VIcon = visMeta.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-muted/30 transition-colors text-left"
    >
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
        isBE ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600',
      )}>
        {isBE ? <Workflow className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{process.name}</span>
          {isBE && (
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
              Bureau d'Études
            </Badge>
          )}
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
            {subCount} {isBE ? `prestation${subCount > 1 ? 's' : ''}` : `sous-processus`}
          </span>
          <span>· créé le {format(parseISO(process.created_at), 'dd MMM yyyy', { locale: fr })}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {process.can_manage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                aria-label="Actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer / Archiver
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
      </div>
    </button>
  );
}
