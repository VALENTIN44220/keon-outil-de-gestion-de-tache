import { cn } from '@/lib/utils';
import {
  ClipboardList,
  PlayCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Palmtree,
  Sun,
  Flag,
  ArrowUpRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LegendItem {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const TASK_LEGEND: LegendItem[] = [
  {
    label: 'À faire',
    color: 'text-slate-600',
    bgColor: 'bg-gradient-to-r from-slate-500 to-slate-400',
    icon: ClipboardList,
    description: 'Tâche planifiée non démarrée',
  },
  {
    label: 'En cours',
    color: 'text-blue-600',
    bgColor: 'bg-gradient-to-r from-blue-500 to-blue-400',
    icon: PlayCircle,
    description: 'Tâche en cours de réalisation',
  },
  {
    label: 'Terminée',
    color: 'text-emerald-600',
    bgColor: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    icon: CheckCircle2,
    description: 'Tâche terminée ou validée',
  },
  {
    label: 'Validation',
    color: 'text-violet-600',
    bgColor: 'bg-gradient-to-r from-violet-500 to-violet-400',
    icon: Clock,
    description: 'En attente de validation',
  },
];

const OTHER_LEGEND: LegendItem[] = [
  {
    label: 'Congé',
    color: 'text-cyan-600',
    bgColor: 'bg-gradient-to-r from-cyan-500 to-cyan-400',
    icon: Palmtree,
    description: 'Congé payé, RTT ou absence',
  },
  {
    label: 'Férié',
    color: 'text-amber-600',
    bgColor: 'bg-gradient-to-r from-amber-400 to-amber-300',
    icon: Sun,
    description: 'Jour férié national ou local',
  },
];

const ALERT_LEGEND: LegendItem[] = [
  {
    label: 'En retard',
    color: 'text-red-600',
    bgColor: 'bg-gradient-to-r from-red-500 to-red-400',
    icon: AlertTriangle,
    description: 'Tâche dépassant son échéance',
  },
  {
    label: 'Priorité haute',
    color: 'text-orange-600',
    bgColor: 'bg-gradient-to-r from-orange-500 to-orange-400',
    icon: Flag,
    description: 'Tâche prioritaire',
  },
];

interface GanttLegendProps {
  className?: string;
  compact?: boolean;
}

export function GanttLegend({ className, compact = false }: GanttLegendProps) {
  const renderLegendItem = (item: LegendItem, index: number) => (
    <Tooltip key={index}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
            "bg-card border border-keon-200 shadow-sm cursor-default",
            "hover:shadow-md transition-all hover:scale-105"
          )}
        >
          <div className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center",
            item.bgColor
          )}>
            <item.icon className="h-2.5 w-2.5 text-white" />
          </div>
          {!compact && (
            <span className={cn("text-[11px] font-medium", item.color)}>
              {item.label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p className="font-semibold">{item.label}</p>
        {item.description && (
          <p className="text-muted-foreground">{item.description}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 px-3 py-2",
      "bg-keon-50 rounded-xl border border-keon-100",
      className
    )}>
      {/* Tasks section */}
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        Tâches
      </span>
      {TASK_LEGEND.map(renderLegendItem)}
      
      <div className="w-px h-5 bg-keon-200 mx-2" />
      
      {/* Other types section */}
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        Absences
      </span>
      {OTHER_LEGEND.map(renderLegendItem)}
      
      <div className="w-px h-5 bg-keon-200 mx-2" />
      
      {/* Alerts section */}
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        Alertes
      </span>
      {ALERT_LEGEND.map(renderLegendItem)}
    </div>
  );
}

// Mini legend for compact display
export function GanttMiniLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Task dot */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400" />
        <span className="text-[10px] text-muted-foreground">Tâche</span>
      </div>
      
      {/* Leave dot */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" />
        <span className="text-[10px] text-muted-foreground">Congé</span>
      </div>
      
      {/* Holiday dot */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-300" />
        <span className="text-[10px] text-muted-foreground">Férié</span>
      </div>
      
      {/* Overdue dot */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-400 ring-2 ring-red-200" />
        <span className="text-[10px] text-muted-foreground">Retard</span>
      </div>
    </div>
  );
}
