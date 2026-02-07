import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BEProject } from '@/types/beProject';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Pencil, 
  Trash2, 
  Calendar,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BEProjectCardProps {
  project: BEProject;
  stats?: {
    totalTasks: number;
    overdueTasks: number;
    progress: number;
  };
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Actif', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  closed: { label: 'Clôturé', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  on_hold: { label: 'En attente', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

export function BEProjectCard({ 
  project, 
  stats,
  canEdit, 
  canDelete, 
  onEdit, 
  onDelete 
}: BEProjectCardProps) {
  const navigate = useNavigate();

  const milestones = useMemo(() => {
    return [
      { label: 'OS Étude', date: project.date_os_etude },
      { label: 'OS Travaux', date: project.date_os_travaux },
      { label: 'Clôture bancaire', date: project.date_cloture_bancaire },
      { label: 'Clôture juridique', date: project.date_cloture_juridique },
    ].filter(m => m.date);
  }, [project]);

  const status = statusConfig[project.status] || statusConfig.active;

  return (
    <Card 
      className="group cursor-pointer transition-all duration-200 hover:shadow-premium-lg hover:-translate-y-0.5 border-border/50"
      onClick={() => navigate(`/be/projects/${project.code_projet}/overview`)}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                {project.code_projet}
              </Badge>
              <Badge className={cn('border', status.className)}>
                {status.label}
              </Badge>
            </div>
            <h3 className="font-semibold text-foreground truncate text-base">
              {project.nom_projet}
            </h3>
            {(project.region || project.departement) && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {[project.departement, project.region].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div 
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(`/be/projects/${project.code_projet}/overview`)}
              title="Ouvrir le HUB"
            >
              <LayoutDashboard className="h-4 w-4" />
            </Button>
            {canEdit && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="p-1.5 rounded bg-blue-500/10">
                <TrendingUp className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">{stats.totalTasks}</p>
                <p className="text-[10px] text-muted-foreground">Tâches</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="p-1.5 rounded bg-emerald-500/10">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">{stats.progress}%</p>
                <p className="text-[10px] text-muted-foreground">Avancé</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className={cn(
                "p-1.5 rounded",
                stats.overdueTasks > 0 ? "bg-red-500/10" : "bg-slate-500/10"
              )}>
                <AlertTriangle className={cn(
                  "h-3 w-3",
                  stats.overdueTasks > 0 ? "text-red-600" : "text-slate-400"
                )} />
              </div>
              <div>
                <p className="text-sm font-semibold">{stats.overdueTasks}</p>
                <p className="text-[10px] text-muted-foreground">Retard</p>
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Jalons
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {milestones.slice(0, 4).map((m, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{m.label}</span>
                  <span className="font-medium">
                    {format(new Date(m.date!), 'dd/MM/yy')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
