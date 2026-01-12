import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Task } from '@/types/task';

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  overdueTasks: number;
  tasksDueThisWeek: number;
  workloadPercent: number; // 0-100+
  checklistProgress: number; // 0-100
}

export function useTeamWorkload() {
  const { profile } = useAuth();
  const [workloads, setWorkloads] = useState<MemberWorkload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchWorkloads();
  }, [profile?.id]);

  const fetchWorkloads = async () => {
    if (!profile?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch team members (subordinates)
      const findSubordinates = async (managerId: string): Promise<string[]> => {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', managerId);
        
        if (!data) return [];
        
        const ids = data.map(p => p.id);
        for (const id of data.map(p => p.id)) {
          const subIds = await findSubordinates(id);
          ids.push(...subIds);
        }
        return ids;
      };

      const subordinateIds = await findSubordinates(profile.id);
      const teamIds = [profile.id, ...subordinateIds];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          avatar_url,
          job_title,
          department
        `)
        .in('id', teamIds);

      if (!profiles) return;

      // Fetch all tasks assigned to team members
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .in('assignee_id', teamIds);

      // Fetch checklist items for progress
      const taskIds = tasks?.map(t => t.id) || [];
      const { data: checklists } = await supabase
        .from('task_checklists')
        .select('task_id, is_completed')
        .in('task_id', taskIds);

      const today = new Date();
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

      // Calculate workload for each member
      const workloadData: MemberWorkload[] = profiles.map(member => {
        const memberTasks = (tasks || []).filter(t => t.assignee_id === member.id);
        const activeTasks = memberTasks.filter(t => t.status !== 'done' && t.status !== 'validated');
        
        const todoTasks = memberTasks.filter(t => t.status === 'todo').length;
        const inProgressTasks = memberTasks.filter(t => t.status === 'in-progress').length;
        const doneTasks = memberTasks.filter(t => t.status === 'done' || t.status === 'validated').length;
        
        const overdueTasks = activeTasks.filter(t => 
          t.due_date && new Date(t.due_date) < today
        ).length;
        
        const tasksDueThisWeek = activeTasks.filter(t => 
          t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) <= endOfWeek
        ).length;

        // Calculate checklist progress
        const memberTaskIds = memberTasks.map(t => t.id);
        const memberChecklists = (checklists || []).filter(c => memberTaskIds.includes(c.task_id));
        const checklistProgress = memberChecklists.length > 0
          ? Math.round((memberChecklists.filter(c => c.is_completed).length / memberChecklists.length) * 100)
          : 0;

        // Workload: based on active tasks (consider 5 tasks as 100% capacity)
        const maxCapacity = 5;
        const workloadPercent = Math.round((activeTasks.length / maxCapacity) * 100);

        return {
          memberId: member.id,
          memberName: member.display_name || 'Sans nom',
          avatarUrl: member.avatar_url,
          jobTitle: member.job_title,
          department: member.department,
          totalTasks: memberTasks.length,
          todoTasks,
          inProgressTasks,
          doneTasks,
          overdueTasks,
          tasksDueThisWeek,
          workloadPercent,
          checklistProgress,
        };
      });

      setWorkloads(workloadData);
    } catch (error) {
      console.error('Error fetching workloads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (workloads.length === 0) return null;
    
    const totalTasks = workloads.reduce((sum, w) => sum + w.totalTasks, 0);
    const totalOverdue = workloads.reduce((sum, w) => sum + w.overdueTasks, 0);
    const avgWorkload = Math.round(workloads.reduce((sum, w) => sum + w.workloadPercent, 0) / workloads.length);
    const overloadedMembers = workloads.filter(w => w.workloadPercent > 100).length;
    
    return {
      totalTasks,
      totalOverdue,
      avgWorkload,
      overloadedMembers,
      teamSize: workloads.length,
    };
  }, [workloads]);

  return {
    workloads,
    stats,
    isLoading,
    refetch: fetchWorkloads,
  };
}
