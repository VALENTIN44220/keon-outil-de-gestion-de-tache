import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStats } from '@/types/task';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { MaterialRequestsPanel } from './MaterialRequestsPanel';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ProcessDashboardProps {
  processId: string;
  canWrite: boolean;
  processName?: string;
}

export function ProcessDashboard({ processId, canWrite, processName }: ProcessDashboardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const hasMaterialSection = processName?.toUpperCase().includes('MAINTENANCE') ?? false;

  useEffect(() => {
    if (!user || !processId) return;

    async function fetchProcessTasks() {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select('*')
        .eq('process_template_id', processId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTasks(data as Task[]);
      }
      setIsLoading(false);
    }

    fetchProcessTasks();

    const channel = supabase
      .channel(`process-tracking-${processId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `process_template_id=eq.${processId}`,
      }, () => {
        fetchProcessTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, processId]);

  const stats: TaskStats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const pendingValidation = tasks.filter(t =>
      t.status === 'pending_validation_1' || t.status === 'pending_validation_2'
    ).length;
    const validated = tasks.filter(t => t.status === 'validated').length;
    const refused = tasks.filter(t => t.status === 'refused').length;
    const completionRate = total > 0 ? Math.round(((done + validated) / total) * 100) : 0;
    return { total, todo, inProgress, done, pendingValidation, validated, refused, completionRate };
  }, [tasks]);

  const globalProgress = stats.completionRate;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardContent = tasks.length === 0 ? (
    <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl">
      <p className="text-muted-foreground text-lg">
        Aucune demande pour ce processus.
      </p>
    </div>
  ) : (
    <ConfigurableDashboard
      tasks={tasks}
      stats={stats}
      globalProgress={globalProgress}
      processId={processId}
      canEdit={canWrite}
    />
  );

  if (!hasMaterialSection) {
    return dashboardContent;
  }

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
        <TabsTrigger value="material">Demandes matériel</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard">
        {dashboardContent}
      </TabsContent>
      <TabsContent value="material">
        <MaterialRequestsPanel canWrite={canWrite} />
      </TabsContent>
    </Tabs>
  );
}
