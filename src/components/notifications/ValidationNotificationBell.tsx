import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Task } from '@/types/task';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ValidationNotificationBellProps {
  pendingValidations: Task[];
  count: number;
  onValidationClick?: (taskId: string) => void;
}

export function ValidationNotificationBell({
  pendingValidations,
  count,
  onValidationClick,
}: ValidationNotificationBellProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShieldCheck className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-destructive-foreground bg-destructive animate-pulse">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">Validations en attente</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {count === 0 ? 'Aucune validation en attente' : `${count} demande${count > 1 ? 's' : ''} en attente`}
          </p>
        </div>
        {pendingValidations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Rien à valider pour le moment
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {pendingValidations.map((task) => {
                const level = task.request_validation_status === 'pending_level_1' ? 1 : 2;
                return (
                  <button
                    key={task.id}
                    onClick={() => onValidationClick?.(task.id)}
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors focus:outline-none focus:bg-accent/50"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-full border bg-warning/10 border-warning/20">
                        <ShieldCheck className="h-4 w-4 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Validation niveau {level}
                        </p>
                        {task.created_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(parseISO(task.created_at), 'd MMM yyyy', { locale: fr })}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
