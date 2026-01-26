import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Plus, Workflow } from 'lucide-react';
import { WorkflowCanvas } from './WorkflowCanvas';
import { useWorkflowTemplates } from '@/hooks/useWorkflowTemplates';
import { useSubProcessTemplates } from '@/hooks/useSubProcessTemplates';
import { useCustomFields } from '@/hooks/useCustomFields';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowBuilderProps {
  processTemplateId?: string | null;
  subProcessTemplateId?: string | null;
  canManage?: boolean;
}

export function WorkflowBuilder({ 
  processTemplateId, 
  subProcessTemplateId,
  canManage = false 
}: WorkflowBuilderProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const {
    workflow,
    isLoading,
    isSaving,
    createWorkflow,
    updateWorkflow,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    publishWorkflow,
    saveCanvasSettings,
  } = useWorkflowTemplates({ processTemplateId, subProcessTemplateId });

  // Fetch sub-processes for this process
  const { subProcesses, fetchSubProcesses } = useSubProcessTemplates(processTemplateId || null);
  
  // Fetch custom fields for notification templates
  const { fields: customFields } = useCustomFields({ processTemplateId });

  // State for reference data (users, groups, departments)
  const [users, setUsers] = useState<{ id: string; display_name: string | null }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // Fetch reference data for task assignment
  useEffect(() => {
    const fetchReferenceData = async () => {
      const [usersRes, groupsRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').order('display_name'),
        supabase.from('collaborator_groups').select('id, name').order('name'),
        supabase.from('departments').select('id, name').order('name'),
      ]);
      
      if (usersRes.data) setUsers(usersRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (deptsRes.data) setDepartments(deptsRes.data);
    };
    
    fetchReferenceData();
  }, []);

  // Fetch sub-processes on mount
  useEffect(() => {
    if (processTemplateId) {
      fetchSubProcesses();
    }
  }, [processTemplateId, fetchSubProcesses]);

  // Flatten all task templates from all sub-processes
  const allTaskTemplates = subProcesses.flatMap(sp => sp.task_templates || []);

  const handleCreateWorkflow = async () => {
    if (!newName.trim()) return;
    
    const result = await createWorkflow(newName, newDescription || undefined);
    if (result) {
      setIsCreateDialogOpen(false);
      setNewName('');
      setNewDescription('');
    }
  };

  // No workflow exists yet
  if (!isLoading && !workflow) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Workflow className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucun workflow défini</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Créez un schéma de validation pour définir les étapes, approbations et notifications de ce processus.
            </p>
            {canManage && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un workflow
              </Button>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau workflow</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="workflow-name">Nom du workflow</Label>
                <Input
                  id="workflow-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Workflow de validation standard"
                />
              </div>
              <div>
                <Label htmlFor="workflow-description">Description (optionnel)</Label>
                <Textarea
                  id="workflow-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Décrivez le fonctionnement de ce workflow..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateWorkflow} disabled={!newName.trim() || isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-full">
      <WorkflowCanvas
        workflow={workflow}
        isLoading={isLoading}
        isSaving={isSaving}
        canManage={canManage}
        onAddNode={addNode}
        onUpdateNode={updateNode}
        onDeleteNode={deleteNode}
        onAddEdge={addEdge}
        onDeleteEdge={deleteEdge}
        onPublish={publishWorkflow}
        onSaveCanvasSettings={saveCanvasSettings}
        taskTemplates={allTaskTemplates}
        subProcesses={subProcesses.map(sp => ({ id: sp.id, name: sp.name }))}
        customFields={customFields}
        users={users}
        groups={groups}
        departments={departments}
      />
    </div>
  );
}
