/**
 * ITRequestStatusBadge — Badge coloré pour it_request_status (demandes IT).
 *
 * Cloné de BEStatusBadge. Variantes : default, compact, dot.
 * Avec `taskId`, devient interactif et permet de changer le statut via dropdown
 * (seules les transitions déclarées dans IT_REQUEST_STATUS_META.nextStatuses sont
 * proposées dans le menu — toutes les valeurs sont affichées mais grisées sauf
 * les transitions autorisées).
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getITRequestStatusMeta,
  IT_REQUEST_STATUS_META,
  IT_REQUEST_STATUS_LIST,
  useITRequestStatus,
  type ITRequestStatus,
} from '@/hooks/useITRequestStatus';

interface ITRequestStatusBadgeProps {
  status: string | null | undefined;
  compact?: boolean;
  dot?: boolean;
  taskId?: string;
  onStatusChange?: (newStatus: ITRequestStatus) => void;
  className?: string;
}

function StatusDot({ status, className }: { status: string | null | undefined; className?: string }) {
  const meta = getITRequestStatusMeta(status);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0 cursor-default', className)}
            style={{ backgroundColor: meta.color }}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {meta.icon} {meta.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StaticBadge({ status, compact, className }: { status: string | null | undefined; compact?: boolean; className?: string }) {
  const meta = getITRequestStatusMeta(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        'border font-medium',
        meta.bgClass,
        meta.textClass,
        compact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        className,
      )}
      style={{ borderColor: meta.color + '60' }}
    >
      {!compact && <span className="mr-1">{meta.icon}</span>}
      {meta.label}
    </Badge>
  );
}

function InteractiveBadge({
  status,
  taskId,
  compact,
  onStatusChange,
  className,
}: {
  status: string | null | undefined;
  taskId: string;
  compact?: boolean;
  onStatusChange?: (newStatus: ITRequestStatus) => void;
  className?: string;
}) {
  const meta = getITRequestStatusMeta(status);
  const { updateITRequestStatus, isUpdating } = useITRequestStatus();
  const currentMeta = status ? IT_REQUEST_STATUS_META[status as ITRequestStatus] : null;
  const allowedNext = new Set(currentMeta?.nextStatuses ?? []);

  const handleSelect = async (next: ITRequestStatus) => {
    if (next === status) return;
    if (!allowedNext.has(next)) return;
    await updateITRequestStatus({ taskId, status: next });
    onStatusChange?.(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isUpdating}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border font-medium transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            meta.bgClass,
            meta.textClass,
            compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1',
            className,
          )}
          style={{ borderColor: meta.color + '60' }}
        >
          {isUpdating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {!compact && <span>{meta.icon}</span>}
              {meta.label}
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        {IT_REQUEST_STATUS_LIST.map(s => {
          const isCurrent = s.value === status;
          const isAllowed = allowedNext.has(s.value);
          const disabled = !isCurrent && !isAllowed;
          return (
            <DropdownMenuItem
              key={s.value}
              disabled={disabled}
              onClick={() => handleSelect(s.value)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isCurrent && 'font-semibold',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className={cn('text-sm', isCurrent && s.textClass)}>{s.label}</span>
              {isCurrent && <span className="ml-auto text-xs text-muted-foreground">actuel</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ITRequestStatusBadge({
  status,
  compact = false,
  dot = false,
  taskId,
  onStatusChange,
  className,
}: ITRequestStatusBadgeProps) {
  if (dot) return <StatusDot status={status} className={className} />;
  if (taskId) {
    return (
      <InteractiveBadge
        status={status}
        taskId={taskId}
        compact={compact}
        onStatusChange={onStatusChange}
        className={className}
      />
    );
  }
  return <StaticBadge status={status} compact={compact} className={className} />;
}
