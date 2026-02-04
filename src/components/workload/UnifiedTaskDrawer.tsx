import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { WorkloadSlot, UserLeave } from '@/types/workload';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
  Calendar,
  Clock,
  User,
  Flag,
  FileText,
  CheckCircle2,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Palmtree,
  Play,
  Pause,
  RotateCcw,
  UserCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isPast, isToday, differenceInBusinessDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Types for unified drawer
export interface DrawerItem {
  type: 'task' | 'leave';
  task?: Task;
  leave?: UserLeave & { userName?: string };
  slots?: WorkloadSlot[];
}

interface UnifiedTaskDrawerProps {
  item: DrawerItem | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, newStatus: string) => Promise<void>;
  onAssigneeChange?: (taskId: string, assigneeId: string) => Promise<void>;
  onSlotDelete?: (slotId: string) => Promise<void>;
  onMarkDone?: (taskId: string) => Promise<void>;
  teamMembers?: { id: string; display_name: string; avatar_url?: string }[];
}

// Use centralized status configuration
const STATUS_OPTIONS = [
  { value: 'to_assign', label: 'À affecter', color: 'bg-amber-500', icon: UserCheck },
  { value: 'todo', label: 'À faire', color: 'bg-slate-500', icon: Clock },
  { value: 'in-progress', label: 'En cours', color: 'bg-blue-500', icon: Play },
  { value: 'pending_validation_1', label: 'En attente de validation', color: 'bg-violet-500', icon: Pause },
  { value: 'pending_validation_2', label: 'En attente de validation (N2)', color: 'bg-violet-500', icon: Pause },
  { value: 'validated', label: 'Validé / Terminé', color: 'bg-emerald-500', icon: CheckCircle2 },
  { value: 'done', label: 'Terminé', color: 'bg-green-500', icon: CheckCircle2 },
];

