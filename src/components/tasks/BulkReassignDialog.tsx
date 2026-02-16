import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserRoundPlus, Search, CheckCircle2, Filter, Users } from 'lucide-react';
import { Task } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onComplete: () => void;
}

interface TeamMember {
  id: string;
  display_name: string;
  avatar_url?: string;
  job_title?: string;
  department?: string;
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

export function BulkReassignDialog({ open, onOpenChange, tasks, onComplete }: BulkReassignDialogProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCurrentAssignee, setFilterCurrentAssignee] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch all active profiles
  useEffect(() => {
    if (!open) return;
    const fetchMembers = async () => {
      setLoadingMembers(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, job_title, department')
        .eq('status', 'active')
        .order('display_name');
      setTeamMembers(data || []);
      setLoadingMembers(false);
    };
    fetchMembers();
  }, [open]);

  // Build a map of assignee names for display
  const assigneeMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach(m => map.set(m.id, m));
    return map;
  }, [teamMembers]);

  // Unique current assignees for filter
  const currentAssignees = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => { if (t.assignee_id) ids.add(t.assignee_id); });
    return Array.from(ids).map(id => ({
      id,
      name: assigneeMap.get(id)?.display_name || 'Inconnu',
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, assigneeMap]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Exclude done/validated/cancelled
      if (['done', 'validated', 'cancelled'].includes(task.status)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = task.title?.toLowerCase().includes(q) ||
          task.task_number?.toLowerCase().includes(q) ||
          task.request_number?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (filterStatus !== 'all' && task.status !== filterStatus) return false;

      if (filterCurrentAssignee === 'unassigned' && task.assignee_id) return false;
      if (filterCurrentAssignee !== 'all' && filterCurrentAssignee !== 'unassigned' && task.assignee_id !== filterCurrentAssignee) return false;

      return true;
    });
  }, [tasks, searchQuery, filterStatus, filterCurrentAssignee]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [searchQuery, filterStatus, filterCurrentAssignee]);

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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedMember = teamMembers.find(m => m.id === targetUserId);

  const handleApply = async () => {
    if (selectedTaskIds.size === 0 || !targetUserId) return;

    setIsProcessing(true);
    try {
      const ids = Array.from(selectedTaskIds);

      // Update in batches of 50
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase
          .from('tasks')
          .update({ assignee_id: targetUserId })
          .in('id', batch);

        if (error) throw error;

        // Also move to_assign → todo
        await supabase
          .from('tasks')
          .update({ assignee_id: targetUserId, status: 'todo' })
          .in('id', batch)
          .eq('status', 'to_assign');
      }

      toast.success(`${ids.length} tâche(s) réaffectée(s) à ${selectedMember?.display_name}`);
      setSelectedTaskIds(new Set());
      setTargetUserId('');
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
    setTargetUserId('');
    setSearchQuery('');
    setFilterStatus('all');
    setFilterCurrentAssignee('all');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Réaffectation en masse
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les tâches puis choisissez le nouveau responsable.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* Target user selection */}
          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <Label className="text-xs font-medium">Nouveau responsable</Label>
            {loadingMembers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement...
              </div>
            ) : (
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner un collaborateur...">
                    {selectedMember && (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={selectedMember.avatar_url} />
                          <AvatarFallback className="text-[8px]">{getInitials(selectedMember.display_name)}</AvatarFallback>
                        </Avatar>
                        <span>{selectedMember.display_name}</span>
                        {selectedMember.department && (
                          <span className="text-muted-foreground text-xs">— {selectedMember.department}</span>
                        )}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatar_url} />
                          <AvatarFallback className="text-[8px]">{getInitials(m.display_name)}</AvatarFallback>
                        </Avatar>
                        <span>{m.display_name}</span>
                        {m.department && <span className="text-muted-foreground text-xs">— {m.department}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            <Select value={filterCurrentAssignee} onValueChange={setFilterCurrentAssignee}>
              <SelectTrigger className="w-[200px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les assignés</SelectItem>
                <SelectItem value="unassigned">Non assignées</SelectItem>
                {currentAssignees.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(statusLabels).map(([s, label]) => (
                  <SelectItem key={s} value={s}>{label}</SelectItem>
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
                  const currentAssignee = task.assignee_id ? assigneeMap.get(task.assignee_id) : null;
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
                          {currentAssignee ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Avatar className="h-3.5 w-3.5">
                                <AvatarImage src={currentAssignee.avatar_url} />
                                <AvatarFallback className="text-[6px]">{getInitials(currentAssignee.display_name)}</AvatarFallback>
                              </Avatar>
                              {currentAssignee.display_name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-orange-600">Non assignée</span>
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
              disabled={selectedTaskIds.size === 0 || !targetUserId || isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundPlus className="h-4 w-4" />
              )}
              Réaffecter ({selectedTaskIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
