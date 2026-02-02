import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Pause, GitBranch } from 'lucide-react';

interface SubProcessProgressCardProps {
  name: string;
  status: 'pending' | 'in_progress' | 'done';
  progress: number;
  completedTasks: number;
  taskCount: number;
  assigneeName?: string;
  assigneeAvatar?: string;
  colorIndex?: number;
}

// Palette de couleurs distinctives pour les sous-processus
const SUB_PROCESS_COLORS = [
  { bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-500', text: 'text-blue-700', progress: 'bg-blue-500' },
  { bg: 'bg-violet-500/10', border: 'border-violet-500/30', dot: 'bg-violet-500', text: 'text-violet-700', progress: 'bg-violet-500' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500', text: 'text-emerald-700', progress: 'bg-emerald-500' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500', text: 'text-orange-700', progress: 'bg-orange-500' },
  { bg: 'bg-pink-500/10', border: 'border-pink-500/30', dot: 'bg-pink-500', text: 'text-pink-700', progress: 'bg-pink-500' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', dot: 'bg-cyan-500', text: 'text-cyan-700', progress: 'bg-cyan-500' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500', text: 'text-amber-700', progress: 'bg-amber-500' },
  { bg: 'bg-teal-500/10', border: 'border-teal-500/30', dot: 'bg-teal-500', text: 'text-teal-700', progress: 'bg-teal-500' },
];

export function SubProcessProgressCard({
  name,
  status,
  progress,
  completedTasks,
  taskCount,
  assigneeName,
  assigneeAvatar,
  colorIndex = 0,
}: SubProcessProgressCardProps) {
  const colorScheme = SUB_PROCESS_COLORS[colorIndex % SUB_PROCESS_COLORS.length];
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case 'in_progress':
        return <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />;
      default:
        return <Pause className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'done':
        return 'Terminé';
      case 'in_progress':
        return 'En cours';
      default:
        return 'En attente';
    }
  };

  return (
    <div 
      className={cn(
        "relative flex flex-col gap-2 p-3 rounded-xl border-2 transition-all hover:shadow-sm",
        colorScheme.bg,
        colorScheme.border
      )}
    >
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1",
            colorScheme.dot,
            status === 'in_progress' && 'animate-pulse',
            status === 'done' && 'ring-success/30',
            status === 'in_progress' && 'ring-primary/30',
            status === 'pending' && 'ring-muted-foreground/30'
          )} />
          <span className={cn("text-xs font-semibold truncate", colorScheme.text)}>
            {name}
          </span>
        </div>
        
        {/* Status Badge */}
        <Badge 
          variant="outline" 
          className={cn(
            "text-[9px] px-1.5 py-0 gap-1 shrink-0",
            status === 'done' && 'bg-success/20 text-success border-success/30',
            status === 'in_progress' && 'bg-primary/20 text-primary border-primary/30',
            status === 'pending' && 'bg-muted text-muted-foreground'
          )}
        >
          {getStatusIcon()}
          {getStatusLabel()}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-background/80 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-500", colorScheme.progress)}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-medium tabular-nums shrink-0">
            {completedTasks}/{taskCount}
          </span>
        </div>
      </div>

      {/* Footer: Assignee */}
      {assigneeName && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
          <Avatar className="h-4 w-4">
            <AvatarImage src={assigneeAvatar} />
            <AvatarFallback className={cn("text-[7px]", colorScheme.bg, colorScheme.text)}>
              {getInitials(assigneeName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground truncate">
            {assigneeName}
          </span>
        </div>
      )}
    </div>
  );
}
