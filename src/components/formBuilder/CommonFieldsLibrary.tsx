import { memo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  Calendar,
  Flag,
  Layers,
  Star,
  Plus,
  GripVertical,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormField, FieldTypeConfig } from '@/types/formBuilder';
import { FIELD_TYPE_CONFIGS } from '@/types/formBuilder';

// Mandatory system fields that cannot be disabled
const MANDATORY_SYSTEM_FIELD_IDS = ['requester', 'company', 'department', 'priority', 'due_date'];

// Common system fields that can be activated/deactivated
const COMMON_SYSTEM_FIELDS = [
  {
    id: 'requester',
    name: 'demandeur',
    label: 'Demandeur',
    icon: User,
    description: 'Utilisateur faisant la demande',
    isSystem: true,
    isMandatory: true,
    autoFillInfo: 'Auto-rempli, non modifiable',
  },
  {
    id: 'company',
    name: 'societe',
    label: 'Société',
    icon: Building2,
    description: 'Société du demandeur',
    isSystem: true,
    isMandatory: true,
    autoFillInfo: 'Auto-rempli depuis le profil',
  },
  {
    id: 'department',
    name: 'service',
    label: 'Service',
    icon: Building2,
    description: 'Service du demandeur',
    isSystem: true,
    isMandatory: true,
    autoFillInfo: 'Auto-rempli depuis le profil',
  },
  {
    id: 'priority',
    name: 'priorite',
    label: 'Priorité',
    icon: Flag,
    description: 'Niveau de priorité',
    isSystem: true,
    isMandatory: true,
    autoFillInfo: 'Obligatoire, modifiable',
  },
  {
    id: 'due_date',
    name: 'echeance',
    label: 'Échéance',
    icon: Calendar,
    description: 'Date limite',
    isSystem: true,
    isMandatory: true,
    autoFillInfo: 'Obligatoire, modifiable',
  },
];

export { MANDATORY_SYSTEM_FIELD_IDS };

interface CommonFieldsLibraryProps {
  existingFields: FormField[];
  activeCommonFields: string[];
  onToggleCommonField: (fieldId: string, active: boolean) => void;
  onAddField: (config: FieldTypeConfig) => void;
  onSelectExistingField: (field: FormField) => void;
  canManage: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Type: () => <span className="text-base">📝</span>,
  AlignLeft: () => <span className="text-base">📄</span>,
  Hash: () => <span className="text-base">#</span>,
  Calendar: () => <span className="text-base">📅</span>,
  Clock: () => <span className="text-base">🕐</span>,
  Mail: () => <span className="text-base">✉️</span>,
  Phone: () => <span className="text-base">📞</span>,
  Link: () => <span className="text-base">🔗</span>,
  CheckSquare: () => <span className="text-base">☑️</span>,
  ChevronDown: () => <span className="text-base">📋</span>,
  ListChecks: () => <span className="text-base">📑</span>,
  UserSearch: () => <span className="text-base">👤</span>,
  Building2: () => <span className="text-base">🏢</span>,
  Paperclip: () => <span className="text-base">📎</span>,
  Database: () => <span className="text-base">🗃️</span>,
};

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Champs de base',
  advanced: 'Champs avancés',
  lookup: 'Recherche / Liaison',
  special: 'Champs spéciaux',
};

