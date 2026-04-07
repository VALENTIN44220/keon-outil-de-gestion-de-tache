import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Task } from '@/types/task';
import { ITProjectPhase, IT_PHASE_BADGE_CONFIG } from '@/types/itProject';
import { useSessionStorageState } from '@/hooks/useSessionStorageState';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'to_assign': { label: 'À assigner', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  'todo': { label: 'À faire', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'in-progress': { label: 'En cours', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  'done': { label: 'Terminé', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  'review': { label: 'Revue', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: ITProjectPhase;
  projectTasks: Task[];
  onDone: () => void;
}

export function ITPhaseAssignDialog({ open, onOpenChange, phase, projectTasks, onDone }: Props) {
  const [search, setSearch, clearSearch] = useSessionStorageState<string>(
    `itPhaseAssignDialog:search:${phase}`,
    '',
    { serialize: (v) => v, parse: (raw) => raw },
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const phaseConf = IT_PHASE_BADGE_CONFIG[phase];

  // Tasks eligible: project tasks without this phase (or no phase)
  const eligible = useMemo(() => {
    return projectTasks.filter(t => t.it_project_phase !== phase);
  }, [projectTasks, phase]);

  const filtered = useMemo(() => {
    if (!search) return eligible;
    const q = search.toLowerCase();
    return eligible.filter(t => t.title?.toLowerCase().includes(q));
  }, [eligible, search]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        const { error } = await supabase.from('tasks').update({ it_project_phase: phase }).eq('id', id);
        if (error) throw error;
      }
      toast.success(`${ids.length} tâche(s) rattachée(s) à la phase ${phaseConf.label}`);
      setSelected(new Set());
      clearSearch();
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erreur: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            Rattacher des tâches à
            <Badge className={cn(phaseConf.className, 'border')}>{phaseConf.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1" style={{ maxHeight: '40vh' }}>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Aucune tâche disponible</p>
          ) : (
            filtered.map(task => {
              const isSelected = selected.has(task.id);
              const stConf = STATUS_LABELS[task.status] || { label: task.status, className: 'bg-muted' };
              const currentPhase = task.it_project_phase ? IT_PHASE_BADGE_CONFIG[task.it_project_phase as ITProjectPhase] : null;
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/40 border-border/50'
                  )}
                  onClick={() => toggle(task.id)}
                >
                  <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4 rounded pointer-events-none flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge className={cn(stConf.className, 'border text-[10px] px-1.5 py-0')}>{stConf.label}</Badge>
                      {currentPhase && (
                        <Badge className={cn(currentPhase.className, 'border text-[10px] px-1.5 py-0')}>{currentPhase.label}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleAssign} disabled={selected.size === 0 || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Rattacher{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
