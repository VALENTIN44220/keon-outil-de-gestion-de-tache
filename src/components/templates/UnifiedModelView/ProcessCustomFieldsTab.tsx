import { useState } from 'react';
import { FormBuilderContainer } from '@/components/formBuilder/FormBuilderContainer';
import { ProcessCustomFieldsEditor } from '../ProcessCustomFieldsEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, List } from 'lucide-react';

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
          <h3 className="text-base font-semibold">Champs personnalisés</h3>
          <p className="text-sm text-muted-foreground">
            Configurez les champs du formulaire de demande
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
        <FormBuilderContainer
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
