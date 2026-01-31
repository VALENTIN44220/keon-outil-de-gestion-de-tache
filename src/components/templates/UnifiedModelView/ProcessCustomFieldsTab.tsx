import { useState } from 'react';
import { EnhancedFormBuilderContainer } from '@/components/formBuilder/EnhancedFormBuilderContainer';
import { ProcessCustomFieldsEditor } from '../ProcessCustomFieldsEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, List, Wand2 } from 'lucide-react';

interface ProcessCustomFieldsTabProps {
  processId: string;
  canManage: boolean;
}

export function ProcessCustomFieldsTab({ processId, canManage }: ProcessCustomFieldsTabProps) {
  const [viewMode, setViewMode] = useState<'builder' | 'list'>('builder');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Form Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Configurez visuellement les champs du formulaire de demande
          </p>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="builder" className="h-7 px-2 text-xs gap-1">
              <LayoutGrid className="h-3 w-3" />
              Form Builder
            </TabsTrigger>
            <TabsTrigger value="list" className="h-7 px-2 text-xs gap-1">
              <List className="h-3 w-3" />
              Liste
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === 'builder' ? (
        <EnhancedFormBuilderContainer
          processTemplateId={processId}
          canManage={canManage}
        />
      ) : (
        <ProcessCustomFieldsEditor
          processTemplateId={processId}
          canManage={canManage}
        />
      )}
    </div>
  );
}