export const CommonFieldsLibrary = memo(function CommonFieldsLibrary({
  existingFields,
  activeCommonFields,
  onToggleCommonField,
  onAddField,
  onSelectExistingField,
  canManage,
}: CommonFieldsLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    system: true,
    existing: true,
    new: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Filter fields by search
  const filteredNewFields = FIELD_TYPE_CONFIGS.filter(
    (config) =>
      config.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExistingFields = existingFields.filter(
    (field) =>
      field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group new fields by category
  const groupedNewFields = ['basic', 'advanced', 'lookup', 'special'].reduce(
    (acc, category) => {
      const fields = filteredNewFields.filter((f) => f.category === category);
      if (fields.length > 0) {
        acc[category] = fields;
      }
      return acc;
    },
    {} as Record<string, FieldTypeConfig[]>
  );

  const renderFieldTypeButton = (config: FieldTypeConfig) => {
    const IconComponent = ICON_MAP[config.icon];
    return (
      <button
        key={config.type}
        onClick={() => canManage && onAddField(config)}
        disabled={!canManage}
        className={cn(
          'w-full flex items-center gap-2 p-2 rounded-md text-left text-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'transition-colors cursor-grab active:cursor-grabbing',
          'border border-transparent hover:border-border',
          !canManage && 'opacity-50 cursor-not-allowed'
        )}
        draggable={canManage}
        onDragStart={(e) => {
          if (canManage) {
            e.dataTransfer.setData('application/json', JSON.stringify(config));
            e.dataTransfer.effectAllowed = 'copy';
          }
        }}
      >
        <div className="shrink-0 w-7 h-7 rounded bg-muted flex items-center justify-center">
          {IconComponent && <IconComponent />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{config.label}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {config.description}
          </div>
        </div>
        <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </button>
    );
  };

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b space-y-2">
        <h3 className="font-semibold text-sm">Bibliothèque de champs</h3>
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
        <div className="p-3 space-y-3">
          {/* System Common Fields */}
          <Collapsible open={expandedSections.system}>
            <CollapsibleTrigger
              onClick={() => toggleSection('system')}
              className="flex items-center justify-between w-full py-1 hover:bg-muted/50 rounded px-1"
            >
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Champs système
                </span>
              </div>
              {expandedSections.system ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              <TooltipProvider delayDuration={200}>
                {COMMON_SYSTEM_FIELDS.map((field) => {
                  const isActive = activeCommonFields.includes(field.id);
                  const isMandatory = field.isMandatory === true;
                  const Icon = field.icon;
                  
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-md border transition-all',
                        isActive ? 'bg-primary/5 border-primary/30' : 'border-transparent hover:bg-muted/50',
                        isMandatory && 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50'
                      )}
                    >
                      <div className="shrink-0 w-7 h-7 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-sm truncate">{field.label}</span>
                          {isMandatory && (
                            <span className="text-destructive text-xs">*</span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {field.autoFillInfo || field.description}
                        </div>
                      </div>
                      
                      {isMandatory ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50">
                              <Lock className="h-3 w-3 text-amber-600" />
                              <Switch
                                checked={true}
                                disabled={true}
                                className="scale-75 opacity-50 cursor-not-allowed"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">Champ système obligatoire</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => onToggleCommonField(field.id, checked)}
                                disabled={!canManage}
                                className="scale-75"
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">Afficher dans le formulaire</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </TooltipProvider>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Existing Fields */}
          {filteredExistingFields.length > 0 && (
            <>
              <Collapsible open={expandedSections.existing}>
                <CollapsibleTrigger
                  onClick={() => toggleSection('existing')}
                  className="flex items-center justify-between w-full py-1 hover:bg-muted/50 rounded px-1"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Champs existants
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {filteredExistingFields.length}
                    </Badge>
                  </div>
                  {expandedSections.existing ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {filteredExistingFields.map((field) => (
                    <button
                      key={field.id}
                      onClick={() => onSelectExistingField(field)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded-md text-left text-sm',
                        'hover:bg-accent hover:text-accent-foreground',
                        'transition-colors border border-transparent hover:border-border'
                      )}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium truncate">{field.label}</span>
                          {field.is_required && (
                            <span className="text-destructive text-xs">*</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {field.field_type}
                          </Badge>
                          {field.is_common && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              Commun
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
              <Separator />
            </>
          )}

          {/* New Field Types */}
          <Collapsible open={expandedSections.new} defaultOpen>
            <CollapsibleTrigger
              onClick={() => toggleSection('new')}
              className="flex items-center justify-between w-full py-1 hover:bg-muted/50 rounded px-1"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Nouveaux champs
                </span>
              </div>
              {expandedSections.new ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {Object.entries(groupedNewFields).map(([category, fields]) => (
                <div key={category}>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1">
                    {CATEGORY_LABELS[category]}
                  </h4>
                  <div className="space-y-0.5">
                    {fields.map(renderFieldTypeButton)}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="p-3 border-t text-xs text-muted-foreground bg-muted/30">
        <p className="flex items-center gap-1">
          <GripVertical className="h-3 w-3" />
          Glissez un champ sur le canvas
        </p>
      </div>
    </div>
  );
});
