import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Link2, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { IT_PROJECT_PHASES, ITProjectPhase } from '@/types/itProject';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'to_assign': { label: 'À assigner', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  'todo': { label: 'À faire', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'in-progress': { label: 'En cours', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  'review': { label: 'Revue', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  'pending_validation_1': { label: 'Validation N1', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'pending_validation_2': { label: 'Validation N2', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'refused': { label: 'Refusé', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const NONE_PHASE = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ITLinkExistingTasksDialog({ open, onOpenChange, projectId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, string | null>>({});
  const [linking, setLinking] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['unlinked-tasks-for-it'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, assignee:profiles!tasks_assignee_id_fkey(id,display_name,avatar_url)')
        .is('it_project_id', null)
        .not('status', 'in', '("done","cancelled","validated")')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t: any) => t.title?.toLowerCase().includes(q));
  }, [tasks, search]);

  const selectedIds = Object.keys(selected);
  const count = selectedIds.length;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = null;
      return next;
    });
  };

  const setPhase = (id: string, phase: string | null) => {
    setSelected(prev => ({ ...prev, [id]: phase }));
  };

  const handleLink = async () => {
    if (count === 0) return;
    setLinking(true);
    try {
      for (const id of selectedIds) {
        const phase = selected[id];
        const updates: Record<string, any> = { it_project_id: projectId };
        if (phase) updates.it_project_phase = phase;
        const { error } = await supabase.from('tasks').update(updates).eq('id', id);
        if (error) throw error;
      }
      toast.success(`${count} tâche(s) associée(s) au projet`);
      queryClient.invalidateQueries({ queryKey: ['it-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-tasks-for-it'] });
      setSelected({});
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur lors de l\'association : ' + e.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Associer des tâches existantes
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les tâches à rattacher à ce projet IT.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1" style={{ maxHeight: '50vh' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Aucune tâche disponible</p>
          ) : (
            filtered.map((task: any) => {
              const isSelected = task.id in selected;
              const statusConf = STATUS_LABELS[task.status] || { label: task.status, className: 'bg-muted text-muted-foreground' };
              const assignee = task.assignee;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/40 border-border/50'
                  )}
                  onClick={() => toggle(task.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="h-4 w-4 rounded pointer-events-none flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={cn(statusConf.className, 'border text-[10px] px-1.5 py-0')}>
                        {statusConf.label}
                      </Badge>
                      {assignee && (
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={assignee.avatar_url} />
                            <AvatarFallback className="text-[8px]">{assignee.display_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground">{assignee.display_name}</span>
                        </div>
                      )}
                      {task.due_date && (
                        <span className="text-[11px] text-muted-foreground">
                          Éch. {format(new Date(task.due_date), 'dd/MM/yy', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0 w-40" onClick={e => e.stopPropagation()}>
                      <Select
                        value={selected[task.id] || NONE_PHASE}
                        onValueChange={v => setPhase(task.id, v === NONE_PHASE ? null : v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Phase..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_PHASE}>— Aucune phase —</SelectItem>
                          {IT_PROJECT_PHASES.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleLink} disabled={count === 0 || linking}>
            {linking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Associer{count > 0 ? ` (${count} tâche${count > 1 ? 's' : ''})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
