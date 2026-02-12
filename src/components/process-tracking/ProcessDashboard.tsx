import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStats } from '@/types/task';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { Loader2 } from 'lucide-react';

interface ProcessDashboardProps {
  processId: string;
  canWrite: boolean;
}

export function ProcessDashboard({ processId, canWrite }: ProcessDashboardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || !processId) return;

    async function fetchProcessTasks() {
      setIsLoading(true);
      // Fetch all requests + tasks linked to this process
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

    // Subscribe to realtime changes
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

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl">
        <p className="text-muted-foreground text-lg">
          Aucune demande pour ce processus.
        </p>
      </div>
    );
  }

  return (
    <ConfigurableDashboard
      tasks={tasks}
      stats={stats}
      globalProgress={globalProgress}
    />
  );
}
