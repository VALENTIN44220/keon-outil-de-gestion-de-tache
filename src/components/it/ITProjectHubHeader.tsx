import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ITProject, IT_PROJECT_PRIORITY_CONFIG, IT_PROJECT_PILIER_CONFIG, ITProjectPilier, FDR_ETAT_CONFIG, type FdrEtat } from '@/types/itProject';
import { STATUT_PORTEFEUILLE_CONFIG, type StatutPortefeuille } from '@/types/fdr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, LayoutDashboard, ListTodo, Calendar, MessageSquare, Paperclip, RefreshCw, Pencil, ChevronRight, Monitor, AlertTriangle, TrendingUp, CheckCircle2, Clock, MessageSquareText, Link2, ExternalLink, Euro, Shield, BarChart3, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useITProjectSync } from '@/hooks/useITProjectSync';
import { useUserRole } from '@/hooks/useUserRole';
import { useITProjects } from '@/hooks/useITProjects';

interface ITProjectHubHeaderProps {
  project: ITProject;
  stats: { totalTasks: number; openTasks: number; doneTasks: number; overdueTasks: number; progress: number; budgetRatio: number | null };
}

type NavChild = { value: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { id: string; label: string; icon: typeof LayoutDashboard; children: NavChild[] };

const navGroups: NavGroup[] = [
  { id: 'synthese', label: 'Synthèse', icon: LayoutDashboard, children: [
    { value: 'overview', label: 'Synthèse', icon: LayoutDashboard },
  ] },
  { id: 'pilotage', label: 'Pilotage', icon: Shield, children: [
    { value: 'governance', label: 'Gouvernance & Phasage', icon: Shield },
    { value: 'timeline',   label: 'Planning',              icon: Calendar },
  ] },
  { id: 'travaux', label: 'Travaux', icon: ListTodo, children: [
    { value: 'tasks', label: 'Tâches & Demandes', icon: ListTodo },
  ] },
  { id: 'finance', label: 'Finance', icon: Euro, children: [
    { value: 'budget', label: 'Budget', icon: Euro },
    { value: 'roi',    label: 'ROI',    icon: BarChart3 },
  ] },
  { id: 'collaboration', label: 'Collaboration', icon: MessageSquare, children: [
    { value: 'sync',        label: 'Teams / Loop', icon: RefreshCw },
    { value: 'discussions', label: 'Discussions',  icon: MessageSquare },
    { value: 'files',       label: 'Fichiers',     icon: Paperclip },
  ] },
];

export function ITProjectHubHeader({ project, stats }: ITProjectHubHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTeams, openLoop, hasTeams, hasLoop } = useITProjectSync(project);
  const { isAdmin } = useUserRole();
  const { deleteProject } = useITProjects();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const activeTab = location.pathname.split('/').pop() || 'overview';
  const activeGroup = navGroups.find(g => g.children.some(c => c.value === activeTab)) ?? navGroups[0];
  const isEditing = activeTab === 'edit';
  const goTo = (value: string) => navigate(`/it/projects/${project.code_projet_digital}/${value}`);
  const handleDelete = async () => {
    setIsDeleting(true);
    const ok = await deleteProject(project.id);
    setIsDeleting(false);
    if (ok) { setDeleteOpen(false); navigate('/it/projects'); }
  };
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
              <Button
                size="sm"
                variant={isEditing ? 'default' : 'outline'}
                onClick={() => goTo('edit')}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
              {/* Suppression — admin only, masquée sur l'onglet édition (déjà une zone de danger) */}
              {isAdmin && !isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteOpen(true)}
                  className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              )}

              {/* KPI tâches retirés — l'avancement global est affiché dans la carte
                  « Synthèse d'avancement » de l'onglet Synthèse pour éviter le doublon. */}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6">
        {/* Niveau 1 : groupes thématiques */}
        <div className="flex gap-1 border-b -mb-px">
          {navGroups.map(group => {
            const Icon = group.icon;
            const isActive = !isEditing && group.id === activeGroup.id;
            return (
              <button
                key={group.id}
                onClick={() => goTo(group.children[0].value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-violet-600 text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {group.label}
              </button>
            );
          })}
        </div>

        {/* Niveau 2 : sous-onglets du groupe actif (si plusieurs) */}
        {!isEditing && activeGroup.children.length > 1 && (
          <div className="flex gap-1 pt-2 pb-1">
            {activeGroup.children.map(child => {
              const Icon = child.icon;
              const isActive = activeTab === child.value;
              return (
                <button
                  key={child.value}
                  onClick={() => goTo(child.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {child.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={open => { if (!isDeleting) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Supprimer le projet IT
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-1">
              <span className="block">
                Êtes-vous sûr de vouloir supprimer définitivement{' '}
                <span className="font-mono font-semibold text-foreground">{project.code_projet_digital}</span>
                {' '}— <span className="font-medium text-foreground">{project.nom_projet}</span> ?
              </span>
              <span className="block text-xs text-destructive/80 font-medium">
                Cette action est irréversible (jalons et tâches liées inclus).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={e => { e.preventDefault(); void handleDelete(); }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
