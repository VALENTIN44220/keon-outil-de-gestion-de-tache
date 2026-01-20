import { useMemo } from 'react';
import { BEProject } from '@/types/beProject';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export type GroupByField = 
  | 'status' 
  | 'pays_site' 
  | 'region'
  | 'departement'
  | 'code_divalto' 
  | 'siret' 
  | 'date_cloture_bancaire' 
  | 'date_cloture_juridique' 
  | 'date_os_etude' 
  | 'date_os_travaux' 
  | 'actionnariat' 
  | 'regime_icpe' 
  | 'typologie';

interface ProjectKanbanViewProps {
  projects: BEProject[];
  groupBy: GroupByField;
  onGroupByChange: (field: GroupByField) => void;
  onProjectClick?: (project: BEProject) => void;
  canEdit?: boolean;
}

const GROUP_BY_OPTIONS: { value: GroupByField; label: string }[] = [
  { value: 'status', label: 'Statut' },
  { value: 'pays_site', label: 'Pays site' },
  { value: 'region', label: 'Région' },
  { value: 'departement', label: 'Département' },
  { value: 'typologie', label: 'Typologie' },
  { value: 'actionnariat', label: 'Actionnariat' },
  { value: 'regime_icpe', label: 'Régime ICPE' },
  { value: 'code_divalto', label: 'Code Divalto' },
  { value: 'siret', label: 'SIRET' },
  { value: 'date_cloture_bancaire', label: 'Clôture bancaire' },
  { value: 'date_cloture_juridique', label: 'Clôture juridique' },
  { value: 'date_os_etude', label: 'OS Étude' },
  { value: 'date_os_travaux', label: 'OS Travaux' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 border-green-500/30 text-green-700',
  closed: 'bg-gray-500/10 border-gray-500/30 text-gray-700',
  on_hold: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  closed: 'Clôturé',
  on_hold: 'En attente',
};

const COLUMN_COLORS = [
  'border-l-blue-500',
  'border-l-green-500',
  'border-l-yellow-500',
  'border-l-purple-500',
  'border-l-pink-500',
  'border-l-orange-500',
  'border-l-cyan-500',
  'border-l-red-500',
];

function getColumnLabel(groupBy: GroupByField, value: string | null): string {
  if (value === null || value === '') return 'Non défini';
  
  if (groupBy === 'status') {
    return STATUS_LABELS[value] || value;
  }
  
  // Format dates
  if (['date_cloture_bancaire', 'date_cloture_juridique', 'date_os_etude', 'date_os_travaux'].includes(groupBy)) {
    try {
      return format(new Date(value), 'MMM yyyy', { locale: fr });
    } catch {
      return value;
    }
  }
  
  return value;
}

export function ProjectKanbanView({ 
  projects, 
  groupBy, 
  onGroupByChange, 
  onProjectClick,
  canEdit 
}: ProjectKanbanViewProps) {
  const groupedProjects = useMemo(() => {
    const groups: Record<string, BEProject[]> = {};
    
    projects.forEach(project => {
      const value = (project as any)[groupBy] || '';
      const key = String(value);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(project);
    });
    
    // Sort groups - put empty/null last
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b);
    });
    
    return sortedKeys.map(key => ({
      key,
      label: getColumnLabel(groupBy, key || null),
      projects: groups[key],
    }));
  }, [projects, groupBy]);

  const getStatusBadge = (status: string) => {
    const colorClass = STATUS_COLORS[status] || 'bg-muted text-muted-foreground';
    return (
      <Badge variant="outline" className={colorClass}>
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Group By Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Regrouper par :</span>
        <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupByField)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_BY_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
          {groupedProjects.map((group, index) => (
            <Card 
              key={group.key} 
              className={`w-[320px] flex-shrink-0 border-l-4 ${COLUMN_COLORS[index % COLUMN_COLORS.length]}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="truncate">{group.label}</span>
                  <Badge variant="secondary" className="ml-2">
                    {group.projects.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {group.projects.map(project => (
                  <Card 
                    key={project.id} 
                    className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${canEdit ? 'hover:border-primary/50' : ''}`}
                    onClick={() => onProjectClick?.(project)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {project.code_projet}
                        </span>
                        {getStatusBadge(project.status)}
                      </div>
                      <h4 className="font-medium text-sm line-clamp-2">
                        {project.nom_projet}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {project.pays_site || project.pays || 'Non défini'}
                        {(project as any).region && ` • ${(project as any).region}`}
                      </div>
                      {project.typologie && (
                        <Badge variant="outline" className="text-xs">
                          {project.typologie}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
                {group.projects.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Aucun projet
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {groupedProjects.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
              Aucun projet à afficher
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
