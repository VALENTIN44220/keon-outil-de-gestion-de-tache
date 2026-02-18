import { useState } from 'react';
import { Task } from '@/types/task';
import { useParentRequestNumber } from '@/hooks/useParentRequestNumber';
import { WorkloadSlot } from '@/types/workload';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  X,
  Calendar,
  Clock,
  User,
  Flag,
  FileText,
  CheckCircle2,
  Trash2,
  Copy,
  RefreshCw,
  MessageSquare,
  Paperclip,
  History,
  ExternalLink,
  Scissors,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TaskDrawerProps {
  task: Task | null;
  slots: WorkloadSlot[];
  isOpen: boolean;
  onClose: () => void;
  onMarkDone?: (taskId: string) => void;
  onDelete?: (slotId: string) => void;
  onSegment?: (slot: WorkloadSlot) => void;
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Urgent', icon: AlertTriangle };
    case 'high':
      return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'Haute', icon: Flag };
    case 'medium':
      return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Moyenne', icon: Flag };
    case 'low':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Basse', icon: Flag };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Normal', icon: Flag };
  }
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'todo':
      return { bg: 'bg-slate-100', text: 'text-slate-700', label: 'À faire' };
    case 'in_progress':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En cours' };
    case 'done':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Terminé' };
    case 'validated':
      return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Validé' };
    case 'to_assign':
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'À affecter' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
  }
};

export function TaskDrawer({
  task,
  slots,
  isOpen,
  onClose,
  onMarkDone,
  onDelete,
  onSegment,
}: TaskDrawerProps) {
  const [comment, setComment] = useState('');
  const parentRequestNumber = useParentRequestNumber(task?.parent_request_id || null);

  if (!task) return null;

  const taskSlots = slots.filter(s => s.task_id === task.id);
  const priorityConfig = getPriorityConfig(task.priority);
  const statusConfig = getStatusConfig(task.status);
  const PriorityIcon = priorityConfig.icon;

  const getDueDateInfo = () => {
    if (!task.due_date) return null;
    const date = parseISO(task.due_date);
    const days = differenceInDays(date, new Date());
    
    if (isPast(date) && !isToday(date)) {
      return { text: `En retard de ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`, color: 'text-red-600', bg: 'bg-red-50' };
    }
    if (isToday(date)) {
      return { text: "Échéance aujourd'hui", color: 'text-orange-600', bg: 'bg-orange-50' };
    }
    if (days <= 3) {
      return { text: `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`, color: 'text-amber-600', bg: 'bg-amber-50' };
    }
    return { text: format(date, 'EEEE d MMMM yyyy', { locale: fr }), color: 'text-muted-foreground', bg: '' };
  };

  const dueInfo = getDueDateInfo();

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-r from-card to-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={cn("text-xs", statusConfig.bg, statusConfig.text)}>
                  {statusConfig.label}
                </Badge>
                <Badge variant="outline" className={cn("text-xs gap-1", priorityConfig.text)}>
                  <PriorityIcon className="h-3 w-3" />
                  {priorityConfig.label}
                </Badge>
                {task.task_number && (
                  <Badge variant="outline" className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    {task.task_number}
                  </Badge>
                )}
                {parentRequestNumber && (
                  <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">
                    {parentRequestNumber}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-lg font-semibold line-clamp-2 text-left">
                {task.title}
              </SheetTitle>
            </div>
          </div>

          {/* Due date warning */}
          {dueInfo && dueInfo.bg && (
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mt-3", dueInfo.bg)}>
              <AlertTriangle className={cn("h-4 w-4", dueInfo.color)} />
              <span className={cn("text-sm font-medium", dueInfo.color)}>{dueInfo.text}</span>
            </div>
          )}
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Task Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Échéance
                </label>
                <p className="text-sm font-medium">
                  {task.due_date 
                    ? format(parseISO(task.due_date), 'd MMMM yyyy', { locale: fr })
                    : 'Non définie'
                  }
                </p>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Durée planifiée
                </label>
                <p className="text-sm font-medium">
                  {taskSlots.length / 2} jour{taskSlots.length > 2 ? 's' : ''}
                </p>
              </div>
            </div>

            <Separator />

            {/* Description */}
            {task.description && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Description
                  </label>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {task.description}
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Planning slots */}
            {taskSlots.length > 0 && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Créneaux planifiés
                </label>
                <div className="space-y-2">
                  {taskSlots.map((slot) => (
                    <div 
                      key={slot.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {format(parseISO(slot.date), 'EEEE d MMMM', { locale: fr })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.half_day === 'morning' ? 'Matin (8h-12h)' : 'Après-midi (14h-18h)'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {onSegment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onSegment(slot)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Scissors className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(slot.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comment section */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Ajouter un commentaire
              </label>
              <Textarea
                placeholder="Écrire un commentaire..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none"
                rows={3}
              />
              {comment && (
                <Button size="sm" className="w-full">
                  Publier le commentaire
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <SheetFooter className="p-4 border-t bg-muted/30">
          <div className="flex items-center gap-2 w-full">
            {task.status !== 'done' && task.status !== 'validated' && onMarkDone && (
              <Button 
                onClick={() => onMarkDone(task.id)}
                className="flex-1 gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Marquer comme terminé
              </Button>
            )}
            
            <Button variant="outline" size="icon" className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="icon" className="shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>

            {taskSlots.length > 0 && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer la planification ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera tous les créneaux planifiés pour cette tâche. La tâche ne sera pas supprimée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => taskSlots.forEach(s => onDelete(s.id))}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
