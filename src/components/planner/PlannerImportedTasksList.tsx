import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, ChevronDown, ChevronUp, X, UserRoundPlus, Flag, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PlannerTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  requester_id: string | null;
  reporter_id: string | null;
  assignee_name?: string | null;
  requester_name?: string | null;
  reporter_name?: string | null;
}

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  job_title?: string | null;
}

interface PlannerImportedTasksListProps {
  mappingId: string;
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

const priorityLabels: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

const priorityColors: Record<string, string> = {
  urgent: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-blue-600',
  low: 'text-muted-foreground',
};

type BulkField = 'status' | 'priority' | 'assignee_id' | 'requester_id' | 'reporter_id';

export function PlannerImportedTasksList({ mappingId }: PlannerImportedTasksListProps) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bulk edit state
  const [bulkField, setBulkField] = useState<BulkField | ''>('');
  const [bulkValue, setBulkValue] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    // Get linked task IDs
    const { data: links } = await supabase
      .from('planner_task_links')
      .select('local_task_id')
      .eq('plan_mapping_id', mappingId);

    if (!links || links.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const taskIds = links.map(l => l.local_task_id);
    
    const { data: taskData } = await supabase
      .from('tasks')
      .select('id, title, status, priority, assignee_id, requester_id, reporter_id')
      .in('id', taskIds)
      .order('created_at', { ascending: false });

    if (taskData) {
      // Fetch profile names for assignees
      const profileIds = new Set<string>();
      taskData.forEach(t => {
        if (t.assignee_id) profileIds.add(t.assignee_id);
        if (t.requester_id) profileIds.add(t.requester_id);
        if (t.reporter_id) profileIds.add(t.reporter_id);
      });

      let profileMap = new Map<string, string>();
      if (profileIds.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', Array.from(profileIds));
        profs?.forEach(p => profileMap.set(p.id, p.display_name || 'Sans nom'));
      }

      setTasks(taskData.map(t => ({
        ...t,
        assignee_name: t.assignee_id ? profileMap.get(t.assignee_id) : null,
        requester_name: t.requester_id ? profileMap.get(t.requester_id) : null,
        reporter_name: t.reporter_id ? profileMap.get(t.reporter_id) : null,
      })));
    }
    setLoading(false);
  }, [mappingId]);

  // Fetch all profiles for selection
  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, job_title')
      .eq('status', 'active')
      .order('display_name');
    setProfiles(data || []);
  }, []);

  useEffect(() => {
    if (expanded) {
      fetchTasks();
      fetchProfiles();
    }
  }, [expanded, fetchTasks, fetchProfiles]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t => t.title.toLowerCase().includes(q));
  }, [tasks, searchQuery]);

  const toggleTask = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const filteredProfiles = useMemo(() => {
    if (!profileSearchQuery) return profiles;
    const q = profileSearchQuery.toLowerCase();
    return profiles.filter(p =>
      p.display_name?.toLowerCase().includes(q) ||
      p.job_title?.toLowerCase().includes(q)
    );
  }, [profiles, profileSearchQuery]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleApplyBulk = async () => {
    if (selectedIds.size === 0 || !bulkField || !bulkValue) return;
    setIsApplying(true);
    try {
      const ids = Array.from(selectedIds);
      const updates: Record<string, any> = {
        [bulkField]: bulkValue,
      };

      // If assigning, move from to_assign to todo
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('tasks').update(updates).in('id', batch);
        if (error) throw error;

        if (bulkField === 'assignee_id') {
          await supabase
            .from('tasks')
            .update({ status: 'todo' })
            .in('id', batch)
            .eq('status', 'to_assign');
        }
      }

      const fieldLabels: Record<string, string> = {
        status: 'Statut',
        priority: 'Priorité',
        assignee_id: 'Responsable',
        requester_id: 'Demandeur',
        reporter_id: 'Rapporteur',
      };

      toast.success(`${ids.length} tâche(s) mise(s) à jour — ${fieldLabels[bulkField]}`);
      setSelectedIds(new Set());
      setBulkField('');
      setBulkValue('');
      await fetchTasks();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const selectedProfile = profiles.find(p => p.id === bulkValue);

  const renderProfileSelector = () => (
    <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 min-w-[180px] justify-between font-normal text-xs">
          {selectedProfile ? (
            <div className="flex items-center gap-1.5 truncate">
              <Avatar className="h-4 w-4 shrink-0">
                <AvatarImage src={selectedProfile.avatar_url || undefined} />
                <AvatarFallback className="text-[7px]">{getInitials(selectedProfile.display_name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedProfile.display_name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Sélectionner...</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 z-50 bg-popover" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={profileSearchQuery}
              onChange={e => setProfileSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-[200px]">
          {filteredProfiles.map(p => (
            <button
              key={p.id}
              onClick={() => { setBulkValue(p.id); setProfilePopoverOpen(false); setProfileSearchQuery(''); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
            >
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback className="text-[7px]">{getInitials(p.display_name)}</AvatarFallback>
              </Avatar>
              <div className="truncate">
                <span>{p.display_name}</span>
                {p.job_title && <span className="text-muted-foreground ml-1">({p.job_title})</span>}
              </div>
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  const renderBulkValueSelector = () => {
    if (!bulkField) return null;

    if (['assignee_id', 'requester_id', 'reporter_id'].includes(bulkField)) {
      return renderProfileSelector();
    }

    if (bulkField === 'status') {
      return (
        <Select value={bulkValue} onValueChange={setBulkValue}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Statut..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([val, label]) => (
              <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (bulkField === 'priority') {
      return (
        <Select value={bulkValue} onValueChange={setBulkValue}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Priorité..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(priorityLabels).map(([val, label]) => (
              <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  return (
    <div className="mt-3 border-t pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className="font-medium">Tâches importées ({tasks.length > 0 ? tasks.length : '…'})</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Aucune tâche importée pour ce plan.</p>
          ) : (
            <>
              {/* Search + Bulk toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {selectedIds.size} / {filteredTasks.length} sélectionnée(s)
                </Badge>
              </div>

              {/* Bulk action bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
                  <span className="text-xs font-medium">Modifier :</span>
                  <Select value={bulkField} onValueChange={(v) => { setBulkField(v as BulkField); setBulkValue(''); }}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Champ..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status" className="text-xs">Statut</SelectItem>
                      <SelectItem value="priority" className="text-xs">Priorité</SelectItem>
                      <SelectItem value="assignee_id" className="text-xs">Responsable</SelectItem>
                      <SelectItem value="requester_id" className="text-xs">Demandeur</SelectItem>
                      <SelectItem value="reporter_id" className="text-xs">Rapporteur</SelectItem>
                    </SelectContent>
                  </Select>

                  {renderBulkValueSelector()}

                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={!bulkField || !bulkValue || isApplying}
                    onClick={handleApplyBulk}
                  >
                    {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Appliquer
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => { setSelectedIds(new Set()); setBulkField(''); setBulkValue(''); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Task table */}
              <ScrollArea style={{ height: Math.min(filteredTasks.length * 36 + 36, 320) }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left p-1.5 w-8">
                        <Checkbox
                          checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                          onCheckedChange={selectAll}
                        />
                      </th>
                      <th className="text-left p-1.5">Titre</th>
                      <th className="text-left p-1.5 w-24">Statut</th>
                      <th className="text-left p-1.5 w-20">Priorité</th>
                      <th className="text-left p-1.5 w-28">Responsable</th>
                      <th className="text-left p-1.5 w-28">Demandeur</th>
                      <th className="text-left p-1.5 w-28">Rapporteur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => (
                      <tr
                        key={task.id}
                        className={`border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${selectedIds.has(task.id) ? 'bg-primary/5' : ''}`}
                        onClick={() => toggleTask(task.id)}
                      >
                        <td className="p-1.5" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(task.id)}
                            onCheckedChange={() => toggleTask(task.id)}
                          />
                        </td>
                        <td className="p-1.5 font-medium truncate max-w-[250px]" title={task.title}>
                          {task.title}
                        </td>
                        <td className="p-1.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[task.status] || ''}`}>
                            {statusLabels[task.status] || task.status}
                          </Badge>
                        </td>
                        <td className="p-1.5">
                          <span className={`flex items-center gap-1 ${priorityColors[task.priority] || ''}`}>
                            <Flag className="h-3 w-3" />
                            {priorityLabels[task.priority] || task.priority}
                          </span>
                        </td>
                        <td className="p-1.5 text-muted-foreground truncate">{task.assignee_name || '—'}</td>
                        <td className="p-1.5 text-muted-foreground truncate">{task.requester_name || '—'}</td>
                        <td className="p-1.5 text-muted-foreground truncate">{task.reporter_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>
      )}
    </div>
  );
}
