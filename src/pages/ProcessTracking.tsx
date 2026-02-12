import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldX } from 'lucide-react';

const ProcessDashboard = lazy(() =>
  import('@/components/process-tracking/ProcessDashboard').then(m => ({ default: m.ProcessDashboard }))
);

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

  useEffect(() => {
    if (!user) return;

    async function load() {
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

      // Fetch task counts per process in one query
      if (processList.length > 0) {
        const ids = processList.map(p => p.id);
        const { data: countData } = await (supabase as any)
          .from('tasks')
          .select('process_template_id')
          .in('process_template_id', ids);

        if (countData) {
          const counts = new Map<string, number>();
          (countData as any[]).forEach(row => {
            counts.set(row.process_template_id, (counts.get(row.process_template_id) || 0) + 1);
          });
          processList = processList.map(p => ({ ...p, task_count: counts.get(p.id) || 0 }));
        }
      }

      setProcesses(processList);
      setIsLoading(false);
    }
    load();
  }, [user]);

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
          <aside className="w-56 flex-shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
            <div className="p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Processus</p>
              {processes.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-4">Aucun processus accessible</p>
              ) : (
                processes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleTabChange(p.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                      activeTab === p.id
                        ? "bg-primary/10 text-primary border-l-4 border-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-4 border-transparent"
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    {typeof p.task_count === 'number' && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[1.25rem] h-5 flex-shrink-0">
                        {p.task_count}
                      </Badge>
                    )}
                  </button>
                ))
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
