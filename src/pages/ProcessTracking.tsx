import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ShieldX, ChevronRight, Building2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const ProcessDashboard = lazy(() =>
  import('@/components/process-tracking/ProcessDashboard')
    .then(m => ({ default: m.ProcessDashboard }))
    .catch(() => {
      window.location.reload();
      return { default: () => null } as any;
    })
);

const DEPT_COLORS = [
  { bg: 'bg-[hsl(210,80%,55%)]', ring: 'ring-[hsl(210,80%,55%)]', text: 'text-[hsl(210,80%,55%)]' },
  { bg: 'bg-[hsl(150,60%,42%)]', ring: 'ring-[hsl(150,60%,42%)]', text: 'text-[hsl(150,60%,42%)]' },
  { bg: 'bg-[hsl(25,90%,55%)]', ring: 'ring-[hsl(25,90%,55%)]', text: 'text-[hsl(25,90%,55%)]' },
  { bg: 'bg-[hsl(280,65%,55%)]', ring: 'ring-[hsl(280,65%,55%)]', text: 'text-[hsl(280,65%,55%)]' },
  { bg: 'bg-[hsl(350,70%,55%)]', ring: 'ring-[hsl(350,70%,55%)]', text: 'text-[hsl(350,70%,55%)]' },
  { bg: 'bg-[hsl(180,60%,42%)]', ring: 'ring-[hsl(180,60%,42%)]', text: 'text-[hsl(180,60%,42%)]' },
  { bg: 'bg-[hsl(45,85%,50%)]', ring: 'ring-[hsl(45,85%,50%)]', text: 'text-[hsl(45,85%,50%)]' },
  { bg: 'bg-[hsl(320,60%,50%)]', ring: 'ring-[hsl(320,60%,50%)]', text: 'text-[hsl(320,60%,50%)]' },
];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

interface ProcessInfo {
  id: string;
  name: string;
  can_write: boolean;
  task_count?: number;
  target_department_id: string | null;
}

interface DepartmentGroup {
  id: string;
  name: string;
  processes: ProcessInfo[];
  totalTasks: number;
}

