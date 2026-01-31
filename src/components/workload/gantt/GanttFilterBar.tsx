import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Filter,
  AlertTriangle,
  X,
  ZoomIn,
  ZoomOut,
  Rows3,
  ChevronDown,
  LayoutGrid,
  CheckCircle2,
  Clock,
  PlayCircle,
  ClipboardList,
} from 'lucide-react';

export type ZoomLevel = 'day' | 'week' | 'month';
export type DensityMode = 'compact' | 'comfort';

interface GanttFilterBarProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Statuses
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  // Priorities
  selectedPriorities: string[];
  onPrioritiesChange: (priorities: string[]) => void;
  // Overload filter
  showOnlyOverloaded: boolean;
  onShowOnlyOverloadedChange: (value: boolean) => void;
  // Zoom
  zoomLevel: ZoomLevel;
  onZoomChange: (level: ZoomLevel) => void;
  // Density
  densityMode: DensityMode;
  onDensityChange: (mode: DensityMode) => void;
  // Stats
  totalMembers?: number;
  overloadedCount?: number;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'À faire', icon: ClipboardList, color: 'text-slate-600' },
  { value: 'in-progress', label: 'En cours', icon: PlayCircle, color: 'text-blue-600' },
  { value: 'done', label: 'Terminée', icon: CheckCircle2, color: 'text-emerald-600' },
  { value: 'pending-validation', label: 'En validation', icon: Clock, color: 'text-violet-600' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
  { value: 'high', label: 'Haute', color: 'bg-orange-500' },
  { value: 'medium', label: 'Moyenne', color: 'bg-blue-500' },
  { value: 'low', label: 'Basse', color: 'bg-emerald-500' },
];

export function GanttFilterBar({
  searchQuery,
  onSearchChange,
  selectedStatuses,
  onStatusesChange,
  selectedPriorities,
  onPrioritiesChange,
  showOnlyOverloaded,
  onShowOnlyOverloadedChange,
  zoomLevel,
  onZoomChange,
  densityMode,
  onDensityChange,
  totalMembers = 0,
  overloadedCount = 0,
  className,
}: GanttFilterBarProps) {
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedStatuses.length > 0) count++;
    if (selectedPriorities.length > 0) count++;
    if (showOnlyOverloaded) count++;
    return count;
  }, [selectedStatuses, selectedPriorities, showOnlyOverloaded]);

  const handleClearFilters = useCallback(() => {
    onSearchChange('');
    onStatusesChange([]);
    onPrioritiesChange([]);
    onShowOnlyOverloadedChange(false);
  }, [onSearchChange, onStatusesChange, onPrioritiesChange, onShowOnlyOverloadedChange]);

  const handleStatusToggle = useCallback((status: string) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];
    onStatusesChange(newStatuses);
  }, [selectedStatuses, onStatusesChange]);

  const handlePriorityToggle = useCallback((priority: string) => {
    const newPriorities = selectedPriorities.includes(priority)
      ? selectedPriorities.filter(p => p !== priority)
      : [...selectedPriorities, priority];
    onPrioritiesChange(newPriorities);
  }, [selectedPriorities, onPrioritiesChange]);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm",
        className
      )}
      role="toolbar"
      aria-label="Filtres et contrôles du Gantt"
    >
      {/* Search Input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher tâches, collaborateurs..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm bg-background/50 focus-visible:ring-primary"
          aria-label="Recherche"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => onSearchChange('')}
            aria-label="Effacer la recherche"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-1.5"
            aria-label={`Filtrer par statut${selectedStatuses.length > 0 ? ` (${selectedStatuses.length} actif)` : ''}`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Statut</span>
            {selectedStatuses.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {selectedStatuses.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Filtrer par statut
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((status) => (
            <DropdownMenuCheckboxItem
              key={status.value}
              checked={selectedStatuses.includes(status.value)}
              onCheckedChange={() => handleStatusToggle(status.value)}
              className="gap-2"
            >
              <status.icon className={cn("h-4 w-4", status.color)} />
              {status.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-1.5"
            aria-label={`Filtrer par priorité${selectedPriorities.length > 0 ? ` (${selectedPriorities.length} actif)` : ''}`}
          >
            <span className="hidden sm:inline">Priorité</span>
            {selectedPriorities.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {selectedPriorities.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Filtrer par priorité
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITY_OPTIONS.map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority.value}
              checked={selectedPriorities.includes(priority.value)}
              onCheckedChange={() => handlePriorityToggle(priority.value)}
              className="gap-2"
            >
              <div className={cn("w-2.5 h-2.5 rounded-full", priority.color)} />
              {priority.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overload Filter */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showOnlyOverloaded ? "destructive" : "outline"}
            size="sm"
            className={cn(
              "h-9 gap-1.5 transition-all",
              showOnlyOverloaded && "animate-pulse"
            )}
            onClick={() => onShowOnlyOverloadedChange(!showOnlyOverloaded)}
            aria-pressed={showOnlyOverloaded}
            aria-label="Afficher uniquement les collaborateurs surchargés"
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Surcharge</span>
            {overloadedCount > 0 && (
              <Badge 
                variant={showOnlyOverloaded ? "outline" : "destructive"} 
                className="ml-1 h-5 px-1.5 text-[10px]"
              >
                {overloadedCount}
              </Badge>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {showOnlyOverloaded 
              ? 'Afficher tous les collaborateurs' 
              : 'Afficher uniquement les collaborateurs en surcharge'}
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-px h-6 bg-border" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={zoomLevel === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => onZoomChange('month')}
              aria-label="Zoom arrière (vue mois)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Vue mensuelle</TooltipContent>
        </Tooltip>
        
        <Button
          variant={zoomLevel === 'week' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-3 text-xs font-medium"
          onClick={() => onZoomChange('week')}
          aria-label="Zoom semaine"
        >
          Semaine
        </Button>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={zoomLevel === 'day' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => onZoomChange('day')}
              aria-label="Zoom avant (vue jour)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Vue journalière</TooltipContent>
        </Tooltip>
      </div>

      {/* Density Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => onDensityChange(densityMode === 'compact' ? 'comfort' : 'compact')}
            aria-label={densityMode === 'compact' ? 'Affichage confortable' : 'Affichage compact'}
          >
            {densityMode === 'compact' ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <Rows3 className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {densityMode === 'compact' ? 'Affichage confortable' : 'Affichage compact'}
        </TooltipContent>
      </Tooltip>

      {/* Clear All Filters */}
      {(activeFiltersCount > 0 || searchQuery) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleClearFilters}
          aria-label="Effacer tous les filtres"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Effacer</span>
        </Button>
      )}

      {/* Stats */}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span>{totalMembers} collaborateur{totalMembers > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
