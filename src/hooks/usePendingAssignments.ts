import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addDays, format } from 'date-fns';

export interface PendingAssignment {
  id: string;
  request_id: string;
  task_template_id: string;
  process_template_id: string | null;
  sub_process_template_id: string | null;
  assignee_id: string | null;
  status: 'pending' | 'assigned' | 'created';
  assigned_at: string | null;
  assigned_by: string | null;
  created_task_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  task_template?: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    default_duration_days: number | null;
    requires_validation: boolean | null;
  };
  request?: {
    id: string;
    title: string;
    requester_id: string | null;
    be_project_id: string | null;
    be_label_id: string | null;
  };
  assignee?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface UsePendingAssignmentsResult {
  pendingAssignments: PendingAssignment[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  assignPendingTask: (pendingId: string, assigneeId: string) => Promise<void>;
  confirmAndCreateTasks: (requestId: string) => Promise<void>;
  getPendingCount: () => number;
  getRequestsWithPending: () => { requestId: string; title: string; count: number; allAssigned: boolean }[];
}

export function usePendingAssignments(): UsePendingAssignmentsResult {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingAssignments = useCallback(async () => {
    if (!user || !profile) {
      setPendingAssignments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_task_assignments' as any)
        .select(`
          *,
          task_template:task_templates(id, title, description, priority, default_duration_days, requires_validation),
          request:tasks!request_id(id, title, requester_id, be_project_id, be_label_id),
          assignee:profiles!assignee_id(id, display_name, avatar_url)
        `)
        .in('status', ['pending', 'assigned'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPendingAssignments((data || []) as unknown as PendingAssignment[]);
    } catch (error) {
      console.error('Error fetching pending assignments:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les affectations en attente',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => {
    fetchPendingAssignments();
  }, [fetchPendingAssignments]);

  const assignPendingTask = async (pendingId: string, assigneeId: string) => {
    try {
      const { error } = await supabase
        .from('pending_task_assignments' as any)
        .update({
          assignee_id: assigneeId,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          assigned_by: profile?.id,
        })
        .eq('id', pendingId);

      if (error) throw error;

      setPendingAssignments(prev =>
        prev.map(p =>
          p.id === pendingId
            ? { ...p, assignee_id: assigneeId, status: 'assigned' as const }
            : p
        )
      );

      toast({
        title: 'Affectation enregistrée',
        description: 'La tâche sera créée une fois toutes les affectations complétées',
      });
    } catch (error) {
      console.error('Error assigning pending task:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'affecter la tâche",
        variant: 'destructive',
      });
    }
  };

  const confirmAndCreateTasks = async (requestId: string) => {
    try {
      // Get all pending assignments for this request that are assigned
      const requestAssignments = pendingAssignments.filter(
        p => p.request_id === requestId && p.status === 'assigned' && p.assignee_id
      );

      if (requestAssignments.length === 0) {
        toast({
          title: 'Attention',
          description: 'Aucune tâche affectée à créer',
          variant: 'destructive',
        });
        return;
      }

      const today = new Date();
      const createdTaskIds: { pendingId: string; taskId: string }[] = [];

      // Create each task
      for (const pending of requestAssignments) {
        const template = pending.task_template;
        if (!template) continue;

        const dueDate = template.default_duration_days
          ? format(addDays(today, template.default_duration_days), 'yyyy-MM-dd')
          : null;

        // Get request details for category/project info
        const request = pending.request;

        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: template.title,
            description: template.description,
            priority: template.priority,
            status: 'todo',
            type: 'task',
            due_date: dueDate,
            user_id: user!.id,
            assignee_id: pending.assignee_id,
            parent_request_id: requestId,
            source_process_template_id: pending.process_template_id,
            source_sub_process_template_id: pending.sub_process_template_id,
            requires_validation: template.requires_validation || false,
            be_project_id: request?.be_project_id || null,
            be_label_id: request?.be_label_id || null,
          })
          .select()
          .single();

        if (taskError) {
          console.error('Error creating task:', taskError);
          continue;
        }

        createdTaskIds.push({ pendingId: pending.id, taskId: newTask.id });

        // Copy checklist items from template
        const { data: templateChecklists } = await supabase
          .from('task_template_checklists')
          .select('*')
          .eq('task_template_id', template.id);

        if (templateChecklists && templateChecklists.length > 0) {
          await supabase.from('task_checklists').insert(
            templateChecklists.map((item) => ({
              task_id: newTask.id,
              title: item.title,
              order_index: item.order_index,
            }))
          );
        }

        // Copy validation levels if required
        if (template.requires_validation) {
          const { data: templateValidationLevels } = await supabase
            .from('template_validation_levels')
            .select('*')
            .eq('task_template_id', template.id);

          if (templateValidationLevels && templateValidationLevels.length > 0) {
            await supabase.from('task_validation_levels').insert(
              templateValidationLevels.map((level) => ({
                task_id: newTask.id,
                level: level.level,
                validator_id: level.validator_profile_id,
                validator_department_id: level.validator_department_id,
                status: 'pending',
              }))
            );
          }
        }
      }

      // Update pending assignments to 'created' status
      for (const { pendingId, taskId } of createdTaskIds) {
        await supabase
          .from('pending_task_assignments' as any)
          .update({
            status: 'created',
            created_task_id: taskId,
          })
          .eq('id', pendingId);
      }

      // Update request status to indicate tasks are assigned
      await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', requestId);

      // Mark the assignment task as completed (done)
      const assignmentTaskUpdate: { status: string; assignee_id?: string } = { 
        status: 'done' 
      };
      
      // Only set assignee_id if profile.id is valid
      if (profile?.id && profile.id.length > 0) {
        assignmentTaskUpdate.assignee_id = profile.id;
      }
      
      await supabase
        .from('tasks')
        .update(assignmentTaskUpdate)
        .eq('parent_request_id', requestId)
        .eq('is_assignment_task', true);

      // Remove created tasks from local state
      setPendingAssignments(prev =>
        prev.filter(p => !createdTaskIds.some(c => c.pendingId === p.id))
      );

      toast({
        title: 'Tâches créées',
        description: `${createdTaskIds.length} tâche(s) ont été créées et assignées`,
      });

      await fetchPendingAssignments();
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer les tâches',
        variant: 'destructive',
      });
    }
  };

  const getPendingCount = () => {
    return pendingAssignments.filter(p => p.status === 'pending').length;
  };

  const getRequestsWithPending = () => {
    const requestMap = new Map<string, { title: string; count: number; allAssigned: boolean }>();

    for (const pending of pendingAssignments) {
      const existing = requestMap.get(pending.request_id);
      if (existing) {
        existing.count++;
        if (pending.status === 'pending') {
          existing.allAssigned = false;
        }
      } else {
        requestMap.set(pending.request_id, {
          title: pending.request?.title || 'Demande',
          count: 1,
          allAssigned: pending.status === 'assigned',
        });
      }
    }

    return Array.from(requestMap.entries()).map(([requestId, data]) => ({
      requestId,
      ...data,
    }));
  };

  return {
    pendingAssignments,
    isLoading,
    refetch: fetchPendingAssignments,
    assignPendingTask,
    confirmAndCreateTasks,
    getPendingCount,
    getRequestsWithPending,
  };
}
