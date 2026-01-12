import { useState, useEffect } from 'react';
import { useUnassignedTasks } from '@/hooks/useUnassignedTasks';
import { Task } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, UserPlus, AlertCircle, Calendar, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Basse', variant: 'secondary' },
  medium: { label: 'Moyenne', variant: 'outline' },
  high: { label: 'Haute', variant: 'default' },
  urgent: { label: 'Urgente', variant: 'destructive' },
};

export function UnassignedTasksView() {
  const { unassignedTasks, isLoading, assignTask, count } = useUnassignedTasks();
  const { profile: currentProfile } = useAuth();
  const [departmentMembers, setDepartmentMembers] = useState<Profile[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    const fetchDepartmentMembers = async () => {
      if (!currentProfile?.department_id) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, job_title')
        .eq('department_id', currentProfile.department_id);

      if (data) {
        setDepartmentMembers(data);
      }
    };

    fetchDepartmentMembers();
  }, [currentProfile?.department_id]);

  const handleOpenAssignDialog = (task: Task) => {
    setSelectedTask(task);
    setSelectedAssignee('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedTask || !selectedAssignee) return;

    setIsAssigning(true);
    await assignTask(selectedTask.id, selectedAssignee);
    setIsAssigning(false);
    setAssignDialogOpen(false);
    setSelectedTask(null);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune tâche à affecter</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Toutes les tâches de votre service ont été affectées. Les nouvelles demandes apparaîtront ici.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tâches à affecter</h2>
          <p className="text-muted-foreground text-sm">
            {count} tâche(s) en attente d'affectation dans votre service
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {count}
        </Badge>
      </div>

      <div className="grid gap-4">
        {unassignedTasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{task.title}</CardTitle>
                  {task.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {task.description}
                    </CardDescription>
                  )}
                </div>
                <Badge variant={priorityConfig[task.priority].variant}>
                  <Flag className="h-3 w-3 mr-1" />
                  {priorityConfig[task.priority].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(task.due_date), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  )}
                  {task.category && (
                    <Badge variant="outline">{task.category}</Badge>
                  )}
                </div>
                <Button onClick={() => handleOpenAssignDialog(task)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Affecter
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Affecter la tâche</DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedTask.title}</p>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTask.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assigner à</label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un membre de l'équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(member.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.display_name || 'Sans nom'}</span>
                          {member.job_title && (
                            <span className="text-muted-foreground text-xs">
                              ({member.job_title})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAssign} disabled={!selectedAssignee || isAssigning}>
              {isAssigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
