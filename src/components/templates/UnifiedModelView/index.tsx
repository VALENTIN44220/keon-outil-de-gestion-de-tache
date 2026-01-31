import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  GitBranch,
  Workflow,
  FormInput,
  Bell,
  ExternalLink,
  Layers,
  History,
  Play,
  CheckCircle,
  Clock,
  Building2,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks } from '@/types/template';
import { ProcessSettingsTab } from './ProcessSettingsTab';
import { ProcessSubProcessesTab } from './ProcessSubProcessesTab';
import { ProcessWorkflowTab } from './ProcessWorkflowTab';
import { ProcessCustomFieldsTab } from './ProcessCustomFieldsTab';
import { ProcessNotificationsTab } from './ProcessNotificationsTab';

interface UnifiedModelViewProps {
  process: ProcessWithTasks | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  canManage?: boolean;
}

interface WorkflowInfo {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  updatedAt: string;
}

export function UnifiedModelView({
  process,
  open,
  onClose,
  onUpdate,
  canManage = false,
}: UnifiedModelViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('settings');
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [subProcessCount, setSubProcessCount] = useState(0);
  const [customFieldCount, setCustomFieldCount] = useState(0);

  useEffect(() => {
    if (!process?.id || !open) return;

    // Fetch workflow info
    const fetchWorkflowInfo = async () => {
      const { data } = await supabase
        .from('workflow_templates')
        .select('id, name, status, version, updated_at')
        .eq('process_template_id', process.id)
        .eq('is_default', true)
        .single();

      if (data) {
        setWorkflowInfo({
          id: data.id,
          name: data.name,
          status: data.status as 'draft' | 'published' | 'archived',
          version: data.version,
          updatedAt: data.updated_at,
        });
      } else {
        setWorkflowInfo(null);
      }
    };

    // Fetch sub-process count
    const fetchSubProcessCount = async () => {
      const { count } = await supabase
        .from('sub_process_templates')
        .select('id', { count: 'exact', head: true })
        .eq('process_template_id', process.id);

      setSubProcessCount(count || 0);
    };

    // Fetch custom field count
    const fetchCustomFieldCount = async () => {
      const { count } = await supabase
        .from('template_custom_fields')
        .select('id', { count: 'exact', head: true })
        .eq('process_template_id', process.id);

      setCustomFieldCount(count || 0);
    };

    fetchWorkflowInfo();
    fetchSubProcessCount();
    fetchCustomFieldCount();
  }, [process?.id, open]);

  if (!process) return null;

  const getWorkflowStatusBadge = () => {
    if (!workflowInfo) {
      return <Badge variant="outline">Non configuré</Badge>;
    }

    switch (workflowInfo.status) {
      case 'published':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Publié (v{workflowInfo.version})
          </Badge>
        );
      case 'draft':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Brouillon
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="secondary">
            <History className="h-3 w-3 mr-1" />
            Archivé
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col h-full">
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {process.name}
              </SheetTitle>
              {process.description && (
                <p className="text-sm text-muted-foreground mt-1">{process.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {getWorkflowStatusBadge()}
                <Badge variant="outline" className="gap-1">
                  <GitBranch className="h-3 w-3" />
                  {subProcessCount} sous-processus
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FormInput className="h-3 w-3" />
                  {customFieldCount} champs
                </Badge>
                {process.company && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {process.company}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-4 shrink-0">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="settings" className="gap-1 text-xs">
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Paramètres</span>
              </TabsTrigger>
              <TabsTrigger value="subprocesses" className="gap-1 text-xs">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sous-proc.</span>
              </TabsTrigger>
              <TabsTrigger value="workflow" className="gap-1 text-xs">
                <Workflow className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Workflow</span>
              </TabsTrigger>
              <TabsTrigger value="fields" className="gap-1 text-xs">
                <FormInput className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Champs</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1 text-xs">
                <Bell className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Notifs</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              <TabsContent value="settings" className="mt-0">
                <ProcessSettingsTab
                  process={process}
                  onUpdate={onUpdate}
                  canManage={canManage}
                />
              </TabsContent>

              <TabsContent value="subprocesses" className="mt-0">
                <ProcessSubProcessesTab
                  processId={process.id}
                  onUpdate={onUpdate}
                  canManage={canManage}
                />
              </TabsContent>

              <TabsContent value="workflow" className="mt-0">
                <ProcessWorkflowTab
                  processId={process.id}
                  processName={process.name}
                  workflowInfo={workflowInfo}
                  canManage={canManage}
                  onNavigateToEditor={() => navigate(`/templates/workflow/process/${process.id}`)}
                />
              </TabsContent>

              <TabsContent value="fields" className="mt-0">
                <ProcessCustomFieldsTab
                  processId={process.id}
                  canManage={canManage}
                />
              </TabsContent>

              <TabsContent value="notifications" className="mt-0">
                <ProcessNotificationsTab
                  processId={process.id}
                  canManage={canManage}
                />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
