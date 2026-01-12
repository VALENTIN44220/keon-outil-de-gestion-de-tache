import { useState, useEffect } from 'react';
import { usePendingAssignments, PendingAssignment } from '@/hooks/usePendingAssignments';
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
    pendingAssignments,
    isLoading,
    assignPendingTask,
    confirmAndCreateTasks,
    getRequestsWithPending,
  } = usePendingAssignments();
  const { profile: currentProfile } = useAuth();
  const { permissionProfile } = useUserPermissions();
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [isCreating, setIsCreating] = useState<string | null>(null);

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

  const handleAssign = async (pendingId: string, assigneeId: string) => {
    await assignPendingTask(pendingId, assigneeId);
  };

  const handleConfirmAndCreate = async (requestId: string) => {
    setIsCreating(requestId);
    await confirmAndCreateTasks(requestId);
    setIsCreating(null);
  };

  const requestsWithPending = getRequestsWithPending();

  // Group pending assignments by request
  const groupedByRequest = pendingAssignments.reduce((acc, pending) => {
    if (!acc[pending.request_id]) {
      acc[pending.request_id] = [];
    }
    acc[pending.request_id].push(pending);
    return acc;
  }, {} as Record<string, PendingAssignment[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requestsWithPending.length === 0) {
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
            Affectations en attente
          </h2>
          <p className="text-muted-foreground text-sm">
            {requestsWithPending.length} demande(s) avec des tâches à affecter
          </p>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-4">
        {requestsWithPending.map(({ requestId, title, count, allAssigned }) => (
          <AccordionItem key={requestId} value={requestId} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{title}</span>
                  <Badge variant="secondary">
                    {count} tâche(s)
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {allAssigned ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Prêt
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      En attente
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {groupedByRequest[requestId]?.map((pending) => (
                  <Card key={pending.id} className="border-dashed">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm font-medium">
                            {pending.task_template?.title || 'Tâche'}
                          </CardTitle>
                          {pending.task_template?.description && (
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {pending.task_template.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant={priorityConfig[pending.task_template?.priority || 'medium'].variant}>
                          <Flag className="h-3 w-3 mr-1" />
                          {priorityConfig[pending.task_template?.priority || 'medium'].label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={pending.assignee_id || ''}
                          onValueChange={(value) => handleAssign(pending.id, value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Sélectionner un membre" />
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
                        {pending.assignee && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={pending.assignee.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(pending.assignee.display_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{pending.assignee.display_name}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {allAssigned && (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => handleConfirmAndCreate(requestId)}
                      disabled={isCreating === requestId}
                    >
                      {isCreating === requestId && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmer et créer les tâches
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
