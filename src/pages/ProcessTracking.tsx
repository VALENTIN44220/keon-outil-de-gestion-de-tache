import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldX } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ProcessDashboard = lazy(() =>
  import('@/components/process-tracking/ProcessDashboard')
    .then(m => ({ default: m.ProcessDashboard }))
    .catch(() => {
      window.location.reload();
      return { default: () => null } as any;
    })
);

const PROCESS_COLORS = [
  { bg: 'bg-[hsl(210,80%,55%)]', ring: 'ring-[hsl(210,80%,55%)]' },
  { bg: 'bg-[hsl(150,60%,42%)]', ring: 'ring-[hsl(150,60%,42%)]' },
  { bg: 'bg-[hsl(25,90%,55%)]', ring: 'ring-[hsl(25,90%,55%)]' },
  { bg: 'bg-[hsl(280,65%,55%)]', ring: 'ring-[hsl(280,65%,55%)]' },
  { bg: 'bg-[hsl(350,70%,55%)]', ring: 'ring-[hsl(350,70%,55%)]' },
  { bg: 'bg-[hsl(180,60%,42%)]', ring: 'ring-[hsl(180,60%,42%)]' },
  { bg: 'bg-[hsl(45,85%,50%)]', ring: 'ring-[hsl(45,85%,50%)]' },
  { bg: 'bg-[hsl(320,60%,50%)]', ring: 'ring-[hsl(320,60%,50%)]' },
];

function getProcessInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

interface ProcessTab {
  id: string;
  name: string;
  can_write: boolean;
  task_count?: number;
}

export default function ProcessTracking() {
  const [activeView, setActiveView] = useState('process-tracking');
  const [searchParams, setSearchParams] = useSearchParams();
  const [processes, setProcesses] = useState<ProcessTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const loadProcesses = useCallback(async () => {
    if (!user) return;

    const { data: accessRows } = await (supabase as any)
      .from('process_tracking_access')
      .select('process_template_id, can_write')
      .eq('can_read', true);

    const isAdmin = await (supabase as any).rpc('has_role', { _user_id: user!.id, _role: 'admin' });

    let processList: ProcessTab[] = [];

    if (isAdmin?.data === true) {
      const { data } = await (supabase as any)
        .from('process_templates')
        .select('id, name')
        .order('name');
      processList = (data || []).map((p: any) => ({ ...p, can_write: true }));
    } else {
      const accessibleIds = (accessRows || []).map((r: any) => r.process_template_id);
      const writeMap = new Map((accessRows || []).map((r: any) => [r.process_template_id, r.can_write]));

      if (accessibleIds.length > 0) {
        const { data } = await (supabase as any)
          .from('process_templates')
          .select('id, name')
          .in('id', accessibleIds)
          .order('name');
        processList = (data || []).map((p: any) => ({
          ...p,
          can_write: writeMap.get(p.id) || false,
        }));
      }
    }

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
          if (pid) {
            counts.set(pid, (counts.get(pid) || 0) + 1);
          }
        });
        processList = processList.map(p => ({ ...p, task_count: counts.get(p.id) || 0 }));
      }
    }

    setProcesses(processList);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  useEffect(() => {
    const channel = supabase
      .channel('process-templates-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'process_templates' },
        () => { loadProcesses(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadProcesses]);

  const activeTab = searchParams.get('process') || processes[0]?.id || '';

  const handleTabChange = (value: string) => {
    setSearchParams({ process: value }, { replace: true });
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

  const activeProcess = processes.find(p => p.id === activeTab);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Suivi des processus" searchQuery="" onSearchChange={() => {}} />
        <div className="flex-1 flex overflow-hidden">
          {/* Process sidebar */}
          <aside className="w-60 flex-shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
            <div className="p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Processus</p>
              {processes.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-4">Aucun processus accessible</p>
              ) : (
                <TooltipProvider delayDuration={300}>
                  {processes.map((p, index) => {
                    const isActive = activeTab === p.id;
                    const color = PROCESS_COLORS[index % PROCESS_COLORS.length];
                    return (
                      <Tooltip key={p.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleTabChange(p.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                              isActive
                                ? `bg-card shadow-md ring-2 ${color.ring} ring-offset-1 ring-offset-background`
                                : "hover:bg-muted/80 hover:shadow-sm"
                            )}
                          >
                            <div className={cn(
                              "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm transition-transform",
                              color.bg,
                              isActive && "scale-110"
                            )}>
                              {getProcessInitials(p.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "block truncate text-sm",
                                isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                              )}>
                                {p.name}
                              </span>
                              {typeof p.task_count === 'number' && (
                                <span className="text-xs text-muted-foreground">
                                  {p.task_count} demande{p.task_count !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {p.name}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            {processes.length === 0 ? (
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
            ) : activeProcess ? (
              <Suspense fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
                <ProcessDashboard processId={activeProcess.id} canWrite={activeProcess.can_write} processName={activeProcess.name} />
              </Suspense>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
