import { useState, useEffect } from 'react';
import { usePendingAssignments, TaskToAssign } from '@/hooks/usePendingAssignments';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Loader2, UserPlus, CheckCircle, Clock, Flag, Workflow, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department_id: string | null;
}

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Basse', variant: 'secondary' },
  medium: { label: 'Moyenne', variant: 'outline' },
  high: { label: 'Haute', variant: 'default' },
  urgent: { label: 'Urgente', variant: 'destructive' },
};

export function PendingAssignmentsView() {
  const {
    tasksToAssign,
    isLoading,
    assignTask,
    getRequestsWithPending,
    refetch,
  } = usePendingAssignments();
  const { profile: currentProfile } = useAuth();
  const { permissionProfile } = useUserPermissions();
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);

  const canAssignToAll = permissionProfile?.can_assign_to_all || false;

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!currentProfile) return;

      let query = supabase
        .from('profiles')
        .select('id, display_name, avatar_url, job_title, department_id');

      // If user can only assign to their department
      if (!canAssignToAll && currentProfile.department_id) {
        query = query.eq('department_id', currentProfile.department_id);
      }

      const { data } = await query;
      if (data) {
        setAvailableProfiles(data);
      }
    };

    fetchProfiles();
  }, [currentProfile, canAssignToAll]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAssign = async (taskId: string, assigneeId: string) => {
    setIsAssigning(taskId);
    await assignTask(taskId, assigneeId);
    setIsAssigning(null);
  };

  const requestsWithPending = getRequestsWithPending();

  // Group tasks by parent request
  const groupedByRequest = tasksToAssign.reduce((acc, task) => {
    const requestId = task.parent_request_id || 'no-parent';
    if (!acc[requestId]) {
      acc[requestId] = [];
    }
    acc[requestId].push(task);
    return acc;
  }, {} as Record<string, TaskToAssign[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tasksToAssign.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune tâche à affecter</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Toutes les demandes ont été traitées. Les nouvelles demandes de service apparaîtront ici.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Tâches à affecter
          </h2>
          <p className="text-muted-foreground text-sm">
            {tasksToAssign.length} tâche(s) en attente d'affectation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          Actualiser
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-4" defaultValue={requestsWithPending.map(r => r.requestId)}>
        {requestsWithPending.map(({ requestId, title, count }) => (
          <AccordionItem key={requestId} value={requestId} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{title}</span>
                  <Badge variant="secondary">
                    {count} tâche(s)
                  </Badge>
                </div>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  À affecter
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {groupedByRequest[requestId]?.map((task) => (
                  <Card key={task.id} className="border-dashed">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm font-medium">
                            {task.title}
                          </CardTitle>
                          {task.description && (
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {task.description}
                            </CardDescription>
                          )}
                          {task.due_date && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Échéance: {format(new Date(task.due_date), 'dd MMM yyyy', { locale: fr })}
                            </p>
                          )}
                        </div>
                        <Badge variant={priorityConfig[task.priority || 'medium'].variant}>
                          <Flag className="h-3 w-3 mr-1" />
                          {priorityConfig[task.priority || 'medium'].label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Select
                          onValueChange={(value) => handleAssign(task.id, value)}
                          disabled={isAssigning === task.id}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Sélectionner un membre pour affecter" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProfiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={profile.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(profile.display_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{profile.display_name || 'Sans nom'}</span>
                                  {profile.job_title && (
                                    <span className="text-muted-foreground text-xs">
                                      ({profile.job_title})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isAssigning === task.id && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
