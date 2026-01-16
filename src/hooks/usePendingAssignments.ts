import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Task } from '@/types/task';

export interface TaskToAssign {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  parent_request_id: string | null;
  source_process_template_id: string | null;
  source_sub_process_template_id: string | null;
  target_department_id: string | null;
  requires_validation: boolean | null;
  be_project_id: string | null;
  created_at: string;
  // Joined data
  parent_request?: {
    id: string;
    title: string;
    requester_id: string | null;
  } | null;
  assignee?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface UsePendingAssignmentsResult {
  tasksToAssign: TaskToAssign[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  assignTask: (taskId: string, assigneeId: string) => Promise<void>;
  getPendingCount: () => number;
  getRequestsWithPending: () => { requestId: string; title: string; count: number; allAssigned: boolean }[];
}

export function usePendingAssignments(): UsePendingAssignmentsResult {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [tasksToAssign, setTasksToAssign] = useState<TaskToAssign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasksToAssign = useCallback(async () => {
    if (!user || !profile) {
      setTasksToAssign([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch tasks with status 'to_assign' that are assigned to the current user (as manager)
      // or tasks in their department that need assignment
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          priority,
          status,
          due_date,
          assignee_id,
          parent_request_id,
          source_process_template_id,
          source_sub_process_template_id,
          target_department_id,
          requires_validation,
          be_project_id,
          created_at
        `)
        .eq('status', 'to_assign')
        .eq('type', 'task')
        .or(`assignee_id.eq.${profile.id},target_department_id.eq.${profile.department_id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch parent requests for these tasks
      const parentRequestIds = [...new Set((data || []).map(t => t.parent_request_id).filter(Boolean))];
      let parentRequests: Record<string, { id: string; title: string; requester_id: string | null }> = {};
      
      if (parentRequestIds.length > 0) {
        const { data: requestsData } = await supabase
          .from('tasks')
          .select('id, title, requester_id')
          .in('id', parentRequestIds);
        
        if (requestsData) {
          parentRequests = requestsData.reduce((acc, req) => {
            acc[req.id] = req;
            return acc;
          }, {} as typeof parentRequests);
        }
      }

      // Map tasks with parent request info
      const tasksWithRelations: TaskToAssign[] = (data || []).map(task => ({
        ...task,
        parent_request: task.parent_request_id ? parentRequests[task.parent_request_id] || null : null,
        assignee: null, // Will be filled when assigned
      }));

      setTasksToAssign(tasksWithRelations);
    } catch (error) {
      console.error('Error fetching tasks to assign:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les tâches à affecter',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => {
    fetchTasksToAssign();
  }, [fetchTasksToAssign]);

  const assignTask = async (taskId: string, assigneeId: string) => {
    try {
      // Update the task: change assignee and status to 'todo'
      const { error } = await supabase
        .from('tasks')
        .update({
          assignee_id: assigneeId,
          status: 'todo',
        })
        .eq('id', taskId);

      if (error) throw error;

      // Remove the task from local state since it's now assigned
      setTasksToAssign(prev => prev.filter(t => t.id !== taskId));

      toast({
        title: 'Tâche affectée',
        description: 'La tâche a été affectée avec succès',
      });
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'affecter la tâche",
        variant: 'destructive',
      });
    }
  };

  const getPendingCount = () => {
    return tasksToAssign.length;
  };

  const getRequestsWithPending = () => {
    const requestMap = new Map<string, { title: string; count: number; allAssigned: boolean }>();

    for (const task of tasksToAssign) {
      const requestId = task.parent_request_id;
      if (!requestId) continue;

      const existing = requestMap.get(requestId);
      if (existing) {
        existing.count++;
      } else {
        requestMap.set(requestId, {
          title: task.parent_request?.title || 'Demande',
          count: 1,
          allAssigned: false, // Always false for tasks that need assignment
        });
      }
    }

    return Array.from(requestMap.entries()).map(([requestId, data]) => ({
      requestId,
      ...data,
    }));
  };

  return {
    tasksToAssign,
    isLoading,
    refetch: fetchTasksToAssign,
    assignTask,
    getPendingCount,
    getRequestsWithPending,
  };
}
