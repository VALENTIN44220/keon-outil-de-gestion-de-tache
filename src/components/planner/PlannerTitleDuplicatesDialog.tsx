import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DuplicateGroup {
  clean_title: string;
  task_ids: string[];
  titles: string[];
  task_numbers: (string | null)[];
  created_dates: string[];
  count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planMappingId: string | null;
  /** Notifies parent when something was deleted so it can refresh state */
  onCleaned?: () => void;
}

/**
 * Dialog that lists Planner-imported tasks sharing the same real title
 * (after stripping the legacy "T-PERSO-XXXX — <ID>-/-<bucket>-/-" prefix).
 * Lets the user pick which copies to delete (oldest is pre-kept by default).
 */
export function PlannerTitleDuplicatesDialog({
  open,
  onOpenChange,
  planMappingId,
  onCleaned,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  // For each group: set of task ids the user wants to DELETE
  const [toDelete, setToDelete] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!open || !planMappingId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc(
          'detect_planner_title_duplicates' as never,
          { p_plan_mapping_id: planMappingId } as never,
        );
        if (error) throw error;
        if (cancelled) return;
        const list = (data as unknown as DuplicateGroup[] | null) || [];
        setGroups(list);
        // By default, pre-select every duplicate EXCEPT the oldest in each group
        const initial: Record<string, Set<string>> = {};
        list.forEach((g) => {
          const set = new Set<string>();
          // task_ids are returned ASC by created_at: index 0 is oldest -> keep
          g.task_ids.slice(1).forEach((id) => set.add(id));
          initial[g.clean_title] = set;
        });
        setToDelete(initial);
      } catch (err: any) {
        toast.error(`Détection impossible : ${err.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, planMappingId]);

  const totalToDelete = Object.values(toDelete).reduce((acc, s) => acc + s.size, 0);

  const toggleTask = (groupKey: string, taskId: string, checked: boolean) => {
    setToDelete((prev) => {
      const next = { ...prev };
      const set = new Set(next[groupKey] || []);
      if (checked) set.add(taskId);
      else set.delete(taskId);
      next[groupKey] = set;
      return next;
    });
  };

  const handleMerge = async () => {
    const ids = Object.values(toDelete).flatMap((s) => Array.from(s));
    if (ids.length === 0) {
      toast.info('Aucune tâche cochée à supprimer.');
      return;
    }
    if (
      !window.confirm(
        `Supprimer définitivement ${ids.length} tâche(s) en doublon ?\n\nCette action est irréversible.`,
      )
    ) {
      return;
    }
    setMerging(true);
    try {
      const { data, error } = await supabase.rpc(
        'merge_planner_title_duplicates' as never,
        { p_task_ids_to_delete: ids } as never,
      );
      if (error) throw error;
      const payload = data as { deleted_tasks?: number; deleted_links?: number } | null;
      toast.success(
        `Doublons fusionnés : ${payload?.deleted_tasks ?? 0} tâche(s) supprimée(s), ${
          payload?.deleted_links ?? 0
        } lien(s) Planner retiré(s).`,
      );
      onCleaned?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Suppression impossible : ${err.message}`);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Doublons par titre Planner</DialogTitle>
          <DialogDescription>
            Tâches importées depuis Planner qui partagent le même titre réel après nettoyage du
            préfixe automatique. Cochez les copies à supprimer ; la plus ancienne de chaque groupe
            est conservée par défaut.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[460px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Recherche des doublons…
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <AlertTriangle className="h-6 w-6" />
              Aucun doublon détecté.
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div
                  key={g.clean_title}
                  className="border rounded-md p-3 bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium truncate">{g.clean_title}</div>
                    <Badge variant="secondary" className="text-xs">
                      {g.count} copies
                    </Badge>
                  </div>
                  <div className="divide-y">
                    {g.task_ids.map((id, idx) => {
                      const isOldest = idx === 0;
                      const checked = toDelete[g.clean_title]?.has(id) ?? false;
                      return (
                        <label
                          key={id}
                          className="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/40 rounded px-1"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggleTask(g.clean_title, id, c === true)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0 text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="truncate font-mono text-xs">
                                {g.task_numbers[idx] || '—'}
                              </span>
                              {isOldest && (
                                <Badge variant="outline" className="text-xs">
                                  Plus ancienne (à garder)
                                </Badge>
                              )}
                              {checked && (
                                <Badge variant="destructive" className="text-xs">
                                  Sera supprimée
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {g.titles[idx]}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Créée le{' '}
                              {new Date(g.created_dates[idx]).toLocaleString('fr-FR')}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {totalToDelete} tâche(s) sélectionnée(s) pour suppression
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={merging}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleMerge}
              disabled={merging || totalToDelete === 0}
              className="gap-1"
            >
              {merging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer {totalToDelete > 0 ? `(${totalToDelete})` : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
