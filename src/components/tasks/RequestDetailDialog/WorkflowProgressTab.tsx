import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Layers, AlertCircle } from 'lucide-react';
import type { Task } from '@/types/task';
import { SubProcessWorkflowView } from './SubProcessWorkflowView';

interface SelectedSubProcess {
  id: string;
  subProcessTemplateId: string;
  name: string;
  status: string;
  workflowRunId: string | null;
}

interface WorkflowProgressTabProps {
  task: Task;
}

export function WorkflowProgressTab({ task }: WorkflowProgressTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubProcesses, setSelectedSubProcesses] = useState<SelectedSubProcess[]>([]);
  const [activeView, setActiveView] = useState<string>('');

  const fetchSelectedSubProcesses = useCallback(async () => {
    if (!task.id) {
      setIsLoading(false);
      return;
    }

    try {
      // Method 1: Try request_sub_processes table
      const { data: requestSPs } = await supabase
        .from('request_sub_processes')
        .select(`
          id,
          sub_process_template_id,
          status,
          workflow_run_id,
          sub_process_templates (
            id,
            name
          )
        `)
        .eq('request_id', task.id);

      if (requestSPs && requestSPs.length > 0) {
        const sps: SelectedSubProcess[] = requestSPs.map(rsp => {
          const spTemplate = rsp.sub_process_templates as { id: string; name: string } | null;
          return {
            id: rsp.id,
            subProcessTemplateId: rsp.sub_process_template_id,
            name: spTemplate?.name || 'Sous-processus',
            status: rsp.status || 'pending',
            workflowRunId: rsp.workflow_run_id,
          };
        });
        setSelectedSubProcesses(sps);
        if (sps.length > 0) {
          setActiveView(sps.length === 1 ? sps[0].subProcessTemplateId : 'global');
        }
        setIsLoading(false);
        return;
      }

      // Method 2: Fallback - deduce from child tasks
      const { data: childTasks } = await supabase
        .from('tasks')
        .select('source_sub_process_template_id')
        .eq('parent_request_id', task.id)
        .not('source_sub_process_template_id', 'is', null);

      if (childTasks && childTasks.length > 0) {
        const uniqueSpIds = [...new Set(childTasks.map(t => t.source_sub_process_template_id).filter(Boolean))] as string[];
        
        if (uniqueSpIds.length > 0) {
          const { data: spTemplates } = await supabase
            .from('sub_process_templates')
            .select('id, name')
            .in('id', uniqueSpIds);

          if (spTemplates) {
            const sps: SelectedSubProcess[] = spTemplates.map(sp => ({
              id: sp.id,
              subProcessTemplateId: sp.id,
              name: sp.name,
              status: 'in_progress',
              workflowRunId: null,
            }));
            setSelectedSubProcesses(sps);
            if (sps.length > 0) {
              setActiveView(sps.length === 1 ? sps[0].subProcessTemplateId : 'global');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching selected sub-processes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [task.id]);

  useEffect(() => {
    fetchSelectedSubProcesses();
  }, [fetchSelectedSubProcesses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task.source_process_template_id) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <p>Aucun processus associé à cette demande</p>
      </div>
    );
  }

  if (selectedSubProcesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Layers className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">Aucun sous-processus sélectionné pour cette demande</p>
        <p className="text-sm text-center mt-2">Choisissez un sous-processus pour visualiser le workflow</p>
      </div>
    );
  }

  // Case 1: Single sub-process - show directly
  if (selectedSubProcesses.length === 1) {
    const sp = selectedSubProcesses[0];
    return (
      <ScrollArea className="h-[400px]">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">WORKFLOW — {sp.name}</h3>
            <Badge variant="outline" className="ml-auto">
              {sp.status === 'completed' ? '✅ Terminé' : 
               sp.status === 'in_progress' ? '⏳ En cours' : 
               sp.status === 'cancelled' ? '🚫 Annulé' : '⏸️ En attente'}
            </Badge>
          </div>
          <SubProcessWorkflowView 
            subProcessTemplateId={sp.subProcessTemplateId}
            requestId={task.id}
            workflowRunId={sp.workflowRunId}
          />
        </div>
      </ScrollArea>
    );
  }

  // Case 2: Multiple sub-processes - show tabs
  return (
    <div className="h-[400px] flex flex-col">
      <Tabs value={activeView} onValueChange={setActiveView} className="flex-1 flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            <TabsTrigger value="global" className="text-xs">
              🌐 Vue globale
            </TabsTrigger>
            {selectedSubProcesses.map(sp => (
              <TabsTrigger key={sp.subProcessTemplateId} value={sp.subProcessTemplateId} className="text-xs">
                {sp.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        <ScrollArea className="flex-1">
          <TabsContent value="global" className="p-4 mt-0">
            <GlobalWorkflowView 
              subProcesses={selectedSubProcesses}
              requestId={task.id}
            />
          </TabsContent>
          
          {selectedSubProcesses.map(sp => (
            <TabsContent key={sp.subProcessTemplateId} value={sp.subProcessTemplateId} className="p-4 mt-0">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">
                  {sp.status === 'completed' ? '✅ Terminé' : 
                   sp.status === 'in_progress' ? '⏳ En cours' : 
                   sp.status === 'cancelled' ? '🚫 Annulé' : '⏸️ En attente'}
                </Badge>
              </div>
              <SubProcessWorkflowView 
                subProcessTemplateId={sp.subProcessTemplateId}
                requestId={task.id}
                workflowRunId={sp.workflowRunId}
              />
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// Global view showing combined progress of all selected sub-processes
interface GlobalWorkflowViewProps {
  subProcesses: SelectedSubProcess[];
  requestId: string;
}

function GlobalWorkflowView({ subProcesses, requestId }: GlobalWorkflowViewProps) {
  const completedCount = subProcesses.filter(sp => sp.status === 'completed').length;
  const progressPercent = subProcesses.length > 0 
    ? Math.round((completedCount / subProcesses.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Global progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progression globale</span>
          <span className="font-medium">{completedCount} / {subProcesses.length} sous-processus</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Sub-process cards */}
      <div className="space-y-3">
        {subProcesses.map(sp => (
          <SubProcessWorkflowView 
            key={sp.subProcessTemplateId}
            subProcessTemplateId={sp.subProcessTemplateId}
            requestId={requestId}
            workflowRunId={sp.workflowRunId}
            compact
            title={sp.name}
          />
        ))}
      </div>
    </div>
  );
}