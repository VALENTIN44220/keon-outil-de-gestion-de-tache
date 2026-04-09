import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchedRouteParam } from '@/hooks/useMatchedRouteParam';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Settings,
  GitBranch,
  FormInput,
  Bell,
  Layers,
  Building2,
  Eye,
  Users,
  ArrowLeft,
  ListTodo,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks } from '@/types/template';
import { ProcessSettingsTab } from '@/components/templates/UnifiedModelView/ProcessSettingsTab';
import { ProcessAccessTab } from '@/components/templates/UnifiedModelView/ProcessAccessTab';
import { ProcessSubProcessesTab } from '@/components/templates/UnifiedModelView/ProcessSubProcessesTab';

import { ProcessAssignmentTab } from '@/components/templates/UnifiedModelView/ProcessAssignmentTab';
import { ProcessCustomFieldsTab } from '@/components/templates/UnifiedModelView/ProcessCustomFieldsTab';

import { ProcessNotificationsTab } from '@/components/templates/UnifiedModelView/ProcessNotificationsTab';

import { ProcessTaskManagement } from '@/components/process-tracking/ProcessTaskManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';


export default function ProcessSettings() {
  const processId = useMatchedRouteParam('processId', '/templates/process/:processId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { allTasks } = useTasks();
  const { notifications, unreadCount, hasUrgent } = useNotifications(allTasks);

  const [activeView, setActiveView] = useState('templates');
  const [activeTab, setActiveTab] = useState('settings');
  const [process, setProcess] = useState<ProcessWithTasks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [subProcessCount, setSubProcessCount] = useState(0);
  const [customFieldCount, setCustomFieldCount] = useState(0);

  const fetchProcess = async () => {
    if (!processId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('process_templates')
        .select('*')
        .eq('id', processId)
        .single();

      if (error) throw error;
      if (!data) {
        navigate('/templates');
        return;
      }

      // Check if user can manage
      const { data: canManageData } = await supabase.rpc('can_manage_template', {
        _creator_id: data.user_id,
      });

      setProcess({ ...data, task_templates: [] } as ProcessWithTasks);
      setCanManage(Boolean(canManageData));

      // Fetch counts
      const [{ count: spCount }, { count: cfCount }] = await Promise.all([
        supabase.from('sub_process_templates').select('id', { count: 'exact', head: true }).eq('process_template_id', processId),
        supabase.from('template_custom_fields').select('id', { count: 'exact', head: true }).eq('process_template_id', processId),
      ]);

      setSubProcessCount(spCount || 0);
      setCustomFieldCount(cfCount || 0);
    } catch (error) {
      console.error('Error fetching process:', error);
      navigate('/templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProcess();
  }, [processId]);

  const handleUpdate = async () => {
    await fetchProcess();
  };

  const tabs = [
    { id: 'settings', label: 'Paramètres', icon: Settings },
    { id: 'access', label: 'Accès', icon: Eye },
    { id: 'subprocesses', label: 'Sous-proc.', icon: GitBranch },
    { id: 'fields', label: 'Champs', icon: FormInput },
    { id: 'assignment', label: 'Affectation', icon: Users },
    { id: 'notifications', label: 'Notifs', icon: Bell },
    { id: 'tasks', label: 'Gestion des tâches', icon: ListTodo },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PageHeader title="Chargement..." />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-64 w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!process) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Layers className="h-5 w-5 text-primary" />
              <span>{process.name}</span>
            </div>
          }
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Header with badges */}
          <div className="px-6 py-4 border-b bg-card/50">
            {process.description && (
              <p className="text-sm text-muted-foreground mb-3">{process.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
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

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 pt-4 shrink-0 overflow-x-auto border-b bg-background">
              <TabsList className="inline-flex w-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="gap-1.5 text-sm"
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 max-w-5xl">
                <TabsContent value="settings" className="mt-0">
                  <ProcessSettingsTab
                    process={process}
                    onUpdate={handleUpdate}
                    canManage={canManage}
                  />
                </TabsContent>

                <TabsContent value="access" className="mt-0">
                  <ProcessAccessTab
                    process={process}
                    onUpdate={handleUpdate}
                    canManage={canManage}
                  />
                </TabsContent>

                <TabsContent value="subprocesses" className="mt-0">
                  <ProcessSubProcessesTab
                    processId={process.id}
                    onUpdate={handleUpdate}
                    canManage={canManage}
                  />
                </TabsContent>

                <TabsContent value="fields" className="mt-0">
                  <ProcessCustomFieldsTab
                    processId={process.id}
                    canManage={canManage}
                  />
                </TabsContent>




                <TabsContent value="assignment" className="mt-0">
                  <ProcessAssignmentTab
                    process={process}
                    onUpdate={handleUpdate}
                    canManage={canManage}
                  />
                </TabsContent>

                <TabsContent value="notifications" className="mt-0">
                  <ProcessNotificationsTab
                    processId={process.id}
                    canManage={canManage}
                    onUpdate={handleUpdate}
                  />
                </TabsContent>




                <TabsContent value="tasks" className="mt-0">
                  <ProcessTaskManagement
                    processId={process.id}
                    canWrite={canManage}
                  />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
