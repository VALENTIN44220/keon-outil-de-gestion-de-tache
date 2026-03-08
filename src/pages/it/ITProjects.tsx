import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useITProjects } from '@/hooks/useITProjects';
import { ITProject, IT_PROJECT_STATUS_CONFIG, IT_PROJECT_TYPE_CONFIG, IT_PROJECT_PRIORITY_CONFIG } from '@/types/itProject';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, Monitor, Calendar, Users, TrendingUp, ArrowRight, MessageSquareText, Link2, LayoutGrid, List, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ITProjectFormDialog } from '@/components/it/ITProjectFormDialog';

export default function ITProjects() {
  const navigate = useNavigate();
  const { projects, isLoading, searchQuery, setSearchQuery } = useITProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = projects.filter(p => statusFilter === 'all' || p.statut === statusFilter);
  const stats = {
    total: projects.length,
    en_cours: projects.filter(p => p.statut === 'en_cours').length,
    recette: projects.filter(p => p.statut === 'recette').length,
    deploye: projects.filter(p => p.statut === 'deploye').length,
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="px-6 pt-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                  <Monitor className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Projets IT</h1>
              </div>
              <p className="text-sm text-muted-foreground ml-[52px]">
                Suivi des projets digitaux — Code Projet Digital NSK_IT-XXXXX
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/it/projects/import-fdr')} className="gap-2">
                <Download className="h-4 w-4" /> Importer depuis FDR
              </Button>
              <Button onClick={() => setShowCreate(true)} className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25">
                <Plus className="h-4 w-4" /> Nouveau projet IT
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-foreground' },
              { label: 'En cours', value: stats.en_cours, color: 'text-blue-600' },
              { label: 'Recette', value: stats.recette, color: 'text-amber-600' },
              { label: 'Déployés', value: stats.deploye, color: 'text-emerald-600' },
            ].map(k => (
              <div key={k.label} className="text-center p-3 rounded-xl border bg-card">
                <p className={cn('text-2xl font-bold', k.color)}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-1">
              {[
                { v: 'all', l: 'Tous' },
                { v: 'en_cours', l: 'En cours' },
                { v: 'recette', l: 'Recette' },
                { v: 'deploye', l: 'Déployé' },
                { v: 'backlog', l: 'Backlog' },
              ].map(f => (
                <Badge
                  key={f.v}
                  variant={statusFilter === f.v ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter(f.v)}
                >
                  {f.l}
                </Badge>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Monitor className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Aucun projet IT trouvé</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" /> Créer un projet IT
              </Button>
            </div>
          ) : (
            <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2')}>
              {filtered.map(p => (
                <ITProjectCard
                  key={p.id}
                  project={p}
                  compact={viewMode === 'list'}
                  onClick={() => navigate(`/it/projects/${p.code_projet_digital}/overview`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ITProjectFormDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </Layout>
  );
}

function ITProjectCard({ project, compact, onClick }: { project: ITProject; compact?: boolean; onClick: () => void }) {
  const statusConfig = IT_PROJECT_STATUS_CONFIG[project.statut] || IT_PROJECT_STATUS_CONFIG.backlog;
  const typeConfig = project.type_projet ? IT_PROJECT_TYPE_CONFIG[project.type_projet] : null;
  const priorityConfig = project.priorite ? IT_PROJECT_PRIORITY_CONFIG[project.priorite] : null;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-4 p-3 rounded-xl border bg-card hover:shadow-md transition-all cursor-pointer"
      >
        <div className="p-2 rounded-lg bg-violet-100 text-lg">
          {typeConfig?.icon || '💻'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{project.code_projet_digital}</span>
            <Badge className={cn(statusConfig.className, 'border text-[10px]')}>{statusConfig.label}</Badge>
          </div>
          <p className="text-sm font-medium truncate">{project.nom_projet}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold">{project.progress || 0}%</p>
          <p className="text-[10px] text-muted-foreground">Avancement</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card onClick={onClick} className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-violet-600 to-indigo-600" />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-100 text-xl">
              {typeConfig?.icon || '💻'}
            </div>
            <div>
              <span className="text-xs font-mono text-muted-foreground">{project.code_projet_digital}</span>
              <div className="flex gap-1.5 mt-1">
                <Badge className={cn(statusConfig.className, 'border text-[10px]')}>{statusConfig.label}</Badge>
                {priorityConfig && <Badge variant="outline" className={cn(priorityConfig.className, 'border text-[10px]')}>{priorityConfig.label}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {project.teams_channel_url && <MessageSquareText className="h-3.5 w-3.5 text-blue-500" />}
            {project.loop_workspace_url && <Link2 className="h-3.5 w-3.5 text-violet-500" />}
          </div>
        </div>

        <h3 className="font-semibold text-sm group-hover:text-violet-700 transition-colors">{project.nom_projet}</h3>

        {project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Avancement</span>
            <span className="font-bold">{project.progress || 0}%</span>
          </div>
          <Progress value={project.progress || 0} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {project.date_fin_prevue
              ? format(new Date(project.date_fin_prevue), 'dd MMM yyyy', { locale: fr })
              : '—'}
          </div>
          {project.responsable_it && (
            <span className="truncate max-w-[120px]">{project.responsable_it.display_name}</span>
          )}
          <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}
