import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Layers, AlertCircle, Loader2 } from 'lucide-react';
import { Task } from '@/types/task';

interface SubProcessInfo {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  taskCount: number;
  completedCount: number;
}

interface WorkflowProgressTabProps {
  task: Task;
}

export function WorkflowProgressTab({ task }: WorkflowProgressTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [subProcesses, setSubProcesses] = useState<SubProcessInfo[]>([]);

  const fetchSubProcessData = useCallback(async () => {
    if (!task.id || !task.source_process_template_id) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch child tasks to identify active sub-processes
      const { data: childTasks } = await supabase
        .from('tasks')
        .select('id, status, source_sub_process_template_id')
        .eq('parent_request_id', task.id);

      if (!childTasks || childTasks.length === 0) {
        setSubProcesses([]);
        setIsLoading(false);
        return;
      }

      // Group by sub-process
      const spGroups = new Map<string, { tasks: typeof childTasks }>();
      childTasks.forEach(ct => {
        const spId = ct.source_sub_process_template_id;
        if (spId) {
          if (!spGroups.has(spId)) {
            spGroups.set(spId, { tasks: [] });
          }
          spGroups.get(spId)!.tasks.push(ct);
        }
      });

      const spIds = Array.from(spGroups.keys());
      if (spIds.length === 0) {
        setSubProcesses([]);
        setIsLoading(false);
        return;
      }

      // Fetch sub-process template info
      const { data: spTemplates } = await supabase
        .from('sub_process_templates')
        .select('id, name, target_department_id')
        .in('id', spIds);

      // Fetch department names
      const deptIds = (spTemplates || [])
        .map(sp => sp.target_department_id)
        .filter(Boolean) as string[];
      
      let deptMap = new Map<string, string>();
      if (deptIds.length > 0) {
        const { data: depts } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', deptIds);
        if (depts) {
          depts.forEach(d => deptMap.set(d.id, d.name));
        }
      }

      // Build sub-process info
      const spInfos: SubProcessInfo[] = (spTemplates || []).map(sp => {
        const group = spGroups.get(sp.id);
        const tasks = group?.tasks || [];
        const completedCount = tasks.filter(t => 
          t.status === 'done' || t.status === 'validated'
        ).length;

        return {
          id: sp.id,
          name: sp.name,
          departmentId: sp.target_department_id,
          departmentName: sp.target_department_id ? deptMap.get(sp.target_department_id) || null : null,
          taskCount: tasks.length,
          completedCount,
        };
      });

      setSubProcesses(spInfos);
    } catch (error) {
      console.error('Error fetching workflow data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [task.id, task.source_process_template_id]);

  useEffect(() => {
    fetchSubProcessData();
  }, [fetchSubProcessData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (subProcesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mb-3" />
        <p className="text-sm">Aucun workflow actif pour cette demande</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Avancement par sous-processus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subProcesses.map((sp) => {
            const percent = sp.taskCount > 0
              ? Math.round((sp.completedCount / sp.taskCount) * 100)
              : 0;
            return (
              <div key={sp.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sp.name}</p>
                    {sp.departmentName && (
                      <p className="text-xs text-muted-foreground">{sp.departmentName}</p>
                    )}
                  </div>
                  <Badge variant={percent === 100 ? 'default' : 'outline'} className="shrink-0">
                    {sp.completedCount}/{sp.taskCount} tâches
                  </Badge>
                </div>
                <Progress value={percent} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
