import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, FileText, Users } from 'lucide-react';

interface TaskSelectionCardProps {
  id: string;
  name: string;
  description?: string | null;
  isSelected: boolean;
  hasCustomFields: boolean;
  onToggle: () => void;
}

export function TaskSelectionCard({
  id,
  name,
  description,
  isSelected,
  hasCustomFields,
  onToggle,
}: TaskSelectionCardProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'group relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
        isSelected
          ? 'bg-primary/5 border-primary shadow-sm'
          : 'bg-white border-border hover:border-primary/30 hover:shadow-sm'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'mt-0.5 transition-all',
          isSelected && 'border-primary data-[state=checked]:bg-primary'
        )}
      />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <CheckSquare className={cn(
            'h-4 w-4 flex-shrink-0',
            isSelected ? 'text-primary' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'text-sm font-medium truncate',
            isSelected ? 'text-primary' : 'text-foreground'
          )}>
            {name}
          </span>
        </div>
        
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
            {description}
          </p>
        )}
        
        {/* Badges */}
        <div className="flex items-center gap-2 mt-2 ml-6">
          {hasCustomFields && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              <FileText className="h-3 w-3" />
              Champs
            </Badge>
          )}
        </div>
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
      )}
    </div>
  );
}
