import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskStats } from '@/types/task';
import { ConfigurableDashboard } from '@/components/dashboard/ConfigurableDashboard';
import { MaterialRequestsPanel } from './MaterialRequestsPanel';
import { SupplierListView } from '@/components/suppliers/SupplierListView';
import { SupplierDetailDrawer } from '@/components/suppliers/SupplierDetailDrawer';
import { useSupplierAccess } from '@/hooks/useSupplierAccess';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const ProcessTaskManagement = lazy(() =>
  import('./ProcessTaskManagement').then(m => ({ default: m.ProcessTaskManagement }))
);

interface ProcessDashboardProps {
  // Single process mode
  processId?: string;
  // Department mode - aggregate all tasks for a department
  departmentId?: string;
  processIds?: string[];
  canWrite: boolean;
  processName?: string;
}

export function ProcessDashboard({ processId, departmentId, processIds, canWrite, processName }: ProcessDashboardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const { role: supplierRole } = useSupplierAccess();

  const hasMaterialSection = processName?.toUpperCase().includes('MAINTENANCE') ?? false;
  const hasSupplierSection = processName?.toUpperCase().includes('ACHAT') ?? false;

  const isDeptMode = !!departmentId && !processId;
  const effectiveProcessId = processId || departmentId || '';

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    let query = (supabase as any).from('tasks').select('*');

    if (isDeptMode && departmentId) {
      // Department mode: fetch tasks by department + all process tasks
      // We need tasks where:
      // 1. target_department_id = departmentId
      // 2. OR process_template_id/source_process_template_id in processIds
      // 3. OR assignee is in this department
      const conditions: string[] = [];
      conditions.push(`target_department_id.eq.${departmentId}`);
      if (processIds && processIds.length > 0) {
        processIds.forEach(pid => {
          conditions.push(`process_template_id.eq.${pid}`);
          conditions.push(`source_process_template_id.eq.${pid}`);
        });
      }
      query = query.or(conditions.join(','));
    } else if (processId) {
      query = query.or(`process_template_id.eq.${processId},source_process_template_id.eq.${processId}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      if (isDeptMode && departmentId) {
        // Also fetch tasks where assignee belongs to this department
        const { data: deptProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('department_id', departmentId);

        if (deptProfiles && deptProfiles.length > 0) {
          const deptProfileIds = new Set(deptProfiles.map(p => p.id));
          // Fetch additional tasks by assignee (avoid duplicates)
          const existingIds = new Set((data as any[]).map(t => t.id));
          const { data: assigneeTasks } = await (supabase as any)
            .from('tasks')
            .select('*')
            .in('assignee_id', Array.from(deptProfileIds))
            .order('created_at', { ascending: false });

          if (assigneeTasks) {
            const extra = (assigneeTasks as any[]).filter(t => !existingIds.has(t.id));
            setTasks([...data, ...extra] as Task[]);
          } else {
            setTasks(data as Task[]);
          }
        } else {
          setTasks(data as Task[]);
        }
      } else {
        setTasks(data as Task[]);
      }
    }
    setIsLoading(false);
  }, [user, processId, departmentId, isDeptMode, processIds]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`process-tracking-${effectiveProcessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
      }, () => {
        // In dept mode, refetch all; in process mode, check relevance
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, effectiveProcessId]);

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

  const suspenseFallback = (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const tabs = [
    { value: 'dashboard', label: 'Tableau de bord' },
    { value: 'tasks', label: 'Gestion des tâches' },
    ...(hasMaterialSection ? [{ value: 'material', label: 'Demandes matériel' }] : []),
    ...(hasSupplierSection ? [{ value: 'suppliers', label: 'Référentiel fournisseurs' }] : []),
  ];

  const handleOpenSupplier = (id: string) => {
    setSelectedSupplierId(id);
    setSupplierDrawerOpen(true);
  };

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <TabsList>
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="dashboard">
        <ConfigurableDashboard
          tasks={tasks}
          stats={stats}
          globalProgress={globalProgress}
          processId={effectiveProcessId}
          canEdit={canWrite}
        />
      </TabsContent>
      <TabsContent value="tasks">
        <Suspense fallback={suspenseFallback}>
          <ProcessTaskManagement
            processId={processId}
            departmentId={departmentId}
            processIds={processIds}
            canWrite={canWrite}
          />
        </Suspense>
      </TabsContent>
      {hasMaterialSection && (
        <TabsContent value="material">
          <MaterialRequestsPanel canWrite={canWrite} />
        </TabsContent>
      )}
      {hasSupplierSection && (
        <TabsContent value="suppliers">
          <SupplierListView onOpenSupplier={handleOpenSupplier} />
          <SupplierDetailDrawer
            supplierId={selectedSupplierId}
            open={supplierDrawerOpen}
            onClose={() => { setSupplierDrawerOpen(false); setSelectedSupplierId(null); }}
            canEdit={supplierRole === 'achat'}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
