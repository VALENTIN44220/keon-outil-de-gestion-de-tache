import { memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from 'lucide-react';
import type { FormSection, FormField } from '@/types/formBuilder';
import { FIELD_TYPE_LABELS, CustomFieldType } from '@/types/customField';
import { cn } from '@/lib/utils';

interface FormBuilderCanvasProps {
  sections: FormSection[];
  fields: FormField[];
  selectedSectionId: string | null;
  selectedFieldId: string | null;
  previewMode: boolean;
  zoom: number;
  onSelectSection: (id: string | null) => void;
  onSelectField: (id: string | null) => void;
  onAddSection: () => void;
  onDeleteSection: (id: string) => void;
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
};

export const FormBuilderCanvas = memo(function FormBuilderCanvas({
  sections,
  fields,
  selectedSectionId,
  selectedFieldId,
  previewMode,
  zoom,
  onSelectSection,
  onSelectField,
  onAddSection,
  onDeleteSection,
}: FormBuilderCanvasProps) {
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

  // Group fields by row
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

  const renderFieldCard = useCallback(
    (field: FormField) => {
      const isSelected = selectedFieldId === field.id;

      return (
        <div
          key={field.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectField(field.id);
          }}
          className={cn(
            'group relative flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
            'hover:border-primary/50 hover:shadow-sm',
            isSelected
              ? 'border-primary bg-primary/5 shadow-md'
              : 'border-border bg-card',
            field.column_span === 2 && 'col-span-2',
            field.column_span === 3 && 'col-span-3',
            field.column_span === 4 && 'col-span-4'
          )}
          style={{
            gridColumn: `span ${Math.min(field.column_span || 1, 4)}`,
          }}
        >
          {/* Drag handle */}
          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Field content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">
                {FIELD_ICONS[field.field_type] || '📝'}
              </span>
              <span className="font-medium text-sm truncate">
                {field.label}
              </span>
              {field.is_required && (
                <span className="text-destructive text-xs">*</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px] px-1.5">
                {FIELD_TYPE_LABELS[field.field_type]}
              </Badge>
              {field.validation_type && (
                <Badge variant="outline" className="text-[10px] px-1.5">
                  ✓ Validation
                </Badge>
              )}
              {field.condition_field_id && (
                <Badge variant="outline" className="text-[10px] px-1.5">
                  ⚡ Conditionnel
                </Badge>
              )}
            </div>
            {field.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {field.description}
              </p>
            )}
          </div>
        </div>
      );
    },
    [selectedFieldId, onSelectField]
  );

  const renderSection = useCallback(
    (section: FormSection) => {
      const isSelected = selectedSectionId === section.id;
      const sectionFields = getFieldsForSection(section.id);
      const fieldRows = groupFieldsByRow(sectionFields);

      return (
        <Card
          key={section.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectSection(section.id);
          }}
          className={cn(
            'cursor-pointer transition-all border-2',
            isSelected
              ? 'border-primary shadow-lg ring-2 ring-primary/20'
              : 'border-border hover:border-primary/30'
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                {section.is_collapsible ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Layers className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-sm font-semibold">
                  {section.label}
                </CardTitle>
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
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {section.description}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-2">
            {sectionFields.length === 0 ? (
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Glissez des champs ici
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {fieldRows.map((rowFields, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="grid grid-cols-4 gap-2"
                  >
                    {rowFields.map(renderFieldCard)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    },
    [
      selectedSectionId,
      getFieldsForSection,
      groupFieldsByRow,
      renderFieldCard,
      onSelectSection,
      onDeleteSection,
    ]
  );

  return (
    <div
      className="flex-1 p-6 overflow-auto bg-muted/30"
      onClick={() => {
        onSelectSection(null);
        onSelectField(null);
      }}
      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Formulaire</h2>
            <p className="text-sm text-muted-foreground">
              {sections.length} section(s), {fields.length} champ(s)
            </p>
          </div>
          <Button onClick={onAddSection} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une section
          </Button>
        </div>

        {/* Orphan fields (not in any section) */}
        {orphanFields.length > 0 && (
          <Card className="border-dashed border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Champs sans section
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
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
          <div className="border-2 border-dashed border-muted rounded-xl p-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Formulaire vide
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez une section pour commencer à organiser vos champs
            </p>
            <Button onClick={onAddSection}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une section
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
