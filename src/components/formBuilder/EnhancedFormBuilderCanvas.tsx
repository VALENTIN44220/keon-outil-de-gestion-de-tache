import { memo, useCallback, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Settings2,
  Layers,
  Eye,
  EyeOff,
  Copy,
  MoreVertical,
  Columns2,
  Columns3,
  LayoutGrid,
  Lock,
  Unlock,
} from 'lucide-react';
import type { FormSection, FormField, FieldTypeConfig } from '@/types/formBuilder';
import { FIELD_TYPE_LABELS, CustomFieldType } from '@/types/customField';
import { cn } from '@/lib/utils';

interface EnhancedFormBuilderCanvasProps {
  sections: FormSection[];
  fields: FormField[];
  selectedSectionId: string | null;
  selectedFieldId: string | null;
  previewMode: boolean;
  zoom: number;
  gridColumns: 1 | 2 | 3 | 4;
  onSelectSection: (id: string | null) => void;
  onSelectField: (id: string | null) => void;
  onAddSection: () => void;
  onDeleteSection: (id: string) => void;
  onUpdateSection: (id: string, updates: Partial<FormSection>) => void;
  onMoveField: (fieldId: string, targetSectionId: string | null, targetIndex: number) => void;
  onDeleteField: (fieldId: string) => void;
  onDuplicateField: (fieldId: string) => void;
  onSetGridColumns: (columns: 1 | 2 | 3 | 4) => void;
  onDropNewField?: (config: FieldTypeConfig, targetSectionId: string | null) => void;
  canManage: boolean;
}

// Field icons map
const FIELD_ICONS: Record<CustomFieldType, string> = {
  text: '📝',
  textarea: '📄',
  number: '#',
  date: '📅',
  datetime: '🕐',
  email: '✉️',
  phone: '📞',
  url: '🔗',
  checkbox: '☑️',
  select: '📋',
  multiselect: '📑',
  user_search: '👤',
  department_search: '🏢',
  file: '📎',
  table_lookup: '🗃️',
  repeatable_table: '📊',
};

