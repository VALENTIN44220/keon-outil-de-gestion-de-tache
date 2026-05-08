/**
 * BEStatusBadge — Badge coloré affichant le be_status d'une tâche BE.
 *
 * Variantes :
 *   - default : badge coloré avec texte
 *   - compact  : pastille + texte en taille réduite
 *   - dot      : pastille seule (tooltip au survol)
 *
 * Avec `interactive`, affiche un menu déroulant pour changer le statut.
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
  getBEStatusMeta,
  BE_STATUS_LIST,
  useBETaskStatus,
  type BETaskStatus,
} from '@/hooks/useBETaskStatus';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BEStatusBadgeProps {
  /** Valeur du be_status */
  status: string | null | undefined;
  /** Affichage réduit (texte plus petit, pas d'icône) */
  compact?: boolean;
  /** Affiche uniquement une pastille colorée (avec tooltip) */
  dot?: boolean;
  /** Si fourni, le badge devient cliquable et permet de changer le statut */
  taskId?: string;
  /** Callback après changement de statut */
  onStatusChange?: (newStatus: BETaskStatus) => void;
  className?: string;
}

// ─── Dot variant ─────────────────────────────────────────────────────────────

function StatusDot({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const meta = getBEStatusMeta(status);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-block w-2.5 h-2.5 rounded-full shrink-0 cursor-default',
              className,
            )}
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

// ─── Static badge ─────────────────────────────────────────────────────────────

function StaticBadge({
  status,
  compact,
  className,
}: {
  status: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const meta = getBEStatusMeta(status);
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

// ─── Interactive badge ────────────────────────────────────────────────────────

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
  onStatusChange?: (newStatus: BETaskStatus) => void;
  className?: string;
}) {
  const meta = getBEStatusMeta(status);
  const { updateBEStatus, isUpdating } = useBETaskStatus();

  const handleSelect = async (next: BETaskStatus) => {
    if (next === status) return;
    await updateBEStatus({ taskId, status: next });
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

      <DropdownMenuContent align="start" className="w-48">
        {BE_STATUS_LIST.map(s => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => handleSelect(s.value)}
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              s.value === status && 'font-semibold',
            )}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className={cn('text-sm', s.value === status && s.textClass)}>
              {s.label}
            </span>
            {s.value === status && (
              <span className="ml-auto text-xs text-muted-foreground">actuel</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function BEStatusBadge({
  status,
  compact = false,
  dot = false,
  taskId,
  onStatusChange,
  className,
}: BEStatusBadgeProps) {
  if (dot) {
    return <StatusDot status={status} className={className} />;
  }

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
