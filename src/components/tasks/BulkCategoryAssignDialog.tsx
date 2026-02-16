import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Tags, Search, CheckCircle2, Filter } from 'lucide-react';
import { Task } from '@/types/task';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkCategoryAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onComplete: () => void;
}

const statusLabels: Record<string, string> = {
  to_assign: 'À affecter',
  todo: 'À faire',
  'in-progress': 'En cours',
  done: 'Terminé',
  pending_validation_1: 'Validation N1',
  pending_validation_2: 'Validation N2',
  validated: 'Validé',
  refused: 'Refusé',
  review: 'En revue',
  cancelled: 'Annulé',
};

const statusColors: Record<string, string> = {
  to_assign: 'bg-orange-500/10 text-orange-700 border-orange-200',
  todo: 'bg-muted text-muted-foreground',
  'in-progress': 'bg-blue-500/10 text-blue-700 border-blue-200',
  done: 'bg-green-500/10 text-green-700 border-green-200',
  pending_validation_1: 'bg-amber-500/10 text-amber-700 border-amber-200',
  pending_validation_2: 'bg-amber-500/10 text-amber-700 border-amber-200',
  validated: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  refused: 'bg-red-500/10 text-red-700 border-red-200',
  review: 'bg-purple-500/10 text-purple-700 border-purple-200',
  cancelled: 'bg-muted text-muted-foreground',
};

export function BulkCategoryAssignDialog({ open, onOpenChange, tasks, onComplete }: BulkCategoryAssignDialogProps) {
  const { categories } = useCategories();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [targetSubcategoryId, setTargetSubcategoryId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'planner' | 'no_category'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [plannerTaskIds, setPlannerTaskIds] = useState<Set<string>>(new Set());

  // Fetch planner task IDs when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('planner_task_links')
        .select('local_task_id');
      if (data) {
        setPlannerTaskIds(new Set(data.map(d => d.local_task_id)));
      }
    })();
  }, [open]);

  // Available subcategories based on selected category
  const subcategories = useMemo(() => {
    if (!targetCategoryId) return [];
    const cat = categories.find(c => c.id === targetCategoryId);
    return cat?.subcategories || [];
  }, [targetCategoryId, categories]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = task.title.toLowerCase().includes(q) ||
          task.task_number?.toLowerCase().includes(q) ||
          task.request_number?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Source filter
      if (filterSource === 'no_category' && task.category_id) return false;
      if (filterSource === 'planner' && !plannerTaskIds.has(task.id)) return false;

      // Status filter
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;

      return true;
    });
  }, [tasks, searchQuery, filterSource, filterStatus, plannerTaskIds]);

  // All possible statuses - always show all
  const allStatuses = Object.keys(statusLabels);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [searchQuery, filterSource, filterStatus]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleApply = async () => {
    if (selectedTaskIds.size === 0 || !targetCategoryId) return;

    setIsProcessing(true);
    try {
      const updates: Record<string, any> = {
        category_id: targetCategoryId,
      };
      if (targetSubcategoryId) {
        updates.subcategory_id = targetSubcategoryId;
      }

      const ids = Array.from(selectedTaskIds);
      
      // Update in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase
          .from('tasks')
          .update(updates)
          .in('id', batch);
        
        if (error) throw error;
      }

      toast.success(`${ids.length} tâche(s) mise(s) à jour`);
      setSelectedTaskIds(new Set());
      setTargetCategoryId('');
      setTargetSubcategoryId('');
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedTaskIds(new Set());
    setTargetCategoryId('');
    setTargetSubcategoryId('');
    setSearchQuery('');
    setFilterSource('all');
    setFilterStatus('all');
  };

  // Get category name for a task
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId)?.name;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Affectation en masse des catégories
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les tâches puis choisissez la catégorie et sous-catégorie à affecter.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Target category selection */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catégorie cible</Label>
              <Select value={targetCategoryId} onValueChange={(v) => { setTargetCategoryId(v); setTargetSubcategoryId(''); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner une catégorie..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sous-catégorie (optionnel)</Label>
              <Select 
                value={targetSubcategoryId} 
                onValueChange={setTargetSubcategoryId}
                disabled={!targetCategoryId || subcategories.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={subcategories.length === 0 ? 'Aucune disponible' : 'Sélectionner...'} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les tâches</SelectItem>
                <SelectItem value="no_category">Sans catégorie</SelectItem>
                <SelectItem value="planner">Import Planner</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {allStatuses.map(s => (
                  <SelectItem key={s} value={s}>{statusLabels[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selection summary */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length}
                onCheckedChange={selectAll}
              />
              <span className="text-muted-foreground">
                {selectedTaskIds.size > 0
                  ? `${selectedTaskIds.size} tâche(s) sélectionnée(s)`
                  : `${filteredTasks.length} tâche(s) affichée(s)`
                }
              </span>
            </div>
            {selectedTaskIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedTaskIds(new Set())} className="text-xs h-7">
                Désélectionner tout
              </Button>
            )}
          </div>

          {/* Task list */}
          <ScrollArea className="flex-1 border rounded-lg max-h-[340px]">
            <div className="divide-y">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Aucune tâche ne correspond aux filtres
                </div>
              ) : (
                filteredTasks.map(task => {
                  const isSelected = selectedTaskIds.has(task.id);
                  const currentCat = getCategoryName(task.category_id);
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                      onClick={() => toggleTask(task.id)}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {task.task_number && (
                            <span className="text-xs font-mono text-muted-foreground">{task.task_number}</span>
                          )}
                          <span className="text-sm font-medium truncate">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[task.status] || ''}`}>
                            {statusLabels[task.status] || task.status}
                          </Badge>
                          {currentCat ? (
                            <span className="text-[10px] text-muted-foreground">
                              Catégorie: {currentCat}
                            </span>
                          ) : (
                            <span className="text-[10px] text-warning">Sans catégorie</span>
                          )}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleApply}
              disabled={selectedTaskIds.size === 0 || !targetCategoryId || isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Tags className="h-4 w-4" />
              )}
              Affecter ({selectedTaskIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