export const EnhancedFormBuilderCanvas = memo(function EnhancedFormBuilderCanvas({
  sections,
  fields,
  selectedSectionId,
  selectedFieldId,
  previewMode,
  zoom,
  gridColumns,
  onSelectSection,
  onSelectField,
  onAddSection,
  onDeleteSection,
  onUpdateSection,
  onMoveField,
  onDeleteField,
  onDuplicateField,
  onSetGridColumns,
  onDropNewField,
  canManage,
}: EnhancedFormBuilderCanvasProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  // Toggle section collapse
  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Get fields not in any section
  const orphanFields = fields.filter((f) => !f.section_id);

  // Get fields for a specific section
  const getFieldsForSection = useCallback(
    (sectionId: string) => {
      return fields
        .filter((f) => f.section_id === sectionId)
        .sort((a, b) => a.order_index - b.order_index);
    },
    [fields]
  );

  // Group fields by row for grid layout
  const groupFieldsByRow = useCallback((fieldList: FormField[]) => {
    const rows: Map<number, FormField[]> = new Map();
    fieldList.forEach((field) => {
      const rowIndex = field.row_index ?? field.order_index;
      if (!rows.has(rowIndex)) {
        rows.set(rowIndex, []);
      }
      rows.get(rowIndex)!.push(field);
    });
    return Array.from(rows.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, rowFields]) =>
        rowFields.sort((a, b) => a.column_index - b.column_index)
      );
  }, []);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, fieldId: string) => {
    if (!canManage) return;
    setDraggedFieldId(fieldId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', fieldId);
  };

  const handleDragEnd = () => {
    setDraggedFieldId(null);
    setDropTargetSectionId(null);
    dragCounterRef.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, sectionId: string | null) => {
    if (!canManage) return;
    e.preventDefault();
    dragCounterRef.current++;
    setDropTargetSectionId(sectionId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDropTargetSectionId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Use 'copy' for palette drags, 'move' for existing field reorder
    e.dataTransfer.dropEffect = draggedFieldId ? 'move' : 'copy';
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string | null) => {
    e.preventDefault();
    if (!canManage) return;

    const fieldId = e.dataTransfer.getData('text/plain');
    if (fieldId && draggedFieldId) {
      const sectionFields = targetSectionId ? getFieldsForSection(targetSectionId) : orphanFields;
      onMoveField(fieldId, targetSectionId, sectionFields.length);
    }

    // Check for new field from palette
    if (!draggedFieldId) {
      try {
        const configData = e.dataTransfer.getData('application/json');
        if (configData && onDropNewField) {
          const config = JSON.parse(configData) as FieldTypeConfig;
          onDropNewField(config, targetSectionId);
        }
      } catch (err) {
        // Not valid JSON data
      }
    }

    setDraggedFieldId(null);
    setDropTargetSectionId(null);
    dragCounterRef.current = 0;
  };

  const renderFieldCard = useCallback(
    (field: FormField) => {
      const isSelected = selectedFieldId === field.id;
      const isDragging = draggedFieldId === field.id;

      return (
        <div
          key={field.id}
          draggable={canManage}
          onDragStart={(e) => handleDragStart(e, field.id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => {
            e.stopPropagation();
            onSelectField(field.id);
          }}
          className={cn(
            'group relative flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
            'hover:border-primary/50 hover:shadow-sm',
            isSelected
              ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
              : 'border-border bg-card',
            isDragging && 'opacity-50 scale-95',
            previewMode && 'pointer-events-none'
          )}
          style={{
            gridColumn: `span ${Math.min(field.column_span || 1, gridColumns)}`,
          }}
        >
          {/* Drag handle */}
          {canManage && !previewMode && (
            <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
          )}

          {/* Field content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{FIELD_ICONS[field.field_type] || '📝'}</span>
              <span className="font-medium text-sm truncate">{field.label}</span>
              {field.is_required && <span className="text-destructive text-xs">*</span>}
              {(field as any).is_readonly && (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
              {(field as any).is_hidden && (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {FIELD_TYPE_LABELS[field.field_type]}
              </Badge>
              {field.is_common && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">
                  Commun
                </Badge>
              )}
              {field.validation_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">
                  ✓ {field.validation_type}
                </Badge>
              )}
              {field.condition_field_id && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300">
                  ⚡ Condition
                </Badge>
              )}
            </div>
          </div>

          {/* Actions dropdown */}
          {canManage && !previewMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onDuplicateField(field.id)}>
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Dupliquer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteField(field.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      );
    },
    [selectedFieldId, draggedFieldId, previewMode, gridColumns, canManage, onSelectField, onDuplicateField, onDeleteField]
  );

  const renderSection = useCallback(
    (section: FormSection) => {
      const isSelected = selectedSectionId === section.id;
      const isCollapsed = collapsedSections.has(section.id);
      const sectionFields = getFieldsForSection(section.id);
      const fieldRows = groupFieldsByRow(sectionFields);
      const isDropTarget = dropTargetSectionId === section.id;

      return (
        <Card
          key={section.id}
          onDragEnter={(e) => handleDragEnter(e, section.id)}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, section.id)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSection(section.id);
          }}
          className={cn(
            'cursor-pointer transition-all border-2',
            isSelected
              ? 'border-primary shadow-lg ring-2 ring-primary/20'
              : 'border-border hover:border-primary/30',
            isDropTarget && 'border-dashed border-primary bg-primary/5'
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {canManage && !previewMode && (
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                )}
                {section.is_collapsible ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSectionCollapse(section.id);
                    }}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  <Layers className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-sm font-semibold">{section.label}</CardTitle>
                {section.is_common && (
                  <Badge variant="secondary" className="text-[10px]">
                    Commun
                  </Badge>
                )}
                {section.condition_field_id && (
                  <Badge variant="outline" className="text-[10px]">
                    Conditionnel
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {sectionFields.length} champ{sectionFields.length > 1 ? 's' : ''}
                </Badge>
              </div>

              {canManage && !previewMode && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateSection(section.id, { is_collapsible: !section.is_collapsible });
                    }}
                  >
                    {section.is_collapsible ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSection(section.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
            )}
          </CardHeader>

          {(!section.is_collapsible || !isCollapsed) && (
            <CardContent className="pt-2">
              {sectionFields.length === 0 ? (
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                    isDropTarget ? 'border-primary bg-primary/5' : 'border-muted'
                  )}
                >
                  <p className="text-sm text-muted-foreground">
                    {isDropTarget ? 'Déposez le champ ici' : 'Glissez des champs ici'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fieldRows.map((rowFields, rowIndex) => (
                    <div
                      key={rowIndex}
                      className={cn(
                        'grid gap-2',
                        gridColumns === 1 && 'grid-cols-1',
                        gridColumns === 2 && 'grid-cols-2',
                        gridColumns === 3 && 'grid-cols-3',
                        gridColumns === 4 && 'grid-cols-4'
                      )}
                    >
                      {rowFields.map(renderFieldCard)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      );
    },
    [
      selectedSectionId,
      collapsedSections,
      dropTargetSectionId,
      previewMode,
      gridColumns,
      canManage,
      getFieldsForSection,
      groupFieldsByRow,
      renderFieldCard,
      onSelectSection,
      onDeleteSection,
      onUpdateSection,
    ]
  );

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-muted/30"
      onClick={() => {
        onSelectSection(null);
        onSelectField(null);
      }}
    >
      {/* Canvas toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {sections.length} section(s), {fields.length} champ(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Grid columns selector */}
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={gridColumns === 1 ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onSetGridColumns(1)}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={gridColumns === 2 ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onSetGridColumns(2)}
            >
              <Columns2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={gridColumns === 3 ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => onSetGridColumns(3)}
            >
              <Columns3 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {canManage && (
            <Button onClick={onAddSection} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Section
            </Button>
          )}
        </div>
      </div>

      {/* Canvas content */}
      <ScrollArea className="flex-1">
        <div
          className="p-6"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Orphan fields */}
            {orphanFields.length > 0 && (
              <Card
                className={cn(
                  'border-dashed border-2',
                  dropTargetSectionId === null && draggedFieldId && 'border-primary bg-primary/5'
                )}
                onDragEnter={(e) => handleDragEnter(e, null)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Champs sans section
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      'grid gap-2',
                      gridColumns === 1 && 'grid-cols-1',
                      gridColumns === 2 && 'grid-cols-2',
                      gridColumns === 3 && 'grid-cols-3',
                      gridColumns === 4 && 'grid-cols-4'
                    )}
                  >
                    {orphanFields.map(renderFieldCard)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sections */}
            {sections
              .sort((a, b) => a.order_index - b.order_index)
              .map(renderSection)}

            {/* Empty state */}
            {sections.length === 0 && orphanFields.length === 0 && (
              <div
                className="border-2 border-dashed border-muted rounded-xl p-12 text-center"
                onDragEnter={(e) => handleDragEnter(e, null)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, null)}
              >
                <Layers className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  {dropTargetSectionId === null && !draggedFieldId ? 'Formulaire vide' : 'Déposez le champ ici'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cliquez sur un champ dans la bibliothèque ou glissez-le ici
                </p>
                {canManage && (
                  <Button onClick={onAddSection}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une section
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
});
