import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  UserRoundX, 
  UserRoundPlus, 
  Search, 
  AlertTriangle,
  Calendar,
  Loader2,
  Copy,
  ArrowRightLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  display_name: string;
  avatar_url?: string;
  job_title?: string;
  department?: string;
}

interface ReassignTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onReassigned: () => void;
  /** If true, also move workload slots to the new user */
  includeWorkloadSlots?: boolean;
  teamMembers?: TeamMember[];
}

export function ReassignTaskDialog({
  task,
  isOpen,
  onClose,
  onReassigned,
  includeWorkloadSlots = true,
  teamMembers: providedMembers,
}: ReassignTaskDialogProps) {
  const { profile: authProfile } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() || authProfile;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [moveSlots, setMoveSlots] = useState(includeWorkloadSlots);
  const [isLoading, setIsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(providedMembers || []);
  const [loadingMembers, setLoadingMembers] = useState(false);
  // Mode: 'transfer' = transférer la tâche, 'duplicate' = créer une copie indépendante
  const [reassignMode, setReassignMode] = useState<'transfer' | 'duplicate'>('transfer');

  // Fetch team members if not provided
  useEffect(() => {
    if (providedMembers && providedMembers.length > 0) {
      setTeamMembers(providedMembers);
      return;
    }

    if (!isOpen || !profile?.id) return;

    const fetchTeamMembers = async () => {
      setLoadingMembers(true);
      try {
        // Fetch subordinates recursively
        const findSubordinates = async (managerId: string, visited = new Set<string>()): Promise<string[]> => {
          if (visited.has(managerId)) return [];
          visited.add(managerId);
          
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('manager_id', managerId)
            .neq('id', managerId);
          
          if (!data) return [];
          
          const ids = data.map(p => p.id);
          for (const id of data.map(p => p.id)) {
            const subIds = await findSubordinates(id, visited);
            ids.push(...subIds);
          }
          return ids;
        };

        const subordinateIds = await findSubordinates(profile.id);

         // If user has no subordinates, fallback to a broader, still relevant scope
         // to avoid an empty list (e.g., non-managers reassigning their own tasks).
         const departmentId = (profile as any)?.department_id as string | null | undefined;
         const companyId = (profile as any)?.company_id as string | null | undefined;

         if (subordinateIds.length === 0) {
           let query = supabase
             .from('profiles')
             .select('id, display_name, avatar_url, job_title, department')
             .eq('status', 'active');

           if (departmentId) {
             query = query.eq('department_id', departmentId);
           } else if (companyId) {
             query = query.eq('company_id', companyId);
           }

           const { data: members } = await query.order('display_name');
           setTeamMembers(members || []);
         } else {
           const allIds = [profile.id, ...subordinateIds];
           const { data: members } = await supabase
             .from('profiles')
             .select('id, display_name, avatar_url, job_title, department')
             .in('id', allIds)
             .eq('status', 'active')
             .order('display_name');

           setTeamMembers(members || []);
         }
      } catch (error) {
        console.error('Error fetching team members:', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [isOpen, profile?.id, providedMembers]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedUserId(null);
      setReason('');
      setSearchQuery('');
      setReassignMode('transfer');
    }
  }, [isOpen]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredMembers = teamMembers.filter(member => {
    // Exclude current assignee only in transfer mode
    if (reassignMode === 'transfer' && member.id === task?.assignee_id) return false;
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.display_name?.toLowerCase().includes(query) ||
      member.job_title?.toLowerCase().includes(query) ||
      member.department?.toLowerCase().includes(query)
    );
  });

  const currentAssignee = teamMembers.find(m => m.id === task?.assignee_id);
  const selectedMember = teamMembers.find(m => m.id === selectedUserId);

  const handleReassign = async () => {
    if (!task || !selectedUserId) return;

    setIsLoading(true);
    try {
      if (reassignMode === 'duplicate') {
        // Mode DUPLICATION : Créer une nouvelle tâche indépendante
        const { data: newTask, error: createError } = await supabase
          .from('tasks')
          .insert({
            user_id: task.user_id,
            title: task.title,
            description: task.description,
            status: 'todo' as const, // New task starts as todo
            priority: task.priority,
            type: task.type,
            category: task.category,
            category_id: task.category_id,
            subcategory_id: task.subcategory_id,
            due_date: task.due_date,
            assignee_id: selectedUserId,
            requester_id: task.requester_id,
            reporter_id: task.reporter_id,
            target_department_id: task.target_department_id,
            source_process_template_id: task.source_process_template_id,
            source_sub_process_template_id: task.source_sub_process_template_id,
            parent_request_id: task.parent_request_id,
            be_project_id: task.be_project_id,
            be_label_id: task.be_label_id,
            // Validation settings from original (but reset status)
            validation_level_1: task.validation_level_1,
            validation_level_2: task.validation_level_2,
            validator_level_1_id: task.validator_level_1_id,
            validator_level_2_id: task.validator_level_2_id,
          })
          .select('id, task_number')
          .single();

        if (createError) throw createError;

        // Copy workload slots if requested
        if (moveSlots && task.assignee_id) {
          // Get existing slots from original task
          const { data: existingSlots } = await supabase
            .from('workload_slots')
            .select('date, half_day, notes')
            .eq('task_id', task.id)
            .eq('user_id', task.assignee_id);

          if (existingSlots && existingSlots.length > 0) {
            // Create new slots for the new task
            const newSlots = existingSlots.map(slot => ({
              task_id: newTask.id,
              user_id: selectedUserId,
              date: slot.date,
              half_day: slot.half_day,
              notes: slot.notes,
            }));

            await supabase.from('workload_slots').insert(newSlots);
          }
        }

        // Add comment to original task
        if (reason.trim()) {
          try {
            await supabase.from('task_comments').insert({
              task_id: task.id,
              author_id: profile?.id,
              content: `📋 Tâche dupliquée vers ${selectedMember?.display_name}${reason ? ` - Motif : ${reason}` : ''} (Nouvelle tâche #${newTask.task_number || newTask.id.slice(0, 8)})`,
            });
          } catch {
            // Ignore if table doesn't exist
          }
        }

        toast.success(
          `Tâche dupliquée pour ${selectedMember?.display_name}`,
          { description: `Nouvelle tâche créée avec son propre numéro.` }
        );
      } else {
        // Mode TRANSFERT : Déplacer la tâche existante
        const { error: taskError } = await supabase
          .from('tasks')
          .update({
            assignee_id: selectedUserId,
            // If task was "À affecter", move to "À faire"
            ...(task.status === 'to_assign' ? { status: 'todo' } : {}),
          })
          .eq('id', task.id);

        if (taskError) throw taskError;

        // Move workload slots if requested
        if (moveSlots && task.assignee_id) {
          // Update all slots from old user to new user
          const { error: slotsError } = await supabase
            .from('workload_slots')
            .update({ user_id: selectedUserId })
            .eq('task_id', task.id)
            .eq('user_id', task.assignee_id);

          if (slotsError) {
            console.error('Error moving slots:', slotsError);
            // Don't throw - task is already reassigned
          }
        }

        // Add a comment to track the reassignment
        if (reason.trim()) {
          try {
            await supabase.from('task_comments').insert({
              task_id: task.id,
              author_id: profile?.id,
              content: `🔄 Tâche réaffectée de ${currentAssignee?.display_name || 'Non assigné'} à ${selectedMember?.display_name}${reason ? ` - Motif : ${reason}` : ''}`,
            });
          } catch {
            // Ignore if table doesn't exist
          }
        }

        toast.success(
          `Tâche réaffectée à ${selectedMember?.display_name}`,
          { description: moveSlots ? 'Les créneaux de planning ont été transférés.' : undefined }
        );
      }

      onReassigned();
      onClose();
    } catch (error: any) {
      console.error('Error reassigning task:', error);
      toast.error('Erreur lors de la réaffectation', {
        description: error.message || 'Veuillez réessayer.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="h-5 w-5 text-primary" />
            Réaffecter la tâche
          </DialogTitle>
          <DialogDescription>
            Transférer ou dupliquer cette tâche pour un autre collaborateur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current assignment */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Tâche concernée</div>
            <div className="font-medium text-sm">{task.title}</div>
            {currentAssignee && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <UserRoundX className="h-4 w-4" />
                <span>Actuellement affectée à :</span>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={currentAssignee.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(currentAssignee.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{currentAssignee.display_name}</span>
              </div>
            )}
          </div>

          {/* Mode selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Mode de réaffectation</Label>
            <RadioGroup
              value={reassignMode}
              onValueChange={(value) => setReassignMode(value as 'transfer' | 'duplicate')}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="mode-transfer"
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  reassignMode === 'transfer' 
                    ? "bg-primary/10 border-primary" 
                    : "hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value="transfer" id="mode-transfer" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <ArrowRightLeft className="h-4 w-4" />
                    Transférer
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Déplacer la tâche existante
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="mode-duplicate"
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  reassignMode === 'duplicate' 
                    ? "bg-primary/10 border-primary" 
                    : "hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value="duplicate" id="mode-duplicate" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <Copy className="h-4 w-4" />
                    Dupliquer
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Créer une copie indépendante
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* Info about selected mode */}
          {reassignMode === 'duplicate' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <Copy className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-200">
                Une nouvelle tâche sera créée avec son propre numéro. 
                Les deux tâches seront indépendantes : terminer l'une n'affectera pas l'autre.
              </p>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un collaborateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Team member list */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {reassignMode === 'transfer' ? 'Sélectionner le nouveau responsable' : 'Sélectionner le destinataire de la copie'}
            </Label>
            <ScrollArea className="h-[180px] border rounded-lg">
              {loadingMembers ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4">
                  <UserRoundX className="h-8 w-8 mb-2 opacity-50" />
                  <span>Aucun collaborateur trouvé</span>
                </div>
              ) : (
                <div className="p-1 space-y-1">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedUserId(member.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                        selectedUserId === member.id
                          ? "bg-primary/10 border-primary border"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{member.display_name}</div>
                        {(member.job_title || member.department) && (
                          <div className="text-xs text-muted-foreground truncate">
                            {member.job_title}
                            {member.job_title && member.department && ' • '}
                            {member.department}
                          </div>
                        )}
                      </div>
                      {selectedUserId === member.id && (
                        <Badge className="shrink-0 bg-primary text-primary-foreground">
                          Sélectionné
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="move-slots" className="text-sm font-medium">
                  {reassignMode === 'transfer' ? 'Transférer le planning' : 'Copier le planning'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {reassignMode === 'transfer' 
                    ? 'Déplacer les créneaux de charge vers le nouveau responsable'
                    : 'Dupliquer les créneaux de charge vers le destinataire'
                  }
                </p>
              </div>
            </div>
            <Switch
              id="move-slots"
              checked={moveSlots}
              onCheckedChange={setMoveSlots}
            />
          </div>

          {/* Reason (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs text-muted-foreground">
              Motif de la réaffectation (optionnel)
            </Label>
            <Textarea
              id="reason"
              placeholder="Ex: Congés, surcharge de travail, changement de périmètre..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none h-16"
            />
          </div>

          {/* Warning if task has slots and not moving (only for transfer mode) */}
          {reassignMode === 'transfer' && !moveSlots && task.assignee_id && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Les créneaux de planning resteront affectés à l'ancien responsable. 
                Vous devrez replanifier manuellement la tâche.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button 
            onClick={handleReassign} 
            disabled={!selectedUserId || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : reassignMode === 'duplicate' ? (
              <Copy className="h-4 w-4" />
            ) : (
              <UserRoundPlus className="h-4 w-4" />
            )}
            {reassignMode === 'duplicate' ? 'Dupliquer' : 'Réaffecter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}