export default function ProcessTracking() {
  const [activeView, setActiveView] = useState('process-tracking');
  const [searchParams, setSearchParams] = useSearchParams();
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const loadData = useCallback(async () => {
    if (!user) return;

    // Fetch departments
    const { data: deptData } = await supabase.from('departments').select('id, name').order('name');
    setDepartments(deptData || []);

    // Fetch processes (same logic as before)
    const { data: accessRows } = await (supabase as any)
      .from('process_tracking_access')
      .select('process_template_id, can_write')
      .eq('can_read', true);

    const isAdmin = await (supabase as any).rpc('has_role', { _user_id: user!.id, _role: 'admin' });

    let processList: ProcessInfo[] = [];

    if (isAdmin?.data === true) {
      const { data } = await (supabase as any)
        .from('process_templates')
        .select('id, name, target_department_id')
        .order('name');
      processList = (data || []).map((p: any) => ({ ...p, can_write: true }));
    } else {
      const accessibleIds = (accessRows || []).map((r: any) => r.process_template_id);
      const writeMap = new Map((accessRows || []).map((r: any) => [r.process_template_id, r.can_write]));

      if (accessibleIds.length > 0) {
        const { data } = await (supabase as any)
          .from('process_templates')
          .select('id, name, target_department_id')
          .in('id', accessibleIds)
          .order('name');
        processList = (data || []).map((p: any) => ({
          ...p,
          can_write: writeMap.get(p.id) || false,
        }));
      }
    }

    // Fetch task counts
    if (processList.length > 0) {
      const ids = processList.map(p => p.id);
      const { data: countData } = await (supabase as any)
        .from('tasks')
        .select('process_template_id, source_process_template_id')
        .or(ids.map(id => `process_template_id.eq.${id},source_process_template_id.eq.${id}`).join(','));

      if (countData) {
        const counts = new Map<string, number>();
        (countData as any[]).forEach(row => {
          const pid = row.process_template_id || row.source_process_template_id;
          if (pid) counts.set(pid, (counts.get(pid) || 0) + 1);
        });
        processList = processList.map(p => ({ ...p, task_count: counts.get(p.id) || 0 }));
      }
    }

    setProcesses(processList);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('process-templates-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'process_templates' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  // Group processes by department
  const departmentGroups = useMemo(() => {
    const deptMap = new Map<string, string>();
    departments.forEach(d => deptMap.set(d.id, d.name));

    const groups = new Map<string, DepartmentGroup>();
    const unassigned: ProcessInfo[] = [];

    processes.forEach(p => {
      if (p.target_department_id && deptMap.has(p.target_department_id)) {
        const deptId = p.target_department_id;
        if (!groups.has(deptId)) {
          groups.set(deptId, {
            id: deptId,
            name: deptMap.get(deptId)!,
            processes: [],
            totalTasks: 0,
          });
        }
        const g = groups.get(deptId)!;
        g.processes.push(p);
        g.totalTasks += p.task_count || 0;
      } else {
        unassigned.push(p);
      }
    });

    // Also create groups for departments that have no process but might have tasks
    // (they'll be shown when navigated to via dept-level view)

    const result: DepartmentGroup[] = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Add unassigned processes as individual "department" groups using process name
    unassigned.forEach(p => {
      // Try to find a matching department by name similarity
      const matchingDept = departments.find(d =>
        d.name.toUpperCase().includes(p.name.toUpperCase()) ||
        p.name.toUpperCase().includes(d.name.toUpperCase())
      );

      if (matchingDept) {
        let existing = result.find(g => g.id === matchingDept.id);
        if (!existing) {
          existing = { id: matchingDept.id, name: matchingDept.name, processes: [], totalTasks: 0 };
          result.push(existing);
        }
        existing.processes.push(p);
        existing.totalTasks += p.task_count || 0;
      } else {
        // Create a virtual department group from process name
        result.push({
          id: `process-${p.id}`,
          name: p.name,
          processes: [p],
          totalTasks: p.task_count || 0,
        });
      }
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [processes, departments]);

  // Auto-open the active department
  const activeMode = searchParams.get('mode'); // 'dept' or null (process)
  const activeId = searchParams.get('id') || '';

  useEffect(() => {
    if (activeId && departmentGroups.length > 0) {
      // Find which department contains the active process or is the active dept
      for (const g of departmentGroups) {
        if (g.id === activeId || g.processes.some(p => p.id === activeId)) {
          setOpenDepts(prev => new Set([...prev, g.id]));
          break;
        }
      }
    }
  }, [activeId, departmentGroups]);

  // Default selection
  useEffect(() => {
    if (!isLoading && !activeId && departmentGroups.length > 0) {
      const firstGroup = departmentGroups[0];
      setSearchParams({ mode: 'dept', id: firstGroup.id }, { replace: true });
    }
  }, [isLoading, activeId, departmentGroups, setSearchParams]);

  const handleSelectDept = (deptId: string) => {
    setSearchParams({ mode: 'dept', id: deptId }, { replace: true });
  };

  const handleSelectProcess = (processId: string) => {
    setSearchParams({ mode: 'process', id: processId }, { replace: true });
  };

  const toggleDept = (deptId: string) => {
    setOpenDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Suivi des processus" searchQuery="" onSearchChange={() => {}} />
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full max-w-2xl" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Find active context
  const activeProcess = activeMode === 'process' ? processes.find(p => p.id === activeId) : null;
  const activeDeptGroup = activeMode === 'dept' ? departmentGroups.find(g => g.id === activeId) : null;
  // If no mode but we have an id, check both
  const resolvedProcess = activeProcess || (!activeMode ? processes.find(p => p.id === activeId) : null);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Suivi des processus" searchQuery="" onSearchChange={() => {}} />
        <div className="flex-1 flex overflow-hidden">
          {/* Department sidebar */}
          <aside className="w-64 flex-shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Services</p>
              {departmentGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-4">Aucun processus accessible</p>
              ) : (
                <TooltipProvider delayDuration={300}>
                  {departmentGroups.map((group, idx) => {
                    const color = DEPT_COLORS[idx % DEPT_COLORS.length];
                    const isOpen = openDepts.has(group.id);
                    const isDeptActive = activeMode === 'dept' && activeId === group.id;
                    const isRealDept = !group.id.startsWith('process-');
                    const hasSingleProcess = group.processes.length === 1 && !isRealDept;

                    return (
                      <Collapsible key={group.id} open={isOpen} onOpenChange={() => toggleDept(group.id)}>
                        <div className="flex items-center gap-1">
                          {/* Department header button */}
                          <button
                            onClick={() => {
                              if (isRealDept) {
                                handleSelectDept(group.id);
                              } else if (hasSingleProcess) {
                                handleSelectProcess(group.processes[0].id);
                              } else {
                                toggleDept(group.id);
                              }
                            }}
                            className={cn(
                              "flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left",
                              isDeptActive
                                ? `bg-card shadow-md ring-2 ${color.ring} ring-offset-1 ring-offset-background`
                                : "hover:bg-muted/80"
                            )}
                          >
                            <div className={cn(
                              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm",
                              color.bg,
                              isDeptActive && "scale-110"
                            )}>
                              {getInitials(group.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "block truncate text-sm",
                                isDeptActive ? "text-foreground font-semibold" : "text-muted-foreground"
                              )}>
                                {group.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {group.totalTasks} tâche{group.totalTasks !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </button>
                          {/* Expand/collapse toggle for groups with multiple processes */}
                          {group.processes.length > 1 || isRealDept ? (
                            <CollapsibleTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground">
                                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
                              </button>
                            </CollapsibleTrigger>
                          ) : null}
                        </div>

                        <CollapsibleContent>
                          <div className="ml-6 pl-3 border-l border-border/50 space-y-0.5 py-1">
                            {group.processes.map(p => {
                              const isProcessActive = activeMode === 'process' && activeId === p.id;
                              return (
                                <Tooltip key={p.id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleSelectProcess(p.id)}
                                      className={cn(
                                        "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors",
                                        isProcessActive
                                          ? "bg-primary/10 text-primary font-semibold"
                                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                      )}
                                    >
                                      <span className="block truncate">{p.name}</span>
                                      {typeof p.task_count === 'number' && (
                                        <span className="text-[10px] opacity-70">{p.task_count} tâche{p.task_count !== 1 ? 's' : ''}</span>
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="text-xs">{p.name}</TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </TooltipProvider>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            {departmentGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl gap-4">
                <div className="p-3 rounded-full bg-muted">
                  <ShieldX className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-medium text-foreground">Aucun processus accessible</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Contactez votre administrateur pour obtenir les droits de lecture.
                  </p>
                </div>
              </div>
            ) : activeDeptGroup ? (
              <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                <ProcessDashboard
                  departmentId={activeDeptGroup.id}
                  processIds={activeDeptGroup.processes.map(p => p.id)}
                  canWrite={activeDeptGroup.processes.some(p => p.can_write)}
                  processName={activeDeptGroup.name}
                />
              </Suspense>
            ) : resolvedProcess ? (
              <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                <ProcessDashboard
                  processId={resolvedProcess.id}
                  canWrite={resolvedProcess.can_write}
                  processName={resolvedProcess.name}
                />
              </Suspense>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
