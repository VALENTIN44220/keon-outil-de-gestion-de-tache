import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BEProject } from '@/types/beProject';
import { BEProjectCard } from './BEProjectCard';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface BEProjectCardsViewProps {
  projects: BEProject[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (project: BEProject) => void;
  onDelete: (project: BEProject) => void;
}

export function BEProjectCardsView({ 
  projects, 
  canEdit, 
  canDelete, 
  onEdit, 
  onDelete 
}: BEProjectCardsViewProps) {
  // Fetch stats for all projects
  const { data: projectStats = {}, isLoading } = useQuery({
    queryKey: ['be-projects-stats', projects.map(p => p.id).join(',')],
    queryFn: async () => {
      if (projects.length === 0) return {};

      const projectIds = projects.map(p => p.id);
      
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, be_project_id, status, due_date')
        .in('be_project_id', projectIds);

      if (error) throw error;

      const stats: Record<string, { totalTasks: number; overdueTasks: number; progress: number }> = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      projectIds.forEach(id => {
        const projectTasks = (tasks || []).filter(t => t.be_project_id === id);
        const total = projectTasks.length;
        const done = projectTasks.filter(t => 
          ['done', 'validated', 'closed'].includes(t.status)
        ).length;
        const overdue = projectTasks.filter(t => {
          if (!t.due_date) return false;
          if (['done', 'validated', 'closed', 'cancelled'].includes(t.status)) return false;
          return new Date(t.due_date) < today;
        }).length;

        stats[id] = {
          totalTasks: total,
          overdueTasks: overdue,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      });

      return stats;
    },
    enabled: projects.length > 0,
    staleTime: 30000, // 30 seconds
  });

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Aucun projet trouvé</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map(project => (
        <BEProjectCard
          key={project.id}
          project={project}
          stats={isLoading ? undefined : projectStats[project.id]}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => onEdit(project)}
          onDelete={() => onDelete(project)}
        />
      ))}
    </div>
  );
}
