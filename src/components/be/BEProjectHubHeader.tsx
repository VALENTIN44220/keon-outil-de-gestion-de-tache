import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BEProject } from '@/types/beProject';
import { Task } from '@/types/task';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Calendar, 
  MessageSquare, 
  Paperclip,
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BEProjectHubHeaderProps {
  project: BEProject;
  stats: {
    totalTasks: number;
    openTasks: number;
    doneTasks: number;
    overdueTasks: number;
    progress: number;
  };
  onEditProject?: () => void;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  closed: { label: 'Clôturé', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  on_hold: { label: 'En attente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

const navItems = [
  { value: 'overview', label: 'Fiche', icon: LayoutDashboard },
  { value: 'timeline', label: 'Timeline', icon: Calendar },
  { value: 'discussions', label: 'Discussions', icon: MessageSquare },
  { value: 'files', label: 'Fichiers', icon: Paperclip },
];

export function BEProjectHubHeader({ project, stats, onEditProject }: BEProjectHubHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/');
  const activeTab = pathParts[pathParts.length - 1] || 'overview';

  const handleTabChange = (tab: string) => {
    navigate(`/be/projects/${project.code_projet}/${tab}`);
  };

  const statusConfig = statusLabels[project.status] || statusLabels.active;

  return (
    <div className="sticky top-0 z-20 bg-gradient-to-b from-background via-background to-background/95 border-b backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-2"
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Projets
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">{project.code_projet}</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="px-6 pb-4">
        <div className="flex items-start justify-between gap-6">
          {/* Project Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold text-foreground truncate">
                {project.nom_projet}
              </h1>
              <Badge variant="outline" className="font-mono shrink-0">
                {project.code_projet}
              </Badge>
              <Badge className={cn('border shrink-0', statusConfig.className)}>
                {statusConfig.label}
              </Badge>
              {onEditProject && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 shrink-0"
                  onClick={onEditProject}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </Button>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <div className="p-1.5 rounded bg-blue-500/10">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold leading-none">{stats.totalTasks}</p>
                <p className="text-[10px] text-muted-foreground">Tâches</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <div className="p-1.5 rounded bg-amber-500/10">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold leading-none">{stats.openTasks}</p>
                <p className="text-[10px] text-muted-foreground">En cours</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <div className="p-1.5 rounded bg-emerald-500/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold leading-none">{stats.doneTasks}</p>
                <p className="text-[10px] text-muted-foreground">Terminées</p>
              </div>
            </div>

            {stats.overdueTasks > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                <div className="p-1.5 rounded bg-red-500/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold leading-none text-red-600">{stats.overdueTasks}</p>
                  <p className="text-[10px] text-red-600/70">Retard</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
              <div className="p-1.5 rounded bg-primary/10">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold leading-none text-primary">{stats.progress}%</p>
                <p className="text-[10px] text-primary/70">Avancement</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6 pb-0">
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;

            return (
              <Button
                key={item.value}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-9 px-4 gap-2 transition-all',
                  isActive && 'shadow-sm'
                )}
                onClick={() => handleTabChange(item.value)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
