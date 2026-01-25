import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GripVertical, Save, Settings2, Filter, X, Eye, EyeOff, LayoutList, User } from 'lucide-react';
import { ALL_PROJECT_COLUMNS, ColumnDefinition } from './ProjectColumnSelector';
import { ProjectViewConfig, ColumnFilter } from '@/hooks/useProjectViewConfig';

interface ProjectViewConfigPanelProps {
  config: ProjectViewConfig;
  isAdmin: boolean;
  onSaveStandard: (config: Partial<ProjectViewConfig>) => Promise<boolean>;
  onSaveCustom: (config: Partial<ProjectViewConfig>) => Promise<boolean>;
  activeViewType: 'standard' | 'custom';
  onSwitchView: (viewType: 'standard' | 'custom') => void;
}

export function ProjectViewConfigPanel({
  config,
  isAdmin,
  onSaveStandard,
  onSaveCustom,
  activeViewType,
  onSwitchView,
}: ProjectViewConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<'standard' | 'custom'>(activeViewType);
  const [localVisibleColumns, setLocalVisibleColumns] = useState<string[]>(config.visible_columns);
  const [localColumnOrder, setLocalColumnOrder] = useState<string[]>(config.column_order);
  const [localFilters, setLocalFilters] = useState<Record<string, ColumnFilter>>(config.column_filters);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Sync local state with config when config changes
  useEffect(() => {
    setLocalVisibleColumns(config.visible_columns);
    setLocalColumnOrder(config.column_order.length > 0 ? config.column_order : ALL_PROJECT_COLUMNS.map(c => c.key));
    setLocalFilters(config.column_filters);
  }, [config]);

  const handleToggleColumn = (columnKey: string) => {
    if (['code_projet', 'nom_projet'].includes(columnKey)) return;
    
    setLocalVisibleColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(c => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnKey);
    setDraggedColumn(columnKey);
  };

  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedColumn || draggedColumn === targetKey) return;

    setLocalColumnOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedColumn);
      const targetIndex = newOrder.indexOf(targetKey);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedColumn);
      return newOrder;
    });
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  const handleFilterChange = (columnKey: string, filter: ColumnFilter | null) => {
    setLocalFilters(prev => {
      if (!filter) {
        const newFilters = { ...prev };
        delete newFilters[columnKey];
        return newFilters;
      }
      return { ...prev, [columnKey]: filter };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const configToSave = {
      visible_columns: localVisibleColumns,
      column_order: localColumnOrder,
      column_filters: localFilters,
    };

    let success = false;
    if (editingTab === 'standard') {
      success = await onSaveStandard(configToSave);
    } else {
      success = await onSaveCustom(configToSave);
    }

    setIsSaving(false);
    if (success) {
      setIsOpen(false);
    }
  };

  const getActiveFiltersCount = () => Object.keys(localFilters).length;

  const orderedColumns = localColumnOrder
    .map(key => ALL_PROJECT_COLUMNS.find(c => c.key === key))
    .filter(Boolean) as ColumnDefinition[];

  return (
    <div className="flex items-center gap-2">
      {/* View Toggle Buttons */}
      <div className="flex items-center rounded-sm border border-keon-300 overflow-hidden">
        <Button
          variant={activeViewType === 'standard' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none gap-1.5 px-3"
          onClick={() => onSwitchView('standard')}
        >
          <LayoutList className="h-4 w-4" />
          Vue standard
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant={activeViewType === 'custom' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none gap-1.5 px-3"
          onClick={() => onSwitchView('custom')}
        >
          <User className="h-4 w-4" />
          Vue personnalisée
        </Button>
      </div>

      {/* Config Panel Trigger */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configurer
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-1">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[450px] sm:w-[540px] bg-background">
          <SheetHeader>
            <SheetTitle className="font-display uppercase tracking-wide">
              Configuration des vues
            </SheetTitle>
            <SheetDescription>
              Personnalisez les colonnes visibles, leur ordre et les filtres.
            </SheetDescription>
          </SheetHeader>

          <Tabs value={editingTab} onValueChange={(v) => setEditingTab(v as 'standard' | 'custom')} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="standard" className="flex-1 gap-1.5" disabled={!isAdmin}>
                <LayoutList className="h-4 w-4" />
                Standard {!isAdmin && '(lecture seule)'}
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 gap-1.5">
                <User className="h-4 w-4" />
                Personnalisée
              </TabsTrigger>
            </TabsList>

            <TabsContent value="standard" className="mt-4 space-y-4">
              <ColumnConfigContent
                  columns={orderedColumns}
                  visibleColumns={localVisibleColumns}
                  filters={localFilters}
                  onToggleColumn={handleToggleColumn}
                  onFilterChange={handleFilterChange}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  draggedColumn={draggedColumn}
                  disabled={!isAdmin}
              />
            </TabsContent>

            <TabsContent value="custom" className="mt-4 space-y-4">
              <ColumnConfigContent
                  columns={orderedColumns}
                  visibleColumns={localVisibleColumns}
                  filters={localFilters}
                  onToggleColumn={handleToggleColumn}
                  onFilterChange={handleFilterChange}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  draggedColumn={draggedColumn}
                  disabled={false}
              />
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-6">
            <Button
              onClick={handleSave}
              disabled={isSaving || (editingTab === 'standard' && !isAdmin)}
              className="w-full gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface ColumnConfigContentProps {
  columns: ColumnDefinition[];
  visibleColumns: string[];
  filters: Record<string, ColumnFilter>;
  onToggleColumn: (key: string) => void;
  onFilterChange: (key: string, filter: ColumnFilter | null) => void;
  onDragStart: (e: React.DragEvent, columnKey: string) => void;
  onDragOver: (e: React.DragEvent, key: string) => void;
  onDragEnd: () => void;
  draggedColumn: string | null;
  disabled: boolean;
}

const ColumnConfigContent = ({
  columns,
  visibleColumns,
  filters,
  onToggleColumn,
  onFilterChange,
  onDragStart,
  onDragOver,
  onDragEnd,
  draggedColumn,
  disabled,
}: ColumnConfigContentProps) => {
  const [expandedFilter, setExpandedFilter] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">
          {disabled ? 'Configuration en lecture seule' : 'Glissez pour réordonner, cochez pour afficher'}
        </Label>
        <Badge variant="outline">{visibleColumns.length} colonnes</Badge>
      </div>
      
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-1">
          {columns.map((column) => {
            const isVisible = visibleColumns.includes(column.key);
            const isRequired = ['code_projet', 'nom_projet'].includes(column.key);
            const hasFilter = !!filters[column.key]?.value;
            const isDragging = draggedColumn === column.key;

            return (
              <div
                key={column.key}
                draggable={!disabled}
                onDragStart={(e) => {
                  e.stopPropagation();
                  if (!disabled) {
                    onDragStart(e, column.key);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedColumn && draggedColumn !== column.key) {
                    onDragOver(e, column.key);
                  }
                }}
                onDragEnd={onDragEnd}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDragEnd();
                }}
                className={`
                  p-2 rounded-sm border border-keon-200 bg-background transition-all
                  ${isDragging ? 'opacity-50 border-keon-blue ring-2 ring-keon-blue/30' : ''}
                  ${disabled ? 'opacity-70 cursor-default' : 'cursor-grab active:cursor-grabbing hover:border-keon-400'}
                `}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex-shrink-0 ${disabled ? 'invisible' : ''}`}>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <div 
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={() => {
                        if (!disabled && !isRequired) {
                          onToggleColumn(column.key);
                        }
                      }}
                      disabled={disabled || isRequired}
                    />
                  </div>
                  
                  <div 
                    className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled && !isRequired) {
                        onToggleColumn(column.key);
                      }
                    }}
                  >
                    {isVisible ? (
                      <Eye className="h-3.5 w-3.5 text-keon-500 flex-shrink-0" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {column.label}
                    </span>
                    {isRequired && (
                      <Badge variant="outline" className="text-xs flex-shrink-0">Requis</Badge>
                    )}
                  </div>
                  
                  <Button
                    type="button"
                    variant={hasFilter ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setExpandedFilter(expandedFilter === column.key ? null : column.key);
                    }}
                    disabled={disabled}
                  >
                    <Filter className={`h-3.5 w-3.5 ${hasFilter ? 'text-keon-blue' : ''}`} />
                  </Button>
                </div>

                {expandedFilter === column.key && (
                  <div className="mt-2 pt-2 border-t border-keon-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={filters[column.key]?.operator || 'contains'}
                        onValueChange={(op) => onFilterChange(column.key, {
                          operator: op as ColumnFilter['operator'],
                          value: filters[column.key]?.value || '',
                        })}
                        disabled={disabled}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          <SelectItem value="contains">Contient</SelectItem>
                          <SelectItem value="equals">Égal à</SelectItem>
                          <SelectItem value="startsWith">Commence par</SelectItem>
                          <SelectItem value="endsWith">Finit par</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Valeur..."
                        value={filters[column.key]?.value || ''}
                        onChange={(e) => onFilterChange(column.key, {
                          operator: filters[column.key]?.operator || 'contains',
                          value: e.target.value,
                        })}
                        className="h-8 flex-1"
                        disabled={disabled}
                      />
                      {hasFilter && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={() => onFilterChange(column.key, null)}
                          disabled={disabled}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
