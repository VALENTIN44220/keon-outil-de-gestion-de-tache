import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

  // Set of tabs that have been visited (for lazy loading)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (activeTab) {
      setVisitedTabs(prev => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }
  }, [activeTab]);

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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Suivi des processus" searchQuery="" onSearchChange={() => {}} />
      <main className="p-6">
        {processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl gap-4">
            <div className="p-3 rounded-full bg-muted">
              <ShieldX className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-medium text-foreground">
                Aucun processus accessible
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                Vous n'avez accès à aucun processus pour le moment. Contactez votre administrateur pour obtenir les droits de lecture sur un ou plusieurs processus.
              </p>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap h-auto gap-1 mb-6">
              {processes.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="text-sm gap-2">
                  {p.name}
                  {typeof p.task_count === 'number' && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[1.25rem] h-5">
                      {p.task_count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {processes.map((p) => (
              <TabsContent key={p.id} value={p.id}>
                {visitedTabs.has(p.id) ? (
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  }>
                    <ProcessDashboard processId={p.id} canWrite={p.can_write} processName={p.name} />
                  </Suspense>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
      </div>
    </div>
  );
}
