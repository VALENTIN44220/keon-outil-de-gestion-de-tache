import { ReactNode } from 'react';
import { GripVertical, Maximize2, Minimize2, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WidgetWrapperProps {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  onSettings?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  isDragging?: boolean;
}

export function WidgetWrapper({
  title,
  children,
  onRemove,
  onSettings,
  isExpanded,
  onToggleExpand,
  className,
  isDragging,
}: WidgetWrapperProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border-2 border-keon-200 shadow-keon overflow-hidden h-full flex flex-col',
        'hover:border-keon-300 hover:shadow-keon-md transition-all duration-200',
        isDragging && 'opacity-75 shadow-2xl border-keon-blue',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-keon-50 to-white border-b border-keon-100">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-keon-400 cursor-grab active:cursor-grabbing drag-handle" />
          <h3 className="font-semibold text-sm text-keon-900">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {onSettings && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSettings}>
              <Settings className="h-3.5 w-3.5 text-keon-500" />
            </Button>
          )}
          {onToggleExpand && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5 text-keon-500" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-keon-500" />
              )}
            </Button>
          )}
          {onRemove && (
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500" onClick={onRemove}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}
