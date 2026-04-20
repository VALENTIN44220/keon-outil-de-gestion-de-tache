import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Trash2, AlertTriangle, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlannerTitleDuplicatesDialog } from './PlannerTitleDuplicatesDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface PlannerPreviewTask {
  id: string;
  title: string;
  state: 'notStarted' | 'inProgress' | 'completed';
  percentComplete: number;
  bucketId: string | null;
  bucketName: string | null;
  dueDateTime: string | null;
  createdDateTime: string | null;
  assignees: { id: string; email: string; displayName: string }[];
  alreadyLinked: boolean;
}

interface Bucket {
  id: string;
  name: string;
}

interface PlannerImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planMappingId: string | null;
  planTitle: string;
  /** Called once the user confirms — receives the list of selected planner_task_ids to import */
  onConfirmImport: (selectedIds: string[]) => Promise<void> | void;
}

const STATE_LABELS: Record<string, string> = {
  notStarted: 'Non démarrée',
  inProgress: 'En cours',
  completed: 'Terminée',
};

const STATE_BADGE_VARIANT: Record<string, 'secondary' | 'default' | 'outline'> = {
  notStarted: 'outline',
  inProgress: 'default',
  completed: 'secondary',
};

export function PlannerImportPreviewDialog({
  open,
  onOpenChange,
  planMappingId,
  planTitle,
  onConfirmImport,
}: PlannerImportPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [tasks, setTasks] = useState<PlannerPreviewTask[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [titleDupesOpen, setTitleDupesOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [hideLinked, setHideLinked] = useState(true);

  // Reset everything when the dialog is opened/closed
  useEffect(() => {
    if (!open) return;
    if (!planMappingId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setTasks([]);
      setSelectedIds(new Set());
      try {
        const { data, error } = await supabase.functions.invoke('microsoft-graph', {
          body: { action: 'planner-preview-tasks', planMappingId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erreur de chargement');
        if (cancelled) return;

        const previewTasks: PlannerPreviewTask[] = data.tasks || [];
        const previewBuckets: Bucket[] = data.buckets || [];
        setTasks(previewTasks);
        setBuckets(previewBuckets);

        // Pre-select all tasks that are NOT already linked
        const initial = new Set<string>();
        previewTasks.forEach((t) => {
          if (!t.alreadyLinked) initial.add(t.id);
        });
        setSelectedIds(initial);
      } catch (err: any) {
        toast.error(`Aperçu Planner impossible : ${err.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, planMappingId]);

  // Build assignee options from loaded tasks
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      t.assignees.forEach((a) => {
        const label = a.displayName || a.email || a.id;
        if (label) map.set(a.id, label);
      });
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (hideLinked && t.alreadyLinked) return false;
      if (stateFilter !== 'all' && t.state !== stateFilter) return false;
      if (bucketFilter !== 'all') {
        if (bucketFilter === '__none__' && t.bucketId) return false;
        if (bucketFilter !== '__none__' && t.bucketId !== bucketFilter) return false;
      }
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === '__none__' && t.assignees.length > 0) return false;
        if (
          assigneeFilter !== '__none__' &&
          !t.assignees.some((a) => a.id === assigneeFilter)
        )
          return false;
      }
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, stateFilter, bucketFilter, assigneeFilter, hideLinked]);

  const allFilteredSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));
  const someFilteredSelected = filteredTasks.some((t) => selectedIds.has(t.id));

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredTasks.forEach((t) => {
        if (checked) next.add(t.id);
        else next.delete(t.id);
      });
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!planMappingId) return;
    const ids = Array.from(selectedIds);
    setImporting(true);
    try {
      await onConfirmImport(ids);
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!planMappingId) return;
    if (
      !window.confirm(
        'Supprimer les tâches en doublon (même tâche Planner liée plusieurs fois) ?\n\nLa plus ancienne est conservée, les autres sont définitivement supprimées.',
      )
    )
      return;
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.rpc(
        // The function exists in the DB but is not in generated types yet.
        'cleanup_planner_duplicates_for_mapping' as never,
        { p_plan_mapping_id: planMappingId } as never,
      );
      if (error) throw error;
      const payload = data as { deleted_links?: number; deleted_tasks?: number } | null;
      const links = payload?.deleted_links ?? 0;
      const tasksDeleted = payload?.deleted_tasks ?? 0;
      if (links === 0) {
        toast.success('Aucun doublon détecté.');
      } else {
        toast.success(`Nettoyage : ${tasksDeleted} tâche(s) supprimée(s), ${links} lien(s) retiré(s).`);
      }
    } catch (err: any) {
      toast.error(`Nettoyage impossible : ${err.message}`);
    } finally {
      setCleaningUp(false);
    }
  };

  const linkedCount = tasks.filter((t) => t.alreadyLinked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importer depuis Planner — {planTitle}</DialogTitle>
          <DialogDescription>
            Sélectionnez les tâches à importer. Les tâches déjà liées (par identifiant Planner) sont
            ignorées par défaut, ce qui évite les doublons même si vous les avez renommées.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="w-[170px]">
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="notStarted">Non démarrée</SelectItem>
                <SelectItem value="inProgress">En cours</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Select value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Bucket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous buckets</SelectItem>
                <SelectItem value="__none__">Sans bucket</SelectItem>
                {buckets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[200px]">
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Assigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous assignés</SelectItem>
                <SelectItem value="__none__">Non assignée</SelectItem>
                {assigneeOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={hideLinked}
              onCheckedChange={(c) => setHideLinked(c === true)}
            />
            Masquer déjà liées
          </label>
        </div>

        {/* Bulk action row */}
        <div className="flex items-center justify-between gap-2 border-y py-2 text-sm">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
              onCheckedChange={(c) => toggleAllFiltered(c === true)}
              disabled={filteredTasks.length === 0}
            />
            <span className="text-muted-foreground">
              {selectedIds.size} sélectionnée(s) • {filteredTasks.length} affichée(s) • {tasks.length} au total
              {linkedCount > 0 && ` • ${linkedCount} déjà liée(s)`}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTitleDupesOpen(true)}
              className="gap-1 text-muted-foreground hover:text-foreground"
              title="Détecte les tâches qui ont le même titre Planner réel (préfixes T-XXX-NNNN ignorés) et permet de choisir lesquelles supprimer"
            >
              <Wrench className="h-3.5 w-3.5" />
              Doublons par titre
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCleanupDuplicates}
              disabled={cleaningUp}
              className="gap-1 text-muted-foreground hover:text-destructive"
              title="Supprime les tâches importées plusieurs fois pour ce plan (par identifiant Planner)"
            >
              {cleaningUp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Nettoyer (par ID)
            </Button>
          </div>
        </div>

        {/* Task list */}
        <ScrollArea className="h-[420px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Chargement des tâches Planner…
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <AlertTriangle className="h-6 w-6" />
              Aucune tâche ne correspond aux filtres.
            </div>
          ) : (
            <div className="divide-y">
              {filteredTasks.map((t) => {
                const checked = selectedIds.has(t.id);
                return (
                  <label
                    key={t.id}
                    className="flex items-start gap-3 py-2 px-1 cursor-pointer hover:bg-muted/40 rounded"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={t.alreadyLinked}
                      onCheckedChange={(c) => toggleOne(t.id, c === true)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{t.title}</span>
                        {t.alreadyLinked && (
                          <Badge variant="outline" className="text-xs">
                            Déjà liée
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                        <Badge
                          variant={STATE_BADGE_VARIANT[t.state] ?? 'outline'}
                          className="text-xs"
                        >
                          {STATE_LABELS[t.state] ?? t.state}
                        </Badge>
                        {t.bucketName && <span>Bucket : {t.bucketName}</span>}
                        {t.assignees.length > 0 && (
                          <span>
                            Assigné(s) :{' '}
                            {t.assignees
                              .map((a) => a.displayName || a.email || '?')
                              .join(', ')}
                          </span>
                        )}
                        {t.dueDateTime && (
                          <span>Échéance : {new Date(t.dueDateTime).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={importing || selectedIds.size === 0}>
            {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Importer {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>

      <PlannerTitleDuplicatesDialog
        open={titleDupesOpen}
        onOpenChange={setTitleDupesOpen}
        planMappingId={planMappingId}
      />
    </Dialog>
  );
}
