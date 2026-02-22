import { useState, useEffect } from 'react';
import { EnhancedFormBuilderContainer } from '@/components/formBuilder/EnhancedFormBuilderContainer';
import { ProcessCustomFieldsEditor } from '../ProcessCustomFieldsEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, List, Wand2, Workflow, FormInput, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface ProcessCustomFieldsTabProps {
  processId: string;
  canManage: boolean;
}

interface SubProcessInfo {
  id: string;
  name: string;
}

export function ProcessCustomFieldsTab({ processId, canManage }: ProcessCustomFieldsTabProps) {
  const [viewMode, setViewMode] = useState<'builder' | 'list'>('builder');
  const [subProcesses, setSubProcesses] = useState<SubProcessInfo[]>([]);
  const [activeScope, setActiveScope] = useState<string>('process');

  // Fetch sub-processes for this process
  useEffect(() => {
    async function fetchSubProcesses() {
      const { data } = await supabase
        .from('sub_process_templates')
        .select('id, name')
        .eq('process_template_id', processId)
        .order('order_index');
      
      setSubProcesses(data || []);
    }
    fetchSubProcesses();
  }, [processId]);

  const activeSubProcessId = activeScope !== 'process' ? activeScope : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Form Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Configurez les champs du formulaire — communs au processus ou spécifiques à chaque sous-processus
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

      {/* Scope selector: process-level vs per sub-process */}
      {subProcesses.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 border">
          <button
            onClick={() => setActiveScope('process')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeScope === 'process'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border'
            }`}
          >
            <FormInput className="h-3.5 w-3.5" />
            Champs communs
            <Badge variant={activeScope === 'process' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
              Processus
            </Badge>
          </button>
          {subProcesses.map((sp) => (
            <button
              key={sp.id}
              onClick={() => setActiveScope(sp.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeScope === sp.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {sp.name}
              <Badge variant={activeScope === sp.id ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                Spécifique
              </Badge>
            </button>
          ))}
        </div>
      )}

      {viewMode === 'builder' ? (
        <EnhancedFormBuilderContainer
          key={activeScope}
          processTemplateId={activeScope === 'process' ? processId : null}
          subProcessTemplateId={activeSubProcessId}
          canManage={canManage}
        />
      ) : activeScope === 'process' ? (
        <ProcessCustomFieldsEditor
          key="process"
          processTemplateId={processId}
          canManage={canManage}
        />
      ) : (
        <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
          La vue liste n'est disponible que pour les champs communs du processus. Utilisez le Form Builder pour les champs spécifiques aux sous-processus.
        </div>
      )}
    </div>
  );
}
