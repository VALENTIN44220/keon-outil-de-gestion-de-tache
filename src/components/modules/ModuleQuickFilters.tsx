/**
 * ModuleQuickFilters — bandeau de filtres rapides reutilisable pour les
 * modules Logistique, Maintenance, IT, etc.
 *
 * Toggles :
 *  - Masquer terminees (par defaut ON)
 *  - Mes demandes (assigne OU demandeur = moi)
 *
 * + boutons selecteurs de vue : Tableau / Kanban / Calendrier.
 */
import { Button } from '@/components/ui/button';
import {
  TableProperties,
  Columns,
  Calendar as CalendarIcon,
  EyeOff,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModuleViewMode = 'table' | 'kanban' | 'calendar';

interface ModuleQuickFiltersProps {
  viewMode: ModuleViewMode;
  onViewModeChange: (mode: ModuleViewMode) => void;
  hideTerminated: boolean;
  onHideTerminatedChange: (v: boolean) => void;
  onlyMine: boolean;
  onOnlyMineChange: (v: boolean) => void;
  className?: string;
}

export function ModuleQuickFilters({
  viewMode,
  onViewModeChange,
  hideTerminated,
  onHideTerminatedChange,
  onlyMine,
  onOnlyMineChange,
  className,
}: ModuleQuickFiltersProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <Button
        variant={viewMode === 'table' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewModeChange('table')}
      >
        <TableProperties className="h-4 w-4 mr-1" /> Tableau
      </Button>
      <Button
        variant={viewMode === 'kanban' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewModeChange('kanban')}
      >
        <Columns className="h-4 w-4 mr-1" /> Kanban
      </Button>
      <Button
        variant={viewMode === 'calendar' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewModeChange('calendar')}
      >
        <CalendarIcon className="h-4 w-4 mr-1" /> Calendrier
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        variant={hideTerminated ? 'default' : 'outline'}
        size="sm"
        onClick={() => onHideTerminatedChange(!hideTerminated)}
        title="Masquer les demandes terminées"
      >
        <EyeOff className="h-4 w-4 mr-1" /> Masquer terminées
      </Button>
      <Button
        variant={onlyMine ? 'default' : 'outline'}
        size="sm"
        onClick={() => onOnlyMineChange(!onlyMine)}
        title="Mes demandes (assigné ou demandeur)"
      >
        <Star className="h-4 w-4 mr-1" /> Mes demandes
      </Button>
    </div>
  );
}