const PRIORITY_CONFIG = {
  urgent: { bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', label: 'Urgent' },
  high: { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', label: 'Haute' },
  medium: { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', label: 'Moyenne' },
  low: { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', label: 'Basse' },
  normal: { bg: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-700', label: 'Normal' },
};

const LEAVE_TYPE_CONFIG = {
  paid: { label: 'Congés payés', icon: Palmtree, color: 'bg-cyan-500' },
  unpaid: { label: 'Sans solde', icon: Palmtree, color: 'bg-slate-500' },
  sick: { label: 'Maladie', icon: AlertTriangle, color: 'bg-red-500' },
  rtt: { label: 'RTT', icon: Clock, color: 'bg-purple-500' },
  other: { label: 'Autre', icon: Calendar, color: 'bg-gray-500' },
};

export function UnifiedTaskDrawer({
  item,
  isOpen,
  onClose,
  onStatusChange,
  onAssigneeChange,
  onSlotDelete,
  onMarkDone,
  teamMembers = [],
}: UnifiedTaskDrawerProps) {
  const [comment, setComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset comment when drawer closes
  useEffect(() => {
    if (!isOpen) setComment('');
  }, [isOpen]);

  if (!item) return null;

  const isTask = item.type === 'task' && item.task;
  const isLeave = item.type === 'leave' && item.leave;

  // Task-specific helpers
  const getTaskPriorityConfig = () => {
    if (!isTask || !item.task) return PRIORITY_CONFIG.normal;
    return PRIORITY_CONFIG[item.task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
  };

  const getTaskStatusConfig = () => {
    if (!isTask || !item.task) return STATUS_OPTIONS[0];
    return STATUS_OPTIONS.find(s => s.value === item.task!.status) || STATUS_OPTIONS[0];
  };

  const getDueDateInfo = () => {
    if (!isTask || !item.task?.due_date) return null;
    const date = parseISO(item.task.due_date);
    const days = differenceInDays(date, new Date());
    
    if (isPast(date) && !isToday(date)) {
      return { 
        text: `En retard de ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`, 
        color: 'text-red-600', 
        bg: 'bg-red-50 border-red-200',
        icon: AlertTriangle 
      };
    }
    if (isToday(date)) {
      return { 
        text: "Échéance aujourd'hui", 
        color: 'text-orange-600', 
        bg: 'bg-orange-50 border-orange-200',
        icon: Clock 
      };
    }
    if (days <= 3) {
      return { 
        text: `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`, 
        color: 'text-amber-600', 
        bg: 'bg-amber-50 border-amber-200',
        icon: Clock 
      };
    }
    return null;
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!isTask || !item.task || !onStatusChange) return;
    setIsUpdating(true);
    try {
      await onStatusChange(item.task.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickAction = async (action: 'start' | 'done' | 'reopen') => {
    if (!isTask || !item.task) return;
    
    let newStatus = '';
    switch (action) {
      case 'start': newStatus = 'in-progress'; break;
      case 'done': newStatus = 'done'; break;
      case 'reopen': newStatus = 'todo'; break;
    }
    
    if (newStatus && onStatusChange) {
      await handleStatusChange(newStatus);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Leave-specific helpers
  const getLeaveConfig = () => {
    if (!isLeave || !item.leave) return LEAVE_TYPE_CONFIG.other;
    return LEAVE_TYPE_CONFIG[item.leave.leave_type] || LEAVE_TYPE_CONFIG.other;
  };

  const getLeaveDuration = () => {
    if (!isLeave || !item.leave) return 0;
    const start = parseISO(item.leave.start_date);
    const end = parseISO(item.leave.end_date);
    return differenceInBusinessDays(end, start) + 1;
  };

  // Render Task Drawer
  const renderTaskContent = () => {
    if (!item.task) return null;
    
    const task = item.task;
    const priorityConfig = getTaskPriorityConfig();
    const statusConfig = getTaskStatusConfig();
    const dueInfo = getDueDateInfo();
    const taskSlots = item.slots || [];
    const StatusIcon = statusConfig.icon;

    return (
      <>
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b bg-gradient-to-br from-card via-card to-muted/30">
          <div className="space-y-3">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("gap-1.5 text-white", statusConfig.color)}>
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className={cn("gap-1", priorityConfig.text)}>
                <Flag className="h-3 w-3" />
                {priorityConfig.label}
              </Badge>
            </div>
            
            {/* Title */}
            <SheetTitle className="text-lg font-semibold leading-tight text-left pr-8">
              {task.title}
            </SheetTitle>

            {/* Due date warning */}
            {dueInfo && (
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", dueInfo.bg)}>
                <dueInfo.icon className={cn("h-4 w-4", dueInfo.color)} />
                <span className={cn("text-sm font-medium", dueInfo.color)}>{dueInfo.text}</span>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Quick Actions */}
            <div className="flex gap-2">
              {task.status === 'todo' && (
                <Button 
                  size="sm" 
                  className="flex-1 gap-2"
                  onClick={() => handleQuickAction('start')}
                  disabled={isUpdating}
                >
                  <Play className="h-4 w-4" />
                  Démarrer
                </Button>
              )}
              {task.status === 'in-progress' && (
                <Button 
                  size="sm" 
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleQuickAction('done')}
                  disabled={isUpdating}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Terminer
                </Button>
              )}
              {(task.status === 'done' || task.status === 'validated') && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleQuickAction('reopen')}
                  disabled={isUpdating}
                >
                  <RotateCcw className="h-4 w-4" />
                  Rouvrir
                </Button>
              )}
            </div>

            {/* Status selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Changer le statut
              </label>
              <Select 
                value={task.status} 
                onValueChange={handleStatusChange}
                disabled={isUpdating}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => {
                    const Icon = status.icon;
                    return (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", status.color)} />
                          <Icon className="h-3.5 w-3.5" />
                          {status.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Task Info Grid */}
            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Durée planifiée
                </label>
                <p className="text-sm font-medium">
                  {taskSlots.length > 0 
                    ? `${taskSlots.length / 2} jour${taskSlots.length > 2 ? 's' : ''}`
                    : 'Non planifiée'
                  }
                </p>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <>
                <Separator />
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Description
                  </label>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded-lg">
                    {task.description}
                  </p>
                </div>
              </>
            )}

            {/* Planning slots */}
            {taskSlots.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Créneaux planifiés ({taskSlots.length})
                  </label>
                  <div className="space-y-2">
                    {taskSlots.slice(0, 5).map((slot) => (
                      <div 
                        key={slot.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
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
                        
                        {onSlotDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onSlotDelete(slot.id)}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {taskSlots.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        + {taskSlots.length - 5} autres créneaux
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Comment section */}
            <Separator />
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Ajouter un commentaire
              </label>
              <Textarea
                placeholder="Écrire un commentaire..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none min-h-[80px]"
              />
              {comment && (
                <Button size="sm" className="w-full">
                  Publier
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 flex-1">
            <ExternalLink className="h-4 w-4" />
            Voir détails
          </Button>
          {taskSlots.length > 0 && onSlotDelete && (
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
                    Cette action supprimera tous les créneaux planifiés pour cette tâche.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => taskSlots.forEach(s => onSlotDelete(s.id))}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </>
    );
  };

  // Render Leave Drawer
  const renderLeaveContent = () => {
    if (!item.leave) return null;
    
    const leave = item.leave;
    const leaveConfig = getLeaveConfig();
    const duration = getLeaveDuration();
    const LeaveIcon = leaveConfig.icon;

    return (
      <>
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b bg-gradient-to-br from-cyan-50 via-card to-card dark:from-cyan-950/30">
          <div className="space-y-3">
            <Badge className={cn("gap-1.5 text-white", leaveConfig.color)}>
              <LeaveIcon className="h-3 w-3" />
              {leaveConfig.label}
            </Badge>
            
            <SheetTitle className="text-lg font-semibold leading-tight text-left">
              Congé - {leave.userName || 'Collaborateur'}
            </SheetTitle>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(parseISO(leave.start_date), 'd MMM', { locale: fr })}
                {' → '}
                {format(parseISO(leave.end_date), 'd MMM yyyy', { locale: fr })}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Duration card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/50 dark:to-cyan-900/30 border border-cyan-200/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">Durée</p>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                    {duration} jour{duration > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Palmtree className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
                <label className="text-xs font-medium text-muted-foreground">Début</label>
                <p className="text-sm font-medium">
                  {format(parseISO(leave.start_date), 'EEEE d MMMM', { locale: fr })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leave.start_half_day === 'morning' ? 'Matin' : 'Après-midi'}
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
                <label className="text-xs font-medium text-muted-foreground">Fin</label>
                <p className="text-sm font-medium">
                  {format(parseISO(leave.end_date), 'EEEE d MMMM', { locale: fr })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {leave.end_half_day === 'morning' ? 'Matin' : 'Après-midi'}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className={cn(
                "h-3 w-3 rounded-full",
                leave.status === 'declared' ? "bg-emerald-500" : "bg-slate-400"
              )} />
              <span className="text-sm font-medium">
                {leave.status === 'declared' ? 'Déclaré' : 'Annulé'}
              </span>
            </div>

            {/* Description */}
            {leave.description && (
              <>
                <Separator />
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Note</label>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {leave.description}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {isTask && renderTaskContent()}
        {isLeave && renderLeaveContent()}
      </SheetContent>
    </Sheet>
  );
}
