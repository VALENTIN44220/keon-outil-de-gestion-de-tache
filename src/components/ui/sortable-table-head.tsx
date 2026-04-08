import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableHead } from './table';
import type { SortDirection } from '@/hooks/useTableSort';

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSortKey: string;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  children: React.ReactNode;
  /** Contenu avant le libellé (ex. poignée de glisser-déposer). */
  headerStart?: React.ReactNode;
  /** Poignée de redimensionnement de colonne (ne déclenche pas le tri). */
  onColumnResizeMouseDown?: (e: React.MouseEvent) => void;
}

export const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  function SortableTableHead(
    {
      sortKey,
      currentSortKey,
      currentDirection,
      onSort,
      children,
      className,
      headerStart,
      onColumnResizeMouseDown,
      ...props
    },
    ref,
  ) {
  const isActive = currentSortKey === sortKey && currentDirection !== null;

  return (
    <TableHead
      ref={ref}
      className={cn(
        'relative cursor-pointer select-none transition-colors hover:bg-muted/50',
        isActive && 'bg-muted/30',
        className
      )}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <div className={cn('flex items-center gap-1.5', onColumnResizeMouseDown && 'pr-2')}>
        {headerStart}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        <span className="shrink-0">
          {isActive ? (
            currentDirection === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </span>
      </div>
      {onColumnResizeMouseDown && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner la colonne"
          className="absolute right-0 top-0 bottom-0 z-20 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/55"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onColumnResizeMouseDown(e);
          }}
        />
      )}
    </TableHead>
  );
});

SortableTableHead.displayName = 'SortableTableHead';
