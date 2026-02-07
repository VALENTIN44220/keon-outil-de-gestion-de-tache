import { useEffect, useRef } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestMention } from '@/hooks/useRequestMentions';

interface MentionPopoverProps {
  suggestions: RequestMention[];
  loading: boolean;
  selectedIndex: number;
  onSelect: (mention: RequestMention) => void;
  position: { top: number; left: number } | null;
  visible: boolean;
}

const statusColors: Record<string, string> = {
  todo: 'bg-muted text-muted-foreground',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  validated: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function MentionPopover({
  suggestions,
  loading,
  selectedIndex,
  onSelect,
  position,
  visible,
}: MentionPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-mention-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!visible || (!loading && suggestions.length === 0)) {
    return null;
  }

  return (
    <div
      className="absolute z-50 w-80 max-h-60 overflow-y-auto rounded-lg border bg-popover shadow-lg"
      style={{
        bottom: position ? `calc(100% - ${position.top}px + 8px)` : 'calc(100% + 8px)',
        left: position?.left ?? 0,
      }}
      ref={listRef}
    >
      {loading ? (
        <div className="flex items-center justify-center p-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Recherche...</span>
        </div>
      ) : (
        <div className="py-1">
          {suggestions.map((mention, index) => (
            <button
              key={mention.id}
              data-mention-item
              onClick={() => onSelect(mention)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2 text-left transition-colors',
                'hover:bg-accent',
                index === selectedIndex && 'bg-accent'
              )}
            >
              <FileText className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-primary">
                    {mention.request_number}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded',
                      statusColors[mention.status] || 'bg-muted text-muted-foreground'
                    )}
                  >
                    {mention.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {mention.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
