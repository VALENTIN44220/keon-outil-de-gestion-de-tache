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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, CheckCircle2, Filter, Settings2, ChevronDown, X, UserRoundPlus, Tags } from 'lucide-react';
import { Task } from '@/types/task';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  onComplete: () => void;
  canReassign?: boolean;
}

interface TeamMember {
  id: string;
  display_name: string;
  avatar_url?: string;
  job_title?: string;
  department?: string;
}

interface ServiceGroup {
  id: string;
  name: string;
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

// ── Multi-select filter popover ──────────────────────────────────
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  icon?: React.ReactNode;
}) {
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  const summary =
    selected.size === 0
      ? label
      : selected.size === 1
        ? options.find(o => o.value === [...selected][0])?.label ?? label
        : `${selected.size} sélectionnés`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-normal min-w-[130px] justify-between">
          {icon}
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 z-50 bg-popover" align="start">
        <ScrollArea className="max-h-[260px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-accent rounded transition-colors text-left"
            >
              <Checkbox checked={selected.has(opt.value)} className="pointer-events-none" />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </ScrollArea>
        {selected.size > 0 && (
          <div className="border-t mt-1 pt-1 px-2 pb-1">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange(new Set())}>
              Réinitialiser
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function BulkActionDialog({ open, onOpenChange, tasks, onComplete, canReassign = false }: BulkActionDialogProps) {
  const { categories } = useCategories();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterCurrentAssignees, setFilterCurrentAssignees] = useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const [filterServiceGroups, setFilterServiceGroups] = useState<Set<string>>(new Set());

  // Category targets
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [targetSubcategoryId, setTargetSubcategoryId] = useState<string>('');

  // Reassign target
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [targetSearchOpen, setTargetSearchOpen] = useState(false);
  const [targetSearchQuery, setTargetSearchQuery] = useState('');

  // Data
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [processServiceGroupMap, setProcessServiceGroupMap] = useState<Map<string, string>>(new Map());
  const [plannerTaskIds, setPlannerTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      setLoadingData(true);
      const [membersRes, sgRes, ptRes, plannerRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, job_title, department').eq('status', 'active').order('display_name'),
        (supabase as any).from('service_groups').select('id, name').order('name'),
        (supabase as any).from('process_templates').select('id, service_group_id'),
        supabase.from('planner_task_links').select('local_task_id'),
      ]);
      setTeamMembers(membersRes.data || []);
      setServiceGroups(sgRes.data || []);
      if (plannerRes.data) setPlannerTaskIds(new Set(plannerRes.data.map(d => d.local_task_id)));

      const ptSgMap = new Map<string, string>();
      (ptRes.data || []).forEach((pt: any) => {
        if (pt.service_group_id) ptSgMap.set(pt.id, pt.service_group_id);
      });
      setProcessServiceGroupMap(ptSgMap);
      setLoadingData(false);
    };
    fetchData();
  }, [open]);

  const assigneeMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach(m => map.set(m.id, m));
    return map;
  }, [teamMembers]);

  const currentAssignees = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => { if (t.assignee_id) ids.add(t.assignee_id); });
    return Array.from(ids).map(id => ({
      id,
      name: assigneeMap.get(id)?.display_name || 'Inconnu',
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, assigneeMap]);

  const taskServiceGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach(t => {
      const ptId = (t as any).process_template_id;
      if (ptId && processServiceGroupMap.has(ptId)) {
        map.set(t.id, processServiceGroupMap.get(ptId)!);
      }
    });
    return map;
  }, [tasks, processServiceGroupMap]);

  const subcategories = useMemo(() => {
    if (!targetCategoryId) return [];
    const cat = categories.find(c => c.id === targetCategoryId);
    return cat?.subcategories || [];
  }, [targetCategoryId, categories]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = task.title?.toLowerCase().includes(q) ||
          task.task_number?.toLowerCase().includes(q) ||
          task.request_number?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filterStatuses.size > 0 && !filterStatuses.has(task.status)) return false;
      if (filterCurrentAssignees.size > 0) {
        if (filterCurrentAssignees.has('unassigned') && !task.assignee_id) {
          // pass
        } else if (task.assignee_id && filterCurrentAssignees.has(task.assignee_id)) {
          // pass
        } else {
          return false;
        }
      }
      if (filterSources.size > 0) {
        let match = false;
        if (filterSources.has('no_category') && !task.category_id) match = true;
        if (filterSources.has('planner') && plannerTaskIds.has(task.id)) match = true;
        if (!match) return false;
      }
      if (filterServiceGroups.size > 0) {
        const taskSg = taskServiceGroupMap.get(task.id);
        if (!taskSg || !filterServiceGroups.has(taskSg)) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, filterStatuses, filterCurrentAssignees, filterSources, filterServiceGroups, taskServiceGroupMap, plannerTaskIds]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [searchQuery, filterStatuses, filterCurrentAssignees, filterSources, filterServiceGroups]);

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

  const filteredMembers = useMemo(() => {
    if (!targetSearchQuery) return teamMembers;
    const q = targetSearchQuery.toLowerCase();
    return teamMembers.filter(m =>
      m.display_name?.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q) ||
      m.job_title?.toLowerCase().includes(q)
    );
  }, [teamMembers, targetSearchQuery]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId)?.name;
  };

  const hasAnyAction = targetCategoryId || targetUserId;

  const handleApply = async () => {
    if (selectedTaskIds.size === 0 || !hasAnyAction) return;

    setIsProcessing(true);
    try {
      const ids = Array.from(selectedTaskIds);
      const updates: Record<string, any> = {};

      if (targetCategoryId) {
        updates.category_id = targetCategoryId;
        if (targetSubcategoryId) updates.subcategory_id = targetSubcategoryId;
      }
      if (targetUserId) {
        updates.assignee_id = targetUserId;
      }

      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from('tasks').update(updates).in('id', batch);
        if (error) throw error;

        if (targetUserId) {
          await supabase
            .from('tasks')
            .update({ ...updates, status: 'todo' })
            .in('id', batch)
            .eq('status', 'to_assign');
        }
      }

      const actions: string[] = [];
      if (targetCategoryId) actions.push('catégorisée(s)');
      if (targetUserId) actions.push(`réaffectée(s) à ${selectedMember?.display_name}`);
      toast.success(`${ids.length} tâche(s) ${actions.join(' et ')}`);

      setSelectedTaskIds(new Set());
      onComplete();
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
    setTargetUserId('');
    setSearchQuery('');
    setFilterStatuses(new Set());
    setFilterCurrentAssignees(new Set());
    setFilterSources(new Set());
    setFilterServiceGroups(new Set());
    setTargetSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Actions en masse
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les tâches puis choisissez les actions à appliquer : catégoriser{canReassign ? ' et/ou réaffecter' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden">
          {/* Action panels */}
          <div className={`grid ${canReassign ? 'grid-cols-2' : 'grid-cols-1'} gap-3 shrink-0`}>
            {/* Category assignment */}
            <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Tags className="h-3.5 w-3.5" />
                Catégorie cible
              </Label>
              <Select value={targetCategoryId} onValueChange={(v) => { setTargetCategoryId(v); setTargetSubcategoryId(''); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner une catégorie..." />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={targetSubcategoryId}
                onValueChange={setTargetSubcategoryId}
                disabled={!targetCategoryId || subcategories.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={subcategories.length === 0 ? 'Aucune sous-catégorie' : 'Sous-catégorie (optionnel)...'} />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {subcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reassignment */}
            {canReassign && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <UserRoundPlus className="h-3.5 w-3.5" />
                  Nouveau responsable
                </Label>
                {loadingData ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement...
                  </div>
                ) : (
                  <Popover open={targetSearchOpen} onOpenChange={setTargetSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
                        {selectedMember ? (
                          <div className="flex items-center gap-2 truncate">
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarImage src={selectedMember.avatar_url} />
                              <AvatarFallback className="text-[8px]">{getInitials(selectedMember.display_name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{selectedMember.display_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sélectionner...</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Rechercher un collaborateur..."
                            value={targetSearchQuery}
                            onChange={(e) => setTargetSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                            autoFocus
                          />
                          {targetSearchQuery && (
                            <button onClick={() => setTargetSearchQuery('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <ScrollArea className="max-h-[220px]">
                        {filteredMembers.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">Aucun résultat</div>
                        ) : (
                          filteredMembers.map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setTargetUserId(m.id); setTargetSearchOpen(false); setTargetSearchQuery(''); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors text-sm ${targetUserId === m.id ? 'bg-primary/10' : ''}`}
                            >
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarImage src={m.avatar_url} />
                                <AvatarFallback className="text-[8px]">{getInitials(m.display_name)}</AvatarFallback>
                              </Avatar>
                              <span className="flex-1 truncate">{m.display_name}</span>
                              {m.department && <span className="text-muted-foreground text-xs shrink-0">— {m.department}</span>}
                              {targetUserId === m.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                          ))
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
            </div>
            {canReassign && (
              <MultiSelectFilter
                label="Tous les assignés"
                icon={<Filter className="h-3.5 w-3.5" />}
                selected={filterCurrentAssignees}
                onChange={setFilterCurrentAssignees}
                options={[
                  { value: 'unassigned', label: 'Non assignées' },
                  ...currentAssignees.map(a => ({ value: a.id, label: a.name })),
                ]}
              />
            )}
            <MultiSelectFilter
              label="Import Planner"
              selected={filterSources}
              onChange={setFilterSources}
              options={[
                { value: 'no_category', label: 'Sans catégorie' },
                { value: 'planner', label: 'Import Planner' },
              ]}
            />
            <MultiSelectFilter
              label="Tous les statuts"
              selected={filterStatuses}
              onChange={setFilterStatuses}
              options={Object.entries(statusLabels).map(([s, label]) => ({ value: s, label }))}
            />
            <MultiSelectFilter
              label="Tous les groupes"
              selected={filterServiceGroups}
              onChange={setFilterServiceGroups}
              options={serviceGroups.map(sg => ({ value: sg.id, label: sg.name }))}
            />
          </div>

          {/* Selection summary */}
          <div className="flex items-center justify-between text-sm shrink-0">
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

          {/* Task list — scrollable */}
          <ScrollArea className="flex-1 border rounded-lg" style={{ maxHeight: '40vh' }}>
            <div className="divide-y">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Aucune tâche ne correspond aux filtres
                </div>
              ) : (
                filteredTasks.map(task => {
                  const isSelected = selectedTaskIds.has(task.id);
                  const currentAssignee = task.assignee_id ? assigneeMap.get(task.assignee_id) : null;
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
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                          {currentCat && (
                            <span className="text-[10px] text-muted-foreground">• {currentCat}</span>
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

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t shrink-0">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleApply}
              disabled={selectedTaskIds.size === 0 || !hasAnyAction || isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Settings2 className="h-4 w-4" />
              )}
              Appliquer ({selectedTaskIds.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
