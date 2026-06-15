import { useNavigate, useLocation } from 'react-router-dom';
import { ITProject, IT_PROJECT_PRIORITY_CONFIG, IT_PROJECT_PILIER_CONFIG, ITProjectPilier, FDR_ETAT_CONFIG, type FdrEtat } from '@/types/itProject';
import { STATUT_PORTEFEUILLE_CONFIG, type StatutPortefeuille } from '@/types/fdr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, LayoutDashboard, ListTodo, Calendar, MessageSquare, Paperclip, RefreshCw, Pencil, ChevronRight, Monitor, AlertTriangle, TrendingUp, CheckCircle2, Clock, MessageSquareText, Link2, ExternalLink, Euro, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useITProjectSync } from '@/hooks/useITProjectSync';

interface ITProjectHubHeaderProps {
  project: ITProject;
  stats: { totalTasks: number; openTasks: number; doneTasks: number; overdueTasks: number; progress: number; budgetRatio: number | null };
  onEditProject?: () => void;
}

const navItems = [
  { value: 'overview',    label: 'Synthèse',                 icon: LayoutDashboard },
  { value: 'governance',  label: 'Gouvernance & Phasage',    icon: Shield },
  { value: 'tasks',       label: 'Tâches & Demandes',        icon: ListTodo },
  { value: 'timeline',    label: 'Planning',                 icon: Calendar },
  { value: 'sync',        label: 'Teams / Loop',             icon: RefreshCw },
  { value: 'discussions', label: 'Discussions',              icon: MessageSquare },
  { value: 'files',       label: 'Fichiers',                 icon: Paperclip },
  { value: 'budget',      label: 'Budget',                   icon: Euro },
];

export function ITProjectHubHeader({ project, stats, onEditProject }: ITProjectHubHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTeams, openLoop, hasTeams, hasLoop } = useITProjectSync(project);
  const activeTab = location.pathname.split('/').pop() || 'overview';
  const statusConfig = STATUT_PORTEFEUILLE_CONFIG[(project.statut_portefeuille as StatutPortefeuille) ?? 'Idée'] || STATUT_PORTEFEUILLE_CONFIG['Idée'];
  const priorityConfig = project.priorite ? IT_PROJECT_PRIORITY_CONFIG[project.priorite] : null;
  const pilierConfig = project.pilier ? IT_PROJECT_PILIER_CONFIG[project.pilier as ITProjectPilier] : null;
  const fdrEtatCfg = project.fdr_annee ? FDR_ETAT_CONFIG[(project.fdr_etat as FdrEtat) || 'non_soumis'] : null;

  return (
    <div className="space-y-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-6 pt-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate('/it/projects')} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Projets IT
          </button>
          <ChevronRight className="h-4 w-4" />
          <span>{project.code_projet_digital}</span>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{project.nom_projet}</h1>
                <Badge className={cn(statusConfig.className, 'border')}>
                  {statusConfig.label}
                </Badge>
                {priorityConfig && (
                  <Badge variant="outline" className={cn(priorityConfig.className, 'border')}>
                    {priorityConfig.label}
                  </Badge>
                )}
                {pilierConfig && (
                  <Badge className={cn(pilierConfig.className, 'border')}>
                    {project.pilier} — {pilierConfig.label}
                  </Badge>
                )}
                {fdrEtatCfg && (
                  <Badge className={cn(fdrEtatCfg.className, 'border')}>
                    FDR {project.fdr_annee} · {fdrEtatCfg.label}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {project.code_projet_digital}
                {project.phase_courante && ` · ${project.phase_courante}`}
                {project.company && ` · 🏢 ${project.company.name}`}
                {project.groupe_service && ` · 🏬 ${project.groupe_service.name}`}
                {project.directeur && ` · 👔 ${project.directeur.display_name}`}
                {project.chef_projet_metier && ` · 👤 ${project.chef_projet_metier.display_name}`}
                {project.chef_projet_it && ` · 💻 ${project.chef_projet_it.display_name}`}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              {hasTeams && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={openTeams} className="gap-2">
                      <Monitor className="h-4 w-4" /> Teams
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ouvrir le canal Teams</TooltipContent>
                </Tooltip>
              )}
              {hasLoop && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={openLoop} className="gap-2">
                      <Link2 className="h-4 w-4" /> Loop
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ouvrir Loop</TooltipContent>
                </Tooltip>
              )}
              {onEditProject && (
                <Button size="sm" variant="outline" onClick={onEditProject} className="gap-2">
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
              )}

              {/* KPI tâches retirés — l'avancement global est affiché dans la carte
                  « Synthèse d'avancement » de l'onglet Synthèse pour éviter le doublon. */}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="flex gap-1 border-b -mb-px">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => navigate(`/it/projects/${project.code_projet_digital}/${item.value}`)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-violet-600 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
