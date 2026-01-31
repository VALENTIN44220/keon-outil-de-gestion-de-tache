import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  Mail,
  Phone,
  Link,
  CheckSquare,
  ChevronDown,
  ListChecks,
  UserSearch,
  Building2,
  Paperclip,
  Database,
} from 'lucide-react';
import { FIELD_TYPE_CONFIGS, type FieldTypeConfig } from '@/types/formBuilder';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const ICON_MAP: Record<string, React.ElementType> = {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  Mail,
  Phone,
  Link,
  CheckSquare,
  ChevronDown,
  ListChecks,
  UserSearch,
  Building2,
  Paperclip,
  Database,
};

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Champs de base',
  advanced: 'Champs avancés',
  lookup: 'Recherche / Liaison',
  special: 'Champs spéciaux',
};

const CATEGORY_ORDER = ['basic', 'advanced', 'lookup', 'special'];

interface FormBuilderPaletteProps {
  onAddField: (config: FieldTypeConfig) => void;
}

export const FormBuilderPalette = memo(function FormBuilderPalette({
  onAddField,
}: FormBuilderPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter fields by search
  const filteredFields = FIELD_TYPE_CONFIGS.filter(
    (config) =>
      config.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by category
  const groupedFields = CATEGORY_ORDER.reduce((acc, category) => {
    const fields = filteredFields.filter((f) => f.category === category);
    if (fields.length > 0) {
      acc[category] = fields;
    }
    return acc;
  }, {} as Record<string, FieldTypeConfig[]>);

  return (
    <div className="w-64 border-r bg-card flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm mb-2">Types de champs</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {Object.entries(groupedFields).map(([category, fields]) => (
            <div key={category}>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {CATEGORY_LABELS[category]}
              </h4>
              <div className="space-y-1">
                {fields.map((config) => {
                  const Icon = ICON_MAP[config.icon] || Type;
                  return (
                    <button
                      key={config.type}
                      onClick={() => onAddField(config)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded-md text-left text-sm',
                        'hover:bg-accent hover:text-accent-foreground',
                        'transition-colors cursor-grab active:cursor-grabbing',
                        'border border-transparent hover:border-border'
                      )}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/json',
                          JSON.stringify(config)
                        );
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <div className="shrink-0 w-7 h-7 rounded bg-muted flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {config.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {config.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedFields).length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucun type de champ trouvé
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t text-xs text-muted-foreground">
        <p>💡 Glissez-déposez un champ sur le formulaire</p>
      </div>
    </div>
  );
});
