import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal } from 'lucide-react';
import { CrossFiltersPanel } from './CrossFiltersPanel';
import { CrossFilters } from './types';

function countActiveFilters(filters: CrossFilters): number {
  return (
    filters.assigneeIds.length +
    filters.serviceGroupIds.length +
    filters.categoryIds.length +
    filters.processIds.length +
    filters.statuses.length +
    filters.priorities.length +
    (filters.labelIds?.length || 0) +
    (filters.itProjectIds?.length || 0) +
    (filters.dateRange.start ? 1 : 0) +
    (filters.searchQuery ? 1 : 0)
  );
}

interface FilterDrawerButtonProps {
  filters: CrossFilters;
  onFiltersChange: (filters: CrossFilters) => void;
  processId?: string;
  contextId?: string;
  isAdmin?: boolean;
  disableAutoApplyDefault?: boolean;
  visibleColumns?: string[];
  onVisibleColumnsChange?: (cols: string[]) => void;
  className?: string;
}

export function FilterDrawerButton({
  filters,
  onFiltersChange,
  processId,
  contextId = 'default',
  isAdmin,
  disableAutoApplyDefault,
  visibleColumns,
  onVisibleColumnsChange,
  className,
}: FilterDrawerButtonProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`gap-2 ${className ?? ''}`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtres
        {activeCount > 0 && (
          <Badge className="h-[18px] min-w-[18px] px-1 text-[10px] rounded-full bg-keon-blue text-white">
            {activeCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[420px] sm:w-[500px] flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-5 py-4 border-b bg-gradient-to-r from-keon-50 to-white shrink-0">
            <SheetTitle className="flex items-center gap-2 text-keon-900 text-base">
              <SlidersHorizontal className="h-4 w-4 text-keon-blue" />
              Filtres croisés
              {activeCount > 0 && (
                <Badge className="bg-keon-blue text-white text-xs ml-1">
                  {activeCount} actif{activeCount > 1 ? 's' : ''}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <CrossFiltersPanel
              filters={filters}
              onFiltersChange={onFiltersChange}
              processId={processId}
              contextId={contextId}
              isAdmin={isAdmin}
              disableAutoApplyDefault={disableAutoApplyDefault}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={onVisibleColumnsChange}
              defaultCollapsed={false}
              onClose={() => setOpen(false)}
              inDrawer
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
