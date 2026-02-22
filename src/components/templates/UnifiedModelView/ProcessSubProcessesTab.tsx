import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  GitBranch,
  Loader2,
  GripVertical,
  Users,
  User,
  ExternalLink,
  Trash2,
  MoreVertical,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SubProcessConfigView } from '../SubProcessConfigView';

interface SubProcess {
  id: string;
  name: string;
  description: string | null;
  assignment_type: string;
  order_index: number;
  is_mandatory: boolean;
  taskCount: number;
}

interface ProcessSubProcessesTabProps {
  processId: string;
  onUpdate: () => void;
  canManage: boolean;
}

export function ProcessSubProcessesTab({
  processId,
  onUpdate,
  canManage,
}: ProcessSubProcessesTabProps) {
  const navigate = useNavigate();
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubProcesses();
  }, [processId]);

  const fetchSubProcesses = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('sub_process_templates')
        .select(`
          id,
          name,
          description,
          assignment_type,
          order_index,
          is_mandatory,
          task_templates (id)
        `)
        .eq('process_template_id', processId)
        .order('order_index');

      if (data) {
        setSubProcesses(
          data.map((sp: any) => ({
            id: sp.id,
            name: sp.name,
            description: sp.description,
            assignment_type: sp.assignment_type,
            order_index: sp.order_index,
            is_mandatory: sp.is_mandatory || false,
            taskCount: sp.task_templates?.length || 0,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching sub-processes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Sous-processus supprimé');
      fetchSubProcesses();
      onUpdate();
    } catch (error) {
      console.error('Error deleting sub-process:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getAssignmentIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="h-3 w-3" />;
      case 'manager':
        return <Users className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return;
      }

      const nextOrder = subProcesses.length > 0 
        ? Math.max(...subProcesses.map(sp => sp.order_index)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('sub_process_templates')
        .insert({
          process_template_id: processId,
          name: `Sous-processus ${nextOrder + 1}`,
          assignment_type: 'user',
          order_index: nextOrder,
          is_mandatory: false,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Sous-processus créé');
      await fetchSubProcesses();
      onUpdate();

      if (data) {
        setSelectedSubProcessId(data.id);
      }
    } catch (error) {
      console.error('Error creating sub-process:', error);
      toast.error('Erreur lors de la création');
    }
  };

  const getAssignmentLabel = (type: string) => {
    switch (type) {
      case 'user':
        return 'Affectation directe';
      case 'manager':
        return 'Via manager';
      case 'role':
        return 'Par rôle';
      default:
        return 'Standard';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Sous-processus</h3>
          <p className="text-sm text-muted-foreground">
            Gérez les étapes de ce processus
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        )}
      </div>

      {subProcesses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">
              Aucun sous-processus configuré
            </p>
            {canManage && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un sous-processus
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {subProcesses.map((sp, index) => (
            <Card key={sp.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {canManage && (
                    <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                      <GripVertical className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span className="font-medium truncate">{sp.name}</span>
                      {sp.is_mandatory && (
                        <Badge variant="destructive" className="text-xs">
                          Obligatoire
                        </Badge>
                      )}
                    </div>
                    {sp.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {sp.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        {getAssignmentIcon(sp.assignment_type)}
                        {getAssignmentLabel(sp.assignment_type)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {sp.taskCount} tâche(s)
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSubProcessId(sp.id)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configurer
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate(`/templates/workflow/subprocess/${sp.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDelete(sp.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sub-process Configuration Panel */}
      {selectedSubProcessId && (
        <SubProcessConfigView
          subProcessId={selectedSubProcessId}
          open={!!selectedSubProcessId}
          onClose={() => setSelectedSubProcessId(null)}
          onUpdate={() => {
            fetchSubProcesses();
            onUpdate();
          }}
          canManage={canManage}
        />
      )}
    </div>
  );
}
