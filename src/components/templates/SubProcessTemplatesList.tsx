import { useState } from 'react';
import { SubProcessWithTasks } from '@/types/template';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Trash2,
  Edit,
  Users,
  User,
  UserCog,
  Layers,
  ListTodo,
  Lock,
  Building2,
  Globe,
} from 'lucide-react';
import { EditSubProcessDialog } from './EditSubProcessDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VISIBILITY_LABELS } from '@/types/template';
import { Loader2 } from 'lucide-react';

interface SubProcessTemplatesListProps {
  subProcesses: (SubProcessWithTasks & { process_name?: string | null })[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

const assignmentTypeLabels: Record<string, { label: string; icon: any }> = {
  manager: { label: 'Par manager', icon: Users },
  role: { label: 'Par poste', icon: UserCog },
  user: { label: 'Utilisateur', icon: User },
};

const visibilityIcons: Record<string, any> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  public: Globe,
};

export function SubProcessTemplatesList({
  subProcesses,
  isLoading,
  onDelete,
  onRefresh,
}: SubProcessTemplatesListProps) {
  const [editingSubProcess, setEditingSubProcess] = useState<SubProcessWithTasks | null>(null);

  const handleUpdate = async (id: string, updates: Partial<SubProcessWithTasks>) => {
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Sous-processus mis à jour');
      setEditingSubProcess(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating sub-process:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (subProcesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card rounded-xl shadow-sm">
        <Layers className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-lg mb-2">Aucun sous-processus</p>
        <p className="text-sm text-muted-foreground">
          Les sous-processus sont créés depuis un processus parent
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subProcesses.map((sp) => {
          const AssignmentIcon = assignmentTypeLabels[sp.assignment_type]?.icon || Users;
          const VisibilityIcon = visibilityIcons[sp.visibility_level] || Globe;

          return (
            <Card key={sp.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg line-clamp-1">{sp.name}</CardTitle>
                    {sp.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {sp.description}
                      </p>
                    )}
                  </div>
                  {sp.can_manage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingSubProcess(sp)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(sp.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {sp.process_name && (
                    <Badge variant="outline" className="text-xs">
                      <Layers className="h-3 w-3 mr-1" />
                      {sp.process_name}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <AssignmentIcon className="h-3 w-3 mr-1" />
                    {assignmentTypeLabels[sp.assignment_type]?.label}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <ListTodo className="h-3 w-3 mr-1" />
                    {sp.task_templates.length} tâche(s)
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <VisibilityIcon className="h-3 w-3 mr-1" />
                    {VISIBILITY_LABELS[sp.visibility_level]}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <EditSubProcessDialog
        subProcess={editingSubProcess}
        open={!!editingSubProcess}
        onClose={() => setEditingSubProcess(null)}
        onSave={(updates) => editingSubProcess && handleUpdate(editingSubProcess.id, updates)}
      />
    </>
  );
}
